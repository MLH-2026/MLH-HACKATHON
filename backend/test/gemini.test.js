// All responses are explicitly mocked; no test contacts Gemini or spends quota.
import assert from 'node:assert/strict';
import test from 'node:test';

import { GoogleGenAI } from '@google/genai';

import { ApiError } from '../src/errors.js';
import { GeminiGateway } from '../src/gemini.js';

const guidance = {
  observation: 'The visible loop visits two items.',
  message: 'Which values can the loop index reach?',
  needs_more_context: false,
  context_question: null,
};

function response(payload = guidance, finishReason = 'STOP') {
  return {
    candidates: [{
      finishReason,
      content: {
        role: 'model',
        parts: [{ text: typeof payload === 'string' ? payload : JSON.stringify(payload) }],
      },
    }],
  };
}

function requestData(overrides = {}) {
  return {
    goal: 'Understand Python loops',
    action: 'initial',
    hintLevel: 1,
    question: 'Why is an item missing?',
    problemContext: '',
    history: [],
    screenshot: { data: Buffer.from('current-image-bytes'), mimeType: 'image/png' },
    previousScreenshot: null,
    ...overrides,
  };
}

function stubGateway(generate = async () => response(), options = {}) {
  const calls = [];
  const client = {
    models: {
      async generateContent(request) {
        calls.push(request);
        return generate(request);
      },
    },
  };
  return {
    calls,
    gateway: new GeminiGateway({
      apiKey: 'test-only-key', model: 'configured-model', client, ...options,
    }),
  };
}

test('initial uses configured model, inline image, structured schema, and no paid loops', async () => {
  const { gateway, calls } = stubGateway();
  assert.deepEqual(await gateway.generate(requestData()), guidance);
  assert.equal(calls.length, 1);
  const sent = calls[0];
  assert.equal(sent.model, 'configured-model');
  assert.equal(sent.config.responseMimeType, 'application/json');
  assert.ok(sent.config.responseJsonSchema.properties.message);
  assert.equal(sent.config.httpOptions.retryOptions.attempts, 1);
  assert.equal(sent.config.automaticContinuation, false);
  assert.ok(sent.config.abortSignal instanceof AbortSignal);
  const parts = sent.contents[0].parts;
  assert.equal(Buffer.from(parts.at(-1).inlineData.data, 'base64').toString(), 'current-image-bytes');
  assert.equal(parts.at(-1).inlineData.mimeType, 'image/png');
  assert.ok(!parts.map((part) => part.text ?? '').join('').includes('test-only-key'));
});

test('check_again labels and sends previous and fresh images in order', async () => {
  const { gateway, calls } = stubGateway();
  await gateway.generate(requestData({
    action: 'check_again',
    previousScreenshot: { data: Buffer.from('older-image'), mimeType: 'image/jpeg' },
    problemContext: 'Previously the loop visited two items.',
  }));
  const parts = calls[0].contents[0].parts;
  assert.deepEqual(
    parts.filter((part) => part.inlineData)
      .map((part) => Buffer.from(part.inlineData.data, 'base64').toString()),
    ['older-image', 'current-image-bytes'],
  );
  assert.match(parts[1].text, /PREVIOUS/);
  assert.match(parts[3].text, /CURRENT fresh/);
});

test('more_hint supplies bounded prior history and labels the retained screenshot', async () => {
  const { gateway, calls } = stubGateway();
  await gateway.generate(requestData({
    action: 'more_hint',
    hintLevel: 2,
    history: [{ message: 'What does the loop bound represent?' }],
  }));
  const parts = calls[0].contents[0].parts;
  assert.match(parts[0].text, /What does the loop bound represent\?/);
  assert.match(parts[0].text, /"requested_hint_level":2/);
  assert.match(parts[1].text, /not a fresh capture/);
});

for (const [name, payload] of [
  ['non-JSON text', 'not JSON'],
  ['missing fields', {}],
  ['blank message', { ...guidance, message: ' ' }],
  ['oversized message', { ...guidance, message: 'x'.repeat(6001) }],
  ['nonboolean context flag', { ...guidance, needs_more_context: 'false' }],
  ['missing clarification', { ...guidance, needs_more_context: true }],
  ['unexpected clarification', { ...guidance, context_question: 'Which language?' }],
  ['unexpected field', { ...guidance, extra: 'invalid' }],
]) {
  test(`rejects invalid model guidance: ${name}`, async () => {
    const { gateway } = stubGateway(async () => response(payload));
    await assert.rejects(gateway.generate(requestData()), {
      status: 502, code: 'gemini_invalid_response',
    });
  });
}

for (const finish of ['MAX_TOKENS', 'SAFETY', 'CONTINUATION']) {
  test(`rejects ${finish} even if response text happens to contain valid JSON`, async () => {
    const { gateway } = stubGateway(async () => response(guidance, finish));
    await assert.rejects(gateway.generate(requestData()), { code: 'gemini_invalid_response' });
  });
}

