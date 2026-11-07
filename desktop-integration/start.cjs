const { spawn } = require('node:child_process');
const env = { ...process.env };
// Editors built on Electron can export this; the desktop needs Chromium mode.
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [__dirname], { env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
