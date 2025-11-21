'use client';

import React, { useState } from 'react';
import { Artifact } from '@/lib/types';

interface ArtifactCardProps {
  artifact: Artifact;
}

const ARTIFACT_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  calculation: { icon: '🧮', label: 'Calculation', color: 'bg-blue-50 border-blue-200' },
  report: { icon: '📄', label: 'Report', color: 'bg-purple-50 border-purple-200' },
  table: { icon: '📊', label: 'Table', color: 'bg-green-50 border-green-200' },
  chart: { icon: '📈', label: 'Chart', color: 'bg-orange-50 border-orange-200' },
  tech_card: { icon: '📋', label: 'Tech Card', color: 'bg-teal-50 border-teal-200' },
  resource_sheet: { icon: '📑', label: 'Resource Sheet', color: 'bg-indigo-50 border-indigo-200' },
  materials: { icon: '🧱', label: 'Materials', color: 'bg-gray-50 border-gray-200' },
  vykaz_vymer: { icon: '📐', label: 'Výkaz výměr', color: 'bg-yellow-50 border-yellow-200' },
  audit: { icon: '🔍', label: 'Audit', color: 'bg-red-50 border-red-200' },
  summary: { icon: '📝', label: 'Summary', color: 'bg-pink-50 border-pink-200' },
};

export function ArtifactCard({ artifact }: ArtifactCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = ARTIFACT_CONFIG[artifact.type] || ARTIFACT_CONFIG.summary;

  const handleExport = (format: string) => {
    console.log(`Exporting artifact ${artifact.id} as ${format}`);
    // TODO: Implement export logic
  };

  return (
    <div className={`rounded-lg border p-4 ${config.color}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <h4 className="text-sm font-medium text-gray-900">{artifact.title}</h4>
            <p className="text-xs text-gray-500">{config.label}</p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-white/50"
        >
          {isExpanded ? 'Collapse ▲' : 'Expand ▼'}
        </button>
      </div>

      {/* Content Preview */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <div className="bg-white rounded p-3 text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto">
            <pre className="whitespace-pre-wrap">
              {typeof artifact.content === 'string'
                ? artifact.content
                : JSON.stringify(artifact.content, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3">
        {artifact.exportFormats && artifact.exportFormats.length > 0 && (
          <>
            <span className="text-xs text-gray-500">Export:</span>
            {artifact.exportFormats.map((format) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                className="text-xs px-2 py-1 rounded bg-white hover:bg-gray-100 border border-gray-300 transition-colors"
              >
                {format.toUpperCase()}
              </button>
            ))}
          </>
        )}
        {artifact.editable && (
          <button className="text-xs px-2 py-1 rounded bg-white hover:bg-gray-100 border border-gray-300 transition-colors ml-auto">
            ✏️ Edit
          </button>
        )}
      </div>
    </div>
  );
}
