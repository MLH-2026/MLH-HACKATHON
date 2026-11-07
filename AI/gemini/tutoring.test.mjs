import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTutoringInstructions } from '../../backend/src/prompt-loader.js';
import { validateGuidance } from '../../backend/src/guidance.js';
import { buildTutoringInstructions } from './tutoring.mjs';

test('backend loads the prompt synchronously for all action/level combinations', async () => {
  const build = await loadTutoringInstructions('../AI/gemini/tutoring.mjs');
  for (const action of ['initial', 'more_hint', 'check_again']) {
    for (const hintLevel of [1, 2, 3]) {
      const prompt = build({ action, hintLevel });
      assert.equal(typeof prompt, 'string');
      assert.ok(prompt.length > 0 && prompt.length <= 20_000);
      assert.ok(prompt.includes(`CURRENT ACTION: ${action}`));
      assert.ok(prompt.includes(`HINT LEVEL: ${hintLevel}`));
      const example = JSON.parse(prompt.match(/\{\n  "observation"[\s\S]*?\n\}/u)[0]);
      assert.deepEqual(validateGuidance(example), example);
    }
  }
});

test('invalid backend inputs fail explicitly', () => {
  for (const action of ['solve', '__proto__', undefined]) {
    assert.throws(() => buildTutoringInstructions({ action, hintLevel: 1 }), TypeError);
  }
  for (const hintLevel of [0, 4, 1.5, '2', undefined]) {
    assert.throws(() => buildTutoringInstructions({ action: 'initial', hintLevel }), RangeError);
  }
});
