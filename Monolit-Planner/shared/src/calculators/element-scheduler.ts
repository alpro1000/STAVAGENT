/**
 * Element Scheduler — RCPSP via Graph Theory
 *
 * Real implementation, not textbook recommendations.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ 1. GRAPH: Directed Acyclic Graph (adjacency list representation)   │
 * │ 2. TOPO SORT: Kahn's algorithm (BFS-based, O(V+E))                │
 * │ 3. CPM: Forward + backward pass on DAG (unconstrained bounds)      │
 * │ 4. RCPSP: Priority list scheduling with resource constraints       │
 * │ 5. CRITICAL PATH: Slack analysis (LS - ES = 0)                     │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * DAG per tact (5 vertices, 4 edges + 1 SS edge):
 *
 *   [ASM] ──FS──→ [CON] ──FS──→ [CUR] ──FS──→ [STR]
 *                    ↑
 *   [REB] ──FS──────┘
 *     ↑
 *   [ASM] ──SS(lag)──→ [REB]    (start-to-start with configurable lag)
 *
 * Cross-tact edge (same set): STR(t) ──FS──→ ASM(t + num_sets)
 *
 * Resource constraints (renewable, capacity-limited):
 *   - formwork_crew: used by ASM + STR (capacity = num_formwork_crews)
 *   - rebar_crew: used by REB (capacity = num_rebar_crews)
 *   - CUR and CON: passive (no crew → no resource conflict)
 */

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface ElementScheduleInput {
  num_tacts: number;
  num_sets: number;
  assembly_days: number;
  rebar_days: number;
  concrete_days: number;
  curing_days: number;
  stripping_days: number;
  num_formwork_crews?: number;
  num_rebar_crews?: number;
  rebar_lag_pct?: number;     // 0=full overlap, 50=half(default), 100=sequential
}

export interface TactDetail {
  tact: number;
  set: number;
  assembly: [number, number];
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
    formwork_crews: number;
    rebar_crews: number;
    sets: number[];
  };
  bottleneck: string | null;
}

type CrewType = 'formwork' | 'rebar' | null;

// ═══════════════════════════════════════════════════════════════════════
// 1. GRAPH — Adjacency List Representation
// ═══════════════════════════════════════════════════════════════════════

/** Vertex in the activity-on-node network */
interface Vertex {
  id: string;
  tact: number;
  type: 'assembly' | 'rebar' | 'concrete' | 'curing' | 'stripping';
  duration: number;
  crew: CrewType;
  set: number;
}

/** Edge types in the precedence network */
interface FSEdge { from: string; to: string; type: 'FS' }              // finish-to-start
interface SSEdge { from: string; to: string; type: 'SS'; lag: number } // start-to-start + lag
type Edge = FSEdge | SSEdge;

/** Directed Acyclic Graph for activity network */
interface ActivityDAG {
  V: Map<string, Vertex>;       // vertices (id → vertex)
  adjFS: Map<string, string[]>; // FS adjacency list (from → [to, ...])
  adjSS: Map<string, { to: string; lag: number }[]>; // SS adjacency list
  inFS: Map<string, string[]>;  // reverse FS (to → [from, ...])
  inSS: Map<string, { from: string; lag: number }[]>; // reverse SS
  inDegreeFS: Map<string, number>; // in-degree for Kahn's (FS edges only)
}

