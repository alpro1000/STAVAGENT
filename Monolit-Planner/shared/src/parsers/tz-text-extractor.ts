/**
 * TZ Text Extractor — regex-based parameter extraction from Czech TZ (technická zpráva) text.
 *
 * Extracts construction parameters from pasted/OCR'd TZ excerpts:
 *   - concrete_class, exposure_class, dimensions, spans, cables, etc.
 *   - confidence=1.0 for regex matches (deterministic)
 *
 * Designed for:
 *   1. Calculator textarea "Vložit text z TZ" (Phase 3)
 *   2. SmartInput document bridge pipeline (future Phase 1)
 *   3. MCP tool parameter enrichment (future)
 *
 * All patterns tested against SO-202/203/207 golden test TZ excerpts.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExtractedParam {
  /** Parameter name matching FormState / PlannerInput field */
  name: string;
  /** Extracted value (string, number, or boolean) */
  value: string | number | boolean;
  /** Display label in Czech */
  label_cs: string;
  /** Source confidence: 1.0 for regex, 0.7-0.9 for heuristic */
  confidence: number;
  /** Source: 'regex' | 'keyword' | 'heuristic' */
  source: 'regex' | 'keyword' | 'heuristic';
  /** Original matched text snippet */
  matched_text: string;
}

// ─── Normalize ──────────────────────────────────────────────────────────────

