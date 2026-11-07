import { useEffect, useRef, useState } from 'react';
import { ApiError, createSession, deleteSession, requestHint, resetSession } from './api';
import type { HintResponse } from './api';
import { readContext } from './readContext';

type Context = { overview: string; goal: string };
type HintAction = 'initial' | 'check_again' | 'more_hint';

const blank: Context = { overview: '', goal: '' };
const levels = ['A small nudge', 'Suggested fix', 'Full explanation'];
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_CONTEXT = 12000;
const examples = [
  ['A Python app for tracking habits', 'My list isn’t updating when I add a habit'],
  ['A 5-page essay on climate policy', 'My thesis feels weak and I’m not sure why'],
  ['A calculus problem set', 'I’m stuck on setting up this related-rates problem'],
];

function dataUrlToFile(image: string): File {
  const bytes = Uint8Array.from(atob(image.split(',')[1]), char => char.charCodeAt(0));
  return new File([bytes], 'capture.jpg', { type: image.startsWith('data:image/png') ? 'image/png' : 'image/jpeg' });
}

export function Session() {
  const desktop = window.whatNowDesktop;
  const [drafts, setDrafts] = useState<Context[]>([blank]);
  const [draftIndex, setDraftIndex] = useState(0);
  const draft = drafts[draftIndex];
  const [step, setStep] = useState<'context' | 'help'>('context');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedGoal, setSavedGoal] = useState('');
  const [savedContext, setSavedContext] = useState<Context>(blank);
  const [notes, setNotes] = useState('');
  const [fileText, setFileText] = useState('');
  const [fileName, setFileName] = useState('');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<HintResponse[]>([]);
  const [viewIndex, setViewIndex] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [dragging, setDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const contextInput = useRef<HTMLInputElement>(null);

  const latest = history.at(-1);
  const viewed = history[viewIndex];
  const cycleStart = Math.max(0, history.map(hint => hint.hint_level).lastIndexOf(1));
  const material = [notes.trim(), fileText.trim()].filter(Boolean).join('\n\n').slice(0, MAX_CONTEXT);
  const combinedGoal = `Project overview: ${draft.overview.trim()}\nCurrent task: ${draft.goal.trim()}`;
  const changed = !!sessionId && combinedGoal !== savedGoal;

  // The nudge handler is registered once, so it reads the newest values through this ref.
  const live = useRef({ sessionId, material, question, hasHistory: false, length: 0, getHint: (_a: HintAction, _f?: File) => {} });
  live.current = { ...live.current, sessionId, material, question, hasHistory: history.length > 0, length: history.length };

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Tell the floating control whether "Nudge me" can capture straight away.
  useEffect(() => {
    void desktop?.setReady(step === 'help' && !!sessionId);
    return () => { void desktop?.setReady(false); };
  }, [step, sessionId]);

  useEffect(() => {
    if (!desktop) return;
    const stopNudge = desktop.onNudge(result => {
      if (result.error || !result.image) {
        setError(result.error ?? 'Could not capture this screen.');
        return;
      }
      const frame = dataUrlToFile(result.image);
      setFile(frame);
      if (!live.current.sessionId || pending.current) {
        if (!live.current.sessionId) setError('Add your context first, then press Start working.');
        void desktop.setBusy(false);
        return;
      }
      live.current.getHint(live.current.hasHistory ? 'check_again' : 'initial', frame);
    });
    const stopPaused = desktop.onPaused(setPaused);
    return () => { stopNudge(); stopPaused(); };
  }, []);

  function edit(next: Context) {
    const updated = [...drafts.slice(0, draftIndex + 1), next].slice(-100);
    setDrafts(updated);
    setDraftIndex(updated.length - 1);
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
        setStep('context');
        setHistory([]);
      }
      setError(failure instanceof TypeError
        ? 'Could not reach the backend. Start it and try again.'
        : failure instanceof Error ? failure.message : 'Something went wrong. Please try again.');
    } finally {
      pending.current = false;
      void desktop?.setBusy(false);
      if (!request.signal.aborted) setBusy(false);
    }
  }

  function getHint(action: HintAction, screenshot?: File) {
    const { sessionId: id, material: context, question: note, hasHistory, length } = live.current;
    if (!id) return;
    void run(async signal => {
      let result: HintResponse;
      if (action === 'more_hint') {
        result = await requestHint({ sessionId: id, action, question: note, context }, { signal });
      } else {
        const image = screenshot ?? file;
        if (!image) throw new Error('Select an image of your current work.');
        // A fresh check starts the ladder again at level one but keeps earlier replies.
        result = await requestHint({ sessionId: id, action, question: note, context, screenshot: image, restartLadder: action === 'check_again' && hasHistory }, { signal });
      }
      setHistory(previous => [...previous, result]);
      setViewIndex(length);
      setQuestion('');
    });
  }
  live.current.getHint = getHint;

  function acceptImage(next: File | null) {
    if (next && !ACCEPTED.includes(next.type)) {
      setError('Choose a PNG, JPEG, or WebP image.');
      return;
    }
    setError('');
    setFile(next);
  }

  function captureNow() {
    setError('');
    void desktop?.captureNow();
  }

  function openLevel(level: number) {
    const inCycle = history.slice(cycleStart).findIndex(hint => hint.hint_level === level);
    if (inCycle >= 0) setViewIndex(cycleStart + inCycle);
    else if (level === 1) desktop ? captureNow() : getHint(latest ? 'check_again' : 'initial');
    else getHint('more_hint');
  }

  const canCapture = desktop ? !paused : !!file;
  const stepNumber = step === 'context' ? 1 : 2;

  return (
    <section className={`workspace ${desktop ? 'desktop-workspace' : 'wrap'}`} id="session" aria-labelledby="session-title">
      <header className="workspace-heading">
        <div>
          <div className="eyebrow"><span className="signal" /> WHATNOW / YOUR WORKSPACE</div>
          <h2 id="session-title">A little help. Your next move.</h2>
        </div>
        <button className="button secondary" disabled={busy} onClick={() => setConfirmReset(true)}>New problem</button>
      </header>
      <div className="workspace-grid">
        <aside className="work-preview">
          <div className="panel-bar"><span>Your work</span><span>{desktop ? (paused ? 'CAPTURE PAUSED' : 'ON DEMAND ONLY') : 'IMAGE UPLOAD'}</span></div>
          {desktop ? <>
            <div className="preview-stage">
              {preview
                ? <img src={preview} alt="Your most recent capture" />
                : <div className="preview-empty"><span aria-hidden="true">▣</span><h3>Nothing captured yet.</h3><p>Press <strong>Nudge me</strong> on the floating control, or capture from here. Your screen is only captured when you ask.</p></div>}
            </div>
            <div className="preview-controls">
              <button className="button secondary" disabled={busy || paused || step !== 'help' || !sessionId} onClick={captureNow}>📸 {latest ? 'Check my latest work' : 'Capture my screen'}</button>
              <button className="text-button" disabled={busy} onClick={() => void desktop.minimize()}>Shrink to corner</button>
            </div>
            {paused && <p className="preview-note">Capture is paused from the floating control. Resume there to continue.</p>}
            <p className="preview-note">Captures stay in memory and are never saved to disk. A frame is only sent to Gemini when you ask for help.</p>
          </> : <div className="session-form">
            <h3>Work alongside your desktop.</h3>
            <p className="preview-note">Run <code>npm run desktop</code> for one-click nudges. In the browser you can share an image instead.</p>
            <label
              htmlFor="work-image"
              className={`dropzone ${dragging ? 'is-dragging' : ''} ${preview ? 'has-file' : ''}`}
              onDragOver={event => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={event => { event.preventDefault(); setDragging(false); acceptImage(event.dataTransfer.files?.[0] ?? null); }}
            >
              {preview
                ? <img className="screenshot-preview" src={preview} alt="Image selected for your next request" />
                : <><span className="drop-icon" aria-hidden="true">⇪</span><strong>Drop an image of your work</strong><span>or click to browse · PNG, JPEG, or WebP</span></>}
            </label>
            <input ref={fileInput} id="work-image" className="file-hidden" type="file" accept={ACCEPTED.join(',')} onChange={event => acceptImage(event.target.files?.[0] ?? null)} />
            {file && <button className="text-button" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ''; }}>Remove image</button>}
          </div>}
        </aside>
        <div className="help-workflow" aria-busy={busy}>
          <nav className="workflow-steps" aria-label="Help workflow">
            <button aria-current={step === 'context' ? 'step' : undefined} disabled={busy} onClick={() => setStep('context')}>01 Context</button>
            <span aria-hidden="true">→</span>
            <button aria-current={step === 'help' ? 'step' : undefined} disabled={busy || !sessionId} onClick={() => setStep('help')}>02 Get help</button>
            <span className="step-count">Step {stepNumber} of 2</span>
          </nav>
          {step === 'context' ? <form className="context-form" onSubmit={event => {
            event.preventDefault();
            if (!draft.overview.trim() || !draft.goal.trim()) { setError('Add a brief project overview and your current task.'); return; }
            const starting = !sessionId;
            void run(async signal => {
              if (!sessionId) {
                const session = await createSession(combinedGoal, { signal });
                setSessionId(session.session_id);
              } else if (changed) {
                await resetSession(sessionId, { signal, goal: combinedGoal });
                setHistory([]);
                setViewIndex(0);
                setQuestion('');
              }
              setSavedGoal(combinedGoal);
              setSavedContext({ ...draft });
              setStep('help');
              if (starting) void desktop?.minimize();
            });
          }}>
            <h3>What exactly do you need help with?</h3>
            <p>Give WhatNow a little context before your first hint.</p>
            {!sessionId && <div className="chips" aria-label="Examples">
              {examples.map(([overview, goal]) => (
                <button type="button" key={goal} className="chip" onClick={() => edit({ overview, goal })}>{goal}</button>
              ))}
            </div>}
            <fieldset disabled={busy}>
              <label htmlFor="overview">Brief project overview</label>
              <textarea id="overview" required maxLength={900} value={draft.overview} onChange={event => edit({ ...draft, overview: event.target.value })} placeholder="A React app for tracking my daily habits…" />
              <label htmlFor="task-goal">What are you trying to work on?</label>
              <textarea id="task-goal" required maxLength={900} value={draft.goal} onChange={event => edit({ ...draft, goal: event.target.value })} placeholder="I’m trying to save a new habit, but the list isn’t updating." />
              <div className="context-tools">
                <button type="button" className="text-button" disabled={draftIndex === 0} onClick={() => setDraftIndex(draftIndex - 1)}>↶ Undo edit</button>
                <button type="button" className="text-button" disabled={draftIndex === drafts.length - 1} onClick={() => setDraftIndex(draftIndex + 1)}>↷ Redo edit</button>
              </div>
              <details className="supporting" open={!!material}>
                <summary>Optional: add assignment instructions, notes, or a file</summary>
                <label htmlFor="notes">Notes or instructions</label>
                <textarea id="notes" maxLength={MAX_CONTEXT} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Paste the assignment brief, rubric, or anything WhatNow should know…" />
                <input ref={contextInput} className="file-hidden" id="context-file" type="file" accept=".pdf,.pptx,.docx,.txt,.md,.csv,.json,.py,.js,.jsx,.ts,.tsx,.java,.c,.cpp,.h,.html,.css,.r,.sql" onChange={async event => {
                  const chosen = event.target.files?.[0];
                  event.target.value = '';
                  if (!chosen) return;
                  setError('');
                  try {
                    setFileText(await readContext(chosen));
                    setFileName(chosen.name);
                  } catch (failure) {
                    setError(failure instanceof Error ? failure.message : 'Could not read this file.');
                  }
                }} />
                <div className="file-row">
                  <label htmlFor="context-file" className="button secondary file-button">📎 Add PDF, PPTX, DOCX, text or code</label>
                  {fileName && <span className="file-chip">{fileName}<button type="button" aria-label="Remove file" onClick={() => { setFileText(''); setFileName(''); }}>×</button></span>}
                </div>
                <p className="preview-note">Text is extracted on this device. Up to {MAX_CONTEXT.toLocaleString()} characters go with your next request{material ? ` (${material.length.toLocaleString()} ready)` : ''}.</p>
              </details>
              {changed && <p className="preview-note">Applying this context clears the current hint history. Cancel returns to your saved context.</p>}
              <button className="button primary" type="submit">{busy ? 'Saving…' : changed ? 'Apply context & restart hints' : sessionId ? 'Continue to help →' : desktop ? 'Start working →' : 'Continue to help →'}</button>
              {sessionId && <button className="button secondary" type="button" onClick={() => { setDrafts([savedContext]); setDraftIndex(0); setStep('help'); setError(''); }}>Cancel edits</button>}
            </fieldset>
          </form> : <div className="guidance-panel">
            <button className="text-button" disabled={busy} onClick={() => setStep('context')}>← Back to context</button>
            <h3>How much help do you need?</h3>
            <div className="meter" aria-hidden="true">
              {[1, 2, 3].map(level => <i key={level} className={viewed && viewed.hint_level >= level ? 'is-on' : ''} />)}
            </div>
            <div className="help-levels" aria-label="Help levels">{levels.map((label, index) => {
              const level = index + 1;
              const existing = history.slice(cycleStart).some(hint => hint.hint_level === level);
              const unlocked = level <= (latest?.hint_level ?? 0) + 1;
              return <button key={label} className={viewed?.hint_level === level ? 'selected' : ''} disabled={busy || !unlocked || (!existing && level === 1 && !canCapture)} onClick={() => openLevel(level)}><span>0{level}</span>{label}{!unlocked && <small>Unlock the previous level</small>}</button>;
            })}</div>
            <div className={`guidance-copy ${busy ? 'is-thinking' : ''}`} role="status" key={busy ? 'busy' : viewed ? `${viewIndex}-${viewed.message}` : 'empty'}>
              {busy ? <><h4>Thinking<span className="dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></h4><p>Looking at your work and picking the gentlest useful nudge.</p></>
                : viewed ? <><span className="eyebrow">{levels[viewed.hint_level - 1]}</span><div className="hint-message">{viewed.message}</div><details><summary>What WhatNow observed</summary><p>{viewed.observation}</p></details>{viewed.needs_more_context && <p className="context-question">{viewed.context_question}</p>}</>
                : <><h4>Start with a small nudge.</h4><p>{desktop ? 'Press Nudge me on the floating control, or capture from here.' : 'Add an image of your work, then ask for level 1.'} Reveal more guidance whenever you’re ready.</p></>}
            </div>
            {history.length > 0 && <div className="history-controls">
              <button className="text-button" disabled={busy || viewIndex === 0} onClick={() => setViewIndex(viewIndex - 1)}>← Previous</button>
              <span>{viewIndex + 1} of {history.length}</span>
              <button className="text-button" disabled={busy || viewIndex === history.length - 1} onClick={() => setViewIndex(viewIndex + 1)}>Next →</button>
            </div>}
            <label htmlFor="follow-up">Question or extra context</label>
            <textarea id="follow-up" disabled={busy} maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Tell WhatNow what you tried, or answer its question…" />
            <div className="help-actions">
              <button className="button primary" disabled={busy || !canCapture} onClick={() => desktop ? captureNow() : getHint(latest ? 'check_again' : 'initial')}>{busy ? 'Thinking…' : latest ? 'Check my latest work' : 'Get a small nudge'}</button>
              {latest?.needs_more_context && <button className="button secondary" disabled={busy || !question.trim()} onClick={() => getHint('more_hint')}>Send context</button>}
              {desktop && <button className="text-button" disabled={busy} onClick={() => void desktop.minimize()}>Back to my work</button>}
            </div>
            {viewIndex < history.length - 1 && <p className="preview-note">You’re viewing an earlier reply. New requests continue from the latest attempt.</p>}
          </div>}
          {error && <p className="session-error" role="alert">{error}</p>}
          {confirmReset && <div className="reset-confirmation" role="dialog" aria-modal="false" aria-label="Start a new problem">
            <h3>Start fresh?</h3><p>This clears your current context and saved hints. You can cancel and keep working.</p>
            <button className="button secondary" disabled={busy} onClick={() => setConfirmReset(false)}>Keep working</button>
            <button className="button primary" disabled={busy} onClick={() => void run(async signal => {
              if (sessionId) await deleteSession(sessionId, { signal });
              setSessionId(null); setSavedGoal(''); setHistory([]); setViewIndex(0);
              setDrafts([blank]); setDraftIndex(0); setQuestion(''); setStep('context');
              setNotes(''); setFileText(''); setFileName('');
              setConfirmReset(false); setFile(null);
              if (fileInput.current) fileInput.current.value = '';
            })}>Start new problem</button>
          </div>}
        </div>
      </div>
    </section>
  );
}
