# tz-passport-json — requirements (DRAFT, pre-interview)

**Status:** draft seed — čeká na PRE-IMPLEMENTATION INTERVIEW s Alexandrem
**Vznik:** 2026-07-07, z živého MCP E2E testu SO 202 Žalmanov (výkres 202/17
Tvar NK + soupis E_Soupis_skupiny_MOSTY_PHS.xlsx). Alexander ručně sestavil
passport-JSON z TZ — uložen jako kanonický příklad
`example_SO202_zalmanov.json` (s `_meta` blokem: provenance + 2 nalezené
konflikty TZ↔soupis).

## Problém

Kalkulátor umí správně počítat, jen když dostane správné vstupy. Dnes je
extrakce z dokumentace roztříštěná: `extract_tz_fields` (stage 1 text, bez
výměr), frontend `tz-text-extractor` (regex nad vloženým textem),
`tz_facts` (technologie + počet taktů), UEP (výkresy). E2E test ukázal, co se
ztrácí: přesné třídy betonu per prvek («C30/37-XF4+XD3+XC4» — plný expoziční
řetězec), počet taktů z poznámky NA VÝKRESE, tonáže výztuže ze soupisu,
geometrie (pole, šířky, výšky pilířů).

## Cíl

Jeden strukturovaný **passport objektu (JSON)** extrahovaný z dokumentace
(TZ + výkresy + soupis), který kalkulátor konzumuje deterministicky — bez
ručního přepisování parametrů.

## EARS-style acceptance (návrh k ratifikaci)

1. WHEN uživatel předá passport-JSON validní proti schématu, THE SYSTEM SHALL
   vyrobit `PlannerInput[]` pro všechny betonové prvky (NK, opěry, pilíře,
   základy, přechodové desky, římsy, podkladní beton) bez dalších dotazů.
2. WHEN passport nese `construction_process.deck_pour_stages`, THE SYSTEM
   SHALL počítat NK s tímto počtem taktů (num_tacts_override) A ZÁROVEŇ nést
   zdroj citace (tz_facts) pro validační pravidlo.
3. WHEN pole v passportu chybí, THE SYSTEM SHALL postupovat honest-blank
   (Pattern 26) — NIKDY nefabrikovat; prvek bez objemu = NEPOČÍTÁNO.
4. WHEN se passport a soupis rozcházejí (třída betonu, množství), THE SYSTEM
   SHALL zobrazit oba údaje s provenancí (Pattern 29/53) — konflikt je VIDITELNÝ
   FLAG, ne tichá volba.
5. Extrakční strana (TZ→JSON): každé pole nese `_source` anchor (sekce+strana
   / výkres+poznámka / soupis pozice). Fabrikace = defekt.

## Rozsah — dvě poloviny (stavět v tomto pořadí)

- **A. Konzumace (malá, deterministická):** mapper passport → `PlannerInput[]`
  ve shared engine. Testovatelné hned proti `example_SO202_zalmanov.json` +
  goldenům z E2E (3 takty × 449,7 m³; opěry TRIO; pilíře 3 záběry DIN 18218).
- **B. Extrakce (velká, fázovaná):** stage 1 TZ text (rozšířit
  `extract_tz_fields`), stage 2 výkresy (vision — poznámky typu «V 3 TAKTECH
  NA SKRUŽI» jsou NA VÝKRESE, ne v TZ!), stage 3 join množství ze soupisu.

## Otevřené otázky na interview (NEROZHODOVAT bez Alexandra)

1. Governance schématu — kdo vlastní shape? Verzování (`schema_version`)?
2. Kde běží extrakce: CORE UEP pipeline / nový MCP tool / offline skript?
3. LLM vs regex split per sekce (deterministika první — mantra)?
4. Jak přesně UI zobrazuje konflikt TZ↔soupis (E2E našel 2: pier + deck
   C35/45 vs OTSKP DO-band C40/50)?
5. Je passport per-SO nebo per-stavba? (Žalmanov: 1 soupis, ~120 SO listů.)