/** Build the DAG from schedule input */
function buildDAG(input: ElementScheduleInput): ActivityDAG {
  const {
    num_tacts, assembly_days, rebar_days, concrete_days,
    curing_days, stripping_days, rebar_lag_pct = 50,
  } = input;
  const num_sets = Math.min(input.num_sets, num_tacts);
  const rebar_lag = assembly_days * (rebar_lag_pct / 100);

  const V = new Map<string, Vertex>();
  const edges: Edge[] = [];

  // ── Create vertices and edges for each tact ──
  for (let t = 0; t < num_tacts; t++) {
    const set = t % num_sets;
    const prevOnSet = t - num_sets;

    const asm: Vertex = { id: `T${t}_ASM`, tact: t, type: 'assembly', duration: assembly_days, crew: 'formwork', set };
    const reb: Vertex = { id: `T${t}_REB`, tact: t, type: 'rebar', duration: rebar_days, crew: 'rebar', set };
    const con: Vertex = { id: `T${t}_CON`, tact: t, type: 'concrete', duration: concrete_days, crew: null, set };
    const cur: Vertex = { id: `T${t}_CUR`, tact: t, type: 'curing', duration: curing_days, crew: null, set };
    const str: Vertex = { id: `T${t}_STR`, tact: t, type: 'stripping', duration: stripping_days, crew: 'formwork', set };

    V.set(asm.id, asm);
    V.set(reb.id, reb);
    V.set(con.id, con);
    V.set(cur.id, cur);
    V.set(str.id, str);

    // Within-tact FS edges: ASM→CON, REB→CON, CON→CUR, CUR→STR
    edges.push({ from: asm.id, to: con.id, type: 'FS' });
    edges.push({ from: reb.id, to: con.id, type: 'FS' });
    edges.push({ from: con.id, to: cur.id, type: 'FS' });
    edges.push({ from: cur.id, to: str.id, type: 'FS' });

    // SS edge: ASM ──SS(lag)──→ REB
    edges.push({ from: asm.id, to: reb.id, type: 'SS', lag: rebar_lag });

    // Cross-tact FS edge (set reuse): STR(prev) → ASM(this)
    if (prevOnSet >= 0) {
      edges.push({ from: `T${prevOnSet}_STR`, to: asm.id, type: 'FS' });
    }
  }

  // ── Build adjacency lists ──
  const adjFS = new Map<string, string[]>();
  const adjSS = new Map<string, { to: string; lag: number }[]>();
  const inFS = new Map<string, string[]>();
  const inSS = new Map<string, { from: string; lag: number }[]>();
  const inDegreeFS = new Map<string, number>();

  for (const [id] of V) {
    adjFS.set(id, []);
    adjSS.set(id, []);
    inFS.set(id, []);
    inSS.set(id, []);
    inDegreeFS.set(id, 0);
  }

  for (const e of edges) {
    if (e.type === 'FS') {
      adjFS.get(e.from)!.push(e.to);
      inFS.get(e.to)!.push(e.from);
      inDegreeFS.set(e.to, (inDegreeFS.get(e.to) || 0) + 1);
    } else {
      adjSS.get(e.from)!.push({ to: e.to, lag: e.lag });
      inSS.get(e.to)!.push({ from: e.from, lag: e.lag });
    }
  }

  return { V, adjFS, adjSS, inFS, inSS, inDegreeFS };
}

// ═══════════════════════════════════════════════════════════════════════
// 2. TOPOLOGICAL SORT — Kahn's Algorithm (BFS, O(V+E))
// ═══════════════════════════════════════════════════════════════════════

/**
 * Kahn's algorithm for topological ordering.
 * Uses only FS edges (SS edges are handled via lag constraints, not ordering).
 * Detects cycles — throws if graph has a cycle.
 *
 * Returns vertices in dependency-respecting order:
 *   if A → B (FS), then A appears before B.
 */
function kahnTopologicalSort(dag: ActivityDAG): string[] {
  const inDeg = new Map(dag.inDegreeFS); // clone
  const queue: string[] = [];
  const order: string[] = [];

  // Seed: all vertices with in-degree 0
  for (const [id, deg] of inDeg) {
    if (deg === 0) queue.push(id);
  }

  while (queue.length > 0) {
    // Pick vertex with smallest ID for deterministic ordering
    queue.sort();
    const u = queue.shift()!;
    order.push(u);

    // Relax neighbors
    for (const v of dag.adjFS.get(u) || []) {
      const newDeg = (inDeg.get(v) || 1) - 1;
      inDeg.set(v, newDeg);
      if (newDeg === 0) queue.push(v);
    }
  }

  if (order.length !== dag.V.size) {
    throw new Error(
      `Cycle detected in DAG: scheduled ${order.length}/${dag.V.size} vertices`
    );
  }

  return order;
}

