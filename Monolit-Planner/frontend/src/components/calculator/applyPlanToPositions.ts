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
  buildLaborProjection,
  buildScheduleProjection,
  type PlannerOutput,
  type TOVLaborEntry,
  type TOVMaterialEntry,
  type TOVEntries,
  type WorkType,
  type LaborOperationProjection,
  type CompositeOutput,
  type CompositePartInput,
} from '@stavagent/monolit-shared';
import { aggregateScheduleDays } from '@stavagent/monolit-shared';
import { authHeader } from '../../services/api';
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
    /**
     * Phase 11 (2026-04-15): cross-kiosk project identity. When the user
     * opens Monolit Planner from Portal or Registry, the opening URL
     * includes these ids. Forwarding them on POST /api/positions lets
     * the backend dedupe instead of spawning a new bridge on every
     * Aplikovat call (39-duplicate-projects bug).
     */
    portal_project_id?: string | null;
    registry_project_id?: string | null;
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

const CURING_WAGE = 320;
const PRESTRESS_WAGE = 550;
const round1 = (v: number) => Math.round(v * 10) / 10;

// NO_FORMWORK lives in shared labor-projection.ts (single source) — the
// projection already skips bednění / odbednění operations for pilota and
// podzemni_stena, so drafts built from it never contain them.

/**
 * Per-operation TOV identity: profession label/code + note + which wage and
 * WorkType the operation routes to. Hours semantics come from the shared
 * projection: normHours = canonical (×0.8), hours = presence (paid),
 * totalCost = presence × rate (a 10h shift is paid in full).
 */
interface OpIdentity {
  workType: WorkType;
  profession: string;
  professionCode: string;
  wage: (plan: PlannerOutput) => number;
  note?: (plan: PlannerOutput) => string | undefined;
}

const OP_IDENTITY: Record<string, OpIdentity> = {
  beton: {
    workType: 'beton', profession: 'Betonář', professionCode: 'BET',
    wage: p => p.resources.wage_pour_czk_h,
  },
  bedneni_montaz: {
    workType: 'bednění_zřízení', profession: 'Tesař/Bednář', professionCode: 'TES',
    wage: p => p.resources.wage_formwork_czk_h, note: () => 'montáž bednění',
  },
  bedneni_demontaz: {
    workType: 'bednění_odstranění', profession: 'Tesař/Bednář', professionCode: 'TES',
    wage: p => p.resources.wage_formwork_czk_h, note: () => 'demontáž bednění',
  },
  vyztuz: {
    workType: 'výztuž', profession: 'Železář', professionCode: 'ZEL',
    wage: p => p.resources.wage_rebar_czk_h,
  },
  osetrovani: {
    workType: 'zrání', profession: 'Ošetřovatel betonu', professionCode: 'OSE',
    wage: () => CURING_WAGE, note: () => 'ošetřování betonu — kropení, zakrytí fólií',
  },
  predpeti: {
    workType: 'předpětí', profession: 'Specialista předpětí', professionCode: 'PRE',
    wage: () => PRESTRESS_WAGE,
  },
  podpery: {
    workType: 'podpěry', profession: 'Tesař (podpěry)', professionCode: 'POD',
    wage: p => p.resources.wage_formwork_czk_h, note: () => 'podpěrná konstr. — montáž + demontáž',
  },
  // Pile path (plan.pile)
  vrtani: {
    workType: 'vrtání', profession: 'Obsluha vrtné soupravy', professionCode: 'VRT',
    wage: p => p.resources.wage_formwork_czk_h,
    note: p => p.pile ? `vrtání ${p.pile.count}× Ø${p.pile.diameter_mm} (${p.pile.casing_method.toUpperCase()})` : undefined,
  },
  armokose: {
    workType: 'výztuž', profession: 'Železář (armokoše)', professionCode: 'ARM',
    wage: p => p.resources.wage_rebar_czk_h,
    note: p => p.pile ? `armokoše ${Math.round(p.pile.rebar_total_kg)} kg, osazení jeřábem` : undefined,
  },
  uprava_hlavy: {
    workType: 'úprava_hlavy', profession: 'Dělník (úprava hlav)', professionCode: 'UPR',
    wage: p => p.resources.wage_formwork_czk_h,
    note: p => p.pile ? `odbourání 0.5–1.0 m nekvalitního betonu, ${p.pile.count} hlav` : undefined,
  },
  hlavice: {
    workType: 'beton', profession: 'Hlavice piloty (ŽB cyklus)', professionCode: 'HLA',
    wage: p => p.resources.wage_formwork_czk_h,
    note: () => 'hlavice — bednění + výztuž + betonáž + zrání',
  },
};

