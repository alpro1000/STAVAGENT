/**
 * applyPlanToPositions — Aplikovat split routing for the 7 work types.
 *
 * Used by useCalculator.handleApplyToPosition. Takes a calculator plan and:
 *   1. Builds 7 work entries (Betonář, Tesař montáž/demontáž, Železář,
 *      Ošetřovatel, Specialista předpětí, Podpěry — only nonzero ones).
 *   2. Routes each entry to its destination position:
 *        URL position_id (most reliable)
 *        → linked position via OTSKP/URS prefix or name fallback
 *        → AUTO-CREATE a new sibling Position record (POST)
 *        → last-resort merge into the main beton position
 *   3. POSTs new sibling positions (with their TOV metadata in one shot),
 *      then PUTs updates on every existing destination position in a
 *      single batch.
 *
 * Per-entry source flag: every labor entry carries source: 'calculator',
 * which the FlatTOVSection [×] delete gate uses to distinguish Aplikovat
 * rows from manual/import rows.
 *
 * Element-type filter: pilota and podzemni_stena skip the bednění /
 * odbednění drafts entirely — they use pažnice / tremie pipe / guide
 * walls, not systémové bednění.
 */

import {
  findLinkedPositions,
  type PlannerOutput,
  type TOVLaborEntry,
  type TOVMaterialEntry,
  type TOVEntries,
  type WorkType,
  type StructuralElementType,
} from '@stavagent/monolit-shared';
import { aggregateScheduleDays } from '@stavagent/monolit-shared';
import type { FormState } from './types';

// ─── Public types ───────────────────────────────────────────────────────────

export interface ApplyContext {
  plan: PlannerOutput;
  form: FormState;
  positionContext: {
    position_id?: string | null;
    part_name?: string;
    bridge_id?: string | null;
    project_id?: string | null;
    otskp_code?: string;
    bedneni_position_id?: string | null;
    odbedneni_position_id?: string | null;
    vyzuz_position_id?: string | null;
    podperna_position_id?: string | null;
    zrani_position_id?: string | null;
    predpeti_position_id?: string | null;
  };
  bridgeId: string;
  monolitDataMeta: Record<string, unknown>;
  apiUrl: string;
}

export interface ApplyResult {
  ok: boolean;
  error?: string;
  /** Number of distinct positions updated (main + linked siblings) */
  positionsUpdated?: number;
}

/** A single work entry queued for routing */
interface WorkDraft {
  workType: WorkType;
  entry: TOVLaborEntry;
  /** Days that the receiving position-row should display in its `days` field */
  days: number;
  /** Crew/wage hints used when this entry becomes the dominant one in its dest */
  crew: number;
  wage: number;
}

// ─── findTargetPosition ─────────────────────────────────────────────────────

/**
 * Resolve which position should receive a given work type.
 * Priority:
 *   1. URL-passed position_id (FlatPositionsTable already knows the siblings)
 *   2. findLinkedPositions match by OTSKP/URS prefix or name fallback
 *   3. null → caller falls back to the main beton position
 */
export function findTargetPosition(
  workType: WorkType,
  ctx: ApplyContext['positionContext'],
  linked: ReturnType<typeof findLinkedPositions>,
): string | null {
  // 1. Direct URL ids — the calling table already located the sibling rows
  switch (workType) {
    case 'bednění':
    case 'bednění_zřízení':
      if (ctx.bedneni_position_id) return ctx.bedneni_position_id;
      break;
    case 'bednění_odstranění':
      if (ctx.odbedneni_position_id) return ctx.odbedneni_position_id;
      break;
    case 'výztuž':
      if (ctx.vyzuz_position_id) return ctx.vyzuz_position_id;
      break;
    case 'předpětí':
      if (ctx.predpeti_position_id) return ctx.predpeti_position_id;
      break;
    case 'podpěry':
      if (ctx.podperna_position_id) return ctx.podperna_position_id;
      break;
    case 'zrání':
      if (ctx.zrani_position_id) return ctx.zrani_position_id;
      break;
  }

  // 2. Linked position via code prefix or name fallback
  const hit = linked.related.find(r =>
    r.work_type === workType ||
    (workType === 'bednění' && (r.work_type === 'bednění_zřízení' || r.work_type === 'bednění_odstranění')) ||
    (workType === 'bednění_zřízení' && r.work_type === 'bednění'),
  );
  if (hit?.id) return hit.id;

  // 3. Caller decides the fallback (main beton)
  return null;
}

