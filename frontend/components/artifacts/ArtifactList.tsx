'use client';

import React from 'react';
import { BaseArtifact } from '@/lib/artifact-types';

interface ArtifactListProps {
  artifacts: BaseArtifact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const ARTIFACT_ICONS: Record<string, string> = {
  calculation: '🧮',
  table: '📊',
  report: '📄',
  chart: '📈',
  tech_card: '📋',
  resource_sheet: '📑',
  materials: '🧱',
  vykaz_vymer: '📐',
  audit: '🔍',
  summary: '📝',
};

export function ArtifactList({ artifacts, selectedId, onSelect }: ArtifactListProps) {
  return (
    <div className="divide-y divide-gray-200">
      {artifacts.map((artifact) => (
        <button
          key={artifact.id}
          onClick={() => onSelect(artifact.id)}
          className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
            selectedId === artifact.id ? 'bg-primary/5 border-l-4 border-primary' : ''
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">
              {ARTIFACT_ICONS[artifact.type] || '📄'}
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {artifact.title}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                <span className="capitalize">{artifact.type}</span>
                <span>•</span>
                <span>v{artifact.version}</span>
                {artifact.editable && (
                  <>
                    <span>•</span>
                    <span className="text-green-600">✏️ Editable</span>
                  </>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {artifact.updatedAt.toLocaleDateString()}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
