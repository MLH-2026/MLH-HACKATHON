import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Orb } from './Orb';
import { Header } from './Header';
import { Session } from './Session';
import './styles.css';

const hints = [
  ['Look at the last pass.', 'What value does i have on the final iteration? Which item would items[i] try to read?'],
  ['Compare the two ranges.', 'Write down the values produced by range(4). Then write down the valid indices for a list with three items.'],
  ['An index starts at zero.', 'A two-item list has indices 0 and 1. Index 2 is past the end. Apply the same reasoning to the three-item list.'],
];

const actions = ['I’m stuck', 'Give me a hint', 'Explain the concept'];
const items = [2, 4, 6];

function Playground() {
  const [bound, setBound] = useState('4');
  const [level, setLevel] = useState(-1);
  const [output, setOutput] = useState('');

  function checkAttempt() {
    const end = Number(bound);
    if (!bound.trim() || !Number.isSafeInteger(end)) {
      setOutput('Enter a whole number as the upper bound.');
    } else if (end > items.length) {
      setOutput('IndexError at i = 3. Check which indices the list contains.');
    } else if (end < items.length) {
      const values = items.slice(0, Math.max(0, end));
      setOutput(`Printed ${values.join(', ') || 'nothing'}. The goal is to print all three items.`);
    } else {
      setOutput('Success! Printed 2, 4, 6. Every index visited exists in the list.');
    }
  }

  return (
    <section className="playground wrap" id="playground" aria-labelledby="demo-title">
      <div className="eyebrow"><span className="signal" /> THE HINT PLAYGROUND</div>
      <h2 id="demo-title">One bug. Three ways in.</h2>
      <p className="section-copy">Print all three items. Change the loop bound, check your attempt, and unlock hints when you need them.</p>
      <div className="demo-grid">
        <form className="editor" onSubmit={event => { event.preventDefault(); checkAttempt(); }} noValidate>
          <div className="panel-bar"><span>practice.py</span><span>PYTHON SIMULATION</span></div>
          <div className="editable-code">
            <div>items = [2, 4, 6]</div>
            <div><span className="syntax">for</span> i <span className="syntax">in</span> range(<input
              aria-label="Loop upper bound"
              type="number"
              value={bound}
              onChange={event => { setBound(event.target.value); setOutput(''); }}
            />):</div>
            <div className="indent">print(items[i])</div>
          </div>
          <div className="run-actions">
            <button type="submit" className="button primary">Check attempt</button>
            <button type="button" className="button secondary" onClick={() => { setBound('4'); setLevel(-1); setOutput(''); }}>Reset</button>
          </div>
          <div className="terminal" role="status">{output || 'Starting bug · IndexError: list index out of range'}</div>
        </form>
        <div className="coach">
          <div className="panel-bar"><span>✦ &nbsp; What Now</span><span>GUIDED DEMO</span></div>
          <ol className="steps" aria-label="Hint levels">
            {['Question', 'Hint', 'Explain'].map((label, index) => (
              <li key={label} aria-current={index === level ? 'step' : undefined}>0{index + 1} {label}</li>
            ))}
          </ol>
          <div className="response" role="status">
            <h3>{hints[level]?.[0] ?? 'Need a nudge?'}</h3>
            <p>{hints[level]?.[1] ?? 'Start with a question about the loop.'}</p>
          </div>
          {level < hints.length - 1 && (
            <button className="button primary" type="button" onClick={() => setLevel(level + 1)}>{actions[level + 1]}</button>
          )}
        </div>
      </div>
    </section>
  );
}

function App() {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1}>
        <section className="hero wrap" id="home" aria-labelledby="welcome">
          <div className="intro">
            <div className="eyebrow"><span className="signal" /> YOUR CODING COMPANION</div>
            <h1 id="welcome">Find your<br /><em>next move.</em></h1>
            <p>Stuck on a line of code? Get a small, timely hint that helps you work through it yourself.</p>
            <a className="button primary" href="#playground">Try the hint ladder <span aria-hidden="true">↗</span></a>
            <div className="caption">01 / EXPLORE A SAMPLE BUG</div>
          </div>
          <Orb />
        </section>
        <Session />
        <Playground />
      </main>
      <footer className="wrap footer"><span>✦ &nbsp; WHAT NOW</span><span>MLH HACKATHON PROTOTYPE</span></footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
