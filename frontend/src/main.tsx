import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Orb } from './Orb';
import { Header } from './Header';
import { Session } from './Session';
import { Playground } from './Playground';
import { WhyWhatNow } from './WhyWhatNow';
import { Reveal } from './Reveal';
import './styles.css';

function App() {
  // The Electron window shows only the workspace, without the marketing page.
  if (window.whatNowDesktop) {
    return <main className="desktop-shell"><Session /></main>;
  }
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1}>
        <section className="hero wrap" id="home" aria-labelledby="welcome">
          <div className="intro">
            <div className="eyebrow"><span className="signal" /> YOUR CODING COMPANION</div>
            <h1 id="welcome">Find your<br /><em>next move.</em></h1>
            <p>Stuck on code, a draft, or a problem set? Get a small, timely hint that helps you work through it yourself.</p>
            <div className="cta-row">
              <a className="button primary" href="#session">Get unstuck <span aria-hidden="true">↗</span></a>
              <a className="button secondary" href="#playground">Try the demo</a>
            </div>
            <ul className="trust" aria-label="Highlights">
              <li>Hints, not answers</li>
              <li>You choose what to share</li>
              <li>Nothing saved</li>
            </ul>
            <div className="caption">01 / EXPLORE A SAMPLE BUG</div>
          </div>
          <Orb />
        </section>
        <WhyWhatNow />
        <Reveal><Session /></Reveal>
        <Playground />
      </main>
      <footer className="wrap footer"><span>✦ &nbsp; WhatNow</span><span>MLH HACKATHON PROTOTYPE</span></footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
