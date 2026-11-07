import { useRef, useState } from 'react';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

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
        <a className="brand" href="#home" aria-label="What Now home" onClick={() => setMenuOpen(false)}>
          <span className="mark" aria-hidden="true">✦</span>
          <span>what now<span className="period">.</span></span>
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
          <a className="nav-link" href="#home" onClick={() => setMenuOpen(false)}>Home</a>
          <a className="nav-link" href="#session" onClick={() => setMenuOpen(false)}>Get help</a>
          <a className="nav-link" href="#playground" onClick={() => setMenuOpen(false)}>Playground</a>
          <a className="nav-link repo-link" href="https://github.com/MLH-2026/MLH-HACKATHON">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
