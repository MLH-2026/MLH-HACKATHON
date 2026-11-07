import { useEffect, useRef, useState } from 'react';
import { ApiError, createSession, deleteSession, requestHint, resetSession } from './api';
import type { HintResponse } from './api';
import { Reveal } from './Reveal';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const examples = [
  'Fix my Python IndexError',
  'Understand why my loop never ends',
  'Figure out why my React state won’t update',
];

export function Session() {
  const [goal, setGoal] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [hint, setHint] = useState<HintResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [sources, setSources] = useState<Array<{ id: string; name: string; image: string }>>([]);
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

  function acceptFile(file: File | null) {
    setSources([]);
    if (file && !ACCEPTED.includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP image.');
      clearScreenshot();
    } else {
      setError('');
      setScreenshot(file);
    }
  }

  // Let people paste a screenshot straight from the clipboard once a session is running.
  useEffect(() => {
    if (!sessionId) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find(item => item.type.startsWith('image/'));
      if (file) acceptFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [sessionId]);

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

  const stage = !sessionId ? 1 : hint ? 3 : 2;
  const stages = ['Set your goal', 'Share your screen', 'Get a nudge'];

  return (
    <section className="playground wrap" id="session" aria-labelledby="session-title">
      <Reveal>
        <div className="eyebrow"><span className="signal" /> YOUR NEXT STEP</div>
        <h2 id="session-title">Let’s get you unstuck.</h2>
        <p className="section-copy">Tell us your goal and share a screenshot of your work. Each request sends your chosen image to the backend for Gemini guidance.</p>
        <ol className="stepper" aria-label="Progress">
          {stages.map((label, index) => (
            <li key={label} className={index + 1 < stage ? 'is-done' : index + 1 === stage ? 'is-current' : ''} aria-current={index + 1 === stage ? 'step' : undefined}>
              <span>{index + 1 < stage ? '✓' : index + 1}</span>{label}
            </li>
          ))}
        </ol>
      </Reveal>
      <Reveal className="demo-grid" delay={80}>
        <form className="editor session-form" aria-busy={busy} onSubmit={event => {
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
            {!sessionId && (
              <div className="chips" aria-label="Example goals">
                {examples.map(example => (
                  <button type="button" key={example} className="chip" onClick={() => setGoal(example)}>{example}</button>
                ))}
              </div>
            )}
            {sessionId && <>
              <label htmlFor="question">{hint?.needs_more_context ? 'Add the missing context' : 'Question or extra context (optional)'}</label>
              <textarea id="question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="What have you tried so far?" />
              <span className="field-label">Screenshot of your current work</span>
              {window.whatNowDesktop && <>
                <button className="button secondary" type="button" onClick={() => void run(async () => {
                  clearScreenshot();
                  setSources([]);
                  const captures = await window.whatNowDesktop!.captureSources();
                  if (!captures.length) throw new Error('No screens or windows available. Check Screen Recording permissions and restart the app.');
                  setSources(captures);
                })}>📸 Capture a screen or window</button>
                <p className="upload-note">Capture previews stay on this device. Select one, review it, then submit to share it with Gemini.</p>
              </>}
              {sources.length > 0 && <div className="capture-picker" aria-label="Choose a captured screen or window">
                {sources.map(source => <button type="button" key={source.id} onClick={() => void run(async () => {
                  const bytes = Uint8Array.from(atob(source.image.split(',')[1]), char => char.charCodeAt(0));
                  setScreenshot(new File([bytes], 'capture.png', { type: 'image/png' }));
                  if (fileInput.current) fileInput.current.value = '';
                  setSources([]);
                })}><img src={source.image} alt="" /><span>{source.name}</span></button>)}
                <button type="button" onClick={() => setSources([])}>Cancel capture</button>
              </div>}
              <label
                htmlFor="screenshot"
                className={`dropzone ${dragging ? 'is-dragging' : ''} ${preview ? 'has-file' : ''}`}
                onDragOver={event => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={event => {
                  event.preventDefault();
                  setDragging(false);
                  acceptFile(event.dataTransfer.files?.[0] ?? null);
                }}
              >
                {preview
                  ? <img className="screenshot-preview" src={preview} alt="Screenshot selected for your next hint request" />
                  : <>
                      <span className="drop-icon" aria-hidden="true">⇪</span>
                      <strong>Drop a screenshot here</strong>
                      <span>or click to browse · you can also paste with Ctrl/⌘ + V</span>
                    </>}
              </label>
              <input ref={fileInput} id="screenshot" className="file-hidden" type="file" accept={ACCEPTED.join(',')} onChange={event => acceptFile(event.target.files?.[0] ?? null)} />
              {screenshot && <button className="button secondary" type="button" onClick={clearScreenshot}>Discard screenshot</button>}
              <p className="upload-note">Choose a fresh screenshot for each check. More hints use the previous capture.</p>
            </>}
            <button className="button primary" type="submit" disabled={!!sessionId && !screenshot}>
              {busy ? 'Working…' : !sessionId ? 'Start session' : hint ? 'Check again' : 'I’m stuck'}
            </button>
            {sessionId && <button className="button secondary" type="button" onClick={() => void run(async signal => {
              await resetSession(sessionId, { signal });
              setQuestion('');
              setHint(null);
              setSources([]);
              clearScreenshot();
              // Keep the ID until deletion succeeds so a failed cleanup can be retried.
              await deleteSession(sessionId, { signal });
              setSessionId(null);
              setGoal('');
            })}>Start a new problem</button>}
          </fieldset>
        </form>
        <div className="coach" aria-busy={busy}>
          <div className="panel-bar"><span>✦ &nbsp; WhatNow</span><span>{hint ? `HINT ${hint.hint_level} / 3` : 'YOUR SESSION'}</span></div>
          <div className="meter" aria-hidden="true">
            {[1, 2, 3].map(level => <i key={level} className={hint && hint.hint_level >= level ? 'is-on' : ''} />)}
          </div>
          <div className={`response ${busy ? 'is-thinking' : ''}`} role="status" key={hint ? `${hint.hint_level}-${hint.message}` : String(!!sessionId)}>
            {busy ? <>
              <h3>Thinking<span className="dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></h3>
              <p>Looking at your work and picking the gentlest useful nudge.</p>
            </> : hint ? <>
              <h3>{hint.message}</h3>
              <p>{hint.observation}</p>
              {hint.needs_more_context && <p className="context-question">{hint.context_question}</p>}
            </> : <><h3>{sessionId ? 'Ready when you are.' : 'Start with your goal.'}</h3><p>{sessionId ? 'Choose a screenshot, add any context, and ask for a hint.' : 'We’ll use your goal to keep the guidance focused.'}</p></>}
          </div>
          {hint && <button className="button primary" type="button" disabled={busy || (hint.hint_level === 3 && !hint.needs_more_context)} onClick={() => getHint('more_hint')}>
            {hint.needs_more_context ? 'Send context' : hint.hint_level === 3 ? 'All hints revealed' : 'More hint'}
          </button>}
        </div>
      </Reveal>
      {error && <p className="session-error" role="alert">{error}</p>}
    </section>
  );
}
