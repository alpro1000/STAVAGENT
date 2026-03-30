# TASK: TZ → Soupis prací Pipeline v3.0

**Status:** PLANNED (depends on Work Packages DB from VZ Scraper task)
**Priority:** HIGH
**Depends on:** TASK_VZ_SCRAPER_WORKPACKAGES_v3 (Stage 4 complete)
**Branch:** TBD

## Principle: UNIVERSALITY

System works for ANY type of construction work. No hardcoded packages.
Work Packages come from DB (co-occurrence analysis) or AI fallback.

## Confidence Hierarchy

1. Regex extraction → conf=1.0 (concrete grades, thicknesses, norms)
2. Work Package DB match → from data (0.7-0.95)
3. URS Matcher → conf=0.80
4. AI fallback (Gemini/Claude) → conf=0.70

## Pipeline — 4 Phases

### Phase 1: Extraction (TZ → WorkRequirements)
- Regex (conf=1.0): C25/30, tl. 180mm, ČSN, DN, kW, m³/h
- AI (conf=0.70): paragraph decomposition into work requirements
- 1 paragraph TZ = typically 3-8 work requirements
- Output: WorkRequirement[] — description + parameters + source + confidence

### Phase 2: Package Matching (Requirements → Work Packages)
```
For each work requirement:
  1. Extract keywords
  2. Query Work Packages DB (trigger_keywords match)
  3. If found (confidence > threshold):
     → Expand: anchor + companion + conditional items
     → Evaluate conditions (thickness, material)
     → Attach companion packages (lešení, přesuny)
     → Offer alternative variant (souhrnná R-položka)
  4. If NOT found:
     → AI fallback: Gemini Flash decomposition
     → URS_MATCHER_SERVICE for each suggested item
     → confidence = 0.70
```

### Phase 3: URS Lookup (Packages → konkrétní kódy)
- For each role → find specific ÚRS code via URS_MATCHER
- Cascade: URS_MATCHER → regex pattern → AI fallback
- Validation: MJ must match, parameter range must match
- PP detail from podminky.urs.cz (cached via /api/urs-catalog/:code/detail)

### Phase 4: Assembly (→ Soupis prací)
- Sort by HSV/PSV sections
- Transfer quantities from TZ/drawings
- VV formulas
- Export xlsx (KROS compatible)
- Attribution: source for each item (TZ paragraph or companion package)

## Stages

### Stage 5: TZ Extraction (GATE)
- Regex: concrete grades, thicknesses, norms, DN, kW
- AI decomposition: 1 paragraph → 3-8 work requirements
- WorkRequirement[] model
- Test on 3 TZ types

### Stage 6: Package Matching + Assembly (GATE)
- WP DB lookup by trigger_keywords
- AI fallback when WP not found
- URS lookup (URS_MATCHER + /detail endpoint)
- Companion packages (přesuny, lešení)
- Assembly: HSV/PSV sorting, VV formulas
- XLSX export

### Stage 7: E2E Tests
- Test 1: Fasáda (ETICS + omítky + lešení)
- Test 2: Interiér (SDK + obklady + podlahy)
- Test 3: Instalace ZTI (kanalizace + vodovod)
- Unknown type → AI fallback ≠ empty result

## Companion Rules (from data, not hardcoded)

These are EXPECTED patterns from co-occurrence, not code:
| Work type | Expected companion |
|---|---|
| Any HSV work | Přesun hmot HSV (998*) |
| Any PSV work | Přesun hmot PSV (998*) |
| Facade work at height | Lešení (941*) + sítě (944*) |
| Demolition | Odvoz suti (997*) + skládkovné |
| Concrete | Bednění + výztuž (if ŽB) |
| Excavation | Přemístění + uložení/odvoz + zásyp |

## Acceptance Criteria

1. From any TZ paragraph → regex params (concrete, thickness, norms) conf=1.0
2. AI decomposes paragraph into work items — works for ETICS, ZTI, SDK
3. If WP exists in DB → found and expanded
4. If WP NOT exists → AI fallback returns reasonable decomposition (not empty)
5. Companion packages attached automatically
6. "ŽB strop" → bednění + výztuž + betonáž as group
7. Export: PČ, Typ, Kód, Popis, MJ, Množství, Cenová soustava
8. Items grouped by HSV/PSV sections
9. Works for: ETICS ✓, ŽB skelet ✓, interiér ✓, ZTI ✓, road ✓
10. Unknown type → AI fallback, no crash

## What is NOT included
- Pricing (only structure: codes, descriptions, MJ)
- Full KROS export (.ksi)
- Automatic calculations from DWG/CAD
- Live ÚRS REST API connection
- Hardcoded package lists
