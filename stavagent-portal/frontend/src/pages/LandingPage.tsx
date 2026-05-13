/**
 * Landing Page - Public entry point for stavagent.cz
 * Schema v2.0 — 12 sections, credit pricing, AI-last philosophy
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, LogIn, User, Calculator, HardHat, Building2, Landmark,
  TableProperties, FileSearch, Link, Cpu, Upload,
  Search, FileOutput, Database, Brain, ChevronDown, ChevronUp,
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
  { icon: Calculator, title: 'Rozpočtář', text: 'Klasifikace pozic do vlastních skupin pro poptávky a oddělení. AI návrh kódů z popisu — vždy ke schválení. Export do Excelu jedním klikem.' },
  { icon: HardHat, title: 'Přípravář monolitu', text: 'Takty, zdroje, brigády, harmonogram. Bednění, výztuž, betonáž — na úrovni jednoho prvku nebo celého objektu. TOV s resursní mapou.' },
  { icon: Building2, title: 'Stavební firma / generální dodavatel', text: 'Přehled přes všechny objekty a rozpočty. Rozpočty rozdělené do skupin, ready k poptávkám. Vestavěné kalkulátory čerpadla betonu, dopravy a jeřábu.' },
  { icon: Landmark, title: 'Mosty a infrastruktura', text: 'Mostní prvky (pilíře, opěry, mostovky, římsy), předpětí, takty betonáže. Normy ČSN EN, předpisy ŘSD, OTSKP klasifikace.' },
];

const MODULES = [
  {
    icon: Link, title: 'Klasifikátor stavebních prací',
    desc: 'AI klasifikace pozic. Vložte výkaz výměr, jednu položku, nebo nahrajte dokument — systém najde kandidáty z OTSKP a navrhne kódy s pravděpodobností. Nikdy ne se 100% jistotou — vždy ke schválení.',
    bullets: [
      '3 vstupy: výkaz výměr (xlsx), ručně text, dokumenty (PDF, DWG)',
      '2 režimy: rychlý (~2–3 min) nebo rozšířený s multi-role validací a ČSN kontrolou (~5–10 min)',
      'Confidence u každého návrhu — AI nikdy ne 100%, vždy ke schválení uživatelem',
    ],
    cta: 'Otevřít Klasifikátor', href: 'https://klasifikator.stavagent.cz', external: true,
  },
  {
    icon: TableProperties, title: 'Registr — pracovní rozbor rozpočtu',
    desc: 'Rozpočet rozdělíte do vlastních skupin pro poptávky a oddělení. Pro každou položku rozbor TOV: lidé, stroje, materiály. Vestavěné kalkulátory čerpadla betonu, dopravy betonu a jeřábu.',
    bullets: [
      'Klasifikace pozic do vlastních skupin pro poptávky a oddělení',
      'TOV — rozbor každé práce: lidé, stroje, materiály',
      'Vestavěné kalkulátory: čerpadlo betonu (multi-supplier formuly), doprava betonu, jeřáb',
    ],
    cta: 'Otevřít Registr', href: 'https://registry.stavagent.cz', external: true,
  },
  {
    icon: Cpu, title: 'Kalkulátor betonáže',
    desc: 'Spočítejte beton, bednění, výztuž, takty a zdroje. Dva režimy: detail jednoho prvku, nebo plán celého objektu — vše s harmonogramem a kalkulací Kč/m³.',
    bullets: [
      'Detail prvku — 7 výpočetních jader (bednění, výztuž, betonáž, zrání, harmonogram, PERT, čerpadla)',
      'Plán objektu — tabulka všech prvků s takty, zdroji a kalkulací Kč/m³',
      '25 systémů bednění (DOKA, PERI, ULMA, NOE, tradiční), 24 typů prvků',
    ],
    cta: 'Otevřít Kalkulátor', href: 'https://kalkulator.stavagent.cz', external: true,
  },
];

// Modul "v přípravě" — Analýza dokumentace. Renderuje se jako oddělený
// teaser blok pod sekcí Moduly, s lead-gen formulářem na early access.
// Plná implementace formuláře: Gate 5 v3.2 plánu (samostatný commit).
const COMING_SOON = {
  icon: FileSearch,
  title: 'Analýza stavební dokumentace',
  badge: 'V přípravě — early access',
  desc: 'TZ, statika, geologie, výkresy. Cross-document kontrola: geologie → statika → rozpočet. AI extrakce klíčových parametrů + porovnání s ostatními dokumenty v projektu.',
  bullets: [
    '12+ typů stavební dokumentace (D.1.2 statika, D.1.3 PBŘS, C geologie…)',
    'Cross-document kontrola: geologie → statika → rozpočet',
    'Determinismus first: regex extrakce (conf. 1.0), AI pouze jako doplněk s pravděpodobností',
  ],
  cta: 'Přidat se do early access',
};

const STEPS = [
  {
    icon: Upload,
    title: '1. Klasifikátor',
    text: 'Standalone lookup nástroj. Vložíte výkaz výměr (xlsx), jednu položku, nebo nahrajete dokument (PDF, DWG) — AI navrhne kódy z OTSKP s pravděpodobností. Vždy ke schválení uživatelem, nikdy se 100% jistotou. Výstup: Excel, CSV.',
  },
  {
    icon: TableProperties,
    title: '2. Registr',
    text: 'Pracovní workshop přípraváře. Importujete rozpočet (xlsx), rozdělíte do vlastních skupin pro poptávky a oddělení. TOV — rozbor každé práce na lidé, stroje, materiály. Vestavěné kalkulátory čerpadla betonu, dopravy betonu a jeřábu.',
  },
  {
    icon: Cpu,
    title: '3. Kalkulátor betonáže',
    text: 'Detail prvku i plán celého objektu — beton, bednění, výztuž, takty, harmonogram. Resursní mapa (brigády, doba zrání, doba odbedňování) je k dispozici jako export pro import do TOV v Registru.',
  },
  {
    icon: FileOutput,
    title: '4. Export TOV/DOV',
    text: 'Z každého modulu Excel pro dodavatele a oddělení. Hypertextové odkazy zpět na zdrojový soubor zachovány. Cena a harmonogram připravené k poptávce.',
  },
];

const PILLARS = [
  { icon: Code, title: 'Regex parsing (conf. 1.0)', text: 'Betony C25/30, normy ČSN, rozměry, tloušťky — přesná extrakce bez AI.' },
  { icon: Database, title: 'OTSKP databáze (conf. 1.0)', text: '17 904 položek s ověřenými kódy, popisy a MJ.' },
  { icon: Brain, title: 'AI jako doplněk (conf. 0.7)', text: 'Gemini Flash pouze když regex a DB nenajdou shodu.' },
];
const FAQ = [
  { q: 'Musím něco instalovat?', a: 'Ne. StavAgent je webová aplikace — stačí prohlížeč. Žádná instalace, žádné pluginy.' },
  { q: 'Jaké formáty souborů podporujete?', a: 'Excel (.xlsx, .xls) pro rozpočty a soupisy. PDF, DWG, JPG pro stavební dokumentaci.' },
  { q: 'Jak přesné jsou klasifikační výsledky?', a: 'Každý kandidát z Klasifikátoru nese pravděpodobnost. Regex a OTSKP exact match mají confidence 1,0. AI návrh má pravděpodobnost typicky 60–85 % — nikdy ne 100 %. Vždy ke schválení uživatelem. Žádné skryté halucinace.' },
  { q: 'Jaká je přesnost Kalkulátoru betonáže?', a: 'Kalkulátor poskytuje orientační odhad pro přípravu rozpočtu s přesností typicky ±10–15 %. Finální detailní návrh, statický výpočet a přesnou specifikaci komponentů provádí vždy dodavatel opalubky (DOKA / PERI / ULMA / další) na základě konkrétních projektových podkladů. Pro tendrovou fázi a předběžnou kalkulaci je tato přesnost dostatečná.' },
  { q: 'Funguje to pro mosty a infrastrukturu?', a: 'Ano. 24 typů konstrukčních prvků (13 mostních + 11 pozemních) včetně pilířů, opěr, mostovek, říms, základů a opěrných zdí. Předpětí, takty betonáže, MSS technologie. Normy ČSN EN, předpisy ŘSD, OTSKP klasifikace (17 904 položek).' },
  { q: 'Pracuje StavAgent s katalogy?', a: 'Ano — s OTSKP (Otevřený třídník stavebních prací, 17 904 položek). Pro pozice, které v OTSKP nejsou, doplní AI návrh s pravděpodobností. AI návrh je vždy ke schválení uživatelem — nikdy se 100% jistotou.' },
  { q: 'Co je TOV?', a: 'Technologicko-organizační rozbor — pro každou položku v rozpočtu rozbor na lidé / stroje / materiály s počty, cenami a sazbami. V Registru najdete vestavěné kalkulátory čerpadla betonu (multi-supplier), dopravy betonu a jeřábu.' },
  { q: 'Můžu si zvolit AI model?', a: 'Ano. Klasifikátor nabízí 19 modelů na výběr (DeepSeek, Bedrock Claude, Gemini, GPT-4, GLM, Qwen, Grok). Rozšířený režim navíc spustí multi-role validaci s 6 expertními rolemi.' },
  { q: 'Mohu výstup importovat zpět do své stávající aplikace?', a: 'Ano. Výstup je Excel (.xlsx) s kódy, popisy, MJ, množstvími a cenami. Hypertextové odkazy zpět na zdrojový soubor zachovány.' },
  { q: 'Jsou moje data v bezpečí?', a: 'Data jsou uložena na serverech v EU (Google Cloud, Frankfurt). Každý uživatel vidí pouze své projekty. Data nejsou sdílena s třetími stranami.' },
  { q: 'Kolik to stojí?', a: 'Otevřená beta — 200 kreditů zdarma při registraci. Žádná kreditní karta, žádné závazky. V průběhu bety platíte kredity jen za AI operace, deterministické výpočty (regex, OTSKP, kalkulace) jsou v rámci free tieru.' },
  { q: 'Kdy začnete účtovat?', a: 'Placené plány spustíme v Q3 2026 přes Lemon Squeezy (Merchant of Record — žádné DPH na vás, žádné nastavení fakturace na vaší straně). Do té doby beta s 200 krediti zdarma.' },
];

const STATS = [
  { num: '17 904', label: 'položek OTSKP' },
  { num: '24', label: 'typů prvků' },
  { num: '25', label: 'systémů bednění' },
  { num: '12+', label: 'typů dokumentace' },
];

// Dva re\u00e1ln\u00e9 cases pro sekci "P\u0159\u00edklad z praxe". Case 1 je ve\u0159ejn\u00fd \u0158SD
// tender \u2014 pln\u00e1 transparentnost. Case 2 je re\u00e1ln\u00e1 geometrie, identifikace
// klienta nezve\u0159ejn\u011bna (anonymizov\u00e1no).
const CASES = [
  {
    id: 'so-202-d6',
    badge: 'Ve\u0159ejn\u00fd \u0158SD tender',
    title: 'SO-202 D6 Karlovy Vary\u2013Ol\u0161ov\u00e1 Vrata \u2014 most na sil. I/6',
    sourceNote: 'Zdroj: TZ PDPS VD-ZDS, VIAPONT s.r.o.',
    inputs: [
      'Most na D6, km 0,900 (2 mosty LM + PM)',
      '6 pol\u00ed, rozp\u011bt\u00ed 15 + 4\u00d720 + 15 m',
      'NK dvoutr\u00e1mov\u00e1 p\u0159edpjat\u00e1, \u0161\u00ed\u0159ka 10,85 m',
      'Beton C35/45 XF2, o\u0161et\u0159ov\u00e1n\u00ed t\u0159\u00edda 4',
      '12 kabel\u016f \u00d7 13 lan Y1860, jednostrann\u00e9 nap\u00edn\u00e1n\u00ed',
      'Piloty \u00d8 900 mm, hloubky 7,5\u201316 m',
    ],
    outputs: [
      'Mostovka:       ~ 350 m\u00b3',
      'Plocha bedn\u011bn\u00ed: ~ 1 210 m\u00b2',
      'Skru\u017e:          Top 50 (nosn\u00edkov\u00e9)',
      'Stojky:         Staxo 40 (h < 8 m)',
      'O\u0161et\u0159ov\u00e1n\u00ed:     9 d (XF2 t\u0159\u00edda 4, 15\u201325 \u00b0C)',
      'P\u0159edp\u011bt\u00ed:       7 d zr\u00e1n\u00ed + 2 d nap\u00edn\u00e1n\u00ed + 2 d injekt\u00e1\u017e',
      'Piloty:         122 ks, C30/37 XA2',
    ],
    tov: 'TOV: beton\u00e1\u0159, tesa\u0159 (skru\u017e + stojky), \u017eelez\u00e1\u0159, nap\u00edna\u010d \u00b7 \u010derpadlo betonu, jeřáb \u00b7 beton, v\u00fdztu\u017e, lana, injekt\u00e1\u017en\u00ed sm\u011bs',
  },
  {
    id: 'operna-zed-156',
    badge: 'Re\u00e1ln\u00fd projekt (anonymizov\u00e1no)',
    title: 'Op\u011brn\u00e1 ze\u010f \u2014 pr\u016fmyslov\u00fd are\u00e1l, d\u00e9lka 156 m',
    sourceNote: 'Re\u00e1ln\u00e1 geometrie \u00b7 identifikace klienta nezve\u0159ejn\u011bna',
    inputs: [
      'Line\u00e1rn\u00ed op\u011brn\u00e1 ze\u010f pod\u00e9l manipula\u010dn\u00ed plochy',
      'D\u00e9lka 156,4 m',
      'Pr\u016f\u0159ez (T): d\u0159\u00edk 1 450 \u00d7 250 mm + patka 800 \u00d7 300 mm',
      'Viditeln\u00e1 v\u00fd\u0161ka 1,75 m + patka 0,3 m',
      'Beton C30/37 XF4',
    ],
    outputs: [
      'Objem:           94,231 m\u00b3',
      'Plocha bedn\u011bn\u00ed:  547,4 m\u00b2',
      'V\u00fdztu\u017e (D12):    5,654 t',
      'Takty:           8 z\u00e1b\u011br\u016f \u00d7 19,5 m',
      'Bedn\u00edc\u00ed syst\u00e9m:  Framax Xlife (r\u00e1mov\u00e9)',
      'Brigada:         4 lid\u00e9 + 2 \u010derpadla',
      'Harmonogram:     12 pracovn\u00edch dn\u016f',
    ],
    tov: 'TOV: beton\u00e1\u0159 \u00d7 12 d, tesa\u0159 (mont/demont bedn\u011bn\u00ed), \u017eelez\u00e1\u0159 \u00b7 \u010derpadlo betonu, jeřáb \u00b7 beton 94 m\u00b3, v\u00fdztu\u017e 5,7 t',
  },
];

// "Co StavAgent NEd\u011bl\u00e1" bullets jsou p\u0159evzat\u00e9 DOSLOVN\u011a z
// docs/CALCULATOR_PHILOSOPHY.md \u00a72. Nep\u0159episovat \u2014 slou\u017e\u00ed jako z\u00e1vazn\u00e9
// pozicov\u00e1n\u00ed proti DOKA Software / PERI EngineeringPad a chr\u00e1n\u00ed p\u0159ed
// nadproduk\u010dn\u00edm o\u010dek\u00e1v\u00e1n\u00edm (acceptance criteria typu "kalkul\u00e1tor mus\u00ed
// vr\u00e1tit p\u0159esn\u011b N K\u010d" jsou anti-pattern, viz \u00a76.1 stejn\u00e9ho dokumentu).
const NEDELA = [
  {
    title: 'Nen\u00ed fin\u00e1ln\u00ed engineering software',
    text: 'Pro detailn\u00ed statick\u00fd n\u00e1vrh, v\u00fdpo\u010det zat\u00ed\u017een\u00ed a schvalovac\u00ed dokumentaci \u2192 DOKA / PERI / ULMA design teamy.',
  },
  {
    title: 'Nen\u00ed konkurent DOKA Software / PERI EngineeringPad',
    text: 'Je to komplement\u00e1rn\u00ed n\u00e1stroj \u2014 p\u0159iprav\u00ed podklady pro discussion s engineering teamem, ne nahrazuje je.',
  },
  {
    title: 'Nen\u00ed inventory tool a\u017e na posledn\u00ed \u0161roub',
    text: 'Kalkul\u00e1tor po\u010d\u00edt\u00e1 hlavn\u00ed syst\u00e9my a procenta spot\u0159eb; konkr\u00e9tn\u00ed \u0161rouby, anchory, custom adapt\u00e9ry \u0159e\u0161\u00ed dodavatel.',
  },
  {
    title: 'Nen\u00ed z\u00e1ruka p\u0159esn\u00e9 ceny',
    text: 'Fin\u00e1ln\u00ed cena vych\u00e1z\u00ed ze statick\u00e9ho n\u00e1vrhu v\u00fdrobce + aktu\u00e1ln\u00edho cen\u00edku + projektov\u00fdch podklad\u016f. Kalkul\u00e1tor poskytuje orienta\u010dn\u00ed odhad pro tendrovou f\u00e1zi.',
  },
];

// Disclaimer text p\u0159evzat\u00fd DOSLOVN\u011a z docs/CALCULATOR_PHILOSOPHY.md \u00a75.1
// \u2014 povinn\u00fd viditeln\u00fd text na lendingu (a v Kalkul\u00e1toru samotn\u00e9m).
const CALCULATOR_DISCLAIMER = 'Tento kalkul\u00e1tor poskytuje orienta\u010dn\u00ed odhad pro p\u0159\u00edpravu rozpo\u010dtu s p\u0159esnost\u00ed typicky \u00b110\u201315 %. Fin\u00e1ln\u00ed detailn\u00ed n\u00e1vrh, statick\u00fd v\u00fdpo\u010det a p\u0159esnou specifikaci komponent\u016f prov\u00e1d\u00ed v\u017edy dodavatel opalubky (DOKA / PERI / ULMA / dal\u0161\u00ed) na z\u00e1klad\u011b konkr\u00e9tn\u00edch projektov\u00fdch podklad\u016f. Pro tendrovou f\u00e1zi a p\u0159edb\u011b\u017enou kalkulaci je tato p\u0159esnost dostate\u010dn\u00e1.';

// ── Component ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useHeadMeta({
    canonical: 'https://www.stavagent.cz/',
    hreflangs: {
      cs: 'https://www.stavagent.cz/',
      en: 'https://www.stavagent.cz/en/',
    },
  });

  const goCta = () => navigate(isAuthenticated ? '/portal' : '/login');
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
          <span style={{ ...ghostBtn, border: 'none', padding: '4px 8px', fontSize: 13 }} onClick={() => navigate('/team')}>O zakladateli</span>
          <a href="/en/" style={{ ...ghostBtn, border: 'none', padding: '4px 8px', fontSize: 13, textDecoration: 'none' }}>EN</a>
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
          Z rozpočtu <span style={{ color: 'var(--accent-orange)' }}>pracovní plán.</span>
        </h1>
        <p style={{
          fontSize: 'clamp(15px, 2.5vw, 18px)', color: 'var(--text-secondary)',
          lineHeight: 1.6, maxWidth: 600, margin: '0 auto 28px',
        }}>
          Pro rozpočtáře a přípraváře stavby. Klasifikace pozic, výpočet betonu, bednění, výztuže a harmonogram — vše s transparentním confidence skóre.
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
          Tři propojené nástroje pro celý workflow přípraváře.
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
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {m.bullets.map((b, j) => (
                  <li key={j} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 4 }}>{b}</li>
                ))}
              </ul>
              <div>
                <button
                  onClick={() => { m.external ? openExternal(m.href) : navigate(m.href); }}
                  style={{
                    ...orangeBtn(),
                    background: 'transparent',
                    color: 'var(--accent-orange)',
                    border: '1px solid var(--accent-orange)',
                    padding: '8px 16px',
                    fontSize: 13,
                  }}
                >
                  {m.cta} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Připravujeme — Modul "v přípravě" + early-access teaser. Plný
            lead-gen formulář (POST endpoint + DB) přijde v Gate 5 v3.2. */}
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
              href="mailto:info@stavagent.cz?subject=Early%20access%20%E2%80%94%20Anal%C3%BDza%20dokumentace&body=Dobr%C3%BD%20den%2C%20m%C3%A1m%20z%C3%A1jem%20o%20early%20access%20do%20Anal%C3%BDzy%20dokumentace."
              style={{
                ...orangeBtn(),
                textDecoration: 'none',
                background: 'transparent',
                color: 'var(--accent-orange)',
                border: '1px solid var(--accent-orange)',
                padding: '8px 16px',
                fontSize: 13,
              }}
            >
              {COMING_SOON.cta} <ArrowRight size={14} />
            </a>
          </div>
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

      {/* ── 7. PŘÍKLAD Z PRAXE ── (dva cases: veřejný ŘSD + anonymizovaný) */}
      <section style={sectionStyle('900px')}>
        <h2 style={h2Style}>Příklad z praxe</h2>
        <p style={subtitleStyle}>
          Dva reálné cases: veřejný tender ŘSD a anonymizovaný projekt z portfolia.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {CASES.map((c) => (
            <div key={c.id} style={{ ...card, padding: 0, overflow: 'hidden' }}>
              {/* Card header */}
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

              {/* Vstup + Výstup grid */}
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
                    Vstup
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
                    Co StavAgent spočítal
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

              {/* TOV chip */}
              <div style={{
                padding: '12px 24px',
                borderTop: '1px solid var(--border-default)',
                background: 'var(--data-surface)',
                fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55,
              }}>
                {c.tov}
              </div>

              {/* Time metric */}
              <div style={{
                padding: '12px 24px',
                borderTop: '1px solid var(--border-default)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: 8,
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Export TOV/DOV → Excel pro poptávky a oddělení
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-orange)' }}>
                  30 minut místo půl dne v Excelu
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Calculator disclaimer — canonical text z docs/CALCULATOR_PHILOSOPHY.md §5.1 */}
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

      {/* ── 7b. CO STAVAGENT NEDĚLÁ ── (pozicování vs DOKA/PERI engineering) */}
      <section id="nedela" style={sectionStyle('900px')}>
        <h2 style={h2Style}>Co StavAgent NEdělá</h2>
        <p style={subtitleStyle}>
          Hranice kalkulátoru. Co se řeší u dodavatele (DOKA / PERI / ULMA) a co u nás.
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

        {/* Positioning chip pod sekcí */}
        <div style={{
          marginTop: 20, padding: '14px 20px',
          background: 'var(--data-surface)',
          borderRadius: 8,
          fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
          textAlign: 'center',
        }}>
          Naše hodnota = <strong>rychlost + technologická správnost + vendor-neutralita</strong> v fázi předtendrové kalkulace.
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
          Otevřená beta. 200 kreditů zdarma na start.
        </p>

        {/* Free tier box — jediný cenový artefakt na lendingu během bety. */}
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
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Otevřená beta &mdash; placené plány v Q3 2026 přes Lemon Squeezy (Merchant of Record).
          </div>
        </div>

        {/* Pricing table removed per v3.2 Q-J. Per-operation credit costs are
            visible after registration in the user's cabinet billing panel.
            Free-tier card above is the only landing-page pricing artefact. */}
        {/* Removed-pricing-table-anchor */}
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
            {['Klasifik\u00e1tor', 'Registr', 'Kalkul\u00e1tor beton\u00e1\u017ee', 'Anal\u00fdza dokumentace (v p\u0159\u00edprav\u011b)'].map(t => (
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
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, cursor: 'pointer' }} onClick={() => navigate('/team')}>O zakladateli</div>
          </div>
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kontakt</h4>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <a href="mailto:info@stavagent.cz" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>info@stavagent.cz</a>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              <a href="https://www.linkedin.com/in/alexander-prokopov" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>LinkedIn</a>
            </div>
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
