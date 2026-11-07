import express from 'express';
import cors from 'cors';
import { loadConfig } from './config.js';
import { ApiError, errorBody } from './errors.js';
import { GeminiGateway } from './gemini.js';
import { validateGuidance } from './guidance.js';
import { validateImage } from './images.js';
import { parseHintForm } from './multipart.js';
import { SessionStore } from './sessions.js';

const invalid = message => { throw new ApiError(422, 'invalid_request', message); };
function goalValue(body, optional = false) {
  if (optional && body === undefined) return undefined;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'goal')) {
    invalid('Supply JSON containing only goal.');
  }
  if (optional && (body.goal === undefined || body.goal === null)) return undefined;
  if (typeof body.goal !== 'string' || !body.goal.trim() || body.goal.trim().length > 2000) {
    invalid('goal must be a nonblank string of at most 2000 characters.');
  }
  return body.goal.trim();
}

function hintValues(fields) {
  if (typeof fields.session_id !== 'string' || !fields.session_id.trim() || fields.session_id.trim().length > 128) {
    invalid('session_id must be a nonblank string of at most 128 characters.');
  }
  if (!['initial', 'more_hint', 'check_again'].includes(fields.action)) invalid('Invalid action.');
  if (fields.question !== undefined && (typeof fields.question !== 'string' || fields.question.trim().length > 2000)) {
    invalid('question must be a string of at most 2000 characters.');
  }
  return { sessionId: fields.session_id.trim(), action: fields.action, question: fields.question?.trim() || null };
}

