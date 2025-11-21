import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function AuditResult({ data }) {
  const [expandedIssue, setExpandedIssue] = useState(null);

  if (!data) return <div className="text-gray-500">Žádná data</div>;

  const { statistics_by_severity = {}, issues = [], summary = '' } = data;
  const { GREEN = 0, AMBER = 0, RED = 0 } = statistics_by_severity;
  const total = GREEN + AMBER + RED;
  const getPercent = (value) => (total ? Math.round((value / total) * 100) : 0);

  return (
    <div className="space-y-4">
      {/* Summary text */}
      {summary && (
        <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm text-blue-800">
          {summary}
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-green-50 p-3 rounded-lg text-center border border-green-200">
          <div className="text-2xl font-bold text-green-600">{GREEN}</div>
          <div className="text-xs text-green-700 font-semibold">OK</div>
          <div className="text-xs text-green-600">{getPercent(GREEN)}%</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg text-center border border-yellow-200">
          <div className="text-2xl font-bold text-yellow-600">{AMBER}</div>
          <div className="text-xs text-yellow-700 font-semibold">VÝSTRAHY</div>
          <div className="text-xs text-yellow-600">{getPercent(AMBER)}%</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg text-center border border-red-200">
          <div className="text-2xl font-bold text-red-600">{RED}</div>
          <div className="text-xs text-red-700 font-semibold">KRITICKÉ</div>
          <div className="text-xs text-red-600">{getPercent(RED)}%</div>
        </div>
      </div>

      {/* Issues list */}
      {issues && issues.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2 text-gray-700">
            Problémy ({issues.length}):
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {issues.map((issue, i) => (
              <div
                key={i}
                className={`rounded-lg border-l-4 p-3 cursor-pointer transition ${
                  issue.severity === 'RED'
                    ? 'bg-red-50 border-red-400 text-red-900'
                    : issue.severity === 'AMBER'
                    ? 'bg-yellow-50 border-yellow-400 text-yellow-900'
                    : 'bg-green-50 border-green-400 text-green-900'
                }`}
                onClick={() =>
                  setExpandedIssue(expandedIssue === i ? null : i)
                }
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-mono text-sm font-bold">
                      [{issue.code}] {issue.description}
                    </div>
                    <div className="text-xs mt-1">{issue.problem}</div>
                  </div>
                  {expandedIssue === i ? (
                    <ChevronUp size={18} className="flex-shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="flex-shrink-0" />
                  )}
                </div>

                {/* Expanded details */}
                {expandedIssue === i && (
                  <div className="mt-2 pt-2 border-t border-current opacity-75 text-xs space-y-1">
                    {issue.suggestion && (
                      <div>
                        <strong>💡 Návrh:</strong> {issue.suggestion}
                      </div>
                    )}
                    {issue.sources && (
                      <div>
                        <strong>📚 Zdroje:</strong> {issue.sources.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
