/**
 * Element Scheduler — Resource-Constrained Critical Path Method (RCPSP)
 *
 * Schedules multi-tact concrete construction elements as a DAG of activities
 * with resource constraints (formwork sets, crews).
 *
 * Graph theory model:
 *   Vertices = activities (5 per tact: ASM, REB, CON, CUR, STR)
 *   Edges = precedence constraints:
 *     Within tact:  ASM ──FS──→ CON → CUR → STR
 *                   REB ──FS──↗
 *                   ASM ──SS(lag)──→ REB  (rebar can overlap with assembly)
 *     Cross-tact:   STR(t) ──FS──→ ASM(t + num_sets)  (set reuse)
 *
 *   FS = finish-to-start, SS = start-to-start with lag
 *
 * Resources (capacity-constrained):
 *   - Formwork crews: shared by ASM + STR (configurable count)
 *   - Rebar crews: used by REB (configurable count)
 *   - Concrete pour: no crew constraint (1 day, all hands)
 *   - Curing: passive (no crew, set occupied)
 *
 * Algorithm: Priority List Scheduling (greedy forward pass)
 *   1. Build DAG with all activities and edges
 *   2. Repeatedly pick ready activity with earliest feasible start
 *   3. Schedule it, update crew availability
 *   4. Backward pass for critical path (slack = 0)
 *
 * Complexity: O(n²) where n = 5 × num_tacts. Fine for n < 500.
 */

import type { PertParams, MonteCarloResult, ThreePointEstimate } from './pert.js';
import { toThreePoint, runMonteCarlo } from './pert.js';
import type { ConcreteClass, CementType, ElementType } from './maturity.js';
import { getStripWaitHours, curingThreePoint } from './maturity.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ElementScheduleInput {
  num_tacts: number;          // total captures (záběry)
  num_sets: number;           // formwork kits (sady)
  assembly_days: number;      // bednění montáž per tact
  rebar_days: number;         // výztuž vázání per tact
  concrete_days: number;      // betonáž per tact (usually 1)
  curing_days: number;        // zrání before stripping per tact
  stripping_days: number;     // demontáž per tact
  num_formwork_crews?: number; // default 1 (does ASM + STR)
  num_rebar_crews?: number;   // default 1
  rebar_lag_pct?: number;     // 0 = full overlap (rebar starts with assembly)
                              // 50 = rebar starts when assembly 50% done (default)
                              // 100 = sequential (rebar after assembly)

  // v2.0: Scheduling mode (determined by PourDecisionTree)
  scheduling_mode?: 'linear' | 'chess';  // default 'linear'
  // chess: odd tacts first (1,3,5...), then cure, then even tacts (2,4,6...)
  // requires min cure_between_neighbors_h between adjacent tacts
  cure_between_neighbors_days?: number;  // default 1 (24h) for chess mode

  // v3.0: PERT + Maturity integration (optional)
  pert_params?: PertParams;  // If provided, runs Monte Carlo on critical path

  // Maturity model: auto-calculate curing_days from temperature + concrete class
  maturity_params?: {
    concrete_class: ConcreteClass;
    temperature_c: number;
    cement_type?: CementType;
    element_type?: ElementType;
  };
}

export interface TactDetail {
  tact: number;
  set: number;
  assembly: [number, number];   // [start, finish]
  rebar: [number, number];
  concrete: [number, number];
  curing: [number, number];
  stripping: [number, number];
}

export interface ElementScheduleOutput {
  total_days: number;
  sequential_days: number;
  savings_days: number;
  savings_pct: number;

  tact_details: TactDetail[];
  critical_path: string[];
  gantt: string;

  utilization: {
    formwork_crews: number;  // 0–1
    rebar_crews: number;     // 0–1
    sets: number[];          // per-set 0–1
  };

  bottleneck: string | null;

  // v3.0: PERT Monte Carlo results (only when pert_params provided)
  monte_carlo?: MonteCarloResult;

  // v3.0: Effective curing days (from maturity model or input)
  effective_curing_days?: number;
}

