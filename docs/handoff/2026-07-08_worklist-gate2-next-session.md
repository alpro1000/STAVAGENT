# Handoff 2026-07-08 → next session: tz-passport Gate 2 («seznam prací» magistrála)

## Start
1. Effort high/max, adaptive thinking off. Přečti steering + soul §9 (nahoře) + tento soubor + BACKLOG `tz-to-worklist`.
2. `git fetch origin main && git checkout -B claude/<téma>-<5znaků> origin/main`. Merge-commit, worktree-verify po každém merge.

## Kontext (worklist-audit 2026-07-08, plný rozbor v chat logu)
Čtyři nespojené implementace «seznamu prací»:
- **Portal Analýza dokumentace**: `DocumentAnalysisPage` → CORE `/passport/generate`; `SoupisTab` (viewer, kapitoly/tabulky/SO výběr) HOTOVÝ — aktivuje se jen když odpověď nese `soupis_praci`. CORE ho nevrací: `planPassport()` mapper (tz-passport half A, PR #1426) NEPŘIPOJEN jako route/MCP.
- **URS okna**: `frontend/components/DocumentUpload.html` mounted (app.js) → `/api/core/parse/document` + `/urs-match/match-batch` — ověřit upstream po Sprint A (401/mrtvé?); `ContextEditor.html` = sirota bez loaderu → smazat dle working-only policy (#1432).
- **URS `/api/v1/work-packages`** (co-occurrence z VZ, SQLite) — bezhlavý engine, žádný UI konzument → surovina pro UWO F2/F3, nestavět mu UI.
- **MCP `create_work_breakdown`** — bez UI.

## Úkol P1: Gate 2 — připojit planPassport (~1 session, největší viditelný efekt)
Per BACKLOG `tz-to-worklist` krok 1:
1. MCP tool `calculate_from_passport` — POZOR na counter-soubory (CLAUDE.md §MCP authoring: `_REGISTERED_TOOL_NAMES` / `TOOL_ORDER`+`TOOL_DESCRIPTIONS` / `TOOL_COSTS` / `ToolManifest` / YAML allow-list / `EXPECTED_TOOLS` v test_mcp_compatibility).
2. REST route + zapojení do `/passport/generate` odpovědi (`soupis_praci`) → SoupisTab se rozsvítí BEZ frontend práce.
3. Golden: `docs/specs/tz-passport-json/example_SO202_zalmanov.json` → plán 1 callem.
4. Vedlejší úklid: smazat ContextEditor.html; live-check DocumentUpload upstream → fix nebo strip.

## Nedokončené LIVE-checky z 2026-07-08 (rychle na začátku)
- Kalkulátor↔TOV bridge (#1445): Turnov základy → Aplikovat → Registry TOV banner Předvyplnit/Aktualizovat.
- Poptávka cen (#1444): skupiny per projekt + Vybrat vše + jméno souboru.
- Cross-device originál (#1437/38/40/41): «Vrátit do původního (vše)» z druhého prohlížeče.
- Alexandrova manual action: **upgrade `stavagent-db`** (Underprovisioned, max_connections=25 — příčina výpadku; kód-guard shipnut v #1442).
