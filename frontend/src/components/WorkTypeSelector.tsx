/**
 * WorkTypeSelector - Select work type when adding a new position row
 * Types: beton, bednění, výztuž, oboustranné (opěry), jiné (custom)
 */

import { useState } from 'react';
import type { Subtype, Unit } from '@stavagent/monolit-shared';

interface WorkType {
  value: Subtype;
  label: string;
  unit: Unit;
  icon: string;
}

const WORK_TYPES: WorkType[] = [
  { value: 'beton', label: 'Betonování', unit: 'M3', icon: '🧱' },
  { value: 'bednění', label: 'Bednění', unit: 'm2', icon: '🪵' },
  { value: 'výztuž', label: 'Výztuž', unit: 't', icon: '⚙️' },
  { value: 'oboustranné (opěry)', label: 'Oboustranné bednění', unit: 'm2', icon: '📐' },
  { value: 'jiné', label: 'Jiné (vlastní práce)', unit: 'ks', icon: '➕' }
];

interface Props {
  onSelect: (subtype: Subtype, unit: Unit) => void;
  onCancel: () => void;
}

export default function WorkTypeSelector({ onSelect, onCancel }: Props) {
  const [selectedType, setSelectedType] = useState<Subtype | null>(null);

  const handleSelect = (type: WorkType) => {
    setSelectedType(type.value);
    // Small delay for visual feedback
    setTimeout(() => {
      onSelect(type.value, type.unit);
    }, 150);
  };

  return (
    <div className="work-type-selector-overlay" onClick={onCancel}>
      <div className="work-type-selector" onClick={(e) => e.stopPropagation()}>
        <h3 className="work-type-title">Vyberte typ práce</h3>
        <div className="work-type-grid">
          {WORK_TYPES.map((type) => (
            <button
              key={type.value}
              className={`work-type-card ${selectedType === type.value ? 'selected' : ''}`}
              onClick={() => handleSelect(type)}
              title={`Přidat: ${type.label} (${type.unit})`}
            >
              <span className="work-type-icon">{type.icon}</span>
              <span className="work-type-label">{type.label}</span>
              <span className="work-type-unit">{type.unit}</span>
            </button>
          ))}
        </div>
        <button className="btn-cancel-work-type" onClick={onCancel}>
          Zrušit
        </button>
      </div>

      <style>{`
        .work-type-selector-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .work-type-selector {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 2rem;
          max-width: 600px;
          width: 90%;
          box-shadow: var(--shadow-xl);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .work-type-title {
          margin: 0 0 1.5rem 0;
          font-size: 1.5rem;
          color: var(--text-primary);
          text-align: center;
        }

        .work-type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .work-type-card {
          background: var(--bg-tertiary);
          border: 2px solid var(--border-default);
          border-radius: 8px;
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .work-type-card:hover {
          border-color: var(--color-primary);
          background: var(--bg-hover);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .work-type-card.selected {
          border-color: var(--color-success);
          background: rgba(76, 175, 80, 0.1);
          animation: pulse 0.3s ease;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .work-type-icon {
          font-size: 2.5rem;
          line-height: 1;
        }

        .work-type-label {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-primary);
          text-align: center;
          line-height: 1.3;
        }

        .work-type-unit {
          font-size: 0.8rem;
          color: var(--text-secondary);
          font-family: var(--font-mono);
          background: var(--bg-dark);
          padding: 2px 8px;
          border-radius: 4px;
        }

        .btn-cancel-work-type {
          width: 100%;
          padding: 0.75rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-default);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-cancel-work-type:hover {
          background: var(--bg-dark);
          border-color: var(--border-hover);
        }

        /* Small devices (14" laptop, tablets) - 600px to 900px */
        @media (max-width: 900px) and (min-width: 481px) {
          .work-type-selector {
            padding: 1.5rem;
            max-width: 90vw;
          }

          .work-type-title {
            font-size: 1.25rem;
            margin-bottom: 1rem;
          }

          .work-type-grid {
            grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
            gap: 0.75rem;
            margin-bottom: 1rem;
          }

          .work-type-card {
            padding: 1rem 0.75rem;
          }

          .work-type-icon {
            font-size: 2rem;
          }

          .work-type-label {
            font-size: 0.8rem;
          }

          .work-type-unit {
            font-size: 0.7rem;
            padding: 2px 6px;
          }
        }

        /* Mobile responsive */
        @media (max-width: 480px) {
          .work-type-selector {
            padding: 1rem;
            width: 95%;
          }

          .work-type-title {
            font-size: 1.1rem;
            margin-bottom: 0.75rem;
          }

          .work-type-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
            margin-bottom: 1rem;
          }

          .work-type-card {
            padding: 0.75rem 0.5rem;
          }

          .work-type-icon {
            font-size: 1.75rem;
          }

          .work-type-label {
            font-size: 0.75rem;
          }

          .work-type-unit {
            font-size: 0.65rem;
          }

          .btn-cancel-work-type {
            padding: 0.6rem;
            font-size: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
}
