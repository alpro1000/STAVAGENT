/**
 * LandingPageEn — English landing for /en/.
 *
 * Sibling to LandingPage (CZ at /). Kept as a SEPARATE component (not a
 * locale-prop refactor of LandingPage) for two reasons:
 *   1. Zero regression risk on the live CZ landing during Gate 11.
 *   2. Per Gate 11 spec: 'Both target same product, different audiences.
 *      Don't homogenize.' CZ emphasizes workflow ('Z rozpočtu pracovní
 *      plán'); EN emphasizes engineering depth (ČSN EN 13670, DIN 18218,
 *      Saul maturity, TKP 18) for international audiences who don't know
 *      Czech construction culture. The two versions can drift in copy
 *      framing while sharing the same product structure.
 *
 * Canonical sources (per Gate 5 / Gate 10 mandate):
 *   - "What StavAgent does NOT do" bullets — translation of
 *     docs/CALCULATOR_PHILOSOPHY.md §2 (one-to-one, no paraphrase).
 *   - Calculator disclaimer — translation of §5.1 verbatim.
 *   - Value line — translation of §7.2.
 *
 * Translation rule (per Gate 11 spec):
 *   - Czech construction terms preserved with EN explanation on first
 *     mention: 'přípravář (construction estimator)', 'rozpočtář (cost
 *     estimator)', 'betonáž (concrete works)'.
 *   - Canonical module names NOT translated: Klasifikátor, Registr,
 *     Kalkulátor betonáže stay as-is — they are product names.
 *   - Czech norm names preserved: ČSN EN 13670, DIN 18218, TKP 18, ŘSD,
 *     OTSKP — these are proof of domain authenticity, not jargon to hide.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, LogIn, User, Calculator, HardHat, Building2, Landmark,
  TableProperties, FileSearch, Link, Cpu, Upload,
  FileOutput, Database, Brain, ChevronDown, ChevronUp,
  Check, Mail, Code, Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useHeadMeta } from '../hooks/useHeadMeta';

// ── Helpers ─────────────────────────────────────────────────────────────────
const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

const openExternal = (url: string) =>
  window.open(url, '_blank', 'noopener,noreferrer');

// ── Shared styles ───────────────────────────────────────────────────────────
const card = {
  background: 'var(--panel-clean)',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: 'var(--shadow-panel)',
} as const;

const sectionStyle = (maxW = '1000px', py = '64px') => ({
  padding: `${py} 24px`,
  maxWidth: maxW,
  margin: '0 auto',
}) as const;

const h2Style = {
  fontSize: 'clamp(22px, 4vw, 32px)',
  fontWeight: 700,
  color: 'var(--text-primary)',
  textAlign: 'center' as const,
  marginBottom: '8px',
};

const subtitleStyle = {
  textAlign: 'center' as const,
  color: 'var(--text-secondary)',
  fontSize: '15px',
  lineHeight: 1.6,
  maxWidth: '600px',
  margin: '0 auto 32px',
};

const orangeBtn = (big = false) => ({
  padding: big ? '14px 32px' : '10px 24px',
  background: 'var(--accent-orange)',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: big ? '16px' : '14px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
}) as const;

const ghostBtn = {
  padding: '10px 24px',
  background: 'transparent',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default, #d1d5db)',
  borderRadius: '8px',
  fontWeight: 500,
  fontSize: '14px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
} as const;

// ── Data ────────────────────────────────────────────────────────────────────

const ROLES = [
  {
    icon: Calculator,
    title: 'Cost estimator (rozpočtář)',
    text: 'Classify tender items into custom groups for supplier RFQs and internal departments. AI suggests codes from the description — always with probability, never with 100% certainty, always to be reviewed.',
  },
  {
    icon: HardHat,
    title: 'Site preparation (přípravář)',
    text: 'Pour stages (takty), resources, crew composition, schedule. Formwork, reinforcement, concrete works (betonáž) — at single-element or whole-object scope. TOV resource breakdown.',
  },
  {
    icon: Building2,
    title: 'Construction firm / general contractor',
    text: 'Overview across all objects and budgets. Tenders split into groups, ready for supplier RFQs. Built-in calculators for concrete pump (multi-supplier formulas), delivery, and crane.',
  },
  {
    icon: Landmark,
    title: 'Bridges and infrastructure',
    text: 'Bridge elements (piers, abutments, decks, cornices), prestressing, pour stages. Czech norms ČSN EN 13670, ŘSD specifications, OTSKP classification — proof of domain authenticity.',
  },
];

const MODULES = [
  {
    icon: Link,
    title: 'Klasifikátor stavebních prací',
    desc: 'AI classification of tender items. Upload bill of quantities (xlsx), paste one description, or upload documents (PDF, DWG) — the system finds OTSKP candidates and suggests codes with probability. Never with 100% certainty — always for user review.',
    bullets: [
      '3 input methods: bill of quantities (xlsx), free text, documents (PDF, DWG)',
      '2 modes: quick (~2–3 min) or extended with multi-role validation and ČSN check (~5–10 min)',
      'Confidence on every suggestion — AI never 100%, always to be approved by user',
    ],
    cta: 'Open Klasifikátor', href: 'https://klasifikator.stavagent.cz', external: true,
  },
  {
    icon: TableProperties,
    title: 'Registr — tender workshop',
    desc: 'Split a tender into your own groups for supplier RFQs and internal departments. For each item, a TOV breakdown: people, machinery, materials. Built-in calculators for concrete pump, delivery, and crane.',
    bullets: [
      'Classify items into custom groups for supplier RFQs and departments',
      'TOV (technical-organizational breakdown) — every work item split into people, machinery, materials',
      'Built-in calculators: concrete pump (multi-supplier formulas), concrete delivery, crane',
    ],
    cta: 'Open Registr', href: 'https://registry.stavagent.cz', external: true,
  },
  {
    icon: Cpu,
    title: 'Kalkulátor betonáže',
    desc: 'Calculate concrete, formwork, reinforcement, pour stages and resources. Two modes: single-element detail or whole-object plan — both with schedule and Kč/m³ cost.',
    bullets: [
      'Detail prvku — 7 deterministic engines (formwork, reinforcement, pour decision, DIN 18218 lateral pressure, Saul maturity, RCPSP scheduler + PERT, pumping)',
      'Plán objektu — whole-object table with pour stages, resources, Kč/m³',
      '25 formwork systems (DOKA, PERI, ULMA, NOE, traditional), 24 element types, ČSN EN 13670 + TKP 18 + DIN 18218 compliant',
    ],
    cta: 'Open Kalkulátor', href: 'https://kalkulator.stavagent.cz', external: true,
  },
];

const COMING_SOON = {
  icon: FileSearch,
  title: 'Document Analysis',
  badge: 'Coming soon — early access list open',
  desc: 'Technical reports (TZ), structural design, geology, drawings. Cross-document checks: geology → structural → tender. AI extracts key parameters and compares with other documents in the project.',
  bullets: [
    '12+ types of construction documentation (D.1.2 structural, D.1.3 fire safety, C geology…)',
    'Cross-document check: geology → structural → tender',
    'Determinism first: regex extraction (confidence 1.0), AI only as a probability supplement',
  ],
  cta: 'Join early access',
};

const STEPS = [
  {
    icon: Upload,
    title: '1. Klasifikátor',
    text: 'Standalone lookup tool. Paste a bill of quantities (xlsx), a single item, or upload a document (PDF, DWG) — AI suggests OTSKP codes with probability. Always for user review, never with 100% certainty. Output: Excel, CSV.',
  },
  {
    icon: TableProperties,
    title: '2. Registr',
    text: 'Tender workshop. Import your bill of quantities (xlsx), split into custom groups for supplier RFQs and departments. TOV — every work item broken down into people, machinery, materials. Built-in calculators for concrete pump, delivery, and crane.',
  },
  {
    icon: Cpu,
    title: '3. Kalkulátor betonáže',
    text: 'Single-element detail and whole-object plan — concrete, formwork, reinforcement, pour stages, schedule. Resource map (crews, curing time, formwork strike time) available as export for import into TOV in Registr.',
  },
  {
    icon: FileOutput,
    title: '4. Export TOV/DOV',
    text: 'Excel from each module for suppliers and departments. Hyperlinks back to source file preserved. Price and schedule ready for RFQ.',
  },
];

const PILLARS = [
  { icon: Code, title: 'Regex parsing (conf. 1.0)', text: 'Concrete grades C25/30, ČSN norms, dimensions, thicknesses — exact extraction without AI.' },
  { icon: Database, title: 'OTSKP database (conf. 1.0)', text: '17 904 items with verified codes, descriptions and units.' },
  { icon: Brain, title: 'AI only as supplement (conf. 0.6–0.85)', text: 'Gemini Flash + Claude only when regex and DB find no match. Never 100% — always to be reviewed.' },
];

const FAQ = [
  { q: 'Do I need to install anything?', a: 'No. StavAgent is a web application — a browser is enough. No installation, no plugins.' },
  { q: 'Which file formats do you support?', a: 'Excel (.xlsx, .xls) for tenders and bills of quantities. PDF, DWG, JPG for construction documentation.' },
  { q: 'How accurate are the classification results?', a: 'Every candidate from Klasifikátor carries a probability. Regex and OTSKP exact-match have confidence 1.0. AI suggestions are typically 60–85% — never 100%. Always to be reviewed by the user. No hidden hallucinations.' },
  { q: 'How accurate is Kalkulátor betonáže?', a: 'Kalkulátor provides an approximate estimate for budget preparation with typical accuracy ±10–15%. The final detailed design, structural calculation and exact component specification are always performed by the formwork supplier (DOKA / PERI / ULMA / others) based on specific project documentation. For the tender phase and preliminary calculation, this accuracy is sufficient.' },
  { q: 'Does it work for bridges and infrastructure?', a: 'Yes. 24 structural element types (13 bridge + 11 building) including piers, abutments, decks, cornices, foundations and retaining walls. Prestressing, pour stages, MSS (movable scaffolding system) technology. Czech norms ČSN EN, ŘSD specifications, OTSKP classification (17 904 items).' },
  { q: 'Does StavAgent work with catalogs?', a: 'Yes — with OTSKP (Otevřený třídník stavebních prací, the open Czech work-item catalog, 17 904 items). For items not in OTSKP, the AI suggests a code with probability. AI suggestions are always for user review — never with 100% certainty.' },
  { q: 'What is TOV?', a: 'Technical-organizational breakdown (technologicko-organizační rozbor) — for each tender item a split into people / machinery / materials with quantities, prices and rates. In Registr you will find built-in calculators for concrete pump (multi-supplier), concrete delivery, and crane.' },
  { q: 'Can I choose the AI model?', a: 'Yes. Klasifikátor offers 19 models (DeepSeek, Bedrock Claude, Gemini, GPT-4, GLM, Qwen, Grok). Extended mode additionally runs a multi-role validation with 6 expert roles.' },
  { q: 'Can I import the output back into my existing application?', a: 'Yes. The output is Excel (.xlsx) with codes, descriptions, units, quantities and prices. Hyperlinks back to the source file are preserved.' },
  { q: 'Is my data safe?', a: 'Data is stored on EU servers (Google Cloud, Frankfurt). Each user sees only their own projects. Data is not shared with third parties.' },
  { q: 'How much does it cost?', a: 'Open beta — 200 credits free at signup. No credit card, no commitments. During the beta you spend credits only on AI operations; deterministic calculations (regex, OTSKP, calculator) are within the free tier.' },
  { q: 'When will you start charging?', a: 'Paid plans launch in Q3 2026 via Lemon Squeezy (Merchant of Record — no VAT on you, no billing setup on your side). Until then, beta with 200 credits free.' },
];

const STATS = [
  { num: '17 904', label: 'OTSKP items' },
  { num: '24', label: 'element types' },
  { num: '25', label: 'formwork systems' },
  { num: '12+', label: 'documentation types' },
];

// Two real cases — same data as CZ landing, EN copy. Bridge case is public
// (ŘSD tender), retaining wall is anonymized.
const CASES = [
  {
    id: 'so-202-d6',
    badge: 'Public ŘSD tender',
    title: 'SO-202 D6 Karlovy Vary–Olšová Vrata — bridge on road I/6',
    sourceNote: 'Source: TZ PDPS VD-ZDS, VIAPONT s.r.o.',
    inputs: [
      'Bridge on D6 motorway, km 0.900 (2 bridges LM + PM)',
      '6 spans, lengths 15 + 4×20 + 15 m',
      'Double-T prestressed deck, width 10.85 m',
      'Concrete C35/45 XF2, curing class 4',
      '12 cables × 13 strands Y1860, one-sided stressing',
      'Piles Ø 900 mm, depths 7.5–16 m',
    ],
    outputs: [
      'Deck volume:       ~ 350 m³',
      'Formwork area:     ~ 1 210 m²',
      'Falsework:         Top 50 (girder system)',
      'Props:             Staxo 40 (h < 8 m)',
      'Curing:            9 d (XF2 class 4, 15–25 °C)',
      'Prestress:         7 d wait + 2 d stressing + 2 d grouting',
      'Piles:             122 ks, C30/37 XA2',
    ],
    tov: 'TOV: concreters, carpenters (falsework + props), reinforcement crew, stressing crew · concrete pump, crane · concrete, reinforcement, cables, grouting mix',
  },
  {
    id: 'retaining-wall-156',
    badge: 'Real project (anonymized)',
    title: 'Retaining wall — industrial site, 156 m length',
    sourceNote: 'Real geometry · client identification withheld',
    inputs: [
      'Linear retaining wall along a manipulation area',
      'Length 156.4 m',
      'Cross-section (T): stem 1 450 × 250 mm + footing 800 × 300 mm',
      'Visible height 1.75 m + footing 0.3 m',
      'Concrete C30/37 XF4',
    ],
    outputs: [
      'Volume:           94.231 m³',
      'Formwork area:    547.4 m²',
      'Reinforcement:    5.654 t (D12)',
      'Pour stages:      8 segments × 19.5 m',
      'Formwork system:  Framax Xlife (frame)',
      'Crew:             4 workers + 2 pumps',
      'Schedule:         12 working days',
    ],
    tov: 'TOV: concreter × 12 d, carpenter (formwork install/strike), reinforcement crew · concrete pump, crane · concrete 94 m³, reinforcement 5.7 t',
  },
];

// "What StavAgent does NOT do" — translation of
// docs/CALCULATOR_PHILOSOPHY.md §2 (one-to-one, no paraphrase). Same role on
// the page as the Gate 5 CZ block. DO NOT REWORD.
const NEDELA = [
  {
    title: 'Not a final engineering software',
    text: 'For detailed structural design, load calculations and approval documentation → DOKA / PERI / ULMA design teams.',
  },
  {
    title: 'Not a competitor to DOKA Software / PERI EngineeringPad',
    text: 'It is a complementary tool — it prepares the materials for discussion with the engineering team, it does not replace them.',
  },
  {
    title: 'Not an inventory tool down to the last screw',
    text: 'The calculator computes main systems and consumable percentages; specific screws, anchors, custom adapters are handled by the supplier.',
  },
  {
    title: 'Not a guarantee of an exact price',
    text: 'The final price comes from the supplier’s structural design + current price list + project documentation. The calculator provides an approximate estimate for the tender phase.',
  },
];

// Translation of CALCULATOR_PHILOSOPHY.md §5.1 — the mandatory disclaimer.
const CALCULATOR_DISCLAIMER = 'This calculator provides an approximate estimate for budget preparation with typical accuracy ±10–15%. The final detailed design, structural calculation and exact component specification are always performed by the formwork supplier (DOKA / PERI / ULMA / others) based on specific project documentation. For the tender phase and preliminary calculation, this accuracy is sufficient.';

// Translation of §7.2 value line — "approximate but very accurate" framing.
const VALUE_LINE = 'Our value = speed + technological correctness + vendor-neutrality in the pre-tender estimation phase.';

// ── Component ───────────────────────────────────────────────────────────────
export default function LandingPageEn() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useHeadMeta({
    canonical: 'https://www.stavagent.cz/en/',
    hreflangs: {
      cs: 'https://www.stavagent.cz/',
      en: 'https://www.stavagent.cz/en/',
    },
  });

  // Propagate locale to <html lang> and <title>. The static index.html ships
  // with lang="cs" + Czech title (since CZ is the primary locale); this
  // useEffect overrides them at mount and the prerender captures the
  // post-mount state for /en/. Cleanup restores the defaults so a SPA
  // navigation back to / doesn't leave the EN lang/title sticky.
  useEffect(() => {
    const prevLang = document.documentElement.lang;
    const prevTitle = document.title;
    document.documentElement.lang = 'en';
    document.title = 'From estimate to working plan. | StavAgent';
    return () => {
      document.documentElement.lang = prevLang;
      document.title = prevTitle;
    };
  }, []);

  const goCta = () => navigate(isAuthenticated ? '/portal' : '/register');
  const goLogin = () => navigate(isAuthenticated ? '/cabinet' : '/login');

  return (
    <div lang="en" style={{ minHeight: '100vh', background: 'var(--app-bg-concrete)', overflowX: 'hidden' }}>

      {/* ── 0. NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(176,178,181,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)',
        padding: '0 24px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/assets/logo.svg" alt="StavAgent" style={{ width: 40, height: 40 }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>StavAgent</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ ...ghostBtn, border: 'none', padding: '4px 8px', fontSize: 13 }} onClick={() => scrollTo('modules')}>Modules</span>
          <span style={{ ...ghostBtn, border: 'none', padding: '4px 8px', fontSize: 13 }} onClick={() => scrollTo('who-for')}>Who for</span>
          <span style={{ ...ghostBtn, border: 'none', padding: '4px 8px', fontSize: 13 }} onClick={() => scrollTo('how-it-works')}>How it works</span>
          <span style={{ ...ghostBtn, border: 'none', padding: '4px 8px', fontSize: 13 }} onClick={() => scrollTo('pricing')}>Pricing</span>
          <span style={{ ...ghostBtn, border: 'none', padding: '4px 8px', fontSize: 13 }} onClick={() => navigate('/en/team')}>About</span>
          <a href="/" style={{ ...ghostBtn, border: 'none', padding: '4px 8px', fontSize: 13, textDecoration: 'none' }}>Česky</a>
          <button onClick={goLogin} style={ghostBtn}>
            {isAuthenticated ? <><User size={16} />{user?.name || 'Cabinet'}</> : <><LogIn size={16} />Log in</>}
          </button>
          <button onClick={goCta} style={orangeBtn()}>
            Try free <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {/* ── 1. HERO ── */}
      <section style={{ ...sectionStyle('800px', '72px'), textAlign: 'center' }}>
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 700,
          color: 'var(--text-primary)', lineHeight: 1.15, marginBottom: 16,
        }}>
          From estimate to <span style={{ color: 'var(--accent-orange)' }}>working plan.</span>
        </h1>
        <p style={{
          fontSize: 'clamp(15px, 2.5vw, 18px)', color: 'var(--text-secondary)',
          lineHeight: 1.6, maxWidth: 640, margin: '0 auto 28px',
        }}>
          Engineering decisions for monolithic concrete works in Czech and Slovak markets. Approximate calculation — but very accurate. Built by a working construction estimator.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <button onClick={goCta} style={orangeBtn(true)}>
            Try free — 200 credits <ArrowRight size={18} />
          </button>
          <a href="mailto:info@stavagent.cz" style={{ ...ghostBtn, textDecoration: 'none' }}>
            <Mail size={16} /> Book a 20-min demo
          </a>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          {['Web-based — no installation', 'Czech construction norms (ČSN, OTSKP, TKP)', '200 credits free at signup'].map(t => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
              <Check size={14} style={{ color: 'var(--accent-orange)' }} /> {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── 2. SOCIAL PROOF BAR ── */}
      <div style={{ textAlign: 'center', padding: '0 24px 32px' }}>
        <span style={{
          display: 'inline-block', padding: '8px 20px', borderRadius: 20,
          background: 'var(--data-surface)', fontSize: 13, fontWeight: 600,
          color: 'var(--text-secondary)',
        }}>
          17&nbsp;904 items in the OTSKP database
        </span>
      </div>

      {/* ── 3. WHO IT'S FOR ── */}
      <section id="who-for" style={sectionStyle()}>
        <h2 style={h2Style}>Who StavAgent is for</h2>
        <div style={{ height: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {ROLES.map(r => (
            <div key={r.title} style={card}>
              <r.icon size={28} style={{ color: 'var(--accent-orange)', marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{r.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. MODULES ── */}
      <section id="modules" style={sectionStyle()}>
        <h2 style={h2Style}>What StavAgent does</h2>
        <p style={subtitleStyle}>
          Three connected tools for the entire estimator workflow.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {MODULES.map((m, i) => (
            <div key={i} style={{ ...card, display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <m.icon size={28} style={{ color: 'var(--accent-orange)', flexShrink: 0 }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{m.title}</h3>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{m.desc}</p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {m.bullets.map((b, j) => (
                  <li key={j} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 4 }}>{b}</li>
                ))}
              </ul>
              <div>
                <button
                  onClick={() => { m.external ? openExternal(m.href) : navigate(m.href); }}
                  style={{
                    ...orangeBtn(), background: 'transparent',
                    color: 'var(--accent-orange)',
                    border: '1px solid var(--accent-orange)',
                    padding: '8px 16px', fontSize: 13,
                  }}
                >
                  {m.cta} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Coming-soon teaser */}
        <div style={{ marginTop: 32 }}>
          <div style={{
            padding: '8px 14px', display: 'inline-block',
            background: 'rgba(255,159,28,0.08)',
            border: '1px solid var(--accent-orange)',
            borderRadius: 16, fontSize: 12, fontWeight: 600,
            color: 'var(--accent-orange)', textTransform: 'uppercase', letterSpacing: 0.5,
            marginBottom: 12,
          }}>
            {COMING_SOON.badge}
          </div>
          <div style={{
            ...card,
            border: '1px dashed var(--accent-orange)',
            background: 'rgba(255,159,28,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <COMING_SOON.icon size={28} style={{ color: 'var(--accent-orange)', flexShrink: 0 }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {COMING_SOON.title}
              </h3>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 12px' }}>
              {COMING_SOON.desc}
            </p>
            <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
              {COMING_SOON.bullets.map((b, j) => (
                <li key={j} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 4 }}>{b}</li>
              ))}
            </ul>
            <a
              href="mailto:info@stavagent.cz?subject=Early%20access%20%E2%80%94%20Document%20Analysis&body=Hi%2C%20I%27d%20like%20to%20join%20early%20access%20for%20Document%20Analysis."
              style={{
                ...orangeBtn(),
                textDecoration: 'none', background: 'transparent',
                color: 'var(--accent-orange)',
                border: '1px solid var(--accent-orange)',
                padding: '8px 16px', fontSize: 13,
              }}
            >
              {COMING_SOON.cta} <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* ── 5. HOW IT WORKS ── */}
      <section id="how-it-works" style={sectionStyle()}>
        <h2 style={h2Style}>How it works</h2>
        <div style={{ height: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ ...card, textAlign: 'center' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--accent-orange)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 18, margin: '0 auto 16px',
              }}>
                {i + 1}
              </div>
              <s.icon size={28} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. TRUST BLOCK (3 pillars + quote) ── */}
      <section style={sectionStyle()}>
        <h2 style={h2Style}>Why deterministic calculations, not just AI</h2>
        <div style={{ height: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 24 }}>
          {PILLARS.map((p, i) => (
            <div key={i} style={card}>
              <p.icon size={28} style={{ color: 'var(--accent-orange)', marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{p.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{p.text}</p>
            </div>
          ))}
        </div>
        <blockquote style={{
          maxWidth: 700, margin: '0 auto', padding: '20px 24px',
          borderLeft: '4px solid var(--accent-orange)',
          background: 'var(--data-surface)', borderRadius: '0 8px 8px 0',
          fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, fontStyle: 'italic',
        }}>
          Every result carries a confidence score. You always know what is a deterministic calculation (100%) and what is an AI suggestion (60–85%). No hidden hallucinations — just transparent calculation with an audit trail.
        </blockquote>
      </section>

      {/* ── 7. REAL EXAMPLES ── */}
      <section style={sectionStyle('900px')}>
        <h2 style={h2Style}>Real examples</h2>
        <p style={subtitleStyle}>
          Two real cases: a public ŘSD tender and an anonymized project from portfolio.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {CASES.map((c) => (
            <div key={c.id} style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-default)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <span style={{
                  display: 'inline-block', alignSelf: 'flex-start',
                  padding: '2px 10px', borderRadius: 12,
                  background: 'rgba(255,159,28,0.10)',
                  color: 'var(--accent-orange)',
                  fontSize: 11, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {c.badge}
                </span>
                <h3 style={{
                  fontSize: 16, fontWeight: 700,
                  color: 'var(--text-primary)', margin: '4px 0 0',
                }}>
                  {c.title}
                </h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {c.sourceNote}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', minHeight: 200 }}>
                <div style={{
                  padding: '20px 24px',
                  borderRight: '1px solid var(--border-default)',
                  background: 'var(--data-surface)',
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
                  }}>
                    Input
                  </div>
                  <ul style={{
                    margin: 0, padding: 0, listStyle: 'none',
                    fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7,
                  }}>
                    {c.inputs.map((line, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ padding: '20px 24px' }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
                  }}>
                    What StavAgent computed
                  </div>
                  <pre style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                    color: 'var(--text-primary)', lineHeight: 1.7, margin: 0,
                    whiteSpace: 'pre-wrap', background: 'none',
                  }}>
{c.outputs.join('\n')}
                  </pre>
                </div>
              </div>

              <div style={{
                padding: '12px 24px',
                borderTop: '1px solid var(--border-default)',
                background: 'var(--data-surface)',
                fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55,
              }}>
                {c.tov}
              </div>

              <div style={{
                padding: '12px 24px',
                borderTop: '1px solid var(--border-default)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: 8,
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Export TOV/DOV → Excel for RFQs and departments
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-orange)' }}>
                  30 minutes instead of half a day in Excel
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Calculator disclaimer — translation of CALCULATOR_PHILOSOPHY.md §5.1 */}
        <div style={{
          marginTop: 24, padding: '16px 20px',
          borderLeft: '4px solid var(--accent-orange)',
          background: 'var(--data-surface)',
          borderRadius: '0 8px 8px 0',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <Info size={20} style={{ color: 'var(--accent-orange)', flexShrink: 0, marginTop: 2 }} />
          <p style={{
            margin: 0, fontSize: 13,
            color: 'var(--text-secondary)', lineHeight: 1.65, fontStyle: 'italic',
          }}>
            {CALCULATOR_DISCLAIMER}
          </p>
        </div>
      </section>

      {/* ── 7b. WHAT STAVAGENT DOES NOT DO ── */}
      <section id="not-doing" style={sectionStyle('900px')}>
        <h2 style={h2Style}>What StavAgent does NOT do</h2>
        <p style={subtitleStyle}>
          Calculator boundaries. What the supplier (DOKA / PERI / ULMA) owns, and what we own.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: 16,
        }}>
          {NEDELA.map((n, i) => (
            <div key={i} style={{
              ...card,
              padding: '20px 24px',
              borderTop: '3px solid var(--accent-orange)',
            }}>
              <h3 style={{
                fontSize: 15, fontWeight: 700,
                color: 'var(--text-primary)', margin: '0 0 8px',
              }}>
                {n.title}
              </h3>
              <p style={{
                fontSize: 13, color: 'var(--text-secondary)',
                lineHeight: 1.6, margin: 0,
              }}>
                {n.text}
              </p>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 20, padding: '14px 20px',
          background: 'var(--data-surface)',
          borderRadius: 8,
          fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
          textAlign: 'center',
        }}>
          {VALUE_LINE}
        </div>
      </section>

      {/* ── 8. ENGINEERING UNDER THE HOOD ── */}
      <section id="engineering" style={sectionStyle()}>
        <h2 style={h2Style}>Engineering under the hood</h2>
        <div style={{ height: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20, marginBottom: 24 }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, color: 'var(--accent-orange)' }}>{s.num}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          Norms: ČSN EN 13670, DIN 18218 (formwork lateral pressure), TKP 18 (concrete works curing), Saul maturity model<br />
          Deterministic core: regex + database (confidence 1.0)<br />
          AI layer: Gemini Flash + Claude Sonnet (confidence 0.6–0.85, always to be reviewed)<br />
          Infrastructure: Google Cloud (EU, Frankfurt) + Vercel
        </div>
      </section>

      {/* ── 9. PRICING ── */}
      <section id="pricing" style={sectionStyle('800px')}>
        <h2 style={h2Style}>Pricing</h2>
        <p style={subtitleStyle}>
          Open beta. 200 credits free at signup.
        </p>

        <div style={{
          ...card, textAlign: 'center', marginBottom: 24,
          border: '2px solid var(--accent-orange)',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Sign up: 200 credits FREE
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.5 }}>
            Just register and you can start immediately. No credit card, no commitments.
          </p>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Open beta &mdash; paid plans launch in Q3 2026 via Lemon Squeezy (Merchant of Record).
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={goCta} style={orangeBtn(true)}>
            Start free &mdash; 200 credits <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── 10. FAQ ── */}
      <section id="faq" style={sectionStyle('800px')}>
        <h2 style={h2Style}>Frequently asked questions</h2>
        <div style={{ height: 24 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAQ.map((item, i) => (
            <div key={i} style={{
              ...card, padding: 0, cursor: 'pointer',
              border: openFaq === i ? '1px solid var(--accent-orange)' : '1px solid transparent',
            }}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 20px',
              }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{item.q}</span>
                {openFaq === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
              {openFaq === i && (
                <div style={{
                  padding: '0 20px 16px',
                  fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6,
                }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 11. CLOSING CTA ── */}
      <section style={{ ...sectionStyle('700px'), textAlign: 'center' }}>
        <h2 style={{ ...h2Style, marginBottom: 12 }}>
          Save hours of work on construction documentation.
        </h2>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 24 }}>
          Try StavAgent free &mdash; 200 credits at signup.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={goCta} style={orangeBtn(true)}>
            Start free <ArrowRight size={18} />
          </button>
          <a href="mailto:info@stavagent.cz" style={{ ...ghostBtn, textDecoration: 'none' }}>
            <Mail size={16} /> Book a 20-min demo
          </a>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          or email: <a href="mailto:info@stavagent.cz" style={{ color: 'var(--accent-orange)', textDecoration: 'none' }}>info@stavagent.cz</a>
        </p>
      </section>

      {/* ── 12. FOOTER ── */}
      <footer style={{
        borderTop: '1px solid var(--border-default)',
        padding: '48px 24px 24px',
        maxWidth: 1000, margin: '0 auto',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 32, marginBottom: 32,
        }}>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Modules</h4>
            {['Klasifikátor', 'Registr', 'Kalkulátor betonáže', 'Document Analysis (coming soon)'].map(t => (
              <div key={t} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, cursor: 'pointer' }} onClick={() => scrollTo('modules')}>{t}</div>
            ))}
          </div>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Who for</h4>
            {['Cost estimator', 'Site preparer', 'Construction firm', 'Bridges & infra'].map(t => (
              <div key={t} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, cursor: 'pointer' }} onClick={() => scrollTo('who-for')}>{t}</div>
            ))}
            <div style={{ height: 8 }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, cursor: 'pointer' }} onClick={() => scrollTo('how-it-works')}>How it works</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, cursor: 'pointer' }} onClick={() => scrollTo('pricing')}>Pricing</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, cursor: 'pointer' }} onClick={() => scrollTo('faq')}>FAQ</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, cursor: 'pointer' }} onClick={() => navigate('/en/team')}>About the Founder</div>
          </div>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Contact</h4>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <a href="mailto:info@stavagent.cz" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>info@stavagent.cz</a>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              <a href="https://www.linkedin.com/in/alexander-prokopov" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>LinkedIn</a>
            </div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Language</h4>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <a href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Česky</a>
            </div>
          </div>
        </div>
        <div style={{
          textAlign: 'center', paddingTop: 16,
          borderTop: '1px solid var(--border-default)',
          fontSize: 13, color: 'var(--text-muted)',
        }}>
          &copy; {new Date().getFullYear()} StavAgent. All rights reserved.
        </div>
      </footer>

    </div>
  );
}