// ─── buildWorkDrafts ────────────────────────────────────────────────────────

const K_UTIL = 0.8;        // time utilization factor
const CURING_SHIFT_H = 5;  // ošetřovatel — 3× kropení / den
const CURING_WAGE = 320;
const PRESTRESS_WAGE = 550;
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Elements that don't use system formwork at all. For these we skip the
 * bednění / odbednění drafts entirely regardless of what the orchestrator
 * returned (it always runs on "Tradiční tesařské" as a placeholder).
 *   - pilota, mikropilota → pažnice / tremie pipe, not panels
 *   - podzemni_stena      → guide walls + bentonite slurry
 *   - prumyslova_podlaha  → flat slab poured straight onto subbase
 */
const NO_FORMWORK: ReadonlySet<StructuralElementType> = new Set<StructuralElementType>([
  'pilota',
  'podzemni_stena',
]);

/** Should we emit a draft for this work type given the element? */
function shouldEmit(workType: WorkType, elementType: StructuralElementType): boolean {
  if (NO_FORMWORK.has(elementType)) {
    if (workType === 'bednění_zřízení' || workType === 'bednění_odstranění' || workType === 'bednění') return false;
  }
  return true;
}

/**
 * Build all 7 work entries from a calculator plan. Entries with zero hours
 * are skipped (auto-create rule: don't materialize empty rows). Work types
 * that don't apply to the element (e.g. bednění for pilota) are filtered
 * via NO_FORMWORK / shouldEmit().
 */
