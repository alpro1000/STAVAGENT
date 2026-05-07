# Žihle 2062-1 Reconciliation Findings — 4 System Gaps (G1-G4)

**Source:** `test-data/most-2062-1-zihle/04_documentation/reconciliation_report.md`
**Audit context:** Session 1 reconciliation — user manual SO_201_JŠ.xls (77 položek
expert benchmark, Kfely template) vs Phase C calculator outputs (11 elementů) vs
Phase D OTSKP soupis.

These findings map directly to **2 backlog tickets opened from Žihle pilot**:
- `backlog/calculator_prompt_extension.md` — addresses G1 + G3 (~144 h)
- `backlog/otskp_search_algorithm.md` — addresses G2 (~52-64 h)

---

## G1 — Calculator scope = ~14 % of real BOQ

**Severity:** HIGH. Affects ~90 % of položek across ostatní třídy.

### Problem

Phase C calculator covers **11 betonářských elementů** (beton + výztuž + bednění +
podpěry + zrání + předpětí). Real Czech BOQ has **121 položek** across TSKP třídy 0-9
(per user manual SO_201 ground truth).

Coverage by třída:

| Třída | Doména | Manual count | Calculator count | Gap |
|---|---|---:|---:|---|
| 0 | Všeobecné (administrativa, dokumentace) | 12 | 0 | 100 % missing |
| 1 | Zemní práce | 9 | 0 | 100 % missing |
| 2 | Základy | 3 | 2 (beton+výztuž) | partial |
| 3 | Svislé konstrukce | 5 | 4 | partial |
| 4 | Vodorovné konstrukce | 9 | 5 | partial |
| 5 | Komunikace (vozovkové vrstvy) | 12 | 0 | 100 % missing |
| 6 | Úpravy povrchů | 1 | 0 | 100 % missing |
| 7 | PSV (izolace + nátěry) | 6 | 0 | 100 % missing |
| 8 | Potrubí (drenáže) | 1 | 0 | 100 % missing |
| 9 | Ostatní (svodidla, dilatace) | 19 | 0 | 100 % missing |
| **Total** | | **77** | **11** | **~14 % coverage** |

### Žihle workaround

For 86 % missing scope, Phase D used `source: user_manual_fallback` with confidence 0.7
and reference back to user manual rows. Manual labor cca 50 položek per SO objekt.

### Backlog fix

`backlog/calculator_prompt_extension.md` (~144 h) — extend calculator from 11 →
~25 element types, adding TSKP třídy 0/1/5/7/8/9 layers. Acceptance: ≥ 80 % coverage
of next pilot BOQ.

---

## G2 — OTSKP catalog "lookup-by-code" but no fuzzy search

**Severity:** HIGH. Blocks calculator → soupis automation pipeline.

### Problem

Current `concrete-agent` exposes `/api/otskp/code/{code}` (lookup by exact code) but
no semantic / fuzzy search to translate human input "VOZOVKOVÉ VRSTVY ZE ŠTĚRKODRTI
TL. DO 250 MM" → OTSKP code 56335.

OTSKP catalog has **17 904 codes** in DB. Without fuzzy search, every Žihle položka
required **human-in-the-loop** translation (claude session manually researching OTSKP).

### Žihle measurement

Phase D Master Soupis required ~8 hours of human time per 60 položek for OTSKP code
mapping. Žihle had 23 OTSKP codes in user manual XLS that were NOT in initial Phase D
mapping — caught only by reconciliation, not automated discovery.

### Backlog fix

`backlog/otskp_search_algorithm.md` (~52-64 h) — 4-stage TSKP-based fuzzy search
algorithm:
1. Normalize (lowercase, strip diacritics, filler words)
2. Typology detect (TSKP class hint via regex)
3. Parameter match (concrete class, MJ, "10505 B500B", etc.)
4. Confidence score

Acceptance: 80 % top-1 / 95 % top-3 on Žihle SO_201 query set (77 položek).

---

## G3 — Calculator přechodová deska rebar_index 100 kg/m³ is low

**Severity:** MEDIUM. 38 % under-estimate for mostní přechodové desky.

### Problem

Calculator default for `prechodova_deska` element_type:

```yaml
rebar_ratio_kg_m3: 100
recommended_range: [80, 120]  # too low for mostní context
```

User manual ground truth (Žihle T4-04 reconciliation):
```
calc:    1.992 t  (9.96 m³ × 100 kg/m³)
user:    2.740 t  (9.96 m³ × 138 kg/m³)
delta:   -27.3 %  → FLAG
```