// Internal activity node in the DAG
interface Node {
  id: string;
  tact: number;
  type: 'assembly' | 'rebar' | 'concrete' | 'curing' | 'stripping';
  duration: number;
  crew: 'formwork' | 'rebar' | null;
  fs_preds: string[];        // finish-to-start predecessors
  fs_lags?: Map<string, number>;  // additional lag after specific predecessor finish
  ss_source?: string;        // start-to-start source
  ss_lag?: number;           // lag after ss_source starts
  set: number;
}

interface Scheduled {
  start: number;
  finish: number;
  crew_unit: number;
}

// ─── Main Scheduler ─────────────────────────────────────────────────────────

export function scheduleElement(input: ElementScheduleInput): ElementScheduleOutput {
  const {
    num_tacts,
    num_sets: rawSets,
    assembly_days,
    rebar_days,
    concrete_days,
    curing_days,
    stripping_days,
    num_formwork_crews = 1,
    num_rebar_crews = 1,
    rebar_lag_pct = 50,
  } = input;

  const num_sets = Math.min(rawSets, num_tacts);
  const scheduling_mode = input.scheduling_mode ?? 'linear';
  const cure_between_neighbors_days = input.cure_between_neighbors_days ?? 1;

  // v3.0: Auto-calculate curing_days from maturity model if provided
  let effectiveCuringDays = curing_days;
  if (input.maturity_params) {
    const mp = input.maturity_params;
    const hours = getStripWaitHours(
      mp.concrete_class,
      mp.temperature_c,
      mp.element_type ?? 'slab',
      mp.cement_type ?? 'CEM_I',
    );
    effectiveCuringDays = hours / 24;
  }

  // Edge case: no tacts
  if (num_tacts <= 0) {
    return {
      total_days: 0, sequential_days: 0, savings_days: 0, savings_pct: 0,
      tact_details: [], critical_path: [], gantt: '', utilization: { formwork_crews: 0, rebar_crews: 0, sets: [] },
      bottleneck: null,
    };
  }

  // ─── 1. Build DAG ────────────────────────────────────────────────────────

  // Chess mode: reorder tacts so odd-indexed come first, then even-indexed
  // This ensures adjacent sections are never poured consecutively.
  // Example: 6 tacts → pour order [0,2,4, 1,3,5]
  // Phase 1 (odd positions): 0,2,4 — with cure gaps
  // Phase 2 (even positions): 1,3,5 — neighbors are already cured
  let tactOrder: number[];
  if (scheduling_mode === 'chess' && num_tacts > 2) {
    const phase1 = []; // Even indices (0,2,4...) — "odd" physical positions
    const phase2 = []; // Odd indices (1,3,5...) — "even" physical positions
    for (let i = 0; i < num_tacts; i++) {
      if (i % 2 === 0) phase1.push(i);
      else phase2.push(i);
    }
    tactOrder = [...phase1, ...phase2];
  } else {
    tactOrder = Array.from({ length: num_tacts }, (_, i) => i);
  }

  const nodes: Node[] = [];
  const rebar_lag = assembly_days * (rebar_lag_pct / 100);
  const tactSetMap = new Map<number, number>(); // tact index → set (0-based)

  // Map from execution order → tact index
  // executionPos[i] = which tact is scheduled at position i
  // We build DAG using execution position for set reuse, but keep original tact index for output

  for (let execPos = 0; execPos < num_tacts; execPos++) {
    const t = tactOrder[execPos]; // original tact index
    const set = execPos % num_sets;
    tactSetMap.set(t, set);
    const prevOnSet = execPos - num_sets; // previous execution position on same set
    const prevTactOnSet = prevOnSet >= 0 ? tactOrder[prevOnSet] : -1;

    // Chess mode: add cure dependency between adjacent tacts
    const chessPreds: string[] = [];
    const chessLags = new Map<string, number>();
    if (scheduling_mode === 'chess') {
      // If this tact is adjacent to an already-scheduled tact, add cure wait
      // Adjacent = tact index differs by 1
      for (let prevExec = 0; prevExec < execPos; prevExec++) {
        const prevT = tactOrder[prevExec];
        if (Math.abs(prevT - t) === 1) {
          // Neighbor tact — must wait for its concrete to finish + cure_between_neighbors_days
          chessPreds.push(`T${prevT}_CON`);
          if (cure_between_neighbors_days > 0) {
            chessLags.set(`T${prevT}_CON`, cure_between_neighbors_days);
          }
        }
      }
    }

    // ASM: after STR of previous tact on same set + chess cure deps
    const asmPreds = [
      ...(prevTactOnSet >= 0 ? [`T${prevTactOnSet}_STR`] : []),
      ...chessPreds,
    ];

    nodes.push({
      id: `T${t}_ASM`, tact: t, type: 'assembly', duration: assembly_days,
      crew: 'formwork', fs_preds: asmPreds,
      fs_lags: chessLags.size > 0 ? chessLags : undefined, set,
    });

    // REB: start-to-start with ASM (lag = assembly_days × lag%)
    nodes.push({
      id: `T${t}_REB`, tact: t, type: 'rebar', duration: rebar_days,
      crew: 'rebar', fs_preds: [], ss_source: `T${t}_ASM`, ss_lag: rebar_lag, set,
    });

    // CON: after both ASM and REB finish
    nodes.push({
      id: `T${t}_CON`, tact: t, type: 'concrete', duration: concrete_days,
      crew: null, fs_preds: [`T${t}_ASM`, `T${t}_REB`], set,
    });

    // CUR: after CON (passive — no crew, set occupied)
    nodes.push({
      id: `T${t}_CUR`, tact: t, type: 'curing', duration: effectiveCuringDays,
      crew: null, fs_preds: [`T${t}_CON`], set,
    });

    // STR: after CUR, needs formwork crew
    nodes.push({
      id: `T${t}_STR`, tact: t, type: 'stripping', duration: stripping_days,
      crew: 'formwork', fs_preds: [`T${t}_CUR`], set,
    });
  }

  // ─── 2. Greedy List Scheduling ───────────────────────────────────────────

  const sched = new Map<string, Scheduled>();
  const fwFree: number[] = new Array(num_formwork_crews).fill(0);
  const rbFree: number[] = new Array(num_rebar_crews).fill(0);
  const remaining = new Set(nodes.map(n => n.id));

  while (remaining.size > 0) {
    let bestNode: Node | null = null;
    let bestES = Infinity;
    let bestCrew = -1;

    for (const node of nodes) {
      if (!remaining.has(node.id)) continue;

      // Check FS predecessors
      let ready = true;
      let es = 0;
      for (const p of node.fs_preds) {
        const s = sched.get(p);
        if (!s) { ready = false; break; }
        const lag = node.fs_lags?.get(p) ?? 0;
        es = Math.max(es, s.finish + lag);
      }
      if (!ready) continue;

      // Check SS source
      if (node.ss_source) {
        const ss = sched.get(node.ss_source);
        if (!ss) continue; // SS source not scheduled yet — skip
        es = Math.max(es, ss.start + (node.ss_lag ?? 0));
      }

      // Resource constraint: find earliest free crew unit
      let crewUnit = -1;
      if (node.crew === 'formwork') {
        let minT = Infinity;
        for (let i = 0; i < fwFree.length; i++) {
          if (fwFree[i] < minT) { minT = fwFree[i]; crewUnit = i; }
        }
        es = Math.max(es, minT);
      } else if (node.crew === 'rebar') {
        let minT = Infinity;
        for (let i = 0; i < rbFree.length; i++) {
          if (rbFree[i] < minT) { minT = rbFree[i]; crewUnit = i; }
        }
        es = Math.max(es, minT);
      }

      // Priority: earliest start → STR before ASM (frees sets) → lower tact
      const isBetter =
        es < bestES ||
        (es === bestES && node.type === 'stripping' && bestNode?.type !== 'stripping') ||
        (es === bestES && node.type === bestNode?.type && node.tact < (bestNode?.tact ?? Infinity));

      if (isBetter) {
        bestNode = node;
        bestES = es;
        bestCrew = crewUnit;
      }
    }

    if (!bestNode) throw new Error('Scheduling deadlock — cycle in DAG?');

    const finish = round(bestES + bestNode.duration);
    sched.set(bestNode.id, { start: bestES, finish, crew_unit: bestCrew });
    remaining.delete(bestNode.id);

    if (bestNode.crew === 'formwork' && bestCrew >= 0) fwFree[bestCrew] = finish;
    if (bestNode.crew === 'rebar' && bestCrew >= 0) rbFree[bestCrew] = finish;
  }

  // ─── 3. Compute results ──────────────────────────────────────────────────

  const total_days = round(Math.max(...Array.from(sched.values()).map(s => s.finish)));

  const cycle = assembly_days + rebar_days + concrete_days + effectiveCuringDays + stripping_days;
  const sequential_days = round(num_tacts * cycle);
  const savings_days = round(sequential_days - total_days);
  const savings_pct = sequential_days > 0 ? Math.round(savings_days / sequential_days * 100) : 0;

  // Tact details
  const tact_details: TactDetail[] = [];
  for (let t = 0; t < num_tacts; t++) {
    const g = (id: string): [number, number] => {
      const s = sched.get(id)!;
      return [round(s.start), round(s.finish)];
    };
    tact_details.push({
      tact: t + 1,
      set: (tactSetMap.get(t) ?? (t % num_sets)) + 1,
      assembly: g(`T${t}_ASM`),
      rebar: g(`T${t}_REB`),
      concrete: g(`T${t}_CON`),
      curing: g(`T${t}_CUR`),
      stripping: g(`T${t}_STR`),
    });
  }

  // Critical path (backward pass — FS only for simplicity)
  const critical_path = computeCriticalPath(nodes, sched, total_days);

  // Utilization
  const utilization = computeUtilization(nodes, sched, total_days, num_formwork_crews, num_rebar_crews, num_sets);

  // Bottleneck analysis
  const bottleneck = analyzeBottleneck(utilization, num_sets, num_formwork_crews, num_rebar_crews, effectiveCuringDays, assembly_days + rebar_days);

  // Gantt chart
  const gantt = renderGantt(tact_details, total_days, num_sets, nodes, sched, num_formwork_crews, num_rebar_crews);

  // v3.0: PERT Monte Carlo simulation on critical path activities
  let monte_carlo: MonteCarloResult | undefined;
  if (input.pert_params) {
    const pp = input.pert_params;
    const optFactor = pp.optimistic_factor ?? 0.75;
    const pesFactor = pp.pessimistic_factor ?? 1.50;
    const iterations = pp.monte_carlo_iterations ?? 10000;

    // Build three-point estimates for each activity on the critical path
    // Group critical activities by type to get per-tact estimates
    const criticalActivities: ThreePointEstimate[] = [];
    for (const nodeId of critical_path) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;

      if (node.type === 'curing' && input.maturity_params) {
        // Use maturity-based three-point for curing
        const mp = input.maturity_params;
        const tp = curingThreePoint(
          mp.concrete_class,
          mp.element_type ?? 'slab',
          mp.temperature_c,
          mp.cement_type ?? 'CEM_I',
        );
        criticalActivities.push({
          optimistic: tp.optimistic_hours / 24,
          most_likely: tp.most_likely_hours / 24,
          pessimistic: tp.pessimistic_hours / 24,
        });
      } else {
        // Use standard PERT factors for work activities
        criticalActivities.push(toThreePoint(node.duration, optFactor, pesFactor));
      }
    }

    if (criticalActivities.length > 0) {
      monte_carlo = runMonteCarlo(criticalActivities, iterations, pp.seed);
    }
  }

  return {
    total_days, sequential_days, savings_days, savings_pct,
    tact_details, critical_path, gantt, utilization, bottleneck,
    monte_carlo,
    effective_curing_days: input.maturity_params ? effectiveCuringDays : undefined,
  };
}

