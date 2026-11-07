// Integration tests replace only the Gemini boundary. No paid API calls are made.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import sharp from 'sharp';

import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { ApiError } from '../src/errors.js';

const WHITE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAN0lEQVR4nO3RwQ0AMAjDwJT9d05HMB9+vgGCZF7bXJrT9XhgwR8gEyETIRMhEyETIRMhEyEThXzH8QM9OMM6fAAAAABJRU5ErkJggg==',
  'base64',
);
const BLACK = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAGklEQVR4nO3BAQ0AAADCoPdP7WYOoAAAALoBDCAAATV8oiUAAAAASUVORK5CYII=',
  'base64',
);

function guidance(index = 1) {
  return {
    observation: 'A loop and its output are visible.',
    message: `Step ${index}: which index would the final iteration use?`,
    needs_more_context: false,
    context_question: null,
  };
}

class FakeGateway {
  requests = [];
  results = [];
  closed = false;

  async generate(request) {
    this.requests.push(request);
    if (this.results.length) {
      const result = this.results.shift();
      if (result instanceof Error) throw result;
      return result;
    }
    return guidance(this.requests.length);
  }

  async close() { this.closed = true; }
  async aclose() { this.closed = true; }
}

async function start(t, overrides = {}, gateway = new FakeGateway()) {
  const app = createApp({ config: loadConfig({ apiKey: 'test-key', ...overrides }), gateway });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await app.locals.close();
  });

  async function request(path, options) {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(5000), ...options });
    return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() };
  }
  const json = (path, body, method = 'POST') => request(path, {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  async function session(goal = 'Understand why my Python loop fails') {
    const response = await json('/session', { goal });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(typeof response.body.session_id, 'string');
    return response.body.session_id;
  }
  function hint(sessionId, action = 'initial', screenshot, question) {
    const form = new FormData();
    form.set('session_id', sessionId);
    form.set('action', action);
    if (question !== undefined) form.set('question', question);
    if (screenshot !== undefined) form.set('screenshot', new Blob([screenshot], { type: 'image/png' }), 'work.png');
    return request('/hint', { method: 'POST', body: form });
  }
  return { app, server, gateway, request, json, session, hint };
}

function error(response, status, code) {
  assert.equal(response.status, status, JSON.stringify(response.body));
  assert.equal(typeof response.body.error?.code, 'string');
  assert.equal(typeof response.body.error?.message, 'string');
  assert.ok(response.body.error.message.length);
  if (code) assert.equal(response.body.error.code, code);
}

test('health does not call Gemini', async t => {
  const api = await start(t);
  assert.equal((await api.request('/health')).status, 200);
  assert.equal(api.gateway.requests.length, 0);
});

test('sessions have unique IDs and isolated goals', async t => {
  const api = await start(t);
  const first = await api.session('Learn Python indexing');
  const second = await api.session('Understand JavaScript promises');
  assert.notEqual(first, second);
  assert.equal(api.app.locals.sessions.sessions.get(first).goal, 'Learn Python indexing');
  assert.equal(api.app.locals.sessions.sessions.get(second).goal, 'Understand JavaScript promises');
});

for (const body of [{}, { goal: '' }, { goal: '   ' }, { goal: 12 }, { goal: 'x'.repeat(2001) }]) {
  test(`session rejects invalid goal ${JSON.stringify(body).slice(0, 45)}`, async t => {
    const api = await start(t);
    error(await api.json('/session', body), 422);
  });
}

test('initial passes real image bytes and returns the five response fields', async t => {
  const api = await start(t);
  const id = await api.session();
  const response = await api.hint(id, 'initial', WHITE, 'Why does the last iteration fail?');
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(Object.keys(response.body).sort(), ['hint_level', 'observation', 'message', 'needs_more_context', 'context_question'].sort());
  assert.equal(response.body.hint_level, 1);
  const request = api.gateway.requests[0];
  assert.equal(request.goal, 'Understand why my Python loop fails');
  assert.equal(request.action, 'initial');
  assert.equal(request.question, 'Why does the last iteration fail?');
  assert.deepEqual(request.screenshot.data, WHITE);
  assert.equal(request.screenshot.mimeType, 'image/png');
});

test('more_hint reuses the image, includes history, and caps the ladder at three', async t => {
  const api = await start(t);
  const id = await api.session();
  assert.equal((await api.hint(id, 'initial', WHITE)).body.hint_level, 1);
  for (const level of [2, 3, 3]) {
    const response = await api.hint(id, 'more_hint');
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.hint_level, level);
    assert.deepEqual(api.gateway.requests.at(-1).screenshot.data, WHITE);
  }
  assert.ok(JSON.stringify(api.gateway.requests[1].history).includes('Step 1:'));
});