export function createApp({ config = loadConfig(), gateway, buildTutoringInstructions } = {}) {
  gateway ??= new GeminiGateway({ apiKey: config.apiKey, model: config.model, timeoutMs: config.timeoutMs, buildTutoringInstructions });
  const app = express();
  app.disable('x-powered-by');
  const sessions = new SessionStore(config);
  const cleanup = setInterval(() => sessions.expire(), config.cleanupIntervalMs);
  cleanup.unref();
  let closed = false;
  app.locals.sessions = sessions;
  app.locals.gateway = gateway;
  app.locals.config = config;
  app.locals.close = async () => {
    if (closed) return;
    closed = true;
    clearInterval(cleanup);
    sessions.clear();
    await gateway.aclose?.();
  };

  app.use(cors({
    origin: config.allowedOrigins, credentials: false,
    methods: ['GET', 'POST', 'DELETE'], allowedHeaders: ['Content-Type'], exposedHeaders: ['Retry-After'],
  }));
  let inflight = 0;
  app.use((req, res, next) => {
    if (inflight >= config.maxInflightRequests) {
      next(new ApiError(503, 'server_busy', 'Backend is busy. Try again shortly.'));
      return;
    }
    inflight += 1;
    let done = false;
    let responseDone = false;
    let workPending = false;
    const release = () => {
      if (!done && responseDone && !workPending) { done = true; inflight -= 1; }
    };
    const responseEnded = () => { responseDone = true; release(); };
    res.locals.beginWork = () => { workPending = true; };
    res.locals.finishWork = () => { workPending = false; release(); };
    res.once('finish', responseEnded);
    res.once('close', responseEnded);
    next();
  });

  const json = express.json({ limit: 16384, strict: true, inflate: false });
  app.get('/health', (req, res) => res.json({ status: 'ok', gemini_configured: Boolean(config.apiKey), model: config.model }));
  app.post('/session', json, (req, res) => {
    const goal = goalValue(req.body);
    res.json({ session_id: sessions.create(goal).sessionId });
  });
  app.post('/session/:sessionId/reset', json, (req, res) => {
    const goal = goalValue(req.body, true);
    const session = sessions.acquire(req.params.sessionId);
    try {
      sessions.clearProblem(session);
      if (goal !== undefined) session.goal = goal;
      sessions.touch(session);
      res.json({ session_id: session.sessionId, hint_level: 0 });
    } finally { sessions.release(session); }
  });
  app.delete('/session/:sessionId', (req, res) => {
    sessions.delete(req.params.sessionId);
    res.status(204).end();
  });

  const rawImageForm = express.raw({ type: () => true, limit: config.maxImageBytes + 65536, inflate: false });
  app.post('/hint', (req, res, next) => {
    if (!req.is('multipart/form-data')) next(new ApiError(415, 'invalid_content_type', 'Send /hint as multipart/form-data.'));
    else next();
  }, rawImageForm, async (req, res) => {
    // A disconnected client must not free capacity while its Gemini call continues.
    res.locals.beginWork();
    try {
      const { fields, screenshot: file } = await parseHintForm(req, config);
      const { sessionId, action, question } = hintValues(fields);
      if (action !== 'more_hint' && !file) {
        throw new ApiError(422, 'screenshot_required', 'This action requires a fresh screenshot upload.');
      }
      if (action === 'more_hint' && (file || Object.hasOwn(fields, 'screenshot'))) {
        throw new ApiError(422, 'unexpected_screenshot', 'Use check_again for a new screenshot; more_hint reuses the current context.');
      }
      const session = sessions.acquire(sessionId);
      try {
        if (action === 'initial' && session.hintLevel) {
          throw new ApiError(409, 'problem_already_started', 'Reset this session before starting a new problem.');
        }
        if (action !== 'initial' && !session.hintLevel) {
          throw new ApiError(409, 'problem_not_started', 'Start with initial and a screenshot first.');
        }
        const image = file ? await validateImage(file, config) : session.screenshot;
        const targetLevel = action === 'initial' ? 1 : action === 'more_hint' ? Math.min(session.hintLevel + 1, 3) : session.hintLevel;
        const guidance = validateGuidance(await gateway.generate({
          goal: session.goal, action, hintLevel: targetLevel, question,
          problemContext: JSON.stringify({ initial_question: session.problemQuestion, latest_observation: session.observation }),
          history: session.history.map(item => ({ ...item })), screenshot: image,
          previousScreenshot: action === 'check_again' ? session.screenshot : null,
        }));
        const normalize = value => value.toLowerCase().replace(/\s+/gu, ' ').trim();
        if (action === 'more_hint' && session.history.length && normalize(guidance.message) === normalize(session.history.at(-1).message)) {
          throw new ApiError(502, 'gemini_repeated_hint', 'Gemini repeated its previous hint. Please try again.');
        }
        const result = { hint_level: targetLevel, ...guidance };
        // Commit only after Gemini and all output validation have succeeded.
        session.hintLevel = targetLevel;
        session.screenshot = image;
        session.observation = guidance.observation;
        if (action === 'initial') session.problemQuestion = question;
        session.history.push({ action, question, ...result });
        if (session.history.length > config.historyLimit) session.history.splice(0, session.history.length - config.historyLimit);
        sessions.touch(session);
        res.json(result);
      } finally { sessions.release(session); }
    } finally { res.locals.finishWork(); }
  });

  app.use((req, res, next) => next(new ApiError(404, 'http_error', 'Request could not be handled.')));
  app.use((error, req, res, next) => {
    if (res.headersSent) { res.end(); return; }
    if (error instanceof ApiError) {
      res.set(error.headers).status(error.status).json(errorBody(error.code, error.message));
    } else if (error.type === 'entity.too.large') {
      res.status(413).json(errorBody('request_too_large', 'Request body exceeds the configured limit.'));
    } else if (error.type === 'entity.parse.failed') {
      res.status(422).json(errorBody('invalid_request', 'Malformed JSON request body.'));
    } else if (error.status === 415) {
      res.status(415).json(errorBody('invalid_content_type', 'Unsupported request content type or encoding.'));
    } else {
      // Provider/decoder exception text may include user data. Never log or return it.
      res.status(500).json(errorBody('internal_error', 'An unexpected backend error occurred.'));
    }
  });
  return app;
}
