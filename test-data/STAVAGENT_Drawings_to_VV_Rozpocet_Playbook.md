# STAVAGENT — Playbook: DWG/PDF → Výkaz výměr + Rozpočet ÚRS

**Источник опыта:** Libuše objekt D (185-01), проект завершён 12.5.2026
**Применимость:** любой жилой/коммерческий объект ČR/SK с DWG + Tabulky
**Версия playbook:** 1.0 (после PROBE 1-17 + 14a/14f/14g)

---

## 0. Что у тебя должно быть на входе

### Mandatory inputs

| Категория | Файлы | Без чего pipeline не запустится |
|---|---|---|
| **DWG/DXF чертежи** | Půdorysy всех podlažií (1.PP/1.NP/...) | Минимум půdorysy — без них m² не считается |
| **Tabulka místností** | XLSX/PDF (typicky #0020 в номенклатуре) | Карта room codes + плошади fallback |
| **Tabulka skladeb** | XLSX/PDF (typicky #0030) | F-kódy → vrstvy mapping (FF01, F10, F19 atd.) |
| **Tabulka dveří** | XLSX (typicky #0041) | D## codes → razměry + objekt detection |
| **Tabulka oken** | XLSX (typicky #0042) | W## codes |
| **Tabulka ostatních prvků** | XLSX (typicky #0080) | OP## items (žaluzie, kastlíky, hasicí) |

### Nice-to-have

- Старый Výkaz výměr (для cross-check / matching)
- TZ (technická zpráva) — для PROBE 1-4 материалы recovery
- Pohledy fasád — для anti-graffiti area
- Řezy — для výšky stropů когда не default

### Что **не** входит в scope (Karpathy: don't do work that isn't asked)

❌ Statika (отдельный inženýr)
❌ MEP detailing pod úrovní specialistů
❌ Engineering drawings (ADR-005, не STAVAGENT scope)
❌ Cost estimation kompletní (только qty + URS code; pricing optional)

---

## 1. Архитектура pipeline (canonical)

```
DWG/PDF чертежи + Tabulky XLSX
            ↓
[Π.0a] Foundation Extraction
       ├─ Step 1-7: rooms + openings + doors extraction
       └─ Step 8c: TZB elements (prostupy, štroby)
            ↓
   master_extract.json (rooms 80-110+, openings 220-380+)
            ↓
[Π.0b] Validation gate
       ├─ MATCH count (target: >90%)
       ├─ MISSING (target: 0)
       └─ Hard-fail < 0.30 confidence
            ↓
[Π.1] Generator
       ├─ Phase 1-5: items extraction per kapitola
       ├─ Phase 6: pair osazení + reclassifications
       │           (HSV-642 → PSV-767/766/952 via rules)
       ├─ Phase 7a: ÚRS code matching (2-stage: catalog + LLM rerank)
       └─ Phase 8: groups + List 11 sumarizace
            ↓
   items_objekt_X_complete.json (4,000-15,000 items)
            ↓
[Π.2] Excel generator
       ├─ Phase 0.20: List 12 (filter view)
       └─ Phase 0.21: List 13 (filter view + Subdodavatel)
            ↓
   Vykaz_vymer_<objekt>_dokoncovaci_prace.xlsx (13 sheets)
```

### Файловая система

```
test-data/<project>/
├── data/                                      ← inputs
│   ├── DWG_DXF/
│   │   ├── 1pp_pudorys.dxf
│   │   ├── 1np_pudorys.dxf
│   │   └── ...
│   ├── tabulky/
│   │   ├── 0020_TABULKA_MISTNOSTI.xlsx
│   │   ├── 0030_SKLADBY_POVRCHY.xlsx
│   │   ├── 0041_TABULKA_DVERI.xlsx
│   │   ├── 0042_TABULKA_OKEN.xlsx
│   │   └── 0080_TABULKA_OSTATNICH_PRVKU.xlsx
│   ├── stary_VV/ (optional)
│   ├── TZ/ (optional)
│   └── subdodavatel_mapping.json               ← inherited canonical
│
├── outputs/                                   ← generated
│   ├── master_extract_<objekt>.json
│   ├── items_objekt_<X>_complete.json
│   ├── Vykaz_vymer_<X>_dokoncovaci_prace.xlsx
│   ├── validation_report_<X>.md/.json
│   ├── urs_query_groups.json
│   ├── documentation_inconsistencies.json     ← ABMV email queue
│   └── (backups: Vykaz_vymer_pre_probe_<N>.xlsx)
│
└── handoff/
    └── STAVAGENT_Chat_Handoff_<date>.md
```

---

## 2. Workflow для нового проекта (step-by-step)

### Phase 1 — Setup (30-60 min)

1. **Создать структуру** `test-data/<project>/data/` + `outputs/`
2. **Получить inputs** от projektanta (DWG + Tabulky минимум)
3. **Проверить DWG** — открыть несколько DXFs, убедиться что:
   - Rooms имеют closed polygons
   - Door symbols visible
   - Layer naming consistent
4. **Inherit canonical files** из репо:
   - `subdodavatel_mapping.json` v1.1+ (с granular schema)
   - `STAVAGENT_PATTERNS.md` для reference
5. **Создать branch** `claude/<project>-phase-0a-foundation`

### Phase 2 — Foundation Extraction (Π.0a)

**Task для Claude Code:**

```
TASK: Π.0a Foundation Extraction для objekt <X>

CONTEXT:
Новый проект <project_name>. Adresář test-data/<project>/data/.
DWG в DWG_DXF/. Tabulky в tabulky/.

Inherit canonical patterns из STAVAGENT_PATTERNS.md:
- Triple-source verification (Tabulka + DWG + manual)
- Hard-fail < 0.30 confidence
- master_extract.json schema (rooms + openings + doors)

================================================================
PART 1 — Run extraction
================================================================

1.1. Run Π.0a Step 1-7 для objekt <X>:
- Rooms extraction (DXF polygons + Tabulka 0020 fallback)
- Openings (windows + doors per layer detection)
- Doors with D## type matching
- Step 8c: TZB prostupy + štroby

1.2. Output master_extract_<X>.json

================================================================
PART 2 — Validation gate
================================================================

2.1. Generate validation_report_<X>.md:
- Total rooms detected
- Rooms with polygon (% of total)
- Rooms with Tabulka fallback (% of total)
- Openings count + door count
- MATCH/MISSING/CHANGED counts

2.2. Hard-fail если:
- Polygon coverage < 70%
- Total rooms < 30
- Critical Tabulka not parsed

================================================================
PART 3 — Report + STOP
================================================================

3.1. Output summary stats
3.2. Output validation_report_<X>.md
3.3. STOP. User verifies before Π.1 trigger.

Naming определяй по существующим конвенциям в репо.
```

### Phase 3 — Cross-objekt detection check (CRITICAL — PROBE 14f lesson)

**Перед запуском Π.1 generator** — verify что parsers correctly attribute D##/W##/OP## codes к correct objektu:

```
TASK: Cross-objekt detection audit

CONTEXT:
PROBE 14f в Libuše D found that pipeline wrongly attributed D05/D06 
vrata items to objekt D when 'z místnosti č.' column в Tabulce 0041 
clearly showed S.C.02/S.C.03 (objekt C scope).

Before running Π.1 generator, verify cross-objekt detection works.

================================================================
PART 1 — Scan Tabulka dveří
================================================================

For Tabulka dveří 0041:
- Read 'z místnosti č.' (col 2) + 'do místnosti č.' (col 3) для каждого D##
- Map room prefix → objekt:
  * S.A.* → A
  * S.B.* → B
  * S.C.* → C
  * S.D.* → D
  * D.X.X.XX → D apartments (1.NP+)
  * A.X.X.XX → A apartments
  * etc.

Output table:
| D## | dimensions | from room | to room | detected objekt |

================================================================
PART 2 — Same audit для Tabulka oken + 0080
================================================================

Per Tabulka:
- Identify columns с room references
- Map к objektu
- Flag if items would be wrongly attributed

================================================================
PART 3 — Report
================================================================

For current objekt <X>:
- D## codes belonging to X: <count>
- D## codes belonging to other objektu: <count>
- Same для W## + OP##

If any D## без clear objekt detection → STOP, ask user.

DO NOT generate items yet. This is verification only.
```

### Phase 4 — Generator (Π.1)

```
TASK: Π.1 Generator для objekt <X>

CONTEXT:
Foundation extracted (master_extract_<X>.json verified).
Cross-objekt detection confirmed clean.
Inherit canonical:
- subdodavatel_mapping.json v1.1 (granular schema)
- urs_query_groups schema
- 4 invariant tests (a-d) для regen chain
- Confidence ladder: regex=1.0, AI=0.7, Perplexity=0.85, human=0.99

================================================================
PART 1 — Phase 1-5 extraction
================================================================

Generate items per kapitola для objekt <X>.
Apply hard-fail < 0.30 confidence.
Output items_objekt_<X>_complete.json.

================================================================
PART 2 — Phase 6 pair osazení
================================================================

For OP## dodávka items, create paired osazení items:
- HSV-642 (zedník) для general osazení
- PSV-767 (zámečník) для kovová specialty
- PSV-952 (požární specialista) для hasicí
- PSV-768 (vrata) для dveř specialty

Apply Phase 6.1 dxf_spatial_count override для precise per-objekt qty.

================================================================
PART 3 — Phase 7a ÚRS matching
================================================================

2-stage match:
- Stage 1: catalog_only filter
- Stage 2: LLM rerank pomocí PPLX_API_KEY

================================================================
PART 4 — Regen chain (CRITICAL)
================================================================

In EXACT order:
1. phase_7a_v2_part1_groups.py
2. phase_6_generate_excel.py
3. phase_8_list11_sumarizace.py
4. phase_0_20_filter_view_table.py
5. phase_0_21_list13_filter_view_plus.py

================================================================
PART 5 — Invariants gate
================================================================

4 hard-fail checks:
(a) sum(group.items_count) = len(items)
(b) Each item_id в exactly 1 group
(c) Per-group stored qty = sum of items.mnozstvi
(d) List 12/13 row count = items count + meta + header

If any fails → STOP, do not commit.

================================================================
DELIVERABLE
================================================================

- items_objekt_<X>_complete.json
- Vykaz_vymer_<X>_dokoncovaci_prace.xlsx (13 sheets)
- urs_query_groups.json
- documentation_inconsistencies.json (ABMV queue)
- carry_forward_findings (initial PROBE entries if any issues found)
```

### Phase 5 — Manual audit (PROBE pattern)

**После generator** — iteratively audit + fix через PROBE pattern:

```
PROBE workflow:
1. User examines List 1/11/12/13
2. Identifies issues (m²=0, wrong subdodavatel, count mismatches)
3. Creates PROBE task (specific scope)
4. Claude Code fixes + commits + pushes
5. User merges PR via GitHub UI ← critical для conflict prevention
6. New branch для next PROBE
7. Repeat until все red flags addressed
```

**Применённые PROBE patterns в Libuše D:**

| PROBE | Тип | Lesson |
|---|---|---|
| 1-4 | Material recovery | Cross-check с TZ для missing materials |
| 8 | Specialty openings | Phase 5 fuzzy match bug — fix algorithm |
| 9 | TZB scope | Step 8c handles prostupy + štroby |
| 10/13/15 | Area fallback | Tabulka XLSX fallback when polygon missing |
| 14a | Subdodavatel mapping | Granular `_kapitola_popis_granular` schema |
| 14b/14c | Legitimate 0 | Document, don't fix (audit trail) |
| 14f | Cross-objekt | Parser must check 'z místnosti č.' |
| 14g | Stale aggregations | Regen chain mandatory after items changes |
| 17 | ABMV typos | Pracovní interpretace + email queue |

---

## 3. PROBE Pattern (методология audit)

### Когда применять

Любая ситуация когда **expected ≠ actual** в Excel:
- m² = 0 для item который должен быть > 0
- Item count в summary row ≠ actual count
- Subdodavatel category wrong
- Items attributed к wrong objektu
- Missing material reported в TZ but not in VV

### Структура PROBE task

```
TASK: PROBE <N><letter> — <short description>

CONTEXT:
<3-4 sentences: что нашли, где, почему важно>

================================================================
PART 1 — Identify scope
================================================================

<Specific filter rules — kapitola, popis pattern, status>
<Output table перед fix>

================================================================
PART 2 — Apply fix
================================================================

<Specific changes по items.json>
<Preserve audit trail: DEPRECATED prefix, status field, source field>
<Keep item count unchanged (OPTION B audit trail pattern)>

================================================================
PART 3 — Update carry_forward
================================================================

<Add new PROBE entry с severity/status/summary/next_action>
<Update related PROBE entries если applicable>

================================================================
PART 4 — Regen chain
================================================================

Re-run в order:
1-5 (phase_7a → 0.21)

================================================================
PART 5 — Invariants verification
================================================================

4 hard-fail checks (a-d).
Items SHA shows expected change (or unchanged if only metadata).

================================================================
COMMIT
================================================================

git commit -m "PROBE <N><letter>: <summary>"
git push
STOP. User verifies + merges.
```

### Categories of legitimate zero

Документировать карту "когда 0 = correct":

- **Špalety bez fasádních otvorů** — interior rooms have no façade openings → m²=0 correct
- **F10 garáž когда objekt nemá garáž** — floor area 0 если objekt outside garáž scope
- **Per-window-SKU split** — OP codes assigned k specific objektu only; others = 0
- **DEPRECATED audit trail** — items kept as 0 + DEPRECATED prefix для traceability
- **Cross-objekt mis-attribution** — items belong к other objektu, deprecated to 0

---

## 4. Critical Patterns (do not violate)

### 4.1 Determinism ladder

```
Regex (code match)     → confidence 1.0
URS Matcher (catalog)  → confidence 0.80
Perplexity (norms)     → confidence 0.85
AI (Gemini/Claude)     → confidence 0.70
Manual (human review)  → confidence 0.99
```

**Never overwrite higher confidence с lower.** Pipeline must respect ladder.

### 4.2 Audit trail (OPTION B preferred)

Когда item должен быть удалён:

❌ DON'T delete — нарушает traceability
✅ DO set `množství = 0`, prefix popis с `[PROBE Nx - <reason>]`, set `status = WRONGLY_*`, set `source = PROBE_Nx_*`

**Item count preserved** → invariants stable.

### 4.3 Per-task PR discipline

**После каждой PROBE task:**
1. commit + push
2. **STOP** — не начинай новый task
3. User merges PR via GitHub UI (1 click)
4. User confirms merge
5. Fresh branch для next task

**Avoids merge conflict accumulation.** Single biggest lesson from Libuše D.

### 4.4 Cross-objekt detection (PROBE 14f lesson)

Любая Tabulka с multi-objekt scope **MUST** check:
- `'z místnosti č.'`
- `'do místnosti č.'`

Map prefix → objekt:
```python
def detect_objekt_from_room_code(code: str) -> Optional[str]:
    """S.A.* → A, S.B.* → B, etc."""
    if code.startswith('S.A.') or code.startswith('A.'):
        return 'A'
    if code.startswith('S.B.') or code.startswith('B.'):
        return 'B'
    if code.startswith('S.C.') or code.startswith('C.'):
        return 'C'
    if code.startswith('S.D.') or code.startswith('D.'):
        return 'D'
    return None
```

Apply для Tabulka dveří + oken + 0080 + любых others с multi-objekt scope.

### 4.5 Regen chain (PROBE 14g lesson)

После любого items.json change — re-run в EXACT order:

```
1. phase_7a_v2_part1_groups.py    ← refresh urs_query_groups.json
2. phase_6_generate_excel.py      ← Lists 0-9
3. phase_8_list11_sumarizace.py   ← List 11 (sumarizace)
4. phase_0_20_filter_view_table.py ← List 12 (filter view)
5. phase_0_21_list13_filter_view_plus.py ← List 13 (+ Subdodavatel)
```

**4 invariant tests hard-fail before commit:**
- (a) `sum(group.items_count) = len(items)`
- (b) Each item_id в exactly 1 group
- (c) Per-group stored qty = sum of items.mnozstvi
- (d) List 12/13 row count = items count + meta + header

Recommend `regen_all_lists.py` orchestrator.

### 4.6 Subdodavatel granular schema (PROBE 14a lesson)

В `subdodavatel_mapping.json`:

```json
"PSV-783": {
  "_kapitola_popis_granular": [
    {
      "keywords": ["žárové zinkování", "prášková"],
      "subdodavatel": "zámečník"
    },
    {
      "keywords": ["epoxid", "F11", "polyuretan", "F10", "sikagard", "F14", "transparentní"],
      "subdodavatel": "podlahář (epoxidový/PU)"
    },
    {
      "keywords": ["anti-graffiti", "F23"],
      "subdodavatel": "malíř (anti-graffiti)"
    },
    {
      "keywords": ["pancéřový", "F00"],
      "subdodavatel": "betonář (mazaniny)"
    }
  ],
  "default": "podlahář (epoxidový/PU)"
}
```

**First-match-wins.** Scans `popis + skladba_ref.vrstva` case-insensitive.

**Priority chain в `subdodavatel_for()`:**
popis-regex → granular keyword → exact kapitola → prefix → discipline default

**Reusable pattern для multi-trade kapitol:**
- PSV-952 (hasicí vs úklid)
- PSV-768 (sekční vs požární vs revizní)
- HSV-642 (osazení mixed trades)
- HSV-998 (přesun hmot variants)

---

## 5. ABMV Email Queue Pattern

### Структура

`documentation_inconsistencies.json`:

```json
{
  "abmv_email_required": [
    {
      "id": "ABMV_1",
      "category": "design_clarification | documentation_finding | pipeline_correction",
      "severity": "info | low | medium | high",
      "summary": "<short, ready-to-send Czech text>"
    }
  ]
}
```

### Triggers для ABMV item

- F-код undefined в Tabulce 0030
- Code typo в Tabulce 0020 (F-kód в FF field)
- Cross-objekt mismatch (D## v S.C.* room)
- Material mentioned в TZ but no XLSX entry
- Quantity mismatch DWG vs Tabulka

### Workflow

1. Pipeline adds items к queue (via PROBE workflow)
2. User reviews queue before delivery
3. User sends email projektantovi (manual)
4. Wait reply (typically 2-5 days)
5. Apply replies через targeted update (status: matched_ABMV_confirmed)

### Template

```
Vážený pane projektante,

při zpracování výkazu výměr a souvisejících podkladů jsme zjistili 
následující skutečnosti vyžadující upřesnění:

1. <ABMV_1 summary>

2. <ABMV_2 summary>

...

Děkujeme za potvrzení nebo upřesnění.

S pozdravem,
<jméno>
STAVAGENT
```

---

## 6. TOOLING Backlog (priority list для product improvement)

Накопленный backlog (post-VELTON priorities):

| Priority | Task | Estimate | Trigger pattern |
|---|---|---:|---|
| 🔴 HIGH | **Tabulka XLSX area fallback** | 1-2h | PROBE 10/13/15 — eliminates m²=0 для missing polygons |
| 🔴 HIGH | **Default heights per podlaží** | 1h | Manual height inject eliminates |
| 🔴 HIGH | **Cross-objekt detection в parsers** | 2-3h | PROBE 14f — `detect_objekt_from_room_code()` helper |
| 🔴 HIGH | **regen_all_lists.py orchestrator** | 2-3h | PROBE 14g — auto-regen + 4 invariants hard-fail |
| 🟡 MEDIUM | **Žaluzie/Kastlík consolidation view** | 2-3h | Single sheet или separate XLSX |
| 🟡 MEDIUM | **DIMENSION entity extraction** | 3-5d | Reads dim entities → wall lengths/heights |
| 🟡 MEDIUM | **Section view height parser** | 2-3d | Non-default ceilings |
| 🟢 LOW | **multi-format DXF dual-mode** | 0 (done) | Step 8c already handles libredwg + AutoCAD-export |

---

## 7. Quick-start Checklist для нового проекта

### Pre-flight

- [ ] DWG/DXF файлы есть для всех podlažií
- [ ] Tabulka místností (0020) parsed cleanly
- [ ] Tabulka skladeb (0030) defines all F-kódy used в 0020
- [ ] Tabulka dveří/oken parsed
- [ ] Tabulka ostatních prvků (0080) если есть OP##
- [ ] `subdodavatel_mapping.json` v1.1+ inherited
- [ ] Repo branch created: `claude/<project>-phase-0a`

### Foundation phase (Π.0a)

- [ ] master_extract.json generated
- [ ] validation_report.md shows MATCH > 90%
- [ ] Hard-fail < 0.30 confidence не triggered
- [ ] Cross-objekt detection verified (PROBE 14f pattern)

### Generator phase (Π.1)

- [ ] items_objekt_X_complete.json generated
- [ ] Item count reasonable (~4,000 для small project)
- [ ] urs_query_groups.json populated (754+ groups typical)
- [ ] 4 invariants pass
- [ ] List 11 row count > items count (master + detail expand)
- [ ] List 12/13 row count = items count + meta + header

### Audit phase (PROBE iterations)

- [ ] m²=0 items reviewed (legitimate vs bug)
- [ ] Subdodavatel categories verified
- [ ] Cross-objekt attribution clean
- [ ] List 11 summary rows match List 1 totals
- [ ] ABMV email queue populated

### Delivery phase

- [ ] Final Excel ready
- [ ] Cover letter prepared
- [ ] ABMV email sent (manual)
- [ ] Investor receives package
- [ ] carry_forward_findings documented complete state

### Post-delivery

- [ ] Codify learnings в `B5_tech_cards/real_world_examples/<project>/`
- [ ] Update STAVAGENT_PATTERNS.md если new pattern emerged
- [ ] Update mapping JSON v1.X если new subdodavatel rules
- [ ] TOOLING TODO items prioritized в backlog

---

## 8. Anti-patterns (что НЕ делать)

### Pipeline anti-patterns

❌ **LLM для regex-able task** — code matching, F-kód extraction = regex only
❌ **Overwrite higher confidence с lower** — respect ladder
❌ **Delete items без audit trail** — use DEPRECATED prefix instead
❌ **Run only one phase после change** — full regen chain или nothing
❌ **Skip invariants gate** — never commit с failing checks

### Workflow anti-patterns

❌ **Multiple PROBE tasks в одном branch** — accumulates conflicts
❌ **Edit items.json manually** — go через Phase pipeline
❌ **Hardcode object/path names в task** — let Claude Code infer from repo
❌ **Skip cross-objekt verification** — PROBE 14f cost ~150k Kč для D delivery
❌ **Skip List 11 audit** — PROBE 14g found 12 mismatched rows + 22 orphans

### Communication anti-patterns

❌ **Send VV без ABMV email** — projektant ignorance is not bliss
❌ **Auto-fix ambiguous items** — apply pracovní interpretace, flag для confirmation
❌ **Skip handoff doc** — context loss between sessions is real
❌ **N=1 generalization** — wait для N=2+ before declaring pattern universal

---

## 9. Domain Knowledge (Czech construction)

### Klíčové termíny

| Term | Meaning |
|---|---|
| **Rozpočet** | Price estimate breakdown per ÚRS code |
| **Výkaz výměr (VV)** | Quantity take-off — items + qty без cen |
| **Soupis prací** | Itemized list of work (same as VV in practice) |
| **Tabulka místností (0020)** | Room schedule с plochou + F-codes |
| **Tabulka skladeb (0030)** | F-kódy definitions (vrstvy podlah, stěn, atd.) |
| **Tabulka dveří (0041)** | Door schedule с rozměry + room references |
| **F-kódy** | F01-F30 = vrstvy povrchů (FF = podlaha skladba) |
| **HSV** | Hlavní stavební výroba (concrete, masonry) |
| **PSV** | Pomocná stavební výroba (finishing trades) |
| **Špalety** | Window/door reveals (jambs) |
| **Skruž** | Heavy shoring towers (bridges) |
| **Stojky** | Light props (buildings <50 kN) |
| **TZB** | Technika zařízení budov (MEP) |

### Subdodavatel categories (post-PROBE 14a)

31 distinct trades в Libuše D:
- zámečník (kovové konstrukce)
- truhlář (dřevěné dveře)
- podlahář (vinyl/PVC, dlažba)
- **podlahář (epoxidový/PU)** — new from 14a
- malíř (latex)
- **malíř (anti-graffiti)** — new from 14a
- betonář (mazaniny + pancéřové)
- izolatér
- klempíř (oplechování)
- pokrývač (krytina)
- sádrokartonář
- vodaři + plynaři + elektroinstalatér
- VZT + ÚT + chl
- **požární specialista (revize PO)** — from 14d planning
- **dodavatel vrat (sekční/garážová)** — from 14e planning
- vlastní (úklid + stykové detaily + ostatní)

### ÚRS Workflow

```
URS catalog (urs.cz / ÚRS Praha)
       ↓
local cache: data/URS201801.csv (~12K rows)
       ↓
2-stage match:
   Stage 1: catalog_only filter (kapitola + popis pattern)
   Stage 2: LLM rerank через Perplexity API
       ↓
items.urs_code = matched code
items.urs_status = matched_high | matched_medium | no_match | needs_review
```

**Perplexity credit:** $5,000 grant pro STAVAGENT.
**PPLX_API_KEY:** stored в GitHub Actions secrets.

---

## 10. Žihle 2062-1 Cross-reference (другой проект, другой pattern)

Для **D&B tender** проекта pattern немного отличается:

| Aspect | Libuše D | Žihle 2062-1 |
|---|---|---|
| Project type | Bytový soubor revize | D&B tender |
| Deadline | 11.5 ABMV + 19.5 VELTON | 2026-07-02 |
| Inputs | DWG + Tabulky | TZ + zadání + PD |
| Output | VV + Subdodavatel | Soupis tendrová |
| Audit trail | carry_forward | per-SO chunking |
| Patterns | docs/STAVAGENT_PATTERNS.md | 7 product patterns Žihle |

Применять Libuše playbook для **revize-style projects** где есть готовые Tabulky.

Применять Žihle pattern для **D&B tenders** где есть только TZ + zadání.

---

## 11. Что менять, что НЕ менять

### Меняй per project (project-specific)

- DWG/Tabulka файлы paths
- Master extraction parameters (room count thresholds)
- objekt naming (A/B/C/D vs SO-001/002/003)
- Subdodavatel custom mappings (если new trade emerges)
- ABMV email recipients

### НЕ меняй (canonical architecture)

- 4-layer KB structure (Core universal / Regional / Empirical / AI fallback)
- Confidence ladder (regex 1.0 → AI 0.7)
- Regen chain order (5 steps)
- 4 invariant tests (a-d)
- Phase 6.x pair osazení logic
- Granular subdodavatel schema syntax

---

## 12. Готовый промпт для start нового проекта

```
Я начинаю новый STAVAGENT проект. Применяй STAVAGENT_Drawings_to_VV_Rozpocet_Playbook v1.0.

PROJEKT:
- Název: <project name>
- Investor: <client>
- Projektant: <design firm>
- Objekt(y): <list, e.g. "SO-101 obytný dům + SO-201 podzemní garáž">
- Deadline: <date>
- Repo branch: claude/<project>-phase-0a-foundation

INPUTS dostupné:
- DWG/DXF: <which podlaží>
- Tabulky: <which numbers>
- TZ: <yes/no>
- Старый VV: <yes/no — co cross-check>

WORKFLOW:
1. Setup test-data/<project>/ structure
2. Inherit canonical files (subdodavatel_mapping v1.1, patterns doc)
3. Π.0a Foundation Extraction → validation gate
4. Cross-objekt detection audit (PROBE 14f pattern)
5. Π.1 Generator → invariants gate
6. PROBE audit iterations
7. Delivery package (Excel + cover letter + ABMV queue)

Apply principle: STOP and ask before each phase trigger. 
Apply per-task PR discipline (commit → push → user merges → fresh branch).
Apply audit trail (DEPRECATED prefix, не delete).
Apply regen chain in exact order + 4 invariants.

Naming определяй по конвенциям в репо.
```

---

## Appendix A — Verified File Names (Libuše D reference)

```
Inputs:
  185-01_DPS_D_SO01_100_0041_TABULKA_DVERI.xlsx
  185-01_DPS_D_SO01_100_0042_TABULKA_OKEN.xlsx
  185-01_DPS_D_SO01_100_0043_TABULKA_PROSKLENYCH_PRICEK.xlsx
  185-01_DPS_D_SO01_100_0080_R02_-_TABULKA_OSTATNICH_PRVKU.xlsx

Outputs:
  master_extract_D.json
  items_objekt_D_complete.json (4,090 items, SHA: ce6b643f0e065ca7...)
  Vykaz_vymer_Libuse_objekt_D_dokoncovaci_prace.xlsx (13 sheets, 1.124 MB)
  validation_report_D.{md,json}
  urs_query_groups.json (754 groups post-14g)
  documentation_inconsistencies.json (11 ABMV items)
  
Audit/handoff:
  STAVAGENT_Chat_Handoff_2026-05-11.md (23,593 B with §10)
  probe_14_op_items_audit.md (11,290 B)
  probe_8_audit.md, probe_9_audit.md
  
Backups committed:
  Vykaz_vymer_pre_list_13.xlsx
  Vykaz_vymer_pre_probe_9.xlsx
  Vykaz_vymer_pre_probe_10.xlsx
  Vykaz_vymer_pre_probe_13.xlsx
  Vykaz_vymer_pre_probe_14f.xlsx
  Vykaz_vymer_pre_probe_14g.xlsx
  Vykaz_vymer_pre_probe_15.xlsx
  Vykaz_vymer_pre_probe_17.xlsx
```

## Appendix B — PROBE Inventory (Libuše D complete)

```
PROBE 1: Cement screed ~2000 m² missing (legacy, complex level)
PROBE 2: Hydroizolace pod obklad gap (legacy)
PROBE 3: Cihelné pásky Terca material missing (legacy)
PROBE 4: F15 tepelná izolace stropů 1.PP (legacy)
PROBE 5: FF01 generator mismap (closed Phase 0.13)
PROBE 6: D05 = sekční vrata (DEFERRED_TO_KOMPLEX_C_B, corrected via 14f)
PROBE 7: Phase closure legacy
PROBE 8: Specialty openings (Phase 5 fuzzy bug) — FIXED, 6 items, ~1.0 mil Kč
PROBE 9: TZB prostupy + štroby — FIXED, 998 items, ~400-500k Kč
PROBE 10: Sklepní wall area 67.64 m² — FIXED, 12 items
PROBE 13: FF01 floor area 42 rooms 250.76 m² — FIXED, 126 items
PROBE 14a: PSV-783 granular subdodavatel — FIXED, 93 reclassified
PROBE 14b: F10 garáž = C+B scope — VERIFIED_LEGITIMATE_ZERO
PROBE 14c: 28 OP-detail items legitimately 0 — VERIFIED_LEGITIMATE_ZERO
PROBE 14f: D05/D06 vrata wrongly attributed — FIXED, 8 deprecated, ~150k Kč
PROBE 14g: List 11 stale aggregations — FIXED, 12 rows refreshed
PROBE 15: HSV-611 omítky S.D.16/27/42 67.64 m² — FIXED, 6 items
PROBE 17: ABMV F-code typos (F20→F17, F30→FF30) — INTERPRETACE_APPLIED, 65 items
```

**Cumulative recovery:** +1,213 items / +~1.5-1.8 mil Kč / 3 architectural improvements

---

**Document version:** 1.0 (12.5.2026)
**Source project:** Libuše objekt D (185-01)
**Repo:** alpro1000/STAVAGENT
**Canonical branch:** claude/libuse-delivery-continue-GEBr5
**Items SHA reference:** `ce6b643f0e065ca7ab7d76b6eb2b64c313a5c1517abb1a69b90b94d019fa0814`
