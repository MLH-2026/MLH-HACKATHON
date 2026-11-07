type HintRequest =
  | { sessionId: string; action: 'initial' | 'check_again'; question?: string; screenshot: File }
  | { sessionId: string; action: 'more_hint'; question?: string };

export interface HintResponse {
  hint_level: 1 | 2 | 3;
  observation: string;
  message: string;
  needs_more_context: boolean;
  context_question: string | null;
}

export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

type RequestOptions = { signal?: AbortSignal };

// Development requests use Vite's local backend proxy.
const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');

async function request(path: string, options: RequestInit): Promise<unknown> {
  const response = await fetch(baseUrl + path, options);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError('The server returned an unreadable response.', 'invalid_response', response.status);
  }
  if (!response.ok) {
    const error = isRecord(body) && isRecord(body.error) ? body.error : null;
    throw new ApiError(
      typeof error?.message === 'string' ? error.message : `Request failed (${response.status}). Please try again.`,
      typeof error?.code === 'string' ? error.code : 'request_failed',
      response.status,
    );
  }
  return body;
}

export async function createSession(goal: string, options: RequestOptions = {}): Promise<{ session_id: string }> {
  if (!goal.trim()) throw new Error('Enter a goal before starting a session.');
  const body = await request('/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal: goal.trim() }),
    signal: options.signal,
  });
  if (!isRecord(body) || typeof body.session_id !== 'string' || !body.session_id.trim()) {
    throw new ApiError('The server did not return a session ID.', 'invalid_response', 200);
  }
  return { session_id: body.session_id };
}

export async function requestHint(input: HintRequest, options: RequestOptions = {}): Promise<HintResponse> {
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
  const result = await request('/hint', { method: 'POST', body, signal: options.signal });
  if (!isRecord(result) ||
      ![1, 2, 3].includes(result.hint_level as number) ||
      typeof result.observation !== 'string' ||
      typeof result.message !== 'string' ||
      typeof result.needs_more_context !== 'boolean' ||
      !(result.context_question === null || typeof result.context_question === 'string') ||
      (result.needs_more_context && !result.context_question)) {
    throw new ApiError('The server returned an incomplete hint. Please try again.', 'invalid_response', 200);
  }
  return result as unknown as HintResponse;
}

export function resetSession(sessionId: string, options: RequestOptions & { goal?: string } = {}): Promise<unknown> {
  if (!sessionId.trim()) throw new Error('Start a session before resetting it.');
  return request(`/session/${encodeURIComponent(sessionId)}/reset`, {
    method: 'POST',
    headers: options.goal ? { 'Content-Type': 'application/json' } : undefined,
    body: options.goal ? JSON.stringify({ goal: options.goal }) : undefined,
    signal: options.signal,
  });
}

export function deleteSession(sessionId: string, options: RequestOptions = {}): Promise<unknown> {
  if (!sessionId.trim()) throw new Error('Start a session before deleting it.');
  return request(`/session/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    signal: options.signal,
  });
}
