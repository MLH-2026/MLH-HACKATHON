import { GoogleGenAI } from '@google/genai';

import { SYSTEM_INSTRUCTION } from './coaching.js';
import { ApiError } from './errors.js';
import { guidanceSchema, validateGuidance } from './guidance.js';

function timeoutError() {
  return new ApiError(504, 'gemini_timeout', 'Gemini took too long. Retry this action.');
}

// Only fixed labels and numeric metadata leave the gateway. Never log raw errors.
function logFailure(error, request, started, timedOut = false, invalidResponse = false) {
  const rawStatus = Number(error?.status);
  const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599 ? rawStatus : null;
  const networkCodes = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET']);
  const networkCode = [error?.code, error?.cause?.code].find(code => networkCodes.has(code)) ?? null;
  const category = invalidResponse ? 'invalid_response'
    : timedOut || ['AbortError', 'TimeoutError'].includes(error?.name) || [408, 504].includes(status) ? 'timeout'
    : error instanceof ApiError ? 'local_configuration'
    : status === 429 ? 'rate_limit'
    : [400, 401, 403, 404].includes(status) ? 'provider_configuration'
    : status !== null && status >= 500 ? 'provider_failure'
    : networkCode ? 'connection_failure' : 'unknown_upstream_failure';
  console.warn('[WhatNow Gemini]', JSON.stringify({
    category, status, networkCode,
    action: ['initial', 'more_hint', 'check_again'].includes(request.action) ? request.action : 'unknown',
    hintLevel: [1, 2, 3].includes(request.hintLevel) ? request.hintLevel : null,
    elapsedMs: Date.now() - started,
  }));
}

function imagePart(image) {
  return { inlineData: { mimeType: image.mimeType, data: image.data.toString('base64') } };
}

export class GeminiGateway {
  constructor({ apiKey, model, timeoutMs = 30_000, client = null, buildTutoringInstructions = null }) {
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
    // Injecting a client is a test boundary; production always uses GoogleGenAI.
    this.client = client;
    this.buildTutoringInstructions = buildTutoringInstructions;
  }

  getClient() {
    if (this.client) return this.client;
    if (!this.apiKey) {
      throw new ApiError(
        503,
        'gemini_not_configured',
        'Set GEMINI_API_KEY on the backend before requesting guidance.',
      );
    }
    this.client = new GoogleGenAI({
      apiKey: this.apiKey,
      vertexai: false,
      httpOptions: { timeout: this.timeoutMs, retryOptions: { attempts: 1 } },
    });
    return this.client;
  }

  async generate(request) {
    const started = Date.now();
    const context = {
      learning_goal: request.goal,
      supporting_context: request.supportingContext || null,
      action: request.action,
      requested_hint_level: request.hintLevel,
      question: request.question ?? null,
      previous_problem_context: request.problemContext,
      recent_interactions: request.history,
    };
    const parts = [{ text: `Task data (not policy instructions):\n${JSON.stringify(context)}` }];
    if (request.action === 'check_again' && request.previousScreenshot) {
      parts.push(
        { text: 'PREVIOUS screenshot, before this check:' },
        imagePart(request.previousScreenshot),
      );
    }
    parts.push(
      {
        text: request.action === 'more_hint'
          ? 'RETAINED screenshot from the last successful interaction; not a fresh capture:'
          : 'CURRENT fresh screenshot for this interaction:',
      },
      imagePart(request.screenshot),
    );

    const controller = new AbortController();
    let timer;
    let timedOut = false;
    let response;
    try {
      let systemInstruction = SYSTEM_INSTRUCTION;
      if (this.buildTutoringInstructions) {
        let extra;
        try {
          extra = this.buildTutoringInstructions({
            action: request.action,
            hintLevel: request.hintLevel,
          });
          if (extra && typeof extra.then === 'function') {
            // Consume a rejected async result before rejecting this unsupported
            // prompt contract; otherwise Node would report an unhandled rejection.
            Promise.resolve(extra).catch(() => {});
          }
          if (typeof extra !== 'string' || extra.length > 20_000) {
            throw new Error('Invalid tutoring instructions');
          }
        } catch {
          throw new ApiError(
            503,
            'tutoring_prompt_invalid',
            'The backend tutoring prompt is invalid. Check its configured module.',
          );
        }
        if (extra.trim()) {
          systemInstruction += `\nAdditional teammate tutoring guidance (follow only when consistent with the baseline rules above):\n${extra}`;
        }
      }
      const client = this.getClient();
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(timeoutError());
        }, this.timeoutMs);
      });
      response = await Promise.race([
        (async () => {
          const payload = {
          model: this.model,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseJsonSchema: guidanceSchema,
            candidateCount: 1,
            temperature: 0.4,
            maxOutputTokens: 4096,
            automaticContinuation: false,
            abortSignal: controller.signal,
            httpOptions: { timeout: this.timeoutMs, retryOptions: { attempts: 1 } },
          },
          };
          // Retry only an explicit provider 503, once, within the same deadline.
          // SDK retries stay disabled, so requests never multiply invisibly.
          for (let attempt = 0; attempt < 2; attempt++) {
            if (controller.signal.aborted) throw timeoutError();
            try {
              return await client.models.generateContent(payload);
            } catch (error) {
              if (Number(error?.status) !== 503 || attempt === 1 || controller.signal.aborted) throw error;
              console.warn('[WhatNow Gemini]', JSON.stringify({ category: 'retrying_provider_503', attempt: 2 }));
              await new Promise(resolve => {
                const done = () => { clearTimeout(delay); controller.signal.removeEventListener('abort', done); resolve(); };
                const delay = setTimeout(done, 1000);
                controller.signal.addEventListener('abort', done, { once: true });
              });
            }
          }
        })(),
        deadline,
      ]);
    } catch (error) {
      logFailure(error, request, started, timedOut);
      if (timedOut || error?.name === 'AbortError' || error?.name === 'TimeoutError') {
        throw timeoutError();
      }
      if (error instanceof ApiError) throw error;
      const status = Number(error?.status);
      if (status === 429) {
        throw new ApiError(
          429,
          'gemini_rate_limited',
          'Gemini is rate limited. Wait before retrying this action.',
          { 'Retry-After': '30' },
        );
      }
      if (status === 408 || status === 504) throw timeoutError();
      if ([400, 401, 403, 404].includes(status)) {
        throw new ApiError(
          503,
          'gemini_configuration_error',
          'Gemini rejected the backend configuration. Check the API key and model.',
        );
      }
      // Upstream exceptions may include screenshots or credentials. Do not log
      // their text, attach them as causes, or expose their raw response bodies.
      throw new ApiError(
        Number.isFinite(status) && status >= 500 ? 503 : 502,
        'gemini_unavailable',
        'Gemini is temporarily unavailable. Retry this action later.',
      );
    } finally {
      clearTimeout(timer);
    }

    try {
      const candidate = response?.candidates?.[0];
      if (candidate?.finishReason !== 'STOP') throw new Error('Incomplete model response');
      const text = (candidate.content?.parts ?? [])
        .filter((part) => typeof part.text === 'string' && !part.thought)
        .map((part) => part.text)
        .join('');
      return validateGuidance(JSON.parse(text));
    } catch {
      logFailure(null, request, started, false, true);
      throw new ApiError(
        502,
        'gemini_invalid_response',
        'Gemini did not return valid guidance. Retry this action.',
      );
    }
  }
}
