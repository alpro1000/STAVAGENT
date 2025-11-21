'use client';

import React, { useState, useEffect } from 'react';
import { BaseArtifact, ArtifactType } from '@/lib/artifact-types';
import { ArtifactList } from './ArtifactList';
import { ArtifactViewer } from './ArtifactViewer';

interface ArtifactWorkspaceProps {
  projectId: string;
}

export function ArtifactWorkspace({ projectId }: ArtifactWorkspaceProps) {
  const [artifacts, setArtifacts] = useState<BaseArtifact[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load artifacts for project
  useEffect(() => {
    loadArtifacts();
  }, [projectId]);

  const loadArtifacts = async () => {
    try {
      setLoading(true);
      setError(null);

      // TODO: Replace with actual API call
      // const data = await getProjectArtifacts(projectId);

      // Mock data for now
      const mockArtifacts: BaseArtifact[] = [
        {
          id: 'calc-1',
          type: 'calculation',
          title: 'Concrete Volume Calculation',
          createdAt: new Date(),
          updatedAt: new Date(),
          projectId,
          editable: true,
          exportFormats: ['pdf', 'excel', 'copy'],
          version: 1,
        },
        {
          id: 'table-1',
          type: 'table',
          title: 'Material Cost Breakdown',
          createdAt: new Date(),
          updatedAt: new Date(),
          projectId,
          editable: true,
          exportFormats: ['excel', 'pdf'],
          version: 1,
        },
        {
          id: 'report-1',
          type: 'report',
          title: 'Technical Report',
          createdAt: new Date(),
          updatedAt: new Date(),
          projectId,
          editable: false,
          exportFormats: ['pdf', 'docx'],
          version: 1,
        },
      ];

      setArtifacts(mockArtifacts);
    } catch (err: any) {
      console.error('Failed to load artifacts:', err);
      setError(err?.message || 'Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  };

  const handleArtifactSelect = (artifactId: string) => {
    setSelectedArtifactId(artifactId);
  };

  const handleArtifactUpdate = (updatedArtifact: BaseArtifact) => {
    setArtifacts((prev) =>
      prev.map((a) => (a.id === updatedArtifact.id ? updatedArtifact : a))
    );
  };

  const selectedArtifact = artifacts.find((a) => a.id === selectedArtifactId);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading artifacts...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <span className="text-6xl">❌</span>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Failed to load artifacts</h3>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={loadArtifacts}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (artifacts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <span className="text-6xl">📐</span>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No artifacts yet</h3>
          <p className="mt-2 text-gray-600">
            Artifacts like calculations, reports, and tables will appear here after you interact with the assistant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white rounded-lg border border-gray-200">
      {/* Sidebar: Artifact List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Artifacts ({artifacts.length})
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ArtifactList
            artifacts={artifacts}
            selectedId={selectedArtifactId}
            onSelect={handleArtifactSelect}
          />
        </div>
      </div>

      {/* Main: Artifact Viewer */}
      <div className="flex-1 flex flex-col">
        {selectedArtifact ? (
          <ArtifactViewer
            artifact={selectedArtifact}
            onUpdate={handleArtifactUpdate}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <span className="text-6xl">👈</span>
              <h3 className="mt-4 text-lg font-medium text-gray-900">Select an artifact</h3>
              <p className="mt-2 text-gray-600">
                Choose an artifact from the list to view and edit
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
