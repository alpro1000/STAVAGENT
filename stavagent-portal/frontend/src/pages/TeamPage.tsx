/**
 * TeamPage — bilingual founder / "About the founder" page.
 *
 * Two routes wired by App.tsx:
 *   /team       → <TeamPage locale="cs" />
 *   /en/team    → <TeamPage locale="en" />
 *
 * Both routes are eagerly imported (NOT React.lazy) so that the postbuild
 * prerender (scripts/prerender.mjs) captures the rendered DOM cleanly
 * without waiting on async chunk loads.
 *
 * Content sources:
 *   - CZ founder bio + quote + open-positions block: provided verbatim by
 *     the v4.1 founder narrative spec (Gate 10 task).
 *   - EN counterparts: spec-provided translations.
 *   - "What StavAgent does" section: lifted VERBATIM from
 *     docs/CALCULATOR_PHILOSOPHY.md §1 (4-item list + 'velkými mazy' line),
 *     §6.3 ('technologicky správné výsledky'), §7.2 (value line). EN
 *     mirrors the CZ phrasing one-to-one — preserves meaning, no
 *     paraphrase as required by Gate 5 / Gate 10 mandate.
 *   - Personal-time disclaimer: provided verbatim, MANDATORY both
 *     languages, no mention of any specific employer name.
 *
 * Hreflang: NOT added yet — Gate 11 will activate hreflang across all
 * pages in one pass. /team ↔ /en/team will be cross-linked then.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Linkedin, Mail } from 'lucide-react';

type Locale = 'cs' | 'en';

// ─── Content per locale (canonical, do not paraphrase) ─────────────────────

type Content = {
  htmlLang: string;
  homeLabel: string;
  switchLabel: string;
  switchHref: string;
  h1: string;
  bioParagraph: string;
  linkedinLabel: string;
  quote: string;
  whatHeading: string;
  whatBullets: string[];
  whatClosing: string;
  whatAccuracyHeading: string;
  whatAccuracy: string;
  whatValueLine: string;
  disclaimerHeading: string;
  disclaimerText: string;
  positionsHeading: string;
  positions: Array<{ title: string; text: string }>;
  contactIntro: string;
  contactPrimary: string;
  contactSecondary: string;
  backCta: string;
  copyrightSuffix: string;
};

const CONTENT: Record<Locale, Content> = {
  cs: {
    htmlLang: 'cs',
    homeLabel: 'Zpět na hlavní stranu',
    switchLabel: 'English',
    switchHref: '/en/team',
    h1: 'O zakladateli',
    bioParagraph:
      'Alexander pracuje jako přípravář a rozpočtář pro mostní a železniční stavby v české stavební společnosti. StavAgent začal stavět v srpnu 2025 — aby vyřešil to, s čím se denně potýká ve své práci.',
    linkedinLabel: 'LinkedIn',
    quote:
      'Při tendrování mostních konstrukcí je výpočet monolitu kritická cesta. Všechno ostatní běží paralelně nebo navazuje. Když monolit spočítáš správně — máš celý harmonogram. Když špatně — promáchneš rozpočet i termíny.',
    whatHeading: 'Co StavAgent dělá',
    // Verbatim z docs/CALCULATOR_PHILOSOPHY.md §1.
    whatBullets: [
      'Rychle se zorientovat v projektu — jaký typ bednění, jaká podpěrná konstrukce, kolik měsíců pronájem.',
      'Odhadnout náklady s přesností ±10–15 % pro tendrový rozpočet a předběžnou kalkulaci.',
      'Identifikovat technologicky správný stack — co půjde do poptávky u dodavatele.',
      'Připravit se na rozhovor s dodavatelem — kalkulátor řekne „potřebujete Top 50 + Staxo 100", přípravář pak jde k DOKA s konkrétní poptávkou.',
    ],
    // Verbatim §1 závěr.
    whatClosing:
      'Kalkulátor pracuje velkými mazy — určí hlavní systémy, jejich pronájem, procento spotřebních materiálů. Není to engineering tool.',
    whatAccuracyHeading: 'Approximate but very accurate',
    // Verbatim §6.3 — "technologicky správné výsledky jsou cíl".
    whatAccuracy:
      'Technologicky správné výsledky jsou cíl. Konkrétní čísla jsou konzistentní s rule-of-thumb, ne engineering precision. Pro tendrovou fázi a předběžnou kalkulaci je tato přesnost dostatečná.',
    // Verbatim §7.2 value line.
    whatValueLine:
      'Naše hodnota = rychlost + technologická správnost + vendor-neutralita v fázi předtendrové kalkulace.',
    disclaimerHeading: 'Osobní projekt',
    disclaimerText:
      'StavAgent je osobní projekt vyvíjený mimo zaměstnání. Nepoužívá důvěrné informace ani zdroje současného zaměstnavatele.',
    positionsHeading: 'Otevřené pozice',
    positions: [
      {
        title: 'Engineering advisor',
        text: 'Bednění (DOKA / PERI / ULMA), beton-technologie, mostní statika. Sparring partner pro tech cards a calibration percentilních parametrů.',
      },
      {
        title: 'Pilot partnership',
        text: 'Stavební firmy v ČR, SR a DACH regionu, které chtějí otestovat workflow na reálném tendru — výměnou za feedback.',
      },
      {
        title: 'Strategický kapitál',
        text: 'Vertikální AI pro evropský stavební trh. Pre-seed / seed stage. Engineering-led, deterministicky-first, OTSKP/ČSN-native.',
      },
    ],
    contactIntro: 'Kontakt:',
    contactPrimary: 'info@stavagent.cz',
    contactSecondary: 'postmaster@stavagent.cz',
    backCta: 'Zpět na hlavní stranu',
    copyrightSuffix: 'StavAgent. Všechna práva vyhrazena.',
  },
  en: {
    htmlLang: 'en',
    homeLabel: 'Back to home',
    switchLabel: 'Česky',
    switchHref: '/team',
    h1: 'About the Founder',
    bioParagraph:
      'Alexander works as a construction estimator (přípravář and rozpočtář) for bridge and railway construction projects at a Czech construction company. He started building StavAgent in August 2025 to solve a problem he faces in his daily work.',
    linkedinLabel: 'LinkedIn',
    quote:
      'When tendering bridge structures, the monolithic concrete calculation IS the critical path. Everything else runs in parallel or follows. Get the concrete right and you have the schedule. Get it wrong and you’ve underbid the tender and overcommitted the timeline.',
    whatHeading: 'What StavAgent does',
    // Translation of CALCULATOR_PHILOSOPHY.md §1 (canonical CZ preserved
    // one-to-one — no paraphrase, only language adaptation).
    whatBullets: [
      'Get oriented in a project fast — which formwork type, which support structure, how many months of rental.',
      'Estimate costs at ±10–15 % accuracy for tender budgets and preliminary calculations.',
      'Identify the technologically correct stack — what goes into the supplier RFQ.',
      'Prepare for the supplier conversation — the calculator says „you need Top 50 + Staxo 100", the estimator then goes to DOKA with a concrete request.',
    ],
    // Translation of §1 closing line.
    whatClosing:
      'The calculator works in broad strokes — it identifies main systems, their rental, and percentage of consumable materials. It is not an engineering tool.',
    whatAccuracyHeading: 'Approximate but very accurate',
    // Translation of §6.3 — "technologically correct results are the goal".
    whatAccuracy:
      'Technologically correct results are the goal. Specific numbers are consistent with engineering rule-of-thumb, not engineering precision. For the tender phase and preliminary estimate, this accuracy is sufficient.',
    // Translation of §7.2 value line.
    whatValueLine:
      'Our value = speed + technological correctness + vendor-neutrality in the pre-tender estimation phase.',
    disclaimerHeading: 'Personal project',
    disclaimerText:
      'StavAgent is a personal project built outside employment. It does not use proprietary information or resources from current employer.',
    positionsHeading: 'Open positions',
    positions: [
      {
        title: 'Engineering advisor',
        text: 'Formwork (DOKA / PERI / ULMA), concrete technology, bridge structural engineering. Sparring partner for tech cards and calibration of percentile parameters.',
      },
      {
        title: 'Pilot partnership',
        text: 'Construction firms in CZ, SK, and the DACH region willing to test the workflow on a real tender — in exchange for feedback.',
      },
      {
        title: 'Strategic capital',
        text: 'Vertical AI for the European construction market. Pre-seed / seed stage. Engineering-led, deterministic-first, OTSKP/ČSN-native.',
      },
    ],
    contactIntro: 'Contact:',
    contactPrimary: 'info@stavagent.cz',
    contactSecondary: 'postmaster@stavagent.cz',
    backCta: 'Back to home',
    copyrightSuffix: 'StavAgent. All rights reserved.',
  },
};

const LINKEDIN_URL = 'https://www.linkedin.com/in/alexander-prokopov';

// ─── Shared styles (subset of LandingPage tokens, inlined for isolation) ───

const card = {
  background: 'var(--panel-clean)',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: 'var(--shadow-panel)',
} as const;

const sectionStyle = (maxW = '900px', py = '48px') => ({
  padding: `${py} 24px`,
  maxWidth: maxW,
  margin: '0 auto',
}) as const;

const h2Style = {
  fontSize: 'clamp(22px, 4vw, 32px)',
  fontWeight: 700,
  color: 'var(--text-primary)',
  marginBottom: 16,
} as const;

const ghostBtn = {
  padding: '8px 16px',
  background: 'transparent',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default, #d1d5db)',
  borderRadius: '8px',
  fontWeight: 500,
  fontSize: 13,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
} as const;

const orangeBtn = {
  padding: '10px 20px',
  background: 'var(--accent-orange)',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
} as const;

// ─── Component ─────────────────────────────────────────────────────────────

interface TeamPageProps {
  locale: Locale;
}

export default function TeamPage({ locale }: TeamPageProps) {
  const navigate = useNavigate();
  const t = CONTENT[locale];

  // Set document.documentElement.lang so the prerender captures the right
  // lang attribute in <html>. Important for accessibility + SEO.
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = t.htmlLang;
    document.title =
      locale === 'cs'
        ? 'O zakladateli — StavAgent'
        : 'About the Founder — StavAgent';
    return () => {
      document.documentElement.lang = previous;
    };
  }, [locale, t.htmlLang]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-concrete)', overflowX: 'hidden' }}>

      {/* ── Nav: minimal (back + language toggle) ─────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(176,178,181,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)',
        padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div
          onClick={() => navigate(locale === 'cs' ? '/' : '/en/')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        >
          <img src="/assets/logo.svg" alt="StavAgent" style={{ width: 40, height: 40 }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>StavAgent</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(locale === 'cs' ? '/' : '/en/')} style={ghostBtn}>
            <ArrowLeft size={14} /> {t.homeLabel}
          </button>
          <a href={t.switchHref} style={ghostBtn}>
            {t.switchLabel}
          </a>
        </div>
      </nav>

      {/* ── 1. HERO: heading + bio + LinkedIn ─────────────────────────── */}
      <section style={sectionStyle('900px', '64px')}>
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 700,
          color: 'var(--text-primary)', lineHeight: 1.15, marginBottom: 24,
        }}>
          {t.h1}
        </h1>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 28,
          alignItems: 'flex-start',
        }}>
          {/* Headshot placeholder: orange-bordered circle with initials.
              Replace with real founder photo at /assets/founder.jpg once
              available; img tag pattern below in commented form. */}
          <div
            aria-label="Alexander Prokopov"
            style={{
              width: 96, height: 96, borderRadius: '50%',
              background: 'var(--data-surface, #e5e7eb)',
              border: '3px solid var(--accent-orange)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 700, color: 'var(--text-primary)',
              fontFamily: "'DM Sans', system-ui, sans-serif",
              flexShrink: 0,
            }}
          >
            AP
          </div>

          <div>
            <p style={{
              fontSize: 16, color: 'var(--text-primary)',
              lineHeight: 1.65, margin: '0 0 16px',
            }}>
              {t.bioParagraph}
            </p>
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={ghostBtn}
            >
              <Linkedin size={14} /> {t.linkedinLabel}
            </a>
          </div>
        </div>
      </section>

      {/* ── 2. QUOTE: bridge-tendering insight ────────────────────────── */}
      <section style={sectionStyle('900px', '32px')}>
        <blockquote style={{
          margin: 0,
          padding: '24px 28px',
          borderLeft: '4px solid var(--accent-orange)',
          background: 'var(--data-surface)',
          borderRadius: '0 12px 12px 0',
          fontSize: 17, color: 'var(--text-primary)',
          lineHeight: 1.65, fontStyle: 'italic',
        }}>
          {t.quote}
        </blockquote>
      </section>

      {/* ── 3. WHAT STAVAGENT DOES: lifted from CALCULATOR_PHILOSOPHY.md ── */}
      <section style={sectionStyle('900px')}>
        <h2 style={h2Style}>{t.whatHeading}</h2>

        <div style={{ ...card, marginBottom: 16 }}>
          <ul style={{
            margin: 0, padding: 0, listStyle: 'none',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {t.whatBullets.map((bullet, i) => (
              <li key={i} style={{
                fontSize: 14, color: 'var(--text-primary)',
                lineHeight: 1.6, paddingLeft: 20, position: 'relative',
              }}>
                <span style={{
                  position: 'absolute', left: 0, top: 8,
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--accent-orange)',
                }} />
                {bullet}
              </li>
            ))}
          </ul>
          <p style={{
            margin: '20px 0 0', paddingTop: 16,
            borderTop: '1px solid var(--border-default)',
            fontSize: 14, color: 'var(--text-secondary)',
            lineHeight: 1.6, fontStyle: 'italic',
          }}>
            {t.whatClosing}
          </p>
        </div>

        {/* "Approximate but very accurate" framing — verbatim §6.3 */}
        <div style={{
          ...card,
          borderLeft: '4px solid var(--accent-orange)',
          background: 'var(--data-surface)',
          marginBottom: 16,
        }}>
          <h3 style={{
            fontSize: 15, fontWeight: 700,
            color: 'var(--text-primary)', margin: '0 0 8px',
          }}>
            {t.whatAccuracyHeading}
          </h3>
          <p style={{
            margin: 0, fontSize: 14,
            color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            {t.whatAccuracy}
          </p>
        </div>

        <p style={{
          margin: 0, padding: '14px 20px',
          background: 'var(--data-surface)',
          borderRadius: 8,
          fontSize: 14, color: 'var(--text-primary)',
          lineHeight: 1.55, textAlign: 'center',
          fontWeight: 500,
        }}>
          {t.whatValueLine}
        </p>
      </section>

      {/* ── 4. PERSONAL-TIME DISCLAIMER (mandatory) ───────────────────── */}
      <section style={sectionStyle('900px', '32px')}>
        <div style={{
          ...card,
          borderTop: '3px solid var(--accent-orange)',
          background: 'rgba(255,159,28,0.04)',
        }}>
          <h3 style={{
            fontSize: 15, fontWeight: 700,
            color: 'var(--text-primary)', margin: '0 0 8px',
          }}>
            {t.disclaimerHeading}
          </h3>
          <p style={{
            margin: 0, fontSize: 14,
            color: 'var(--text-primary)', lineHeight: 1.65,
          }}>
            {t.disclaimerText}
          </p>
        </div>
      </section>

      {/* ── 5. OPEN POSITIONS ─────────────────────────────────────────── */}
      <section style={sectionStyle('900px')}>
        <h2 style={h2Style}>{t.positionsHeading}</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}>
          {t.positions.map((p, i) => (
            <div key={i} style={card}>
              <h3 style={{
                fontSize: 15, fontWeight: 700,
                color: 'var(--text-primary)', margin: '0 0 8px',
              }}>
                {p.title}
              </h3>
              <p style={{
                margin: 0, fontSize: 13,
                color: 'var(--text-secondary)', lineHeight: 1.6,
              }}>
                {p.text}
              </p>
            </div>
          ))}
        </div>

        <div style={{
          ...card,
          textAlign: 'center',
          background: 'var(--data-surface)',
        }}>
          <p style={{
            margin: '0 0 12px', fontSize: 14,
            color: 'var(--text-primary)',
          }}>
            {t.contactIntro}{' '}
            <a
              href={`mailto:${t.contactPrimary}`}
              style={{ color: 'var(--accent-orange)', textDecoration: 'none', fontWeight: 600 }}
            >
              {t.contactPrimary}
            </a>
            {' · '}
            <a
              href={`mailto:${t.contactSecondary}`}
              style={{ color: 'var(--accent-orange)', textDecoration: 'none' }}
            >
              {t.contactSecondary}
            </a>
          </p>
          <a
            href={`mailto:${t.contactPrimary}`}
            style={orangeBtn}
          >
            <Mail size={16} /> {t.contactIntro.replace(/:$/, '')}
          </a>
        </div>
      </section>

      {/* ── 6. BACK CTA ──────────────────────────────────────────────── */}
      <section style={{ ...sectionStyle('900px', '32px'), textAlign: 'center' }}>
        <button
          onClick={() => navigate(locale === 'cs' ? '/' : '/en/')}
          style={orangeBtn}
        >
          <ArrowLeft size={16} /> {t.backCta}
        </button>
      </section>

      {/* ── 7. FOOTER ────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border-default)',
        padding: '32px 24px 24px',
        maxWidth: 900, margin: '0 auto',
        textAlign: 'center',
        fontSize: 13, color: 'var(--text-muted)',
      }}>
        &copy; {new Date().getFullYear()} {t.copyrightSuffix}
        {' · '}
        <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
          LinkedIn <ArrowRight size={12} style={{ display: 'inline', marginLeft: 2 }} />
        </a>
      </footer>
    </div>
  );
}