/** Pile betonáž has a different profession/note than the standard pour. */
const PILE_BETON_IDENTITY: OpIdentity = {
  workType: 'beton', profession: 'Betonář (kontraktor)', professionCode: 'BET',
  wage: p => p.resources.wage_pour_czk_h,
  note: p => p.pile?.casing_method === 'cfa'
    ? 'betonáž současně s vytahováním šneku'
    : 'kontraktorová roura, S4/SCC',
};

function draftFromOperation(
  op: LaborOperationProjection,
  identity: OpIdentity,
  plan: PlannerOutput,
  id: number,
): WorkDraft {
  const wage = identity.wage(plan);
  const note = identity.note?.(plan);
  return {
    workType: identity.workType, days: op.days, crew: op.crew, wage,
    entry: {
      id: `tov-${id}`, profession: identity.profession, professionCode: identity.professionCode,
      count: op.crew,
      // hours = presence (paid), normHours = canonical normohodiny (×0.8)
      hours: op.presence_hours, normHours: op.norm_hours,
      hourlyRate: wage, totalCost: Math.round(op.presence_hours * wage),
      ...(note ? { note } : {}),
      source: 'calculator',
    },
  };
}

/**
 * Build all work entries from a calculator plan. The canonical breakdown
 * (operations, days, norm/presence hours) comes from the shared
 * buildLaborProjection — the SAME numbers the calculator summary displays.
 * Entries with zero hours never appear (the projection skips them).
 */
export function buildWorkDrafts(plan: PlannerOutput, _form: FormState): WorkDraft[] {
  const projection = buildLaborProjection(plan);
  const isPile = plan.element.type === 'pilota' && !!(plan as any).pile;
  const drafts: WorkDraft[] = [];
  let id = 1;

  for (const op of projection.operations) {
    const identity = isPile && op.key === 'beton'
      ? PILE_BETON_IDENTITY
      : OP_IDENTITY[op.key];
    if (!identity) continue;
    drafts.push(draftFromOperation(op, identity, plan, id++));
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
    const posRes = await fetch(`${apiUrl}/api/positions?bridge_id=${bridgeId}`, {
      headers: { ...authHeader() },
    });
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
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          bridge_id: bridgeId,
          // Phase 11: forward cross-kiosk project identity so the backend
          // can dedupe bridges by portal_project_id / registry_project_id
          // instead of auto-creating a new one for every Aplikovat call.
          portal_project_id: positionContext.portal_project_id ?? null,
          registry_project_id: positionContext.registry_project_id ?? null,
          positions: createPayloads,
        }),
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
      headers: { 'Content-Type': 'application/json', ...authHeader() },
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

// ─── applyCompositeToPositions (Fáze 2 #7 Gate 5) ────────────────────────────

export interface CompositeApplyContext {
  composite: CompositeOutput;
  /** Resolved part inputs, 1:1 with composite.parts — carries per-part
   *  formwork_area_m2 (the part output doesn't echo it). */
  partInputs: CompositePartInput[];
  form: FormState;
  positionContext: ApplyContext['positionContext'];
  bridgeId: string;
  monolitDataMeta: Record<string, unknown>;
  apiUrl: string;
}

/**
 * Apply a COMPOSITE plan (parent + parts) to positions.
 *
 * Each structural part becomes its OWN set of work rows (beton / bednění /
 * výztuž / zrání / předpětí / podpěry) under the SAME `part_name` (the opěra =
 * one smeta line), tagged with `metadata.structural_part = part.label` so the
 * Gate-4 `groupByStructuralPart` renders the part sub-level. The FIRST part's
 * beton REUSES the parent's existing beton row (retagged + re-qty'd to the
 * part volume); every other work row is a NEW sibling. Result: the parent is a
 * pure container, Σ part beton volumes == parent total → no double-count
 * (design §5.5), export still svine po `part_name` to one line.
 *
 * Deliberately does NOT reuse the single-element findLinkedPositions routing:
 * that matches by work_type and would merge every part's bednění into ONE
 * sibling. Composite needs one row per (part × work_type).
 */
