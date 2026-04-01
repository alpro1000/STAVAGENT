import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import { calculateBatchPlan, BatchPlan, DilationJoint } from '@stavagent/monolit-shared';

interface BatchCalculatorUIProps {
  /** Начальный объем бетона (m³) */
  initialVolume: number;
  /** Начальная длина (m) */
  initialLength?: number;
  /** Тип элемента */
  elementType: 'foundation' | 'wall' | 'column' | 'slab';
  /** Callback при изменении плана */
  onPlanChange?: (plan: BatchPlan) => void;
}

export const BatchCalculatorUI: React.FC<BatchCalculatorUIProps> = ({
  initialVolume,
  initialLength = 100,
  elementType,
  onPlanChange,
}) => {
  const [volume, setVolume] = useState(initialVolume);
  const [length, setLength] = useState(initialLength);
  const [elementCount, setElementCount] = useState(10);
  const [height, setHeight] = useState(3);
  const [width, setWidth] = useState(0.3);
  const [maxBatchVolume, setMaxBatchVolume] = useState(50);
  const [joints, setJoints] = useState<DilationJoint[]>([]);
  const [plan, setPlan] = useState<BatchPlan | null>(null);

  const calculate = () => {
    const newPlan = calculateBatchPlan({
      element_type: elementType,
      total_length_m: length,
      total_volume_m3: volume,
      element_count: elementCount,
      dilation_joints: joints,
      max_batch_volume_m3: maxBatchVolume,
      height_m: height,
      width_m: width,
    });
    setPlan(newPlan);
    onPlanChange?.(newPlan);
  };

  const addJoint = () => {
    setJoints([...joints, { position_m: length / 2, type: 'construction' }]);
  };

  const removeJoint = (index: number) => {
    setJoints(joints.filter((_, i) => i !== index));
  };

  return (
    <div className="batch-calculator">
      <style>{`
        .batch-calculator {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .batch-header {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 20px;
          color: #1a1a1a;
        }
        .batch-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        .batch-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .batch-label {
          font-size: 13px;
          font-weight: 500;
          color: #666;
        }
        .batch-input {
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        .batch-input:focus {
          outline: none;
          border-color: #2563eb;
        }
        .batch-joints {
          margin: 20px 0;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .batch-joints-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .batch-joint-item {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 8px;
        }
        .batch-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .batch-btn-primary {
          background: #2563eb;
          color: white;
        }
        .batch-btn-primary:hover {
          background: #1d4ed8;
        }
        .batch-btn-secondary {
          background: #e5e7eb;
          color: #374151;
        }
        .batch-btn-secondary:hover {
          background: #d1d5db;
        }
        .batch-btn-danger {
          background: #ef4444;
          color: white;
          padding: 6px 12px;
          font-size: 12px;
        }
        .batch-results {
          margin-top: 24px;
          border-top: 2px solid #e5e7eb;
          padding-top: 24px;
        }
        .batch-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        .batch-summary-card {
          background: #f0f9ff;
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid #2563eb;
        }
        .batch-summary-value {
          font-size: 28px;
          font-weight: 700;
          color: #1e40af;
        }
        .batch-summary-label {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }
        .batch-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
        }
        .batch-table th {
          background: #f8f9fa;
          padding: 12px;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
        }
        .batch-table td {
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
        }
        .batch-table tr:hover {
          background: #f9fafb;
        }
        .batch-number {
          display: inline-block;
          background: #2563eb;
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 13px;
        }
        .section-badge {
          display: inline-block;
          background: #e0e7ff;
          color: #3730a3;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          margin-right: 4px;
        }
      `}</style>

      <div className="batch-header">
        <Calculator size={18} className="inline" /> Калькулятор тактов заливки
      </div>

      <div className="batch-grid">
        <div className="batch-input-group">
          <label className="batch-label">Объем бетона (м³)</label>
          <input
            type="number"
            className="batch-input"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </div>

        <div className="batch-input-group">
          <label className="batch-label">Длина элемента (m)</label>
          <input
            type="number"
            className="batch-input"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
          />
        </div>

        <div className="batch-input-group">
          <label className="batch-label">Количество элементов</label>
          <input
            type="number"
            className="batch-input"
            value={elementCount}
            onChange={(e) => setElementCount(Number(e.target.value))}
          />
        </div>

        <div className="batch-input-group">
          <label className="batch-label">Высота (m)</label>
          <input
            type="number"
            step="0.1"
            className="batch-input"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
          />
        </div>

        <div className="batch-input-group">
          <label className="batch-label">Ширина (m)</label>
          <input
            type="number"
            step="0.1"
            className="batch-input"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </div>

        <div className="batch-input-group">
          <label className="batch-label">Макс. объем за такт (м³)</label>
          <input
            type="number"
            className="batch-input"
            value={maxBatchVolume}
            onChange={(e) => setMaxBatchVolume(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="batch-joints">
        <div className="batch-joints-header">
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            🔗 Дилатационные швы ({joints.length})
          </span>
          <button className="batch-btn batch-btn-secondary" onClick={addJoint}>
            + Добавить шов
          </button>
        </div>
        {joints.map((joint, index) => (
          <div key={index} className="batch-joint-item">
            <input
              type="number"
              className="batch-input"
              style={{ flex: 1 }}
              value={joint.position_m}
              onChange={(e) => {
                const newJoints = [...joints];
                newJoints[index].position_m = Number(e.target.value);
                setJoints(newJoints);
              }}
              placeholder="Позиция (m)"
            />
            <select
              className="batch-input"
              style={{ flex: 1 }}
              value={joint.type}
              onChange={(e) => {
                const newJoints = [...joints];
                newJoints[index].type = e.target.value as any;
                setJoints(newJoints);
              }}
            >
              <option value="construction">Рабочий</option>
              <option value="expansion">Деформационный</option>
              <option value="settlement">Осадочный</option>
            </select>
            <button
              className="batch-btn batch-btn-danger"
              onClick={() => removeJoint(index)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button className="batch-btn batch-btn-primary" onClick={calculate}>
        🧮 Рассчитать такты
      </button>

      {plan && (
        <div className="batch-results">
          <div className="batch-summary">
            <div className="batch-summary-card">
              <div className="batch-summary-value">{plan.total_sections}</div>
              <div className="batch-summary-label">Всего секций (закладов)</div>
            </div>
            <div className="batch-summary-card">
              <div className="batch-summary-value">{plan.total_batches}</div>
              <div className="batch-summary-label">Рекомендуемых тактов</div>
            </div>
            <div className="batch-summary-card">
              <div className="batch-summary-value">{plan.total_volume_m3.toFixed(1)}</div>
              <div className="batch-summary-label">Общий объем (м³)</div>
            </div>
          </div>

          <table className="batch-table">
            <thead>
              <tr>
                <th>Такт</th>
                <th>Секции</th>
                <th>Объем (м³)</th>
                <th>Опалубка (м²)</th>
                <th>Бригада</th>
                <th>Дни</th>
              </tr>
            </thead>
            <tbody>
              {plan.recommended_batches.map((batch: any) => (
                <tr key={batch.batch_number}>
                  <td>
                    <span className="batch-number">#{batch.batch_number}</span>
                  </td>
                  <td>
                    {batch.section_numbers.map((n: any) => (
                      <span key={n} className="section-badge">
                        {n}
                      </span>
                    ))}
                  </td>
                  <td>{batch.volume_m3.toFixed(1)} м³</td>
                  <td>{batch.formwork_m2.toFixed(1)} м²</td>
                  <td>{batch.crew_size} чел</td>
                  <td>{batch.days} дн</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
