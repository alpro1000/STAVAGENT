/**
 * CrossValidationPanel — compare current analysis with previously saved documents.
 *
 * Shows when saving to a project that already has documents.
 * Compares: materials, standards, quantities between old and new.
 */

import { useState, useEffect } from 'react';
import {
  GitCompareArrows, CheckCircle, AlertTriangle, XCircle,
  Loader2, FileText,
} from 'lucide-react';
import { API_URL } from '../../../services/api';
import type { PassportGenerationResponse } from '../../../types/passport';

interface CrossValidationPanelProps {
  projectId: string;
  currentData: PassportGenerationResponse | null;
}

interface ComparisonItem {
  field: string;
  label: string;
  current: string;
  previous: string;
  status: 'match' | 'mismatch' | 'new' | 'missing';
}

export default function CrossValidationPanel({ projectId, currentData }: CrossValidationPanelProps) {
  const [comparisons, setComparisons] = useState<ComparisonItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [prevDocTitle, setPrevDocTitle] = useState<string | null>(null);
  const authHeaders = { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` };

  useEffect(() => {
    if (!projectId || !currentData?.passport) {
      setIsLoading(false);
      return;
    }
    loadAndCompare();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAndCompare() {
    setIsLoading(true);
    try {
      // Fetch latest passport from this project
      const res = await fetch(
        `${API_URL}/api/portal-documents/${projectId}?type=passport&latest=true`,
        { headers: authHeaders }
      );
      if (!res.ok) { setIsLoading(false); return; }
      const data = await res.json();

      if (!data.documents?.length) { setIsLoading(false); return; }

      // Load the full content of the latest saved doc
      const latestDoc = data.documents[0];
      setPrevDocTitle(latestDoc.title);

      const fullRes = await fetch(
        `${API_URL}/api/portal-documents/${projectId}/${latestDoc.document_id}`,
        { headers: authHeaders }
      );
      if (!fullRes.ok) { setIsLoading(false); return; }
      const fullData = await fullRes.json();
      const prevContent = fullData.document?.content;
      if (!prevContent?.passport?.passport) { setIsLoading(false); return; }

      const prevPassport = prevContent.passport.passport;
      const currPassport = currentData!.passport;

      // Compare key fields
      const items: ComparisonItem[] = [];

      // Concrete classes
      const currConcrete = currPassport.concrete_specifications?.map(s => s.concrete_class).sort().join(', ') || '';
      const prevConcrete = prevPassport.concrete_specifications?.map((s: any) => s.concrete_class).sort().join(', ') || '';
      items.push({
        field: 'concrete',
        label: 'Třídy betonu',
        current: currConcrete || '—',
        previous: prevConcrete || '—',
        status: !currConcrete && !prevConcrete ? 'match' : currConcrete === prevConcrete ? 'match' : currConcrete && !prevConcrete ? 'new' : !currConcrete && prevConcrete ? 'missing' : 'mismatch',
      });

      // Total concrete volume
      const currVol = currPassport.concrete_specifications?.reduce((s, c) => s + (c.volume_m3 || 0), 0) || 0;
      const prevVol = prevPassport.concrete_specifications?.reduce((s: number, c: any) => s + (c.volume_m3 || 0), 0) || 0;
      if (currVol > 0 || prevVol > 0) {
        const tolerance = 0.02; // 2%
        const diff = prevVol > 0 ? Math.abs(currVol - prevVol) / prevVol : (currVol > 0 ? 1 : 0);
        items.push({
          field: 'volume',
          label: 'Objem betonu (m3)',
          current: currVol > 0 ? currVol.toFixed(1) : '—',
          previous: prevVol > 0 ? prevVol.toFixed(1) : '—',
          status: diff <= tolerance ? 'match' : 'mismatch',
        });
      }

      // Reinforcement
      const currSteel = currPassport.reinforcement?.map(r => r.steel_grade).sort().join(', ') || '';
      const prevSteel = prevPassport.reinforcement?.map((r: any) => r.steel_grade).sort().join(', ') || '';
      items.push({
        field: 'reinforcement',
        label: 'Ocel výztuže',
        current: currSteel || '—',
        previous: prevSteel || '—',
        status: !currSteel && !prevSteel ? 'match' : currSteel === prevSteel ? 'match' : currSteel && !prevSteel ? 'new' : !currSteel && prevSteel ? 'missing' : 'mismatch',
      });

      // Total reinforcement tonnage
      const currTon = currPassport.reinforcement?.reduce((s, r) => s + (r.tonnage_t || 0), 0) || 0;
      const prevTon = prevPassport.reinforcement?.reduce((s: number, r: any) => s + (r.tonnage_t || 0), 0) || 0;
      if (currTon > 0 || prevTon > 0) {
        const diff = prevTon > 0 ? Math.abs(currTon - prevTon) / prevTon : (currTon > 0 ? 1 : 0);
        items.push({
          field: 'tonnage',
          label: 'Hmotnost výztuže (t)',
          current: currTon > 0 ? currTon.toFixed(2) : '—',
          previous: prevTon > 0 ? prevTon.toFixed(2) : '—',
          status: diff <= 0.02 ? 'match' : 'mismatch',
        });
      }

      // Structure type
      const currType = currPassport.structure_type || '';
      const prevType = prevPassport.structure_type || '';
      if (currType || prevType) {
        items.push({
          field: 'structure_type',
          label: 'Typ konstrukce',
          current: currType || '—',
          previous: prevType || '—',
          status: currType === prevType ? 'match' : 'mismatch',
        });
      }

      // Norms comparison
      const currNorms = new Set((currentData as any)?.norms || []);
      const prevNorms = new Set((prevContent.passport as any)?.norms || []);
      const newNorms = [...currNorms].filter(n => !prevNorms.has(n));
      const removedNorms = [...prevNorms].filter(n => !currNorms.has(n));
      if (currNorms.size > 0 || prevNorms.size > 0) {
        items.push({
          field: 'norms',
          label: 'Normy',
          current: `${currNorms.size} norem`,
          previous: `${prevNorms.size} norem`,
          status: newNorms.length === 0 && removedNorms.length === 0 ? 'match'
            : removedNorms.length > 0 ? 'mismatch' : 'new',
        });
      }

      setComparisons(items);
    } catch {
      // Ignore errors — cross-validation is optional
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="cv-panel cv-panel--loading">
        <Loader2 size={16} className="da-spin" /> Porovnávám s předchozí analýzou...
      </div>
    );
  }

  if (comparisons.length === 0) return null;

  const mismatches = comparisons.filter(c => c.status === 'mismatch').length;
  const newItems = comparisons.filter(c => c.status === 'new').length;

  return (
    <div className="cv-panel">
      <div className="cv-header">
        <GitCompareArrows size={16} />
        <span className="cv-title">
          Porovnání s <strong>{prevDocTitle}</strong>
        </span>
        {mismatches > 0 && (
          <span className="cv-badge cv-badge--warn">{mismatches} rozdíl{mismatches > 1 ? 'y' : ''}</span>
        )}
        {mismatches === 0 && newItems === 0 && (
          <span className="cv-badge cv-badge--ok">Shodné</span>
        )}
      </div>
      <div className="cv-table">
        {comparisons.map(item => {
          const StatusIcon = item.status === 'match' ? CheckCircle
            : item.status === 'mismatch' ? XCircle
            : item.status === 'new' ? FileText
            : AlertTriangle;
          const statusColor = item.status === 'match' ? '#22c55e'
            : item.status === 'mismatch' ? '#ef4444'
            : item.status === 'new' ? '#3b82f6'
            : '#f59e0b';
          return (
            <div key={item.field} className="cv-row">
              <StatusIcon size={14} style={{ color: statusColor, flexShrink: 0 }} />
              <span className="cv-row-label">{item.label}</span>
              <span className="cv-row-prev">{item.previous}</span>
              <span className="cv-row-arrow">&rarr;</span>
              <span className={`cv-row-curr ${item.status === 'mismatch' ? 'cv-row-curr--changed' : ''}`}>
                {item.current}
              </span>
            </div>
          );
        })}
      </div>

      <style>{cvStyles}</style>
    </div>
  );
}

const cvStyles = `
.cv-panel {
  margin-top: 16px;
  padding: 14px 18px;
  background: rgba(59,130,246,0.03);
  border: 1px solid rgba(59,130,246,0.12);
  border-radius: 10px;
}
.cv-panel--loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
}

.cv-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
}
.cv-title { flex: 1; }
.cv-title strong { color: var(--text-primary, #1a1a1a); }

.cv-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.cv-badge--warn { background: rgba(239,68,68,0.08); color: #ef4444; }
.cv-badge--ok { background: rgba(34,197,94,0.08); color: #22c55e; }

.cv-table {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cv-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #fff;
  border-radius: 6px;
  font-size: 12px;
  border: 1px solid rgba(0,0,0,0.04);
}
.cv-row-label {
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  min-width: 140px;
}
.cv-row-prev {
  color: var(--text-muted, #9ca3af);
  flex: 1;
  text-align: right;
}
.cv-row-arrow {
  color: var(--text-muted, #9ca3af);
  font-size: 10px;
}
.cv-row-curr {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
}
.cv-row-curr--changed {
  color: #ef4444;
  font-weight: 700;
}

@media (max-width: 768px) {
  .cv-row { flex-wrap: wrap; }
  .cv-row-label { min-width: 100%; }
}
`;
