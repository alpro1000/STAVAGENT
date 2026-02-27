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
}

// Internal activity node in the DAG
interface Node {
  id: string;
  tact: number;
  type: 'assembly' | 'rebar' | 'concrete' | 'curing' | 'stripping';
  duration: number;
  crew: 'formwork' | 'rebar' | null;
  fs_preds: string[];        // finish-to-start predecessors
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

  // Edge case: no tacts
  if (num_tacts <= 0) {
    return {
      total_days: 0, sequential_days: 0, savings_days: 0, savings_pct: 0,
      tact_details: [], critical_path: [], gantt: '', utilization: { formwork_crews: 0, rebar_crews: 0, sets: [] },
      bottleneck: null,
    };
  }

  // ─── 1. Build DAG ────────────────────────────────────────────────────────

  const nodes: Node[] = [];
  const rebar_lag = assembly_days * (rebar_lag_pct / 100);

  for (let t = 0; t < num_tacts; t++) {
    const set = t % num_sets;
    const prevOnSet = t - num_sets; // previous tact on same set

    // ASM: after STR of previous tact on same set
    nodes.push({
      id: `T${t}_ASM`, tact: t, type: 'assembly', duration: assembly_days,
      crew: 'formwork', fs_preds: prevOnSet >= 0 ? [`T${prevOnSet}_STR`] : [], set,
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
      id: `T${t}_CUR`, tact: t, type: 'curing', duration: curing_days,
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
        es = Math.max(es, s.finish);
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

  const cycle = assembly_days + rebar_days + concrete_days + curing_days + stripping_days;
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
      set: (t % num_sets) + 1,
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
  const bottleneck = analyzeBottleneck(utilization, num_sets, num_formwork_crews, num_rebar_crews, curing_days, assembly_days + rebar_days);

  // Gantt chart
  const gantt = renderGantt(tact_details, total_days, num_sets, nodes, sched, num_formwork_crews, num_rebar_crews);

  return {
    total_days, sequential_days, savings_days, savings_pct,
    tact_details, critical_path, gantt, utilization, bottleneck,
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
    return `Formwork crew at ${Math.round(util.formwork_crews * 100)}% — consider adding a second crew`;
  }

  // If sets are > 85% utilized and curing is long → more sets would help
  const avgSetUtil = util.sets.reduce((s, v) => s + v, 0) / util.sets.length;
  if (avgSetUtil > 0.85 && curingDays > workDays) {
    return `Sets at ${Math.round(avgSetUtil * 100)}% occupancy, curing ${curingDays}d > work ${workDays}d — additional set would reduce idle time`;
  }

  // If rebar crew idle > 50% → rebar is not the bottleneck
  if (util.rebar_crews < 0.5 && util.formwork_crews > 0.7) {
    return `Rebar crew idle ${Math.round((1 - util.rebar_crews) * 100)}% — formwork crew is the bottleneck`;
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