// ═══════════════════════════════════════════════════════════════════════
// 3. CPM — Critical Path Method (unconstrained bounds)
// ═══════════════════════════════════════════════════════════════════════

interface CPMResult {
  ES: Map<string, number>; // earliest start
  EF: Map<string, number>; // earliest finish
  LS: Map<string, number>; // latest start
  LF: Map<string, number>; // latest finish
  slack: Map<string, number>;
  makespan: number;
}

/**
 * Standard CPM on the precedence network (ignoring resource constraints).
 * This gives the theoretical lower bound on project duration.
 *
 * Forward pass:  ES[v] = max over predecessors of their EF (FS) or ES+lag (SS)
 *                EF[v] = ES[v] + duration[v]
 *
 * Backward pass: LF[v] = min over successors of their LS (FS) or LS+lag (SS back-prop)
 *                LS[v] = LF[v] - duration[v]
 *
 * Slack:         slack[v] = LS[v] - ES[v]
 * Critical:      slack = 0
 */
function cpmAnalysis(dag: ActivityDAG, topoOrder: string[]): CPMResult {
  const ES = new Map<string, number>();
  const EF = new Map<string, number>();
  const LS = new Map<string, number>();
  const LF = new Map<string, number>();

  // ── Forward pass (in topological order) ──
  for (const u of topoOrder) {
    const v = dag.V.get(u)!;
    let es = 0;

    // FS predecessors: ES[u] >= EF[pred]
    for (const pred of dag.inFS.get(u) || []) {
      es = Math.max(es, EF.get(pred) || 0);
    }

    // SS predecessors: ES[u] >= ES[pred] + lag
    for (const { from, lag } of dag.inSS.get(u) || []) {
      es = Math.max(es, (ES.get(from) || 0) + lag);
    }

    ES.set(u, es);
    EF.set(u, es + v.duration);
  }

  const makespan = Math.max(...Array.from(EF.values()));

  // ── Backward pass (reverse topological order) ──
  const revOrder = [...topoOrder].reverse();

  for (const u of revOrder) {
    const v = dag.V.get(u)!;
    let lf = makespan; // default: project end

    // FS successors: LF[u] <= LS[succ]
    for (const succ of dag.adjFS.get(u) || []) {
      lf = Math.min(lf, LS.get(succ) ?? makespan);
    }

    // SS successors: LS[u] <= LS[succ] - lag → LF[u] <= LS[succ] - lag + duration[u]
    for (const { to, lag } of dag.adjSS.get(u) || []) {
      const succLS = LS.get(to);
      if (succLS !== undefined) {
        lf = Math.min(lf, succLS - lag + v.duration);
      }
    }

    LF.set(u, lf);
    LS.set(u, lf - v.duration);
  }

  // ── Slack ──
  const slack = new Map<string, number>();
  for (const u of topoOrder) {
    slack.set(u, round((LS.get(u) || 0) - (ES.get(u) || 0)));
  }

  return { ES, EF, LS, LF, slack, makespan };
}

// ═══════════════════════════════════════════════════════════════════════
// 4. RCPSP — Resource-Constrained Scheduling (priority list heuristic)
// ═══════════════════════════════════════════════════════════════════════

interface ScheduleMap { start: number; finish: number; crew_unit: number }

/**
 * RCPSP Parallel Scheduling Scheme.
 *
 * Unlike serial scheduling (process in topological order), the parallel scheme
 * considers ALL ready activities at each step and picks the best candidate.
 * This is critical for construction: while concrete cures on set 1 (passive),
 * the formwork crew must be free to start assembly on set 2.
 *
 * Algorithm (O(n²) — fine for n < 500):
 *   1. Ready set = activities whose ALL predecessors (FS + SS) are scheduled
 *   2. For each ready activity, compute earliest feasible start:
 *      a) max(EF of FS predecessors, ES+lag of SS predecessors)
 *      b) max(a, earliest free crew unit of required type)
 *   3. Pick candidate with earliest feasible start
 *      Tie-break: STR first (frees sets) → lower tact
 *   4. Schedule it, update resource pools, repeat
 *
 * Topological order from Kahn's is used for validation and CPM bounds,
 * NOT for scheduling order — the parallel scheme finds its own order.
 */
