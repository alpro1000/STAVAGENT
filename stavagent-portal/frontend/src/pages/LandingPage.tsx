/**
 * Landing Page - Public entry point for stavagent.cz
 * No authentication required.
 * Digital Concrete Design System.
 */

import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Shield, BarChart3, Lock, LogIn, User, Gift, Ruler, Hexagon, Building2, Settings, FileText, ClipboardList } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ── Two hero products — available WITHOUT registration (session-only) ────────
const HERO_PRODUCTS = [
  {
    icon: 'BarChart3',
    name: 'AI Analýza dokumentů',
    desc: 'Nahrajte PDF nebo Excel → AI vytvoří passport stavby, soupis prací, audit a shrnutí za 30 sekund.',
    cta: 'Vyzkoušet zdarma',
    route: '/portal/analysis',
    tags: ['PDF/XLSX', 'AI Audit', 'Passport', 'Soupis prací'],
  },
  {
    icon: 'Hexagon',
    name: 'Kalkulátor monolitních prací',
    desc: 'Spočítejte náklady na beton, bednění a výztuž. 20 typů elementů, Gantt harmonogram, Excel export.',
    cta: 'Spočítat',
    route: 'https://kalkulator.stavagent.cz/planner',
    tags: ['Kč/m³', 'Bednění', 'Výztuž', 'Gantt'],
  },
];

// ── Additional tools — require registration ──────────────────────────────────
const MORE_TOOLS = [
  { icon: 'Ruler', name: 'Analýza výkresů', desc: 'AI Vision + OCR extrakce z PDF výkresů' },
  { icon: 'Building2', name: 'Objednávka betonu', desc: 'Betonárny, porovnání cen, čerpadlo' },
  { icon: 'Settings', name: 'Kalkulačka čerpadel', desc: '3 dodavatelé, příplatky, kalendář' },
  { icon: 'FileText', name: 'Ceníky dodavatelů', desc: 'PDF ceníky → strukturovaná data' },
  { icon: 'ClipboardList', name: 'Generování seznamu prací', desc: 'AI vytvoří strukturovaný seznam stavebních prací z dokumentů' },
  { icon: 'Ruler', name: 'Generátor výkazu výměr', desc: 'TZ → AI extrakce konstrukcí a objemů → výkaz výměr' },
];

