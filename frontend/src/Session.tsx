import { useEffect, useRef, useState } from 'react';
import { ApiError, createSession, deleteSession, requestHint, resetSession } from './api';
import type { HintResponse } from './api';
import { useLivePreview } from './useLivePreview';

type Context = { overview: string; goal: string };
const blank: Context = { overview: '', goal: '' };
const levels = ['A small nudge', 'More guidance', 'Full answer'];

export function Session() {
  const desktop = !!window.whatNowDesktop;
  const live = useLivePreview();
  const [drafts, setDrafts] = useState<Context[]>([blank]);
  const [draftIndex, setDraftIndex] = useState(0);
  const draft = drafts[draftIndex];
  const [step, setStep] = useState<'context' | 'help'>('context');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedGoal, setSavedGoal] = useState('');
  const [savedContext, setSavedContext] = useState<Context>(blank);
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<HintResponse[]>([]);
  const [viewIndex, setViewIndex] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const latest = history.at(-1);
  const viewed = history[viewIndex];
  const combinedGoal = `Project overview: ${draft.overview.trim()}\nCurrent task: ${draft.goal.trim()}`;
  const changed = !!sessionId && combinedGoal !== savedGoal;

  useEffect(() => () => controller.current?.abort(), []);

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
      if (!request.signal.aborted) setBusy(false);
    }
  }

  function getHint(action: 'initial' | 'check_again' | 'more_hint') {
    if (!sessionId) return;
    void run(async signal => {
      let result: HintResponse;
      if (action === 'more_hint') {
        result = await requestHint({ sessionId, action, question }, { signal });
      } else {
        const screenshot = desktop ? await live.capture() : file;
        if (!screenshot) throw new Error('Select an image of your current work.');
        result = await requestHint({ sessionId, action, question, screenshot }, { signal });
      }
      setHistory(previous => [...previous, result]);
      setViewIndex(history.length);
      setQuestion('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    });
  }

  function openLevel(level: number) {
    const existing = history.map<number>(hint => hint.hint_level).lastIndexOf(level);
    if (existing >= 0) setViewIndex(existing);
    else getHint(level === 1 ? 'initial' : 'more_hint');
  }

  return (
    <section className={`workspace ${desktop ? 'desktop-workspace' : 'wrap'}`} id="session" aria-labelledby="session-title">
      <header className="workspace-heading">
        <div><div className="eyebrow">✦ WHATNOW / YOUR WORKSPACE</div><h2 id="session-title">A little help. Your next move.</h2></div>
        <button className="button secondary" disabled={busy} onClick={() => setConfirmReset(true)}>New problem</button>
      </header>
      <div className="workspace-grid">
        <aside className="work-preview">
          <div className="panel-bar"><span>Your workspace</span><span>{live.active ? '● LIVE PREVIEW' : 'PREVIEW PAUSED'}</span></div>
          {desktop ? <>
            <div className="preview-stage">
              {live.image ? <img src={live.image} alt={`Live view of ${live.source?.name ?? 'your work'}`} /> : <div className="preview-empty"><span aria-hidden="true">▣</span><h3>Bring your work into view.</h3><p>Choose your VS Code window or a screen. The preview refreshes while you work.</p></div>}
            </div>
            <p className="source-name">{live.source?.name ?? 'No window selected'}</p>
            <div className="preview-controls">
              <button className="button secondary" disabled={busy} onClick={() => { live.setPlaying(false); void live.choose(); }}>{live.source ? 'Change window' : 'Choose window'}</button>
              {live.source && <button className="button secondary" disabled={busy || live.systemPaused} onClick={() => live.setPlaying(!live.playing)}>{live.playing ? 'Pause preview' : 'Resume preview'}</button>}
              {live.source && <button className="text-button" disabled={busy} onClick={live.stop}>Disconnect</button>}
            </div>
            {live.systemPaused && <p className="preview-note">Capture is paused from the floating control. Resume there to continue.</p>}
            {live.error && <p className="session-error" role="alert">{live.error}</p>}
            {live.sources.length > 0 && <div className="source-picker" role="region" aria-label="Choose a window">
              <div className="panel-bar"><span>Choose a window or screen</span><button className="text-button" onClick={() => { live.cancel(); live.setPlaying(true); }}>Cancel</button></div>
              <div className="source-options">{live.sources.map(source => <button key={source.id} onClick={() => live.select(source)}><img src={source.image} alt="" /><span>{source.name}</span></button>)}</div>
            </div>}
            <p className="preview-note">This is a live visual mirror. Keep editing in your original app. Only requesting help or checking your work sends a frame to Gemini.</p>
          </> : <div className="session-form"><h3>Work alongside your desktop.</h3><p>Run <code>npm run desktop</code> to select a live window. You can also use an image here.</p><label htmlFor="work-image">Current work</label><input ref={fileInput} id="work-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} /></div>}
        </aside>
        <div className="help-workflow" aria-busy={busy}>
          <nav className="workflow-steps" aria-label="Help workflow">
            <button aria-current={step === 'context' ? 'step' : undefined} disabled={busy} onClick={() => setStep('context')}>01 Context</button>
            <span aria-hidden="true">→</span>
            <button aria-current={step === 'help' ? 'step' : undefined} disabled={busy || !sessionId} onClick={() => setStep('help')}>02 Get help</button>
          </nav>
          {step === 'context' ? <form className="context-form" onSubmit={event => {
            event.preventDefault();
            if (!draft.overview.trim() || !draft.goal.trim()) { setError('Add a brief project overview and your current task.'); return; }
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
            });
          }}>
            <h3>What exactly do you need help with?</h3>
            <p>Give WhatNow a little context before your first hint.</p>
            <fieldset disabled={busy}>
              <label htmlFor="overview">Brief project overview</label>
              <textarea id="overview" required maxLength={900} value={draft.overview} onChange={event => edit({ ...draft, overview: event.target.value })} placeholder="A React app for tracking my daily habits…" />
              <label htmlFor="task-goal">What are you trying to work on?</label>
              <textarea id="task-goal" required maxLength={900} value={draft.goal} onChange={event => edit({ ...draft, goal: event.target.value })} placeholder="I’m trying to save a new habit, but the list isn’t updating." />
              <div className="context-tools">
                <button type="button" className="text-button" disabled={draftIndex === 0} onClick={() => setDraftIndex(draftIndex - 1)}>↶ Undo edit</button>
                <button type="button" className="text-button" disabled={draftIndex === drafts.length - 1} onClick={() => setDraftIndex(draftIndex + 1)}>↷ Redo edit</button>
              </div>
              {changed && <p className="preview-note">Applying this context clears the current hint history. Cancel returns to your saved context.</p>}
              <button className="button primary" type="submit">{busy ? 'Saving…' : changed ? 'Apply context & restart hints' : 'Continue to help →'}</button>
              {sessionId && <button className="button secondary" type="button" onClick={() => { setDrafts([savedContext]); setDraftIndex(0); setStep('help'); setError(''); }}>Cancel edits</button>}
            </fieldset>
          </form> : <div className="guidance-panel">
            <button className="text-button" disabled={busy} onClick={() => setStep('context')}>← Back to context</button>
            <h3>How much help do you need?</h3>
            <div className="help-levels" aria-label="Help levels">{levels.map((label, index) => {
              const level = index + 1;
              const existing = history.some(hint => hint.hint_level === level);
              const unlocked = level <= (latest?.hint_level ?? 0) + 1;
              return <button key={label} className={viewed?.hint_level === level ? 'selected' : ''} disabled={busy || !unlocked || (!existing && level === 1 && !(desktop ? live.active : file))} onClick={() => openLevel(level)}><span>0{level}</span>{label}{!unlocked && <small>Unlock the previous level</small>}</button>;
            })}</div>
            <div className="guidance-copy" role="status">
              {viewed ? <><span className="eyebrow">{levels[viewed.hint_level - 1]}</span><div className="hint-message">{viewed.message}</div><details><summary>What WhatNow observed</summary><p>{viewed.observation}</p></details>{viewed.needs_more_context && <p className="context-question">{viewed.context_question}</p>}</> : <><h4>Start with a small nudge.</h4><p>Choose a window, then ask for level 1. Reveal more guidance whenever you’re ready.</p></>}
            </div>
            {history.length > 0 && <div className="history-controls">
              <button className="text-button" disabled={busy || viewIndex === 0} onClick={() => setViewIndex(viewIndex - 1)}>← Previous</button>
              <span>{viewIndex + 1} of {history.length}</span>
              <button className="text-button" disabled={busy || viewIndex === history.length - 1} onClick={() => setViewIndex(viewIndex + 1)}>Next →</button>
            </div>}
            <label htmlFor="follow-up">Question or extra context</label>
            <textarea id="follow-up" disabled={busy} maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Tell WhatNow what you tried, or answer its question…" />
            <div className="help-actions">
              <button className="button primary" disabled={busy || !(desktop ? live.active : file)} onClick={() => getHint(latest ? 'check_again' : 'initial')}>{busy ? 'Thinking…' : latest ? 'Check my latest work' : 'Get a small nudge'}</button>
              {latest?.needs_more_context && <button className="button secondary" disabled={busy || !question.trim()} onClick={() => getHint('more_hint')}>Send context</button>}
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
              setConfirmReset(false); setFile(null);
              if (fileInput.current) fileInput.current.value = '';
            })}>Start new problem</button>
          </div>}
        </div>
      </div>
    </section>
  );
}
