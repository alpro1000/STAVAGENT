/**
 * Original File Tools — on-demand transforms of the ORIGINAL imported
 * .xlsx (2026-07-08, user request):
 *
 *  1. unlockWorkbook()      — strip sheet/workbook protection so the file
 *     is editable again. Tender soupisy typically arrive with every sheet
 *     locked (<sheetProtection> with a SHA-512 hash); the lock is plain
 *     OOXML metadata, not encryption — removing the element restores
 *     editability without touching any data, formulas or styling.
 *  2. addRecapHyperlinks()  — turn object codes in column A of the first
 *     (recap) sheet into internal hyperlinks jumping to the matching
 *     object sheet ('  SO 11-10-01.01' → sheet 'D.2.1.1.0_SO 11-10-01.01').
 *
 * Both work at the ZIP/XML level (JSZip + regex, same approach as the
 * «Vrátit do původního» patch exporter) so the untouched parts of the
 * workbook stay byte-identical.
 */

import JSZip from 'jszip';
import { getOriginalFile } from '../originalFileStore';
import { downloadBlob } from './patchExporter';

// ─── XML helpers ────────────────────────────────────────────────────────────

const PROTECTION_PATTERNS: RegExp[] = [
  /<(?:\w+:)?sheetProtection\b[^>]*\/>/gi,
  /<(?:\w+:)?sheetProtection\b[^>]*>[\s\S]*?<\/(?:\w+:)?sheetProtection>/gi,
  /<(?:\w+:)?workbookProtection\b[^>]*\/>/gi,
  /<(?:\w+:)?fileSharing\b[^>]*\/>/gi,
  /<(?:\w+:)?protectedRanges\b[^>]*>[\s\S]*?<\/(?:\w+:)?protectedRanges>/gi,
];

function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function xmlEscapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `'Sheet name'!A1` reference with Excel apostrophe escaping. */
function sheetRef(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'!A1`;
}

// ─── 1. Unlock ──────────────────────────────────────────────────────────────

/**
 * Remove sheet/workbook protection from every worksheet + workbook.xml.
 * Returns the number of protection elements removed.
 */
export async function unlockWorkbook(zip: JSZip): Promise<number> {
  let removed = 0;
  const targets = Object.keys(zip.files).filter(
    (name) => /^xl\/worksheets\/[^/]+\.xml$/.test(name) || name === 'xl/workbook.xml',
  );
  for (const name of targets) {
    const file = zip.file(name);
    if (!file) continue;
    let xml = await file.async('string');
    let changed = false;
    for (const pattern of PROTECTION_PATTERNS) {
      xml = xml.replace(pattern, () => {
        removed++;
        changed = true;
        return '';
      });
    }
    if (changed) zip.file(name, xml);
  }
  return removed;
}

// ─── 2. Recap hyperlinks ────────────────────────────────────────────────────

interface WorkbookSheet {
  name: string;
  xmlPath: string; // e.g. xl/worksheets/sheet1.xml
}

/** Parse ordered sheet list (name + worksheet xml path) from workbook.xml + rels. */
async function readWorkbookSheets(zip: JSZip): Promise<WorkbookSheet[]> {
  const wbXml = await zip.file('xl/workbook.xml')?.async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  if (!wbXml || !relsXml) return [];

  const relTargets = new Map<string, string>();
  for (const rel of relsXml.matchAll(/<Relationship\b[^>]*>/gi)) {
    const tag = rel[0];
    const id = tag.match(/\bId="([^"]+)"/i)?.[1];
    const target = tag.match(/\bTarget="([^"]+)"/i)?.[1];
    if (!id || !target || !/worksheet/i.test(tag)) continue;
    // Normalise '/xl/worksheets/sheet1.xml' | 'worksheets/sheet1.xml' → zip path
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    relTargets.set(id, path.replace(/^xl\/xl\//, 'xl/'));
  }

  const sheets: WorkbookSheet[] = [];
  for (const m of wbXml.matchAll(/<(?:\w+:)?sheet\b[^>]*>/gi)) {
    const tag = m[0];
    const name = tag.match(/\bname="([^"]*)"/i)?.[1];
    const rid = tag.match(/\br:id="([^"]+)"/i)?.[1];
    if (!name || !rid) continue;
    const xmlPath = relTargets.get(rid);
    if (!xmlPath) continue;
    sheets.push({ name: xmlUnescape(name), xmlPath });
  }
  return sheets;
}

/** Parse sharedStrings.xml into an array of plain strings. */
async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const xml = await zip.file('xl/sharedStrings.xml')?.async('string');
  if (!xml) return [];
  const out: string[] = [];
  for (const si of xml.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/gi)) {
    // Concatenate every <t> fragment (rich-text runs split the string)
    let text = '';
    for (const t of si[1].matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/gi)) {
      text += xmlUnescape(t[1]);
    }
    out.push(text);
  }
  return out;
}