function rcpspSchedule(
  dag: ActivityDAG,
  numFWCrews: number,
  numRBCrews: number,
): Map<string, ScheduleMap> {
  const sched = new Map<string, ScheduleMap>();
  const fwFree = new Array(numFWCrews).fill(0);
  const rbFree = new Array(numRBCrews).fill(0);
  const remaining = new Set(dag.V.keys());

  while (remaining.size > 0) {
    let bestId: string | null = null;
    let bestES = Infinity;
    let bestCrew = -1;

    for (const id of remaining) {
      const v = dag.V.get(id)!;

      // ── Check FS predecessors (all must be scheduled) ──
      let ready = true;
      let es = 0;
      for (const pred of dag.inFS.get(id) || []) {
        const s = sched.get(pred);
        if (!s) { ready = false; break; }
        es = Math.max(es, s.finish);
      }
      if (!ready) continue;

      // ── Check SS predecessors (source must be scheduled) ──
      for (const { from, lag } of dag.inSS.get(id) || []) {
        const s = sched.get(from);
        if (!s) { ready = false; break; }
        es = Math.max(es, s.start + lag);
      }
      if (!ready) continue;

      // ── Resource constraint: earliest free crew unit ──
      let crewUnit = -1;
      if (v.crew === 'formwork') {
        let bestIdx = 0;
        for (let i = 1; i < fwFree.length; i++) {
          if (fwFree[i] < fwFree[bestIdx]) bestIdx = i;
        }
        es = Math.max(es, fwFree[bestIdx]);
        crewUnit = bestIdx;
      } else if (v.crew === 'rebar') {
        let bestIdx = 0;
        for (let i = 1; i < rbFree.length; i++) {
          if (rbFree[i] < rbFree[bestIdx]) bestIdx = i;
        }
        es = Math.max(es, rbFree[bestIdx]);
        crewUnit = bestIdx;
      }

      // ── Priority: earliest start → STR first → lower tact ──
      const isBetter = bestId === null
        || es < bestES
        || (es === bestES && v.type === 'stripping' && dag.V.get(bestId)?.type !== 'stripping')
        || (es === bestES && v.type === dag.V.get(bestId)?.type
            && v.tact < (dag.V.get(bestId)?.tact ?? Infinity));

      if (isBetter) {
        bestId = id;
        bestES = es;
        bestCrew = crewUnit;
      }
    }

    if (!bestId) throw new Error('Scheduling deadlock — cycle in precedence graph?');

    const v = dag.V.get(bestId)!;
    const finish = round(bestES + v.duration);
    sched.set(bestId, { start: bestES, finish, crew_unit: bestCrew });
    remaining.delete(bestId);

    if (v.crew === 'formwork' && bestCrew >= 0) fwFree[bestCrew] = finish;
    if (v.crew === 'rebar' && bestCrew >= 0) rbFree[bestCrew] = finish;
  }

  return sched;
}

// ═══════════════════════════════════════════════════════════════════════
// 5. CRITICAL PATH (resource-constrained slack analysis)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute critical path on the RESOURCE-CONSTRAINED schedule.
 * Unlike CPM (which ignores resources), this uses actual scheduled times.
 *
 * Backward pass from the actual makespan to find LS for each vertex,
 * considering both FS and SS successor constraints.
 * Critical = (LS - actual_start) ≈ 0
 */