Mostní přechodové desky carry higher dynamic loading (LM1 + integrální rám thermal
forces) than building přechodové desky → require denser rebar (~130-150 kg/m³).

### Žihle workaround

User manual fallback used for výztuž row (kept user 138 kg/m³ via reconciliation
flag). Calculator output retained as primary reference but flagged.

### Backlog fix

Code change in `Monolit-Planner/shared/src/calculators/element-classifier.ts`:

```typescript
// ELEMENT_DEFAULTS.prechodova_deska:
rebar_ratio_kg_m3: 130,           // was 100 — Žihle G3 finding
rebar_ratio_range: [110, 150],    // was [80, 120]
```

Out of scope of this Žihle pilot (calculator core unchanged per task constraint).
Tracked in `backlog/calculator_prompt_extension.md` § G3-fix.

---

## G4 — Manual SO_201_JŠ.xls = Kfely template, NOT Žihle-scaled

**Severity:** LOW (audit-only).

### Problem

User-provided `SO 201 - Most ev.č. 20-005 - JŠ.xls` is the **Kfely template** (most
ev.č. 20-005 in Karlovy Vary kraj, ne Žihle). Numbers in this XLS apply to Kfely
geometry (815 m² mostovka, classic opěry+křídla, plný pylon), NOT to Žihle (46 m²
mostovka, integrální rám bez křídel).

### Žihle reconciliation finding

| Element | Kfely manual | Žihle calc | Status |
|---|---:|---:|---|
| Mostovka beton | 37.62 m³ (815 m² × 0.046 m? — actually Kfely use t=0.45 m × jiná plocha) | 39.84 m³ | ✅ within 10 % match |
| Římsy beton | 1.6 m³ (Kfely tenká kantilever) | 8.64 m³ (Žihle plná římsa 0.90×0.40 m) | ⚠️ +440 % flag — different geometry |
| Opěry beton | 25.84 m³ (klasická opěra+křídla) | 16.6 m³ (integrální dříky bez křídel) | ⚠️ -36 % flag — different concept |

These deltas are **NOT errors** — they're genuine concept/geometry differences.
Manual XLS is a **typological reference** (TSKP třídy + OTSKP codes + HSV/PSV
hierarchy), NOT a Žihle quantity ground truth.

### Žihle workaround

Reconciliation `status: FLAG` with explanation per item. Calculator deterministic
mnozstvi accepted as primary (user choice C — repeatable + traceable per Pattern 3
"Triangulation Philosophy").

### Backlog fix

Documentation-only — `04_documentation/manual_reference_JS/README.md` flag:

> "User XLS = Kfely template, ne Žihle ground truth. Use as TYPOLOGICAL REFERENCE
> only (TSKP třídy + OTSKP codes + HSV/PSV hierarchy). Mnozstvi values reflect
> Kfely geometry, NOT applicable to Žihle directly."

---

## Cross-cutting insights for future pilots

1. **Triangulation > single source.** No source of truth wins automatically. Calculator,
   user manual, and KB norms must all be consulted; conflicts inline-flagged not
   silently overwritten (Pattern 3).

2. **Calculator coverage is the blocker.** Until G1 + G2 are addressed, pilot effort is
   ~50 % calculator path + ~50 % manual fallback labor. Closing G1 + G2 reduces total
   pilot effort by 30-40 %.

3. **Reconciliation FLAGS catch concept divergence early.** Žihle's 16 reconciliation
   FLAGS (|Δ%| > 10 %) all turned out to be either (a) different geometry/concept (NOT
   error), or (b) calculator default upgrade pending (G3). Zero turned out to be a
   mistake by either side. The triangulation discipline is doing its job.

4. **System gaps are project-driven.** Each new pilot exposes 1-3 calculator gaps. Žihle
   exposed G1-G4. Track them in `backlog/` with effort estimates so technical debt
   accumulates explicitly, not implicitly.

## Cross-references

- Reconciliation report: `test-data/most-2062-1-zihle/04_documentation/reconciliation_report.md`
- Backlog tickets: `test-data/most-2062-1-zihle/backlog/calculator_prompt_extension.md`,
  `test-data/most-2062-1-zihle/backlog/otskp_search_algorithm.md`
- User manual source: `test-data/most-2062-1-zihle/04_documentation/manual_reference_JS/SO_201_parsed.yaml`
- Patterns reference: `docs/STAVAGENT_PATTERNS.md` (Pattern 3 Triangulation)
- ZS template patterns: `../../ZS_templates/PATTERNS.md`
