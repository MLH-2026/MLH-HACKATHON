import { useState } from 'react';
import { Reveal } from './Reveal';

type Mode = 'manual' | 'whatnow';

const flows: Record<Mode, { title: string; verdict: string; steps: Array<[string, string]> }> = {
  manual: {
    title: 'Pasting it into a chatbot',
    verdict: 'You get a fix. You may not get the understanding.',
    steps: [
      ['Leave your editor', 'Open a browser tab, find your chat, and lose your train of thought.'],
      ['Rebuild the context', 'Screenshot, upload, then type out what you are building, what you tried, and “please don’t just give me the answer.”'],
      ['Receive a wall of text', 'Most chatbots answer with the full solution plus a long explanation you did not ask for.'],
      ['Copy, paste, move on', 'It works. But the “why” slides past, and the same bug shows up again next week.'],
      ['Start over next time', 'New bug, new chat, new prompt. Your goal and progress are gone.'],
    ],
  },
  whatnow: {
    title: 'Using WhatNow',
    verdict: 'You stay in flow, and you do the thinking.',
    steps: [
      ['Click once', 'A floating button sits on top of your editor. Nothing is captured until you press it.'],
      ['Pick what to share', 'Choose a screen or window, preview it, then send. You stay in control.'],
      ['Get one nudge', 'A single guiding question first. Hints only get more specific when you ask.'],
      ['Try it, then Check again', 'Fix it yourself, share the new screen, and get feedback on your attempt.'],
      ['Keep your goal', 'Your goal stays attached to the session, so every hint stays on target.'],
    ],
  },
};

const reasons = [
  { icon: '🧠', title: 'Built for learning, not answers', body: 'General chatbots are tuned to be helpful by solving things. WhatNow is tuned to make you better, so it guides first and only explains deeper when you ask.' },
  { icon: '✍️', title: 'No prompt-writing', body: 'You never craft “act as a patient tutor who…” again. The coaching style, the goal, and the hint rules are already built in.' },
  { icon: '👀', title: 'It sees what you see', body: 'Share a screen or window with one click instead of describing your code, copying errors, and hoping you included the right line.' },
  { icon: '🪜', title: 'A hint ladder you control', body: 'Question, then hint, then explanation. You choose how much help you want, so you never spoil the puzzle for yourself.' },
  { icon: '🔁', title: 'Check again loop', body: 'Made a change? Share the updated screen and get feedback on that attempt. It feels like pairing, not searching.' },
  { icon: '🔒', title: 'Privacy by design', body: 'Capture only happens when you click. Screenshots are not saved by default, nothing is sent in the background, and the API key stays on the backend.' },
];

const rows: Array<[string, string, string]> = [
  ['Setup for every question', 'Write a prompt and add context', 'One click'],
  ['Default response', 'Often the full solution', 'A guiding question first'],
  ['Remembers your goal', 'Only inside one chat thread', 'Yes, for the whole session'],
  ['Checks your next attempt', 'You re-upload and re-explain', 'Check again, built in'],
  ['Where it lives', 'A browser tab', 'Floating over your editor'],
  ['Best for', 'Anything, in general', 'Learning to code without being handed the answer'],
];

export function WhyWhatNow() {
  const [mode, setMode] = useState<Mode>('manual');
  const flow = flows[mode];

  return (
    <section className="why wrap" id="why" aria-labelledby="why-title">
      <Reveal>
        <div className="eyebrow"><span className="signal" /> WHY WHATNOW</div>
        <h2 id="why-title">Why not just ask ChatGPT or Claude?</h2>
        <p className="section-copy">You can, and they are great tools. But when you are learning, the way you get help matters as much as the help itself. Flip the switch to compare the two experiences.</p>
      </Reveal>

      <Reveal className="compare" delay={80}>
        <div className="toggle" role="tablist" aria-label="Compare ways of getting help">
          {(['manual', 'whatnow'] as Mode[]).map(key => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={mode === key ? 'is-active' : ''}
              onClick={() => setMode(key)}
            >
              {key === 'manual' ? 'The usual way' : '✦ With WhatNow'}
            </button>
          ))}
        </div>
        <div className={`flow flow-${mode}`} role="tabpanel" key={mode}>
          <div className="flow-head">
            <h3>{flow.title}</h3>
            <p>{flow.verdict}</p>
          </div>
          <ol className="flow-steps">
            {flow.steps.map(([title, body], index) => (
              <li key={title} style={{ animationDelay: `${index * 70}ms` }}>
                <span className="flow-num">{index + 1}</span>
                <div><strong>{title}</strong><p>{body}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      <div className="reasons">
        {reasons.map((reason, index) => (
          <Reveal key={reason.title} delay={index * 60}>
            <article className="reason">
              <span className="reason-icon" aria-hidden="true">{reason.icon}</span>
              <h3>{reason.title}</h3>
              <p>{reason.body}</p>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="table-scroll">
          <table className="compare-table">
            <caption className="sr-only">Comparison of a general chatbot and WhatNow</caption>
            <thead>
              <tr><th scope="col" /><th scope="col">Manual chatbot</th><th scope="col" className="is-us">✦ WhatNow</th></tr>
            </thead>
            <tbody>
              {rows.map(([label, chatbot, us]) => (
                <tr key={label}><th scope="row">{label}</th><td>{chatbot}</td><td className="is-us">{us}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="honest-note">
          <strong>Being honest:</strong> if you just need a quick answer or a full solution, a general chatbot is perfectly fine. WhatNow is for the moments when you want to understand your code and not only make the error go away.
        </p>
      </Reveal>
    </section>
  );
}
