/**
 * Project Audit Component
 *
 * Complete project audit workflow using Workflow C:
 * 1. Upload file (Excel, PDF, XML)
 * 2. Execute Multi-Role AI audit
 * 3. Display results with classification (GREEN/AMBER/RED)
 * 4. Show summary and recommendations
 *
 * Design: Digital Concrete (Brutalist Neumorphism)
 * Version: 1.0.0 (2025-12-28)
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
  X,
  ChevronDown,
  ChevronUp,
  Search,
  ClipboardList,
} from 'lucide-react';
import { workflowCAPI, WorkflowCResult } from '../../services/api';

interface ProjectAuditProps {
  onClose: () => void;
}

type AuditStage = 'upload' | 'processing' | 'complete' | 'error';

const STAGE_LABELS: Record<string, string> = {
  parsing: 'Parsování souboru...',
  validating: 'Validace pozic...',
  enriching: 'Obohacování dat (KROS/RTS)...',
  auditing: 'Multi-Role AI audit...',
  summarizing: 'Generování souhrnu...',
  completed: 'Dokončeno',
};

export default function ProjectAudit({ onClose }: ProjectAuditProps) {
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const droppedFile = files[0];
      validateAndSetFile(droppedFile);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  }, []);

  const validateAndSetFile = (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.pdf', '.xml'];
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(extension)) {
      setError(`Nepodporovaný formát: ${extension}. Podporované: ${validExtensions.join(', ')}`);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('Soubor je příliš velký. Maximum je 50 MB.');
      return;
    }

    setFile(file);
    setError(null);

    // Auto-generate project name from file
    if (!projectName) {
      const name = file.name.replace(/\.[^/.]+$/, '');
      setProjectName(name);
    }
  };

  const handleStartAudit = async () => {
    if (!file || !projectName.trim()) {
      setError('Prosím vyberte soubor a zadejte název projektu.');
      return;
    }

    try {
      setStage('processing');
      setError(null);
      setStartTime(Date.now());

      // Generate unique project ID
      const projectId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Simulate progress updates (since we can't get real-time updates via REST)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return prev;
          return prev + Math.random() * 15;
        });

        // Simulate stage transitions
        const elapsed = Date.now() - (startTime || Date.now());
        if (elapsed < 3000) {
          setCurrentStep('parsing');
        } else if (elapsed < 8000) {
          setCurrentStep('validating');
        } else if (elapsed < 15000) {
          setCurrentStep('enriching');
        } else if (elapsed < 25000) {
          setCurrentStep('auditing');
        } else {
          setCurrentStep('summarizing');
        }
      }, 500);

      // Execute Workflow C
      const auditResult = await workflowCAPI.uploadAndExecute(
        file,
        projectId,
        projectName.trim(),
        {
          generate_summary: true,
          use_parallel: true,
          language,
        }
      );

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

  const getClassificationIcon = (classification: string) => {
    switch (classification) {
      case 'GREEN':
        return <CheckCircle size={48} style={{ color: 'var(--status-success)' }} />;
      case 'AMBER':
        return <AlertTriangle size={48} style={{ color: 'var(--status-warning)' }} />;
      case 'RED':
        return <XCircle size={48} style={{ color: 'var(--status-error)' }} />;
      default:
        return <FileText size={48} style={{ color: 'var(--text-secondary)' }} />;
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'GREEN':
        return 'var(--status-success)';
      case 'AMBER':
        return 'var(--status-warning)';
      case 'RED':
        return 'var(--status-error)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getClassificationLabel = (classification: string) => {
    switch (classification) {
      case 'GREEN':
        return 'V pořádku';
      case 'AMBER':
        return 'Varování';
      case 'RED':
        return 'Kritické problémy';
      default:
        return 'Neznámý';
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 1000,
      }}
    >
      <div
        className="c-panel"
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              <Search size={20} className="inline" /> Audit projektu
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Multi-Role AI analýza výkazu výměr
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '8px',
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Upload Stage */}
        {stage === 'upload' && (
          <>
            {/* Project Name Input */}
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                }}
              >
                Název projektu *
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="např. Most SO-101, Bytový dům A1"
                className="c-input"
                style={{ width: '100%' }}
              />
            </div>

            {/* Language Selector */}
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                }}
              >
                Jazyk výstupu
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['cs', 'en', 'sk'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`c-btn c-btn--sm ${language === lang ? 'c-btn--primary' : ''}`}
                  >
                    {lang === 'cs' ? '🇨🇿 Čeština' : lang === 'en' ? '🇬🇧 English' : '🇸🇰 Slovenčina'}
                  </button>
                ))}
              </div>
            </div>

            {/* File Upload Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: isDragging ? '2px solid var(--brand-orange)' : '2px dashed var(--border-color)',
                borderRadius: '12px',
                padding: '40px 20px',
                textAlign: 'center',
                background: isDragging ? 'rgba(255, 159, 28, 0.1)' : 'var(--surface-inset)',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                marginBottom: '20px',
              }}
            >
              {file ? (
                <>
                  <FileText size={48} style={{ color: 'var(--brand-orange)', marginBottom: '12px' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {file.name}
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="c-btn c-btn--sm"
                    style={{ marginTop: '12px' }}
                  >
                    Změnit soubor
                  </button>
                </>
              ) : (
                <>
                  <Upload size={48} style={{ color: 'var(--text-secondary)', marginBottom: '12px' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {isDragging ? 'Pusťte soubor zde' : 'Přetáhněte soubor nebo klikněte'}
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Excel (.xlsx), PDF, XML • Max 50 MB
                  </p>
                  <input
                    type="file"
                    id="audit-file-input"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    accept=".xlsx,.xls,.pdf,.xml"
                  />
                  <label htmlFor="audit-file-input" className="c-btn c-btn--primary">
                    Vybrat soubor
                  </label>
                </>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div
                className="c-panel c-panel--inset"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--status-error)',
                  marginBottom: '20px',
                }}
              >
                <p style={{ color: 'var(--status-error)', margin: 0, fontSize: '14px' }}>{error}</p>
              </div>
            )}

            {/* Info Box */}
            <div
              className="c-panel c-panel--inset"
              style={{ marginBottom: '20px' }}
            >
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                <strong>Jak to funguje:</strong> Nahrajete soubor s výkazem výměr →
                AI analyzuje všechny pozice → Multi-Role audit (6 specialistů) →
                Výsledek: GREEN/AMBER/RED + doporučení
              </p>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartAudit}
              disabled={!file || !projectName.trim()}
              className="c-btn c-btn--primary c-btn--lg"
              style={{ width: '100%' }}
            >
              <Zap size={20} />
              Spustit audit
            </button>
          </>
        )}

        {/* Processing Stage */}
        {stage === 'processing' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Loader2
              size={64}
              style={{
                color: 'var(--brand-orange)',
                animation: 'spin 1s linear infinite',
                marginBottom: '24px',
              }}
            />

            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {STAGE_LABELS[currentStep] || 'Zpracování...'}
            </h3>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Paralelní Multi-Role AI audit (6 specialistů)
            </p>

            {/* Progress Bar */}
            <div
              style={{
                height: '8px',
                background: 'var(--surface-inset)',
                borderRadius: '4px',
                overflow: 'hidden',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--brand-orange)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              <Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Očekávaný čas: 15-30 sekund (parallel mode)
            </p>

            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* Complete Stage */}
        {stage === 'complete' && result && (
          <>
            {/* Result Header */}
            <div
              style={{
                textAlign: 'center',
                padding: '24px',
                marginBottom: '24px',
                background: 'var(--surface-inset)',
                borderRadius: '12px',
              }}
            >
              {getClassificationIcon(result.audit_classification)}

              <h3
                style={{
                  fontSize: '24px',
                  fontWeight: 700,
                  color: getClassificationColor(result.audit_classification),
                  marginTop: '16px',
                  marginBottom: '8px',
                }}
              >
                {getClassificationLabel(result.audit_classification)}
              </h3>

              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Jistota: {(result.audit_confidence * 100).toFixed(0)}% •
                {result.positions_count} pozic •
                {result.total_duration_seconds.toFixed(1)}s
                {result.multi_role_speedup && (
                  <span style={{ color: 'var(--brand-orange)' }}>
                    {' '}• {result.multi_role_speedup.toFixed(1)}x rychlejší
                  </span>
                )}
              </p>
            </div>

            {/* Critical Issues */}
            {result.critical_issues.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--status-error)', marginBottom: '8px' }}>
                  <AlertTriangle size={16} className="inline" /> Kritické problémy ({result.critical_issues.length})
                </h4>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {result.critical_issues.map((issue, i) => (
                    <li key={i} style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--status-warning)', marginBottom: '8px' }}>
                  <Zap size={16} className="inline" /> Varování ({result.warnings.length})
                </h4>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {result.warnings.slice(0, 5).map((warning, i) => (
                    <li key={i} style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {warning}
                    </li>
                  ))}
                  {result.warnings.length > 5 && (
                    <li style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      ...a dalších {result.warnings.length - 5}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Summary */}
            {result.summary && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  <ClipboardList size={16} className="inline" /> Shrnutí projektu
                </h4>
                {result.summary.executive_summary && (
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    {result.summary.executive_summary}
                  </p>
                )}
                {result.summary.key_findings && result.summary.key_findings.length > 0 && (
                  <>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Klíčová zjištění:
                    </p>
                    <ul style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
                      {result.summary.key_findings.map((finding, i) => (
                        <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {finding}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {result.summary.recommendations && result.summary.recommendations.length > 0 && (
                  <>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      Doporučení:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {result.summary.recommendations.map((rec, i) => (
                        <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* Details Toggle */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="c-btn c-btn--sm"
              style={{ marginBottom: '16px' }}
            >
              {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showDetails ? 'Skrýt detaily' : 'Zobrazit detaily'}
            </button>

            {showDetails && (
              <div
                className="c-panel c-panel--inset"
                style={{ marginBottom: '20px', fontSize: '12px' }}
              >
                <p style={{ fontWeight: 600, marginBottom: '8px' }}>Časy jednotlivých fází:</p>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {Object.entries(result.stage_durations).map(([stage, duration]) => (
                      <tr key={stage}>
                        <td style={{ padding: '4px 0', color: 'var(--text-secondary)' }}>
                          {STAGE_LABELS[stage] || stage}
                        </td>
                        <td style={{ padding: '4px 0', textAlign: 'right', color: 'var(--text-primary)' }}>
                          {Number(duration).toFixed(2)}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={resetAudit} className="c-btn c-btn--primary" style={{ flex: 1 }}>
                Nový audit
              </button>
              <button onClick={onClose} className="c-btn" style={{ flex: 1 }}>
                Zavřít
              </button>
            </div>
          </>
        )}

        {/* Error Stage */}
        {stage === 'error' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <XCircle size={64} style={{ color: 'var(--status-error)', marginBottom: '24px' }} />

            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Audit selhal
            </h3>

            <p style={{ fontSize: '14px', color: 'var(--status-error)', marginBottom: '24px' }}>
              {error || 'Neznámá chyba'}
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={resetAudit} className="c-btn c-btn--primary">
                Zkusit znovu
              </button>
              <button onClick={onClose} className="c-btn">
                Zavřít
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
