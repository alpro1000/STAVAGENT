# budget-parser-routing — Report

> **Bug ID:** `budget-parser-routing`
> **Datum reportu:** 2026-07-11
> **Reporter:** Claude Code session (nalezeno half-B Gate 0 auditem extraction infry)
> **Severity:** P1 (celá třída soupisů nefunkční přes MCP; v kritické cestě half-B stage 3)
> **Status:** **closed-pending-verify** (fix v half-B Gate 2 PR)
>
> **Affected:** MCP tool `parse_construction_budget` (`app/mcp/tools/budget.py`)
> **Version:** od zavedení dedikovaného routingu (pre-v4.30)

---

## 1. What's broken

`budget.py` importuje NEEXISTUJÍCÍ funkce dedikovaných parserů: `parse_komplet` /
`parse_rts_rozpocet` (reálná jména `parse_xlsx_komplet` / `parse_xlsx_rtsrozp`)
→ ImportError; fallback pak volá NEEXISTUJÍCÍ `UniversalParser().parse_file`
(reálné API: `parse_any`) → soupisy s «komplet»/«rts»/«aspe»/«sz» v názvu
končí chybou «No suitable parser found».

## 2. Expected behavior

Komplet/RTS-pojmenovaný soupis se parsuje dedikovaným parserem; při jeho pádu
degraduje na univerzální parser (fallback-chain pattern).

## 3. Actual behavior

ImportError → rozbitý fallback → typed error. Golden `E_Soupis…MOSTY_PHS.xlsx`
fungoval NÁHODOU — matchne keyword «soupis» → generic ExcelParser cesta.

## 4. Reproduction steps

1. `parse_construction_budget(file_base64=<xlsx>, filename="rozpocet_KOMPLET.xlsx")`
2. **Pozoruji (pre-fix):** `{"error": "No suitable parser found: …"}` — nikdy
   se nedostane k reálnému parseru.

## 5-6. Scope & impact

- Každý MCP/REST caller s EstiCon/KOMPLET/RTS/ASPE-pojmenovaným souborem.
- half-B stage 3 (soupis join) na tomto toolu stojí → blocker třídy P1 pro half-B.
- Dedikované parsery navíc vracejí `ParsedDocument` (nested), ne items-dict —
  i po opravě jmen by `result.get("positions")` selhal → nutný flattener.

## 7. Evidence

- Gate 0 audit `docs/specs/tz-passport-json/halfB-gate0-audit.md` §3.
- Kód: `budget.py:120/126/142-144` (pre-fix); reálná API
  `xlsx_komplet_parser.py:36`, `xlsx_rtsrozp_parser.py:42`, `universal_parser.py:31`.
