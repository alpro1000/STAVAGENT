/**
 * ComplianceTab — NKB norm compliance check + AI advisor.
 *
 * Auto-runs compliance check when passport data is available.
 * Shows: compliance score, findings (pass/warning/violation), AI recommendations.
 *
 * Calls:
 * - POST /api/core/nkb/advisor (AI recommendations based on extracted data)
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Shield, ShieldCheck, ShieldAlert, ShieldClose,
  Loader2, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp,
  BookOpen, Zap, RefreshCw,
} from 'lucide-react';
import { API_URL } from '../../../services/api';
import type { PassportGenerationResponse } from '../../../types/passport';

const CORE_API_URL = `${API_URL}/api/core`;

/* ── Types matching backend norm_schemas.py ── */

interface ComplianceFinding {
  rule_id: string;
  norm_designation: string;
  rule_title: string;
  status: 'pass' | 'warning' | 'violation' | 'not_checked';
  message: string;
  actual_value?: string;
  expected_value?: string;
  severity: string;
  recommendation?: string;
}

interface ComplianceReport {
  project_id: string;
  checked_at: string;
  total_rules_checked: number;
  passed: number;
  warnings: number;
  violations: number;
  findings: ComplianceFinding[];
  norms_referenced: string[];
  score: number;
  summary_status?: string;
}

interface AdvisorRecommendation {
  norm_designation: string;
  rule_title: string;
  recommendation: string;
  severity: string;
  applies_to: string[];
  confidence: number;
}

interface AdvisorResponse {
  context_summary: string;
  matched_norms: number;
  matched_rules: number;
  recommendations: AdvisorRecommendation[];
  ai_analysis?: string;
  ai_model_used?: string;
  perplexity_supplement?: string;
  warnings: string[];
}

interface ComplianceTabProps {
  data: PassportGenerationResponse | null;
}

const STATUS_CONFIG: Record<string, { icon: typeof ShieldCheck; color: string; label: string }> = {
  pass: { icon: CheckCircle, color: '#22c55e', label: 'Splněno' },
  warning: { icon: AlertTriangle, color: '#f59e0b', label: 'Varování' },
  violation: { icon: ShieldClose, color: '#ef4444', label: 'Porušení' },
  not_checked: { icon: Info, color: '#9ca3af', label: 'Nekontrolováno' },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#6b7280',
  info: '#3b82f6',
};

