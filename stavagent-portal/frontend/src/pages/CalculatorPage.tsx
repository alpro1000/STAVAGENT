/**
 * CalculatorPage — Public calculator page (no auth required)
 *
 * Embeds the Monolit Planner (kalkulator.stavagent.cz) via iframe.
 * All calculations run client-side in the iframe.
 *
 * Features:
 * - Full Planner functionality (element planning, Gantt, cost breakdown)
 * - "Download result" via Planner's built-in Excel/CSV export
 * - Registration CTA banner for saving results
 * - No auth required
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

const MONOLIT_URL = 'https://kalkulator.stavagent.cz/planner';

export default function CalculatorPage() {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#f8f9fa',
    }}>
      {/* Top bar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        color: 'white',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            to="/"
            style={{
              color: 'rgba(255,255,255,0.7)',
              textDecoration: 'none',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ← StavAgent
          </Link>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Kalkulátor betonáže
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            Výpočet probíhá přímo v prohlížeči
          </span>
          <Link
            to="/login"
            style={{
              padding: '6px 16px',
              background: '#FF9F1C',
              color: 'white',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Přihlásit se
          </Link>
        </div>
      </header>

      {/* Registration CTA */}
      <div style={{
        padding: '8px 20px',
        background: 'linear-gradient(90deg, #FF9F1C 0%, #f59e0b 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontSize: 13,
        flexShrink: 0,
      }}>
        <span>Pro uložení výsledků a export do rozpočtu se</span>
        <Link
          to="/login"
          style={{
            padding: '3px 12px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 4,
            color: 'white',
            textDecoration: 'none',
            fontWeight: 600,
            border: '1px solid rgba(255,255,255,0.3)',
          }}
        >
          zaregistrujte zdarma (200 kreditů)
        </Link>
      </div>

      {/* Planner iframe */}
      <div style={{ flex: 1, position: 'relative' }}>
        {!iframeLoaded && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#f8f9fa',
          }}>
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              <div style={{
                width: 32, height: 32, border: '3px solid #e5e7eb',
                borderTopColor: '#FF9F1C', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 12px',
              }} />
              <div style={{ fontSize: 14 }}>Načítání kalkulátoru...</div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}
        <iframe
          src={MONOLIT_URL}
          onLoad={() => setIframeLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: iframeLoaded ? 'block' : 'none',
          }}
          title="Kalkulátor betonáže"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
