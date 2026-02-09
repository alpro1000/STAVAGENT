/**
 * Landing Page - Public entry point for stavagent.cz
 * No authentication required.
 * Digital Concrete Design System.
 */

import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Shield, BarChart3, Layers } from 'lucide-react';

const SERVICES = [
  {
    icon: '🔍',
    name: 'Audit projektu',
    desc: 'AI audit s 6 specialisty. GREEN/AMBER/RED klasifikace.',
  },
  {
    icon: '📁',
    name: 'Akumulace dokumentů',
    desc: 'Postupné nahrávání, hash-cache, LLM souhrn.',
  },
  {
    icon: '📋',
    name: 'Shrnutí dokumentu',
    desc: 'Jednorázová extrakce dat z PDF/Excel.',
  },
  {
    icon: '🪨',
    name: 'Monolit Planner',
    desc: 'Náklady monolitického betonu. Kč/m³ + KROS.',
  },
  {
    icon: '🔎',
    name: 'URS Matcher',
    desc: 'AI párování popisů s kódy URS.',
  },
  {
    icon: '📊',
    name: 'Registr Rozpočtů',
    desc: 'Fuzzy search, klasifikace, Excel export.',
  },
  {
    icon: '🧮',
    name: 'R0 Kalkulátory',
    desc: 'Deterministické výpočty výztuže a bednění.',
  },
  {
    icon: '⚙️',
    name: 'Modul čerpání',
    desc: 'Logistika čerpání betonu. Připravujeme.',
    soon: true,
  },
];

const FEATURES = [
  {
    icon: <Zap size={28} />,
    title: 'AI analýza',
    desc: 'Multi-Role systém s 6 AI specialisty analyzuje vaše dokumenty během sekund.',
  },
  {
    icon: <Shield size={28} />,
    title: 'Spolehlivost',
    desc: 'Deterministické jádro R0 zajišťuje přesné výpočty bez halucinací.',
  },
  {
    icon: <BarChart3 size={28} />,
    title: 'Excel export',
    desc: 'Profesionální výstupy s hyperlinky, KPI formulemi a KROS zaokrouhlením.',
  },
  {
    icon: <Layers size={28} />,
    title: 'Modulární',
    desc: '10 specializovaných kioscích. Každý řeší konkrétní stavební úkol.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

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
        <button
          onClick={() => navigate('/portal')}
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
          Vstoupit <ArrowRight size={16} />
        </button>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        padding: '80px 24px 60px',
        textAlign: 'center',
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        <img
          src="/assets/logo.svg"
          alt="StavAgent Logo"
          style={{ width: '90px', height: '90px', marginBottom: '24px' }}
        />
        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 48px)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          lineHeight: 1.15,
          marginBottom: '16px',
        }}>
          Stavební platforma
          <br />
          <span style={{ color: 'var(--accent-orange)' }}>s&nbsp;AI&nbsp;uvnitř</span>
        </h1>
        <p style={{
          fontSize: 'clamp(16px, 2.5vw, 20px)',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: '36px',
          maxWidth: '600px',
          margin: '0 auto 36px',
        }}>
          Audit rozpočtů, párování URS kódů, kalkulace betonu a&nbsp;export do Excelu.
          Vše na jednom místě.
        </p>
        <button
          onClick={() => navigate('/portal')}
          style={{
            padding: '14px 36px',
            background: 'var(--accent-orange)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '16px',
            cursor: 'pointer',
            boxShadow: '0 4px 20px var(--accent-orange-glow)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          Otevřít portál <ArrowRight size={20} />
        </button>
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

      {/* ── SERVICES GRID ── */}
      <section style={{
        padding: '48px 24px 64px',
        maxWidth: '1000px',
        margin: '0 auto',
      }}>
        <h2 style={{
          textAlign: 'center',
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}>
          Dostupné služby
        </h2>
        <p style={{
          textAlign: 'center',
          color: 'var(--text-secondary)',
          marginBottom: '32px',
          fontSize: '15px',
        }}>
          10 specializovaných kioscích pro stavební profesionály
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '16px',
        }}>
          {SERVICES.map((s) => (
            <div
              key={s.name}
              onClick={s.soon ? undefined : () => navigate('/portal')}
              style={{
                background: 'var(--panel-clean)',
                borderRadius: '10px',
                padding: '20px',
                boxShadow: 'var(--shadow-panel)',
                cursor: s.soon ? 'default' : 'pointer',
                opacity: s.soon ? 0.55 : 1,
                transition: 'transform 0.15s',
              }}
              onMouseEnter={(e) => { if (!s.soon) (e.currentTarget.style.transform = 'translateY(-2px)'); }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
            >
              <span style={{ fontSize: '28px', display: 'block', marginBottom: '10px' }}>{s.icon}</span>
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                {s.name}
                {s.soon && (
                  <span style={{
                    fontSize: '10px',
                    background: 'var(--status-info)',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    marginLeft: '8px',
                    verticalAlign: 'middle',
                  }}>
                    Brzy
                  </span>
                )}
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                {s.desc}
              </p>
            </div>
          ))}
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
