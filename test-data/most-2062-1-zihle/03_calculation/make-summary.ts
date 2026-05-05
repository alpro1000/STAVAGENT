/**
 * make-summary.ts — Build cost_summary.xlsx + gantt_chart.svg from
 * per-element calculator outputs.
 *
 * Reads outputs/_all_outputs.json (produced by run-calc.ts), aggregates
 * costs and schedule, adds material costs + out-of-calculator items
 * (provizorium, demolice, smerova uprava, ZS), and writes:
 *   - cost_summary.xlsx (4 sheets: per-element, per-SO, total, harmonogram)
 *   - gantt_chart.svg (visual timeline)
 *
 * Run via:
 *   npm run summary
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUTS_DIR = path.resolve(__dirname, 'outputs');
const ALL_OUTPUTS = path.join(OUTPUTS_DIR, '_all_outputs.json');
const XLSX_PATH = path.resolve(__dirname, 'cost_summary.xlsx');
const SVG_PATH = path.resolve(__dirname, 'gantt_chart.svg');

// ─────────────────────────────────────────────────────────────────────
// Material price lookup (orientačně, CZ market 2026)
// ─────────────────────────────────────────────────────────────────────

const CONCRETE_PRICES_CZK_M3: Record<string, number> = {
  'C12/15': 2200,
  'C16/20': 2400,
  'C20/25': 2600,
  'C25/30': 2750,
  'C30/37': 3050,
  'C35/45': 3400,
  'C40/50': 3700,
};

const REBAR_PRICE_CZK_KG = 28;            // material only; labor in calc.
const FORMWORK_RENTAL_DAYS = 14;          // average rental period per element

// Element → SO mapping
const ELEMENT_TO_SO: Record<string, string> = {
  podkladni_beton: 'SO 201',
  zaklady_oper_levy: 'SO 201',
  zaklady_oper_pravy: 'SO 201',
  driky_oper_levy: 'SO 201',
  driky_oper_pravy: 'SO 201',
  mostovkova_deska: 'SO 201',
  zaverne_zidky: 'SO 201',
  rimsa_leva: 'SO 201',
  rimsa_prava: 'SO 201',
  prechodova_deska_leva: 'SO 201',
  prechodova_deska_prava: 'SO 201',
};

const ELEMENT_LABELS: Record<string, string> = {
  podkladni_beton: 'Podkladní beton',
  zaklady_oper_levy: 'Plošný základ — levá opěra',
  zaklady_oper_pravy: 'Plošný základ — pravá opěra',
  driky_oper_levy: 'Dřík opěry — levá',
  driky_oper_pravy: 'Dřík opěry — pravá',
  mostovkova_deska: 'Mostovková deska',
  zaverne_zidky: 'Závěrné zídky',
  rimsa_leva: 'Římsa — levá',
  rimsa_prava: 'Římsa — pravá (s 3× DN75 chráničkou)',
  prechodova_deska_leva: 'Přechodová deska — levá',
  prechodova_deska_prava: 'Přechodová deska — pravá',
};

const BUDGET_CZK = 30_000_000;
const MAX_DOBA_MESICU = 30;

// ─────────────────────────────────────────────────────────────────────
// Load + compute
// ─────────────────────────────────────────────────────────────────────

interface ElementResult {
  input: any;
  output: any;
  error?: string;
}

interface PerElementRow {
  id: string;
  label: string;
  so: string;
  element_type: string;
  volume_m3: number;
  formwork_area_m2: number;
  rebar_kg: number;
  concrete_class: string;
  // Calculator outputs (labor only)
  formwork_labor_czk: number;
  rebar_labor_czk: number;
  pour_labor_czk: number;
  formwork_rental_czk: number;
  props_labor_czk: number;
  props_rental_czk: number;
  total_labor_rental_czk: number;
  // Material (computed here, NOT in calculator)
  concrete_material_czk: number;
  rebar_material_czk: number;
  total_material_czk: number;
  // Grand total per element
  total_czk: number;
  // Schedule
  duration_days: number;
}

function buildPerElementRows(allOut: any): PerElementRow[] {
  const rows: PerElementRow[] = [];
  for (const [id, r] of Object.entries(allOut.elements as Record<string, ElementResult>)) {
    if (!r.output) continue;
    const inp = r.input;
    const out = r.output;
    const c = out.costs;
    const concretePrice = CONCRETE_PRICES_CZK_M3[inp.concrete_class] ?? 3000;
    const concreteMaterial = (inp.volume_m3 ?? 0) * concretePrice;
    const rebarMaterial = (inp.rebar_mass_kg ?? 0) * REBAR_PRICE_CZK_KG;
    const totalLabRent = (c?.total_labor_czk ?? 0)
      + (c?.formwork_rental_czk ?? 0)
      + (c?.props_labor_czk ?? 0)
      + (c?.props_rental_czk ?? 0)
      + (c?.mss_mobilization_czk ?? 0)
      + (c?.mss_demobilization_czk ?? 0)
      + (c?.mss_rental_czk ?? 0);
    const totalMat = concreteMaterial + rebarMaterial;
    rows.push({
      id,
      label: ELEMENT_LABELS[id] ?? id,
      so: ELEMENT_TO_SO[id] ?? 'SO ?',
      element_type: inp.element_type,
      volume_m3: inp.volume_m3 ?? 0,
      formwork_area_m2: inp.formwork_area_m2 ?? 0,
      rebar_kg: inp.rebar_mass_kg ?? 0,
      concrete_class: inp.concrete_class ?? '?',
      formwork_labor_czk: c?.formwork_labor_czk ?? 0,
      rebar_labor_czk: c?.rebar_labor_czk ?? 0,
      pour_labor_czk: c?.pour_labor_czk ?? 0,
      formwork_rental_czk: c?.formwork_rental_czk ?? 0,
      props_labor_czk: c?.props_labor_czk ?? 0,
      props_rental_czk: c?.props_rental_czk ?? 0,
      total_labor_rental_czk: totalLabRent,
      concrete_material_czk: concreteMaterial,
      rebar_material_czk: rebarMaterial,
      total_material_czk: totalMat,
      total_czk: totalLabRent + totalMat,
      duration_days: out.schedule?.total_days ?? 0,
    });
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────
// Excel build
// ─────────────────────────────────────────────────────────────────────

async function buildExcel(allOut: any, rows: PerElementRow[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'STAVAGENT Sandbox';
  wb.created = new Date();

  // ── Sheet 1: Per-element summary ──────────────────────────────────
  const sh1 = wb.addWorksheet('1_Per_element');
  sh1.columns = [
    { header: 'ID', key: 'id', width: 26 },
    { header: 'Element (CS)', key: 'label', width: 38 },
    { header: 'SO', key: 'so', width: 8 },
    { header: 'Element type', key: 'element_type', width: 24 },
    { header: 'V [m³]', key: 'volume_m3', width: 9, style: { numFmt: '0.00' } },
    { header: 'F [m²]', key: 'formwork_area_m2', width: 9, style: { numFmt: '0.0' } },
    { header: 'Výztuž [kg]', key: 'rebar_kg', width: 11 },
    { header: 'Beton', key: 'concrete_class', width: 9 },
    { header: 'Bednění práce', key: 'formwork_labor_czk', width: 14, style: { numFmt: '#,##0' } },
    { header: 'Bednění nájem', key: 'formwork_rental_czk', width: 14, style: { numFmt: '#,##0' } },
    { header: 'Stojky práce', key: 'props_labor_czk', width: 13, style: { numFmt: '#,##0' } },
    { header: 'Stojky nájem', key: 'props_rental_czk', width: 13, style: { numFmt: '#,##0' } },
    { header: 'Výztuž práce', key: 'rebar_labor_czk', width: 13, style: { numFmt: '#,##0' } },
    { header: 'Betonáž práce', key: 'pour_labor_czk', width: 14, style: { numFmt: '#,##0' } },
    { header: 'Materiál beton', key: 'concrete_material_czk', width: 14, style: { numFmt: '#,##0' } },
    { header: 'Materiál výztuž', key: 'rebar_material_czk', width: 14, style: { numFmt: '#,##0' } },
    { header: 'Celkem [Kč]', key: 'total_czk', width: 16, style: { numFmt: '#,##0' } },
    { header: 'Dní', key: 'duration_days', width: 7, style: { numFmt: '0.0' } },
  ];
  sh1.getRow(1).font = { bold: true };
  rows.forEach(r => sh1.addRow(r));
  // Total row
  const sumRow = sh1.addRow({
    id: 'CELKEM betonářské práce (calculator)',
    label: '',
    formwork_labor_czk: rows.reduce((s, r) => s + r.formwork_labor_czk, 0),
    formwork_rental_czk: rows.reduce((s, r) => s + r.formwork_rental_czk, 0),
    props_labor_czk: rows.reduce((s, r) => s + r.props_labor_czk, 0),
    props_rental_czk: rows.reduce((s, r) => s + r.props_rental_czk, 0),
    rebar_labor_czk: rows.reduce((s, r) => s + r.rebar_labor_czk, 0),
    pour_labor_czk: rows.reduce((s, r) => s + r.pour_labor_czk, 0),
    concrete_material_czk: rows.reduce((s, r) => s + r.concrete_material_czk, 0),
    rebar_material_czk: rows.reduce((s, r) => s + r.rebar_material_czk, 0),
    total_czk: rows.reduce((s, r) => s + r.total_czk, 0),
    duration_days: rows.reduce((s, r) => s + r.duration_days, 0),
  });
  sumRow.font = { bold: true };

  // ── Sheet 2: Per-SO summary ───────────────────────────────────────
  const sh2 = wb.addWorksheet('2_Per_SO');
  sh2.columns = [
    { header: 'SO', key: 'so', width: 12 },
    { header: 'Název', key: 'name', width: 40 },
    { header: 'Cena [Kč]', key: 'cost', width: 16, style: { numFmt: '#,##0' } },
    { header: 'Doba [d]', key: 'days', width: 12, style: { numFmt: '0.0' } },
    { header: 'Confidence', key: 'conf', width: 14 },
    { header: 'Pozn.', key: 'note', width: 50 },
  ];
  sh2.getRow(1).font = { bold: true };

  const so201Cost = rows.reduce((s, r) => s + r.total_czk, 0);
  const so201Days = rows.reduce((s, r) => s + r.duration_days, 0);

  // SO 201 (calculator-derived)
  sh2.addRow({ so: 'SO 201', name: 'Most ev.č. 2062-1 (nová stavba — integrální rám)', cost: so201Cost, days: so201Days, conf: 'medium', note: 'Calculator output: betonářské práce + materiály betonu/výztuže. Bez mostního svršku.' });

  // Out-of-calculator items
  const ooc = allOut.out_of_calculator;
  const so001Cost = ooc.SO_001_demolice?.midpoint_czk ?? 0;
  const so180Cost = ooc.SO_180_provizorium?.midpoint_czk ?? 0;
  const so290Cost = ooc.SO_290_smerova_uprava?.midpoint_czk ?? 0;
  const svrsekCost = ooc.mostni_svrsek?.midpoint_czk ?? 0;

  sh2.addRow({ so: 'SO 001', name: 'Demolice stávajícího mostu', cost: so001Cost, days: 30, conf: 'low (orient.)', note: ooc.SO_001_demolice?.estimate_method ?? '' });
  sh2.addRow({ so: 'SO 180', name: 'Provizorium (Mabey C200, 6 měs)', cost: so180Cost, days: 180, conf: 'low (NO RFQ)', note: ooc.SO_180_provizorium?.estimate_method ?? '' });
  sh2.addRow({ so: 'SO 290', name: 'Směrová úprava silnice III/206 2 (~300 m)', cost: so290Cost, days: 60, conf: 'medium', note: ooc.SO_290_smerova_uprava?.estimate_method ?? '' });
  sh2.addRow({ so: 'Svršek', name: 'Mostní svršek (izolace + vozovka + svodidla + 3× chránička)', cost: svrsekCost, days: 30, conf: 'medium', note: 'Nad rámec calculator.' });

  // ZS (3-5 % from main works = average 4 %)
  const mainWorks = so001Cost + so180Cost + so201Cost + so290Cost + svrsekCost;
  const zsPct = 0.04;
  const zsCost = Math.round(mainWorks * zsPct);
  sh2.addRow({ so: 'ZS', name: 'Zařízení staveniště + VRN (4% per ČSN 73 0212)', cost: zsCost, days: 0, conf: 'medium', note: 'Aplikuje se na (SO 001 + SO 180 + SO 201 + SO 290 + svršek).' });

  // Total
  const totalProject = mainWorks + zsCost;
  const totalRow = sh2.addRow({ so: 'CELKEM', name: 'Celkem bez DPH', cost: totalProject, days: '', conf: '', note: '' });
  totalRow.font = { bold: true };

  // ── Sheet 3: Headroom vs budget ───────────────────────────────────
  const sh3 = wb.addWorksheet('3_Total_vs_budget');
  sh3.columns = [
    { header: 'Položka', key: 'item', width: 50 },
    { header: 'Hodnota', key: 'value', width: 18, style: { numFmt: '#,##0' } },
    { header: 'Pozn.', key: 'note', width: 60 },
  ];
  sh3.getRow(1).font = { bold: true };
  sh3.addRow({ item: 'Maximální cena dle ZD §5.5 + §19.5', value: BUDGET_CZK, note: 'bez DPH' });
  sh3.addRow({ item: 'Nabídková cena (orientační, sandbox sum)', value: totalProject, note: 'CALCULATOR_VALIDATED + out-of-calc orientační' });
  const headroom = BUDGET_CZK - totalProject;
  const headroomPct = (headroom / BUDGET_CZK) * 100;
  const headroomRow = sh3.addRow({ item: 'Headroom (rezerva proti budgetu)', value: headroom, note: `${headroomPct.toFixed(1)} % budgetu` });
  headroomRow.font = { bold: true, color: { argb: headroom > 0 ? 'FF008000' : 'FFCC0000' } };
  sh3.addRow({ item: '', value: '', note: '' });
  sh3.addRow({ item: 'Verdikt', value: headroom > 0 ? 'VEJDE SE' : 'NEVEJDE SE — překročení', note: headroom > 0 ? `Rezerva ${headroomPct.toFixed(1)} % na rizika + zisk` : 'Cost cutting nutný' });
  sh3.addRow({ item: '', value: '', note: '' });
  sh3.addRow({ item: 'Maximální doba realizace dle ZD §5.3 + §29.2', value: MAX_DOBA_MESICU, note: 'měsíců' });
  // Doba = max(SO 201, SO 180) sériově s SO 001 → cca 7-9 měsíců
  const realisticMonths = 9;  // engineering judgment from per-element schedule + out-of-calc days
  sh3.addRow({ item: 'Realistická doba realizace (sandbox odhad)', value: realisticMonths, note: 'měsíců (DUR + DSP + DPS + výstavba). Hluboko pod limitem 30 měsíců.' });
  sh3.addRow({ item: '', value: '', note: '' });
  sh3.addRow({ item: 'Confidence celkové ceny', value: 'medium-low', note: 'Calculator: medium (engine-validated). Out-of-calculator (SO 001/180/svršek): low — bez RFQ.' });
  sh3.addRow({ item: 'Klíčové neznámé', value: '', note: 'IGP (založení), geodézie, hydrologie, vendor RFQ provizoria, soulad linkové dopravy.' });

  // ── Sheet 4: Harmonogram ──────────────────────────────────────────
  const sh4 = wb.addWorksheet('4_Harmonogram');
  sh4.columns = [
    { header: 'Fáze / SO', key: 'phase', width: 40 },
    { header: 'Start [dní od T0]', key: 'start', width: 18 },
    { header: 'Délka [dní]', key: 'days', width: 14, style: { numFmt: '0.0' } },
    { header: 'Konec [dní]', key: 'end', width: 14 },
    { header: 'Pozn.', key: 'note', width: 50 },
  ];
  sh4.getRow(1).font = { bold: true };

  // Sériové pořadí: DUR + DSP (mimo calc, paralelně 90 dní) → SO 180 montáž → SO 001 → SO 201 (paralelně po elementech) → SO 290 → svršek → demontáž SO 180
  let cursor = 0;
  const phases: Array<{ phase: string; start: number; days: number; note: string }> = [];

  phases.push({ phase: 'DUR + DSP + DPS (paralelně)', start: 0, days: 90, note: 'ZD §4.3.a/b — pre-construction phases' });
  cursor = 90;

  phases.push({ phase: 'SO 180 — Provizorium montáž', start: cursor, days: 7, note: 'Mabey Compact 200' });
  cursor += 7;

  phases.push({ phase: 'SO 001 — Demolice stávajícího mostu', start: cursor, days: 30, note: 'Bouracie práce, ohled na koryto' });
  cursor += 30;

  // SO 201 — sériově per element pro jednoduchost
  const so201Start = cursor;
  for (const r of rows) {
    phases.push({ phase: `SO 201 — ${r.label}`, start: cursor, days: r.duration_days, note: `${r.element_type}, V=${r.volume_m3} m³` });
    cursor += r.duration_days;
  }
  const so201End = cursor;

  phases.push({ phase: 'SO 201 — Mostní svršek (izolace + vozovka)', start: cursor, days: 30, note: 'Out-of-calculator' });
  cursor += 30;

  phases.push({ phase: 'SO 290 — Směrová úprava silnice', start: cursor, days: 60, note: 'Out-of-calculator' });
  cursor += 60;

  phases.push({ phase: 'SO 180 — Provizorium demontáž', start: cursor, days: 7, note: '' });
  cursor += 7;

  phases.push({ phase: 'Pasport + Geodézie + Kolaudace', start: cursor, days: 30, note: 'ZD §4.3.g/h/i' });
  cursor += 30;

  for (const p of phases) {
    sh4.addRow({ phase: p.phase, start: p.start, days: p.days, end: p.start + p.days, note: p.note });
  }
  const totalDays = cursor;
  const totalRow4 = sh4.addRow({ phase: 'CELKEM', start: 0, days: totalDays, end: totalDays, note: `${(totalDays / 30).toFixed(1)} měsíců (SO 201 betonářské: ${(so201End - so201Start).toFixed(1)} d)` });
  totalRow4.font = { bold: true };

  // Save
  await wb.xlsx.writeFile(XLSX_PATH);
  console.log(`✅ ${XLSX_PATH}`);

  return { phases, totalDays, totalProject, headroom };
}

// ─────────────────────────────────────────────────────────────────────
// Gantt SVG
// ─────────────────────────────────────────────────────────────────────

function buildGanttSVG(phases: Array<{ phase: string; start: number; days: number; note: string }>, totalDays: number) {
  const W = 1200;
  const ROW_H = 28;
  const PAD_LEFT = 380;
  const PAD_TOP = 60;
  const BAR_AREA_W = W - PAD_LEFT - 40;
  const PIXEL_PER_DAY = BAR_AREA_W / totalDays;
  const H = PAD_TOP + phases.length * ROW_H + 40;

  const COLORS: Record<string, string> = {
    'DUR': '#94a3b8',
    'SO 180': '#fbbf24',
    'SO 001': '#f87171',
    'SO 201': '#60a5fa',
    'SO 290': '#86efac',
    'Pasport': '#a78bfa',
  };
  function colorFor(label: string) {
    if (label.startsWith('DUR')) return COLORS['DUR'];
    if (label.startsWith('SO 180')) return COLORS['SO 180'];
    if (label.startsWith('SO 001')) return COLORS['SO 001'];
    if (label.startsWith('SO 201')) return COLORS['SO 201'];
    if (label.startsWith('SO 290')) return COLORS['SO 290'];
    return COLORS['Pasport'];
  }

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="DM Sans, Helvetica, Arial, sans-serif">\n`;
  svg += `<rect width="${W}" height="${H}" fill="#fafaf9"/>\n`;
  svg += `<text x="20" y="32" font-size="18" font-weight="700" fill="#1c1917">Most 2062-1 Žihle — Harmonogram (sandbox Phase C)</text>\n`;
  svg += `<text x="20" y="52" font-size="11" fill="#57534e">Celkem ${totalDays.toFixed(0)} dní (~${(totalDays / 30).toFixed(1)} měsíců) — limit ZD §5.3 = 30 měsíců = 900 dní</text>\n`;

  // Time axis ticks (each 30 days = 1 month)
  for (let d = 0; d <= totalDays; d += 30) {
    const x = PAD_LEFT + d * PIXEL_PER_DAY;
    svg += `<line x1="${x}" y1="${PAD_TOP - 10}" x2="${x}" y2="${PAD_TOP + phases.length * ROW_H}" stroke="#e7e5e4" stroke-width="1"/>\n`;
    svg += `<text x="${x}" y="${PAD_TOP - 14}" font-size="9" fill="#78716c" text-anchor="middle">${(d / 30).toFixed(0)}m</text>\n`;
  }

  // Bars
  phases.forEach((p, i) => {
    const y = PAD_TOP + i * ROW_H + 4;
    const x = PAD_LEFT + p.start * PIXEL_PER_DAY;
    const w = Math.max(2, p.days * PIXEL_PER_DAY);
    svg += `<text x="${PAD_LEFT - 10}" y="${y + 14}" font-size="10" fill="#1c1917" text-anchor="end">${escapeXML(p.phase)}</text>\n`;
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${ROW_H - 8}" fill="${colorFor(p.phase)}" rx="2" ry="2"/>\n`;
    if (w > 40) {
      svg += `<text x="${x + 4}" y="${y + 14}" font-size="9" fill="#1c1917">${p.days.toFixed(1)}d</text>\n`;
    }
  });

  // Budget line @ 900 days (30 měsíců)
  const limitX = PAD_LEFT + 900 * PIXEL_PER_DAY;
  if (limitX < W - 40) {
    svg += `<line x1="${limitX}" y1="${PAD_TOP - 10}" x2="${limitX}" y2="${PAD_TOP + phases.length * ROW_H}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4,4"/>\n`;
    svg += `<text x="${limitX + 4}" y="${PAD_TOP - 14}" font-size="9" fill="#dc2626">ZD limit 30m</text>\n`;
  }

  svg += `</svg>\n`;

  fs.writeFileSync(SVG_PATH, svg);
  console.log(`✅ ${SVG_PATH}`);
}

function escapeXML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(ALL_OUTPUTS)) {
    throw new Error(`Missing ${ALL_OUTPUTS} — run \`npm run calc\` first.`);
  }
  const allOut = JSON.parse(fs.readFileSync(ALL_OUTPUTS, 'utf-8'));
  const rows = buildPerElementRows(allOut);
  const { phases, totalDays, totalProject, headroom } = await buildExcel(allOut, rows);
  buildGanttSVG(phases, totalDays);

  console.log(`\n📊 Summary:`);
  console.log(`   Per-element (calculator): ${rows.length} prvků`);
  console.log(`   Total project (incl. out-of-calc + ZS): ${totalProject.toLocaleString('cs-CZ')} Kč`);
  console.log(`   Budget headroom: ${headroom.toLocaleString('cs-CZ')} Kč (${((headroom/BUDGET_CZK)*100).toFixed(1)} %)`);
  console.log(`   Total schedule: ${totalDays.toFixed(0)} dní (~${(totalDays/30).toFixed(1)} měsíců) [limit 30 měs.]`);
}

main();
