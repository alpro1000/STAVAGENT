/**
 * PitchPageEn — public English pitch page at /en/pitch.
 *
 * A standalone, shareable page (a single link can be pasted into an application
 * form and stay valid) that embeds the self-contained HTML pitch deck inline,
 * offers a Download-PDF action and a Request-a-pilot mailto, and shows a few
 * captioned product screenshots. EN-only; not linked from the Czech nav.
 *
 * Sibling to LandingPageEn (separate per-locale component — same convention as
 * LandingPage / LandingPageEn; no i18n library in this repo).
 *
 * ── PROVIDED ASSETS (drop into public/assets/pitch/) ─────────────────────────
 *   • deck.html   — the ~1 MB self-contained HTML deck (embedded via <iframe>)
 *   • deck.pdf    — the English deck PDF (Download-PDF button)
 *   • screenshot-1.png / -2.png / -3.png — real product screenshots
 *   • PAGE_COPY / SCREENSHOTS captions below come from the provided English
 *     copy — fill verbatim, do not write or alter marketing claims.
 * ─────────────────────────────────────────────────────────────────────────── */

import { useEffect } from 'react';
import { Download, Mail, ArrowLeft, ExternalLink } from 'lucide-react';
import { useHeadMeta } from '../hooks/useHeadMeta';
import LanguageSwitch from '../components/LanguageSwitch';

// ── Provided-asset slots ──────────────────────────────────────────────────────
// Hero copy is taken verbatim from the provided deck cover (headline + subtitle).
const PAGE_COPY = {
  heading: 'From an estimate to a buildable production plan.',
  subheading: 'A deterministic production-planning engine for construction — with optional agentic access.',
};

const DECK_HTML_SRC = '/assets/pitch/deck.html';
const DECK_PDF_HREF = '/assets/pitch/deck.pdf';

// 2–3 product screenshots. Captions are factual descriptions of each shot
// (pending the founder's preferred wording). The image files screenshot-1..3.png
// must be added to public/assets/pitch/ — see the note in this file's header.
const SCREENSHOTS: { src: string; caption: string }[] = [
  { src: '/assets/pitch/screenshot-1.png', caption: 'Concrete-works calculator — takt schedule (Gantt) and a cost and norm-hour summary, sequential vs. parallel.' },
  { src: '/assets/pitch/screenshot-2.png', caption: 'Agentic access — the same engine called from an AI assistant through the MCP server.' },
  { src: '/assets/pitch/screenshot-3.png', caption: 'Deterministic decomposition — each quantity with its formula, source norm and confidence.' },
];

const CONTACT_EMAIL = 'info@stavagent.cz';
const LINKEDIN_URL = 'https://www.linkedin.com/in/alexander-prokopov';
const SITE_URL = 'https://www.stavagent.cz/en/';
const PILOT_MAILTO =
  'mailto:info@stavagent.cz' +
  '?subject=' + encodeURIComponent('Request a pilot — STAVAGENT') +
  '&body=' + encodeURIComponent(
    "Hi Alexander,\n\nWe'd like to explore a pilot with STAVAGENT.\n\n" +
    'Company:\nProject / tender:\nTimeline:\n\nThanks,',
  );

// ── Styles (per-page inline convention, design-system CSS vars) ───────────────
const sectionStyle = (maxW = '960px', py = '56px') => ({
  padding: `${py} 24px`,
  maxWidth: maxW,
  margin: '0 auto',
}) as const;

const orangeBtn = {
  padding: '14px 28px',
  background: 'var(--accent-orange)',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: '16px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  textDecoration: 'none',
} as const;

const ghostBtn = {
  padding: '12px 24px',
  background: 'transparent',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default, #d1d5db)',
  borderRadius: '8px',
  fontWeight: 500,
  fontSize: '15px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  textDecoration: 'none',
} as const;

