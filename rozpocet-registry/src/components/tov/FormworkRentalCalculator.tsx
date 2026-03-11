import { useState } from 'react';
import { Modal } from '../common/Modal';

interface FormworkRentalCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToRegistry: (calculation: FormworkCalculation) => void;
}

interface FormworkCalculation {
  area_m2: number;
  system: string;
  height: number;
  rental_days: number;
  unit_price_czk_m2_day: number;
  total_rental_czk: number;
  breakdown?: { daily_cost: number };
}

const FORMWORK_SYSTEMS = ['FRAMI XLIFE', 'FRAMAX XLIFE', 'STAXO100'];
const HEIGHTS = [1.2, 1.5, 2.4, 2.7, 3.0];

// Price table (Kč/m²/day) — source: rozpocet-registry-backend/server.js
const FORMWORK_PRICES: Record<string, { base: number; heights: Record<number, number> }> = {
  'FRAMI XLIFE':  { base: 8.5,  heights: { 1.2: 0.9, 1.5: 1.0, 2.4: 1.1, 2.7: 1.15, 3.0: 1.2 } },
  'FRAMAX XLIFE': { base: 9.0,  heights: { 1.5: 1.0, 2.4: 1.1, 2.7: 1.15, 3.0: 1.2 } },
  'STAXO100':     { base: 12.0, heights: { 2.7: 1.0, 3.0: 1.1 } },
};

export default function FormworkRentalCalculator({ isOpen, onClose, onAddToRegistry }: FormworkRentalCalculatorProps) {
  const [area, setArea] = useState<number>(100);
  const [system, setSystem] = useState<string>('FRAMI XLIFE');
  const [height, setHeight] = useState<number>(2.7);
  const [rentalDays, setRentalDays] = useState<number>(15);
  const [calculation, setCalculation] = useState<FormworkCalculation | null>(null);

  const handleCalculate = () => {
    const priceConfig = FORMWORK_PRICES[system];
    if (!priceConfig) return;

    const heightMultiplier = priceConfig.heights[height] ?? 1.0;
    const unit_price_czk_m2_day = Math.round(priceConfig.base * heightMultiplier * 100) / 100;
    const total_rental_czk = Math.round(unit_price_czk_m2_day * area * rentalDays);
    const daily_cost = Math.round(unit_price_czk_m2_day * area);

    setCalculation({
      area_m2: area,
      system,
      height,
      rental_days: rentalDays,
      unit_price_czk_m2_day,
      total_rental_czk,
      breakdown: { daily_cost },
    });
  };

  const handleAdd = () => {
    if (calculation) {
      onAddToRegistry(calculation);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kalkulátor nájmu bednění">
      <div style={{ padding: '20px', minWidth: '500px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Plocha (m²)</label>
          <input
            type="number"
            value={area}
            onChange={(e) => setArea(Number(e.target.value))}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Systém bednění</label>
          <select
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            {FORMWORK_SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Výška (m)</label>
          <select
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            {HEIGHTS.map(h => <option key={h} value={h}>{h} m</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Dny nájmu</label>
          <input
            type="number"
            value={rentalDays}
            onChange={(e) => setRentalDays(Number(e.target.value))}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <small style={{ color: '#666' }}>max(Výztuž, Betonování, Zrání, Montáž, Demontáž)</small>
        </div>

        <button
          onClick={handleCalculate}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          Vypočítat
        </button>

        {calculation && (
          <div style={{ backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Výsledek</h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cena za m²/den:</span>
                <strong>{calculation.unit_price_czk_m2_day} Kč</strong>
              </div>
              {calculation.breakdown && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Denní náklady:</span>
                <strong>{calculation.breakdown.daily_cost} Kč</strong>
              </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '2px solid #ddd' }}>
                <span style={{ fontSize: '16px', fontWeight: 600 }}>Celkem nájem:</span>
                <strong style={{ fontSize: '18px', color: '#2563eb' }}>{calculation.total_rental_czk} Kč</strong>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: '#e5e7eb',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Zrušit
          </button>
          <button
            onClick={handleAdd}
            disabled={!calculation}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: calculation ? '#10b981' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: calculation ? 'pointer' : 'not-allowed'
            }}
          >
            Přidat do Registry TOV
          </button>
        </div>
      </div>
    </Modal>
  );
}
