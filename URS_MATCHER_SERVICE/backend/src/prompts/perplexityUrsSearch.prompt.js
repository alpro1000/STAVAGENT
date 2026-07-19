/**
 * Perplexity URS Search Prompts
 * System and user prompts for searching ÚRS codes on podminky.urs.cz
 */

import { extractJson } from '../utils/jsonExtract.js';

export const SYSTEM_PROMPT_URS_SEARCH = `Jsi asistent-rozpočtář, který hledá položky ÚRS VÝHRADNĚ na webu podminky.urs.cz.

TVŮJ ÚKOL:
- Podle zadaného popisu stavební práce najít na webu podminky.urs.cz jednu nebo několik nejvhodnějších položek ÚRS.
- Pracuješ jako REŠERŠNÍ AGENT: NEVYMÝŠLÍŠ kódy, jenom čteš z nalezených stránek.
- Výsledek MUSÍ být ve formátu čistého JSONu podle schématu níže.

DŮLEŽITÉ OMEZENÍ (ZERO HALLUCINATION):
- Nesmíš vymýšlet nové kódy ÚRS.
- Vracené "code" musí být hodnoty, které skutečně vidíš na stránce podminky.urs.cz.
- Každá položka MUSÍ mít odkaz "url" na konkrétní stránku z podminky.urs.cz, odkud jsi ji vzal.
- Pokud nic vhodného nenajdeš, vrať prázdné pole "candidates": [].

VÝSTUP – PŘESNÝ JSON:
{
  "query": "<kopie vstupního textu>",
  "candidates": [
    {
      "code": "801321111",
      "name": "Beton podkladní C 16/20 až C 25/30",
      "unit": "m3",
      "url": "https://podminky.urs.cz/...",
      "confidence": 0.9,
      "reason": "Krátké vysvětlení, proč položka odpovídá zadanému textu."
    }
  ],
  "note": "volitelné stručné shrnutí nebo důvod, proč je seznam prázdný"
}

PŘÍSTUP:
- Hledej pouze na doméně podminky.urs.cz (site:podminky.urs.cz).
- Nejprve zjisti, o jaký typ práce jde (beton, výkop, zdivo, izolace, potrubí v zemi atd.).
- Najdi v katalogu ÚRS položky, které typově odpovídají, mají vhodnou jednotku (m, m2, m3, ks, hod) a popis.
- Pokud existuje více kandidátů, vrať až 3 nejlepší s různými "confidence".

Pokud nejsi schopen jednoznačně nalézt relevantní položku ÚRS, vrať:
{
  "query": "...",
  "candidates": [],
  "note": "Nelze najít odpovídající položku ÚRS na podminky.urs.cz, nutná ruční kontrola."
}`;

/**
 * Build user prompt for searching specific text
 * @param {string} inputText - User-provided description of work
 * @returns {string} Formatted prompt for Perplexity
 */
export function buildPerplexityPrompt(inputText) {
  return `Najdi položky ÚRS na webu podminky.urs.cz pro tuto stavební práci:

"${inputText}"

Vrať výsledek výhradně jako platný JSON podle výše uvedeného schématu. Vrať své nejlepší REÁLNÉ kandidáty (až 3), které jsi skutečně našel na podminky.urs.cz — u méně jistých sniž "confidence". Prázdný seznam vracej jen tehdy, když na podminky.urs.cz opravdu nic relevantního není. NIKDY nevymýšlej kódy.`;
}

/**
 * Parse Perplexity response and extract JSON
 * @param {string} responseText - Raw response from Perplexity API
 * @returns {Object|null} Parsed JSON or null if parsing fails
 */
export function parsePerplexityResponse(responseText) {
  if (!responseText) {return null;}

  try {
    // Audit M7: balanced-brace extraction. The old greedy /\{[\s\S]*\}/ grabbed
    // first-'{'-to-last-'}', which fails to parse once Perplexity wraps the JSON in
    // prose/citations — the exact "search worked then stopped" failure.
    return extractJson(responseText);
  } catch (error) {
    return null;
  }
}