export async function applyCompositeToPositions(ctx: CompositeApplyContext): Promise<ApplyResult> {
  const { composite, partInputs, form, positionContext, bridgeId, monolitDataMeta, apiUrl } = ctx;
  const mainId = positionContext.position_id;
  if (!mainId) return { ok: false, error: 'Missing main position_id' };
  if (!composite.is_detailed || composite.parts.length === 0) {
    return { ok: false, error: 'Composite plan has no parts' };
  }

  const baseItemName = positionContext.part_name || composite.parent_label || 'Opěra';
  const calculatedAt = (monolitDataMeta.calculated_at as string) || new Date().toISOString();

  const createPayloads: Array<Record<string, unknown>> = [];
  const updatePayloads: Array<Record<string, unknown>> = [];
  let firstBetonUsed = false;

  composite.parts.forEach((part, pIdx) => {
    const partPlan = part.plan;
    if (!partPlan) return;
    const partLabel = part.label || `Část ${pIdx + 1}`;
    const partFwArea = Number(partInputs[pIdx]?.formwork_area_m2) || 0;
    const drafts = buildWorkDrafts(partPlan, form);

    for (const draft of drafts) {
      const isBeton = draft.workType === 'beton';

      // Material rentals (formwork / props) ride on the part's beton row when
      // the part's formwork area is known; ODHAD parts (no area) carry none.
      const materials: TOVMaterialEntry[] = [];
      if (isBeton && partFwArea > 0 && partPlan.costs.formwork_rental_czk > 0) {
        const rentalDays = partPlan.schedule.total_days + 2;
        materials.push({
          id: `tov-mat-${pIdx}-fw`,
          name: `Pronájem ${partPlan.formwork.system.name} (${partPlan.formwork.system.manufacturer})`,
          quantity: partFwArea, unit: 'm²',
          unitPrice: partPlan.formwork.system.rental_czk_m2_month,
          totalCost: Math.round(partPlan.costs.formwork_rental_czk),
          rentalMonths: Math.round((rentalDays / 30) * 10) / 10,
          note: `${rentalDays} dní`,
        });
      }

      const tov: TOVEntries = {
        labor: [draft.entry], materials,
        source: 'calculator', calculated_at: calculatedAt,
      };
      const meta: Record<string, unknown> = {
        calculated_at: calculatedAt,
        structural_part: partLabel,
        tov_entries: tov,
      };
      if (isBeton) {
        // The beton row carries the rich blob for this part (KPI / Gantt / TOV).
        meta.costs = { ...partPlan.costs };
        meta.resources = { ...partPlan.resources };
        meta.formwork_info = {
          system_name: partPlan.formwork.system.name,
          manufacturer: partPlan.formwork.system.manufacturer,
          formwork_area_m2: partFwArea,
          num_tacts: partPlan.pour_decision.num_tacts,
          num_sets: form.num_sets,
          assembly_days: partPlan.formwork.assembly_days,
          disassembly_days: partPlan.formwork.disassembly_days,
          curing_days: partPlan.formwork.curing_days,
        };
        meta.schedule_info = buildScheduleProjection(partPlan);
      }

      if (isBeton && !firstBetonUsed) {
        // Reuse the parent's existing beton row as the first part's beton row.
        firstBetonUsed = true;
        updatePayloads.push({
          id: mainId,
          item_name: `${baseItemName} · ${partLabel}`,
          qty: part.volume_m3,
          days: draft.days,
          crew_size: draft.crew,
          wage_czk_ph: draft.wage,
          shift_hours: partPlan.resources.shift_h,
          curing_days: Math.round(partPlan.formwork.curing_days),
          metadata: JSON.stringify(meta),
        });
        continue;
      }

      // New sibling row for this part's work.
      let subtype = 'beton';
      let unit = 'm3';
      let qty: number = part.volume_m3;
      let itemName = `${baseItemName} · ${partLabel}`;
      if (!isBeton) {
        const tpl = templateForWorkType(draft.workType, partPlan, form, `${baseItemName} · ${partLabel}`);
        if (!tpl) continue;
        subtype = tpl.subtype;
        unit = tpl.unit;
        // Per-part bednění / podpěry quantity = THIS part's area, not the parent's.
        qty = (subtype === 'bednění' || subtype === 'odbednění' || subtype === 'podpěrná konstr.')
          ? partFwArea
          : tpl.qty;
        itemName = tpl.item_name;
      }
      createPayloads.push({
        id: genPositionId(),
        bridge_id: bridgeId,
        part_name: baseItemName,
        item_name: itemName,
        subtype,
        unit,
        qty,
        crew_size: draft.crew,
        wage_czk_ph: draft.wage,
        shift_hours: partPlan.resources.shift_h,
        days: draft.days,
        metadata: JSON.stringify(meta),
      });
    }
  });

  // POST new sibling rows (one round trip), then PUT the reused parent beton row.
  if (createPayloads.length > 0) {
    try {
      const res = await fetch(`${apiUrl}/api/positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          bridge_id: bridgeId,
          portal_project_id: positionContext.portal_project_id ?? null,
          registry_project_id: positionContext.registry_project_id ?? null,
          positions: createPayloads,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        return { ok: false, error: errData?.error || `POST HTTP ${res.status}` };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  if (updatePayloads.length > 0) {
    try {
      const res = await fetch(`${apiUrl}/api/positions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ bridge_id: bridgeId, updates: updatePayloads }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        return { ok: false, error: errData?.error || `HTTP ${res.status}` };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return { ok: true, positionsUpdated: createPayloads.length + updatePayloads.length };
}