export function buildWorkDrafts(plan: PlannerOutput, _form: FormState): WorkDraft[] {
  // 2026-04-15: piles take a completely different work-type breakdown
  // (drilling rig, armokoše osazení, kontraktor betonáž, úprava hlavy,
  // optional hlavice). Route through buildPileWorkDrafts which reads
  // plan.pile and produces the right entries — the standard 7-work-type
  // builder below would either skip everything or label things wrong.
  if (plan.element.type === 'pilota' && (plan as any).pile) {
    return buildPileWorkDrafts(plan, _form);
  }

  const drafts: WorkDraft[] = [];
  let id = 1;
  const elementType = plan.element.type;

  const tacts = plan.schedule.tact_details || [];
  const numTacts = plan.pour_decision.num_tacts || 1;
  const agg = aggregateScheduleDays(tacts, {
    numTacts,
    assemblyDaysPerTact: plan.formwork.assembly_days,
    rebarDaysPerTact: plan.rebar.duration_days,
    concreteDaysPerTact: 1,
    curingDays: plan.formwork.curing_days,
    strippingDaysPerTact: plan.formwork.disassembly_days,
    prestressDaysPerTact: plan.prestress?.days,
  });

  const shift = plan.resources.shift_h;
  const fwCrew = plan.resources.crew_size_formwork;
  const fwWage = plan.resources.wage_formwork_czk_h;
  const rbCrew = plan.resources.crew_size_rebar;
  const rbWage = plan.resources.wage_rebar_czk_h;
  const pourCrew = plan.resources.crew_size_formwork;
  const pourWage = plan.resources.wage_pour_czk_h;

  // 1. Betonář (always non-zero if there's a pour)
  if (agg.beton > 0) {
    const h = round1(pourCrew * shift * K_UTIL * agg.beton);
    drafts.push({
      workType: 'beton', days: agg.beton, crew: pourCrew, wage: pourWage,
      entry: {
        id: `tov-${id++}`, profession: 'Betonář', professionCode: 'BET',
        count: pourCrew, hours: h, normHours: h,
        hourlyRate: pourWage, totalCost: Math.round(h * pourWage),
        source: 'calculator',
      },
    });
  }

  // 2. Tesař — montáž bednění (skip for piles / diaphragm walls)
  if (agg.bedneni > 0 && shouldEmit('bednění_zřízení', elementType)) {
    const h = round1(fwCrew * shift * K_UTIL * agg.bedneni);
    drafts.push({
      workType: 'bednění_zřízení', days: agg.bedneni, crew: fwCrew, wage: fwWage,
      entry: {
        id: `tov-${id++}`, profession: 'Tesař/Bednář', professionCode: 'TES',
        count: fwCrew, hours: h, normHours: h,
        hourlyRate: fwWage, totalCost: Math.round(h * fwWage),
        note: 'montáž bednění', source: 'calculator',
      },
    });
  }

  // 3. Tesař — demontáž bednění (skip for piles / diaphragm walls)
  if (agg.odbedneni > 0 && shouldEmit('bednění_odstranění', elementType)) {
    const h = round1(fwCrew * shift * K_UTIL * agg.odbedneni);
    drafts.push({
      workType: 'bednění_odstranění', days: agg.odbedneni, crew: fwCrew, wage: fwWage,
      entry: {
        id: `tov-${id++}`, profession: 'Tesař/Bednář', professionCode: 'TES',
        count: fwCrew, hours: h, normHours: h,
        hourlyRate: fwWage, totalCost: Math.round(h * fwWage),
        note: 'demontáž bednění', source: 'calculator',
      },
    });
  }

  // 4. Železář
  if (agg.vyztuž > 0) {
    const h = round1(rbCrew * shift * K_UTIL * agg.vyztuž);
    drafts.push({
      workType: 'výztuž', days: agg.vyztuž, crew: rbCrew, wage: rbWage,
      entry: {
        id: `tov-${id++}`, profession: 'Železář', professionCode: 'ZEL',
        count: rbCrew, hours: h, normHours: h,
        hourlyRate: rbWage, totalCost: Math.round(h * rbWage),
        source: 'calculator',
      },
    });
  }

  // 5. Ošetřovatel betonu (zrání)
  if (agg.zrani > 0) {
    const h = round1(1 * CURING_SHIFT_H * agg.zrani);
    drafts.push({
      workType: 'zrání', days: agg.zrani, crew: 1, wage: CURING_WAGE,
      entry: {
        id: `tov-${id++}`, profession: 'Ošetřovatel betonu', professionCode: 'OSE',
        count: 1, hours: h, normHours: h,
        hourlyRate: CURING_WAGE, totalCost: Math.round(h * CURING_WAGE),
        note: 'zrání — kropení, zakrytí fólií', source: 'calculator',
      },
    });
  }

  // 6. Specialista předpětí
  if (plan.prestress && (agg.predpeti > 0 || plan.prestress.days > 0)) {
    const prDays = agg.predpeti || round1(plan.prestress.days * numTacts);
    const prCrew = plan.prestress.crew_size || 5;
    const h = round1(prCrew * shift * K_UTIL * prDays);
    drafts.push({
      workType: 'předpětí', days: prDays, crew: prCrew, wage: PRESTRESS_WAGE,
      entry: {
        id: `tov-${id++}`, profession: 'Specialista předpětí', professionCode: 'PRE',
        count: prCrew, hours: h, normHours: h,
        hourlyRate: PRESTRESS_WAGE, totalCost: Math.round(h * PRESTRESS_WAGE),
        source: 'calculator',
      },
    });
  }

  // 7. Podpěry / skruž (only if props were calculated)
  if (plan.props?.needed && plan.props.labor_hours > 0) {
    const propsDays = round1(plan.props.assembly_days + plan.props.disassembly_days);
    const h = round1(plan.props.labor_hours);
    drafts.push({
      workType: 'podpěry', days: propsDays, crew: fwCrew, wage: fwWage,
      entry: {
        id: `tov-${id++}`, profession: 'Tesař (podpěry)', professionCode: 'POD',
        count: fwCrew, hours: h, normHours: h,
        hourlyRate: fwWage, totalCost: Math.round(h * fwWage),
        note: 'podpěrná konstr. — montáž + demontáž', source: 'calculator',
      },
    });
  }

  return drafts;
}

// ─── Destination buckets ────────────────────────────────────────────────────

interface Bucket {
  positionId: string;
  isMain: boolean;
  /** Days to write into the position-row's `days` field */
  days: number;
  crew: number;
  wage: number;
  entries: TOVLaborEntry[];
}

/**
 * Add a draft to the right bucket. If the bucket already exists, append the
 * entry; otherwise seed the bucket with the draft's days/crew/wage hints.
 *
 * For the MAIN beton bucket we always keep the betonář's days/crew/wage as
 * the dominant trio (the position-row Celk.hod cell shows the betonář share;
 * the rich TOV expansion shows the full breakdown including any merged-in
 * fallbacks).
 */
