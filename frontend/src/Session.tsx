import { useEffect, useRef, useState } from 'react';
import { ApiError, createSession, deleteSession, requestHint, resetSession } from './api';
import type { HintResponse } from './api';

export function Session() {
  const [goal, setGoal] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [hint, setHint] = useState<HintResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!screenshot) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  function clearScreenshot() {
    setScreenshot(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function run(operation: (signal: AbortSignal) => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError('');
    try {
      await operation(request.signal);
    } catch (failure) {
      if (request.signal.aborted) return;
      if (failure instanceof ApiError && failure.code === 'session_not_found') {
        setSessionId(null);
        setHint(null);
      }
      setError(failure instanceof TypeError
        ? 'Could not reach the backend. Check that it is running and try again.'
        : failure instanceof Error ? failure.message : 'Something went wrong. Please try again.');
    } finally {
      pending.current = false;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  function getHint(action: 'initial' | 'check_again' | 'more_hint') {
    if (!sessionId) return;
    void run(async signal => {
      const input = { sessionId, action, question };
      let result: HintResponse;
      if (action === 'more_hint') {
        result = await requestHint({ ...input, action }, { signal });
      } else {
        if (!screenshot) throw new Error('Choose a screenshot of your current work.');
        result = await requestHint({ ...input, action, screenshot }, { signal });
      }
      setHint(result);
      setQuestion('');
      clearScreenshot();
    });
  }

  return (
    <section className="playground wrap" id="session" aria-labelledby="session-title">
      <div className="eyebrow"><span className="signal" /> YOUR NEXT STEP</div>
      <h2 id="session-title">Let’s get you unstuck.</h2>
      <p className="section-copy">Tell us your goal and share a screenshot of your work. Each request sends your chosen image to the backend for Gemini guidance.</p>
      <div className="demo-grid" aria-busy={busy}>
        <form className="editor session-form" onSubmit={event => {
          event.preventDefault();
          if (sessionId) getHint(hint ? 'check_again' : 'initial');
          else void run(async signal => {
            const session = await createSession(goal, { signal });
            setSessionId(session.session_id);
            setHint(null);
          });
        }}>
          <fieldset disabled={busy}>
            <label htmlFor="goal">What are you working toward?</label>
            <textarea id="goal" required value={goal} disabled={!!sessionId} onChange={event => setGoal(event.target.value)} placeholder="Understand and fix my Python indexing error" />
            {sessionId && <>
              <label htmlFor="question">{hint?.needs_more_context ? 'Add the missing context' : 'Question or extra context (optional)'}</label>
              <textarea id="question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="What have you tried so far?" />
              <label htmlFor="screenshot">Screenshot of your current work</label>
              <input ref={fileInput} id="screenshot" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
                const file = event.target.files?.[0] ?? null;
                if (file && !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
                  setError('Choose a PNG, JPEG, or WebP image.');
                  clearScreenshot();
                } else {
                  setError('');
                  setScreenshot(file);
                }
              }} />
              {preview && <img className="screenshot-preview" src={preview} alt="Screenshot selected for your next hint request" />}
              <p className="upload-note">Choose a fresh screenshot for each check. More hints use the previous capture.</p>
            </>}
            <button className="button primary" type="submit" disabled={!!sessionId && !screenshot}>
              {busy ? 'Working…' : !sessionId ? 'Start session' : hint ? 'Check again' : 'I’m stuck'}
            </button>
            {sessionId && <button className="button secondary" type="button" onClick={() => void run(async signal => {
              await resetSession(sessionId, { signal });
              setQuestion('');
              setHint(null);
              clearScreenshot();
              // Keep the ID until deletion succeeds so a failed cleanup can be retried.
              await deleteSession(sessionId, { signal });
              setSessionId(null);
              setGoal('');
            })}>Start a new problem</button>}
          </fieldset>
        </form>
        <div className="coach">
          <div className="panel-bar"><span>✦ &nbsp; WhatNow</span><span>{hint ? `HINT ${hint.hint_level} / 3` : 'YOUR SESSION'}</span></div>
          <div className="response" role="status">
            {hint ? <>
              <h3>{hint.message}</h3>
              <p>{hint.observation}</p>
              {hint.needs_more_context && <p className="context-question">{hint.context_question}</p>}
            </> : <><h3>{sessionId ? 'Ready when you are.' : 'Start with your goal.'}</h3><p>{sessionId ? 'Choose a screenshot, add any context, and ask for a hint.' : 'We’ll use your goal to keep the guidance focused.'}</p></>}
          </div>
          {hint && <button className="button primary" type="button" disabled={busy || (hint.hint_level === 3 && !hint.needs_more_context)} onClick={() => getHint('more_hint')}>
            {hint.needs_more_context ? 'Send context' : hint.hint_level === 3 ? 'All hints revealed' : 'More hint'}
          </button>}
        </div>
      </div>
      {error && <p className="session-error" role="alert">{error}</p>}
    </section>
  );
}