const FEATURES = [
  {
    icon: <Zap size={28} />,
    title: 'AI analýza',
    desc: 'Multi-Role systém s 6 AI specialisty: audit, klasifikace a párování během sekund.',
  },
  {
    icon: <Shield size={28} />,
    title: 'Spolehlivost',
    desc: 'Deterministické výpočty — RCPSP, Monte Carlo, KROS zaokrouhlení. Bez halucinací.',
  },
  {
    icon: <BarChart3 size={28} />,
    title: 'Excel + Gantt',
    desc: 'Profesionální výstupy: harmonogramy, rozpočty a ceníky s exportem do Excelu.',
  },
  {
    icon: <Gift size={28} />,
    title: '200 kreditů zdarma',
    desc: 'Zaregistrujte se a získejte 200 kreditů. AI analýza od 10 kreditů za dokument.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--app-bg-concrete)',
      overflowX: 'hidden',
    }}>
      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(176, 178, 181, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-default)',
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/assets/logo.svg" alt="StavAgent" style={{ width: '40px', height: '40px' }} />
          <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
            StavAgent
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAuthenticated ? (
            <button
              onClick={() => navigate('/cabinet')}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default, #d1d5db)',
                borderRadius: '8px',
                fontWeight: 500,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <User size={16} />
              {user?.name || 'Kabinet'}
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default, #d1d5db)',
                borderRadius: '8px',
                fontWeight: 500,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <LogIn size={16} />
              Přihlásit se
            </button>
          )}
          <button
            onClick={() => navigate(isAuthenticated ? '/portal' : '/portal/analysis')}
            style={{
              padding: '8px 20px',
              background: 'var(--accent-orange)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isAuthenticated ? 'Portál' : 'Vyzkoušet'} <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        padding: '64px 24px 40px',
        textAlign: 'center',
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 44px)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          lineHeight: 1.15,
          marginBottom: '16px',
        }}>
          Nahrajte dokument
          <br />
          <span style={{ color: 'var(--accent-orange)' }}>AI&nbsp;udělá&nbsp;zbytek</span>
        </h1>
        <p style={{
          fontSize: 'clamp(15px, 2.5vw, 18px)',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '540px',
          margin: '0 auto 0',
        }}>
          AI analýza stavebních dokumentů a kalkulátor monolitních prací.
          Bez registrace — výsledek rovnou v prohlížeči.
        </p>
      </section>

      {/* ── TWO HERO PRODUCTS — no registration needed ── */}
      <section style={{
        padding: '0 24px 48px',
        maxWidth: '900px',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
        }}>
          {HERO_PRODUCTS.map((p) => (
            <div
              key={p.name}
              onClick={() => {
                if (p.route.startsWith('http')) {
                  window.open(p.route, '_blank', 'noopener,noreferrer');
                } else {
                  navigate(p.route);
                }
              }}
              style={{
                background: 'var(--panel-clean)',
                borderRadius: '14px',
                padding: '28px 24px',
                boxShadow: 'var(--shadow-panel)',
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                border: '2px solid transparent',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.borderColor = 'var(--accent-orange)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <span style={{ display: 'block', marginBottom: '12px' }}>
                {(() => {
                  const IconComp = (LucideIcons as any)[p.icon];
                  return IconComp ? <IconComp size={36} /> : null;
                })()}
              </span>
              <h3 style={{
                fontSize: '20px', fontWeight: 700, marginBottom: '8px',
                color: 'var(--text-primary)',
              }}>
                {p.name}
              </h3>
              <p style={{
                fontSize: '14px', color: 'var(--text-secondary)',
                lineHeight: 1.55, margin: '0 0 16px',
              }}>
                {p.desc}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                {p.tags.map(t => (
                  <span key={t} style={{
                    fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                    background: 'rgba(255,159,28,0.1)', color: '#b45309',
                  }}>{t}</span>
                ))}
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '10px 24px', borderRadius: '8px',
                background: 'var(--accent-orange)', color: '#fff',
                fontWeight: 600, fontSize: '14px',
              }}>
                {p.cta} <ArrowRight size={16} />
              </span>
            </div>
          ))}
        </div>

        <p style={{
          textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)',
          marginTop: '12px',
        }}>
          Bez registrace. Výsledek v prohlížeči. Pro uložení zaregistrujte se a získejte 200 kreditů zdarma.
        </p>
      </section>

      {/* ── FEATURES ── */}
      <section style={{
        padding: '48px 24px',
        maxWidth: '1000px',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
        }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              background: 'var(--panel-clean)',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: 'var(--shadow-panel)',
            }}>
              <div style={{ color: 'var(--accent-orange)', marginBottom: '12px' }}>{f.icon}</div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── MORE TOOLS — require registration ── */}
      <section style={{
        padding: '32px 24px 64px',
        maxWidth: '900px',
        margin: '0 auto',
      }}>
        <h2 style={{
          textAlign: 'center',
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '6px',
        }}>
          Další nástroje v platformě
        </h2>
        <p style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          marginBottom: '20px',
          fontSize: '13px',
        }}>
          Dostupné po bezplatné registraci
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '12px',
        }}>
          {MORE_TOOLS.map((s) => (
            <div
              key={s.name}
              onClick={() => navigate(isAuthenticated ? '/portal' : '/login')}
              style={{
                background: 'var(--panel-clean)',
                borderRadius: '8px',
                padding: '14px 16px',
                boxShadow: 'var(--shadow-panel)',
                cursor: 'pointer',
                opacity: 0.75,
                transition: 'opacity 0.15s, transform 0.15s',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '0.75';
                e.currentTarget.style.transform = '';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '20px' }}>{s.icon}</span>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  {s.name}
                </h4>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                {s.desc}
              </p>
              <div style={{
                position: 'absolute', top: '8px', right: '8px',
                display: 'flex', alignItems: 'center', gap: '3px',
                fontSize: '10px', color: 'var(--text-muted)',
              }}>
                <Lock size={10} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING HINT ── */}
      <section style={{
        padding: '0 24px 48px',
        maxWidth: '600px',
        margin: '0 auto',
        textAlign: 'center',
      }}>
        <div style={{
          background: 'var(--panel-clean)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: 'var(--shadow-panel)',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Kolik to stojí?
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Registrace zdarma + 200 kreditů na vyzkoušení.
            <br />
            AI analýza dokumentu = 10 kreditů. Dobití od 125&nbsp;Kč.
          </p>
          <div style={{
            display: 'inline-flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)',
          }}>
            <span>250 Kč → 287 kr (+15%)</span>
            <span>500 Kč → 600 kr (+20%)</span>
            <span>1000 Kč → 1250 kr (+25%)</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid var(--border-default)',
        padding: '24px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '13px',
      }}>
        StavAgent &copy; {new Date().getFullYear()} &mdash; stavagent.cz
      </footer>
    </div>
  );
}
