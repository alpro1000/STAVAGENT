/**
 * Technologická posloupnost — acceptance 6/12/13: závislosti (ne plochý
 * seznam), BK řetězec s ověřením polohy PŘED upnutím, překážky automaticky,
 * počet podbití podle druhu stavby.
 */
import { describe, expect, it } from 'vitest';
import type { RailPlannerInput } from '../types.js';
import { planRailSection } from './rail-orchestrator.js';

function plan(overrides: Partial<RailPlannerInput> = {}) {
  return planRailSection({
    section_length_m: 1000,
    track_count: 1,
    assembly_id: 'UIC60_bezstykova',
    project_kind: 'novostavba',
    ...overrides,
  });
}

function ids(p: ReturnType<typeof plan>) {
  return p.sequence.map(ph => ph.id);
}

describe('kanonická posloupnost (TASK §3.9)', () => {
  it('novostavba: spodek → lože → pokládka → doplnění → 2× podbití → stabilizace → BK → finál → GPK → předání', () => {
    const p = plan();
    const order = ids(p);
    const expectBefore = (a: string, b: string) =>
      expect(order.indexOf(a), `${a} musí být před ${b}`).toBeLessThan(order.indexOf(b));
    expectBefore('zemni_prace_spodku', 'plan_spodku');
    expectBefore('plan_spodku', 'konstrukcni_vrstvy');
    expectBefore('konstrukcni_vrstvy', 'loze_spodni_vrstva');
    expectBefore('loze_spodni_vrstva', 'pokladka_rostu');
    expectBefore('pokladka_rostu', 'doplneni_loze');
    expectBefore('doplneni_loze', 'podbiti_1');
    expectBefore('podbiti_1', 'podbiti_2');
    expectBefore('podbiti_2', 'stabilizace');
    expectBefore('stabilizace', 'bk_priprava');
    expectBefore('bk_kontrolni_mereni', 'finalni_uprava');
    expectBefore('finalni_uprava', 'mereni_gpk');
    expectBefore('mereni_gpk', 'montaz_prekazek');
    expectBefore('montaz_prekazek', 'predani');
  });

  it('BK řetězec: příprava → ověření polohy → svařování → upnutí → závěrné svary → kontrola (nikdy jen „svar × počet")', () => {
    const p = plan();
    expect(p.bk_chain.map(ph => ph.id)).toEqual([
      'bk_priprava',
      'bk_overeni_polohy',
      'bk_svarovani',
      'bk_upnuti',
      'bk_zaverne_svary',
      'bk_kontrolni_mereni',
    ]);
    const svarovani = p.bk_chain.find(ph => ph.id === 'bk_svarovani')!;
    expect(svarovani.depends_on).toContain('bk_overeni_polohy');
    const upnuti = p.bk_chain.find(ph => ph.id === 'bk_upnuti')!;
    expect(upnuti.name_cs).toContain('17–23');
  });

  it('stykovaná kolej BK řetězec nemá', () => {
    const p = plan({ assembly_id: 'S49_stykovana' });
    expect(p.bk_chain).toEqual([]);
  });

  it('údržba: 1 podbití, bez stabilizace a bez pokládky (KB tabulka podle druhu stavby)', () => {
    const p = plan({ project_kind: 'udrzba' });
    const order = ids(p);
    expect(order).toContain('podbiti_1');
    expect(order).not.toContain('podbiti_2');
    expect(order).not.toContain('stabilizace');
    expect(order).not.toContain('pokladka_rostu');
  });

  it('rekonstrukce: čištění lože před doplněním', () => {
    const p = plan({ project_kind: 'rekonstrukce' });
    const order = ids(p);
    expect(order.indexOf('cisteni_loze')).toBeLessThan(order.indexOf('doplneni_loze'));
  });
});

describe('překážky — generují se automaticky (acceptance 13)', () => {
  it('demontáž PŘED strojní linkou, zpětná montáž po měření GPK', () => {
    const p = plan({ obstacles: { prejezdy: 2, ukolejneni: 4 } });
    const demontaz = p.sequence.find(ph => ph.id === 'demontaz_prekazek')!;
    const pokladka = p.sequence.find(ph => ph.id === 'pokladka_rostu')!;
    expect(pokladka.depends_on).toContain('demontaz_prekazek');
    expect(demontaz.quantity?.value).toBe(6);
    const montaz = p.sequence.find(ph => ph.id === 'montaz_prekazek')!;
    expect(montaz.depends_on).toContain('mereni_gpk');
    // samostatné položky ve výkazu
    expect(p.vykaz.some(i => i.id === 'prekazky_prejezdy')).toBe(true);
    expect(p.vykaz.some(i => i.id === 'prekazky_ukolejneni')).toBe(true);
  });

  it('nezadané překážky → fáze s prázdnou výměrou + ℹ️ připomínka', () => {
    const p = plan();
    const demontaz = p.sequence.find(ph => ph.id === 'demontaz_prekazek')!;
    expect(demontaz.quantity?.status).toBe('nepocitano');
    expect(p.warnings.some(w => w.includes('Překážky'))).toBe(true);
  });
});

describe('výhybkové fáze', () => {
  it('montáž po pokládce, podbití výhybek po montáži i 1. podbití', () => {
    const p = plan({ turnouts: [{ form_id: 'J60_1_9_300', count: 1 }] });
    const podbiti = p.sequence.find(ph => ph.id === 'vyhybky_podbiti')!;
    expect(podbiti.depends_on).toEqual(expect.arrayContaining(['vyhybky_montaz', 'podbiti_1']));
    const final = p.sequence.find(ph => ph.id === 'finalni_uprava')!;
    expect(final.depends_on).toContain('vyhybky_podbiti');
  });
});

describe('DAG konzistence', () => {
  it('každá závislost ukazuje na existující fázi', () => {
    const p = plan({ turnouts: [{ form_id: 'J60_1_9_300', count: 1 }], obstacles: { prejezdy: 1 } });
    const all = new Set(ids(p));
    for (const ph of p.sequence) {
      for (const dep of ph.depends_on) expect(all.has(dep), `${ph.id} → ${dep}`).toBe(true);
    }
  });
});