export function addDraftToBucket(
  buckets: Map<string, Bucket>,
  positionId: string,
  draft: WorkDraft,
  isMain: boolean,
): void {
  const existing = buckets.get(positionId);
  if (existing) {
    existing.entries.push(draft.entry);
    // Don't overwrite the dominant trio for main beton; for linked positions
    // the first draft to land defines the row's days/crew/wage.
    return;
  }
  buckets.set(positionId, {
    positionId,
    isMain,
    days: draft.days,
    crew: draft.crew,
    wage: draft.wage,
    entries: [draft.entry],
  });
}

// ─── PILE: pile-specific work draft builder (2026-04-15) ───────────────────

/**
 * buildPileWorkDrafts — bored-pile sub-position split.
 *
 * Replaces the standard 7-work-type builder for elements with
 * plan.element.type === 'pilota'. Reads plan.pile (PileResult) to drive
 * the day counts; pile labor rates are inlined here so the call site
 * does not need to know about the pile cost structure.
 *
 * Sub-positions emitted:
 *   1. Vrtání           — drilling rig + 2-person crew × drilling_days
 *   2. Armokoše         — rebar cage manufacture + crane placement (železáři)
 *   3. Betonáž piloty   — kontraktor / CFA pour during drilling (betonáři)
 *   4. Úprava hlavy     — head adjustment (2-person crew × head_adjustment_days)
 *   5. Hlavice          — optional ŽB cap (only when pile.pile_cap_days != null)
 *
 * NO bednění / odbednění drafts (already covered by NO_FORMWORK gating in
 * buildWorkDrafts but irrelevant here — we never reach the standard path).
 */
function buildPileWorkDrafts(plan: PlannerOutput, _form: FormState): WorkDraft[] {
  const drafts: WorkDraft[] = [];
  let id = 1;

  const pile: any = (plan as any).pile;
  if (!pile) return drafts; // defensive — buildWorkDrafts gates on this already

  const shift = plan.resources.shift_h;
  const fwWage = plan.resources.wage_formwork_czk_h; // tesaři/obsluha
  const rbWage = plan.resources.wage_rebar_czk_h;    // železáři (armokoše)
  const pourWage = plan.resources.wage_pour_czk_h;   // betonáři (kontraktor)

  // 1. Vrtání — 2 obsluha vrtné soupravy
  if (pile.drilling_days > 0) {
    const crew = 2;
    const h = round1(crew * shift * K_UTIL * pile.drilling_days);
    drafts.push({
      workType: 'vrtání', days: pile.drilling_days, crew, wage: fwWage,
      entry: {
        id: `tov-${id++}`, profession: 'Obsluha vrtné soupravy', professionCode: 'VRT',
        count: crew, hours: h, normHours: h,
        hourlyRate: fwWage, totalCost: Math.round(h * fwWage),
        note: `vrtání ${pile.count}× Ø${pile.diameter_mm} (${pile.casing_method.toUpperCase()})`,
        source: 'calculator',
      },
    });
  }

  // 2. Armokoše — železáři + jeřáb (1 day per N piles, capped at drilling window)
  // Armokoše are pre-fabricated; placement runs in parallel with drilling so
  // the day count = drilling_days (rate-limited by the rig, not by the cage crew).
  if (pile.rebar_total_kg > 0) {
    const crew = 2;
    const h = round1(crew * shift * K_UTIL * pile.drilling_days);
    drafts.push({
      workType: 'výztuž', days: pile.drilling_days, crew, wage: rbWage,
      entry: {
        id: `tov-${id++}`, profession: 'Železář (armokoše)', professionCode: 'ARM',
        count: crew, hours: h, normHours: h,
        hourlyRate: rbWage, totalCost: Math.round(h * rbWage),
        note: `armokoše ${Math.round(pile.rebar_total_kg)} kg, osazení jeřábem`,
        source: 'calculator',
      },
    });
  }

  // 3. Betonáž piloty — kontraktor / CFA, 2 betonáři × drilling_days
  if (pile.drilling_days > 0) {
    const crew = 2;
    const h = round1(crew * shift * K_UTIL * pile.drilling_days);
    drafts.push({
      workType: 'beton', days: pile.drilling_days, crew, wage: pourWage,
      entry: {
        id: `tov-${id++}`, profession: 'Betonář (kontraktor)', professionCode: 'BET',
        count: crew, hours: h, normHours: h,
        hourlyRate: pourWage, totalCost: Math.round(h * pourWage),
        note: pile.casing_method === 'cfa'
          ? 'betonáž současně s vytahováním šneku'
          : 'kontraktorová roura, S4/SCC',
        source: 'calculator',
      },
    });
  }

  // 4. Úprava hlavy — 2 dělníci × head_adjustment_days
  if (pile.head_adjustment_days > 0) {
    const crew = 2;
    const h = round1(crew * shift * K_UTIL * pile.head_adjustment_days);
    drafts.push({
      workType: 'úprava_hlavy', days: pile.head_adjustment_days, crew, wage: fwWage,
      entry: {
        id: `tov-${id++}`, profession: 'Dělník (úprava hlav)', professionCode: 'UPR',
        count: crew, hours: h, normHours: h,
        hourlyRate: fwWage, totalCost: Math.round(h * fwWage),
        note: `odbourání 0.5–1.0 m nekvalitního betonu, ${pile.count} hlav`,
        source: 'calculator',
      },
    });
  }

  // 5. Hlavice (pile cap) — optional ŽB cap as a single combined draft
  if (pile.pile_cap_days != null && pile.pile_cap_days > 0) {
    const crew = 4;
    const h = round1(crew * shift * K_UTIL * pile.pile_cap_days);
    drafts.push({
      workType: 'beton', days: pile.pile_cap_days, crew, wage: fwWage,
      entry: {
        id: `tov-${id++}`, profession: 'Hlavice piloty (ŽB cyklus)', professionCode: 'HLA',
        count: crew, hours: h, normHours: h,
        hourlyRate: fwWage, totalCost: Math.round(h * fwWage),
        note: 'hlavice — bednění + výztuž + betonáž + zrání',
        source: 'calculator',
      },
    });
  }

  return drafts;
}