test('check_again compares previous/fresh screenshots without escalating', async t => {
  const api = await start(t);
  const id = await api.session();
  await api.hint(id, 'initial', WHITE);
  await api.hint(id, 'more_hint');
  const response = await api.hint(id, 'check_again', BLACK);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.hint_level, 2);
  assert.deepEqual(api.gateway.requests.at(-1).previousScreenshot.data, WHITE);
  assert.deepEqual(api.gateway.requests.at(-1).screenshot.data, BLACK);
  assert.equal((await api.hint(id, 'more_hint')).status, 200);
  assert.deepEqual(api.gateway.requests.at(-1).screenshot.data, BLACK);
});

for (const action of ['initial', 'check_again']) {
  test(`${action} requires a screenshot`, async t => {
    const api = await start(t);
    const id = await api.session();
    if (action === 'check_again') await api.hint(id, 'initial', WHITE);
    const count = api.gateway.requests.length;
    error(await api.hint(id, action), 422, 'screenshot_required');
    assert.equal(api.gateway.requests.length, count);
  });
}

for (const action of ['unknown', 'INITIAL', '']) {
  test(`invalid action ${JSON.stringify(action)} never reaches Gemini`, async t => {
    const api = await start(t);
    error(await api.hint(await api.session(), action, WHITE), 422);
    assert.equal(api.gateway.requests.length, 0);
  });
}

for (const action of ['more_hint', 'check_again']) {
  test(`${action} requires an initial problem`, async t => {
    const api = await start(t);
    error(await api.hint(await api.session(), action, action === 'check_again' ? WHITE : undefined), 409, 'problem_not_started');
    assert.equal(api.gateway.requests.length, 0);
  });
}

test('initial cannot silently replace an active problem', async t => {
  const api = await start(t);
  const id = await api.session();
  await api.hint(id, 'initial', WHITE);
  error(await api.hint(id, 'initial', BLACK), 409, 'problem_already_started');
  assert.equal(api.gateway.requests.length, 1);
});

test('reset removes unrelated context, resets the ladder, and optionally changes the goal', async t => {
  const api = await start(t);
  const id = await api.session();
  await api.hint(id, 'initial', WHITE, 'Old unrelated problem');
  await api.hint(id, 'more_hint');
  const response = await api.json(`/session/${id}/reset`, { goal: 'Learn Python dictionaries' });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body, { session_id: id, hint_level: 0 });
  const stored = api.app.locals.sessions.sessions.get(id);
  assert.equal(stored.goal, 'Learn Python dictionaries');
  assert.equal(stored.hintLevel, 0);
  assert.equal(stored.history.length, 0);
  assert.equal(stored.screenshot, null);
  assert.ok(!stored.problemQuestion);
  assert.ok(!stored.observation);
  error(await api.hint(id, 'more_hint'), 409);
  assert.equal((await api.hint(id, 'initial', BLACK)).body.hint_level, 1);
  assert.equal(api.gateway.requests.at(-1).history.length, 0);
  assert.equal(api.gateway.requests.at(-1).previousScreenshot, null);
});

