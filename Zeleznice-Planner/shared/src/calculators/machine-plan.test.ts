/**
 * Mechanizace — acceptance 8/9/10: výkon podle režimu, priorita uživatelské
 * normy (0.99), omezení strojů (pražce Y, poloměr), honest-blank bez normy.
 */
import { describe, expect, it } from 'vitest';
import { RAIL_MACHINES } from '../kb-generated/zeleznice-mechanizace.js';
import type { RailPlannerInput } from '../types.js';
import { planRailSection } from './rail-orchestrator.js';
import { resolveMachineRate } from './machine-plan.js';

function plan(overrides: Partial<RailPlannerInput> = {}) {
  return planRailSection({
    section_length_m: 1000,
    track_count: 1,
    assembly_id: 'UIC60_bezstykova',
    project_kind: 'novostavba',
    ...overrides,
  });
}

describe('výkon stroje závisí na režimu (registr KB)', () => {
  it('ASP kontinuální 16: propracování 600 / 2 záběry 400 / po pokládce 350 m/h', () => {
    const asp = RAIL_MACHINES.find(m => m.id === 'asp_kontinualni_16')!;
    const rates = Object.fromEntries(asp.modes.map(m => [m.id, m.rate.value]));
    expect(rates).toEqual({ propracovani: 600, dva_zabery: 400, po_pokladce: 350 });
  });

  it('1. podbití novostavby volí režim „po pokládce" (350 m/h → 2.86 h)', () => {
    const p = plan();
    const row = p.machine_deployment.find(r => r.phase_id === 'podbiti_1')!;
    expect(row.machine?.mode_id).toBe('po_pokladce');
    expect(row.hours.value).toBeCloseTo(1000 / 350, 2);
  });

  it('2. podbití volí propracování (600 m/h)', () => {
    const p = plan();
    const row = p.machine_deployment.find(r => r.phase_id === 'podbiti_2')!;
    expect(row.machine?.mode_id).toBe('propracovani');
    expect(row.hours.value).toBeCloseTo(1000 / 600, 2);
  });
});

describe('priorita uživatelské normy firmy (0.99 > KB 0.80)', () => {
  it('user norm přepíše katalogový výkon a nese zdroj „uživatelská norma firmy"', () => {
    const asp = RAIL_MACHINES.find(m => m.id === 'asp_kontinualni_16')!;
    const mode = asp.modes.find(m => m.id === 'po_pokladce')!;
    const rate = resolveMachineRate(asp, mode, [
      { machine_id: 'asp_kontinualni_16', rate_value: 500, rate_unit: 'm/h' },
    ]);
    expect(rate.value).toBe(500);
    expect(rate.confidence).toBe(0.99);
    expect(rate.source).toContain('uživatelská norma');
  });

  it('v plánu je zdroj normy viditelný (acceptance 10)', () => {
    const p = plan({
      user_machine_norms: [{ machine_id: 'asp_kontinualni_16', rate_value: 500, rate_unit: 'm/h' }],
    });
    const row = p.machine_deployment.find(r => r.phase_id === 'podbiti_1')!;
    expect(row.machine?.rate_value).toBe(500);
    expect(row.machine?.rate_source).toContain('uživatelská norma');
    expect(row.hours.value).toBeCloseTo(2, 2);
  });
});

describe('omezení strojů (acceptance 9)', () => {
  it('pražce Y: kontinuální ASP vyloučena → auto volí dvoucestnou podbíječku', () => {
    const p = plan({ assembly_id: 'Y_ocelove_prazce', section_length_m: 300 });
    const row = p.machine_deployment.find(r => r.phase_id === 'podbiti_1')!;
    expect(row.machine?.machine_id).toBe('podbijecka_dvoucestna');
  });

  it('uživatelská volba vyloučeného stroje → ⛔ explicitní varování', () => {
    const p = plan({
      assembly_id: 'Y_ocelove_prazce',
      section_length_m: 300,
      machines: [{ work_type: 'podbiti_trate', machine_id: 'asp_kontinualni_16' }],
    });
    expect(p.warnings.some(w => w.startsWith('⛔') && w.includes('nelze nasadit na pražce'))).toBe(true);
  });

  it('poloměr oblouku pod limitem stroje → ⚠️ varování', () => {
    const p = plan({ curve_min_radius_m: 120 });
    expect(p.warnings.some(w => w.includes('poloměr oblouku'))).toBe(true);
  });
});

describe('honest-blank: chybějící norma = NEPOČÍTÁNO (AI odhad zakázán)', () => {
  it('úprava lože (pluh SSP) nemá výkon v KB → doba NEPOČÍTÁNA s důvodem', () => {
    const p = plan();
    const row = p.machine_deployment.find(r => r.phase_id === 'doplneni_loze')!;
    expect(row.days.status).toBe('nepocitano');
    expect(row.days.reason_cs).toContain('není v KB');
  });

  it('user norm doplní chybějící normu úpravy lože (m/h)', () => {
    const p = plan({
      user_machine_norms: [{ machine_id: 'pluh_uprava_loze', rate_value: 500, rate_unit: 'm/h' }],
    });
    const row = p.machine_deployment.find(r => r.phase_id === 'doplneni_loze')!;
    expect(row.hours.value).toBeCloseTo(2, 2);
    expect(row.hours.confidence).toBe(0.99);
  });
});

describe('S8/3 technologický list — první předpisová norma (conf 0.85)', () => {
  it('pokládka roštu auto-volí SVM 1000 CZ: 1000 m / 400 m/h = 2.5 h, osádka 12', () => {
    const p = plan();
    const row = p.machine_deployment.find(r => r.phase_id === 'pokladka_rostu')!;
    expect(row.machine?.machine_id).toBe('svm_1000_cz');
    expect(row.hours.value).toBeCloseTo(2.5, 2);
    expect(row.machine?.rate_confidence).toBe(0.85);
    expect(row.machine?.crew_size).toBe(12);
    const crew = p.crews.machine_crews.find(c => c.machine_id === 'svm_1000_cz');
    expect(crew?.crew_size).toBe(12);
  });

  it('poloměr úseku pod 300 m → ⚠️ omezení SVM z přílohy III/15', () => {
    const p = plan({ curve_min_radius_m: 250 });
    expect(
      p.warnings.some(w => w.includes('Obnovovací stroj SVM 1000 CZ') && w.includes('300')),
    ).toBe(true);
  });
});

describe('výlukové okno vs směna', () => {
  it('bez výluky: dny = hodiny / směna 8 h', () => {
    const p = plan();
    const row = p.machine_deployment.find(r => r.phase_id === 'podbiti_1')!;
    expect(row.days.value).toBeCloseTo((1000 / 350) / 8, 2);
  });

  it('výlukové okno 4 h/den → dvojnásobek dní; okno viditelné ve vzorci', () => {
    const p = plan({ possession_window_h: 4 });
    const row = p.machine_deployment.find(r => r.phase_id === 'podbiti_1')!;
    expect(row.days.value).toBeCloseTo((1000 / 350) / 4, 2);
    expect(row.days.formula).toContain('výlukové okno');
  });
});
