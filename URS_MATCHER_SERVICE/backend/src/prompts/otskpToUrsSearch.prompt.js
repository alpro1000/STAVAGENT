/**
 * OTSKP → URS Search Prompt
 *
 * Converts OTSKP code to URS candidates via Perplexity web search.
 * Handles composite items (528xxx = all-inclusive, no sub-items needed).
 *
 * @module prompts/otskpToUrsSearch
 */

export const OTSKP_TO_URS_SYSTEM_PROMPT = `Jsi expert na mapování OTSKP položek na ÚRS katalog.

Dostáváš OTSKP položku a TSKP skupinu.
Najdi na podminky.urs.cz odpovídající položky ÚRS.

SPECIÁLNÍ PRAVIDLA:
- Pokud is_composite = true → NEVRACUJ žádné related_items pro komponenty
  (kompozitní OTSKP položka zahrnuje vše, komponenty nejsou potřeba)
- Kolejové lože (512xxx, 513xxx) → VŽDY SAMOSTATNÁ položka (není v ceně roštu)
- MJ musí odpovídat OTSKP: M→m, M3→m³, KUS→ks, M2→m²
- Hledej výhradně na podminky.urs.cz

Vrať JSON: { candidates: [...], is_composite: bool, note: string }`;


/**
 * Build a user prompt for OTSKP→URS conversion.
 *
 * @param {Object} otskpItem - { code, name, unit, price }
 * @param {Object|null} tskpSection - { code, name } or null
 * @param {boolean} isComposite
 * @returns {string}
 */
export function buildOtskpToUrsPrompt(otskpItem, tskpSection, isComposite) {
  return `
OTSKP položka:
- Kód: ${otskpItem.code || otskpItem.znacka || '?'}
- Název: ${otskpItem.name || otskpItem.nazev || '?'}
- MJ: ${otskpItem.unit || otskpItem.mj || '?'}
- Cena: ${otskpItem.price || otskpItem.cena || '?'} Kč/${otskpItem.unit || otskpItem.mj || '?'}
- TSKP sekce: ${tskpSection ? `${tskpSection.code} - ${tskpSection.name}` : 'neznámá'}

is_composite: ${isComposite}
${isComposite ? '⚠️ KOMPOZITNÍ POLOŽKA - nehledej sub-položky!' : ''}

Najdi odpovídající ÚRS kód na podminky.urs.cz.
Vrať pouze JSON.
  `.trim();
}

export default { OTSKP_TO_URS_SYSTEM_PROMPT, buildOtskpToUrsPrompt };
