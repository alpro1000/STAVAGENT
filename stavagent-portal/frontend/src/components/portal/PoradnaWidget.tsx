/**
 * PoradnaWidget — KB Research widget for Portal
 *
 * Czech construction norms/pricing Q&A powered by Perplexity + Gemini.
 * Sources: csnonline.cz, urs.cz, beton.cz, tkp.szdc.cz, ...
 *
 * Same functionality as Monolit's FormworkAIModal "Poradna norem" tab,
 * but as a standalone portal widget.
 */

import { useState, useRef } from 'react';
import { Search, BookOpen, ExternalLink, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { API_URL } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KbSource {
  title: string;
  url: string;
  snippet?: string;
}

interface KbResult {
  answer: string;
  sources: KbSource[];
  from_kb: boolean;
  kb_saved: boolean;
  kb_category?: string;
  model_used?: string;
}

// ─── Suggested questions ─────────────────────────────────────────────────────

const CHIPS = [
  'ČSN EN 206 — třída prostředí pro mostní beton',
  'Minimální pevnost betonu pro odbednění stěny (TKP17)',
  'Cena bednění Doka 2025 Kč/m²',
  'NPH normy pro betonáž základů — referenční hodnoty',
  'BOZP požadavky při betonáži v hloubce > 1,5 m',
  'Ošetřování betonu v zimě — postup dle ČSN',
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PoradnaWidget() {
  const [collapsed, setCollapsed] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KbResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSearch = async () => {
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/kb/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, save_to_kb: true }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Chyba při vyhledávání');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se spojit se službou');
    } finally {
      setLoading(false);
    }
  };

  const handleChip = (chip: string) => {
    setQuestion(chip);
    setResult(null);
    setError(null);
    textareaRef.current?.focus();
  };

  return (
    <section style={{ marginBottom: '48px' }}>
      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: collapsed ? '0' : '16px',
        cursor: 'pointer',
        userSelect: 'none',
      }}
        onClick={() => setCollapsed(v => !v)}
      >
        <div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <BookOpen size={20} style={{ color: 'var(--brand-orange)' }} />
            Poradna norem
          </h2>
          {!collapsed && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Vyhledávání v ČSN normách, cenících a TKP. Odpovídá Perplexity + KB cache.
            </p>
          )}
        </div>
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            padding: '4px',
          }}
          onClick={(e) => { e.stopPropagation(); setCollapsed(v => !v); }}
        >
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {!collapsed && (
        <div className="c-panel" style={{ padding: '20px' }}>
          {/* Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {CHIPS.map(chip => (
              <button
                key={chip}
                onClick={() => handleChip(chip)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.target as HTMLElement).style.borderColor = 'var(--brand-orange)';
                  (e.target as HTMLElement).style.color = 'var(--brand-orange)';
                }}
                onMouseLeave={e => {
                  (e.target as HTMLElement).style.borderColor = 'var(--border-color)';
                  (e.target as HTMLElement).style.color = 'var(--text-secondary)';
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <textarea
              ref={textareaRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Napište otázku k normám, cenám nebo postupům… (Ctrl+Enter)"
              rows={2}
              style={{
                flex: 1,
                resize: 'vertical',
                padding: '10px 12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                lineHeight: '1.5',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSearch}
              disabled={!question.trim() || loading}
              className="c-btn c-btn--primary"
              style={{ flexShrink: 0, height: '44px', alignSelf: 'flex-start' }}
            >
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
              {loading ? 'Hledám…' : 'Hledat'}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              background: 'var(--status-error, #fef2f2)',
              border: '1px solid #fca5a5',
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <X size={14} />
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ marginTop: '16px' }}>
              {/* Metadata badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {result.from_kb && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: '#dcfce7',
                    color: '#16a34a',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}>
                    Z KB cache
                  </span>
                )}
                {result.model_used && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: '#dbeafe',
                    color: '#2563eb',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}>
                    {result.model_used}
                  </span>
                )}
                {result.kb_saved && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: '#fef9c3',
                    color: '#ca8a04',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}>
                    Uloženo → KB/{result.kb_category?.replace('_', '/') || 'B5'}
                  </span>
                )}
              </div>

              {/* Answer */}
              <div style={{
                padding: '14px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '13px',
                lineHeight: '1.7',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
              }}>
                {result.answer}
              </div>

              {/* Sources */}
              {result.sources && result.sources.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Zdroje
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {result.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '6px',
                          fontSize: '12px',
                          color: '#2563eb',
                          textDecoration: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: 'var(--bg-secondary)',
                        }}
                      >
                        <ExternalLink size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{src.title || src.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