/** Extract column-A cell values (row → text) from a worksheet XML. */
function readColumnAValues(sheetXml: string, sharedStrings: string[]): Map<number, string> {
  const values = new Map<number, string>();
  for (const m of sheetXml.matchAll(
    /<(?:\w+:)?c\b[^>]*\br="A(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?c>/gi,
  )) {
    const row = parseInt(m[1], 10);
    const tag = m[0];
    const inner = m[2];
    const type = tag.match(/\bt="([^"]+)"/i)?.[1] ?? 'n';
    let text: string | null = null;
    if (type === 's') {
      const idx = inner.match(/<(?:\w+:)?v>(\d+)<\/(?:\w+:)?v>/i)?.[1];
      if (idx != null) text = sharedStrings[parseInt(idx, 10)] ?? null;
    } else if (type === 'inlineStr') {
      const t = inner.match(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/i)?.[1];
      if (t != null) text = xmlUnescape(t);
    } else if (type === 'str') {
      const v = inner.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/i)?.[1];
      if (v != null) text = xmlUnescape(v);
    }
    if (text != null) values.set(row, text);
  }
  return values;
}

export interface RecapLink {
  row: number;
  display: string;
  targetSheet: string;
}

/**
 * Match recap column-A entries to object sheets: exact trimmed match first,
 * then "sheet name ends with the code" ('  SO 11-10-01.01' → 'D.2.1.1.0_SO 11-10-01.01').
 */
export function matchRecapRowsToSheets(
  columnA: Map<number, string>,
  sheetNames: string[],
): RecapLink[] {
  const links: RecapLink[] = [];
  for (const [row, display] of columnA) {
    const key = display.trim();
    if (!key) continue;
    let target: string | undefined;
    for (const sh of sheetNames) {
      if (sh.trim() === key) { target = sh; break; }
    }
    if (!target) {
      for (const sh of sheetNames) {
        const trimmed = sh.trim();
        if (trimmed.length > key.length && trimmed.endsWith(key)) { target = sh; break; }
      }
    }
    if (target) links.push({ row, display, targetSheet: target });
  }
  return links;
}

/**
 * Insert an OOXML <hyperlinks> block with internal (location=) links into
 * the FIRST sheet of the workbook. Existing <hyperlinks> block is replaced
 * (idempotent). Returns the number of links written.
 */
export async function addRecapHyperlinks(zip: JSZip): Promise<number> {
  const sheets = await readWorkbookSheets(zip);
  if (sheets.length < 2) return 0;

  const recap = sheets[0];
  const file = zip.file(recap.xmlPath);
  if (!file) return 0;
  let xml = await file.async('string');

  const sharedStrings = await readSharedStrings(zip);
  const columnA = readColumnAValues(xml, sharedStrings);
  const links = matchRecapRowsToSheets(
    columnA,
    sheets.slice(1).map((s) => s.name),
  );
  if (links.length === 0) return 0;

  // Match the sheet's namespace style: '<x:worksheet' → prefixed elements
  const prefix = /<(\w+):worksheet\b/.exec(xml)?.[1];
  const p = prefix ? `${prefix}:` : '';

  const linksXml =
    `<${p}hyperlinks>` +
    links
      .map(
        (l) =>
          `<${p}hyperlink ref="A${l.row}" location="${xmlEscapeAttr(sheetRef(l.targetSheet))}" display="${xmlEscapeAttr(l.display)}"/>`,
      )
      .join('') +
    `</${p}hyperlinks>`;

  // Replace any existing hyperlinks block (idempotent re-run)
  xml = xml.replace(new RegExp(`<(?:\\w+:)?hyperlinks>[\\s\\S]*?</(?:\\w+:)?hyperlinks>`, 'i'), '');

  // OOXML element order: hyperlinks sit after mergeCells (and sheetData),
  // before printOptions/pageMargins/pageSetup/drawing.
  const mergeClose = new RegExp(`</(?:\\w+:)?mergeCells>`, 'i').exec(xml);
  if (mergeClose) {
    const at = mergeClose.index + mergeClose[0].length;
    xml = xml.slice(0, at) + linksXml + xml.slice(at);
  } else {
    const anchor = /<(?:\w+:)?(?:printOptions|pageMargins|pageSetup|headerFooter|drawing)\b/i.exec(xml);
    if (anchor) {
      xml = xml.slice(0, anchor.index) + linksXml + xml.slice(anchor.index);
    } else {
      xml = xml.replace(new RegExp(`</(?:\\w+:)?worksheet>`, 'i'), `${linksXml}$&`);
    }
  }

  zip.file(recap.xmlPath, xml);

  // Best-effort: style the linked cells blue+underline so they READ as
  // links. Failure here must never lose the (already working) links.
  try {
    await styleRecapLinkCells(zip, recap.xmlPath, xml, links.map((l) => l.row));
  } catch (err) {
    console.warn('[OriginalFileTools] Hyperlink styling skipped:', err instanceof Error ? err.message : err);
  }

  return links.length;
}

/**
 * Clone the cellXf of the first linked cell with a blue underlined font and
 * point every linked cell at the clone — so the links look like links
 * without touching the rest of the cell's formatting (borders, alignment).
 */
