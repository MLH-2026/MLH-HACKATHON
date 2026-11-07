import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backendDir = fileURLToPath(new URL('../', import.meta.url));

export async function loadTutoringInstructions(modulePath) {
  if (!modulePath) return undefined;
  // This is trusted repository code configured at startup, never uploaded task data.
  const module = await import(pathToFileURL(resolve(backendDir, modulePath)).href);
  if (typeof module.buildTutoringInstructions !== 'function') {
    throw new Error('TUTORING_PROMPT_MODULE must export buildTutoringInstructions({action, hintLevel}).');
  }
  return module.buildTutoringInstructions;
}
