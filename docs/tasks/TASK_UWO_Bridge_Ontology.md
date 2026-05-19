# TASK 1 — Universal Work Ontology + Catalog Bindings (UWO Bridge)

_Part of STAVAGENT architecture roadmap. See `docs/STAVAGENT_Architecture_Notes.md` for full context._
_This task is foundation. TASKs 2-4 (Hybrid Search, Validation, MCP Security) build on it._

## Мантра

Прочитай весь репо сначала. Найди существующие конвенции для:
- knowledge_base модулей (B1-B9 dirs если есть)
- catalog/database access layer
- matching/scoring services
- per-project script structure
- pydantic v4 models (already в проекте)

Naming, file paths, dataclass conventions — выводи из существующего кода. **Не создавай параллельную структуру.** Если уже есть `app/knowledge_base/` — встраивайся туда. Если есть `app/services/` для алгоритмов — туда. Если convention naming snake_case — используй snake_case. Если у каталогов уже есть pattern (например `app/api/{catalog}_connector.py`) — следуй ему.

## PRE-IMPLEMENTATION INTERVIEW

Используй `AskUserQuestion` перед началом кода:

1. **Где живёт knowledge base** — `app/knowledge_base/` или другой path в текущем репо?
2. **Naming convention для UWO codes** — DOT-notation (EARTHWORK.EXCAVATION.PIT) или SNAKE (earthwork_excavation_pit)? Если уже есть convention в коде — follow it.
3. **Catalog backend** — Cloud SQL PostgreSQL или local SQLite? Сейчас kros_catalog.db = SQLite на диске разработчика. Production system должна работать с **обоими**: dev=SQLite, prod=PostgreSQL. Используй абстракцию (SQLAlchemy / asyncpg adapter).
4. **MJ normalization** — есть ли уже MJ canonical layer в репо? (m²/m2/sqm — это одно и то же.) Если нет — создать как часть этой работы.
5. **Confidence scoring policy** — соответствует ли уже существующей? Из конституции STAVAGENT: regex=1.0, gemini=0.7, perplexity=0.85, human=0.99. Этот алгоритм должен лечь куда?

## КОНТЕКСТ

### Current state of catalog data

`data/kros_extract/kros_catalog.db` = 9,173 unique URS položek extracted from 8 UNIXML exports of KROS application. Real production data from BERGER Bohemia licence. Schema established by `scripts/parse_kros_unixml_merge.py`. Contains:

- `kros_items` table: kod_polozky, popis, popis_normalized, mj, normohodiny, vintage (CS ÚRS 2018/2026), source_file
- `kros_fts` virtual table: FTS5 index over popis
- `kros_instances` table: per-zakázka instances with mnozstvi, ceny

Coverage validated (`scripts/diagnose_hk212.py` output):
- ✓ Hloubení/výkop (841), Beton (1490), Výztuž (260), Pilota (213), Ocel HEB/IPE (110)
- ✓ Izolace (1177), Plech (323), Krov (189), Trubky (236)
- ✗ Rozvaděč (0), FVE/fotovolt (0) — known gaps, flag as catalog_gap

### Empirically validated problem

Existing matcher `scripts/rematch_kros_catalog_v2_1.py` uses token-based Dice scoring. Provably fails on real data:

Test case `HK212-HSV-1-002` ("dohloubky patek rámových", m³, 31.5):
- Catalog has 841 items containing "Hloub" prefix
- Matcher tokens used: `dohloubky`, `ramovych`, `patek`
- Top candidate returned: `766681114 — Montáž zárubní rámových, pro dveře` (door frames!)
- Correct candidate `132xxx — Hloubení jam` ranked low because:
  - Token `ramovych` dominates → matches "rámové dveře"
  - Token `dohloubky` rarely appears in catalog (caталог использует `Hloubení`)
  - Token `patek` appears in bednění/výztuž/hloubení — no discrimination

Result: token-based matcher achieves 1 of 54 needs_review matches even with 9K items database. **Architecture problem, not data scarcity.**

