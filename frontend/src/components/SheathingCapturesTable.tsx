/**
 * SheathingCapturesTable - Table for formwork captures with checkerboard method calculations
 *
 * Displays sheathing captures (захватки) for a project with:
 * - Inline editing of dimensions and parameters
 * - Real-time calculation of project duration using checkerboard method
 * - Cost estimation based on rental prices
 */

import { useState, useMemo, useCallback } from 'react';
import type { SheathingCapture, SheathingCalculationResult, SheathingProjectConfig } from '@stavagent/monolit-shared';
import {
  calculateSheathing,
  calculateAllCaptures,
  calculateProjectStats
} from '@stavagent/monolit-shared';
import SheathingCaptureRow from './SheathingCaptureRow';

interface SheathingCapturesTableProps {
  projectId: string;
  captures: SheathingCapture[];
  config: SheathingProjectConfig;
  onUpdate: (capture: SheathingCapture) => void;
  onDelete: (captureId: string) => void;
  onAdd: (capture: SheathingCapture) => void;
  isLoading?: boolean;
}

export default function SheathingCapturesTable({
  projectId,
  captures,
  config,
  onUpdate,
  onDelete,
  onAdd,
  isLoading = false
}: SheathingCapturesTableProps) {
  const [showNewCapture, setShowNewCapture] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Calculate results for all captures
  const calculationResults = useMemo(() => {
    return calculateAllCaptures(captures, config);
  }, [captures, config]);

  // Calculate project-level statistics
  const projectStats = useMemo(() => {
    return calculateProjectStats(calculationResults);
  }, [calculationResults]);

  const handleCaptureSave = useCallback((updatedCapture: SheathingCapture) => {
    onUpdate(updatedCapture);
    setEditingId(null);
  }, [onUpdate]);

  const handleCaptureDelete = useCallback((captureId: string) => {
    if (window.confirm('Smazat tuto захватку?')) {
      onDelete(captureId);
    }
  }, [onDelete]);

  const handleAddCapture = useCallback(() => {
    const newCapture: SheathingCapture = {
      capture_id: `CAP-${projectId}-${Date.now()}`,
      project_id: projectId,
      part_name: 'NOVÁ ČÁST',
      length_m: 10,
      width_m: 8,
      height_m: 2.5,
      area_m2: 80,
      assembly_norm_ph_m2: 0.8,
      concrete_curing_days: config.default_concrete_curing_days,
      num_kits: config.default_num_kits,
      work_method: config.default_work_method,
      crew_size: config.crew_size,
      shift_hours: config.shift_hours,
      days_per_month: config.days_per_month
    };

    onAdd(newCapture);
    setShowNewCapture(false);
  }, [projectId, config, onAdd]);

  if (isLoading) {
    return <div className="p-4">Načítání...</div>;
  }

  return (
    <div className="sheathing-captures-table">
      {/* Summary Stats */}
      <div className="stats-bar">
        <div className="stat">
          <span className="label">Захватек:</span>
          <span className="value">{projectStats.total_captures}</span>
        </div>
        <div className="stat">
          <span className="label">Площадь:</span>
          <span className="value">{projectStats.total_area_m2.toFixed(1)} м²</span>
        </div>
        <div className="stat">
          <span className="label">Труд:</span>
          <span className="value">{projectStats.total_labor_hours} ч</span>
        </div>
        {projectStats.total_rental_cost_czk > 0 && (
          <div className="stat">
            <span className="label">Аренда:</span>
            <span className="value">{projectStats.total_rental_cost_czk.toLocaleString('cs-CZ')} Kč</span>
          </div>
        )}
        <div className="stat highlight">
          <span className="label">Срок проекта:</span>
          <span className="value">{projectStats.max_project_duration_days} дней</span>
        </div>
      </div>

      {/* Table Header */}
      <table className="captures-table">
        <thead>
          <tr>
            <th>Часть</th>
            <th>Размеры (Д×Ш×В, м)</th>
            <th>Площадь (м²)</th>
            <th>Норма (ч/м²)</th>
            <th>Комплекты</th>
            <th>Метод</th>
            <th>Цикл</th>
            <th>Срок (дни)</th>
            <th>Экономия</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {captures.length === 0 ? (
            <tr>
              <td colSpan={10} className="empty-state">
                Нет захватки. <button onClick={handleAddCapture}>Добавить первую</button>
              </td>
            </tr>
          ) : (
            captures.map((capture, idx) => {
              const result = calculationResults[idx];
              return (
                <SheathingCaptureRow
                  key={capture.capture_id}
                  capture={capture}
                  result={result}
                  isEditing={editingId === capture.capture_id}
                  onEdit={() => setEditingId(capture.capture_id)}
                  onSave={handleCaptureSave}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => handleCaptureDelete(capture.capture_id || '')}
                />
              );
            })
          )}
        </tbody>
      </table>

      {/* Add button */}
      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={handleAddCapture}
          disabled={isLoading}
        >
          + Добавить захватку
        </button>
      </div>

      {/* Styles */}
      <style>{`
        .sheathing-captures-table {
          padding: 20px;
        }

        .stats-bar {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
          padding: 15px;
          background: #f5f5f5;
          border-radius: 8px;
          flex-wrap: wrap;
        }

        .stat {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .stat.highlight {
          background: #e3f2fd;
          padding: 8px 12px;
          border-radius: 4px;
          font-weight: bold;
        }

        .stat .label {
          color: #666;
          font-size: 0.9em;
        }

        .stat .value {
          font-weight: bold;
          color: #333;
        }

        .captures-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 0.9em;
        }

        .captures-table thead {
          background: #f0f0f0;
          border-bottom: 2px solid #ccc;
        }

        .captures-table th {
          padding: 12px;
          text-align: left;
          font-weight: bold;
          white-space: nowrap;
        }

        .captures-table tbody tr {
          border-bottom: 1px solid #eee;
          transition: background-color 0.2s;
        }

        .captures-table tbody tr:hover {
          background-color: #fafafa;
        }

        .captures-table tbody tr.editing {
          background-color: #fff3e0;
        }

        .captures-table td {
          padding: 10px 12px;
        }

        .empty-state {
          text-align: center;
          color: #999;
          font-style: italic;
          padding: 40px !important;
        }

        .empty-state button {
          background: #2196f3;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }

        .empty-state button:hover {
          background: #1976d2;
        }

        .actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          transition: background-color 0.2s;
        }

        .btn-primary {
          background: #4caf50;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #45a049;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
