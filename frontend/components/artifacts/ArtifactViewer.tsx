'use client';

import React, { useState } from 'react';
import { BaseArtifact } from '@/lib/artifact-types';
import { CalculationArtifactView } from './CalculationArtifactView';
import { TableArtifactView } from './TableArtifactView';
import { ReportArtifactView } from './ReportArtifactView';
import { ChartArtifactView } from './ChartArtifactView';

interface ArtifactViewerProps {
  artifact: BaseArtifact;
  onUpdate: (artifact: BaseArtifact) => void;
}

export function ArtifactViewer({ artifact, onUpdate }: ArtifactViewerProps) {
  const [editMode, setEditMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: string) => {
    setIsExporting(true);
    try {
      console.log(`Exporting artifact ${artifact.id} as ${format}`);
      // TODO: Implement export logic
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const renderArtifactContent = () => {
    switch (artifact.type) {
      case 'calculation':
        return (
          <CalculationArtifactView
            artifact={artifact as any}
            editMode={editMode}
            onUpdate={onUpdate}
          />
        );
      case 'table':
        return (
          <TableArtifactView
            artifact={artifact as any}
            editMode={editMode}
            onUpdate={onUpdate}
          />
        );
      case 'report':
        return (
          <ReportArtifactView
            artifact={artifact as any}
            editMode={editMode}
            onUpdate={onUpdate}
          />
        );
      case 'chart':
        return (
          <ChartArtifactView
            artifact={artifact as any}
            editMode={editMode}
            onUpdate={onUpdate}
          />
        );
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <span className="text-6xl">🚧</span>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Artifact type not supported yet
              </h3>
              <p className="mt-2 text-gray-600">
                {artifact.type} artifacts will be available soon
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{artifact.title}</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <span className="capitalize">{artifact.type}</span>
            <span>•</span>
            <span>Version {artifact.version}</span>
            <span>•</span>
            <span>Updated {artifact.updatedAt.toLocaleString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Edit Toggle */}
          {artifact.editable && (
            <button
              onClick={() => setEditMode(!editMode)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                editMode
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {editMode ? '👁️ View' : '✏️ Edit'}
            </button>
          )}

          {/* Export Dropdown */}
          <div className="relative group">
            <button
              disabled={isExporting}
              className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? '⏳ Exporting...' : '📥 Export'}
            </button>
            <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              {artifact.exportFormats.map((format) => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-md last:rounded-b-md"
                >
                  Export as {format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {renderArtifactContent()}
      </div>
    </div>
  );
}
