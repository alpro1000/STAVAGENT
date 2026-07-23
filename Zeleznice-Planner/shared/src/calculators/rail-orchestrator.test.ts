/**
 * Orchestrátor — acceptance 1/2/11/14/15/16: oddělení vrstev, katalog až po
 * dekompozici, km trati vs km koleje, osádky (Pattern 50), replay guarantee,
 * testy bez sítě/DB/AI.
 */
import { describe, expect, it } from 'vitest';
import type { RailPlannerInput } from '../types.js';
import { planRailSection } from './rail-orchestrator.js';
import { bindCatalog } from './catalog-binding.js';

function plan(overrides: Partial<RailPlannerInput> = {}) {
  return planRailSection({
    section_length_m: 1000,
    track_count: 1,
    assembly_id: 'UIC60_bezstykova',
    project_kind: 'novostavba',
    ...overrides,
  });
}

describe('vrstvy spodek/svršek se NIKDY nemíchají (acceptance 1)', () => {
  it('položka spodku nese layer=spodek a neprosákne do svršku', () => {
    const p = plan({
      spodek_items: [
        { name_cs: 'Odkopávky', unit: 'm³', quantity: 1200, work_type: 'zemni_prace' },
        { name_cs: 'Trativod DN 150', unit: 'm', quantity: 800, work_type: 'odvodneni' },
      ],
    });
    const spodek = p.vykaz.filter(i => i.layer === 'spodek');
    const svrsek = p.vykaz.filter(i => i.layer === 'svrsek');
    expect(spodek).toHaveLength(2);
    expect(svrsek.every(i => !i.name_cs.includes('Odkopávky') && !i.name_cs.includes('Trativod'))).toBe(true);
    expect(spodek.map(i => i.id)).toEqual(
      expect.arrayContaining(['spodek_0_zemni_prace', 'spodek_1_odvodneni']),
    );
    // fáze spodku nesou layer spodek
    for (const ph of p.sequence.filter(x => x.id.includes('spodku') || x.id === 'konstrukcni_vrstvy')) {
      expect(ph.layer).toBe('spodek');
    }
  });

  it('tloušťka lože (rozhraní vrstev) je v poznámce zdroje parametrického profilu', () => {
    const p = plan({
      ballast_profile: { mode: 'parametric', thickness_under_sleeper_m: 0.35, crown_width_m: 3.4, slope_ratio: 1.25 },
    });
    expect(p.quantities.loze_objem_m3.source.note).toContain('ložné plochy pražce po pláň');
  });
});

describe('katalog až PO dekompozici (acceptance 14, Catalog-Last)', () => {
  it('každá položka nese cenovou soustavu; SŽ → OTSKP_ZS, vlečka → URS_824_1; kódy se nefabrikují', () => {
    const sz = plan({ contract_type: 'sz_verejna' });
    expect(sz.vykaz.length).toBeGreaterThan(4);
    for (const item of sz.vykaz) {
      expect(item.catalog?.pricing_system).toBe('OTSKP_ZS');
      expect(item.catalog?.code).toBeNull();
      expect(item.catalog?.code_status).toBe('not_verified');
    }
    const vlecka = plan({ contract_type: 'vlecka' });
    for (const item of vlecka.vykaz) {
      expect(item.catalog?.pricing_system).toBe('URS_824_1');
    }
  });

  it('bindCatalog je čistá funkce nad hotovým výkazem (dekompozice katalog nezná)', () => {
    const items = [
      {
        id: 'x',
        layer: 'svrsek' as const,
        name_cs: 'Test',
        unit: 'ks',
        quantity: { value: 1, unit: 'ks', formula: '1', source: { document: 't' }, confidence: 1, status: 'ok' as const },
      },
    ];
    const bound = bindCatalog(items, 'vlecka');
    expect(items[0]).not.toHaveProperty('catalog');
    expect(bound[0].catalog?.pricing_system).toBe('URS_824_1');
  });
});

