/**
 * FlatProjectSettings — "⚙ Nastavení projektu" strip.
 *
 * Visually distinct from KPI: white/transparent bg, form-style inputs.
 * Labels ABOVE inputs, segment toggle for Režim (22/30).
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { configAPI } from '../../services/api';
import { useUI } from '../../context/UIContext';
import { useProjectPositions } from '../../hooks/useProjectPositions';

export default function FlatProjectSettings() {
  const { selectedProjectId, daysPerMonth, setDaysPerMonth } = useUI();
  const { positions, updatePositions } = useProjectPositions();
  const qc = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => configAPI.get(),
    staleTime: 10 * 60_000,
  });

  const [wage, setWage] = useState(398);
  const [shift, setShift] = useState(10);

  useEffect(() => {
    if (config?.defaults) {
      if (config.defaults.DEFAULT_WAGE_CZK_PH) setWage(config.defaults.DEFAULT_WAGE_CZK_PH);
      if (config.defaults.DEFAULT_SHIFT_HOURS) setShift(config.defaults.DEFAULT_SHIFT_HOURS);
      if (config.defaults.DAYS_PER_MONTH_DEFAULT) {
        setDaysPerMonth(config.days_per_month_mode || config.defaults.DAYS_PER_MONTH_DEFAULT);
      }
    }
  }, [config, setDaysPerMonth]);

  const configMutation = useMutation({
    mutationFn: (updates: Record<string, any>) => configAPI.update(updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config'] }),
  });

  const handleWageChange = useCallback(async () => {
    if (!selectedProjectId) return;
    const defaultWage = config?.defaults?.DEFAULT_WAGE_CZK_PH ?? 398;
    const nonOverridden = positions.filter(p => p.wage_czk_ph === defaultWage);
    if (nonOverridden.length > 0) {
      const update = confirm(
        `Přepsat zároveň ${nonOverridden.length} stávajících pozic bez přepsání?\n(Pozice s vlastní sazbou zůstanou beze změny)`
      );
      if (update) {
        const updates = nonOverridden.filter(p => p.id).map(p => ({ id: p.id!, wage_czk_ph: wage }));
        if (updates.length) await updatePositions(updates);
      }
    }
    await configMutation.mutateAsync({
      defaults: { ...(config?.defaults || {}), DEFAULT_WAGE_CZK_PH: wage },
    });
  }, [wage, positions, config, selectedProjectId, updatePositions, configMutation]);

  const handleShiftChange = useCallback(async () => {
    if (!selectedProjectId) return;
    const defaultShift = config?.defaults?.DEFAULT_SHIFT_HOURS ?? 10;
    const nonOverridden = positions.filter(p => p.shift_hours === defaultShift);
    if (nonOverridden.length > 0) {
      const update = confirm(
        `Přepsat zároveň ${nonOverridden.length} stávajících pozic bez přepsání?\n(Pozice s vlastním nastavením zůstanou beze změny)`
      );
      if (update) {
        const updates = nonOverridden.filter(p => p.id).map(p => ({ id: p.id!, shift_hours: shift }));
        if (updates.length) await updatePositions(updates);
      }
    }
    await configMutation.mutateAsync({
      defaults: { ...(config?.defaults || {}), DEFAULT_SHIFT_HOURS: shift },
    });
  }, [shift, positions, config, selectedProjectId, updatePositions, configMutation]);

  const handleModeChange = useCallback(async (mode: 30 | 22) => {
    setDaysPerMonth(mode);
    await configMutation.mutateAsync({ days_per_month_mode: mode });
    qc.invalidateQueries({ queryKey: ['positions', selectedProjectId] });
  }, [setDaysPerMonth, configMutation, qc, selectedProjectId]);

  if (!selectedProjectId) return null;

  return (
    <div className="pset">
      {/* Marker */}
      <div className="pset__marker">
        <Settings size={12} />
        <span>Nastavení projektu</span>
      </div>

      {/* Výchozí sazba */}
      <div className="pset__field">
        <label className="pset__label">Výchozí sazba</label>
        <div className="pset__input-row">
          <input className="pset__input" type="number" min="0"
            value={wage} onChange={e => setWage(Number(e.target.value))}
            onBlur={handleWageChange} onKeyDown={e => e.key === 'Enter' && handleWageChange()} />
          <span className="pset__unit">Kč/h</span>
        </div>
      </div>

      {/* Směna */}
      <div className="pset__field">
        <label className="pset__label">Směna</label>
        <div className="pset__input-row">
          <input className="pset__input" type="number" min="0.5" step="0.5"
            value={shift} onChange={e => setShift(Number(e.target.value))}
            onBlur={handleShiftChange} onKeyDown={e => e.key === 'Enter' && handleShiftChange()} />
          <span className="pset__unit">h/den</span>
        </div>
      </div>

      {/* Režim — segment toggle */}
      <div className="pset__field" style={{ marginLeft: 'auto' }}>
        <label className="pset__label">Režim</label>
        <div className="pset__toggle">
          <button
            className={`pset__toggle-btn ${daysPerMonth === 22 ? 'pset__toggle-btn--on' : ''}`}
            onClick={() => handleModeChange(22)}
          >
            22 dní/měs
          </button>
          <button
            className={`pset__toggle-btn ${daysPerMonth === 30 ? 'pset__toggle-btn--on' : ''}`}
            onClick={() => handleModeChange(30)}
          >
            30 dní/měs
          </button>
        </div>
      </div>
    </div>
  );
}
