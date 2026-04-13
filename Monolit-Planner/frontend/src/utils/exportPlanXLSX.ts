/**
 * Export planner results to a formatted XLSX workbook
 * Uses ExcelJS for client-side Excel generation with full styling
 * Design: Slate Minimal palette (matches r0.css design system)
 */
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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
  costs: { formwork_labor_czk: number; rebar_labor_czk: number; pour_labor_czk: number; formwork_rental_czk: number; total_labor_czk: number; props_labor_czk?: number; props_rental_czk?: number };
  props?: { needed: boolean; system: { name: string; manufacturer: string }; grid_spacing_m: number; num_props_per_tact: number; total_props_needed: number; assembly_days: number; disassembly_days: number; hold_days: number; rental_days: number; rental_cost_czk: number; labor_cost_czk: number; total_cost_czk: number; total_weight_kg: number; crane_needed: boolean };
  strategies: any;
  monte_carlo?: { p50: number; p80: number; p90: number; p95: number; mean: number; std_dev: number };
  deadline_check?: {
    deadline_days?: number;
    calculated_days: number;
    overrun_days: number;
    fits: boolean;
    suggestions: Array<{ label: string; total_days: number; total_cost_czk: number; extra_cost_czk: number; fits_deadline: boolean }>;
    cheapest_faster?: { label: string; total_days: number; extra_cost_czk: number };
    fastest?: { label: string; total_days: number; extra_cost_czk: number };
    best_for_deadline?: { label: string; total_days: number; extra_cost_czk: number };
  };
  warnings: string[];
  decision_log: string[];
}

// ============================================
// SLATE COLOR PALETTE (matches backend exporter.js)
// ============================================
const C = {
  // Backgrounds
  headerBg: 'F8FAFC',      // Slate 50
  sectionBg: 'F1F5F9',     // Slate 100
  white: 'FFFFFF',
  rowOdd: 'FAFAFA',
  titleBg: '1E293B',       // Slate 800 (dark header)

  // Borders
  borderLight: 'E2E8F0',   // Slate 200
  borderMedium: 'CBD5E1',  // Slate 300
  sectionAccent: '94A3B8',  // Slate 400

  // Text
  textPrimary: '0F172A',   // Slate 900
  textSecondary: '475569',  // Slate 600
  textMuted: '94A3B8',     // Slate 400
  textWhite: 'FFFFFF',

  // Accents
  positive: '059669',      // Emerald
  warning: 'D97706',       // Amber
  orange: 'F97316',        // Brand orange

  // Phase colors (Gantt)
  phaseAssembly: '3B82F6',  // Blue
  phaseRebar: 'F59E0B',     // Amber
  phaseConcrete: 'EF4444',  // Red
  phaseCuring: 'A3E635',    // Lime
  phaseStripping: '8B5CF6', // Purple
};

const FONT_MONO = 'JetBrains Mono';
const FONT_MAIN = 'Calibri';

// ── Reusable style helpers ──────────────────────────────────────────

function fillBg(color: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } };
}

function borderThin(color: string = C.borderLight): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF' + color } };
  return { top: side, bottom: side, left: side, right: side };
}

function borderBottom(color: string = C.borderMedium, style: ExcelJS.BorderStyle = 'thin'): Partial<ExcelJS.Borders> {
  return { bottom: { style, color: { argb: 'FF' + color } } };
}

/** Title row: dark Slate 800 background, white bold text */
function applyTitleStyle(row: ExcelJS.Row, lastCol: number) {
  row.height = 30;
  row.font = { name: FONT_MAIN, size: 14, bold: true, color: { argb: 'FF' + C.textWhite } };
  for (let i = 1; i <= lastCol; i++) {
    row.getCell(i).fill = fillBg(C.titleBg);
    row.getCell(i).border = borderThin(C.titleBg);
  }
}

/** Section header: Slate 100 background, bold Slate 900, left accent border */
function applySectionStyle(row: ExcelJS.Row, lastCol: number) {
  row.height = 22;
  row.font = { name: FONT_MAIN, size: 11, bold: true, color: { argb: 'FF' + C.textPrimary } };
  for (let i = 1; i <= lastCol; i++) {
    const cell = row.getCell(i);
    cell.fill = fillBg(C.sectionBg);
    cell.border = {
      ...borderThin(C.borderLight),
      left: i === 1 ? { style: 'medium', color: { argb: 'FF' + C.sectionAccent } } : borderThin(C.borderLight).left,
    };
  }
}