// ─── applyPlanToPositions ───────────────────────────────────────────────────

/**
 * Build the formwork/props rental material entries that always live on the
 * main beton position (rentals are not split per labor type).
 */
function buildMaterials(plan: PlannerOutput, form: FormState): TOVMaterialEntry[] {
  const out: TOVMaterialEntry[] = [];
  const fwArea = parseFloat(form.formwork_area_m2) || 0;
  const rentalDays = plan.schedule.total_days + 2;
  const rentalMonths = Math.round((rentalDays / 30) * 10) / 10;
  let id = 1;

  if (plan.costs.formwork_rental_czk > 0 && fwArea > 0) {
    out.push({
      id: `tov-mat-${id++}`,
      name: `Pronájem ${plan.formwork.system.name} (${plan.formwork.system.manufacturer})`,
      quantity: fwArea, unit: 'm²',
      unitPrice: plan.formwork.system.rental_czk_m2_month,
      totalCost: Math.round(plan.costs.formwork_rental_czk),
      rentalMonths, note: `${rentalDays} dní (${rentalMonths} měs.)`,
    });
  }
  if (plan.props?.needed && plan.costs.props_rental_czk > 0) {
    out.push({
      id: `tov-mat-${id++}`,
      name: `Pronájem ${plan.props.system.name} (${plan.props.system.manufacturer})`,
      quantity: plan.props.num_props_per_tact, unit: 'ks',
      unitPrice: plan.props.system.rental_czk_per_prop_day,
      totalCost: Math.round(plan.costs.props_rental_czk),
      rentalMonths: Math.round((plan.props.rental_days / 30) * 10) / 10,
      note: `${plan.props.rental_days} dní pronájmu`,
    });
  }
  return out;
}

/** Effective pour wage including night premium (§116 ZP +10%) for the main row */
function effectivePourWage(plan: PlannerOutput): number {
  const base = plan.resources.wage_pour_czk_h;
  const nightPremium = plan.costs.pour_night_premium_czk || 0;
  if (nightPremium <= 0) return base;
  const tacts = plan.schedule.tact_details || [];
  const numTacts = plan.pour_decision.num_tacts || 1;
  const agg = aggregateScheduleDays(tacts, {
    numTacts,
    assemblyDaysPerTact: plan.formwork.assembly_days,
    rebarDaysPerTact: plan.rebar.duration_days,
    concreteDaysPerTact: 1,
    curingDays: plan.formwork.curing_days,
    strippingDaysPerTact: plan.formwork.disassembly_days,
  });
  const pourLaborHours = plan.resources.crew_size_formwork * plan.resources.shift_h * agg.beton;
  if (pourLaborHours <= 0) return base;
  return Math.round(((pourLaborHours * base + nightPremium) / pourLaborHours) * 100) / 100;
}

