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
  costs: { formwork_labor_czk: number; rebar_labor_czk: number; pour_labor_czk: number; formwork_rental_czk: number; total_labor_czk: number };
  strategies: any;
  monte_carlo?: { p50: number; p80: number; p90: number; p95: number; mean: number; std_dev: number };
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

export async function exportPlanToXLSX(plan: PlannerOutput, startDate: string) {
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

  ws1.addRow([]);

  // Harmonogram
  addSection('Harmonogram');
  addKV('Celkem pracovních dní', plan.schedule.total_days, 'dní');
  addKV('Sekvenčně', plan.schedule.sequential_days, 'dní');
  addKV('Úspora', plan.schedule.savings_days, 'dní');
  addKV('Úspora', plan.schedule.savings_pct, '%');
  addKV('Datum zahájení', startDate || '-');

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

  // Totals
  const totalLaborRow = ws1.addRow(['CELKEM práce', Math.round(plan.costs.total_labor_czk), 'Kč']);
  applyTotalStyle(totalLaborRow, 3);
  applyKpiValueStyle(totalLaborRow.getCell(2));
  totalLaborRow.getCell(2).numFmt = '#,##0';
  totalLaborRow.getCell(2).alignment = { horizontal: 'right' };

  const totalAllRow = ws1.addRow(['CELKEM vše', Math.round(plan.costs.total_labor_czk + plan.costs.formwork_rental_czk), 'Kč']);
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

  // ─── Sheet 3: Gantt (ASCII) ─────────────────────────────────────────
  if (plan.schedule.gantt) {
    const ws3 = wb.addWorksheet('Gantt', {
      views: [{ showGridLines: false }],
    });
    ws3.columns = [{ width: 100 }];

    const ganttLines = plan.schedule.gantt.split('\n');
    ganttLines.forEach((line, idx) => {
      const r = ws3.addRow([line]);
      r.font = { name: FONT_MONO, size: 10, color: { argb: 'FF' + C.textPrimary } };

      // First line (header with day numbers) gets title style
      if (idx === 0) {
        r.font = { name: FONT_MONO, size: 10, bold: true, color: { argb: 'FF' + C.textWhite } };
        r.getCell(1).fill = fillBg(C.titleBg);
      }
      // Legend line
      if (line.includes('=montáž') || line.includes('=volno')) {
        r.font = { name: FONT_MONO, size: 9, color: { argb: 'FF' + C.textSecondary } };
        r.getCell(1).fill = fillBg(C.sectionBg);
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

  // ─── Download ───────────────────────────────────────────────────────
  const filename = `plan_${plan.element.type}_${startDate || 'export'}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);
}
