import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadConfig } from '../src/config.js';
import { loadTutoringInstructions } from '../src/prompt-loader.js';

test('optional AI teammate module loads from a trusted file and receives action/level', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'sidekick-prompt-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'tutoring.mjs');
  await writeFile(path, 'export function buildTutoringInstructions({ action, hintLevel }) { return `${action}: level ${hintLevel}`; }');
  const instructions = await loadTutoringInstructions(path);
  assert.equal(instructions({ action: 'more_hint', hintLevel: 2 }), 'more_hint: level 2');
  assert.equal(await loadTutoringInstructions(null), undefined);
});

test('AI module with the wrong export is rejected at startup', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'sidekick-prompt-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'wrong.mjs');
  await writeFile(path, 'export const prompt = "unexpected export";');
  await assert.rejects(loadTutoringInstructions(path), /must export buildTutoringInstructions/u);
});

test('config uses backend defaults and rejects invalid limits/origins', () => {
  const config = loadConfig({}, {});
  assert.equal(config.apiKey, null);
  assert.equal(config.port, 8000);
  assert.equal(config.timeoutMs, 30000);
  assert.throws(() => loadConfig({}, { PORT: 'invalid' }));
  assert.throws(() => loadConfig({}, { MAX_SESSIONS: '0' }));
  assert.throws(() => loadConfig({}, { ALLOWED_ORIGINS: '*' }));
  assert.equal(loadConfig({}, { GEMINI_API_KEY: 'replace_with_your_gemini_api_key' }).apiKey, null);
});
