/**
 * Landing Page - Public entry point for stavagent.cz
 * No authentication required.
 * Digital Concrete Design System.
 */

import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Shield, BarChart3, Layers, LogIn, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SERVICES = [
  // ===== ANALÝZA =====
  {
    icon: '📊',
    name: 'Analýza dokumentů',
    desc: 'Nahrajte PDF/XLSX → AI passport, soupis prací, audit, shrnutí. Multi-SO merge s detekcí rozporů.',
  },
  {
    icon: '📐',
    name: 'Analýza výkresů',
    desc: 'AI (GPT-4 Vision + OCR) extrahuje rozměry, objemy a pozice z PDF výkresů.',
  },
  // ===== KALKULACE =====
  {
    icon: '🪨',
    name: 'Kalkulátor monolitních prací',
    desc: 'Rychlý odhad nákladů na beton, bednění a výztuž. Kč/m³, KROS zaokrouhlení, Excel export. Plánovač betonáže s Gantt harmonogramem.',
  },
  {
    icon: '🏗️',
    name: 'Objednávka betonu',
    desc: 'Vyhledání betonáren, porovnání cen: beton + doprava + čerpadlo.',
  },
  {
    icon: '⚙️',
    name: 'Kalkulačka čerpadel',
    desc: '3 dodavatelé, příplatky za víkend/svátek/noc, český kalendář.',
  },
  {
    icon: '📄',
    name: 'Ceníky dodavatelů',
    desc: 'Upload PDF ceníků → strukturovaná data. Batch srovnání dodavatelů.',
  },
  // ===== KLASIFIKACE =====
  {
    icon: '🔎',
    name: 'Klasifikátor stavebních prací',
    desc: 'AI párování položek rozpočtu s kódy URS. 4fázový matching.',
  },
  {
    icon: '📊',
    name: 'Registr Rozpočtů',
    desc: '11 skupin prací, fuzzy search, AI klasifikace, Excel export.',
  },
  // ===== PŘIPRAVUJEME =====
  {
    icon: '📦',
    name: 'Kalkulačka bednění',
    desc: 'Optimalizace spotřeby bednícího materiálu a nákladů. Připravujeme.',
  },
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
    icon: <Layers size={28} />,
    title: '9 modulů',
    desc: 'Od AI analýzy po kalkulátor monolitu. Každý modul řeší konkrétní stavební úkol.',
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
        </div>
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
          AI analýza dokumentů, kalkulátor monolitních prací, objednávky betonu
          a&nbsp;export do Excelu. 9&nbsp;modulů na jednom místě.
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
          9 specializovaných modulů pro stavební profesionály
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '16px',
        }}>
          {SERVICES.map((s) => (
            <div
              key={s.name}
              onClick={() => navigate('/portal')}
              style={{
                background: 'var(--panel-clean)',
                borderRadius: '10px',
                padding: '20px',
                boxShadow: 'var(--shadow-panel)',
                cursor: 'pointer',
                transition: 'transform 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
            >
              <span style={{ fontSize: '28px', display: 'block', marginBottom: '10px' }}>{s.icon}</span>
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                {s.name}
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