describe('km trati vs km koleje (acceptance 15)', () => {
  it('2 koleje: délka koleje = 2× délka trati; výměry na kolej', () => {
    const p = plan({ km_od: 12.4, km_do: 13.4, section_length_m: undefined, track_count: 2 });
    expect(p.section.delka_trati_m).toBeCloseTo(1000, 6);
    expect(p.section.delka_koleje_m).toBeCloseTo(2000, 6);
    expect(p.quantities.prazce_ks.value).toBe(2 * 1680);
    expect(p.quantities.kolejnice_delka_m.value).toBe(4000);
  });
});

describe('osádky a čety (acceptance 11, Pattern 50)', () => {
  it('osádka stroje vázaná na stroj; bezpečnostní role povinné v osádce', () => {
    const p = plan();
    const asp = p.crews.machine_crews.find(c => c.machine_id === 'asp_kontinualni_16');
    expect(asp?.crew_size).toBe(4);
    expect(p.crews.safety_roles.length).toBeGreaterThanOrEqual(2);
    expect(p.crews.safety_roles.every(r => r.mandatory)).toBe(true);
  });

  it('četa omezena kapacitou fronty, ne objemem (fronta 200 m → 4 os.)', () => {
    const short = plan({ front_length_m: 200 });
    expect(short.crews.track_gang.size).toBe(4);
    expect(short.crews.track_gang.front_capacity_limit).toBe(4);
    const long = plan({ front_length_m: 5000 });
    expect(long.crews.track_gang.size).toBe(long.crews.track_gang.base_size);
  });
});

describe('replay guarantee + hermetičnost (acceptance 16)', () => {
  it('stejné vstupy → byte-identický výstup (žádný čas/náhoda)', () => {
    const input: RailPlannerInput = {
      km_od: 105.2,
      km_do: 107.85,
      track_count: 2,
      assembly_id: 'UIC60_bezstykova',
      project_kind: 'rekonstrukce',
      contract_type: 'sz_verejna',
      turnouts: [{ form_id: 'J60_1_11_300', count: 2 }],
      obstacles: { prejezdy: 1, magneticke_body: 6 },
      ballast_profile: { mode: 'preset', preset_id: 'jednokolejna_bezstykova' },
      possession_window_h: 6,
    };
    expect(JSON.stringify(planRailSection(input))).toBe(JSON.stringify(planRailSection(input)));
  });

  it('chybějící délka úseku → typed NEPOČÍTÁNO (duck-marker uncalculated)', () => {
    try {
      planRailSection({ track_count: 1, assembly_id: 'UIC60_bezstykova' });
      expect.unreachable('měl vyhodit RailUncalculatedError');
    } catch (err: any) {
      expect(err.uncalculated).toBe(true);
      expect(err.reason_cs).toContain('NEPOČÍTÁNO');
      expect(err.missing_fields).toContain('section_length_m');
    }
  });

  it('neznámá sestava → typed invalid_input s výčtem povolených', () => {
    try {
      planRailSection({ section_length_m: 100, track_count: 1, assembly_id: 'nesmysl' });
      expect.unreachable('měl vyhodit RailInputError');
    } catch (err: any) {
      expect(err.invalid_input).toBe(true);
      expect(err.message).toContain('UIC60_bezstykova');
    }
  });

  it('warnings_structured zrcadlí ⛔/⚠️/ℹ️ prefixy', () => {
    const p = plan({
      assembly_id: 'Y_ocelove_prazce',
      section_length_m: 300,
      machines: [{ work_type: 'podbiti_trate', machine_id: 'asp_kontinualni_16' }],
    });
    const critical = p.warnings_structured.filter(w => w.severity === 'critical');
    expect(critical.length).toBeGreaterThan(0);
    expect(critical[0].message.startsWith('⛔')).toBe(true);
    expect(p.warnings_structured).toHaveLength(p.warnings.length);
  });

  it('typ zakázky nezadán → ℹ️ o defaultním routingu', () => {
    const p = plan({ contract_type: undefined });
    expect(p.warnings.some(w => w.includes('routing'))).toBe(true);
  });
});

describe('meta + echo', () => {
  it('výsledek nese verzi enginu, sestavu a formu koleje', () => {
    const p = plan();
    expect(p.meta.engine_version).toBe('1.0.0');
    expect(p.assembly.track_form).toBe('bezstykova');
    expect(p.assembly.rail_profile).toContain('UIC 60');
  });
});
