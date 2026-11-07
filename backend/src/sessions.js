import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.js';

export class SessionStore {
  constructor(config) {
    this.config = config;
    this.sessions = new Map();
    this.now = Date.now;
  }

  clearProblem(session) {
    session.hintLevel = 0;
    session.screenshot = null;
    session.problemQuestion = null;
    session.observation = '';
    session.history.length = 0;
  }

  expire() {
    const now = this.now();
    for (const [id, session] of this.sessions) {
      if (!session.busy && session.expiresAt <= now) {
        this.clearProblem(session);
        this.sessions.delete(id);
      }
    }
  }

  touch(session) { session.expiresAt = this.now() + this.config.sessionTtlMs; }

  create(goal) {
    this.expire();
    if (this.sessions.size >= this.config.maxSessions) {
      throw new ApiError(503, 'session_capacity', 'Session limit reached. Delete an unused session and retry.');
    }
    const session = {
      sessionId: randomUUID(), goal, expiresAt: 0, history: [], hintLevel: 0,
      screenshot: null, problemQuestion: null, observation: '', busy: false,
    };
    this.touch(session);
    this.sessions.set(session.sessionId, session);
    return session;
  }

  acquire(id) {
    this.expire();
    const session = this.sessions.get(id);
    if (!session) throw new ApiError(404, 'session_not_found', 'Session is missing or expired. Create a new session.');
    if (session.busy) throw new ApiError(409, 'session_busy', 'Another request is using this session. Wait for it to finish.');
    // Synchronous check-and-set on the Node event loop; no stale request queue.
    session.busy = true;
    return session;
  }

  release(session) { session.busy = false; }

  delete(id) {
    const session = this.acquire(id);
    this.clearProblem(session);
    this.sessions.delete(id);
    this.release(session);
  }

  clear() {
    for (const session of this.sessions.values()) this.clearProblem(session);
    this.sessions.clear();
  }
}