export default function ComplianceTab({ data }: ComplianceTabProps) {
  const [compliance, setCompliance] = useState<ComplianceReport | null>(null);
  const [advisor, setAdvisor] = useState<AdvisorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFindings, setExpandedFindings] = useState<Set<number>>(new Set());
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);

  /* ── Build context from passport data ── */
  const buildContext = useCallback(() => {
    if (!data?.passport) return null;
    const p = data.passport;
    const materials: string[] = [];
    const objects: string[] = [];
    const standards: string[] = [];
    let textParts: string[] = [];

    // Materials from concrete specs
    p.concrete_specifications?.forEach(spec => {
      materials.push(spec.concrete_class);
      if (spec.exposure_classes?.length) materials.push(...spec.exposure_classes);
    });

    // Materials from reinforcement
    p.reinforcement?.forEach(r => {
      materials.push(r.steel_grade);
    });

    // Objects from structure type
    if (p.structure_type) objects.push(p.structure_type);
    if (p.description) textParts.push(p.description);

    // Norms from extraction
    const norms = (data as any)?.norms;
    if (Array.isArray(norms)) standards.push(...norms);

    // Technical highlights as searchable text
    if (p.technical_highlights?.length) textParts.push(...p.technical_highlights);

    // Special requirements
    p.special_requirements?.forEach(r => {
      textParts.push(`${r.requirement_type}: ${r.description}`);
    });

    return {
      construction_type: p.structure_type || 'pozemní',
      phase: 'DSP',
      objects: [...new Set(objects)],
      materials: [...new Set(materials)],
      standards_mentioned: [...new Set(standards)],
      document_text: textParts.join('\n').slice(0, 3000),
    };
  }, [data]);

  /* ── Run compliance check ── */
  const runCheck = useCallback(async () => {
    const context = buildContext();
    if (!context) return;

    setIsLoading(true);
    setError(null);

    try {
      // Call NKB advisor (includes matched norms + rules + AI analysis)
      const res = await fetch(`${CORE_API_URL}/nkb/advisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `HTTP ${res.status}`);
      }

      const advisorData: AdvisorResponse = await res.json();
      setAdvisor(advisorData);

      // Build a synthetic compliance report from advisor recommendations
      const findings: ComplianceFinding[] = advisorData.recommendations.map((rec, i) => ({
        rule_id: `advisor_${i}`,
        norm_designation: rec.norm_designation,
        rule_title: rec.rule_title,
        status: rec.severity === 'critical' ? 'violation' as const
          : rec.severity === 'high' ? 'warning' as const
          : 'pass' as const,
        message: rec.recommendation,
        severity: rec.severity,
        recommendation: rec.recommendation,
      }));

      const violations = findings.filter(f => f.status === 'violation').length;
      const warnings = findings.filter(f => f.status === 'warning').length;
      const passed = findings.filter(f => f.status === 'pass').length;
      const total = findings.length;

      setCompliance({
        project_id: 'current',
        checked_at: new Date().toISOString(),
        total_rules_checked: total,
        passed,
        warnings,
        violations,
        findings,
        norms_referenced: [...new Set(advisorData.recommendations.map(r => r.norm_designation))],
        score: total > 0 ? passed / total : 1.0,
        summary_status: violations > 0 ? 'non_compliant'
          : warnings > 0 ? 'conditionally_compliant'
          : 'compliant',
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        setError('Timeout — server neodpověděl do 120s');
      } else {
        setError(err instanceof Error ? err.message : 'Chyba při kontrole');
      }
    } finally {
      setIsLoading(false);
    }
  }, [buildContext]);

  /* ── Auto-run on mount when data available ── */
  useEffect(() => {
    if (data?.passport && !compliance && !isLoading && !error) {
      runCheck();
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFinding = (idx: number) => {
    setExpandedFindings(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  /* ── Render ── */
  if (!data?.passport) {
    return (
      <div className="ct-empty">
        <Shield size={32} />
        <p>Nahrajte dokument pro kontrolu souladu s normami.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="ct-loading">
        <Loader2 size={28} className="da-spin" />
        <p>Kontroluji soulad s normami (NKB)...</p>
        <span className="ct-loading-hint">Gemini AI analýza + normativní pravidla</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ct-error">
        <AlertTriangle size={24} />
        <p>{error}</p>
        <button onClick={runCheck} className="c-btn c-btn--primary c-btn--sm">
          <RefreshCw size={14} /> Zkusit znovu
        </button>
      </div>
    );
  }

  if (!compliance) return null;

  const scorePercent = Math.round(compliance.score * 100);
  const statusLabel = compliance.summary_status === 'compliant' ? 'Vyhovuje'
    : compliance.summary_status === 'conditionally_compliant' ? 'Podmíněně vyhovuje'
    : 'Nevyhovuje';
  const statusColor = compliance.summary_status === 'compliant' ? '#22c55e'
    : compliance.summary_status === 'conditionally_compliant' ? '#f59e0b'
    : '#ef4444';

  return (
    <div className="ct-root">
      {/* Score header */}
      <div className="ct-score-header">
        <div className="ct-score-ring" style={{ borderColor: statusColor }}>
          <span className="ct-score-number" style={{ color: statusColor }}>{scorePercent}%</span>
        </div>
        <div className="ct-score-info">
          <h3 className="ct-score-status" style={{ color: statusColor }}>{statusLabel}</h3>
          <p className="ct-score-detail">
            {compliance.total_rules_checked} pravidel zkontrolováno
            {compliance.norms_referenced.length > 0 && (
              <> z {compliance.norms_referenced.length} norem</>
            )}
          </p>
          <div className="ct-score-badges">
            <span className="ct-badge ct-badge--pass">
              <CheckCircle size={12} /> {compliance.passed} splněno
            </span>
            {compliance.warnings > 0 && (
              <span className="ct-badge ct-badge--warn">
                <AlertTriangle size={12} /> {compliance.warnings} varování
              </span>
            )}
            {compliance.violations > 0 && (
              <span className="ct-badge ct-badge--violation">
                <ShieldClose size={12} /> {compliance.violations} porušení
              </span>
            )}
          </div>
        </div>
        <button onClick={runCheck} className="ct-refresh-btn" title="Zkontrolovat znovu">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Referenced norms */}
      {compliance.norms_referenced.length > 0 && (
        <div className="ct-norms-bar">
          <BookOpen size={14} />
          <span className="ct-norms-label">Použité normy:</span>
          <div className="ct-norms-pills">
            {compliance.norms_referenced.map((n, i) => (
              <span key={i} className="ct-norm-pill">{n}</span>
            ))}
          </div>
        </div>
      )}

      {/* Findings list */}
      {compliance.findings.length > 0 && (
        <div className="ct-findings">
          <h4 className="ct-section-title">Nálezy ({compliance.findings.length})</h4>
          {compliance.findings.map((finding, i) => {
            const config = STATUS_CONFIG[finding.status] || STATUS_CONFIG.not_checked;
            const Icon = config.icon;
            const isExpanded = expandedFindings.has(i);
            return (
              <div key={i} className={`ct-finding ct-finding--${finding.status}`}>
                <button className="ct-finding-header" onClick={() => toggleFinding(i)}>
                  <Icon size={16} style={{ color: config.color, flexShrink: 0 }} />
                  <span className="ct-finding-norm">{finding.norm_designation}</span>
                  <span className="ct-finding-title">{finding.rule_title}</span>
                  <span
                    className="ct-finding-severity"
                    style={{ color: SEVERITY_COLORS[finding.severity] || '#6b7280' }}
                  >
                    {finding.severity}
                  </span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {isExpanded && (
                  <div className="ct-finding-body">
                    <p className="ct-finding-message">{finding.message}</p>
                    {finding.actual_value && (
                      <div className="ct-finding-values">
                        <span>Zjištěno: <strong>{finding.actual_value}</strong></span>
                        {finding.expected_value && (
                          <span>Očekáváno: <strong>{finding.expected_value}</strong></span>
                        )}
                      </div>
                    )}
                    {finding.recommendation && finding.recommendation !== finding.message && (
                      <p className="ct-finding-rec">
                        <Zap size={12} /> {finding.recommendation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Analysis */}
      {advisor?.ai_analysis && (
        <div className="ct-ai-section">
          <button
            className="ct-ai-toggle"
            onClick={() => setShowAiAnalysis(!showAiAnalysis)}
          >
            <Zap size={14} />
            AI Analýza
            {advisor.ai_model_used && (
              <span className="ct-ai-model">{advisor.ai_model_used}</span>
            )}
            {showAiAnalysis ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showAiAnalysis && (
            <div className="ct-ai-content">
              <p>{advisor.ai_analysis}</p>
              {advisor.perplexity_supplement && (
                <div className="ct-ai-supplement">
                  <strong>Doplnění (web-search):</strong>
                  <p>{advisor.perplexity_supplement}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {advisor?.warnings && advisor.warnings.length > 0 && (
        <div className="ct-warnings">
          {advisor.warnings.map((w, i) => (
            <div key={i} className="ct-warning-item">
              <AlertTriangle size={14} /> {w}
            </div>
          ))}
        </div>
      )}

      <style>{complianceStyles}</style>
    </div>
  );
}

const complianceStyles = `
.ct-root { }

.ct-empty, .ct-loading, .ct-error {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-secondary, #6b7280);
}
.ct-empty svg, .ct-loading svg, .ct-error svg {
  margin: 0 auto 12px;
  display: block;
}
.ct-loading-hint {
  display: block;
  font-size: 12px;
  color: var(--text-muted, #9ca3af);
  margin-top: 8px;
}
.ct-error { color: var(--status-error, #ef4444); }

/* Score header */
.ct-score-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 16px;
  border: 1px solid rgba(0,0,0,0.06);
}

.ct-score-ring {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 4px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ct-score-number {
  font-size: 22px;
  font-weight: 800;
}

.ct-score-info { flex: 1; }
.ct-score-status {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 700;
}
.ct-score-detail {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
}

.ct-score-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ct-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}
.ct-badge--pass { background: rgba(34,197,94,0.08); color: #22c55e; }
.ct-badge--warn { background: rgba(245,158,11,0.08); color: #f59e0b; }
.ct-badge--violation { background: rgba(239,68,68,0.08); color: #ef4444; }

.ct-refresh-btn {
  background: none;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
  transition: all 0.15s;
}
.ct-refresh-btn:hover { border-color: var(--accent-orange, #FF9F1C); color: var(--accent-orange, #FF9F1C); }

/* Norms bar */
.ct-norms-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: rgba(59,130,246,0.04);
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
}
.ct-norms-label { font-weight: 600; white-space: nowrap; }
.ct-norms-pills { display: flex; flex-wrap: wrap; gap: 4px; }
.ct-norm-pill {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.08);
  white-space: nowrap;
}

/* Findings */
.ct-section-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
}

.ct-findings {
  margin-bottom: 16px;
}

.ct-finding {
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 8px;
  background: #fff;
  margin-bottom: 6px;
  overflow: hidden;
}
.ct-finding--violation { border-left: 3px solid #ef4444; }
.ct-finding--warning { border-left: 3px solid #f59e0b; }
.ct-finding--pass { border-left: 3px solid #22c55e; }

.ct-finding-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  transition: background 0.1s;
}
.ct-finding-header:hover { background: rgba(0,0,0,0.02); }

.ct-finding-norm {
  font-weight: 700;
  color: var(--accent-orange, #FF9F1C);
  white-space: nowrap;
  font-size: 12px;
}
.ct-finding-title {
  flex: 1;
  color: var(--text-primary, #1a1a1a);
  font-weight: 500;
}
.ct-finding-severity {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.ct-finding-body {
  padding: 0 14px 12px 40px;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
  line-height: 1.5;
}
.ct-finding-message { margin: 0 0 8px; }
.ct-finding-values {
  display: flex;
  gap: 20px;
  font-size: 12px;
  margin-bottom: 8px;
}
.ct-finding-rec {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  padding: 8px 12px;
  background: rgba(255,159,28,0.04);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-primary, #1a1a1a);
}
.ct-finding-rec svg { color: var(--accent-orange, #FF9F1C); flex-shrink: 0; margin-top: 2px; }

/* AI Analysis */
.ct-ai-section {
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
}
.ct-ai-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  background: rgba(255,159,28,0.04);
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-orange, #FF9F1C);
  text-align: left;
}
.ct-ai-toggle:hover { background: rgba(255,159,28,0.08); }
.ct-ai-model {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted, #9ca3af);
  margin-left: auto;
}

.ct-ai-content {
  padding: 16px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary, #6b7280);
  background: #fff;
}
.ct-ai-content p { margin: 0 0 12px; }
.ct-ai-supplement {
  padding: 12px;
  background: rgba(59,130,246,0.04);
  border-radius: 6px;
  font-size: 12px;
}
.ct-ai-supplement strong {
  display: block;
  margin-bottom: 6px;
  color: var(--text-primary, #1a1a1a);
}

/* Warnings */
.ct-warnings {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ct-warning-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(245,158,11,0.04);
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
}
.ct-warning-item svg { color: #f59e0b; flex-shrink: 0; }
`;