test('reset without a JSON body preserves the learning goal', async t => {
  const api = await start(t);
  const id = await api.session('Learn Python indexing');
  await api.hint(id, 'initial', WHITE);
  assert.equal((await api.json(`/session/${id}/reset`)).status, 200);
  assert.equal(api.app.locals.sessions.sessions.get(id).goal, 'Learn Python indexing');
});

test('delete removes the session and clears retained memory', async t => {
  const api = await start(t);
  const id = await api.session();
  await api.hint(id, 'initial', WHITE);
  const stored = api.app.locals.sessions.sessions.get(id);
  assert.equal((await api.request(`/session/${id}`, { method: 'DELETE' })).status, 204);
  assert.equal(api.app.locals.sessions.sessions.has(id), false);
  assert.equal(stored.screenshot, null);
  assert.equal(stored.history.length, 0);
  error(await api.hint(id, 'more_hint'), 404, 'session_not_found');
});

test('unknown sessions have predictable errors on all session operations', async t => {
  const api = await start(t);
  error(await api.hint('not-a-session', 'initial', WHITE), 404, 'session_not_found');
  error(await api.json('/session/not-a-session/reset'), 404, 'session_not_found');
  error(await api.request('/session/not-a-session', { method: 'DELETE' }), 404, 'session_not_found');
  assert.equal(api.gateway.requests.length, 0);
});

test('expired sessions disappear and release retained screenshot/history', async t => {
  const api = await start(t);
  const id = await api.session();
  await api.hint(id, 'initial', WHITE);
  const store = api.app.locals.sessions;
  const stored = store.sessions.get(id);
  store.now = () => stored.expiresAt + 1;
  error(await api.hint(id, 'more_hint'), 404);
  assert.equal(store.sessions.has(id), false);
  assert.equal(stored.screenshot, null);
  assert.equal(stored.history.length, 0);
});

for (const [status, code] of [[504, 'gemini_timeout'], [429, 'gemini_rate_limited'], [502, 'gemini_invalid_response']]) {
  test(`failed initial (${code}) leaves context unchanged and can retry at level one`, async t => {
    const api = await start(t);
    const id = await api.session();
    api.gateway.results.push(new ApiError(status, code, 'Gemini could not provide guidance.'));
    error(await api.hint(id, 'initial', WHITE), status);
    const stored = api.app.locals.sessions.sessions.get(id);
    assert.equal(stored.hintLevel, 0);
    assert.equal(stored.history.length, 0);
    assert.equal(stored.screenshot, null);
    assert.equal((await api.hint(id, 'initial', WHITE)).body.hint_level, 1);
  });
}

test('failed more_hint preserves history and retries the same hint level', async t => {
  const api = await start(t);
  const id = await api.session();
  await api.hint(id, 'initial', WHITE);
  const stored = api.app.locals.sessions.sessions.get(id);
  const oldHistory = structuredClone(stored.history);
  api.gateway.results.push(new ApiError(504, 'gemini_timeout', 'Gemini timed out.'));
  error(await api.hint(id, 'more_hint'), 504);
  assert.equal(stored.hintLevel, 1);
  assert.deepEqual(stored.history, oldHistory);
  assert.equal((await api.hint(id, 'more_hint')).body.hint_level, 2);
  assert.deepEqual(api.gateway.requests.map(request => request.hintLevel), [1, 2, 2]);
});

test('failed check_again keeps the original screenshot for the next hint', async t => {
  const api = await start(t);
  const id = await api.session();
  await api.hint(id, 'initial', WHITE);
  api.gateway.results.push(new ApiError(502, 'gemini_invalid_response', 'Gemini failed.'));
  error(await api.hint(id, 'check_again', BLACK), 502);
  assert.deepEqual(api.app.locals.sessions.sessions.get(id).screenshot.data, WHITE);
  assert.equal((await api.hint(id, 'more_hint')).status, 200);
  assert.deepEqual(api.gateway.requests.at(-1).screenshot.data, WHITE);
});

