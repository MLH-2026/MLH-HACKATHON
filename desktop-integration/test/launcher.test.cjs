const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('floating controls work without page globals in the isolated preload world', async () => {
  const elements = Object.fromEntries(['#edit', '#open', '#pause', '#quit', '#state'].map(id => [id, {}]));
  const calls = [];
  let ready;
  let paused = false;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../launcher.cjs'), 'utf8'), {
    require: name => {
      assert.equal(name, 'electron');
      return {
        contextBridge: { exposeInMainWorld() {} },
        ipcRenderer: { invoke: async channel => {
          calls.push(channel);
          if (channel === 'pause-capture') return paused = !paused;
        } },
      };
    },
    window: { addEventListener: (event, callback) => { assert.equal(event, 'DOMContentLoaded'); ready = callback; } },
    document: { querySelector: selector => elements[selector] },
  });
  ready();
  await elements['#open'].onclick();
  await elements['#pause'].onclick({ target: elements['#pause'] });
  assert.equal(elements['#pause'].textContent, 'Resume');
  assert.equal(elements['#state'].textContent, 'Capture paused');
  await elements['#pause'].onclick({ target: elements['#pause'] });
  assert.equal(elements['#pause'].textContent, 'Pause');
  assert.equal(elements['#state'].textContent, 'Click to capture & get help');
  await elements['#quit'].onclick();
  assert.deepEqual(calls, ['open-help', 'pause-capture', 'pause-capture', 'quit-desktop']);
});
