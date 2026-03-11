/**
 * RelinkReportModal - Display relink report with confidence indicators
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface RelinkMatch {
  old_position_id: string;
  new_position_id: string;
  confidence: 'GREEN' | 'AMBER' | 'RED';
  match_type: 'primary' | 'fallback' | 'fuzzy';
  similarity_score?: number;
  qty_change: number;
  old_description: string;
  new_description: string;
}

interface RelinkReport {
  report_id: number;
  summary: {
    total_old: number;
    total_new: number;
    matched_exact: number;
    matched_fallback: number;
    matched_fuzzy: number;
    orphaned: number;
    new_positions: number;
    confidence_green: number;
    confidence_amber: number;
    confidence_red: number;
    match_rate: number;
  };
  details: {
    matches: RelinkMatch[];
    orphaned: any[];
    newItems: any[];
  };
}

interface RelinkReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: number | null;
}

export default function RelinkReportModal({ isOpen, onClose, reportId }: RelinkReportModalProps) {
  const [report, setReport] = useState<RelinkReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'matches' | 'orphaned' | 'new' | 'conflicts'>('matches');
  const [selectedOld, setSelectedOld] = useState<string | null>(null);
  const [selectedNew, setSelectedNew] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && reportId) {
      loadReport();
    }
  }, [isOpen, reportId]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/relink/reports/${reportId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error('Failed to load report:', error);
      alert('❌ Chyba při načítání reportu');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    const matched = (report?.summary.matched_exact || 0) + (report?.summary.matched_fallback || 0) + (report?.summary.matched_fuzzy || 0);
    const confirmed = window.confirm(
      `🔄 Aplikovat relink?\n\n` +
      `Matched: ${matched}\n` +
      `Orphaned: ${report?.summary.orphaned || 0}\n` +
      `New: ${report?.summary.new_positions || 0}\n\n` +
      `Pokračovat?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/relink/reports/${reportId}/apply`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      alert('✅ Relink aplikován!');
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Failed to apply relink:', error);
      alert('❌ Chyba při aplikaci relinku');
    }
  };

  const handleManualMatch = async () => {
    if (!selectedOld || !selectedNew) {
      alert('⚠️ Vyberte starou a novou pozici');
      return;
    }

    try {
      const response = await fetch(`/api/relink/reports/${reportId}/manual-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_position_id: selectedOld,
          new_position_id: selectedNew
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      alert('✅ Manuální match aplikován!');
      setSelectedOld(null);
      setSelectedNew(null);
      loadReport();
    } catch (error) {
      console.error('Failed to apply manual match:', error);
      alert('❌ Chyba při aplikaci manuálního matche');
    }
  };

  const handleReject = async () => {
    const confirmed = window.confirm('❌ Zamítnout relink?');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/relink/reports/${reportId}/reject`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      alert('✅ Relink zamítnut');
      onClose();
    } catch (error) {
      console.error('Failed to reject relink:', error);
      alert('❌ Chyba při zamítnutí');
    }
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'GREEN': return '🟢';
      case 'AMBER': return '🟡';
      case 'RED': return '🔴';
      default: return '⚪';
    }
  };

  const getConfidenceLabel = (confidence: string) => {
    switch (confidence) {
      case 'GREEN': return 'Exact match';
      case 'AMBER': return 'Good match';
      case 'RED': return 'Uncertain';
      default: return 'Unknown';
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="modal-overlay">
      <div className="modal-content relink-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">🔗 Relink Report</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="relink-loading">
              <div className="spinner"></div>
              <p>Načítání reportu...</p>
            </div>
          ) : !report ? (
            <div className="relink-empty">
              <p>Report nenalezen</p>
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="relink-summary">
                <div className="summary-stat">
                  <span className="stat-label">Match Rate:</span>
                  <span className="stat-value">{report.summary.match_rate}%</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">🟢 Green:</span>
                  <span className="stat-value">{report.summary.confidence_green}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">🟡 Amber:</span>
                  <span className="stat-value">{report.summary.confidence_amber}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">🔴 Red:</span>
                  <span className="stat-value">{report.summary.confidence_red}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Orphaned:</span>
                  <span className="stat-value">{report.summary.orphaned}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">New:</span>
                  <span className="stat-value">{report.summary.new_positions}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="relink-tabs">
                <button
                  className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
                  onClick={() => setActiveTab('matches')}
                >
                  Matches ({report.details.matches.filter(m => m.confidence === 'GREEN').length})
                </button>
                <button
                  className={`tab-btn ${activeTab === 'conflicts' ? 'active' : ''}`}
                  onClick={() => setActiveTab('conflicts')}
                >
                  🟡🔴 Conflicts ({report.details.matches.filter(m => m.confidence !== 'GREEN').length})
                </button>
                <button
                  className={`tab-btn ${activeTab === 'orphaned' ? 'active' : ''}`}
                  onClick={() => setActiveTab('orphaned')}
                >
                  Orphaned ({report.summary.orphaned})
                </button>
                <button
                  className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`}
                  onClick={() => setActiveTab('new')}
                >
                  New ({report.summary.new_positions})
                </button>
              </div>

              {/* Content */}
              <div className="relink-content">
                {activeTab === 'matches' && (
                  <div className="matches-list">
                    {report.details.matches.filter(m => m.confidence === 'GREEN').map((match, idx) => (
                      <div key={idx} className="match-item">
                        <div className="match-header">
                          <span className="match-confidence">
                            {getConfidenceIcon(match.confidence)} {getConfidenceLabel(match.confidence)}
                          </span>
                          <span className="match-type">{match.match_type}</span>
                          {match.qty_change !== 0 && (
                            <span className={`match-qty-change ${match.qty_change > 0 ? 'positive' : 'negative'}`}>
                              {match.qty_change > 0 ? '+' : ''}{match.qty_change}%
                            </span>
                          )}
                        </div>
                        <div className="match-description">
                          {match.old_description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'conflicts' && (
                  <div className="conflicts-container">
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>🔧 Manual Conflict Resolution</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Review AMBER/RED matches and create manual links if needed</p>
                    </div>
                    
                    <div className="conflicts-list" style={{ marginBottom: '24px' }}>
                      {report.details.matches.filter(m => m.confidence !== 'GREEN').map((match, idx) => (
                        <div key={idx} className="match-item" style={{ borderLeft: `4px solid ${match.confidence === 'AMBER' ? '#f59e0b' : '#ef4444'}` }}>
                          <div className="match-header">
                            <span className="match-confidence">
                              {getConfidenceIcon(match.confidence)} {getConfidenceLabel(match.confidence)}
                            </span>
                            <span className="match-type">{match.match_type}</span>
                            {Math.abs(match.qty_change) > 20 && (
                              <span style={{ fontSize: '12px', color: '#ef4444' }}>⚠️ Qty {match.qty_change > 0 ? '+' : ''}{match.qty_change}%</span>
                            )}
                          </div>
                          <div style={{ fontSize: '13px', marginTop: '8px' }}>
                            <div><strong>Old:</strong> {match.old_description}</div>
                            <div style={{ marginTop: '4px' }}><strong>New:</strong> {match.new_description}</div>
                            {match.similarity_score && (
                              <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                                Similarity: {(match.similarity_score * 100).toFixed(0)}%
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                      <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Create Manual Match</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'end', marginBottom: '12px' }}>
                        <div>
                          <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>Orphaned Position:</label>
                          <select 
                            value={selectedOld || ''} 
                            onChange={e => setSelectedOld(e.target.value)}
                            className="c-select"
                            style={{ width: '100%' }}
                          >
                            <option value="">Select old position...</option>
                            {report.details.orphaned.map((item, idx) => (
                              <option key={idx} value={item.id}>
                                {item.position_name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={{ fontSize: '20px', paddingBottom: '8px' }}>→</div>
                        <div>
                          <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>New Position:</label>
                          <select 
                            value={selectedNew || ''} 
                            onChange={e => setSelectedNew(e.target.value)}
                            className="c-select"
                            style={{ width: '100%' }}
                          >
                            <option value="">Select new position...</option>
                            {report.details.newItems.map((item, idx) => (
                              <option key={idx} value={item.id}>
                                {item.position_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button 
                        className="c-btn c-btn--primary" 
                        onClick={handleManualMatch}
                        disabled={!selectedOld || !selectedNew}
                      >
                        🔗 Create Manual Match
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'orphaned' && (
                  <div className="orphaned-list">
                    {report.details.orphaned.map((item, idx) => (
                      <div key={idx} className="orphaned-item">
                        <span className="orphaned-icon">🗑️</span>
                        <span className="orphaned-description">{item.position_name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'new' && (
                  <div className="new-list">
                    {report.details.newItems.map((item, idx) => (
                      <div key={idx} className="new-item">
                        <span className="new-icon">✨</span>
                        <span className="new-description">{item.position_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-danger" onClick={handleReject}>
            ❌ Zamítnout
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Zavřít
          </button>
          <button className="btn-primary" onClick={handleApply}>
            ✅ Aplikovat
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
