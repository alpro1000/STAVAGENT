/**
 * Landing Page - Public entry point for stavagent.cz
 * Schema v2.0 — 12 sections, credit pricing, AI-last philosophy
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, LogIn, User, Calculator, HardHat, Building2, Landmark,
  TableProperties, FileSearch, Link, Cpu, LayoutDashboard, Upload,
  Search, FileOutput, Database, Brain, ChevronDown, ChevronUp,
  Check, Mail, ExternalLink, Code,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
  { icon: Calculator, title: 'Rozpočtář', text: 'Kontrola soupisu prací, párování kataložních kódů, hledání chyb v cenách a množstvích. Export do Excelu jedním klikem.' },
  { icon: HardHat, title: 'Přípravář stavby', text: 'Kalkulace monolitického betonu — bednění, výztuž, betonáž, zrání. Harmonogram prací a odhad nákladů Kč/m³.' },
  { icon: Building2, title: 'Stavební firma / generální dodavatel', text: 'Přehled přes všechny objekty a rozpočty na jednom místě. Registr smět, porovnání verzí, analýza dokumentace.' },
  { icon: Landmark, title: 'Mosty a infrastruktura', text: 'OTSKP klasifikace, mostní prvky (pilíře, opěry, mostovka, římsy), železniční stavby. Normy ČSN EN, ŘSD předpisy.' },
];

const MODULES = [
  {
    icon: TableProperties, title: 'Registr rozpočtů',
    desc: 'Nahrajte Excel s rozpočtem — systém automaticky rozparsuje pozice, roztřídí do skupin prací a připraví přehlednou strukturu pro další práci.',
    bullets: ['Import xlsx — automatická detekce struktury smety', 'Skupiny prací: Piloty, Základy, Bednění, Výztuž, Beton a další', 'Export do Excelu s hypertextovými odkazy zpět na zdrojový soubor'],
    cta: 'Vyzkoušet registr', href: 'https://registry.stavagent.cz', external: true,
  },
  {
    icon: FileSearch, title: 'AI analýza stavební dokumentace',
    desc: 'Nahrajte TZ, statiku, geologii nebo výkres — systém extrahuje klíčové parametry a porovná je s ostatními dokumenty v projektu.',
    note: 'Modul je v přípravě. Brzy k dispozici.',
    bullets: ['12+ typů stavební dokumentace (D.1.2 statika, D.1.3 PBŘS, D.1.4 profese, C geologie…)', 'Cross-document kontrola: geologie → statika → rozpočet', 'Determinismus: regex extrakce (conf. 1.0) první, AI pouze jako doplněk'],
    cta: 'Brzy k dispozici', href: '/portal/analysis', external: false, comingSoon: true,
  },
  {
    icon: Link, title: 'Párování s kataložními kódy',
    desc: 'Máte soupis bez kódů, nebo s nestandardními kódy? Systém přiřadí správné kódy z katalogových databází včetně OTSKP.',
    note: 'Modul je v aktivním vývoji. Aktuálně podporuje OTSKP databázi (17 904 položek). Další katalogy připravujeme.',
    bullets: ['17 904 položek OTSKP v lokální databázi (confidence = 1.0)', 'Fulltextové vyhledávání + AI fallback pro nestandardní popisy', 'Confidence skóre u každého výsledku: víte, jak jistý je návrh'],
    cta: 'Více informací', href: 'https://klasifikator.stavagent.cz', external: true,
  },
  {
    icon: Cpu, title: 'Kalkulátor betonáže',
    desc: 'Detailní výpočet pro jeden konstrukční prvek: bednění, výztuž, betonáž, zrání betonu, harmonogram a potřeba čerpadel.',
    bullets: ['7 výpočetních jader: bednění → výztuž → betonáž → zrání → harmonogram → PERT → čerpadla', 'Metoda zralosti (Saul: M = Σ(T+10)×Δt) pro řízení odbedňování', 'Odhad crew (počet pracovníků) a směnnosti automaticky z objemu'],
    cta: 'Spustit kalkulaci', href: 'https://kalkulator.stavagent.cz/planner', external: true,
  },
  {
    icon: LayoutDashboard, title: 'Monolit Planner — plánování monolitických prací',
    desc: 'Kompletní přehled monolitických prací na stavebním objektu: všechny prvky, bednění, výztuž, harmonogram a náklady na jednom místě.',
    bullets: ['25 systémů bednění (DOKA, PERI, ULMA, NOE, tradiční) — výběr podle rozměrů', '21 typů konstrukčních prvků (9 mostních + 11 pozemních + 1 obecný)', 'Harmonogram prací, kalkulace Kč/m³ a export do Excelu'],
    cta: 'Otevřít planner', href: 'https://kalkulator.stavagent.cz', external: true,
  },
];

const STEPS = [
  { icon: Upload, title: 'Nahrajte soubor', text: 'Excel (.xlsx) nebo PDF s rozpočtem, soupisem prací nebo technickou dokumentací.' },
  { icon: Search, title: 'Systém analyzuje', text: 'Automatická detekce formátu, rozparsování pozic, kontrola parametrů. Deterministické jádro: regex parsing (confidence 1.0) → databázový lookup → AI doplnění (confidence 0.7) s transparentním skóre.' },
  { icon: FileOutput, title: 'Výstup do minuty', text: 'Analyzovaný dokument, strukturovaný přehled, export do Excelu. Každý výsledek má confidence skóre — víte přesně, čemu můžete věřit.' },
];

const PILLARS = [
  { icon: Code, title: 'Regex parsing (conf. 1.0)', text: 'Betony C25/30, normy ČSN, rozměry, tloušťky — přesná extrakce bez AI.' },
  { icon: Database, title: 'OTSKP databáze (conf. 1.0)', text: '17 904 položek s ověřenými kódy, popisy a MJ.' },
  { icon: Brain, title: 'AI jako doplněk (conf. 0.7)', text: 'Gemini Flash pouze když regex a DB nenajdou shodu.' },
];

const PRICING = [
  { name: 'Parsování dokumentu', sub: 'Extrakce dat z PDF/Excel/XML', ai: false, credits: 2 },
  { name: 'AI analýza dokumentu', sub: 'Kompletní analýza s pasportem', ai: true, credits: 10 },
  { name: 'Generování pasportu', sub: 'AI pasport s normami', ai: true, credits: 15 },
  { name: 'Kontrola norem (NKB)', sub: 'Kontrola souladu s ČSN/EN', ai: true, credits: 5 },
  { name: 'NKB poradce', sub: 'AI poradce pro normativní dotazy', ai: true, credits: 8 },
  { name: 'Párování kataložních kódů', sub: 'AI párování položek na kódy', ai: true, credits: 8 },
  { name: 'Klasifikace položek', sub: 'AI klasifikace do skupin prací', ai: true, credits: 5 },
  { name: 'Kalkulace monolitu', sub: 'Výpočet ceny betonových prací', ai: false, credits: 1 },
  { name: 'Kalkulace čerpadla', sub: 'Výpočet nákladů na čerpadlo', ai: false, credits: 1 },
  { name: 'Export do Excel', sub: '', ai: false, credits: 1 },
  { name: 'Export do CSV', sub: '', ai: false, credits: 1 },
  { name: 'Uložení do projektu', sub: '', ai: false, credits: 2 },
  { name: 'Chat zpráva', sub: 'AI odpověď v chatu projektu', ai: true, credits: 3 },
  { name: 'Parsování ceníku betonárny', sub: 'Extrakce cen z PDF ceníku', ai: true, credits: 5 },
  { name: 'Audit rozpočtu', sub: 'Multi-role AI validace', ai: true, credits: 20 },
];

const FAQ = [
  { q: 'Musím něco instalovat?', a: 'Ne. StavAgent je webová aplikace — stačí prohlížeč. Žádná instalace, žádné pluginy.' },
  { q: 'Jaké formáty souborů podporujete?', a: 'Excel (.xlsx, .xls) pro rozpočty a soupisy. PDF pro technickou dokumentaci.' },
  { q: 'Jak přesné jsou výsledky?', a: 'Každý výsledek nese confidence skóre. Deterministické výpočty (regex, databáze OTSKP) mají confidence 1.0. AI doplnění má confidence 0.70. Vždy vidíte, čemu můžete věřit a co je odhad.' },
  { q: 'Funguje to pro mosty a infrastrukturu?', a: 'Ano. Systém obsahuje OTSKP databázi (17 904 položek) a 21 typů konstrukčních prvků včetně mostních (pilíře, opěry, mostovky, římsy). Normy ČSN EN, předpisy ŘSD.' },
  { q: 'Mohu exportovat do KROS?', a: 'Výstup je Excel (.xlsx) kompatibilní s KROS importem. Obsahuje kódy, popisy, MJ, množství a ceny.' },
  { q: 'Jsou moje data v bezpečí?', a: 'Data jsou uložena na serverech v EU (Google Cloud). Každý uživatel vidí pouze své projekty. Data nejsou sdílena s třetími stranami.' },
  { q: 'Kolik to stojí?', a: 'Na start dostanete 200 kreditů zdarma. Poté si můžete dobít kredity za 1 Kč = 10 kreditů. Platíte pouze za operace, které skutečně použijete. Žádné měsíční poplatky.' },
  { q: 'Co je kredit?', a: 'Kredit je interní jednotka. Každá operace má svou cenu v kreditech — od 1 kreditu za export až po 20 kreditů za kompletní AI audit. Přehled cen najdete v ceníku.' },
];

const STATS = [
  { num: '17 904', label: 'položek OTSKP' },
  { num: '21', label: 'typů prvků' },
  { num: '25', label: 'systémů bednění' },
  { num: '12+', label: 'typů dokumentace' },
];

const EXAMPLE_LINES = [
  'Objem:    4 \u00d7 3 \u00d7 1.5 = 18.0 m\u00b3',
  'Bedn\u011bn\u00ed:  2\u00d7(4+3) \u00d7 1.5 = 21.0 m\u00b2',
  'Tlak:     2400 \u00d7 9.81 \u00d7 1.5 = 35 kN/m\u00b2',
  'V\u00fdztu\u017e:   ~130 kg/m\u00b3 = 2.3 t',
  'Beton\u00e1\u017e:  18 m\u00b3, 1 \u010derpadlo, 1 z\u00e1b\u011br',
  'Zr\u00e1n\u00ed:    (15+10)\u00b0C \u00d7 72h = 1800 \u00b0C\u00b7h',
];

// ── Component ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const goCta = () => navigate(isAuthenticated ? '/portal' : '/register');
  const goLogin = () => navigate(isAuthenticated ? '/cabinet' : '/login');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg-concrete)', overflowX: 'hidden' }}>

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
          <span style={{ ...ghostBtn, border: 'none', padding: '4px 8px', fontSize: 13 }} onClick={() => scrollTo('moduly')}>Moduly</span>
          <span style={{ ...ghostBtn, border: 'none', padding: '4px 8px', fontSize: 13 }} onClick={() => scrollTo('pro-koho')}>Pro koho</span>
          <span style={{ ...ghostBtn, border: 'none', padding: '4px 8px', fontSize: 13 }} onClick={() => scrollTo('jak-to-funguje')}>Jak to funguje</span>
          <span style={{ ...ghostBtn, border: 'none', padding: '4px 8px', fontSize: 13 }} onClick={() => scrollTo('cenik')}>Ceník</span>
          <button onClick={goLogin} style={ghostBtn}>
            {isAuthenticated ? <><User size={16} />{user?.name || 'Kabinet'}</> : <><LogIn size={16} />Přihlásit se</>}
          </button>
          <button onClick={goCta} style={orangeBtn()}>
            Vyzkoušet zdarma <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {/* ── 1. HERO ── */}
      <section style={{ ...sectionStyle('800px', '72px'), textAlign: 'center' }}>
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 700,
          color: 'var(--text-primary)', lineHeight: 1.15, marginBottom: 16,
        }}>
          Stavební rozpočty a dokumentace<br />
          <span style={{ color: 'var(--accent-orange)' }}>pod&nbsp;kontrolou</span>
        </h1>
        <p style={{
          fontSize: 'clamp(15px, 2.5vw, 18px)', color: 'var(--text-secondary)',
          lineHeight: 1.6, maxWidth: 600, margin: '0 auto 28px',
        }}>
          Přesné deterministické výpočty tam, kde to jde.
          AI analýza tam, kde pomůže.
          Vždy s transparentním confidence skóre.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          <button onClick={goCta} style={orangeBtn(true)}>
            Vyzkoušet zdarma &mdash; 200 kreditů <ArrowRight size={18} />
          </button>
          <a href="mailto:info@stavagent.cz" style={{ ...ghostBtn, textDecoration: 'none' }}>
            <Mail size={16} /> Domluvit 20min demo
          </a>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          {['Bez instalace \u2014 webov\u00e1 aplikace', '\u010cesk\u00e9 normy (\u010cSN, OTSKP)', '200 kredit\u016f zdarma na start'].map(t => (
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
          17&nbsp;904 položek v databázi OTSKP
        </span>
      </div>

      {/* ── 3. PRO KOHO ── */}
      <section id="pro-koho" style={sectionStyle()}>
        <h2 style={h2Style}>Pro koho je StavAgent</h2>
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

      {/* ── 4. MODULY ── */}
      <section id="moduly" style={sectionStyle()}>
        <h2 style={h2Style}>Co StavAgent umí</h2>
        <p style={subtitleStyle}>
          Pět modulů, které pokrývají celý proces &mdash; od analýzy dokumentů po kalkulaci betonu.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {MODULES.map((m, i) => (
            <div key={i} style={{
              ...card, display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <m.icon size={28} style={{ color: 'var(--accent-orange)', flexShrink: 0 }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{m.title}</h3>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{m.desc}</p>
              {m.note && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  border: '1px solid var(--accent-orange)',
                  background: 'rgba(255,159,28,0.06)',
                  fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
                }}>
                  {m.note}
                </div>
              )}
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {m.bullets.map((b, j) => (
                  <li key={j} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 4 }}>{b}</li>
                ))}
              </ul>
              <div>
                <button
                  onClick={() => { if ((m as any).comingSoon) return; m.external ? openExternal(m.href) : navigate(m.href); }}
                  disabled={(m as any).comingSoon}
                  style={{
                    ...orangeBtn(),
                    background: 'transparent',
                    color: (m as any).comingSoon ? 'var(--text-muted, #9ca3af)' : 'var(--accent-orange)',
                    border: `1px solid ${(m as any).comingSoon ? 'var(--border-default, #d1d5db)' : 'var(--accent-orange)'}`,
                    padding: '8px 16px',
                    fontSize: 13,
                    cursor: (m as any).comingSoon ? 'not-allowed' : 'pointer',
                    opacity: (m as any).comingSoon ? 0.7 : 1,
                  }}
                >
                  {m.cta} {!(m as any).comingSoon && <ArrowRight size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. JAK TO FUNGUJE ── */}
      <section id="jak-to-funguje" style={sectionStyle()}>
        <h2 style={h2Style}>Jak to funguje</h2>
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

      {/* ── 6. BLOK DŮVĚRY ── */}
      <section style={sectionStyle()}>
        <h2 style={h2Style}>Proč deterministické výpočty, ne jen AI</h2>
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
          Každý výsledek nese confidence skóre. Víte přesně, co je deterministický výpočet (100&nbsp;%) a co je AI odhad (70&nbsp;%). Žádné skryté halucinace &mdash; jen transparentní výpočet s auditní stopou.
        </blockquote>
      </section>

      {/* ── 7. PŘÍPAD POUŽITÍ ── */}
      <section style={sectionStyle('800px')}>
        <h2 style={h2Style}>Příklad z praxe</h2>
        <div style={{ height: 24 }} />
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-default)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
              Kalkulace monolitu &mdash; základ pilíře
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', minHeight: 200 }}>
            <div style={{ padding: '20px 24px', borderRight: '1px solid var(--border-default)', background: 'var(--data-surface)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Vstup</div>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                Základ pilíře: 4.0 &times; 3.0 &times; 1.5m<br />
                C30/37, XC2
              </p>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Co systém spočítal</div>
              <pre style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
                color: 'var(--text-primary)', lineHeight: 1.7, margin: 0,
                whiteSpace: 'pre-wrap', background: 'none',
              }}>
{EXAMPLE_LINES.join('\n')}
              </pre>
            </div>
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Kalkulace Kč/m&sup3; + harmonogram + export TOV/DOV</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-orange)' }}>2 minuty (vs. ~1 hodina ručně)</span>
          </div>
          <div style={{ padding: '0 24px 14px' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Příklad je syntetický (založený na reálné logice systému).
            </span>
          </div>
        </div>
      </section>

      {/* ── 8. TECHNOLOGIE POD KAPOTOU ── */}
      <section id="technologie" style={sectionStyle()}>
        <h2 style={h2Style}>Technologie pod kapotou</h2>
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
          Deterministické jádro: regex + databáze (confidence 1.0)<br />
          AI vrstva: Gemini Flash + Claude Sonnet (confidence 0.7)<br />
          Infrastruktura: Google Cloud + Vercel
        </div>
      </section>

      {/* ── 9. CENÍK ── */}
      <section id="cenik" style={sectionStyle('800px')}>
        <h2 style={h2Style}>Ceník</h2>
        <p style={subtitleStyle}>
          Platíte pouze za to, co skutečně použijete. Žádné měsíční poplatky, žádné závazky.
        </p>

        {/* Free tier box */}
        <div style={{
          ...card, textAlign: 'center', marginBottom: 24,
          border: '2px solid var(--accent-orange)',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Na start: 200 kreditů ZDARMA
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.5 }}>
            Stačí se zaregistrovat a můžete hned začít. Žádná kreditní karta, žádné závazky.
          </p>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-orange)' }}>
            Potom: 1 Kč = 10 kreditů
          </div>
        </div>

        {/* Pricing table */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto',
            padding: '12px 20px', borderBottom: '2px solid var(--border-default)',
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            <span>Operace</span>
            <span style={{ textAlign: 'center', width: 40 }}>AI</span>
            <span style={{ textAlign: 'right', width: 60 }}>Kredity</span>
          </div>
          {PRICING.map((p, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto',
              padding: '10px 20px', alignItems: 'center',
              borderBottom: i < PRICING.length - 1 ? '1px solid var(--border-default)' : 'none',
              background: i % 2 === 0 ? 'var(--data-surface)' : 'transparent',
            }}>
              <div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</div>
                {p.sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.sub}</div>}
              </div>
              <span style={{ textAlign: 'center', width: 40 }}>
                {p.ai && <span style={{
                  display: 'inline-block', padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(255,159,28,0.12)', color: '#b45309',
                  fontSize: 10, fontWeight: 600,
                }}>AI</span>}
              </span>
              <span style={{ textAlign: 'right', width: 60, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                {p.credits}
              </span>
            </div>
          ))}
        </div>

        {/* Usage example */}
        <div style={{ ...card, marginTop: 20, background: 'var(--data-surface)' }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            Typický pracovní den rozpočtáře:
          </h4>
          <pre style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
            color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0,
            whiteSpace: 'pre-wrap', background: 'none',
          }}>
{`2\u00d7 parsov\u00e1n\u00ed dokumentu        =   4 kredit\u016f
1\u00d7 AI anal\u00fdza                 =  10 kredit\u016f
1\u00d7 kalkulace monolitu         =   1 kredit
2\u00d7 export do Excel            =   2 kredity
1\u00d7 ulo\u017een\u00ed do projektu        =   2 kredity
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
Celkem:                          19 kredit\u016f

200 kredit\u016f zdarma = cca 10 pracovn\u00edch dn\u00ed.
Potom: 19 kredit\u016f/den = 1,90 K\u010d/den.`}
          </pre>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={goCta} style={orangeBtn(true)}>
            Začít zdarma &mdash; 200 kreditů <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── 10. FAQ ── */}
      <section id="faq" style={sectionStyle('800px')}>
        <h2 style={h2Style}>Často kladené otázky</h2>
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

      {/* ── 11. CTA ZÁVĚREČNÝ ── */}
      <section style={{ ...sectionStyle('700px'), textAlign: 'center' }}>
        <h2 style={{ ...h2Style, marginBottom: 12 }}>
          Ušetřete hodiny práce se stavební dokumentací.
        </h2>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 24 }}>
          Vyzkoušejte StavAgent zdarma &mdash; 200 kreditů na start.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={goCta} style={orangeBtn(true)}>
            Začít zdarma <ArrowRight size={18} />
          </button>
          <a href="mailto:info@stavagent.cz" style={{ ...ghostBtn, textDecoration: 'none' }}>
            <Mail size={16} /> Domluvit 20min demo
          </a>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          nebo napište: <a href="mailto:info@stavagent.cz" style={{ color: 'var(--accent-orange)', textDecoration: 'none' }}>info@stavagent.cz</a>
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
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Moduly</h4>
            {['Registr rozpo\u010dt\u016f', 'Anal\u00fdza dokument\u016f', 'Katalo\u017en\u00ed k\u00f3dy', 'Kalkul\u00e1tor', 'Monolit Planner'].map(t => (
              <div key={t} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, cursor: 'pointer' }} onClick={() => scrollTo('moduly')}>{t}</div>
            ))}
          </div>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pro koho</h4>
            {['Rozpo\u010dt\u00e1\u0159', 'P\u0159\u00edprav\u00e1\u0159', 'Stavebn\u00ed firma', 'Mosty a infra'].map(t => (
              <div key={t} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, cursor: 'pointer' }} onClick={() => scrollTo('pro-koho')}>{t}</div>
            ))}
            <div style={{ height: 8 }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, cursor: 'pointer' }} onClick={() => scrollTo('jak-to-funguje')}>Jak to funguje</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, cursor: 'pointer' }} onClick={() => scrollTo('cenik')}>Ceník</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, cursor: 'pointer' }} onClick={() => scrollTo('faq')}>FAQ</div>
          </div>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kontakt</h4>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <a href="mailto:info@stavagent.cz" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>info@stavagent.cz</a>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>LinkedIn</div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Právní</h4>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Obchodní podmínky</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Ochrana osobních údajů</div>
          </div>
        </div>
        <div style={{
          textAlign: 'center', paddingTop: 16,
          borderTop: '1px solid var(--border-default)',
          fontSize: 13, color: 'var(--text-muted)',
        }}>
          &copy; {new Date().getFullYear()} StavAgent. Všechna práva vyhrazena.
        </div>
      </footer>

    </div>
  );
}