async function styleRecapLinkCells(zip: JSZip, sheetPath: string, sheetXml: string, rows: number[]): Promise<void> {
  const stylesFile = zip.file('xl/styles.xml');
  if (!stylesFile) return;
  const styles = await stylesFile.async('string');

  // 1. current style index of the first linked A-cell
  const firstRow = rows[0];
  const cellTag = new RegExp(`<(?:\\w+:)?c\\b[^>]*\\br="A${firstRow}"[^>]*>`, 'i').exec(sheetXml)?.[0];
  const currentS = cellTag?.match(/\bs="(\d+)"/)?.[1] ?? '0';

  // 2. append a hyperlink-look font (blue, underline)
  const fontsMatch = styles.match(/<fonts count="(\d+)"([^>]*)>/i);
  const cellXfsMatch = styles.match(/<cellXfs count="(\d+)"([^>]*)>/i);
  if (!fontsMatch || !cellXfsMatch) return;
  const newFontId = parseInt(fontsMatch[1], 10);
  const newXfId = parseInt(cellXfsMatch[1], 10);

  let out = styles.replace(fontsMatch[0], `<fonts count="${newFontId + 1}"${fontsMatch[2]}>`);
  out = out.replace(
    /<\/fonts>/i,
    `<font><u/><sz val="10"/><color rgb="FF0563C1"/><name val="Arial"/></font></fonts>`,
  );

  // 3. clone the xf of the source style with the new font
  const cellXfsBody = out.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/i)?.[1];
  if (!cellXfsBody) return;
  const xfs = cellXfsBody.match(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/gi) ?? [];
  const sourceXf = xfs[parseInt(currentS, 10)];
  if (!sourceXf) return;
  let clonedXf = sourceXf;
  clonedXf = /\bfontId="\d+"/.test(clonedXf)
    ? clonedXf.replace(/\bfontId="\d+"/, `fontId="${newFontId}"`)
    : clonedXf.replace(/<xf\b/, `<xf fontId="${newFontId}"`);
  clonedXf = /\bapplyFont="/.test(clonedXf)
    ? clonedXf.replace(/\bapplyFont="[^"]*"/, 'applyFont="1"')
    : clonedXf.replace(/<xf\b/, '<xf applyFont="1"');

  out = out.replace(cellXfsMatch[0], `<cellXfs count="${newXfId + 1}"${cellXfsMatch[2]}>`);
  out = out.replace(/<\/cellXfs>/i, `${clonedXf}</cellXfs>`);
  zip.file('xl/styles.xml', out);

  // 4. re-point linked cells at the cloned xf
  let patchedSheet = sheetXml;
  for (const row of rows) {
    patchedSheet = patchedSheet.replace(
      new RegExp(`(<(?:\\w+:)?c\\b[^>]*\\br="A${row}")([^>]*>)`, 'i'),
      (_all, head: string, tail: string) => {
        const rest = /\bs="\d+"/.test(tail) ? tail.replace(/\bs="\d+"/, `s="${newXfId}"`) : ` s="${newXfId}"${tail}`;
        return head + rest;
      },
    );
  }
  zip.file(sheetPath, patchedSheet);
}

// ─── Public entry points ────────────────────────────────────────────────────

export interface OriginalToolsResult {
  fileName: string;
  removedProtections: number;
  addedLinks: number;
}

async function loadOriginalZip(projectId: string): Promise<{ zip: JSZip; baseName: string } | null> {
  const original = await getOriginalFile(projectId);
  if (!original) return null;
  const zip = await JSZip.loadAsync(original.fileData);
  return { zip, baseName: original.fileName.replace(/\.(xlsx|xls)$/i, '') };
}

async function saveAndDownload(zip: JSZip, fileName: string): Promise<void> {
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  });
  downloadBlob(blob, fileName);
}

/** Download an unlocked copy of the original file. */
export async function downloadUnlockedOriginal(projectId: string): Promise<OriginalToolsResult> {
  const loaded = await loadOriginalZip(projectId);
  if (!loaded) throw new Error('Originální soubor není k dispozici.');
  const removed = await unlockWorkbook(loaded.zip);
  const fileName = `${loaded.baseName}_odemceno.xlsx`;
  await saveAndDownload(loaded.zip, fileName);
  return { fileName, removedProtections: removed, addedLinks: 0 };
}

/** Download an unlocked copy with recap→sheet hyperlinks added. */
export async function downloadUnlockedOriginalWithLinks(projectId: string): Promise<OriginalToolsResult> {
  const loaded = await loadOriginalZip(projectId);
  if (!loaded) throw new Error('Originální soubor není k dispozici.');
  const removed = await unlockWorkbook(loaded.zip);
  const added = await addRecapHyperlinks(loaded.zip);
  const fileName = `${loaded.baseName}_odemceno_odkazy.xlsx`;
  await saveAndDownload(loaded.zip, fileName);
  return { fileName, removedProtections: removed, addedLinks: added };
}
