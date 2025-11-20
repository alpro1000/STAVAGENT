/**
 * SheathingCaptureRow - Single row in captures table with inline editing
 */

import { useState } from 'react';
import type { SheathingCapture, SheathingCalculationResult } from '@stavagent/monolit-shared';

interface SheathingCaptureRowProps {
  capture: SheathingCapture;
  result: SheathingCalculationResult;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (capture: SheathingCapture) => void;
  onCancel: () => void;
  onDelete: () => void;
}

export default function SheathingCaptureRow({
  capture,
  result,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete
}: SheathingCaptureRowProps) {
  const [editData, setEditData] = useState<SheathingCapture>(capture);

  const handleSave = () => {
    // Recalculate area when dimensions change
    const area = editData.length_m * editData.width_m;
    const updatedCapture = { ...editData, area_m2: area };
    onSave(updatedCapture);
  };

  const handleInputChange = (field: keyof SheathingCapture, value: any) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const timeSavingsPercent = result.time_savings_percent || 0;
  const timeSavingsDays = result.time_savings_days || 0;

  if (isEditing) {
    return (
      <tr className="editing">
        <td>
          <input
            type="text"
            value={editData.part_name}
            onChange={(e) => handleInputChange('part_name', e.target.value)}
            placeholder="Часть"
            className="input-field"
          />
        </td>
        <td>
          <div className="dimensions">
            <input
              type="number"
              value={editData.length_m}
              onChange={(e) => handleInputChange('length_m', parseFloat(e.target.value))}
              placeholder="Д"
              className="input-field"
              step="0.1"
            />
            ×
            <input
              type="number"
              value={editData.width_m}
              onChange={(e) => handleInputChange('width_m', parseFloat(e.target.value))}
              placeholder="Ш"
              className="input-field"
              step="0.1"
            />
            ×
            <input
              type="number"
              value={editData.height_m || 0}
              onChange={(e) => handleInputChange('height_m', parseFloat(e.target.value))}
              placeholder="В"
              className="input-field"
              step="0.1"
            />
          </div>
        </td>
        <td>
          <strong>{(editData.length_m * editData.width_m).toFixed(1)}</strong>
        </td>
        <td>
          <input
            type="number"
            value={editData.assembly_norm_ph_m2}
            onChange={(e) => handleInputChange('assembly_norm_ph_m2', parseFloat(e.target.value))}
            placeholder="Норма"
            className="input-field"
            step="0.1"
            min="0.1"
          />
        </td>
        <td>
          <input
            type="number"
            value={editData.num_kits}
            onChange={(e) => handleInputChange('num_kits', parseInt(e.target.value))}
            placeholder="Компл."
            className="input-field"
            min="1"
          />
        </td>
        <td>
          <select
            value={editData.work_method}
            onChange={(e) => handleInputChange('work_method', e.target.value as 'sequential' | 'staggered')}
            className="input-field"
          >
            <option value="sequential">Последовательно</option>
            <option value="staggered">Шахматный</option>
          </select>
        </td>
        <td>
          <strong>{result.single_cycle_days}д</strong>
        </td>
        <td>
          <strong>{result.staggered_duration_days}д</strong>
        </td>
        <td>
          {timeSavingsDays > 0 ? (
            <span className="savings">
              -{timeSavingsDays}д ({timeSavingsPercent.toFixed(1)}%)
            </span>
          ) : (
            <span>-</span>
          )}
        </td>
        <td>
          <div className="row-actions">
            <button onClick={handleSave} className="btn-save">✓</button>
            <button onClick={onCancel} className="btn-cancel">✕</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>{capture.part_name}</td>
      <td>
        {capture.length_m.toFixed(1)} × {capture.width_m.toFixed(1)} × {capture.height_m?.toFixed(1) || '-'}
      </td>
      <td>{capture.area_m2.toFixed(1)}</td>
      <td>{capture.assembly_norm_ph_m2.toFixed(2)}</td>
      <td>{capture.num_kits}</td>
      <td>
        {capture.work_method === 'sequential' ? 'Послед.' : 'Шахм.'}
      </td>
      <td>
        {result.assembly_days} + {result.curing_days} + {result.disassembly_days} = <strong>{result.single_cycle_days}д</strong>
      </td>
      <td>
        <strong>{result.staggered_duration_days}д</strong>
      </td>
      <td>
        {timeSavingsDays > 0 ? (
          <span className="savings">
            -{timeSavingsDays}д ({timeSavingsPercent.toFixed(1)}%)
          </span>
        ) : (
          <span className="no-savings">-</span>
        )}
      </td>
      <td>
        <div className="row-actions">
          <button onClick={onEdit} className="btn-edit" title="Редактировать">✎</button>
          <button onClick={onDelete} className="btn-delete" title="Удалить">🗑</button>
        </div>
      </td>
    </tr>
  );
}

// Styles
const styles = `
  .dimensions {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .input-field {
    padding: 6px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9em;
    width: 70px;
  }

  .input-field:focus {
    outline: none;
    border-color: #2196f3;
    background-color: #f0f7ff;
  }

  .row-actions {
    display: flex;
    gap: 4px;
  }

  .btn-edit,
  .btn-delete,
  .btn-save,
  .btn-cancel {
    background: #f0f0f0;
    border: 1px solid #ccc;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.9em;
    transition: all 0.2s;
  }

  .btn-edit:hover {
    background: #2196f3;
    color: white;
    border-color: #2196f3;
  }

  .btn-delete:hover {
    background: #f44336;
    color: white;
    border-color: #f44336;
  }

  .btn-save {
    background: #4caf50;
    color: white;
    border-color: #4caf50;
  }

  .btn-save:hover {
    background: #45a049;
  }

  .btn-cancel {
    background: #999;
    color: white;
    border-color: #999;
  }

  .btn-cancel:hover {
    background: #777;
  }

  .savings {
    color: #4caf50;
    font-weight: bold;
  }

  .no-savings {
    color: #999;
  }

  tr.editing {
    background-color: #fff3e0;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}
