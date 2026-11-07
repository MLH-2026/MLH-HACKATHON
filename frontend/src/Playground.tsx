import { useState } from 'react';
import { Reveal } from './Reveal';

const hints = [
  ['Look at the last pass.', 'What value does i have on the final iteration? Which item would items[i] try to read?'],
  ['Compare the two ranges.', 'Write down the values produced by range(4). Then write down the valid indices for a list with three items.'],
  ['An index starts at zero.', 'A two-item list has indices 0 and 1. Index 2 is past the end. Apply the same reasoning to the three-item list.'],
];

const labels = ['Question', 'Hint', 'Explain'];
const actions = ['I’m stuck', 'Give me a hint', 'Explain the concept'];
const items = [2, 4, 6];

type Result = { kind: 'idle' | 'error' | 'partial' | 'success'; text: string };
const idle: Result = { kind: 'idle', text: 'Starting bug · IndexError: list index out of range' };

export function Playground() {
  const [bound, setBound] = useState('4');
  const [level, setLevel] = useState(-1);
  const [result, setResult] = useState<Result>(idle);
  const [attempts, setAttempts] = useState(0);

  function checkAttempt() {
    const end = Number(bound);
    setAttempts(count => count + 1);
    if (!bound.trim() || !Number.isSafeInteger(end)) {
      setResult({ kind: 'error', text: 'Enter a whole number as the upper bound.' });
    } else if (end > items.length) {
      setResult({ kind: 'error', text: 'IndexError at i = 3. Check which indices the list contains.' });
    } else if (end < items.length) {
      const values = items.slice(0, Math.max(0, end));
      setResult({ kind: 'partial', text: `Printed ${values.join(', ') || 'nothing'}. The goal is to print all three items.` });
    } else {
      setResult({ kind: 'success', text: 'Success! Printed 2, 4, 6. Every index visited exists in the list.' });
    }
  }

  const end = Number(bound);
  const failing = result.kind === 'error' && end > items.length;

  return (
    <section className="playground wrap" id="playground" aria-labelledby="demo-title">
      <Reveal>
        <div className="eyebrow"><span className="signal" /> THE HINT PLAYGROUND</div>
        <h2 id="demo-title">One bug. Three ways in.</h2>
        <p className="section-copy">Print all three items. Change the loop bound, check your attempt, and unlock hints only when you need them.</p>
      </Reveal>
      <Reveal className="demo-grid" delay={80}>
        <form className="editor" onSubmit={event => { event.preventDefault(); checkAttempt(); }} noValidate>
          <div className="panel-bar"><span>practice.py</span><span>PYTHON SIMULATION</span></div>
          <div className="editable-code">
            <div className="code-line"><b>1</b>items = [2, 4, 6]</div>
            <div className={`code-line ${failing ? 'is-bad' : ''}`}><b>2</b><span><span className="syntax">for</span> i <span className="syntax">in</span> range(<input
              aria-label="Loop upper bound"
              type="number"
              value={bound}
              onChange={event => { setBound(event.target.value); setResult(idle); }}
            />):</span></div>
            <div className={`code-line indent ${failing ? 'is-bad' : ''}`}><b>3</b>print(items[i])</div>
          </div>
          <div className="run-actions">
            <button type="submit" className="button primary">▶ Check attempt</button>
            <button type="button" className="button secondary" onClick={() => { setBound('4'); setLevel(-1); setResult(idle); setAttempts(0); }}>Reset</button>
            {attempts > 0 && <span className="attempts">Attempts: {attempts}</span>}
          </div>
          <div className={`terminal is-${result.kind}`} role="status">
            {result.kind === 'success' && <span aria-hidden="true">✓ </span>}
            {result.kind === 'error' && <span aria-hidden="true">✕ </span>}
            {result.text}
          </div>
        </form>
        <div className="coach">
          <div className="panel-bar"><span>✦ &nbsp; WhatNow</span><span>GUIDED DEMO</span></div>
          <ol className="steps" aria-label="Hint levels">
            {labels.map((label, index) => (
              <li key={label} className={index <= level ? 'is-done' : ''} aria-current={index === level ? 'step' : undefined}>0{index + 1} {label}</li>
            ))}
          </ol>
          <div className="response" role="status" key={level}>
            <h3>{hints[level]?.[0] ?? 'Need a nudge?'}</h3>
            <p>{hints[level]?.[1] ?? 'Start with a question about the loop.'}</p>
          </div>
          {level < hints.length - 1
            ? <button className="button primary" type="button" onClick={() => setLevel(level + 1)}>{actions[level + 1]}</button>
            : <p className="coach-done">That is the whole ladder. Now try the fix yourself.</p>}
        </div>
      </Reveal>
    </section>
  );
}
