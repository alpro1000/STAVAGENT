/**
 * HybridAnalysisProgress Component
 *
 * Displays real-time progress for hybrid multi-role analysis using Server-Sent Events (SSE)
 *
 * Features:
 * - Real-time progress indicators for both queries
 * - Progress bars with completion status
 * - Final results display
 * - Error handling
 *
 * Usage:
 * ```tsx
 * <HybridAnalysisProgress
 *   question="Foundation analysis for 45m strip"
 *   onComplete={(result) => console.log(result)}
 * />
 * ```
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface ProgressState {
  started: boolean;
  contextPrepared: boolean;
  comprehensiveStarted: boolean;
  comprehensiveCompleted: boolean;
  comprehensiveTime: number | null;
  complianceStarted: boolean;
  complianceCompleted: boolean;
  complianceTime: number | null;
  merging: boolean;
  completed: boolean;
  error: string | null;
}

interface HybridResult {
  project_summary: any;
  exposure_analysis: any;
  structural_analysis: any;
  final_specification: any;
  materials_breakdown: any;
  cost_summary: any;
  compliance_status: any;
  risks_identified: any[];
  warnings: string[];
  recommendations: any[];
  confidence: number;
  performance: {
    total_time_ms: number;
    parallel_efficiency: number;
    queries_successful: number;
    queries_failed: number;
  };
}

interface HybridAnalysisProgressProps {
  question: string;
  positions?: any[];
  specifications?: any;
  onComplete?: (result: HybridResult) => void;
  onError?: (error: string) => void;
  apiUrl?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const HybridAnalysisProgress: React.FC<HybridAnalysisProgressProps> = ({
  question,
  positions,
  specifications,
  onComplete,
  onError,
  apiUrl = 'https://concrete-agent.onrender.com/api/v1/multi-role/ask-stream'
}) => {
  const [progress, setProgress] = useState<ProgressState>({
    started: false,
    contextPrepared: false,
    comprehensiveStarted: false,
    comprehensiveCompleted: false,
    comprehensiveTime: null,
    complianceStarted: false,
    complianceCompleted: false,
    complianceTime: null,
    merging: false,
    completed: false,
    error: null
  });

  const [result, setResult] = useState<HybridResult | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);

  const startAnalysis = useCallback(() => {
    setIsConnecting(true);
    setProgress({
      started: false,
      contextPrepared: false,
      comprehensiveStarted: false,
      comprehensiveCompleted: false,
      comprehensiveTime: null,
      complianceStarted: false,
      complianceCompleted: false,
      complianceTime: null,
      merging: false,
      completed: false,
      error: null
    });
    setResult(null);

    // Prepare request body
    const requestBody = {
      question,
      context: {
        positions,
        specifications
      }
    };

    // Create EventSource with POST request (using fetch-event-source library or native fetch)
    // For simplicity, we'll use native EventSource with GET (FastAPI can handle both)
    // In production, you'd want to use fetch-event-source for POST support

    const eventSource = new EventSource(
      `${apiUrl}?question=${encodeURIComponent(question)}`
    );

    eventSource.onopen = () => {
      console.log('SSE connection opened');
      setIsConnecting(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE event:', data);

        switch (data.event) {
          case 'started':
            setProgress(prev => ({ ...prev, started: true }));
            break;

          case 'context_prepared':
            setProgress(prev => ({ ...prev, contextPrepared: true }));
            break;

          case 'query_started':
            if (data.query === 'comprehensive_analysis') {
              setProgress(prev => ({ ...prev, comprehensiveStarted: true }));
            } else if (data.query === 'compliance_risks') {
              setProgress(prev => ({ ...prev, complianceStarted: true }));
            }
            break;

          case 'query_completed':
            if (data.query === 'comprehensive_analysis') {
              setProgress(prev => ({
                ...prev,
                comprehensiveCompleted: true,
                comprehensiveTime: data.time_ms
              }));
            } else if (data.query === 'compliance_risks') {
              setProgress(prev => ({
                ...prev,
                complianceCompleted: true,
                complianceTime: data.time_ms
              }));
            }
            break;

          case 'merging':
            setProgress(prev => ({ ...prev, merging: true }));
            break;

          case 'completed':
            setProgress(prev => ({ ...prev, completed: true }));
            setResult(data.result);
            if (onComplete) {
              onComplete(data.result);
            }
            eventSource.close();
            break;

          case 'error':
            setProgress(prev => ({ ...prev, error: data.message }));
            if (onError) {
              onError(data.message);
            }
            eventSource.close();
            break;
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      setProgress(prev => ({
        ...prev,
        error: 'Connection lost or server error'
      }));
      setIsConnecting(false);
      eventSource.close();
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [question, positions, specifications, apiUrl, onComplete, onError]);

  useEffect(() => {
    const cleanup = startAnalysis();
    return cleanup;
  }, [startAnalysis]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const getStatusIcon = (started: boolean, completed: boolean, error: boolean) => {
    if (error) return '❌';
    if (completed) return '✅';
    if (started) return '🔄';
    return '⏸️';
  };

  const getProgressPercentage = () => {
    let completed = 0;
    const total = 7; // 7 steps total

    if (progress.started) completed++;
    if (progress.contextPrepared) completed++;
    if (progress.comprehensiveStarted) completed++;
    if (progress.comprehensiveCompleted) completed++;
    if (progress.complianceStarted) completed++;
    if (progress.complianceCompleted) completed++;
    if (progress.merging) completed++;

    return (completed / total) * 100;
  };

  return (
    <div className="hybrid-analysis-progress" style={{ padding: '20px', maxWidth: '800px' }}>
      <h2>🚀 Hybrid Multi-Role Analysis</h2>

      {isConnecting && (
        <div style={{ padding: '10px', background: '#f0f0f0', borderRadius: '4px', marginBottom: '20px' }}>
          🔌 Connecting to server...
        </div>
      )}

      {/* Overall Progress Bar */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>Overall Progress</span>
          <span>{Math.round(getProgressPercentage())}%</span>
        </div>
        <div style={{
          width: '100%',
          height: '20px',
          background: '#e0e0e0',
          borderRadius: '10px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${getProgressPercentage()}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #4caf50, #81c784)',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Progress Steps */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          {getStatusIcon(progress.started, progress.contextPrepared, false)}
          <strong> Step 1:</strong> Context preparation
          {progress.contextPrepared && <span style={{ color: 'green', marginLeft: '10px' }}>✓ Done</span>}
        </div>

        <div style={{ marginBottom: '10px' }}>
          {getStatusIcon(progress.comprehensiveStarted, progress.comprehensiveCompleted, false)}
          <strong> Query 1:</strong> Comprehensive Analysis (Technical + Cost)
          {progress.comprehensiveCompleted && progress.comprehensiveTime && (
            <span style={{ color: 'green', marginLeft: '10px' }}>
              ✓ Done in {(progress.comprehensiveTime / 1000).toFixed(1)}s
            </span>
          )}
        </div>

        <div style={{ marginBottom: '10px' }}>
          {getStatusIcon(progress.complianceStarted, progress.complianceCompleted, false)}
          <strong> Query 2:</strong> Compliance & Risks (Standards + Validation)
          {progress.complianceCompleted && progress.complianceTime && (
            <span style={{ color: 'green', marginLeft: '10px' }}>
              ✓ Done in {(progress.complianceTime / 1000).toFixed(1)}s
            </span>
          )}
        </div>

        <div style={{ marginBottom: '10px' }}>
          {getStatusIcon(progress.merging, progress.completed, false)}
          <strong> Step 4:</strong> Merging results
          {progress.completed && <span style={{ color: 'green', marginLeft: '10px' }}>✓ Done</span>}
        </div>
      </div>

      {/* Error Display */}
      {progress.error && (
        <div style={{
          padding: '15px',
          background: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <strong>❌ Error:</strong> {progress.error}
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div style={{
          padding: '20px',
          background: '#f5f5f5',
          borderRadius: '8px',
          marginTop: '20px'
        }}>
          <h3>✅ Analysis Complete!</h3>

          <div style={{ marginBottom: '15px' }}>
            <strong>Performance:</strong>
            <ul>
              <li>Total Time: {(result.performance.total_time_ms / 1000).toFixed(1)}s</li>
              <li>Parallel Efficiency: {result.performance.parallel_efficiency.toFixed(1)}%</li>
              <li>Queries Successful: {result.performance.queries_successful}/2</li>
            </ul>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong>Compliance Status:</strong> {result.compliance_status?.overall || 'N/A'}
          </div>

          {result.warnings && result.warnings.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <strong>⚠️ Warnings ({result.warnings.length}):</strong>
              <ul>
                {result.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {result.risks_identified && result.risks_identified.length > 0 && (
            <div>
              <strong>🚨 Risks ({result.risks_identified.length}):</strong>
              <ul>
                {result.risks_identified.slice(0, 3).map((risk: any, i: number) => (
                  <li key={i}>
                    <strong>{risk.severity}:</strong> {risk.title}
                  </li>
                ))}
                {result.risks_identified.length > 3 && (
                  <li>... and {result.risks_identified.length - 3} more</li>
                )}
              </ul>
            </div>
          )}

          <div style={{ marginTop: '15px' }}>
            <strong>Confidence:</strong> {(result.confidence * 100).toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
};

export default HybridAnalysisProgress;
