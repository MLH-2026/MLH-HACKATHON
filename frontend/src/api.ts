type HintRequest =
  | { sessionId: string; action: 'initial' | 'check_again'; question?: string; screenshot: File }
  | { sessionId: string; action: 'more_hint'; question?: string };

type RequestOptions = { signal?: AbortSignal };

// Set VITE_API_BASE_URL to the backend origin. Empty uses the frontend origin.
const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

async function request(path: string, options: RequestInit): Promise<unknown> {
  const response = await fetch(baseUrl + path, options);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}). Please try again.`);
  }
  if (response.status === 204) return null;
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

export function createSession(goal: string, options: RequestOptions = {}): Promise<unknown> {
  if (!goal.trim()) throw new Error('Enter a goal before starting a session.');
  return request('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: goal.trim() }),
    signal: options.signal,
  });
}

export function requestHint(input: HintRequest, options: RequestOptions = {}): Promise<unknown> {
  if (!input.sessionId.trim()) throw new Error('Start a session before requesting a hint.');
  const body = new FormData();
  body.append('session_id', input.sessionId);
  body.append('action', input.action);
  if (input.question?.trim()) body.append('question', input.question.trim());
  if (input.action !== 'more_hint') {
    if (!(input.screenshot instanceof File) || input.screenshot.size === 0) {
      throw new Error('Choose a screenshot for this attempt.');
    }
    body.append('screenshot', input.screenshot);
  }
  return request('/hint', { method: 'POST', body, signal: options.signal });
}

export function resetSession(sessionId: string, options: RequestOptions = {}): Promise<unknown> {
  if (!sessionId.trim()) throw new Error('Start a session before resetting it.');
  return request(`/session/${encodeURIComponent(sessionId)}/reset`, {
    method: 'POST',
    signal: options.signal,
  });
}
