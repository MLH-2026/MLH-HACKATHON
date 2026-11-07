import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { loadTutoringInstructions } from './prompt-loader.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

try {
  const config = loadConfig();
  const buildTutoringInstructions = await loadTutoringInstructions(config.tutoringPromptModule);
  const app = createApp({ config, buildTutoringInstructions });
  const server = app.listen(config.port, config.host, () => {
    console.log(`Sidekick backend listening on http://${config.host}:${config.port}`);
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on('error', async () => {
    console.error('Backend could not start. Check HOST, PORT, and whether the port is already in use.');
    await app.locals.close();
    process.exitCode = 1;
  });
  const shutdown = () => {
    server.close(async () => {
      await app.locals.close();
      process.exitCode = 0;
    });
    server.closeIdleConnections();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch {
  // Config/module errors are intentionally sanitized to keep credentials out of logs.
  console.error('Backend configuration failed. Check backend/.env and the optional tutoring prompt module.');
  process.exitCode = 1;
}
