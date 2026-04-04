/**
 * FlatProjectSettings — Compact inline panel for project-level defaults.
 *
 * Three-level cascade: Project → Position → Calculator.
 * This panel controls Level 1 (project defaults).
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configAPI } from '../../services/api';
import { useUI } from '../../context/UIContext';
import { useProjectPositions } from '../../hooks/useProjectPositions';

export default function FlatProjectSettings() {
  const { selectedProjectId, daysPerMonth, setDaysPerMonth } = useUI();
  const { positions, updatePositions } = useProjectPositions();
  const qc = useQueryClient();

  // Fetch project config
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => configAPI.get(),
    staleTime: 10 * 60_000,
  });

  const [wage, setWage] = useState(398);
  const [shift, setShift] = useState(10);

  // Sync from config
  useEffect(() => {
    if (config?.defaults) {
      if (config.defaults.DAYS_PER_MONTH_DEFAULT) {
        setDaysPerMonth(config.days_per_month_mode || config.defaults.DAYS_PER_MONTH_DEFAULT);
      }
    }
  }, [config, setDaysPerMonth]);

  // Update config mutation
  const configMutation = useMutation({
    mutationFn: (updates: Record<string, any>) => configAPI.update(updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config'] }),
  });

  // Handle wage change at project level
  const handleWageChange = useCallback(async () => {
    if (!selectedProjectId) return;

    // Ask user if they want to update existing positions
    const defaultWage = config?.defaults?.DEFAULT_WAGE_CZK_PH ?? 398;
    const nonOverridden = positions.filter(p => p.wage_czk_ph === defaultWage);

    if (nonOverridden.length > 0) {
      const update = confirm(
        `Přepsat zároveň ${nonOverridden.length} stávajících pozic bez přepsání?\n` +
        `(Pozice s vlastní sazbou zůstanou beze změny)`
      );

      if (update) {
        const updates = nonOverridden
          .filter(p => p.id)
          .map(p => ({ id: p.id!, wage_czk_ph: wage }));
        if (updates.length) await updatePositions(updates);
      }
    }

    // Update project config
    await configMutation.mutateAsync({
      defaults: { ...(config?.defaults || {}), DEFAULT_WAGE_CZK_PH: wage },
    });
  }, [wage, positions, config, selectedProjectId, updatePositions, configMutation]);

  // Handle shift change at project level
  const handleShiftChange = useCallback(async () => {
    if (!selectedProjectId) return;

    const defaultShift = config?.defaults?.DEFAULT_SHIFT_HOURS ?? 10;
    const nonOverridden = positions.filter(p => p.shift_hours === defaultShift);

    if (nonOverridden.length > 0) {
      const update = confirm(
        `Přepsat zároveň ${nonOverridden.length} stávajících pozic bez přepsání?\n` +
        `(Pozice s vlastním nastavením zůstanou beze změny)`
      );

      if (update) {
        const updates = nonOverridden
          .filter(p => p.id)
          .map(p => ({ id: p.id!, shift_hours: shift }));
        if (updates.length) await updatePositions(updates);
      }
    }

    await configMutation.mutateAsync({
      defaults: { ...(config?.defaults || {}), DEFAULT_SHIFT_HOURS: shift },
    });
  }, [shift, positions, config, selectedProjectId, updatePositions, configMutation]);

  // Handle days per month change
  const handleModeChange = useCallback(async (mode: 30 | 22) => {
    setDaysPerMonth(mode);
    await configMutation.mutateAsync({ days_per_month_mode: mode });
    // Refetch positions to recalculate KPI
    qc.invalidateQueries({ queryKey: ['positions', selectedProjectId] });
  }, [setDaysPerMonth, configMutation, qc, selectedProjectId]);

  if (!selectedProjectId) return null;

  return (
    <div className="flat-settings">
      <div className="flat-settings__field">
        <span className="flat-settings__label">Zároveň</span>
        <input
          className="flat-settings__input"
          type="number"
          value={wage}
          onChange={e => setWage(Number(e.target.value))}
          onBlur={handleWageChange}
          onKeyDown={e => e.key === 'Enter' && handleWageChange()}
        />
        <span className="flat-settings__unit">Kč/h</span>
      </div>

      <div className="flat-settings__field">
        <span className="flat-settings__label">Směna</span>
        <input
          className="flat-settings__input"
          type="number"
          value={shift}
          onChange={e => setShift(Number(e.target.value))}
          onBlur={handleShiftChange}
          onKeyDown={e => e.key === 'Enter' && handleShiftChange()}
        />
        <span className="flat-settings__unit">h</span>
      </div>

      <div className="flat-settings__field">
        <span className="flat-settings__label">Režim</span>
        <select
          className="flat-settings__select"
          value={daysPerMonth}
          onChange={e => handleModeChange(Number(e.target.value) as 30 | 22)}
        >
          <option value={22}>22 dní/měs</option>
          <option value={30}>30 dní/měs</option>
        </select>
      </div>
    </div>
  );
}