/**
 * Template for a NEW sibling position that Aplikovat needs to create when no
 * linked/sibling match exists. Returns null for work types we never emit as
 * standalone rows (e.g. raw 'beton', unknown).
 */
interface NewPositionSpec {
  subtype: string;
  unit: string;
  qty: number;
  item_name: string;
}

function templateForWorkType(
  wt: WorkType,
  plan: PlannerOutput,
  form: FormState,
  baseItemName: string,
): NewPositionSpec | null {
  const fwArea = parseFloat(form.formwork_area_m2) || 0;
  const numTacts = plan.pour_decision.num_tacts || 1;
  const totalRebarT = round1((plan.rebar.mass_kg * numTacts) / 1000);

  switch (wt) {
    case 'bednění':
    case 'bednění_zřízení':
      return { subtype: 'bednění', unit: 'm2', qty: fwArea || 0, item_name: `${baseItemName} — bednění` };
    case 'bednění_odstranění':
      return { subtype: 'odbednění', unit: 'm2', qty: fwArea || 0, item_name: `${baseItemName} — odbednění` };
    case 'výztuž':
      return { subtype: 'výztuž', unit: 't', qty: totalRebarT, item_name: `${baseItemName} — výztuž B500B` };
    case 'předpětí': {
      // Y1860S7 typical ratio ~30 kg/m³. Guard against 0/NaN volume so the
      // backend validator (which requires qty >= 0 and typeof === 'number')
      // never receives a bad payload — e.g. pilota/podzemni_stena where the
      // user may not have entered a volume.
      const volumeM3 = Number.isFinite(form.volume_m3) && form.volume_m3 > 0 ? form.volume_m3 : 0;
      const massT = round1((volumeM3 * 30) / 1000);
      return { subtype: 'předpětí', unit: 't', qty: massT, item_name: `${baseItemName} — předpětí Y1860` };
    }
    case 'podpěry':
      return { subtype: 'podpěrná konstr.', unit: 'm2', qty: fwArea || 0, item_name: `${baseItemName} — podpěrná konstr.` };
    case 'zrání':
      return { subtype: 'zrání', unit: 'dny', qty: plan.formwork.curing_days, item_name: `${baseItemName} — zrání betonu` };
    default:
      return null;
  }
}

