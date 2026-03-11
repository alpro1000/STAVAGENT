/**
 * Captures Panel Component
 * Manage takts (captures) for elements
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Element {
  id: string;
  name: string;
  type: string;
  concrete_volume_m3: number;
  formwork_area_m2: number;
  rebar_mass_t: number;
}

interface Capture {
  id: string;
  element_id: string;
  sequence_index: number;
  name: string;
  volume_m3: number;
  area_m2: number;
  mass_t: number;
  joint_type: string;
}

interface CapturesPanelProps {
  projectId: string;
  elements: Element[];
  onGenerateTasks: () => void;
  isGenerating: boolean;
}

export default function CapturesPanel({
  projectId,
  elements,
  onGenerateTasks,
  isGenerating
}: CapturesPanelProps) {
  const [capturesCounts, setCapturesCounts] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();

  // Fetch captures for project
  const { data: capturesData, isLoading } = useQuery({
    queryKey: ['r0-captures', projectId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/r0/captures?project_id=${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch captures');
      return res.json();
    },
    enabled: !!projectId
  });

  // Auto-generate captures mutation
  const generateCapturesMutation = useMutation({
    mutationFn: async ({ elementId, count }: { elementId: string; count: number }) => {
      const res = await fetch(`${API_URL}/api/r0/captures/auto-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          element_id: elementId,
          captures_count: count
        })
      });
      if (!res.ok) throw new Error('Failed to generate captures');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r0-captures', projectId] });
    }
  });

  const captures: Capture[] = capturesData?.captures || [];

  const getCapturesForElement = (elementId: string) => {
    return captures.filter(c => c.element_id === elementId);
  };

  const getTotalCaptures = () => captures.length;

  const handleGenerateCaptures = (elementId: string) => {
    const count = capturesCounts[elementId] || 1;
    generateCapturesMutation.mutate({ elementId, count });
  };

  if (elements.length === 0) {
    return (
      <div className="r0-empty-state">
        <h3>📐 Takty (captures)</h3>
        <p>Nejprve přidejte elementy v záložce "Elementy".</p>
      </div>
    );
  }

  return (
    <div className="r0-captures">
      {/* Header with Generate Tasks button */}
      <div className="r0-captures-header">
        <h3>📐 Rozdělit elementy na takty</h3>
        <button
          className="r0-btn r0-btn-success"
          onClick={onGenerateTasks}
          disabled={isGenerating || getTotalCaptures() === 0}
          title={getTotalCaptures() === 0 ? 'Nejprve vygenerujte takty' : ''}
        >
          {isGenerating ? '⏳ Generuji...' : `⚙️ Generovat úkoly (${getTotalCaptures()} taktů)`}
        </button>
      </div>

      {/* Elements with captures */}
      <div className="r0-captures-list">
        {elements.map((element) => {
          const elementCaptures = getCapturesForElement(element.id);
          const capturesCount = capturesCounts[element.id] || 1;

          return (
            <div key={element.id} className="r0-capture-card">
              <div className="r0-capture-card-header">
                <div className="r0-capture-element-info">
                  <strong>{element.name}</strong>
                  <span className="r0-capture-quantities">
                    {element.concrete_volume_m3.toFixed(1)} m³ |
                    {element.formwork_area_m2.toFixed(1)} m² |
                    {element.rebar_mass_t.toFixed(2)} t
                  </span>
                </div>
                <div className="r0-capture-controls">
                  <label>Počet taktů:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={capturesCount}
                    onChange={(e) => setCapturesCounts({
                      ...capturesCounts,
                      [element.id]: parseInt(e.target.value) || 1
                    })}
                    className="r0-input-small"
                  />
                  <button
                    className="r0-btn r0-btn-secondary"
                    onClick={() => handleGenerateCaptures(element.id)}
                    disabled={generateCapturesMutation.isPending}
                  >
                    {generateCapturesMutation.isPending ? '...' : '🔄 Rozdělit'}
                  </button>
                </div>
              </div>

              {/* Captures for this element */}
              {elementCaptures.length > 0 ? (
                <div className="r0-capture-takts">
                  {elementCaptures.map((capture) => (
                    <div key={capture.id} className="r0-takt">
                      <div className="r0-takt-header">
                        <span className="r0-takt-name">{capture.name}</span>
                        {capture.joint_type !== 'none' && (
                          <span className="r0-joint-badge">
                            {capture.joint_type === 'construction_joint' ? '🔗 Pracovní spoj' : '↔️ Dilatace'}
                          </span>
                        )}
                      </div>
                      <div className="r0-takt-values">
                        <span>{capture.volume_m3.toFixed(2)} m³</span>
                        <span>{capture.area_m2.toFixed(2)} m²</span>
                        <span>{capture.mass_t.toFixed(3)} t</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="r0-capture-empty">
                  Klikněte "Rozdělit" pro vygenerování taktů
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info box */}
      <div className="r0-info-box">
        <h4>ℹ️ Jak to funguje</h4>
        <ol>
          <li>Rozdělte každý element na takty (captures)</li>
          <li>Takty definují pracovní švy (construction joints)</li>
          <li>Klikněte "Generovat úkoly" pro vytvoření harmonogramu</li>
          <li>Pro každý takt se vytvoří 6 úkolů: armování → bednění → betonáž → vytvrzování → odbednění → přemístění</li>
        </ol>
      </div>
    </div>
  );
}
