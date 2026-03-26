/**
 * UrsClassifierDrawer — Drawer for OTSKP → URS code matching
 *
 * Opens as a side panel when user clicks "URS" button on a soupis item.
 * Calls URS Matcher Service via Monolit backend proxy.
 */

import React, { useState, useEffect } from 'react';
import { soupisAPI, UrsMatchResult } from '../services/api';

interface UrsClassifierDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  otskpCode: string;
  otskpName: string;
  otskpMj: string;
  quantity: number;
  onSelectUrs: (ursCode: string, ursName: string, confidence: number) => void;
}

export default function UrsClassifierDrawer({
  isOpen, onClose, otskpCode, otskpName, otskpMj, quantity, onSelectUrs,
}: UrsClassifierDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UrsMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !otskpCode) return;

    const fetchCandidates = async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const res = await soupisAPI.matchUrs(otskpCode, otskpName, otskpMj, quantity);
        if (res.success) {
          setResult(res.data);
        }
      } catch (e: any) {
        setError(e.response?.data?.error || e.message || 'URS Matcher nedostupny');
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, [isOpen, otskpCode, otskpName, otskpMj, quantity]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: '480px', maxWidth: '90vw',
      background: 'var(--r0-bg, #fff)',
      borderLeft: '2px solid var(--r0-border)',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid var(--r0-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Klasifikator URS</h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--r0-text-secondary)', marginTop: '4px' }}>
            OTSKP: <strong>{otskpCode}</strong> | {otskpMj} | {quantity}
          </div>
        </div>
        <button onClick={onClose} style={{
          border: 'none', background: 'none', fontSize: '1.5rem',
          cursor: 'pointer', padding: '0 8px',
        }}>x</button>
      </div>

      {/* OTSKP Item Info */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--r0-border)', fontSize: '0.85rem' }}>
        <div style={{ fontWeight: 500 }}>{otskpName}</div>
        {result?.tskp_section && (
          <div style={{ color: 'var(--r0-text-secondary)', marginTop: '4px' }}>
            TSKP: {result.tskp_section.code} — {result.tskp_section.name}
          </div>
        )}
      </div>

      {/* Composite Banner */}
      {result?.is_composite && (
        <div style={{
          padding: '0.5rem 1rem',
          background: 'rgba(255,159,28,0.1)',
          borderBottom: '1px solid var(--r0-border)',
          fontSize: '0.8rem',
        }}>
          <strong>Kompozitni polozka</strong> — zahrnuje vsechny komponenty v jedne cene.
          {result.composite_note && <div>{result.composite_note}</div>}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--r0-text-secondary)' }}>
            Hledam URS kandidaty...
          </div>
        )}

        {error && (
          <div style={{ padding: '1rem', color: 'red', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {result && !loading && result.urs_candidates.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--r0-text-secondary)' }}>
            {result.is_composite
              ? 'Kompozitni polozka — URS kod neni potreba hledat.'
              : 'Zadni URS kandidati nenalezeni.'}
          </div>
        )}

        {result && result.urs_candidates.map((candidate, idx) => (
          <div key={idx} style={{
            border: '1px solid var(--r0-border)',
            borderRadius: '6px',
            padding: '0.75rem',
            marginBottom: '0.75rem',
            cursor: 'pointer',
          }}
            onClick={() => onSelectUrs(candidate.code, candidate.name, candidate.confidence)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {candidate.code}
              </span>
              <span style={{
                fontSize: '0.75rem',
                padding: '2px 6px',
                borderRadius: '10px',
                background: candidate.confidence >= 0.8
                  ? 'rgba(40,167,69,0.1)'
                  : candidate.confidence >= 0.5
                    ? 'rgba(255,159,28,0.1)'
                    : 'rgba(220,53,69,0.1)',
                color: candidate.confidence >= 0.8 ? 'green' : candidate.confidence >= 0.5 ? '#c77b00' : 'red',
              }}>
                {Math.round(candidate.confidence * 100)}%
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>{candidate.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--r0-text-secondary)', marginTop: '2px' }}>
              MJ: {candidate.unit}
              {candidate.url && (
                <a href={candidate.url} target="_blank" rel="noopener noreferrer"
                  style={{ marginLeft: '8px' }}
                  onClick={e => e.stopPropagation()}>
                  podminky.urs.cz
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
