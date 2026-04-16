/**
 * AI Advisor Prompt Builder
 *
 * Pure function — no Express dependency. Extracted for testability.
 * Builds structured Czech-language prompt for concrete_specialist multi-role AI.
 *
 * Uses conditional sections based on element type, prestress, bridge geometry,
 * TZ excerpt, computed results, and user question.
 */

/**
 * Build the full prompt for the multi-role AI approach recommendation.
 *
 * @param {object} ctx - Context from the enriched advisor payload
 * @returns {string} Complete prompt text
 */
export function buildApproachPrompt(ctx) {
  const sections = [];

  // ── System prompt ──
  sections.push(`Jsi expert rozpočtář pro český stavební průmysl.
Znáš TKP18, ČSN EN 206, ČSN EN 1992, ČSN EN 13670, VL4, DIN 18218.
Odpovídáš česky, strukturovaně, s odkazy na normy.`);

  // ── Position context ──
  const sparyText = ctx.has_dilatacni_spary
    ? `ano, rozteč ${ctx.spara_spacing_m || '?'} m → sekční betonáž`
    : 'ne → monolitická betonáž';

  sections.push(`KONTEXT POZICE:
Typ: ${ctx.elementLabel} (${ctx.element_type || 'neurčen'})
Objem: ${ctx.volume_m3 || '?'} m³ z betonu ${ctx.concrete_class || 'C30/37'}
Teplota: ${ctx.temperature_c || 15}°C
Dilatační spáry: ${sparyText}${
  ctx.exposure_class ? `\nExpozice: ${ctx.exposure_class} (dle ČSN EN 206)` : ''}${
  ctx.curing_class ? `\nTřída ošetřování: ${ctx.curing_class} (dle TKP18 §7.8.3)` : ''}`);

  // ── Bridge deck specifics ──
  if (ctx.element_type === 'mostovkova_deska' && (ctx.span_m || ctx.num_spans)) {
    let bridgeText = 'MOSTNÍ NK:';
    if (ctx.span_m) bridgeText += `\nRozpětí: ${ctx.span_m} m`;
    if (ctx.num_spans) bridgeText += ` × ${ctx.num_spans} polí`;
    if (ctx.nk_width_m) bridgeText += `\nŠířka NK: ${ctx.nk_width_m} m`;
    if (ctx.total_length_m) bridgeText += `\nDélka NK: ${ctx.total_length_m} m`;
    if (ctx.construction_technology) bridgeText += `\nTechnologie: ${ctx.construction_technology}`;
    sections.push(bridgeText);
  }

  // ── Prestress ──
  if (ctx.is_prestressed) {
    let prestressText = 'PŘEDPĚTÍ:';
    if (ctx.num_cables) prestressText += `\nKabely: ${ctx.num_cables}`;
    if (ctx.prestress_tensioning) prestressText += `, napínání ${ctx.prestress_tensioning === 'one_sided' ? 'jednostranné' : 'oboustranné'}`;
    prestressText += '\nSchedule: 7d min. wait (33 MPa) + napínání + injektáž kanálků';
    sections.push(prestressText);
  }

  // ── Pile specifics ──
  if (ctx.element_type === 'pilota') {
    sections.push(`PILOTA:
Vrtaná pilota — bez systémového bednění (pažnice + tremie pipe).
Zohledni: geologii, HPV, přebetonování +0.5m, technologickou přestávku 7 dní.`);
  }

  // ── Geometry ──
  const geomParts = [];
  if (ctx.height_m) geomParts.push(`Výška: ${ctx.height_m} m`);
  if (ctx.formwork_area_m2) geomParts.push(`Plocha bednění: ${ctx.formwork_area_m2} m²`);
  if (geomParts.length) sections.push('GEOMETRIE:\n' + geomParts.join('\n'));

  // ── Computed results (engine already calculated) ──
  if (ctx.computed_results && typeof ctx.computed_results === 'object') {
    const cr = ctx.computed_results;
    let computedText = 'JIŽ SPOČÍTÁNO ENGINE (nepřepisuj, doplň kontext):';
    if (cr.total_days) computedText += `\n- Celkem dní: ${cr.total_days}`;
    if (cr.curing_days) computedText += `\n- Zrání: ${cr.curing_days} dní`;
    if (cr.prestress_days) computedText += `\n- Předpětí: ${cr.prestress_days} dní`;
    if (cr.num_tacts) computedText += `\n- Záběry: ${cr.num_tacts}`;
    sections.push(computedText);
  }

  // ── TZ excerpt ──
  if (ctx.tz_excerpt && ctx.tz_excerpt.trim()) {
    sections.push(`KONTEXT Z TZ (technická zpráva):
"""
${ctx.tz_excerpt.trim().slice(0, 2000)}
"""
Cituj konkrétní pasáže z TZ kdykoli je to relevantní.`);
  }

  // ── Extracted params ──
  if (ctx.extracted_params && Array.isArray(ctx.extracted_params) && ctx.extracted_params.length > 0) {
    const paramsList = ctx.extracted_params.map(p => `- ${p.label_cs || p.name}: ${p.value}`).join('\n');
    sections.push(`AUTOMATICKY EXTRAHOVANÉ PARAMETRY Z TZ:\n${paramsList}`);
  }

  // ── User question ──
  if (ctx.user_question) {
    sections.push(`UŽIVATELOVA OTÁZKA:\n${ctx.user_question}`);
  }

  // ── Response structure ──
  sections.push(`ODPOVĚZ v tomto JSON formátu:
{
  "pour_mode": "sectional" nebo "monolithic",
  "sub_mode": "chess" nebo "linear" nebo "single_pour",
  "recommended_tacts": <počet záběrů>,
  "tact_volume_m3": <objem jednoho záběru>,
  "reasoning": "<2-3 věty proč tento postup>",
  "warnings": ["<seznam rizik/upozornění>"],
  "overtime_recommendation": "<doporučení k přesčasu>",
  "pump_type": "<stacionární | mobilní | autodomíchávač>",
  "key_points": ["<3-5 klíčových bodů specifických pro tuto pozici>"],
  "risks": ["<rizika harmonogramu/kvality>"],
  "norms_referenced": ["<ČSN EN / TKP odkazy>"]
}

PRAVIDLA:
- Spáry ANO → sectional; spáry NE → monolithic
- Římsy: VŽDY sekční po 25–30 m
- Monolitická = celý objem v 1 záběru (12-16h, příplatek 25% od 10h)
- Chess pattern: min. 24h tvrdnutí mezi sousedy
- Nepřepisuj computed_results — doplň kontext, rizika, normy
- Pokud tz_excerpt obsahuje konkrétní čísla, cituj je

ODPOVĚZ POUZE VALIDNÍM JSON.`);

  return sections.join('\n\n');
}
