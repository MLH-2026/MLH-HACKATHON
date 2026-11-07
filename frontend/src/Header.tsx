import { useEffect, useRef, useState } from 'react';

const sections = [
  { id: 'home', label: 'Home' },
  { id: 'session', label: 'Get help' },
  { id: 'playground', label: 'Playground' },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const offset = (document.querySelector('.site-header')?.getBoundingClientRect().height ?? 84) + 32;
      let current = 'home';
      for (const { id } of sections) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= offset) current = id;
      }
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = 'playground';
      }
      setActiveSection(current);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', schedule);
    };
  }, []);

  return (
    <header
      className="site-header"
      onKeyDown={event => {
        if (event.key === 'Escape' && menuOpen) {
          setMenuOpen(false);
          toggle.current?.focus();
        }
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
      }}
    >
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="wrap top">
        <a className="brand" href="#home" aria-label="WhatNow home" onClick={() => setMenuOpen(false)}>
          <span className="mark" aria-hidden="true">✦</span>
          <span>WhatNow<span className="period">.</span></span>
        </a>
        <div className="header-actions">
          <a className="button primary header-cta" href="#session" onClick={() => setMenuOpen(false)}>
            Try it <span aria-hidden="true">↗</span>
          </a>
          <button
            ref={toggle}
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
          </button>
        </div>
        <nav id="primary-navigation" className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          {sections.map(({ id, label }) => (
            <a key={id} className="nav-link" href={`#${id}`}
              aria-current={activeSection === id ? 'location' : undefined}
              onClick={() => { setActiveSection(id); setMenuOpen(false); }}>
              {label}
            </a>
          ))}
          <a className="nav-link repo-link" href="https://github.com/Aly-Baranek/MLH-HACKATHON" target="_blank" rel="noopener noreferrer">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