/** Generate a client-side UUID (falls back to Math.random for old browsers) */
function genPositionId(): string {
  const c = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'pos-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Main entry point — fetches positions, routes work entries to destinations,
 * and PUTs metadata in one batch.
 */
export async function applyPlanToPositions(ctx: ApplyContext): Promise<ApplyResult> {
  const { plan, form, positionContext, bridgeId, monolitDataMeta, apiUrl } = ctx;
  const mainId = positionContext.position_id;
  if (!mainId) return { ok: false, error: 'Missing main position_id' };

  // 1. Build work drafts (skipping zero entries)
  const drafts = buildWorkDrafts(plan, form);

  // 2. Fetch all positions to enable linked-search + name fallback
  let allPositions: Array<{ id: string; otskp_code?: string; item_name?: string; part_name?: string; subtype: string; unit: string; qty: number; bridge_id?: string }> = [];
  try {
    const posRes = await fetch(`${apiUrl}/api/positions?bridge_id=${bridgeId}`);
    if (posRes.ok) allPositions = (await posRes.json()).positions || [];
  } catch { /* offline-tolerant */ }

  const linked = findLinkedPositions(
    positionContext.otskp_code || '',
    allPositions,
    { currentPartName: positionContext.part_name, currentBridgeId: bridgeId },
  );

  // 3. Route every draft into a destination bucket.
  //    Priority: URL ID → linked sibling → AUTO-CREATE new sibling Position.
  //    'beton' always lands on the main position; other work types create a
  //    new sibling row if no existing one matches.
  const buckets = new Map<string, Bucket>();
  const newSpecs = new Map<string, NewPositionSpec>();  // newId → POST template
  const baseItemName = positionContext.part_name || plan.element.label_cs;

  for (const draft of drafts) {
    if (draft.workType === 'beton') {
      addDraftToBucket(buckets, mainId, draft, true);
      continue;
    }
    const target = findTargetPosition(draft.workType, positionContext, linked);
    if (target && target !== mainId) {
      addDraftToBucket(buckets, target, draft, false);
      continue;
    }
    // No linked sibling → create a new Position record
    const tpl = templateForWorkType(draft.workType, plan, form, baseItemName);
    if (!tpl) {
      // Unknown template → merge into main as last resort
      addDraftToBucket(buckets, mainId, draft, true);
      continue;
    }
    const newId = genPositionId();
    newSpecs.set(newId, tpl);
    addDraftToBucket(buckets, newId, draft, false);
  }

  // 4. Materials always live on main beton (rentals)
  const mainBucket = buckets.get(mainId);
  const materials = buildMaterials(plan, form);

  // 5. Build payloads — categorize into POST (new positions) vs PUT (existing)
  const calculatedAt = (monolitDataMeta.calculated_at as string) || new Date().toISOString();
  const createPayloads: Array<Record<string, unknown>> = [];
  const updatePayloads: Array<Record<string, unknown>> = [];

  for (const bucket of buckets.values()) {
    const tov: TOVEntries = {
      labor: bucket.entries,
      materials: bucket.isMain ? materials : [],
      source: 'calculator',
      calculated_at: calculatedAt,
    };

    // Main position keeps the rich metadata blob (costs, resources, formwork_info…)
    const meta = bucket.isMain
      ? {
          costs: monolitDataMeta.costs,
          resources: monolitDataMeta.resources,
          formwork_info: monolitDataMeta.formwork_info,
          schedule_info: monolitDataMeta.schedule_info,
          calculated_at: calculatedAt,
          tov_entries: tov,
        }
      : { calculated_at: calculatedAt, tov_entries: tov };

    const spec = newSpecs.get(bucket.positionId);
    if (spec) {
      // New sibling position — POST with full template + TOV blob in one shot.
      // bridge_id is sent both at request-body top level (primary) AND
      // per-position (redundant but silences strict payload validators).
      createPayloads.push({
        id: bucket.positionId,
        bridge_id: bridgeId,
        part_name: positionContext.part_name,
        item_name: spec.item_name,
        subtype: spec.subtype,
        unit: spec.unit,
        qty: spec.qty,
        crew_size: bucket.crew,
        wage_czk_ph: bucket.wage,
        shift_hours: plan.resources.shift_h,
        days: bucket.days,
        metadata: JSON.stringify(meta),
      });
    } else {
      // Existing position — PUT update
      updatePayloads.push({
        id: bucket.positionId,
        days: bucket.days,
        crew_size: bucket.crew,
        wage_czk_ph: bucket.isMain ? effectivePourWage(plan) : bucket.wage,
        shift_hours: plan.resources.shift_h,
        ...(bucket.isMain ? { curing_days: Math.round(plan.formwork.curing_days) } : {}),
        metadata: JSON.stringify(meta),
      });
    }
  }

  // 6. Always touch the main beton position even if no draft landed there
  // (e.g. all routed to linked siblings) — keeps Aplikovat status visible.
  if (!mainBucket) {
    updatePayloads.push({
      id: mainId,
      metadata: JSON.stringify({
        costs: monolitDataMeta.costs,
        resources: monolitDataMeta.resources,
        formwork_info: monolitDataMeta.formwork_info,
        schedule_info: monolitDataMeta.schedule_info,
        calculated_at: calculatedAt,
        tov_entries: { labor: [], materials, source: 'calculator', calculated_at: calculatedAt },
      }),
    });
  }

  // 7a. POST new sibling positions (one round trip)
  if (createPayloads.length > 0) {
    try {
      const res = await fetch(`${apiUrl}/api/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridge_id: bridgeId, positions: createPayloads }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        return { ok: false, error: errData?.error || `POST HTTP ${res.status}` };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // 7b. PUT existing position updates
  if (updatePayloads.length === 0) {
    return { ok: true, positionsUpdated: createPayloads.length };
  }
  try {
    const res = await fetch(`${apiUrl}/api/positions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bridge_id: bridgeId, updates: updatePayloads }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return { ok: false, error: errData?.error || `HTTP ${res.status}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  return { ok: true, positionsUpdated: createPayloads.length + updatePayloads.length };
}