### Solution: UWO triple as bridge

Each work item = `(action, object, material/context)` triple. LLM (or rule-based extractor) maps natural language popis → UWO triple. Deterministic catalog binding maps UWO → catalog prefix(es). Hybrid search within narrowed pool (this task: FTS5+Dice; TASK 2 adds vector+reranker).

For "dohloubky patek rámových":
- action: `EARTHWORK.EXCAVATION`
- object: `FOOTING_PIT`
- mj: m³
- UWO category: `EARTHWORK.EXCAVATION.PIT`
- ÚRS_CZ binding: chapter prefix `132`
- Narrowed pool: 841 → ~20 items starting with 132
- Scored within pool → correct match returned with high confidence

### Why TASK 2-4 separate

This task delivers foundation. Subsequent tasks add capabilities incrementally:
- TASK 2: pgvector embeddings + cross-encoder reranker (replaces FTS5+Dice scoring inside pool)
- TASK 3: validation rules engine + confidence flow refinement
- TASK 4: MCP server with policy engine + audit logs (see `docs/TASK_MCP_Security.md`)

Architecture details for each: see `docs/STAVAGENT_Architecture_Notes.md`.

## БИЗНЕС-ЛОГИКА

### Scenario 1 — Rematch existing project items

User has `items.json` with project popis (e.g., "dohloubky patek rámových"). Runs rematch.