for (const [upstreamStatus, status, code] of [
  [429, 429, 'gemini_rate_limited'],
  [504, 504, 'gemini_timeout'],
  [401, 503, 'gemini_configuration_error'],
  [404, 503, 'gemini_configuration_error'],
  [503, 503, 'gemini_unavailable'],
]) {
  test(`sanitizes upstream ${upstreamStatus} failures`, async () => {
    const { gateway } = stubGateway(async () => {
      throw Object.assign(new Error('secret-provider-request-content'), { status: upstreamStatus });
    });
    await assert.rejects(gateway.generate(requestData()), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      assert.ok(!String(error).includes('secret-provider-request-content'));
      if (status === 429) assert.equal(error.headers['Retry-After'], '30');
      return true;
    });
  });
}

test('wall-clock timeout aborts even when an injected client ignores its signal', async () => {
  const { gateway, calls } = stubGateway(() => new Promise(() => {}), { timeoutMs: 10 });
  await assert.rejects(gateway.generate(requestData()), { status: 504, code: 'gemini_timeout' });
  assert.equal(calls[0].config.abortSignal.aborted, true);
});

test('missing credentials fail without creating an SDK client', async () => {
  const gateway = new GeminiGateway({ model: 'configured-model' });
  await assert.rejects(gateway.generate(requestData()), { status: 503, code: 'gemini_not_configured' });
  assert.equal(gateway.client, null);
});

test('optional teammate prompt receives only action and level and follows baseline guardrails', async () => {
  let promptInput;
  const { gateway, calls } = stubGateway(undefined, {
    buildTutoringInstructions(input) {
      promptInput = input;
      return 'Use one short conceptual analogy.';
    },
  });
  await gateway.generate(requestData());
  assert.deepEqual(promptInput, { action: 'initial', hintLevel: 1 });
  assert.match(calls[0].config.systemInstruction, /Use one short conceptual analogy\./);
  assert.match(calls[0].config.systemInstruction, /consistent with the baseline rules above/);
});

for (const [name, buildTutoringInstructions] of [
  ['async result', () => Promise.resolve('async is unsupported')],
  ['async rejection', () => Promise.reject(new Error('private prompt failure'))],
  ['nonstring result', () => ({})],
  ['oversized result', () => 'x'.repeat(20_001)],
]) {
  test(`invalid optional prompt ${name} fails before any Gemini request`, async () => {
    const { gateway, calls } = stubGateway(undefined, { buildTutoringInstructions });
    await assert.rejects(gateway.generate(requestData()), { status: 503, code: 'tutoring_prompt_invalid' });
    assert.equal(calls.length, 0);
  });
}

test('actual SDK constructs multimodal JSON through an explicitly mocked fetch boundary', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected network attempt outside the mocked HTTP boundary');
  });
  const requests = [];
  const client = new GoogleGenAI({
    apiKey: 'test-only-key',
    vertexai: false,
    httpOptions: {
      retryOptions: { attempts: 1 },
      async fetch(url, options) {
        requests.push({ url, options });
        return new Response(JSON.stringify(response()), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });
  const gateway = new GeminiGateway({ apiKey: 'test-only-key', model: 'configured-model', client });
  assert.deepEqual(await gateway.generate(requestData()), guidance);
  assert.equal(requests.length, 1);
  assert.match(String(requests[0].url), /\/models\/configured-model:generateContent/);
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.contents[0].role, 'user');
  const image = body.contents[0].parts.at(-1).inlineData;
  assert.equal(image.mimeType, 'image/png');
  assert.equal(Buffer.from(image.data, 'base64').toString(), 'current-image-bytes');
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  const schema = body.generationConfig.responseJsonSchema;
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.message.maxLength, 6000);
  assert.deepEqual(new Set(schema.required), new Set(Object.keys(guidance)));
});

test('actual SDK rate-limit failures make one attempt and expose no raw provider content', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected network attempt outside the mocked HTTP boundary');
  });
  let attempts = 0;
  const client = new GoogleGenAI({
    apiKey: 'test-only-key',
    vertexai: false,
    httpOptions: {
      async fetch() {
        attempts += 1;
        return new Response(JSON.stringify({
          error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'private provider content' },
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      },
    },
  });
  const gateway = new GeminiGateway({
    apiKey: 'test-only-key', model: 'configured-model', timeoutMs: 1000, client,
  });
  await assert.rejects(gateway.generate(requestData()), (error) => {
    assert.equal(error.status, 429);
    assert.equal(error.code, 'gemini_rate_limited');
    assert.ok(!String(error).includes('private provider content'));
    return true;
  });
  assert.equal(attempts, 1);
});
