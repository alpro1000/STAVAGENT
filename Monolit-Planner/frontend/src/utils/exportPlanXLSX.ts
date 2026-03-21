/**
 * Export planner results to a formatted XLSX workbook
 * Uses SheetJS (xlsx) for client-side Excel generation
 */
import * as XLSX from 'xlsx';

interface PlannerOutput {
  element: { type: string; label_cs: string; profile: { orientation: string; rebar_ratio_kg_m3: number; needs_supports: boolean } };
  pour_decision: { pour_mode: string; sub_mode: string; num_tacts: number; tact_volume_m3: number; scheduling_mode: string };
  formwork: { system: { name: string; manufacturer: string }; assembly_days: number; curing_days: number; disassembly_days: number; num_sets: number };
  rebar: { mass_kg: number; duration_days: number; norm_h_per_t: number; cost_labor: number };
  pour: { effective_rate_m3_h: number; total_pour_hours: number; pour_days: number };
  schedule: {
    total_days: number; sequential_days: number; savings_days: number; savings_pct: number;
    tact_details: Array<{ tact: number; set: number; assembly: [number, number]; rebar: [number, number]; concrete: [number, number]; curing: [number, number]; stripping: [number, number] }>;
    gantt?: string; critical_path?: string[];
  };
  costs: { formwork_labor_czk: number; rebar_labor_czk: number; pour_labor_czk: number; formwork_rental_czk: number; total_labor_czk: number };
  strategies: any;
  monte_carlo?: { p50: number; p80: number; p90: number; p95: number; mean: number; std_dev: number };
  warnings: string[];
  decision_log: string[];
}

export function exportPlanToXLSX(plan: PlannerOutput, startDate: string) {
  const wb = XLSX.utils.book_new();

  // ─── Sheet 1: Souhrn (Summary) ─────────────────────────────────────────
  const summaryData: (string | number)[][] = [
    ['PLÁN BETONÁŽE — SOUHRN'],
    [],
    ['Element', plan.element.label_cs],
    ['Typ', plan.element.type],
    ['Orientace', plan.element.profile.orientation === 'horizontal' ? 'Horizontální' : 'Vertikální'],
    ['Podpěry', plan.element.profile.needs_supports ? 'Ano' : 'Ne'],
    [],
    ['POSTUP BETONÁŽE'],
    ['Režim', `${plan.pour_decision.pour_mode} / ${plan.pour_decision.sub_mode}`],
    ['Scheduling', plan.pour_decision.scheduling_mode],
    ['Počet záběrů', plan.pour_decision.num_tacts],
    ['Objem / záběr (m³)', plan.pour_decision.tact_volume_m3],
    [],
    ['BEDNĚNÍ'],
    ['Systém', `${plan.formwork.system.name} (${plan.formwork.system.manufacturer})`],
    ['Montáž (dní/záběr)', plan.formwork.assembly_days],
    ['Zrání (dní)', plan.formwork.curing_days],
    ['Demontáž (dní/záběr)', plan.formwork.disassembly_days],
    ['Počet souprav', plan.formwork.num_sets],
    [],
    ['VÝZTUŽ'],
    ['Hmotnost / záběr (kg)', plan.rebar.mass_kg],
    ['Doba / záběr (dní)', plan.rebar.duration_days],
    ['Norma (h/t)', plan.rebar.norm_h_per_t],
    [],
    ['BETONÁŽ'],
    ['Efektivní výkon (m³/h)', plan.pour.effective_rate_m3_h],
    ['Doba čerpání (h)', plan.pour.total_pour_hours],
    ['Doba betonáže (dní)', plan.pour.pour_days],
    [],
    ['HARMONOGRAM'],
    ['Celkem pracovních dní', plan.schedule.total_days],
    ['Sekvenčně (dní)', plan.schedule.sequential_days],
    ['Úspora (dní)', plan.schedule.savings_days],
    ['Úspora (%)', plan.schedule.savings_pct],
    ['Datum zahájení', startDate || '-'],
  ];

  if (plan.monte_carlo) {
    summaryData.push([], ['MONTE CARLO (PERT)']);
    summaryData.push(['P50 (medián)', plan.monte_carlo.p50]);
    summaryData.push(['P80', plan.monte_carlo.p80]);
    summaryData.push(['P90', plan.monte_carlo.p90]);
    summaryData.push(['P95', plan.monte_carlo.p95]);
    summaryData.push(['Průměr', plan.monte_carlo.mean]);
    summaryData.push(['Směr. odchylka', plan.monte_carlo.std_dev]);
  }

  summaryData.push([], ['NÁKLADY (Kč)']);
  summaryData.push(['Bednění — práce', Math.round(plan.costs.formwork_labor_czk)]);
  summaryData.push(['Výztuž — práce', Math.round(plan.costs.rebar_labor_czk)]);
  summaryData.push(['Betonáž — práce', Math.round(plan.costs.pour_labor_czk)]);
  summaryData.push(['Bednění — pronájem', Math.round(plan.costs.formwork_rental_czk)]);
  summaryData.push(['CELKEM práce', Math.round(plan.costs.total_labor_czk)]);
  summaryData.push(['CELKEM vše', Math.round(plan.costs.total_labor_czk + plan.costs.formwork_rental_czk)]);

  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  // Column widths
  ws1['!cols'] = [{ wch: 28 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Souhrn');

  // ─── Sheet 2: Harmonogram (Schedule) ───────────────────────────────────
  const schedHeader = ['Záběr', 'Sada', 'Montáž od', 'Montáž do', 'Výztuž od', 'Výztuž do', 'Beton od', 'Beton do', 'Zrání od', 'Zrání do', 'Demontáž od', 'Demontáž do'];
  const schedData: (string | number)[][] = [schedHeader];

  for (const td of plan.schedule.tact_details) {
    schedData.push([
      `T${td.tact}`, `S${td.set}`,
      td.assembly[0], td.assembly[1],
      td.rebar[0], td.rebar[1],
      td.concrete[0], td.concrete[1],
      td.curing[0], td.curing[1],
      td.stripping[0], td.stripping[1],
    ]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(schedData);
  ws2['!cols'] = [
    { wch: 8 }, { wch: 6 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, 'Harmonogram');

  // ─── Sheet 3: Gantt (ASCII) ─────────────────────────────────────────────
  if (plan.schedule.gantt) {
    const ganttLines = plan.schedule.gantt.split('\n').map(line => [line]);
    const ws3 = XLSX.utils.aoa_to_sheet(ganttLines);
    ws3['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Gantt');
  }

  // ─── Sheet 4: Varování + Log ────────────────────────────────────────────
  const logData: (string | number)[][] = [['VAROVÁNÍ']];
  for (const w of plan.warnings) {
    logData.push([w]);
  }
  logData.push([], ['ROZHODOVACÍ LOG']);
  for (const entry of plan.decision_log) {
    logData.push([entry]);
  }
  const ws4 = XLSX.utils.aoa_to_sheet(logData);
  ws4['!cols'] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Log');

  // ─── Download ───────────────────────────────────────────────────────────
  const filename = `plan_${plan.element.type}_${startDate || 'export'}.xlsx`;
  XLSX.writeFile(wb, filename);
}
