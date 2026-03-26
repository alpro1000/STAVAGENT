/**
 * AuditTab — Multi-Role AI audit (Workflow C).
 * Upload file → execute audit → display GREEN/AMBER/RED classification.
 */

import { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { workflowCAPI, WorkflowCResult } from '../../../services/api';
import styles from './DocumentAnalysis.module.css';

type AuditStage = 'upload' | 'processing' | 'complete' | 'error';

const STAGE_LABELS: Record<string, string> = {
  parsing: 'Parsov\u00e1n\u00ed souboru...',
  validating: 'Validace pozic...',
  enriching: 'Obohacov\u00e1n\u00ed dat (KROS/RTS)...',
  auditing: 'Multi-Role AI audit...',
  summarizing: 'Generov\u00e1n\u00ed souhrnu...',
  completed: 'Dokon\u010deno',
};

export default function AuditTab() {
  const [stage, setStage] = useState<AuditStage>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState('');
  const [language, setLanguage] = useState<'cs' | 'en' | 'sk'>('cs');
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<WorkflowCResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => { setIsDragging(false); }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) validateAndSetFile(files[0]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) validateAndSetFile(files[0]);
  }, []);

  const validateAndSetFile = (f: File) => {
    const ext = f.name.toLowerCase().substring(f.name.lastIndexOf('.'));
    if (!['.xlsx', '.xls', '.pdf', '.xml'].includes(ext)) {
      setError(`Nepodporovan\u00fd form\u00e1t: ${ext}. Podporovan\u00e9: .xlsx, .xls, .pdf, .xml`);
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('Soubor je p\u0159\u00edli\u0161 velk\u00fd. Maximum je 50 MB.');
      return;
    }
    setFile(f);
    setError(null);
    if (!projectName) setProjectName(f.name.replace(/\.[^/.]+$/, ''));
  };

  const handleStartAudit = async () => {
    if (!file || !projectName.trim()) {
      setError('Pros\u00edm vyberte soubor a zadejte n\u00e1zev projektu.');
      return;
    }

    try {
      setStage('processing');
      setError(null);
      const now = Date.now();
      setStartTime(now);

      const projectId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const progressInterval = setInterval(() => {
        setProgress(prev => prev >= 95 ? prev : prev + Math.random() * 15);
        const elapsed = Date.now() - now;
        if (elapsed < 3000) setCurrentStep('parsing');
        else if (elapsed < 8000) setCurrentStep('validating');
        else if (elapsed < 15000) setCurrentStep('enriching');
        else if (elapsed < 25000) setCurrentStep('auditing');
        else setCurrentStep('summarizing');
      }, 500);

      const auditResult = await workflowCAPI.uploadAndExecute(file, projectId, projectName.trim(), {
        generate_summary: true,
        use_parallel: true,
        language,
      });

      clearInterval(progressInterval);
      setProgress(100);
      setCurrentStep('completed');
      setResult(auditResult);
      setStage('complete');
    } catch (err) {
      setStage('error');
      setError(err instanceof Error ? err.message : 'Audit selhal');
    }
  };

  const resetAudit = () => {
    setStage('upload');
    setFile(null);
    setProjectName('');
    setCurrentStep('');
    setProgress(0);
    setResult(null);
    setError(null);
    setShowDetails(false);
    setStartTime(null);
  };

  const getClassificationIcon = (cls: string) => {
    switch (cls) {
      case 'GREEN': return <CheckCircle size={48} style={{ color: 'var(--status-success)' }} />;
      case 'AMBER': return <AlertTriangle size={48} style={{ color: 'var(--status-warning)' }} />;
      case 'RED': return <XCircle size={48} style={{ color: 'var(--status-error)' }} />;
      default: return <FileText size={48} style={{ color: 'var(--text-secondary)' }} />;
    }
  };

  const getClassificationColor = (cls: string) => {
    switch (cls) {
      case 'GREEN': return 'var(--status-success)';
      case 'AMBER': return 'var(--status-warning)';
      case 'RED': return 'var(--status-error)';
      default: return 'var(--text-secondary)';
    }
  };

  const getClassificationLabel = (cls: string) => {
    switch (cls) {
      case 'GREEN': return 'V po\u0159\u00e1dku';
      case 'AMBER': return 'Varov\u00e1n\u00ed';
      case 'RED': return 'Kritick\u00e9 probl\u00e9my';
      default: return 'Nezn\u00e1m\u00fd';
    }
  };

  /* ── Upload ── */
  if (stage === 'upload') {
    return (
      <div>
        {/* Project name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>N\u00e1zev projektu *</label>
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="nap\u0159. Most SO-101, Bytov\u00fd d\u016fm A1"
            className="c-input"
            style={{ width: '100%' }}
          />
        </div>

        {/* Language */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Jazyk v\u00fdstupu</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['cs', 'en', 'sk'] as const).map(lang => (
              <button key={lang} onClick={() => setLanguage(lang)} className={`c-btn c-btn--sm ${language === lang ? 'c-btn--primary' : ''}`}>
                {lang === 'cs' ? '\ud83c\udde8\ud83c\uddff \u010ce\u0161tina' : lang === 'en' ? '\ud83c\uddec\ud83c\udde7 English' : '\ud83c\uddf8\ud83c\uddf0 Sloven\u010dina'}
              </button>
            ))}
          </div>
        </div>

        {/* File upload */}
        <div
          className={styles.uploadZone}
          data-active={isDragging}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {file ? (
            <>
              <FileText size={48} style={{ color: 'var(--accent-orange)', marginBottom: 12 }} />
              <p style={{ fontWeight: 600, marginBottom: 4 }}>{file.name}</p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <button onClick={e => { e.stopPropagation(); setFile(null); }} className="c-btn c-btn--sm" style={{ marginTop: 12 }}>
                Zm\u011bnit soubor
              </button>
            </>
          ) : (
            <>
              <Upload size={48} style={{ color: 'var(--text-secondary)', marginBottom: 12 }} />
              <p style={{ fontWeight: 600, marginBottom: 8 }}>{isDragging ? 'Pus\u0165te soubor zde' : 'P\u0159et\u00e1hn\u011bte soubor nebo klikn\u011bte'}</p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>Excel (.xlsx), PDF, XML &bull; Max 50 MB</p>
              <input type="file" id="audit-file-input" onChange={handleFileSelect} style={{ display: 'none' }} accept=".xlsx,.xls,.pdf,.xml" />
              <label htmlFor="audit-file-input" className="c-btn c-btn--primary">Vybrat soubor</label>
            </>
          )}
        </div>

        {error && (
          <div className={styles.errorBox}>
            <p style={{ margin: 0, fontSize: 14 }}>{error}</p>
          </div>
        )}

        {/* Info */}
        <div style={{ padding: '12px 16px', background: 'var(--data-surface)', borderRadius: 8, margin: '20px 0', fontSize: 14, color: 'var(--text-secondary)' }}>
          <strong>Jak to funguje:</strong> Nahrajete soubor s v\u00fdkazem v\u00fdm\u011br \u2192 AI analyzuje v\u0161echny pozice \u2192 Multi-Role audit (6 specialist\u016f) \u2192 V\u00fdsledek: GREEN/AMBER/RED + doporu\u010den\u00ed
        </div>

        <button onClick={handleStartAudit} disabled={!file || !projectName.trim()} className="c-btn c-btn--primary c-btn--lg" style={{ width: '100%' }}>
          <Zap size={20} /> Spustit audit
        </button>
      </div>
    );
  }

  /* ── Processing ── */
  if (stage === 'processing') {
    return (
      <div className={styles.auditStageCenter}>
        <Loader2 size={64} className={styles.spin} style={{ color: 'var(--accent-orange)', marginBottom: 24 }} />
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{STAGE_LABELS[currentStep] || 'Zpracov\u00e1n\u00ed...'}</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>Paraleln\u00ed Multi-Role AI audit (6 specialist\u016f)</p>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          O\u010dek\u00e1van\u00fd \u010das: 15-30 sekund (parallel mode)
        </p>
      </div>
    );
  }

  /* ── Error ── */
  if (stage === 'error') {
    return (
      <div className={styles.auditStageCenter}>
        <XCircle size={64} style={{ color: 'var(--status-error)', marginBottom: 24 }} />
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Audit selhal</h3>
        <p style={{ fontSize: 14, color: 'var(--status-error)', marginBottom: 24 }}>{error || 'Nezn\u00e1m\u00e1 chyba'}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={resetAudit} className="c-btn c-btn--primary">Zkusit znovu</button>
        </div>
      </div>
    );
  }

  /* ── Complete ── */
  if (stage === 'complete' && result) {
    return (
      <div>
        {/* Result header */}
        <div className={styles.auditResult}>
          {getClassificationIcon(result.audit_classification)}
          <h3 style={{ fontSize: 24, fontWeight: 700, color: getClassificationColor(result.audit_classification), marginTop: 16, marginBottom: 8 }}>
            {getClassificationLabel(result.audit_classification)}
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Jistota: {(result.audit_confidence * 100).toFixed(0)}% &bull; {result.positions_count} pozic &bull; {result.total_duration_seconds.toFixed(1)}s
            {result.multi_role_speedup && (
              <span style={{ color: 'var(--accent-orange)' }}> &bull; {result.multi_role_speedup.toFixed(1)}x rychlej\u0161\u00ed</span>
            )}
          </p>
        </div>

        {/* Critical issues */}
        {result.critical_issues.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--status-error)', marginBottom: 8 }}>
              Kritick\u00e9 probl\u00e9my ({result.critical_issues.length})
            </h4>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {result.critical_issues.map((issue, i) => <li key={i} style={{ fontSize: 14, marginBottom: 4 }}>{issue}</li>)}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--status-warning)', marginBottom: 8 }}>
              Varov\u00e1n\u00ed ({result.warnings.length})
            </h4>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {result.warnings.slice(0, 5).map((warning, i) => <li key={i} style={{ fontSize: 14, marginBottom: 4 }}>{warning}</li>)}
              {result.warnings.length > 5 && <li style={{ fontSize: 14, color: 'var(--text-secondary)' }}>...a dal\u0161\u00edch {result.warnings.length - 5}</li>}
            </ul>
          </div>
        )}

        {/* Summary */}
        {result.summary && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Shrnut\u00ed projektu</h4>
            {result.summary.executive_summary && (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>{result.summary.executive_summary}</p>
            )}
            {(result.summary.key_findings ?? []).length > 0 && (
              <>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Kl\u00ed\u010dov\u00e1 zji\u0161t\u011bn\u00ed:</p>
                <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
                  {(result.summary.key_findings ?? []).map((f, i) => <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{f}</li>)}
                </ul>
              </>
            )}
            {(result.summary.recommendations ?? []).length > 0 && (
              <>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Doporu\u010den\u00ed:</p>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {(result.summary.recommendations ?? []).map((r, i) => <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r}</li>)}
                </ul>
              </>
            )}
          </div>
        )}

        {/* Details toggle */}
        <button onClick={() => setShowDetails(!showDetails)} className="c-btn c-btn--sm" style={{ marginBottom: 16 }}>
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {showDetails ? 'Skr\u00fdt detaily' : 'Zobrazit detaily'}
        </button>

        {showDetails && (
          <div style={{ marginBottom: 20, fontSize: 12, padding: 16, background: 'var(--data-surface)', borderRadius: 8 }}>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>\u010casy jednotliv\u00fdch f\u00e1z\u00ed:</p>
            <table className={styles.dataTable}>
              <tbody>
                {Object.entries(result.stage_durations).map(([stg, duration]) => (
                  <tr key={stg}>
                    <td style={{ color: 'var(--text-secondary)' }}>{STAGE_LABELS[stg] || stg}</td>
                    <td style={{ textAlign: 'right' }}>{Number(duration).toFixed(2)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={resetAudit} className="c-btn c-btn--primary" style={{ flex: 1 }}>Nov\u00fd audit</button>
        </div>
      </div>
    );
  }

  return null;
}
