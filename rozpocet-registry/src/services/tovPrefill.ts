/**
 * TOV Pre-fill from Monolit Planner
 *
 * Converts MonolithPayload (with extended cost breakdown) into pre-filled
 * TOVData for labor, machinery, and formwork rental sections.
 *
 * Flow: PlannerOutput → MonolithPayload.costs/resources/formwork_info → TOVData
 *
 * Profession mapping (per CLAUDE.md):
 *   Betonování → Betonář
 *   Bednění    → Tesař/Bednář
 *   Výztuž     → Železář
 */

import type { MonolithPayload } from '../types/item';
import type { TOVData, LaborResource, MachineryResource, MaterialResource, FormworkRentalRow } from '../types/unified';

/**
 * Check if a MonolithPayload has extended cost data suitable for TOV pre-fill.
 */
export function hasExtendedCosts(mp: MonolithPayload | null | undefined): boolean {
  return !!(mp?.costs && mp?.resources);
}

/**
 * Generate pre-filled TOVData from MonolithPayload.
 * Returns undefined if payload lacks extended cost breakdown.
 */
export function prefillTOVFromMonolit(mp: MonolithPayload): TOVData | undefined {
  if (!mp.costs || !mp.resources) return undefined;

  const { costs, resources, formwork_info } = mp;
  const labor: LaborResource[] = [];
  let idCounter = 1;

  // Betonář (pour labor)
  if (costs.pour_labor_czk > 0) {
    const wageH = resources.wage_pour_czk_h || mp.wage_czk_ph || 398;
    const totalCost = costs.pour_labor_czk + (costs.pour_night_premium_czk || 0);
    const normHours = wageH > 0 ? totalCost / wageH : 0;
    labor.push({
      id: `prefill-${idCounter++}`,
      profession: 'Betonář',
      professionCode: 'BET',
      count: resources.pour_shifts || 1,
      hours: normHours / Math.max(1, resources.pour_shifts || 1),
      normHours: Math.round(normHours * 10) / 10,
      hourlyRate: wageH,
      totalCost: Math.round(totalCost),
      linkedCalcId: mp.monolit_position_id,
    });
  }

  // Tesař/Bednář (formwork labor)
  if (costs.formwork_labor_czk > 0) {
    const wageH = resources.wage_formwork_czk_h || mp.wage_czk_ph || 385;
    const normHours = wageH > 0 ? costs.formwork_labor_czk / wageH : 0;
    const count = resources.total_formwork_workers || resources.crew_size_formwork || 1;
    labor.push({
      id: `prefill-${idCounter++}`,
      profession: 'Tesař/Bednář',
      professionCode: 'TES',
      count,
      hours: Math.round((normHours / count) * 10) / 10,
      normHours: Math.round(normHours * 10) / 10,
      hourlyRate: wageH,
      totalCost: Math.round(costs.formwork_labor_czk),
      linkedCalcId: mp.monolit_position_id,
    });
  }

  // Železář (rebar labor)
  if (costs.rebar_labor_czk > 0) {
    const wageH = resources.wage_rebar_czk_h || mp.wage_czk_ph || 420;
    const normHours = wageH > 0 ? costs.rebar_labor_czk / wageH : 0;
    const count = resources.total_rebar_workers || resources.crew_size_rebar || 1;
    labor.push({
      id: `prefill-${idCounter++}`,
      profession: 'Železář',
      professionCode: 'ZEL',
      count,
      hours: Math.round((normHours / count) * 10) / 10,
      normHours: Math.round(normHours * 10) / 10,
      hourlyRate: wageH,
      totalCost: Math.round(costs.rebar_labor_czk),
      linkedCalcId: mp.monolit_position_id,
    });
  }

  // Props labor (if present)
  if (costs.props_labor_czk > 0) {
    const wageH = resources.wage_formwork_czk_h || mp.wage_czk_ph || 385;
    const normHours = wageH > 0 ? costs.props_labor_czk / wageH : 0;
    labor.push({
      id: `prefill-${idCounter++}`,
      profession: 'Podpěry/Props',
      professionCode: 'PRP',
      count: 1,
      hours: Math.round(normHours * 10) / 10,
      normHours: Math.round(normHours * 10) / 10,
      hourlyRate: wageH,
      totalCost: Math.round(costs.props_labor_czk),
      linkedCalcId: mp.monolit_position_id,
    });
  }

  const laborSummary = {
    totalNormHours: labor.reduce((s, l) => s + l.normHours, 0),
    totalWorkers: labor.reduce((s, l) => s + l.count, 0),
  };

  // Machinery — minimal: ponorný vibrátor for concrete
  const machinery: MachineryResource[] = [];
  if (costs.pour_labor_czk > 0) {
    machinery.push({
      id: `prefill-mach-1`,
      type: 'Ponorný vibrátor',
      count: 1,
      hours: labor.find(l => l.professionCode === 'BET')?.hours || 0,
      machineHours: labor.find(l => l.professionCode === 'BET')?.hours || 0,
      hourlyRate: 180,
      totalCost: Math.round(180 * (labor.find(l => l.professionCode === 'BET')?.hours || 0)),
    });
  }

  // Materials — concrete volume if known
  const materials: MaterialResource[] = [];
  if (mp.concrete_m3 && mp.concrete_m3 > 0) {
    materials.push({
      id: `prefill-mat-1`,
      name: `Beton (${mp.subtype || 'C30/37'})`,
      quantity: mp.concrete_m3,
      unit: 'm³',
      unitPrice: 0, // User fills actual concrete price per m³
      totalCost: 0,
      linkedCalcId: mp.monolit_position_id,
      linkedCalcType: 'monolit',
    });
  }

  // Formwork rental rows
  const formworkRental: FormworkRentalRow[] = [];
  if (formwork_info && costs.formwork_rental_czk > 0) {
    const fi = formwork_info;
    const pocetTaktu = fi.num_tacts || 1;
    const pocetSad = fi.num_sets || 1;
    const taktPerSet = Math.ceil(pocetTaktu / pocetSad);
    const dniNaTakt = fi.assembly_days || 2;
    const dniBetonTakt = fi.curing_days || 5;
    const dniDemontaz = fi.disassembly_days || 1;
    const dobaBedneni = taktPerSet * dniNaTakt;
    const celkemBeton = taktPerSet * dniBetonTakt;
    const celkovaDoba = dobaBedneni + celkemBeton + dniDemontaz;
    const sadaM2 = fi.formwork_area_m2 / pocetSad;
    const mesicniNajemJednotka = fi.rental_czk_m2_month || 0;
    const mesicniNajemSada = sadaM2 * mesicniNajemJednotka;
    const billingMonths = Math.max(1, celkovaDoba / 30);
    const najemNaklady = mesicniNajemSada * billingMonths * pocetSad;
    const podilKoupe = 0; // User fills from knowledge base

    formworkRental.push({
      id: `prefill-fw-1`,
      construction_name: mp.part_name || 'Konstrukce',
      celkem_m2: fi.formwork_area_m2,
      sada_m2: Math.round(sadaM2 * 10) / 10,
      pocet_taktu: pocetTaktu,
      auto_taktu: false,
      pocet_sad: pocetSad,
      dni_na_takt: dniNaTakt,
      dni_beton_takt: dniBetonTakt,
      dni_demontaz: dniDemontaz,
      doba_bedneni: dobaBedneni,
      celkem_beton: celkemBeton,
      celkova_doba: celkovaDoba,
      bednici_system: fi.system_name || '',
      rozmery: '',
      mesicni_najem_jednotka: mesicniNajemJednotka,
      mesicni_najem_sada: Math.round(mesicniNajemSada),
      najem_naklady: Math.round(najemNaklady),
      podil_koupe: podilKoupe,
      konecny_najem: Math.round(najemNaklady + podilKoupe),
    });
  }

  return {
    labor,
    laborSummary,
    machinery,
    machinerySummary: {
      totalMachineHours: machinery.reduce((s, m) => s + m.machineHours, 0),
      totalUnits: machinery.reduce((s, m) => s + m.count, 0),
    },
    materials,
    materialsSummary: {
      totalCost: materials.reduce((s, m) => s + (m.totalCost || 0), 0),
      itemCount: materials.length,
    },
    formworkRental: formworkRental.length > 0 ? formworkRental : undefined,
    monolitMetadata: {
      project_id: mp.monolit_project_id,
      part_name: mp.part_name,
      position_id: mp.monolit_position_id,
    },
  };
}