test('schema-invalid guidance and repeated hints do not mutate session state', async t => {
  const api = await start(t);
  const id = await api.session();
  api.gateway.results.push({ ...guidance(), needs_more_context: true, context_question: null });
  error(await api.hint(id, 'initial', WHITE), 502);
  const stored = api.app.locals.sessions.sessions.get(id);
  assert.equal(stored.hintLevel, 0);
  assert.equal(stored.screenshot, null);
  await api.hint(id, 'initial', WHITE);
  const history = structuredClone(stored.history);
  api.gateway.results.push({ ...guidance(), message: `  ${history.at(-1).message.toUpperCase()}  ` });
  error(await api.hint(id, 'more_hint'), 502, 'gemini_repeated_hint');
  assert.equal(stored.hintLevel, 1);
  assert.deepEqual(stored.history, history);
});

test('new screenshots must use check_again rather than more_hint', async t => {
  const api = await start(t);
  const id = await api.session();
  await api.hint(id, 'initial', WHITE);
  error(await api.hint(id, 'more_hint', BLACK), 422, 'unexpected_screenshot');
  assert.equal(api.gateway.requests.length, 1);
});

test('hint rejects URL encoded data, malformed multipart, and repeated fields', async t => {
  const api = await start(t);
  const id = await api.session();
  error(await api.request('/hint', { method: 'POST', body: new URLSearchParams({ session_id: id, action: 'more_hint' }) }), 415);
  error(await api.request('/hint', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=boundary' }, body: '--boundary\r\nContent-Disposition: form-data; name="action"\r\n' }), 422);
  const form = new FormData();
  form.set('session_id', id);
  form.append('action', 'initial');
  form.append('action', 'more_hint');
  error(await api.request('/hint', { method: 'POST', body: form }), 422);
  assert.equal(api.gateway.requests.length, 0);
});

test('question length is bounded and corrupt images are rejected before Gemini', async t => {
  const api = await start(t);
  const id = await api.session();
  error(await api.hint(id, 'initial', WHITE, 'x'.repeat(2001)), 422);
  error(await api.hint(id, 'initial', Buffer.from('not an image')), 422);
  assert.equal(api.gateway.requests.length, 0);
});

for (const [format, mime] of [['png', 'image/png'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']]) {
  test(`actual ${format} image data is accepted`, async t => {
    const api = await start(t);
    const data = await sharp(WHITE)[format]().toBuffer();
    const form = new FormData();
    form.set('session_id', await api.session());
    form.set('action', 'initial');
    form.set('screenshot', new Blob([data], { type: mime }), 'work');
    const response = await api.request('/hint', { method: 'POST', body: form });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(api.gateway.requests.at(-1).screenshot.mimeType, mime);
  });
}

test('actual format must match the upload MIME type', async t => {
  const api = await start(t);
  const form = new FormData();
  form.set('session_id', await api.session());
  form.set('action', 'initial');
  form.set('screenshot', new Blob([WHITE], { type: 'image/jpeg' }), 'work.jpg');
  error(await api.request('/hint', { method: 'POST', body: form }), 415);
  assert.equal(api.gateway.requests.length, 0);
});

test('unsupported actual image formats are rejected even when labeled as PNG', async t => {
  const api = await start(t);
  const tiff = await sharp(WHITE).tiff().toBuffer();
  error(await api.hint(await api.session(), 'initial', tiff), 415, 'unsupported_image');
  assert.equal(api.gateway.requests.length, 0);
});

test('byte limits cover both an image and the whole multipart request', async t => {
  const api = await start(t, { maxImageBytes: 128 });
  error(await api.hint(await api.session(), 'initial', Buffer.alloc(129)), 413);
  error(await api.request('/hint', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=boundary' }, body: Buffer.alloc(128 + 65537) }), 413);
  assert.equal(api.gateway.requests.length, 0);
});

test('a valid screenshot exactly at the configured byte limit is accepted', async t => {
  const api = await start(t, { maxImageBytes: WHITE.length });
  const response = await api.hint(await api.session(), 'initial', WHITE);
  assert.equal(response.status, 200, JSON.stringify(response.body));
});

test('decoded pixel limit is enforced', async t => {
  const api = await start(t, { maxImagePixels: 100 });
  error(await api.hint(await api.session(), 'initial', WHITE), 413);
  assert.equal(api.gateway.requests.length, 0);
});

test('allowed frontend origins are configurable', async t => {
  const api = await start(t, { allowedOrigins: ['http://localhost:9999'] });
  const allowed = await api.request('/hint', { method: 'OPTIONS', headers: { Origin: 'http://localhost:9999', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:9999');
  // Send a normal request so the test remains independent of preflight status/body conventions.
  const denied = await api.request('/health', { headers: { Origin: 'http://unconfigured.example' } });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('session history and session count stay bounded', async t => {
  const api = await start(t, { historyLimit: 2, maxSessions: 1 });
  const id = await api.session();
  await api.hint(id, 'initial', WHITE);
  for (let index = 0; index < 5; index++) assert.equal((await api.hint(id, 'more_hint')).status, 200);
  assert.ok(api.app.locals.sessions.sessions.get(id).history.length <= 2);
  assert.ok(api.gateway.requests.every(request => request.history.length <= 2));
  error(await api.json('/session', { goal: 'Another problem' }), 503, 'session_capacity');
  await api.request(`/session/${id}`, { method: 'DELETE' });
  assert.notEqual(await api.session(), id);
});

test('overlapping same-session requests fail predictably and release the lease', async t => {
  let release;
  let markStarted;
  const blocked = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const gateway = new FakeGateway();
  const generate = gateway.generate.bind(gateway);
  gateway.generate = async request => {
    markStarted();
    await blocked;
    return generate(request);
  };
  const api = await start(t, {}, gateway);
  const id = await api.session();
  const pending = api.hint(id, 'initial', WHITE);
  try {
    await Promise.race([started, new Promise((_, reject) => setTimeout(() => reject(new Error('Initial request never reached Gemini boundary')), 3000).unref())]);
    error(await api.hint(id, 'more_hint'), 409, 'session_busy');
    error(await api.json(`/session/${id}/reset`), 409, 'session_busy');
    error(await api.request(`/session/${id}`, { method: 'DELETE' }), 409, 'session_busy');
  } finally {
    release();
  }
  assert.equal((await pending).status, 200);
  assert.equal((await api.hint(id, 'more_hint')).status, 200);
});

test('disconnecting a client does not bypass the limit on unfinished Gemini work', async t => {
  let release;
  let markStarted;
  let markFinished;
  const blocked = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { markStarted = resolve; });
  const finished = new Promise(resolve => { markFinished = resolve; });
  const gateway = new FakeGateway();
  const generate = gateway.generate.bind(gateway);
  gateway.generate = async request => {
    markStarted();
    await blocked;
    const result = await generate(request);
    markFinished();
    return result;
  };
  const api = await start(t, { maxInflightRequests: 1 }, gateway);
  const id = await api.session();
  const controller = new AbortController();
  const serverClosed = new Promise(resolve => {
    api.server.once('request', (_request, response) => response.once('close', resolve));
  });
  const form = new FormData();
  form.set('session_id', id);
  form.set('action', 'initial');
  form.set('screenshot', new Blob([WHITE], { type: 'image/png' }), 'work.png');
  const pending = api.request('/hint', { method: 'POST', body: form, signal: controller.signal }).catch(failure => failure);
  try {
    await Promise.race([started, new Promise((_, reject) => setTimeout(() => reject(new Error('Initial request never reached Gemini boundary')), 3000).unref())]);
    controller.abort();
    assert.equal((await pending).name, 'AbortError');
    await serverClosed;
    error(await api.request('/health'), 503, 'server_busy');
  } finally {
    release();
  }
  await finished;
  // Let the route's finally block release its slot after the fake boundary settles.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await api.request('/health')).status, 200);
});