/** Data row: alternating white/near-white, thin borders */
function applyDataRowStyle(row: ExcelJS.Row, rowIndex: number, lastCol: number) {
  const bg = rowIndex % 2 === 0 ? C.white : C.rowOdd;
  row.font = { name: FONT_MAIN, size: 10, color: { argb: 'FF' + C.textPrimary } };
  for (let i = 1; i <= lastCol; i++) {
    const cell = row.getCell(i);
    cell.fill = fillBg(bg);
    cell.border = borderThin(C.borderLight);
  }
}

/** Column header: Slate 50 background, secondary text, medium bottom border */
function applyHeaderStyle(row: ExcelJS.Row, lastCol: number) {
  row.height = 22;
  row.font = { name: FONT_MAIN, size: 10, bold: true, color: { argb: 'FF' + C.textSecondary } };
  for (let i = 1; i <= lastCol; i++) {
    const cell = row.getCell(i);
    cell.fill = fillBg(C.headerBg);
    cell.border = { ...borderThin(C.borderLight), bottom: { style: 'medium', color: { argb: 'FF' + C.borderMedium } } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
}

/** Total row: double top border, bold */
function applyTotalStyle(row: ExcelJS.Row, lastCol: number) {
  row.height = 24;
  row.font = { name: FONT_MAIN, size: 11, bold: true, color: { argb: 'FF' + C.textPrimary } };
  for (let i = 1; i <= lastCol; i++) {
    const cell = row.getCell(i);
    cell.fill = fillBg(C.headerBg);
    cell.border = { ...borderThin(C.borderLight), top: { style: 'double', color: { argb: 'FF' + C.borderMedium } } };
  }
}

/** KPI value: emerald green, bold */
function applyKpiValueStyle(cell: ExcelJS.Cell) {
  cell.font = { name: FONT_MAIN, size: 11, bold: true, color: { argb: 'FF' + C.positive } };
}

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

interface ScenarioData {
  id: number;
  label: string;
  formwork_system: string;
  manufacturer: string;
  num_formwork_crews: number;
  num_rebar_crews: number;
  crew_size: number;
  num_sets: number;
  shift_h: number;
  wage_czk_h: number;
  total_days: number;
  assembly_days: number;
  curing_days: number;
  disassembly_days: number;
  pour_hours: number;
  formwork_labor_czk: number;
  rebar_labor_czk: number;
  pour_labor_czk: number;
  props_labor_czk: number;
  props_rental_czk: number;
  total_labor_czk: number;
  rental_czk: number;
  total_all_czk: number;
  has_overtime: boolean;
}

export async function exportPlanToXLSX(plan: PlannerOutput, startDate: string, scenarios?: ScenarioData[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'STAVAGENT Planner';
  wb.created = new Date();

  // ─── Sheet 1: Souhrn (Summary) ──────────────────────────────────────
  const ws1 = wb.addWorksheet('Souhrn', {
    properties: { defaultColWidth: 20 },
    views: [{ showGridLines: false }],
  });

  ws1.columns = [
    { width: 30 },  // A: labels
    { width: 28 },  // B: values
    { width: 16 },  // C: units/extra
  ];

  // Title
  const titleRow = ws1.addRow(['PLÁN BETONÁŽE — SOUHRN']);
  ws1.mergeCells(titleRow.number, 1, titleRow.number, 3);
  applyTitleStyle(titleRow, 3);
  titleRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

  ws1.addRow([]); // spacer

  // Helper to add a labeled section
  let dataRowIdx = 0;
  const addSection = (label: string) => {
    const r = ws1.addRow([label]);
    applySectionStyle(r, 3);
    dataRowIdx = 0;
  };
  const addKV = (key: string, value: string | number, unit?: string) => {
    const r = ws1.addRow([key, value, unit || '']);
    applyDataRowStyle(r, dataRowIdx++, 3);
    r.getCell(1).font = { name: FONT_MAIN, size: 10, color: { argb: 'FF' + C.textSecondary } };
    if (typeof value === 'number') {
      r.getCell(2).numFmt = Number.isInteger(value) ? '#,##0' : '#,##0.00';
      r.getCell(2).alignment = { horizontal: 'right' };
    }
    r.getCell(2).font = { name: FONT_MAIN, size: 10, bold: true, color: { argb: 'FF' + C.textPrimary } };
  };

  // Element
  addSection('Element');
  addKV('Typ', plan.element.label_cs);
  addKV('Podtyp', plan.element.type);
  addKV('Orientace', plan.element.profile.orientation === 'horizontal' ? 'Horizontální' : 'Vertikální');
  addKV('Podpěry', plan.element.profile.needs_supports ? 'Ano' : 'Ne');

  ws1.addRow([]);

  // Postup betonáže
  addSection('Postup betonáže');
  addKV('Režim', `${plan.pour_decision.pour_mode} / ${plan.pour_decision.sub_mode}`);
  addKV('Scheduling', plan.pour_decision.scheduling_mode);
  addKV('Počet záběrů', plan.pour_decision.num_tacts);
  addKV('Objem / záběr', plan.pour_decision.tact_volume_m3, 'm³');

  ws1.addRow([]);

  // Bednění
  addSection('Bednění');
  addKV('Systém', `${plan.formwork.system.name} (${plan.formwork.system.manufacturer})`);
  addKV('Montáž / záběr', plan.formwork.assembly_days, 'dní');
  addKV('Zrání', plan.formwork.curing_days, 'dní');
  addKV('Demontáž / záběr', plan.formwork.disassembly_days, 'dní');
  addKV('Počet souprav', plan.formwork.num_sets);

  ws1.addRow([]);

  // Výztuž
  addSection('Výztuž');
  addKV('Hmotnost / záběr', plan.rebar.mass_kg, 'kg');
  addKV('Doba / záběr', plan.rebar.duration_days, 'dní');
  addKV('Norma', plan.rebar.norm_h_per_t, 'h/t');

  ws1.addRow([]);

  // Betonáž
  addSection('Betonáž');
  addKV('Efektivní výkon', plan.pour.effective_rate_m3_h, 'm³/h');
  addKV('Doba čerpání', plan.pour.total_pour_hours, 'h');
  addKV('Doba betonáže', plan.pour.pour_days, 'dní');

  // Podpěrná konstrukce (if calculated)
  if (plan.props?.needed) {
    ws1.addRow([]);
    addSection('Podpěrná konstrukce (stojky / skruž)');
    addKV('Systém', `${plan.props.system.name} (${plan.props.system.manufacturer})`);
    addKV('Raster', `${plan.props.grid_spacing_m} × ${plan.props.grid_spacing_m} m`);
    addKV('Počet stojek / záběr', plan.props.num_props_per_tact, 'ks');
    addKV('Montáž / záběr', plan.props.assembly_days, 'dní');
    addKV('Ponechání', plan.props.hold_days, 'dní');
    addKV('Demontáž / záběr', plan.props.disassembly_days, 'dní');
    addKV('Pronájem celkem', plan.props.rental_days, 'dní');
    addKV('Hmotnost', `${(plan.props.total_weight_kg / 1000).toFixed(1)}`, 't');
    addKV('Pronájem — náklady', Math.round(plan.props.rental_cost_czk), 'Kč');
    addKV('Práce — náklady', Math.round(plan.props.labor_cost_czk), 'Kč');
    addKV('Celkem podpěry', Math.round(plan.props.total_cost_czk), 'Kč');
    if (plan.props.crane_needed) {
      addKV('Jeřáb', 'Nutný pro montáž/demontáž podpěr');
    }
  }

  ws1.addRow([]);

  // Harmonogram
  addSection('Harmonogram');
  addKV('Celkem pracovních dní', plan.schedule.total_days, 'dní');
  addKV('Sekvenčně', plan.schedule.sequential_days, 'dní');
  addKV('Úspora', plan.schedule.savings_days, 'dní');
  addKV('Úspora', plan.schedule.savings_pct, '%');
  addKV('Datum zahájení', startDate || '-');

  // Resource optimization + deadline
  if (plan.deadline_check) {
    const dc = plan.deadline_check;
    ws1.addRow([]);
    addSection('Optimalizace zdrojů');
    if (dc.deadline_days) {
      addKV('Termín investora', dc.deadline_days, 'dní');
      addKV('Stav termínu', dc.fits ? 'SPLNĚNO' : 'PŘEKROČENO');
      if (!dc.fits) addKV('Překročení', dc.overrun_days, 'dní');
    }
    if (dc.fastest) {
      addKV('Nejrychlejší varianta', dc.fastest.label);
      addKV('Nejrychlejší — dní', dc.fastest.total_days, 'dní');
      addKV('Nejrychlejší — náklady navíc', dc.fastest.extra_cost_czk, 'Kč');
    }
    if (dc.cheapest_faster && (!dc.fastest || dc.cheapest_faster.label !== dc.fastest.label)) {
      addKV('Nejlevnější zrychlení', dc.cheapest_faster.label);
      addKV('Nejlevnější — dní', dc.cheapest_faster.total_days, 'dní');
      addKV('Nejlevnější — náklady navíc', dc.cheapest_faster.extra_cost_czk, 'Kč');
    }
    if (dc.best_for_deadline) {
      addKV('Pro splnění termínu', dc.best_for_deadline.label);
      addKV('Pro termín — dní', dc.best_for_deadline.total_days, 'dní');
      addKV('Pro termín — náklady navíc', dc.best_for_deadline.extra_cost_czk, 'Kč');
    }
  }

  // Monte Carlo
  if (plan.monte_carlo) {
    ws1.addRow([]);
    addSection('Monte Carlo (PERT)');
    addKV('P50 (medián)', plan.monte_carlo.p50, 'dní');
    addKV('P80', plan.monte_carlo.p80, 'dní');
    addKV('P90', plan.monte_carlo.p90, 'dní');
    addKV('P95', plan.monte_carlo.p95, 'dní');
    addKV('Průměr', plan.monte_carlo.mean, 'dní');
    addKV('Směr. odchylka', plan.monte_carlo.std_dev, 'dní');
  }

  // Náklady
  ws1.addRow([]);
  addSection('Náklady');
  addKV('Bednění — práce', Math.round(plan.costs.formwork_labor_czk), 'Kč');
  addKV('Výztuž — práce', Math.round(plan.costs.rebar_labor_czk), 'Kč');
  addKV('Betonáž — práce', Math.round(plan.costs.pour_labor_czk), 'Kč');
  addKV('Bednění — pronájem', Math.round(plan.costs.formwork_rental_czk), 'Kč');
  if (plan.costs.props_labor_czk) addKV('Podpěry — práce', Math.round(plan.costs.props_labor_czk), 'Kč');
  if (plan.costs.props_rental_czk) addKV('Podpěry — pronájem', Math.round(plan.costs.props_rental_czk), 'Kč');

  // Totals
  const totalLaborRow = ws1.addRow(['CELKEM práce', Math.round(plan.costs.total_labor_czk), 'Kč']);
  applyTotalStyle(totalLaborRow, 3);
  applyKpiValueStyle(totalLaborRow.getCell(2));
  totalLaborRow.getCell(2).numFmt = '#,##0';
  totalLaborRow.getCell(2).alignment = { horizontal: 'right' };

  const totalAllRow = ws1.addRow(['CELKEM vše', Math.round(plan.costs.total_labor_czk + plan.costs.formwork_rental_czk + (plan.costs.props_rental_czk || 0)), 'Kč']);
  applyTotalStyle(totalAllRow, 3);
  applyKpiValueStyle(totalAllRow.getCell(2));
  totalAllRow.getCell(2).numFmt = '#,##0';
  totalAllRow.getCell(2).alignment = { horizontal: 'right' };

  // ─── Sheet 2: Harmonogram (Schedule) ────────────────────────────────
  const ws2 = wb.addWorksheet('Harmonogram', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  });

  const schedCols = ['Záběr', 'Sada', 'Montáž od', 'Montáž do', 'Výztuž od', 'Výztuž do', 'Beton od', 'Beton do', 'Zrání od', 'Zrání do', 'Demontáž od', 'Demontáž do'];
  ws2.columns = [
    { width: 10 }, { width: 8 },
    { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
    { width: 14 }, { width: 14 },
  ];

  // Header row
  const hdrRow = ws2.addRow(schedCols);
  applyHeaderStyle(hdrRow, 12);

  // Phase-colored header backgrounds
  const phaseColColors: Record<number, string> = {
    3: C.phaseAssembly, 4: C.phaseAssembly,   // Montáž = blue
    5: C.phaseRebar, 6: C.phaseRebar,         // Výztuž = amber
    7: C.phaseConcrete, 8: C.phaseConcrete,   // Beton = red
    9: C.phaseCuring, 10: C.phaseCuring,      // Zrání = lime
    11: C.phaseStripping, 12: C.phaseStripping, // Demontáž = purple
  };

  for (const [col, color] of Object.entries(phaseColColors)) {
    const cell = hdrRow.getCell(Number(col));
    cell.fill = fillBg(color);
    cell.font = { name: FONT_MAIN, size: 10, bold: true, color: { argb: 'FF' + C.textWhite } };
  }
  // First two columns keep neutral header
  hdrRow.getCell(1).fill = fillBg(C.titleBg);
  hdrRow.getCell(1).font = { name: FONT_MAIN, size: 10, bold: true, color: { argb: 'FF' + C.textWhite } };
  hdrRow.getCell(2).fill = fillBg(C.titleBg);
  hdrRow.getCell(2).font = { name: FONT_MAIN, size: 10, bold: true, color: { argb: 'FF' + C.textWhite } };

  // Data rows
  plan.schedule.tact_details.forEach((td, idx) => {
    const r = ws2.addRow([
      `T${td.tact}`, `S${td.set}`,
      td.assembly[0], td.assembly[1],
      td.rebar[0], td.rebar[1],
      td.concrete[0], td.concrete[1],
      td.curing[0], td.curing[1],
      td.stripping[0], td.stripping[1],
    ]);
    applyDataRowStyle(r, idx, 12);

    // Bold tact/set labels
    r.getCell(1).font = { name: FONT_MONO, size: 10, bold: true, color: { argb: 'FF' + C.textPrimary } };
    r.getCell(2).font = { name: FONT_MONO, size: 10, color: { argb: 'FF' + C.textSecondary } };

    // Right-align numeric columns
    for (let i = 3; i <= 12; i++) {
      r.getCell(i).alignment = { horizontal: 'right' };
      r.getCell(i).numFmt = '0.0';
    }
  });

  // ─── Sheet 3: Gantt (colored cells) ─────────────────────────────────
  // Draws one row per záběr; each day-column gets a background colour based
  // on the active phase for that day (precedence: concrete > stripping >
  // curing > rebar > assembly). Legend rows with colour swatches follow.
  //
  // Falls back to the old ASCII dump only when tact_details is empty.
  const hasTacts = (plan.schedule.tact_details?.length ?? 0) > 0;
  const totalDays = Math.max(1, Math.ceil(plan.schedule.total_days || 0));
  if (hasTacts) {
    const ws3 = wb.addWorksheet('Gantt', { views: [{ showGridLines: false }] });

    // Phase → colour map (matches the task spec palette)
    const PHASE = {
      assembly:  { argb: 'FF1E40AF', label: 'Montáž bednění' },
      rebar:     { argb: 'FF6B7280', label: 'Výztuž' },
      concrete:  { argb: 'FFD97706', label: 'Betonáž' },
      curing:    { argb: 'FF10B981', label: 'Zrání' },
      stripping: { argb: 'FF8B5CF6', label: 'Demontáž' },
    } as const;
    const PHASE_ORDER: Array<keyof typeof PHASE> =
      ['concrete', 'stripping', 'curing', 'rebar', 'assembly'];

    // Narrow 3-char day columns + wider label column
    ws3.columns = [
      { width: 8 },
      ...Array.from({ length: totalDays }, () => ({ width: 3 })),
    ];

    // Header row: "Záběr" + day numbers 1..N
    const hdrCells: (string | number)[] = ['Záběr'];
    for (let d = 1; d <= totalDays; d++) hdrCells.push(d);
    const hdr = ws3.addRow(hdrCells);
    hdr.height = 18;
    hdr.font = { name: FONT_MONO, size: 9, bold: true, color: { argb: 'FF' + C.textWhite } };
    for (let i = 1; i <= totalDays + 1; i++) {
      const cell = hdr.getCell(i);
      cell.fill = fillBg(C.titleBg);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    // Data rows — one per záběr
    plan.schedule.tact_details.forEach((td) => {
      const row = ws3.addRow([`T${td.tact}`]);
      row.height = 16;
      row.getCell(1).font = { name: FONT_MONO, size: 10, bold: true, color: { argb: 'FF' + C.textPrimary } };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(1).fill = fillBg(C.headerBg);

      for (let d = 1; d <= totalDays; d++) {
        const cell = row.getCell(d + 1);
        cell.border = borderThin(C.borderLight);
        // Pick the highest-precedence phase whose [start, end] covers day d.
        // Convention: a range [a, b] covers days (a, b] (exclusive start,
        // inclusive end) — matches how the scheduler emits them.
        for (const phaseKey of PHASE_ORDER) {
          const range = (td as any)[phaseKey] as [number, number] | undefined;
          if (!range) continue;
          if (d > range[0] && d <= range[1]) {
            cell.fill = fillBg(PHASE[phaseKey].argb.slice(2));  // drop 'FF' prefix
            break;
          }
        }
      }
    });

    // Legend
    ws3.addRow([]);
    const legendTitle = ws3.addRow(['Legenda:']);
    legendTitle.getCell(1).font = { name: FONT_MAIN, size: 10, bold: true, color: { argb: 'FF' + C.textSecondary } };

    for (const key of ['assembly', 'rebar', 'concrete', 'curing', 'stripping'] as const) {
      const info = PHASE[key];
      const r = ws3.addRow(['', info.label]);
      const swatch = r.getCell(1);
      swatch.fill = fillBg(info.argb.slice(2));
      swatch.border = borderThin(C.borderLight);
      r.getCell(2).font = { name: FONT_MAIN, size: 10, color: { argb: 'FF' + C.textPrimary } };
      r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    }
  } else if (plan.schedule.gantt) {
    // Fallback: no tact_details → dump the ASCII Gantt so the sheet still
    // shows *something* useful.
    const ws3 = wb.addWorksheet('Gantt', { views: [{ showGridLines: false }] });
    ws3.columns = [{ width: 100 }];
    plan.schedule.gantt.split('\n').forEach((line, idx) => {
      const r = ws3.addRow([line]);
      r.font = { name: FONT_MONO, size: 10, color: { argb: 'FF' + C.textPrimary } };
      if (idx === 0) {
        r.font = { name: FONT_MONO, size: 10, bold: true, color: { argb: 'FF' + C.textWhite } };
        r.getCell(1).fill = fillBg(C.titleBg);
      }
    });
  }

  // ─── Sheet 4: Varování + Log ────────────────────────────────────────
  const ws4 = wb.addWorksheet('Log', {
    views: [{ showGridLines: false }],
  });
  ws4.columns = [{ width: 120 }];

  // Warnings section
  const warnTitle = ws4.addRow(['VAROVÁNÍ']);
  applyTitleStyle(warnTitle, 1);
  warnTitle.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

  if (plan.warnings.length === 0) {
    const r = ws4.addRow(['Žádná varování']);
    r.font = { name: FONT_MAIN, size: 10, color: { argb: 'FF' + C.positive } };
  } else {
    plan.warnings.forEach((w, idx) => {
      const r = ws4.addRow([w]);
      applyDataRowStyle(r, idx, 1);
      r.getCell(1).font = { name: FONT_MAIN, size: 10, color: { argb: 'FF' + C.warning } };
    });
  }

  ws4.addRow([]); // spacer

  // Decision log section
  const logTitle = ws4.addRow(['ROZHODOVACÍ LOG']);
  applySectionStyle(logTitle, 1);

  plan.decision_log.forEach((entry, idx) => {
    const r = ws4.addRow([entry]);
    applyDataRowStyle(r, idx, 1);
    r.getCell(1).font = { name: FONT_MAIN, size: 10, color: { argb: 'FF' + C.textSecondary } };
  });

  // ─── Sheet 5: Scenarios (if any) ─────────────────────────────────────
  if (scenarios && scenarios.length > 0) {
    const ws5 = wb.addWorksheet('Porovnání scénářů', {
      properties: { defaultColWidth: 16 },
      views: [{ showGridLines: false }],
    });

    const scHeaders = [
      'Scénář', 'Bednění', 'Výrobce', 'Tesaři', 'Železáři', 'Sady',
      'Směna (h)', 'Mzda (Kč/h)', 'Dní celkem', 'Montáž (d)', 'Zrání (d)',
      'Demontáž (d)', 'Betonáž (h)', 'Bednění práce (Kč)', 'Výztuž práce (Kč)',
      'Betonáž práce (Kč)', 'Podpěry (Kč)', 'Pronájem (Kč)', 'Celkem práce (Kč)',
      'Celkem vše (Kč)', 'Přesčas',
    ];

    const scTitle = ws5.addRow(['POROVNÁNÍ SCÉNÁŘŮ']);
    ws5.mergeCells(scTitle.number, 1, scTitle.number, scHeaders.length);
    applyTitleStyle(scTitle, scHeaders.length);

    ws5.addRow([]);

    const scHeaderRow = ws5.addRow(scHeaders);
    scHeaderRow.eachCell((cell) => {
      cell.font = { name: FONT_MAIN, size: 10, bold: true, color: { argb: 'FF' + C.textPrimary } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.sectionBg } };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF' + C.borderMedium } } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const minCost = Math.min(...scenarios.map(s => s.total_all_czk));
    const minDays = Math.min(...scenarios.map(s => s.total_days));

    scenarios.forEach((s, idx) => {
      const row = ws5.addRow([
        `S${s.id}`, s.formwork_system, s.manufacturer,
        `${s.num_formwork_crews ?? 1}×${s.crew_size}`,
        `${s.num_rebar_crews ?? 1}×${s.crew_size}`,
        s.num_sets, s.shift_h, s.wage_czk_h ?? 220,
        Math.round(s.total_days * 10) / 10,
        Math.round(s.assembly_days * 10) / 10,
        Math.round(s.curing_days * 10) / 10,
        Math.round(s.disassembly_days * 10) / 10,
        Math.round(s.pour_hours * 10) / 10,
        Math.round(s.formwork_labor_czk), Math.round(s.rebar_labor_czk),
        Math.round(s.pour_labor_czk), Math.round((s.props_labor_czk || 0) + (s.props_rental_czk || 0)),
        Math.round(s.rental_czk), Math.round(s.total_labor_czk),
        Math.round(s.total_all_czk), s.has_overtime ? 'ANO' : 'NE',
      ]);
      applyDataRowStyle(row, idx, scHeaders.length);
      // Highlight cheapest green, fastest orange
      if (s.total_all_czk === minCost) {
        row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } }; });
      } else if (s.total_days === minDays) {
        row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } }; });
      }
    });

    // Summary row
    if (scenarios.length >= 2) {
      ws5.addRow([]);
      const cheapest = scenarios.reduce((a, b) => a.total_all_czk <= b.total_all_czk ? a : b);
      const expensive = scenarios.reduce((a, b) => a.total_all_czk >= b.total_all_czk ? a : b);
      const savings = expensive.total_all_czk - cheapest.total_all_czk;
      const pct = ((savings / expensive.total_all_czk) * 100).toFixed(0);
      const sumRow = ws5.addRow([`Úspora: S${cheapest.id} vs S${expensive.id} = ${Math.round(savings).toLocaleString('cs-CZ')} Kč (−${pct}%)`]);
      ws5.mergeCells(sumRow.number, 1, sumRow.number, scHeaders.length);
      sumRow.getCell(1).font = { name: FONT_MAIN, size: 11, bold: true, color: { argb: 'FF' + C.positive } };
    }

    // Set column widths
    ws5.columns = scHeaders.map((h) => ({ width: h.includes('Kč') ? 20 : h.length > 12 ? 18 : 14 }));
  }

  // ─── Download ───────────────────────────────────────────────────────
  const filename = `plan_${plan.element.type}_${startDate || 'export'}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);
}
