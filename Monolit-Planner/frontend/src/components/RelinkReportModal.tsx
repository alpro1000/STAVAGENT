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
  const [activeTab, setActiveTab] = useState<'matches' | 'orphaned' | 'new'>('matches');

  useEffect(() => {
    if (isOpen && reportId) {
      loadReport();
    }
  }, [isOpen, reportId]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/relink/reports/${reportId}`);
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
    const confirmed = window.confirm(
      `🔄 Aplikovat relink?\n\n` +
      `Matched: ${report?.summary.matched_exact + report?.summary.matched_fallback + report?.summary.matched_fuzzy}\n` +
      `Orphaned: ${report?.summary.orphaned}\n` +
      `New: ${report?.summary.new_positions}\n\n` +
      `Pokračovat?`
    );

    if (!confirmed) return;

    try {
      await fetch(`/api/relink/reports/${reportId}/apply`, { method: 'POST' });
      alert('✅ Relink aplikován!');
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Failed to apply relink:', error);
      alert('❌ Chyba při aplikaci relinku');
    }
  };

  const handleReject = async () => {
    const confirmed = window.confirm('❌ Zamítnout relink?');
    if (!confirmed) return;

    try {
      await fetch(`/api/relink/reports/${reportId}/reject`, { method: 'POST' });
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
                  Matches ({report.details.matches.length})
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
                    {report.details.matches.map((match, idx) => (
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
                        {match.similarity_score && (
                          <div className="match-similarity">
                            Similarity: {(match.similarity_score * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                    ))}
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