function rcpspCriticalPath(
  dag: ActivityDAG,
  sched: Map<string, ScheduleMap>,
  topoOrder: string[],
  makespan: number,
): string[] {
  const LS = new Map<string, number>();
  const revOrder = [...topoOrder].reverse();

  for (const u of revOrder) {
    const v = dag.V.get(u)!;
    let ls = makespan - v.duration;

    // FS successors: LS[u] <= LS[succ] - duration[u]
    // i.e. LF[u] = min(LS[succ]) → LS[u] = LF[u] - dur
    for (const succ of dag.adjFS.get(u) || []) {
      const succLS = LS.get(succ);
      if (succLS !== undefined) {
        ls = Math.min(ls, succLS - v.duration);
      }
    }

    // SS successors: LS[u] <= LS[succ] - lag
    for (const { to, lag } of dag.adjSS.get(u) || []) {
      const succLS = LS.get(to);
      if (succLS !== undefined) {
        ls = Math.min(ls, succLS - lag);
      }
    }

    LS.set(u, ls);
  }

  // Critical: actual start ≈ latest start
  const critical: string[] = [];
  for (const u of topoOrder) {
    const es = sched.get(u)!.start;
    const ls = LS.get(u) ?? 0;
    if (Math.abs(ls - es) < 0.01) critical.push(u);
  }

  return critical;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT — scheduleElement()
// ═══════════════════════════════════════════════════════════════════════

export function scheduleElement(input: ElementScheduleInput): ElementScheduleOutput {
  const { num_tacts, num_sets: rawSets } = input;
  const num_sets = Math.min(rawSets, num_tacts);

  if (num_tacts <= 0) {
    return {
      total_days: 0, sequential_days: 0, savings_days: 0, savings_pct: 0,
      tact_details: [], critical_path: [], gantt: '',
      utilization: { formwork_crews: 0, rebar_crews: 0, sets: [] },
      bottleneck: null,
    };
  }

  const numFW = input.num_formwork_crews ?? 1;
  const numRB = input.num_rebar_crews ?? 1;

  // 1. Build graph
  const dag = buildDAG({ ...input, num_sets });

  // 2. Topological sort (Kahn's)
  const topoOrder = kahnTopologicalSort(dag);

  // 3. CPM (unconstrained — theoretical lower bound)
  const cpm = cpmAnalysis(dag, topoOrder);

  // 4. RCPSP parallel scheduling (resource-constrained)
  const sched = rcpspSchedule(dag, numFW, numRB);

  // 5. Compute results
  const total_days = round(Math.max(...Array.from(sched.values()).map(s => s.finish)));

  const cycle = input.assembly_days + input.rebar_days + input.concrete_days
    + input.curing_days + input.stripping_days;
  const sequential_days = round(num_tacts * cycle);
  const savings_days = round(sequential_days - total_days);
  const savings_pct = sequential_days > 0
    ? Math.round(savings_days / sequential_days * 100) : 0;

  // Tact details
  const tact_details: TactDetail[] = [];
  for (let t = 0; t < num_tacts; t++) {
    const g = (id: string): [number, number] => {
      const s = sched.get(id)!;
      return [round(s.start), round(s.finish)];
    };
    tact_details.push({
      tact: t + 1,
      set: (t % num_sets) + 1,
      assembly: g(`T${t}_ASM`),
      rebar: g(`T${t}_REB`),
      concrete: g(`T${t}_CON`),
      curing: g(`T${t}_CUR`),
      stripping: g(`T${t}_STR`),
    });
  }

  // 6. Critical path (on actual schedule)
  const critical_path = rcpspCriticalPath(dag, sched, topoOrder, total_days);

  // 7. Utilization + bottleneck
  const utilization = computeUtilization(dag, sched, total_days, numFW, numRB, num_sets);
  const bottleneck = analyzeBottleneck(
    utilization, num_sets, numFW, numRB,
    input.curing_days, input.assembly_days + input.rebar_days,
  );

  // 8. Gantt
  const gantt = renderGantt(tact_details, total_days, num_sets, dag, sched, numFW, numRB);

  return {
    total_days, sequential_days, savings_days, savings_pct,
    tact_details, critical_path, gantt, utilization, bottleneck,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// UTILIZATION
// ═══════════════════════════════════════════════════════════════════════

function computeUtilization(
  dag: ActivityDAG,
  sched: Map<string, ScheduleMap>,
  total_days: number,
  numFW: number,
  numRB: number,
  numSets: number,
): { formwork_crews: number; rebar_crews: number; sets: number[] } {
  let fwBusy = 0;
  let rbBusy = 0;
  const setBusy = new Array(numSets).fill(0);

  for (const [id, v] of dag.V) {
    const s = sched.get(id)!;
    const dur = s.finish - s.start;

    if (v.crew === 'formwork') fwBusy += dur;
    if (v.crew === 'rebar') rbBusy += dur;
    if (v.type !== 'rebar') setBusy[v.set] += dur;
  }

  const fwTotal = total_days * numFW;
  const rbTotal = total_days * numRB;

  return {
    formwork_crews: fwTotal > 0 ? round(fwBusy / fwTotal) : 0,
    rebar_crews: rbTotal > 0 ? round(rbBusy / rbTotal) : 0,
    sets: setBusy.map(b => total_days > 0 ? round(b / total_days) : 0),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// BOTTLENECK ANALYSIS
// ═══════════════════════════════════════════════════════════════════════

function analyzeBottleneck(
  util: { formwork_crews: number; rebar_crews: number; sets: number[] },
  numSets: number,
  numFW: number,
  numRB: number,
  curingDays: number,
  workDays: number,
): string | null {
  if (util.formwork_crews > 0.9 && numFW === 1) {
    return `Formwork crew at ${Math.round(util.formwork_crews * 100)}% — consider adding a second crew`;
  }

  const avgSetUtil = util.sets.reduce((s, v) => s + v, 0) / util.sets.length;
  if (avgSetUtil > 0.85 && curingDays > workDays) {
    return `Sets at ${Math.round(avgSetUtil * 100)}% occupancy, curing ${curingDays}d > work ${workDays}d — additional set would reduce idle time`;
  }

  if (util.rebar_crews < 0.5 && util.formwork_crews > 0.7) {
    return `Rebar crew idle ${Math.round((1 - util.rebar_crews) * 100)}% — formwork crew is the bottleneck`;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// GANTT CHART
// ═══════════════════════════════════════════════════════════════════════

function renderGantt(
  tacts: TactDetail[],
  total_days: number,
  numSets: number,
  dag: ActivityDAG,
  sched: Map<string, ScheduleMap>,
  numFW: number,
  numRB: number,
): string {
  const days = Math.ceil(total_days);
  if (days === 0) return '';

  const lines: string[] = [];

  // Scale
  const scale: string[] = [];
  for (let d = 0; d < days; d++) {
    scale.push(d % 5 === 0 ? String(d).padEnd(1) : ' ');
  }
  lines.push(`Den:  ${scale.join('').substring(0, days)}`);

  // Set timelines
  for (let s = 0; s < numSets; s++) {
    const row = new Array(days).fill('·');
    for (const td of tacts) {
      if (td.set !== s + 1) continue;
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
    for (const [id, v] of dag.V) {
      if (v.crew !== 'formwork') continue;
      const s = sched.get(id)!;
      if (s.crew_unit !== c) continue;
      fillRow(row, [s.start, s.finish], v.type === 'assembly' ? '█' : '▓');
    }
    lines.push(`${numFW > 1 ? `FW${c + 1}: ` : 'FW:   '}${row.join('')}`);
  }

  for (let c = 0; c < numRB; c++) {
    const row = new Array(days).fill('·');
    for (const [id, v] of dag.V) {
      if (v.crew !== 'rebar') continue;
      const s = sched.get(id)!;
      if (s.crew_unit !== c) continue;
      fillRow(row, [s.start, s.finish], '▒');
    }
    lines.push(`${numRB > 1 ? `RB${c + 1}: ` : 'RB:   '}${row.join('')}`);
  }

  lines.push('');
  lines.push('█=montáž ▒=výztuž ░=beton ═=zrání ▓=demontáž ·=volno');

  return lines.join('\n');
}

function fillRow(row: string[], range: [number, number], ch: string): void {
  const start = Math.floor(range[0]);
  const end = Math.ceil(range[1]);
  for (let d = start; d < end && d < row.length; d++) row[d] = ch;
}

// ═══════════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════════

function round(v: number): number {
  return Math.round(v * 10) / 10;
}
