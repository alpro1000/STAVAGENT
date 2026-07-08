/**
 * originalFileTools — unlock + recap hyperlinks on a synthetic workbook
 * mirroring the real tender-soupis shape (EstiCon/KROS export): recap sheet
 * «Rekapitulace» with object codes in column A (shared strings, leading
 * spaces), object sheets whose names END with the code, every sheet locked
 * with <sheetProtection>.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { unlockWorkbook, addRecapHyperlinks, matchRecapRowsToSheets } from './originalFileTools';

const PROT = '<sheetProtection algorithmName="SHA-512" hashValue="xxx" saltValue="yyy" spinCount="100000" sheet="1" objects="1" scenarios="1"/>';

function buildWorkbook(): JSZip {
  const zip = new JSZip();
  zip.file('xl/workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' +
    '<sheet name="Rekapitulace" sheetId="1" r:id="rId1"/>' +
    '<sheet name="D.1.2_PS 11-02-41.02" sheetId="2" r:id="rId2"/>' +
    '<sheet name="D.2.1.1.0_SO 00-14-01" sheetId="3" r:id="rId3"/>' +
    '</sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>' +
    '</Relationships>');
  zip.file('xl/sharedStrings.xml',
    '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="3" uniqueCount="3">' +
    '<si><t>Objekt</t></si>' +
    '<si><t xml:space="preserve">  PS 11-02-41.02</t></si>' +
    '<si><t xml:space="preserve">  SO 00-14-01</t></si>' +
    '</sst>');
  zip.file('xl/worksheets/sheet1.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetData>' +
    '<row r="9"><c r="A9" s="7" t="s"><v>0</v></c></row>' +
    '<row r="11"><c r="A11" s="7" t="s"><v>1</v></c></row>' +
    '<row r="15"><c r="A15" s="7" t="s"><v>2</v></c></row>' +
    '</sheetData>' +
    PROT +
    '<mergeCells count="1"><mergeCell ref="A1:A3"/></mergeCells>' +
    '<pageMargins left="0.7" right="0.7" top="0.78" bottom="0.78" header="0.3" footer="0.3"/>' +
    '</worksheet>');
  zip.file('xl/styles.xml',
    '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="10"/><name val="Arial"/></font></fonts>' +
    '<cellXfs count="8">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'.repeat(7) +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
    '</cellXfs></styleSheet>');
  for (const n of [2, 3]) {
    zip.file(`xl/worksheets/sheet${n}.xml`,
      '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetData/>' + PROT + '</worksheet>');
  }
  return zip;
}

describe('unlockWorkbook', () => {
  it('strips sheetProtection from every worksheet', async () => {
    const zip = buildWorkbook();
    const removed = await unlockWorkbook(zip);
    expect(removed).toBe(3);
    for (const n of [1, 2, 3]) {
      const xml = await zip.file(`xl/worksheets/sheet${n}.xml`)!.async('string');
      expect(xml).not.toContain('sheetProtection');
    }
  });

  it('is a no-op on an already unlocked workbook', async () => {
    const zip = buildWorkbook();
    await unlockWorkbook(zip);
    expect(await unlockWorkbook(zip)).toBe(0);
  });
});

describe('addRecapHyperlinks', () => {
  it('links recap column-A codes to the sheets whose names end with them', async () => {
    const zip = buildWorkbook();
    const added = await addRecapHyperlinks(zip);
    expect(added).toBe(2);

    const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(xml).toContain('<hyperlinks>');
    expect(xml).toContain('<hyperlink ref="A11" location="\'D.1.2_PS 11-02-41.02\'!A1"');
    expect(xml).toContain('<hyperlink ref="A15" location="\'D.2.1.1.0_SO 00-14-01\'!A1"');
    // 'Objekt' (A9) matches no sheet → no link
    expect(xml).not.toContain('ref="A9"');
    // Block sits after mergeCells per OOXML element order
    expect(xml.indexOf('</mergeCells>')).toBeLessThan(xml.indexOf('<hyperlinks>'));
    expect(xml.indexOf('<hyperlinks>')).toBeLessThan(xml.indexOf('<pageMargins'));
  });

  it('is idempotent — re-run replaces the block instead of duplicating', async () => {
    const zip = buildWorkbook();
    await addRecapHyperlinks(zip);
    await addRecapHyperlinks(zip);
    const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(xml.match(/<hyperlinks>/g)).toHaveLength(1);
    expect(xml.match(/<hyperlink ref="A11"/g)).toHaveLength(1);
  });

  it('styles linked cells with a new blue underlined font (best-effort)', async () => {
    const zip = buildWorkbook();
    await addRecapHyperlinks(zip);
    const styles = await zip.file('xl/styles.xml')!.async('string');
    expect(styles).toContain('<u/><sz val="10"/><color rgb="FF0563C1"/>');
    expect(styles).toContain('<fonts count="2"');
    expect(styles).toContain('<cellXfs count="9"');
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet).toContain('<c r="A11" s="8"');
    expect(sheet).toContain('<c r="A15" s="8"');
    // Non-linked cell keeps its style
    expect(sheet).toContain('<c r="A9" s="7"');
  });
});

describe('matchRecapRowsToSheets', () => {
  it('prefers exact trimmed match over endsWith', () => {
    const links = matchRecapRowsToSheets(
      new Map([[5, 'SO 01']]),
      ['D.1_SO 01', 'SO 01'],
    );
    expect(links).toEqual([{ row: 5, display: 'SO 01', targetSheet: 'SO 01' }]);
  });

  it('skips empty and unmatched values', () => {
    const links = matchRecapRowsToSheets(
      new Map([[1, '   '], [2, 'Neexistuje'], [3, '  SO 02']]),
      ['D.9_SO 02'],
    );
    expect(links).toEqual([{ row: 3, display: '  SO 02', targetSheet: 'D.9_SO 02' }]);
  });
});
