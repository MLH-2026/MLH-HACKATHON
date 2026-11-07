function number(env, key, fallback, min, max, integer = true) {
  const value = env[key] === undefined || env[key] === '' ? fallback : Number(env[key]);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`Invalid backend configuration: ${key}`);
  }
  return value;
}

export function loadConfig(overrides = {}, env = process.env) {
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map(value => value.trim()).filter(Boolean);
  for (const origin of allowedOrigins) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error('Invalid ALLOWED_ORIGINS'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error('ALLOWED_ORIGINS must contain explicit HTTP(S) origins');
    }
  }
  const rawKey = env.GEMINI_API_KEY?.trim();
  return {
    host: env.HOST || '127.0.0.1',
    port: number(env, 'PORT', 8000, 1, 65535),
    apiKey: rawKey && rawKey !== 'replace_with_your_gemini_api_key' ? rawKey : null,
    model: env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
    timeoutMs: number(env, 'GEMINI_TIMEOUT_SECONDS', 30, 0.001, 120, false) * 1000,
    allowedOrigins,
    sessionTtlMs: number(env, 'SESSION_TTL_SECONDS', 1800, 0.001, 86400, false) * 1000,
    cleanupIntervalMs: number(env, 'CLEANUP_INTERVAL_SECONDS', 30, 0.001, 300, false) * 1000,
    maxSessions: number(env, 'MAX_SESSIONS', 32, 1, 128),
    historyLimit: number(env, 'HISTORY_LIMIT', 8, 1, 20),
    maxImageBytes: number(env, 'MAX_IMAGE_BYTES', 5242880, 1, 5242880),
    maxImagePixels: number(env, 'MAX_IMAGE_PIXELS', 16000000, 1, 32000000),
    maxInflightRequests: number(env, 'MAX_INFLIGHT_REQUESTS', 8, 1, 32),
    tutoringPromptModule: env.TUTORING_PROMPT_MODULE?.trim() || null,
    ...overrides,
  };
}
