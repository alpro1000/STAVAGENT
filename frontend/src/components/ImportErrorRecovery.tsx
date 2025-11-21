/**
 * Import Error Recovery Component
 * Shows detailed error information and allows manual correction
 * Displays which parser failed and provides fallback options
 */

import React, { useState } from 'react';
import './ImportErrorRecovery.css';

interface ParseResult {
  positions: any[];
  source: 'CORE' | 'LOCAL' | 'TEMPLATE';
  error?: string;
  timestamp: number;
}

interface ImportErrorRecoveryProps {
  isOpen: boolean;
  error: string;
  details: {
    parserAttempted: 'CORE' | 'LOCAL' | 'TEMPLATE';
    failedAt: string;
    fallbackResults?: ParseResult[];
    suggestions?: string[];
  };
  onRetry: () => void;
  onManualCorrection: (correctedData: any) => void;
  onCancel: () => void;
}

export default function ImportErrorRecovery({
  isOpen,
  error,
  details,
  onRetry,
  onManualCorrection,
  onCancel
}: ImportErrorRecoveryProps) {
  const [selectedFallback, setSelectedFallback] = useState<ParseResult | null>(
    details.fallbackResults?.[0] || null
  );
  const [manualPositions, setManualPositions] = useState<string>('');

  if (!isOpen) return null;

  // Determine error severity and color
  const getSeverityColor = (failedAt: string) => {
    if (failedAt.includes('CORE')) return 'severity-high';
    if (failedAt.includes('LOCAL')) return 'severity-medium';
    return 'severity-low';
  };

  // Get helpful suggestions
  const getSuggestions = (): string[] => {
    const suggestions = details.suggestions || [];

    if (error.includes('length')) {
      suggestions.push('Ensure Excel file contains data rows');
      suggestions.push('Check that file is not corrupted');
    }

    if (error.includes('CORE')) {
      suggestions.push('CORE service may be temporarily unavailable');
      suggestions.push('Try uploading again - local parser will be used as fallback');
    }

    if (error.includes('parse')) {
      suggestions.push('Check Excel file format and structure');
      suggestions.push('Ensure columns are properly labeled');
    }

    return suggestions;
  };

  return (
    <div className="import-error-recovery-overlay">
      <div className="import-error-recovery-modal">
        <div className="recovery-header">
          <h2>⚠️ Import Error</h2>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="recovery-content">
          {/* Error Summary */}
          <section className="error-summary">
            <div className={`error-badge ${getSeverityColor(details.failedAt)}`}>
              Parser Failed: {details.parserAttempted}
            </div>
            <p className="error-message">{error}</p>
            <p className="failed-at">Failed at: {details.failedAt}</p>
          </section>

          {/* Fallback Results */}
          {details.fallbackResults && details.fallbackResults.length > 0 && (
            <section className="fallback-results">
              <h3>📦 Available Fallback Results</h3>
              <div className="fallback-options">
                {details.fallbackResults.map((result, idx) => (
                  <div
                    key={idx}
                    className={`fallback-card ${selectedFallback === result ? 'selected' : ''}`}
                    onClick={() => setSelectedFallback(result)}
                  >
                    <div className="fallback-source">{result.source}</div>
                    <div className="fallback-info">
                      <span className="fallback-count">
                        {result.positions.length} positions
                      </span>
                      <span className="fallback-time">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {result.source === 'LOCAL' && (
                      <div className="fallback-note">✅ Local parser (keyword-based)</div>
                    )}
                    {result.source === 'TEMPLATE' && (
                      <div className="fallback-note">⚠️ Default template</div>
                    )}
                  </div>
                ))}
              </div>

              {selectedFallback && (
                <div className="fallback-details">
                  <h4>Selected Fallback: {selectedFallback.source}</h4>
                  <table className="positions-table">
                    <thead>
                      <tr>
                        <th>Part</th>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedFallback.positions.slice(0, 5).map((pos, idx) => (
                        <tr key={idx}>
                          <td>{pos.part_name}</td>
                          <td title={pos.item_name}>
                            {pos.item_name?.substring(0, 30)}...
                          </td>
                          <td>{pos.qty}</td>
                          <td>{pos.unit}</td>
                          <td>
                            <span className={`subtype-badge subtype-${pos.subtype}`}>
                              {pos.subtype}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {selectedFallback.positions.length > 5 && (
                    <p className="more-positions">
                      + {selectedFallback.positions.length - 5} more positions
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Suggestions */}
          <section className="suggestions">
            <h3>💡 Suggestions</h3>
            <ul>
              {getSuggestions().map((suggestion, idx) => (
                <li key={idx}>{suggestion}</li>
              ))}
            </ul>
          </section>

          {/* Manual Correction */}
          <section className="manual-correction">
            <h3>✏️ Manual Data Entry</h3>
            <p className="manual-note">
              Paste CSV data (description, quantity, unit) one line per position:
            </p>
            <textarea
              value={manualPositions}
              onChange={(e) => setManualPositions(e.target.value)}
              placeholder="Example:&#10;ŽB překlady, 15, m3&#10;Bednění, 200, m2&#10;Výztuž, 2.5, t"
              className="manual-input"
            />
            <p className="char-count">{manualPositions.length} characters</p>
          </section>

          {/* Actions */}
          <div className="recovery-actions">
            <button className="action-btn btn-cancel" onClick={onCancel}>
              ❌ Cancel Import
            </button>

            <button
              className="action-btn btn-retry"
              onClick={onRetry}
              disabled={error.includes('timeout')}
            >
              🔄 Retry Upload
            </button>

            {selectedFallback && (
              <button
                className="action-btn btn-accept"
                onClick={() => onManualCorrection(selectedFallback)}
              >
                ✅ Accept Fallback ({selectedFallback.positions.length} items)
              </button>
            )}

            {manualPositions.trim() && (
              <button
                className="action-btn btn-manual"
                onClick={() => onManualCorrection({ manual: manualPositions })}
              >
                📝 Use Manual Data
              </button>
            )}
          </div>
        </div>

        {/* Debug Info (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="debug-info">
            <details>
              <summary>🐛 Debug Info</summary>
              <pre>{JSON.stringify(details, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