// ─── Critical Path (backward pass) ─────────────────────────────────────────

function computeCriticalPath(
  nodes: Node[],
  sched: Map<string, Scheduled>,
  total_days: number,
): string[] {
  // Build FS successors map
  const fsSuccessors = new Map<string, string[]>();
  for (const n of nodes) {
    for (const p of n.fs_preds) {
      if (!fsSuccessors.has(p)) fsSuccessors.set(p, []);
      fsSuccessors.get(p)!.push(n.id);
    }
  }

  // Build SS successors map (A → B means B.ss_source = A)
  // Backward constraint: A.LS <= B.LS - lag
  const ssSuccessors = new Map<string, { id: string; lag: number }[]>();
  for (const n of nodes) {
    if (n.ss_source) {
      if (!ssSuccessors.has(n.ss_source)) ssSuccessors.set(n.ss_source, []);
      ssSuccessors.get(n.ss_source)!.push({ id: n.id, lag: n.ss_lag ?? 0 });
    }
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Backward pass: compute latest start (LS) for each node
  // Process in reverse finish-time order
  const sorted = [...nodes].sort((a, b) =>
    sched.get(b.id)!.finish - sched.get(a.id)!.finish
  );

  const ls = new Map<string, number>();

  for (const node of sorted) {
    let latestStart = total_days - node.duration; // default: no successors

    // FS successors: node.LF <= succ.LS → node.LS <= succ.LS - node.duration
    const fSuccs = fsSuccessors.get(node.id) || [];
    for (const sid of fSuccs) {
      const succLS = ls.get(sid);
      if (succLS !== undefined) {
        latestStart = Math.min(latestStart, succLS - node.duration);
      }
    }

    // SS successors: node.LS <= succ.LS - lag
    const sSuccs = ssSuccessors.get(node.id) || [];
    for (const ss of sSuccs) {
      const succLS = ls.get(ss.id);
      if (succLS !== undefined) {
        latestStart = Math.min(latestStart, succLS - ss.lag);
      }
    }

    ls.set(node.id, latestStart);
  }

  // Slack = LS - ES; critical = slack ≈ 0
  const critical: string[] = [];
  for (const node of nodes) {
    const es = sched.get(node.id)!.start;
    const nodeLS = ls.get(node.id) ?? 0;
    if (Math.abs(nodeLS - es) < 0.01) {
      critical.push(node.id);
    }
  }

  return critical;
}

// ─── Utilization ────────────────────────────────────────────────────────────

function computeUtilization(
  nodes: Node[],
  sched: Map<string, Scheduled>,
  total_days: number,
  numFW: number,
  numRB: number,
  numSets: number,
): { formwork_crews: number; rebar_crews: number; sets: number[] } {
  let fwBusy = 0;
  let rbBusy = 0;
  const setBusy = new Array(numSets).fill(0);

  for (const node of nodes) {
    const s = sched.get(node.id)!;
    const dur = s.finish - s.start;

    if (node.crew === 'formwork') fwBusy += dur;
    if (node.crew === 'rebar') rbBusy += dur;

    // Set is occupied from ASM start to STR finish (track via all node types)
    if (node.type !== 'rebar') { // rebar doesn't "occupy" the set in terms of rental
      setBusy[node.set] += dur;
    }
  }

  const fwTotal = total_days * numFW;
  const rbTotal = total_days * numRB;

  return {
    formwork_crews: fwTotal > 0 ? round(fwBusy / fwTotal) : 0,
    rebar_crews: rbTotal > 0 ? round(rbBusy / rbTotal) : 0,
    sets: setBusy.map((b, i) => total_days > 0 ? round(b / total_days) : 0),
  };
}

// ─── Bottleneck Analysis ────────────────────────────────────────────────────

function analyzeBottleneck(
  util: { formwork_crews: number; rebar_crews: number; sets: number[] },
  numSets: number,
  numFW: number,
  numRB: number,
  curingDays: number,
  workDays: number,
): string | null {
  // If FW crew is > 90% utilized → bottleneck is crew
  if (util.formwork_crews > 0.9 && numFW === 1) {
    return `Četa bednění na ${Math.round(util.formwork_crews * 100)}% — zvažte přidání druhé čety`;
  }

  // If sets are > 85% utilized and curing is long → more sets would help
  const avgSetUtil = util.sets.reduce((s, v) => s + v, 0) / util.sets.length;
  if (avgSetUtil > 0.85 && curingDays > workDays) {
    return `Sady bednění na ${Math.round(avgSetUtil * 100)}%, zrání ${curingDays}d > práce ${workDays}d — další sada by snížila prostoje`;
  }

  // If rebar crew idle > 50% → rebar is not the bottleneck
  if (util.rebar_crews < 0.5 && util.formwork_crews > 0.7) {
    return `Četa výztuže nevytížena ${Math.round((1 - util.rebar_crews) * 100)}% — úzké hrdlo je četa bednění`;
  }

  // Cross-recommendation: if formwork has multiple crews but rebar only 1,
  // rebar becomes the bottleneck (can't keep up with faster formwork)
  if (numFW >= 2 && numRB === 1 && util.rebar_crews > 0.7) {
    return `⚠️ Máte ${numFW} čety tesařů ale jen 1 četu železářů (vytížení ${Math.round(util.rebar_crews * 100)}%). ` +
      `Armování se stane úzkým hrdlem — zvažte přidání druhé čety železářů.`;
  }

  // Reverse: rebar has multiple crews but formwork only 1
  if (numRB >= 2 && numFW === 1 && util.formwork_crews > 0.7) {
    return `⚠️ Máte ${numRB} čety železářů ale jen 1 četu tesařů (vytížení ${Math.round(util.formwork_crews * 100)}%). ` +
      `Bednění se stane úzkým hrdlem — zvažte přidání druhé čety tesařů.`;
  }

  return null;
}

// ─── Gantt Chart ────────────────────────────────────────────────────────────

function renderGantt(
  tacts: TactDetail[],
  total_days: number,
  numSets: number,
  nodes: Node[],
  sched: Map<string, Scheduled>,
  numFW: number,
  numRB: number,
): string {
  const days = Math.ceil(total_days);
  if (days === 0) return '';

  const lines: string[] = [];

  // Header: day numbers
  const scaleRow: string[] = [];
  for (let d = 0; d < days; d++) {
    scaleRow.push(d % 5 === 0 ? String(d).padEnd(1) : ' ');
  }
  lines.push(`Den:  ${scaleRow.join('').substring(0, days)}`);

  // Per-set timeline
  const CHARS: Record<string, string> = {
    assembly: '█', rebar: '▒', concrete: '░', curing: '═', stripping: '▓',
  };

  for (let s = 0; s < numSets; s++) {
    const row = new Array(days).fill('·');
    const setTacts = tacts.filter(td => td.set === s + 1);
    for (const td of setTacts) {
      fillRow(row, td.assembly, '█');
      fillRow(row, td.concrete, '░');
      fillRow(row, td.curing, '═');
      fillRow(row, td.stripping, '▓');
    }
    lines.push(`S${s + 1}:   ${row.join('')}`);
  }

  // Crew timelines
  for (let c = 0; c < numFW; c++) {
    const row = new Array(days).fill('·');
    for (const node of nodes) {
      if (node.crew !== 'formwork') continue;
      const s = sched.get(node.id)!;
      if (s.crew_unit !== c) continue;
      fillRow(row, [s.start, s.finish], node.type === 'assembly' ? '█' : '▓');
    }
    const label = numFW > 1 ? `FW${c + 1}: ` : 'FW:   ';
    lines.push(`${label}${row.join('')}`);
  }

  for (let c = 0; c < numRB; c++) {
    const row = new Array(days).fill('·');
    for (const node of nodes) {
      if (node.crew !== 'rebar') continue;
      const s = sched.get(node.id)!;
      if (s.crew_unit !== c) continue;
      fillRow(row, [s.start, s.finish], '▒');
    }
    const label = numRB > 1 ? `RB${c + 1}: ` : 'RB:   ';
    lines.push(`${label}${row.join('')}`);
  }

  lines.push('');
  lines.push('█=montáž ▒=výztuž ░=beton ═=zrání ▓=demontáž ·=volno');

  return lines.join('\n');
}

function fillRow(row: string[], range: [number, number], ch: string): void {
  const start = Math.floor(range[0]);
  const end = Math.ceil(range[1]);
  for (let d = start; d < end && d < row.length; d++) {
    row[d] = ch;
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function round(v: number): number {
  return Math.round(v * 10) / 10;
}