function norm(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─── Pattern definitions ────────────────────────────────────────────────────

/**
 * Extract all matching parameters from a TZ text excerpt.
 * Returns array of ExtractedParam sorted by confidence (highest first).
 */
export function extractFromText(text: string): ExtractedParam[] {
  const results: ExtractedParam[] = [];
  const normalized = norm(text);

  // 1. Concrete class: C12/15, C25/30, C35/45, etc.
  const concreteRe = /C(\d{2})\/(\d{2,3})/g;
  let m: RegExpExecArray | null;
  const concreteClasses = new Set<string>();
  while ((m = concreteRe.exec(text)) !== null) {
    concreteClasses.add(m[0]);
  }
  if (concreteClasses.size === 1) {
    const cls = [...concreteClasses][0];
    results.push({
      name: 'concrete_class', value: cls, label_cs: `Třída betonu: ${cls}`,
      confidence: 1.0, source: 'regex', matched_text: cls,
    });
  } else if (concreteClasses.size > 1) {
    // Multiple classes found — take the highest (most likely NK)
    const sorted = [...concreteClasses].sort((a, b) => {
      const na = parseInt(a.replace(/C(\d+)\/.*/, '$1'));
      const nb = parseInt(b.replace(/C(\d+)\/.*/, '$1'));
      return nb - na;
    });
    results.push({
      name: 'concrete_class', value: sorted[0],
      label_cs: `Třída betonu: ${sorted[0]} (nejvyšší z ${concreteClasses.size})`,
      confidence: 0.8, source: 'heuristic', matched_text: sorted.join(', '),
    });
  }

  // 2. Exposure class: XF2, XC4, XA2, etc.
  const exposureRe = /X[CDFAS][12345]?\d/g;
  const exposures = new Set<string>();
  while ((m = exposureRe.exec(text)) !== null) {
    exposures.add(m[0]);
  }
  if (exposures.size === 1) {
    const exp = [...exposures][0];
    results.push({
      name: 'exposure_class', value: exp, label_cs: `Třída prostředí: ${exp}`,
      confidence: 1.0, source: 'regex', matched_text: exp,
    });
  } else if (exposures.size > 1) {
    // Multiple — pick the most restrictive (XF > XD > XA > XC)
    const priority: Record<string, number> = { XF: 4, XD: 3, XA: 2, XS: 2, XC: 1 };
    const sorted = [...exposures].sort((a, b) =>
      (priority[b.slice(0, 2)] ?? 0) - (priority[a.slice(0, 2)] ?? 0)
    );
    results.push({
      name: 'exposure_class', value: sorted[0],
      label_cs: `Třída prostředí: ${sorted[0]} (z ${exposures.size}: ${sorted.join(', ')})`,
      confidence: 0.8, source: 'heuristic', matched_text: sorted.join(', '),
    });
  }

  // 3. Span pattern: "15 + 4 × 20 + 15 m" or "15.000 + 4 x 20.000 + 15.000"
  const spanShort = /(\d+[.,]?\d*)\s*\+\s*(\d+)\s*[×x]\s*(\d+[.,]?\d*)\s*\+\s*(\d+[.,]?\d*)/;
  const spanMatch = text.match(spanShort);
  if (spanMatch) {
    const first = parseFloat(spanMatch[1].replace(',', '.'));
    const count = parseInt(spanMatch[2]);
    const middle = parseFloat(spanMatch[3].replace(',', '.'));
    const last = parseFloat(spanMatch[4].replace(',', '.'));
    const numSpans = count + 2;
    results.push({
      name: 'span_m', value: middle, label_cs: `Rozpětí: ${middle} m (max pole)`,
      confidence: 1.0, source: 'regex', matched_text: spanMatch[0],
    });
    results.push({
      name: 'num_spans', value: numSpans, label_cs: `Počet polí: ${numSpans}`,
      confidence: 1.0, source: 'regex', matched_text: spanMatch[0],
    });
  } else {
    // Fallback: "X polí"
    const poliMatch = normalized.match(/(\d+)\s*poli/);
    if (poliMatch) {
      results.push({
        name: 'num_spans', value: parseInt(poliMatch[1]),
        label_cs: `Počet polí: ${poliMatch[1]}`,
        confidence: 1.0, source: 'regex', matched_text: poliMatch[0],
      });
    }
  }

  // 4. Width: "šířka NK 10.250 m" or "10,25 m" — use normalized text
  const widthMatch = normalized.match(/sirk[aay]\s*(?:nk\s*)?(?:(?:lev|prav)\S*\s*(?:i\s*\S+\s*)?mostu\s*(?:je\s*)?)?(?:konstantni\s*)?(\d+[.,]\d+)\s*m\b/);
  if (widthMatch) {
    const w = parseFloat(widthMatch[1].replace(',', '.'));
    results.push({
      name: 'nk_width_m', value: w, label_cs: `Šířka NK: ${w} m`,
      confidence: 1.0, source: 'regex', matched_text: widthMatch[0],
    });
  }

  // 5. Length: "délka NK činí 111.500 m" — use normalized text
  const lengthMatch = normalized.match(/delk[aay]\s*(?:nk\s*)?(?:(?:lev|prav)\S*\s*(?:i\s*\S+\s*)?mostu\s*)?(?:cini\s*)?(\d+[.,]\d+)\s*m\b/);
  if (lengthMatch) {
    const l = parseFloat(lengthMatch[1].replace(',', '.'));
    results.push({
      name: 'total_length_m', value: l, label_cs: `Délka NK: ${l} m`,
      confidence: 0.9, source: 'regex', matched_text: lengthMatch[0],
    });
  }

  // 6. Volume: "605 m³" or "605m3"
  const volMatch = text.match(/(\d+[.,]?\d*)\s*m[³3]/);
  if (volMatch) {
    results.push({
      name: 'volume_m3', value: parseFloat(volMatch[1].replace(',', '.')),
      label_cs: `Objem: ${volMatch[1]} m³`,
      confidence: 0.9, source: 'regex', matched_text: volMatch[0],
    });
  }

  // 7. Height: "výšk* X m"
  const heightMatch = text.match(/v[yý][šs]k[aáy]\s*(\d+[.,]?\d*)\s*m/i);
  if (heightMatch) {
    results.push({
      name: 'height_m', value: parseFloat(heightMatch[1].replace(',', '.')),
      label_cs: `Výška: ${heightMatch[1]} m`,
      confidence: 0.9, source: 'regex', matched_text: heightMatch[0],
    });
  }

  // 8. Diameter: "Ø900 mm" or "∅1200"
  const diaMatch = text.match(/[∅Ø]\s*(\d+)\s*(?:mm)?/);
  if (diaMatch) {
    results.push({
      name: 'pile_diameter_mm', value: parseInt(diaMatch[1]),
      label_cs: `Průměr piloty: Ø${diaMatch[1]} mm`,
      confidence: 1.0, source: 'regex', matched_text: diaMatch[0],
    });
  }

  // 9. Number of cables: "12 kabelů" or "12 soudržnými kabely"
  const cableMatch = text.match(/(\d+)\s*(?:soudržn\S*\s*)?kabel/i);
  if (cableMatch) {
    results.push({
      name: 'prestress_cables_count', value: parseInt(cableMatch[1]),
      label_cs: `Počet kabelů: ${cableMatch[1]}`,
      confidence: 1.0, source: 'regex', matched_text: cableMatch[0],
    });
  }

  // 10. Strands per cable: "13 lany" or "19 lan"
  const strandMatch = text.match(/(\d+)\s*lan[yůa]/i);
  if (strandMatch) {
    results.push({
      name: 'prestress_strands_per_cable', value: parseInt(strandMatch[1]),
      label_cs: `Lan per kabel: ${strandMatch[1]}`,
      confidence: 1.0, source: 'regex', matched_text: strandMatch[0],
    });
  }

  // 11. Thickness: "tl. 250 mm"
  const thickMatch = text.match(/tl\.?\s*(\d+)\s*mm/i);
  if (thickMatch) {
    results.push({
      name: 'thickness_mm', value: parseInt(thickMatch[1]),
      label_cs: `Tloušťka: ${thickMatch[1]} mm`,
      confidence: 1.0, source: 'regex', matched_text: thickMatch[0],
    });
  }

  // ─── Keyword-based detection ────────────────────────────────────────────

  // Prestressed — covers: předpjatý, předepne, předpětí, předpínací
  if (/predp[ei]t|predpjat|predepn|predpin/i.test(normalized)) {
    results.push({
      name: 'is_prestressed', value: true, label_cs: 'Předpjatý beton',
      confidence: 1.0, source: 'keyword', matched_text: 'předpjatý',
    });
  }

  // Stressing type
  if (/jednostrann/i.test(normalized)) {
    results.push({
      name: 'prestress_tensioning', value: 'one_sided', label_cs: 'Napínání: jednostranné',
      confidence: 1.0, source: 'keyword', matched_text: 'jednostranné',
    });
  } else if (/oboustrann/i.test(normalized)) {
    results.push({
      name: 'prestress_tensioning', value: 'both_sides', label_cs: 'Napínání: oboustranné',
      confidence: 1.0, source: 'keyword', matched_text: 'oboustranné',
    });
  }

  // Element type keywords
  if (/mostovk|nosna\s*konstrukc|nosnou\s*konstrukc/i.test(normalized)) {
    results.push({
      name: 'element_type', value: 'mostovkova_deska', label_cs: 'Typ: mostovková deska',
      confidence: 0.9, source: 'keyword', matched_text: 'mostovka/NK',
    });
  } else if (/pilot[aoy]|vrtana|vrtane/i.test(normalized)) {
    results.push({
      name: 'element_type', value: 'pilota', label_cs: 'Typ: pilota',
      confidence: 0.9, source: 'keyword', matched_text: 'pilota',
    });
  } else if (/rimsa|rimsy|rimsov/i.test(normalized)) {
    results.push({
      name: 'element_type', value: 'rimsa', label_cs: 'Typ: římsa',
      confidence: 0.9, source: 'keyword', matched_text: 'římsa',
    });
  }

  // Dvoutrám subtype
  if (/dvoutram|dvou\s*tram/i.test(normalized)) {
    results.push({
      name: 'bridge_deck_subtype', value: 'dvoutram', label_cs: 'Podtyp: dvoutrám',
      confidence: 1.0, source: 'keyword', matched_text: 'dvoutrám',
    });
  }

  // Sort by confidence desc
  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}