System should:
1. For each item, extract UWO triple from popis + MJ + raw_description via rule-based detector (synonyms dictionary).
2. Get catalog binding: UWO → prefix(es) in selected catalog.
3. Narrow candidate pool to 5-50 items (vs 9000+).
4. Score within pool: Dice on detail tokens (after stripping UWO keywords) + MJ match bonus.
5. Write to item: both popis (project's и canonical from catalog) + UWO triple + catalog code + confidence + match method.

Status outcomes:
- UWO not detected → `needs_manual_categorization` + UWO suggestions
- UWO detected but binding has no candidates in this catalog → `catalog_gap` + UWO retained
- UWO detected + candidates exist + score ≥ thresholds → `matched_high` / `matched_medium`
- UWO detected + candidates exist + score < threshold → `needs_review` with top-10 alternatives

### Scenario 2 — Extract UWO triples from TZ (future, NOT this task)

LLM на phase parse получает structured prompt: "Извлеки работы как UWO triples. Доступные UWO categories: [...]". LLM **не видит каталог** — только UWO controlled vocab. Результат — items.json с UWO populated, urs_code пустой. После — Scenario 1 для каталогизации.

Out of current scope. This task only handles matching, not LLM extraction.

### Scenario 3 — Multi-catalog (future TASK 2-3)

Same items.json, different catalog parameter:
- `--catalog urs_cz` → ÚRS Czech codes
- `--catalog otskp_cz` → OTSKP Czech codes (when binding ready)
- `--catalog stlb_bau_de` → German codes (when binding ready)

This task: implement urs_cz binding fully, skeletons for others.

## DOMAIN RULES

### UWO hierarchy — 3 levels

`DIVISION.SUBSYSTEM.WORK_TYPE`

50+ categories that **must** be covered in first version:

**EARTHWORK** (zemní práce, HSV 1.x):
- `EARTHWORK.PREPARATION.CLEARING` (kácení dřevin)
- `EARTHWORK.PREPARATION.STRIPPING` (sejmutí ornice)
- `EARTHWORK.PREPARATION.DEMOLITION` (bourání stávajících objektů)
- `EARTHWORK.EXCAVATION.PIT` (hloubení jam — для отдельных fundamentů)
- `EARTHWORK.EXCAVATION.TRENCH` (rýhy — линейные, для sítí)
- `EARTHWORK.EXCAVATION.SHAFT` (šachty)
- `EARTHWORK.EXCAVATION.SURFACE` (odkopávky rovných ploch)
- `EARTHWORK.EXCAVATION.PILE_HOLE` (vrty pro piloty)
- `EARTHWORK.DISPOSAL.LANDFILL` (skládkovné, vývoz)
- `EARTHWORK.DISPOSAL.REUSE` (znovuvyužití zeminy)
- `EARTHWORK.COMPACTION.SUBGRADE` (zhutnění lože)
- `EARTHWORK.COMPACTION.BACKFILL` (zásyp)
- `EARTHWORK.STABILIZATION` (geotextilie, geomřížky)

**FOUNDATION** (základy, HSV 2.x):
- `FOUNDATION.CONCRETE.FOOTING` (patky)
- `FOUNDATION.CONCRETE.STRIP` (pásy)
- `FOUNDATION.CONCRETE.RAFT` (deska)
- `FOUNDATION.CONCRETE.PIER` (pilíře)
- `FOUNDATION.PILE.BORED` (vrtané piloty)
- `FOUNDATION.PILE.DRIVEN` (beraněné)
- `FOUNDATION.PILE.MICROPILE`
- `FOUNDATION.PILE.CAP` (hlavice)
- `FOUNDATION.LEAN_CONCRETE` (podkladní beton)
- `FOUNDATION.WATERPROOFING` (izolace základů)

**REINFORCEMENT** (výztuž):
- `REINFORCEMENT.REBAR_BAR` (válcovaná, R25, B500B)
- `REINFORCEMENT.REBAR_MESH` (KARI sítě)
- `REINFORCEMENT.PRESTRESS` (předpínací)
- `REINFORCEMENT.ANCHOR_REBAR` (kotevní)
- `REINFORCEMENT.FORMWORK` (бednění — все типы)

**VERTICAL_STRUCTURE** (svislé konstrukce, HSV 3.x):
- `VERTICAL_STRUCTURE.MASONRY.BRICK`
- `VERTICAL_STRUCTURE.MASONRY.AAC`
- `VERTICAL_STRUCTURE.CONCRETE_WALL`
- `VERTICAL_STRUCTURE.PARTITION`

**HORIZONTAL_STRUCTURE** (vodorovné, HSV 4.x):
- `HORIZONTAL_STRUCTURE.SLAB_RC`
- `HORIZONTAL_STRUCTURE.SLAB_PRECAST`
- `HORIZONTAL_STRUCTURE.BEAM_RC`

**STEEL_STRUCTURE**:
- `STEEL_STRUCTURE.BEAM` (IPE/HEB/UPE)
- `STEEL_STRUCTURE.COLUMN`
- `STEEL_STRUCTURE.BRACING` (ztužidla, krov)
- `STEEL_STRUCTURE.ANGLE` (L 70/70)
- `STEEL_STRUCTURE.ROD` (Ø20)
- `STEEL_STRUCTURE.ANCHORING` (M20, šrouby)
- `STEEL_STRUCTURE.COATING` (antikor, žárový zinek)
- `STEEL_STRUCTURE.FIREPROOFING`

**DEMOLITION** (bourání, HSV 9.x):
- `DEMOLITION.BUILDING`
- `DEMOLITION.PARTIAL`
- `DEMOLITION.SURFACE`

**ROOFING** (PSV 71x):
- `ROOFING.WATERPROOFING`
- `ROOFING.INSULATION`
- `ROOFING.MEMBRANE`
- `ROOFING.TILES`
- `ROOFING.FLASHING.ATTIC`
- `ROOFING.FLASHING.VALLEY`
- `ROOFING.FLASHING.RIDGE`
- `ROOFING.DRAINAGE`

**WATERPROOFING**:
- `WATERPROOFING.FOUNDATION`
- `WATERPROOFING.RADON`
- `WATERPROOFING.WET_ROOMS`
- `WATERPROOFING.LIPS`
- `WATERPROOFING.PROTECTION` (nopová folie)

**FACADE**:
- `FACADE.INSULATION_ETICS`
- `FACADE.INSULATION_VENTILATED`
- `FACADE.RENDER`
- `FACADE.PAINT`

**INTERIOR_FINISHING**:
- `INTERIOR_FINISHING.RENDER`
- `INTERIOR_FINISHING.PAINT`
- `INTERIOR_FINISHING.PLASTERBOARD`
- `INTERIOR_FINISHING.FLOORING.SCREED`
- `INTERIOR_FINISHING.FLOORING.CERAMIC`
- `INTERIOR_FINISHING.FLOORING.VINYL`
- `INTERIOR_FINISHING.FLOORING.EPOXY`
- `INTERIOR_FINISHING.FLOORING.ANTI_SLIP`
- `INTERIOR_FINISHING.WALL_TILE`

**DOORS_WINDOWS**:
- `DOORS_WINDOWS.WINDOW_PVC`
- `DOORS_WINDOWS.WINDOW_AL`
- `DOORS_WINDOWS.DOOR_INTERIOR`
- `DOORS_WINDOWS.DOOR_EXTERIOR`
- `DOORS_WINDOWS.GATE_SECTIONAL`
- `DOORS_WINDOWS.GATE_OPERATOR`
- `DOORS_WINDOWS.HARDWARE`

**KLEMPIRINA**:
- `KLEMPIRINA.FLASHING_PLAIN`
- `KLEMPIRINA.FLASHING_TITANZINC`
- `KLEMPIRINA.WINDOW_LIP`

**PLUMBING** (PSV 72x):
- `PLUMBING.PIPING_WATER`
- `PLUMBING.PIPING_SEWAGE`
- `PLUMBING.FIXTURES`
- `PLUMBING.FIRE_SUPPLY`

**HEATING** (PSV 73x):
- `HEATING.RADIATORS`
- `HEATING.PIPING_HOT`
- `HEATING.BOILER`

**HVAC** (PSV 75x — VZT):
- `HVAC.AIR_HANDLING_UNIT`
- `HVAC.HEAT_RECOVERY`
- `HVAC.DUCTING`
- `HVAC.DIFFUSER`
- `HVAC.AIR_CURTAIN`
- `HVAC.ANTIVIBRATION`
- `HVAC.CONTROL_BMS`

**ELECTRICAL** (PSV 74x):
- `ELECTRICAL.DISTRIBUTION_BOARD`
- `ELECTRICAL.CABLE_LV`
- `ELECTRICAL.CABLE_DATA`
- `ELECTRICAL.LIGHTING.FIXTURE`
- `ELECTRICAL.LIGHTING.EMERGENCY`
- `ELECTRICAL.PV.PANEL`
- `ELECTRICAL.PV.INVERTER`
- `ELECTRICAL.PV.MOUNTING`
- `ELECTRICAL.PV.BATTERY`
- `ELECTRICAL.GROUNDING`

**WEAK_CURRENT**:
- `WEAK_CURRENT.FIRE_DETECTION`
- `WEAK_CURRENT.SECURITY`
- `WEAK_CURRENT.CCTV`
- `WEAK_CURRENT.ACCESS_CONTROL`

**VRN** (vedlejší rozpočtové náklady):
- `VRN.SITE.TEMPORARY_FACILITIES`
- `VRN.SITE.TEMPORARY_TOILET`
- `VRN.SITE.POWER_SUPPLY`
- `VRN.SITE.WATER_SUPPLY`
- `VRN.SITE.FENCING`
- `VRN.HSE.COORDINATION`
- `VRN.HSE.TRAINING`
- `VRN.UTILITY.LOCATING`
- `VRN.UTILITY.STATEMENTS`
- `VRN.HANDOVER.DSPS`
- `VRN.HANDOVER.APPROVAL`
- `VRN.WASTE.DISPOSAL`

### Per-category data structure

Каждая категория содержит:
- canonical UWO code
- typical_mj (m3/m2/bm/kg/t/ks/kpl/hod/měsíc/paušál)
- czech_action_synonyms (verbs and verbal nouns)
- czech_object_synonyms (object nouns)
- czech_context_keywords (helpful disambiguators)
- czech_excludes (words that suggest different category)
- english_synonyms (для multilingual)
- german_synonyms (skeleton — to be extended in hackathons)
- spanish_synonyms (skeleton)
- short_description (canonical cs/en)

### Catalog bindings ÚRS_CZ — validation methodology

Каждая UWO category → URS chapter prefix(es). **Не выдумывать.** Для каждой category выполнить SQL:

```sql
SELECT COUNT(*) as n,
       GROUP_CONCAT(DISTINCT SUBSTR(kod_polozky,1,4)) as prefixes
FROM kros_items
WHERE popis LIKE '%${action_keyword}%'
   OR popis LIKE '%${object_keyword}%';
```

Если `n > 0` — extract distinct prefixes, выбрать наиболее повторяющиеся, validate они соответствуют ожидаемой URS chapter. Если `n == 0` для всех keywords — категория = catalog_gap.

Expected results (некоторые, для верификации):
- `EARTHWORK.EXCAVATION.PIT` → ["132"], n ≈ 841
- `EARTHWORK.EXCAVATION.TRENCH` → ["131"], n in tens-hundreds
- `EARTHWORK.DISPOSAL.LANDFILL` → ["171"], n ≈ 18
- `FOUNDATION.CONCRETE.FOOTING` → ["27101", "27102", "27103"]
- `REINFORCEMENT.REBAR_MESH` → ["272362", "273362", "274362"]
- `STEEL_STRUCTURE.BEAM` → ["767", "996"], n ≈ 110
- `STEEL_STRUCTURE.COATING` → ["783"]
- `ELECTRICAL.PV.*` → expected n = 0 (catalog_gap)
- `ELECTRICAL.DISTRIBUTION_BOARD` → expected n = 0 (catalog_gap)

### Skeleton bindings для других catalogs

Для OTSKP_CZ, STLB_Bau_DE, BKI_DE, Batiprix_FR, Codigo_Estructural_ES — пустые modules с TODO comments. Hackathons затем эти модули раскроют.

### Algorithm match flow

Given: item dict `{popis, mj, raw_description (optional), mnozstvi (optional)}`.

1. **Normalize**: lowercase + NFKD strip diacritics.
2. **Categorize**: пройди по UWO categories, найди те которые match по action_synonyms ИЛИ object_synonyms ИЛИ context_keywords. Может вернуть multiple (ambiguous). MJ — soft signal: bonus если совпадает с typical_mj, без penalty если нет.
3. **Exclude**: если popis содержит exclude keywords категории (например "bednění" исключает EARTHWORK.EXCAVATION) — снять эту category.
4. **Get candidates**: для каждой remaining category — fetch candidates from catalog где kod_polozky LIKE prefix% (использовать FTS5 если есть, иначе LIKE).
5. **Score**: внутри candidates — Dice coefficient на detail tokens (после strip UWO keywords) + bonus за совпадение MJ.
6. **Confidence assignment** (simplified for TASK 1; TASK 3 has full validation):
   - score ≥ 0.6 AND single category → confidence 0.85 → matched_high
   - score ≥ 0.4 → confidence 0.6 → matched_medium
   - score < 0.4 OR multiple categories tied → confidence 0.3 → needs_review
   - no category detected → confidence 0.0 → needs_manual_categorization
   - category detected но no catalog candidates → confidence 0.0 → catalog_gap

7. **Output**: обновить item с UWO triple + urs_code + canonical_popis + match_method + match_confidence.

### Multi-catalog support

Function signature: `match_work(item, ontology, catalog_binding)`. catalog_binding — pluggable interface. Sequential migration по mere добавлению новых binding modules.

### MJ normalization

Canonical units: m, m2, m3, t, kg, ks, kpl, hod, měsíc, paušál.
Aliases: m² → m2, m³ → m3, bm → m, ea → ks, lump_sum → paušál.
Implementation: helper function `normalize_mj(raw: str) -> str | None`.

## NUMBERED ACCEPTANCE CRITERIA

1. UWO ontology contains 50+ categories (see list above). Each category — full Czech synonyms, English skeleton, MJ defaults, exclusion rules.
2. ÚRS_CZ catalog binding contains **only validated prefixes** — for each UWO category verified via SQL query against `data/kros_extract/kros_catalog.db` (9173 items) that corresponding codes really exist. Categories without coverage flagged `binding_status="catalog_gap"` with empty prefix list.
3. Driver script accepts `--items <path>` и `--catalog urs_cz|otskp_cz|...` и `--db <path>`. Run on any project without code changes.
4. On `test-data/hk212_hala/outputs/phase_1_etap1/items_hk212_etap1.json` (54 needs_review) achieves **minimum 25 auto-matches** (matched_high + matched_medium) with **correct** URS codes. Verification: manual inspection of top-10 matches → должны быть категориально правильные (excavation code для excavation popis, не bednění).
5. Items которые остаются needs_review имеют либо category detection (UWO populated, catalog_gap flagged), либо clear reason "no UWO category detected".
6. Backup исходного items.json создаётся перед записью. Idempotent — повторный запуск не приводит к downgrade существующих matched.
7. Output preserves existing fields (popis, mnozstvi, mj, urs_alternatives) — adds new UWO fields рядом, без overwrite.
8. Tests (unit) для:
   - UWO category detection (10+ test cases с известными ответами включая dohloubky/výkop, KARI síť, IPE, antikor, skládkovné, kácení)
   - MJ normalization (15+ aliases)
   - Catalog binding lookup (verify all 50+ UWO имеют либо bindings либо catalog_gap flag)
   - Czech-specific edge cases (diacritics, declensions: figury vs figur, hornině vs hornina)
9. Skeleton modules для OTSKP_CZ, STLB_Bau_DE, BKI_DE, Batiprix_FR, Codigo_Estructural_ES существуют с empty bindings + TODO comments. Готовы к hackathon extension.
10. Spec documents (not implementation) for future tasks created in `docs/`:
    - `TASK_2_HybridSearch_Reranker.md` — describes how vector search + cross-encoder will plug in
    - `TASK_3_ValidationRules_Confidence.md` — describes validation rules engine
    - Note: TASK 4 (MCP Security) is separate document `docs/TASK_MCP_Security.md` (already exists in repo)
11. README.md в knowledge_base/ describes:
    - что такое UWO bridge architecture (link to `docs/STAVAGENT_Architecture_Notes.md`)
    - как добавлять новые categories
    - как добавлять новые catalog bindings (для hackathons)
    - схему extension flow (Czech → German → Spanish → French)

## ЧТО НЕ ВХОДИТ

- Реализация MCP server tool — only spec in acceptance criterion 10. Implementation = TASK 4 (separate document `docs/TASK_MCP_Security.md`).
- Реализация других catalogs (only skeletons).
- Frontend (UI для просмотра matching results) — отдельная задача.
- LLM-driven UWO extraction из TZ (Phase 1 parse) — отдельная задача (TASK 5 in roadmap), эта работа касается только matching.
- Multi-vintage URS handling (CS ÚRS 2018/2026) — простой filter параметр, без vintage-aware logic.
- Replacing rematch_kros_catalog_v2_1.py — этот task создаёт **новый** matching service. Старый script остаётся как baseline для comparison.
- Vector search + reranker — это TASK 2.
- Validation rules engine — это TASK 3.

## Финальное правило именования

**Naming и структуру файлов определяй по существующим конвенциям в репо.** Не создавай параллельную структуру. Встраивайся в существующий код. Если уже есть `app/knowledge_base/` — модули туда. Если convention имени для services — следуй ей. Если есть test fixtures — переиспользуй. Если есть pattern для catalog connectors (`app/api/perplexity_connector.py` etc.) — следуй ему для catalog bindings.

**Перед началом — обязательно проверь в DB реальное наличие prefixes через SQL queries.** Не выдумывать bindings. Это самое важное правило этого task'а.
