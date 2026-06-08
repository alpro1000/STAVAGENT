# RECON — co bylo v repu PŘED dizajnem (AC9)

> Read-only mapa, na které sandbox staví. Žádná production komponenta nezměněna (AC10).

## Monolitní work-dekompozice (existující větev)
- `concrete-agent/.../app/mcp/tools/breakdown.py` — `create_work_breakdown(elements, project_type, catalog, mode)`. Už nese **Pattern 15** kontrakt: `MODE_WORK_FIRST` (codeless, frozen work list) vs `MODE_WORK_WITH_CATALOG` (legacy). Work-atomy = **hardcoded `WORK_TEMPLATES`**, klíč = `element_type`. Jen monolit: `Bednění / Odbednění / Výztuž / Beton / Ošetřování` (+ pilota/mostovka/rimsa varianty). Každý item nese `_source` (Pattern 29 grounding gate), `hsv_section`; `qty ≤ 0` se zahodí.
- **Mezera:** žádná ne-betonná větev. Interiér/PSV scope nemá kam jít → buď `jine`, nebo (po klasifikaci) monolitní DEFAULT šablona na cokoliv = „sebevědomě-špatně".

## Klasifikátor
- `app/mcp/tools/classifier.py` + `Monolit-Planner/.../element-classifier.ts`, single-source `element_rules/element_types.yaml` → TS přes `gen-knowledge.mjs` (drift-guarded). 24 betonových typů, 3 kontexty `bridge|retaining_wall|building`. Reject path **jen materiálový** (`masonry_cladding`, `shotcrete`, …). **Žádný scope/discipline router** pro interiér/PSV/elektro/ZTI.

## Catalog-binding (find_urs / find_otskp)
- `find_urs_code` (`urs.py`) → Perplexity web + URS Matcher Service. Vrací `code|N/A`, `description`, `unit`, `confidence` (0.5–0.97) — **BEZ jednotkové ceny** (ÚRS licencováno). `find_otskp_code` → DB hit `confidence=1.0` nebo prázdno.
- **Mezera:** žádný unifikovaný status-enum `exact|candidate|group_only|not_verified` (jen neformální `match: exact|partial|none` v `position_enricher.py`). Procurement routing (privátní→ÚRS / veřejná→OTSKP) existuje jako DATA v `kb/urs_otskp_routing.yaml`, ale tools ho nepoužívají.

## KB (kam patří šablony jiných sekcí)
- `app/knowledge_base/B5_tech_cards/technological_postupy/` — stub `zemni_prace_bourani/`. Přirozený dům pro budoucí interiér/PSV šablony. `B10_coverage_matrices` už má D.1.4 matrice (`mep_d14_*`).

## Korpus / golden fixtures
- `test-data/{project}/` = corpus area; golden reference markdowny v `test-data/tz/`; runnable golden harnesy = vitest v `Monolit-Planner/shared/src/calculators/*.test.ts`.
- **Pozn. k umístění tohoto sandboxu:** `test-data/**` je v tomto prostředí pod **read-deny** (ochrana kontextu) — Bash i Read na té cestě selžou, takže runnable harnes (volba uživatele) by tam nešel spustit. Proto je samostatný, offline, zero-dep sandbox umístěn v `sandbox/uwo-interier-mezonet/` (běží `node --test`), ne pod `test-data/`. Je to **groundwork + golden fixture** pro budoucí UWO (viz `docs/specs/universal-work-decomposer/`), ne production ontologie. Production dekompozice ani catalog-search se nemění.

## Reálný proba katalogu (jednorázová, zmražená)
- Provedeno přes živý STAVAGENT MCP `find_urs_code` (privátní → ÚRS), 12 dotazů, výsledek v `data/catalog-findings.json`.
- **Hypotéza „111 vs 784" se NEpotvrdila** — matcher vrátil pro „odstranění nátěrů" správnou rodinu **783** (0.92). Místo toho zmraženy REÁLNĚ pozorované false-plausible případy: kotel `580507201` = „Podmínky použití" (metadata row, ne montáž), štuk `613321141` = „pilířů/sloupů" (ne stěny), perlinka `612181011` = „Příplatek" (ne základní položka). Stejný sanity-princip, honest data.