// ── Component ─────────────────────────────────────────────────────────────────
export default function PitchPageEn() {
  useHeadMeta({
    canonical: 'https://www.stavagent.cz/en/pitch',
    hreflangs: {
      // EN-only page; the cs alternate points to the Czech site home (there is
      // no Czech pitch page). x-default resolves to this English pitch page.
      cs: 'https://www.stavagent.cz/',
      en: 'https://www.stavagent.cz/en/pitch',
      'x-default': 'https://www.stavagent.cz/en/pitch',
    },
  });

  // Propagate locale to <html lang> + <title>; restore on unmount (SPA).
  useEffect(() => {
    const prevLang = document.documentElement.lang;
    const prevTitle = document.title;
    document.documentElement.lang = 'en';
    document.title = 'Pitch | StavAgent';
    return () => {
      document.documentElement.lang = prevLang;
      document.title = prevTitle;
    };
  }, []);

  return (
    <div lang="en" style={{ minHeight: '100vh', background: 'var(--app-bg-concrete)', overflowX: 'hidden' }}>

      {/* ── NAV (minimal) ── */}
      <nav className="pub-nav" style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(176,178,181,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)',
        padding: '0 24px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <a href="/en/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <img src="/assets/logo.svg" alt="StavAgent" style={{ width: 40, height: 40 }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>StavAgent</span>
        </a>
        <div className="pub-nav__actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/en/" style={{ ...ghostBtn, padding: '8px 16px', fontSize: 13 }}>
            <ArrowLeft size={15} /> Back to site
          </a>
          <LanguageSwitch to="/" label="Čeština" />
        </div>
      </nav>

      {/* ── HERO (provided copy) ── */}
      <section style={{ ...sectionStyle('760px', '64px'), textAlign: 'center' }}>
        <h1 style={{
          fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 700,
          color: 'var(--text-primary)', lineHeight: 1.15, marginBottom: 16,
        }}>
          {PAGE_COPY.heading}
        </h1>
        <p style={{
          fontSize: 'clamp(16px, 2.5vw, 19px)', color: 'var(--text-secondary)',
          lineHeight: 1.6, maxWidth: 640, margin: '0 auto 28px',
        }}>
          {PAGE_COPY.subheading}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <a href={PILOT_MAILTO} style={orangeBtn}>
            <Mail size={18} /> Request a pilot
          </a>
          <a href={DECK_PDF_HREF} download style={ghostBtn}>
            <Download size={17} /> Download PDF
          </a>
        </div>
      </section>

      {/* ── DECK (inline self-contained HTML) ── */}
      <section style={sectionStyle('1040px', '24px')}>
        <div style={{
          position: 'relative', width: '100%', aspectRatio: '16 / 9',
          borderRadius: 12, overflow: 'hidden',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-panel)', background: '#fff',
        }}>
          <iframe
            src={DECK_HTML_SRC}
            title="STAVAGENT pitch deck"
            loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <a
            href={DECK_HTML_SRC}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: 'var(--accent-orange)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Open the deck in a new tab <ExternalLink size={14} />
          </a>
        </div>
      </section>

      {/* ── SCREENSHOTS (provided assets + captions) ── */}
      <section style={sectionStyle('1040px', '48px')}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {SCREENSHOTS.map((s, i) => (
            <figure key={i} style={{ margin: 0 }}>
              <div style={{
                borderRadius: 10, overflow: 'hidden',
                border: '1px solid var(--border-default)',
                background: 'var(--data-surface)',
              }}>
                <img
                  src={s.src}
                  alt={s.caption}
                  loading="lazy"
                  onError={(e) => {
                    // Hide the figure until its screenshot file exists, so the
                    // page never shows a broken-image icon. Pure DOM, no state,
                    // no storage. Once the PNG is added the image loads normally.
                    const fig = e.currentTarget.closest('figure');
                    if (fig) (fig as HTMLElement).style.display = 'none';
                  }}
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                />
              </div>
              <figcaption style={{
                fontSize: 13, color: 'var(--text-secondary)',
                lineHeight: 1.5, marginTop: 8, textAlign: 'center',
              }}>
                {s.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── CLOSING: request a pilot + contact ── */}
      <section style={{ ...sectionStyle('700px', '56px'), textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <a href={PILOT_MAILTO} style={orangeBtn}>
            <Mail size={18} /> Request a pilot
          </a>
          <a href={DECK_PDF_HREF} download style={ghostBtn}>
            <Download size={17} /> Download PDF
          </a>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          Alexander Prokopov · <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent-orange)', textDecoration: 'none' }}>{CONTACT_EMAIL}</a>
          {' · '}
          <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-orange)', textDecoration: 'none' }}>LinkedIn</a>
          {' · '}
          <a href={SITE_URL} style={{ color: 'var(--accent-orange)', textDecoration: 'none' }}>www.stavagent.cz</a>
        </p>
      </section>

    </div>
  );
}
