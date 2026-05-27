# STAVAGENT Patterns — extracted from this conversation

**Источник:** RD Jáchymov pilot session (2026-05-18 → 2026-05-26)
**Цель:** Universal patterns pro STAVAGENT corpus library, NE project-specific
**Numbering:** TBD — agent найдёт existing library a sprawne pronumeruje

---

## Pattern A — Phase 0a Completeness Audit (mandatory pre-extraction gate)

**Problem:** Agent's default extraction behavior leans toward subset (extract what's obvious / asked). For DPS-grade output, mandatory completeness audit must inventory ALL data sources BEFORE selective extraction.

**Algorithm:**
1. Layer 1 — PDF inventory: enumerate ALL PDFs (tz/ + dokladova_cast/ + vykresy_pdf/ + situace/), per PDF detect content type (text/drawing/scanned), extract text or flag for OCR.
2. Layer 2 — DXF exhaustive layer probe: enumerate ALL layers per DXF file (NE subset), per layer record entity_count + entity_types + sample_data + probe_status (probed_extracted / probed_metadata_only / probed_empty / unprobed). Gate doesn't open until 0 unprobed_actionable layers.
3. Layer 3 — Cross-document reference detection: for each unique marker (S-codes, F-codes, materials), search across all docs, link legenda + uses.

**Acceptance gate:** Phase 1 work BLOCKED until completeness audit shows:
- 0 PDFs without text-probe (or OCR-attempt logged)
- 0 DXF layers with `unprobed_actionable` status
- All cross-document markers s legenda + uses both found

**Anti-pattern:** Starting Phase 1 generation without completeness audit done = guaranteed silent drift.

**Reusable code:** `tools/phase0a_completeness_audit.py` (~700 LOC reference)

**Origin context:** Pilot caught 89% DXF layers initially missed when user prompted "you missed these layers" — 37/48 layers were never probed.

---

## Pattern B — Iterative deepening with human-as-QA-gate

**Problem:** Agentic execution optimizes for task completion, not exhaustive verification. Default behavior: stop when "task done" per asked spec. Without human stress-testing, gaps persist.

**Algorithm:**
1. Agent completes task per spec.
2. Agent returns "done" signal.
3. **Human role: stress-test specific aspects** ("but what about X?", "did you check Y?", "iterate on Z").
4. Agent finds previously-missed details → applies fix.
5. Repeat until 2 consecutive iterations find <3 minor gaps.

**Acceptance:** Pilot considered complete only when consecutive iterations converge to zero material gaps.

**Anti-pattern:** Trust agent's "done" signal blindly. Single-pass deliverables consistently miss 5-15% of scope.

**Why this matters:** Stress-tester role is **structural**, not optional. Replaces traditional engineering review boards / multi-step approvals.

**Origin context:** RD Jáchymov pilot caught 6 categories of silent drifts only iteratively after user prompting (file-swap, encoding, S-codes, missed layers, fabricated terms, per-drawing POZN refs).

---

## Pattern C — Diminishing returns gate

**Problem:** Iterative audits eventually hit zero gaps. Past that point, additional passes find stylistic issues (terminology refinement, formatting) not material issues (missing scope, wrong qty). Without explicit stop signal, iteration continues unnecessarily.

**Algorithm:**
1. After each audit pass, count actionable issues found.
2. If 2 consecutive passes find <3 minor issues → STOP signal triggered.
3. Recognize transition: material findings → stylistic findings.
4. Ship and rest.

**Acceptance:** Pilot delivery proceeds when diminishing returns gate triggers.

**Anti-pattern:** Endless iteration past zero gaps wastes time and erodes confidence in already-complete deliverables.

**Origin context:** RD Jáchymov pilot — Audit v2 found 8 actionable gaps → all fixed → Quality pass found 0 actionable → CEV per-drawing audit found 3 + 1 → Phase 3.5-3.7 verified canonical baseline. Stop signal triggered.

---

## Pattern D — Audit v2 — 10-section completeness methodology

**Problem:** Phase 0a verifies sources probed. Need orthogonal audit that verifies **works present** in items.json. Simple TKP/subdodavatel coverage insufficient.

**Algorithm — 10 sections per pilot:**

- **A** — TKP family coverage (0-9, plus VRN)
- **B** — Subdodavatel trade coverage (each mapped trade has ≥1 item)
- **C** — Domain anchor checklist (~60 typical works per project type)
- **D** — TZ verb-noun regex scan ("provedení X" / "instalace Y" / "montáž Z" → check coverage)
- **E** — Per-podlaží completeness matrix (N podlaží × M elements per floor)
- **F** — Per-room completeness matrix (rooms × attributes — typically 25×9 = 225 cells)
- **G** — Cross-element consistency chains (e.g., windows ↔ parapets ↔ flashings ↔ jambs)
- **H** — Material balance check (Σ floor areas vs total floor area ±5%, Σ ETICS layers consistent, etc.)
- **I** — Cost ratio sanity (HSV/PSV/TZB/VRN proportion within typical range — informational, not gate)
- **J** — TZ deep scan per critical section (~18 anchors per project type)

**Acceptance:** Audit v2 green = 0 critical + 0 important gaps.

**Anti-pattern:** Shipping without Audit v2 — sections E-J catch ~80% of gaps that earlier audits miss.

**Reusable code:** `tools/completeness_check_v2.py` (~700 LOC reference)

**Origin context:** Pilot's Audit v1 (4 sections) caught 2 gaps. Audit v2 (10 sections) caught 8 additional gaps.

---

## Pattern E — Multi-factor catalog candidate selection

**Problem:** When external catalog matcher emits 1-N candidates per item with confidence + source, naive "highest confidence wins" fails. Reality requires multi-factor scoring.

**Algorithm — composite score per candidate:**

```
score = 0.30 × raw_confidence
      + 0.25 × source_reliability (trained matcher ≥ web LLM)
      + 0.20 × unit_match (exact match / compatible / mismatch penalty)
      + 0.15 × popis_jaccard (token overlap source query vs candidate description)
      + 0.10 × note_hint (explicit candidate mention v note field)
```

**Decision rules:**
- score > 0.7 + clear gap to #2 → `clear_winner`
- top-2 Δ < 0.15 → `close_call_top_2` + flag alternative
- score < 0.5 → `low_confidence` + flag
- no candidates → `no_candidates` + blank code + flag MANUAL LOOKUP

**Acceptance:** Output transparent per-item selection rationale (top-N candidates s computed score, selected highlighted, alternative if close call).

**Anti-pattern:** Default candidate_1 always wins. Misses unit mismatches and note hints.

**Origin context:** Pilot found agent's `note` field explicitly mentioned which candidate to use — naive top-by-confidence ignored this signal.

---

## Pattern F — PDF noise filters mandatory in matrix builders

**Problem:** PDF text extraction (pypdf, pdfplumber) introduces noise that triggers false-positive gaps in matrix verification:
- TOC lines (`1.2.3 Section Name......15`)
- "Nevyskytují se" / "Není relevantní" boilerplate
- Numeric coordinate dumps (causes regex catastrophic backtracking)
- Drawing title block stamps
- DPS-scope meta lines ("Tato dokumentace nenahrazuje realizační dokumentaci")

**Algorithm — pre-filter every TZ paragraph before matrix matching:**

```python
NOISE_FILTERS = [
    r'^\d+(\.\d+)*\s+\w+.*\.{3,}\d+$',     # TOC line
    r'^[\d\.\,\s]{20,}$',                   # Numeric coordinate dump
    r'(?i)nevyskytují se|není relevantní',  # Boilerplate negations
    r'(?i)tato dokumentace.*neslouží.*realizac',  # DPS-scope meta
    r'^stránka\s+\d+\s+z\s+\d+$',          # Page numbering
    r'^\w+\s+architekti\s+s\.r\.o\.',      # Stamp variants
    # etc.
]
```

**Acceptance:** Matrix builder rejects noise lines before declaring "GAP detected".

**Anti-pattern:** Without filters, every TOC line becomes a "critical gap" — wastes iteration cycles + erodes audit confidence.

**Origin context:** Pilot's first Matrix A pass returned 22 false-positive critical GAPs from extraction noise. Final pass with filters returned 0 GAPs.

---

## Pattern G — Per-drawing extraction (beyond TZ-only)

**Problem:** Standard project-wide legendy appear at bottom of every drawing sheet (sections + plans + elevations + details). Legenda content identical (project reference). BUT each drawing sheet has **unique annotations + demolition markings + POZN references AROUND legendy**.

**Pipeline must iterate per-drawing for unique annotations, NOT just main reference drawing.**

**Algorithm:**
1. Inventory all drawing PDFs per project (typically 10-30 sheets).
2. Per drawing: extract non-legenda annotations (POZN refs, "stávající" vs "návrh" callouts, demolition markings, local dimensions, material labels at element positions).
3. Cross-reference with extracted standard legenda — skip duplicates.
4. Compare unique annotations against items.json + central evidence index.
5. Flag gaps: drawing-specific POZN reference not mapped to any item.

**Reusable code:** Mojibake decoder for CZ architectural PDFs with broken font CMap:
```python
MOJIBAKE_CZ = {'ú':'í', 'č':'ý', 'ř':'ě', 'š':'ě', 'Ř':'č'}
# cid:33-37 → ů/š/ž/Ž/ž
```

**Acceptance:** Per-drawing audit completes with explicit "all sheets iterated" + gap list.

**Anti-pattern:** Extract primary reference drawing in detail, assume other drawings duplicate. Misses sheet-specific POZN refs + demolition annotations.

**Origin context:** RD Jáchymov pilot — primary řez A-A extracted thoroughly. Per-drawing audit later found POZN.1.02 (komín demolition), POZN.1.03 (opěrné zídky bourání), POZN.2.02 (drenáž za bílou vanou) — 3 real gaps + 1 enrichment missed in TZ-only extraction.

---

## Pattern H — Multi-namespace S-code/F-code handling

**Problem:** Multi-objekt projects (main building + sklad + garage + etc.) may have **separate skladba namespaces per stavební objekt**. Main building uses S01-S12b, secondary objekt uses own S01-S05. Naive global numbering merges incorrectly.

**Algorithm:**
1. Detect per-SO skladba legendy separately.
2. Tag items with namespace-qualified reference: `realizuje_skladbu: "S01_dum"` vs `realizuje_skladbu: "S01_sklad"`.
3. Var_E (skladby vrstev sheet) lists per-namespace S-codes separately.
4. Cross-reference per-SO context, never assume global numbering.

**Acceptance:** Each skladba-implementing item explicitly references namespace + S-code.

**Anti-pattern:** Tag sklad items s dům S-code numbers ("S01 must mean obvodová stěna for everyone"). Mis-attributes layer compositions.

**Origin context:** RD Jáchymov pilot — agent initially tagged only 38 dům items, missed that 27 sklad items have own S01-S05 namespace with different compositions (podlaha sklad / strop sklad+parking / stěna pod-nad terén / opěrná stěna / schodiště).

---

## Pattern I — Web search as catalog verification fallback

**Problem:** Production catalog API (URS, KROS, BKI) may be blocked via WebFetch (403 / authentication). Direct catalog lookup fails.

**Workaround:** Search engines (Google) index catalog content via public mirrors (government procurement portals, document hosting sites, catalog reseller pages). WebSearch returns snippets + LLM summary which extracts catalog description anchored on code/keyword.

**Algorithm:**
1. Query format: `<catalog_id> <code_or_family_digit> <key_noun_from_popis>`
2. Parse top 5-10 Google results, focus on known mirror domains
3. Extract catalog description from snippets
4. Compare item popis vs catalog popis: MATCH / WRONG_LEAF / WRONG_WORK_TYPE / UNCLEAR
5. Apply fallback hierarchy strictly (verified / wrong leaf alt / family only / blank + flag)

**Cost reality:** $0.01 per WebSearch (Anthropic API pricing). Budget ~$0.50-1.00 for 50-80 queries.

**Acceptance:** Selective use (NE all items), targeting items already flagged uncertain by matcher (family mismatch, wrong_leaf, low confidence, close call).

**Anti-pattern:** Brute-force WebSearch on all items wastes budget. Or skip verification entirely, ship wrong codes.

**Forbidden:** Never fabricate catalog code. If nothing found → blank cell + explicit "MANUAL LOOKUP" flag. Never write "TBD" or fake codes like "999999999".

**Origin context:** Pilot URS WebSearch verified 13 codes selectively, found 6 wrong leafs (family OK but leaf 9-digit wrong ~63% rate) + 4 correct replacements. Established generator heuristic accuracy: 6-digit family correct ~75%, 9-digit leaf wrong ~63%.

---

## Pattern J — Honest fallback hierarchy for missing data

**Problem:** When matcher or lookup fails, agent tendency is to fabricate value or use placeholder. Both lie to client.

**Algorithm — 8-level fallback hierarchy:**

| Case | Action | Visual flag |
|---|---|---|
| Exact match | Use confirmed | ✓ green VERIFIED |
| Better alternative found | Use alt, log original | ⚠ amber "WRONG_LEAF — was X, correct Y" |
| Family found, leaf unknown | Keep family + "???" leaf | ⚠ amber "FAMILY OK — leaf needs lookup" |
| Multiple candidates close | Keep top + flag close call | ? gray "VERIFY — close call, alt: Y" |
| Low confidence (<0.5) | Keep top + flag | ? gray "REVIEW — low confidence" |
| Nothing found | **Blank cell** | ❌ red "MANUAL LOOKUP — popis only" |
| Not searched (high conf existing) | Use existing | (no flag) |
| Items.json-source-only | Use existing | (gray italic) |

**Forbidden:**
- Fabricated codes (random numbers, "999999999", "TBD")
- Hidden gaps (skip item from rozpočet because no code)
- Mismatched family code use (wrong family with note "close enough")

**Acceptance:** Karel/client sees every gap explicitly. Blank cell + flag = honest signal. Fake code = lie.

**Anti-pattern:** "999999999" placeholder, "TBD" text in code column, item silently dropped because no code found.

**Origin context:** Pilot fixed 9 items where heuristic generated wrong 9-digit leaf (kept 6-digit family + "???" leaf), 122 items left blank with "MANUAL LOOKUP" flag because no candidate found.

---

## Pattern K — External LLM cross-validation as Nth source layer

**Problem:** Internal extraction (TZ + DXF + Excel + Word) may have systematic blind spots. Without external cross-check, gaps persist.

**Algorithm:**
1. Run independent external LLM (different model family — ChatGPT, Gemini, etc.) on same source documents.
2. Compare structural findings (rooms count, skladby count, work blocks count, missing docs identification).
3. Expected outcome:
   - ~80-90% overlap with internal extraction → validates pipeline correctness
   - ~10-20% new findings → uncovers gaps in internal extraction
4. Treat external LLM output as **validation cross-check**, NE replacement for detailed internal items.

**Acceptance:** External LLM findings cross-referenced against internal output. Real gaps integrated, false positives dismissed with rationale.

**Anti-pattern:** Replace internal detailed items with external LLM high-level abstractions (different abstraction levels). Or dismiss external findings without verification.

**Origin context:** Pilot — ChatGPT independent analysis confirmed ~80% of internal findings + flagged 2 real gaps (sklad-specific skladby namespace, cell numbering anomaly). Both subsequently verified and addressed.

---

## Pattern L — Schema integrity — globally-unique entity IDs

**Problem:** Reused entity IDs across sub-namespaces (e.g., `VRN.001` exists in 9 different VRN sub-kapitolas) lead to first-match overwrite bugs during patch operations.

**Algorithm:**
1. Enforce globally-unique item.id at schema validation step.
2. OR document compound canonical key (e.g., `(id, kapitola, subkapitola)`).
3. Patch tools use compound key for identity resolution, never first-match by partial ID.

**Acceptance:** Schema validator runs before patch operations. Compound key resolution required.

**Anti-pattern:** First-match patching by ID prefix overwrites wrong entry silently.

**Origin context:** Pilot patcher overwrote ZS WC popis when intending to update Průzkumy popis — both had ID `VRN.001` under different sub-kapitolas. Caught during re-audit, fixed via compound key.

---

## Pattern M — Pattern #15 strict sequence: extract → consolidate → THEN match

**Problem:** Catalog matching against incomplete extraction baseline wastes budget + delays delivery. Each subsequent extraction adds items → matched codes need re-validation → wasted matching work.

**Algorithm — strict ordering:**

```
Phase 1: EXTRACT         — all documents (TZ + DXF + Excel + Word + MD + external)
Phase 2: CROSS-REFERENCE — matrices verify completeness (A: source → items, 
                          B: entities → items, C: items → sources, D: cross-doc)
Phase 3: CONSOLIDATE     — finalize items list, FREEZE it (single source of truth)
Phase 4: VALIDATE LIST   — File A audit deliverable s provenance (NO codes yet)
                          STOP GATE — explicit human confirmation
Phase 5: MATCH CATALOG   — catalog matching against FROZEN list
Phase 6: PRODUCTION      — File B production deliverable s codes filled
```

**Acceptance:** No Phase 5 work until Phase 4 STOP gate confirms list FROZEN. No File B until File A complete.

**Anti-pattern:** Mix files (audit + production in single deliverable), or run catalog matching mid-extraction. Either wastes work or ships incomplete.

**Two-file principle:**
- File A (audit) — provenance per item: source / formula / data_quality / confidence — for internal QA + investor transparency
- File B (production) — clean catalog format ready for system import: code + popis + MJ + qty + price columns — for execution partner

**Origin context:** Pilot — first attempt jumped to URS matching after Audit v2, missed CEV verification + per-drawing audit. User explicitly stopped: "сначала список потом коды и не смешиваем эти файлы".

---

## Pattern N — Continuous source provenance per item

**Problem:** Items without source attribution become unverifiable. Catalog matching, qty disputes, audit trail all require traceable origin per item.

**Algorithm — required fields per item:**

```yaml
item_id: <globally unique>
popis: <Czech URS-standard terminology>
mj: <single canonical unit>
mnozstvi: <numeric value>
mnozstvi_formula: <human-readable derivation, e.g. "obvod 38.70 × výška 2.795 - okna 7.2 m²">
_source: <document reference, e.g. "TZ ARS § 5.5 + DXF dum_DPZ SM_kóty layer">
_data_quality: <enum: dxf_deterministic / tz_explicit / methvin_empirical / fallback_csn>
_mnozstvi_conf: <0.0-1.0>
_vyjasneni_ref: [Q3, Q8, ...]  # open questions affecting this item
_audit_gap_fixed: <gap ID if added during audit>  # optional
```

**Acceptance:** Every item has fields populated. Quality pass checks _source claims actually verifiable in source documents.

**Anti-pattern:** Items without source ("magic" appearance), or _source pointing to non-existent reference.

**Origin context:** Pilot requires per-item provenance for File A audit deliverable. Matrix C (items → source verification) validates this layer.

---

## Pattern O — Czech regex diacritic boundary pitfall

**Problem:** Python `\w+` matches Czech diakritiku in matched portion, but prefix patterns with explicit Czech characters fail at char-boundary mismatch when boundary is on multi-byte UTF-8 character.

**Example failure:**
- Pattern: `^Hydroizolac\w+`
- Target: `Hydroizolační`
- Failure: position 10 is `č` (U+010D Latin Extended-A), NOT `c` (U+0063)
- Regex fails despite expectation

**Algorithm — workarounds:**

```python
# WRONG — fails on diacritic boundary
PATTERN = r'^Hydroizolac\w+'

# RIGHT — use shorter stem before boundary
PATTERN = r'^Hydroiz\w+'

# RIGHT — explicit alternative
PATTERN = r'^Hydroizolac[ií]'  # or
PATTERN = r'^Hydroizolač'      # specify exact char

# RIGHT — unicode-aware library (regex module instead of re)
import regex
PATTERN = regex.compile(r'^Hydroizolac\p{L}+')
```

**Reusable utility:** `czech_regex_helpers.py` with tested patterns for common Czech construction terminology.

**Acceptance:** All Czech regex patterns tested against actual terminology before deployment.

**Anti-pattern:** Assume ASCII char-boundary semantics in Czech regex prefix. Bug silently fails extraction.

**Origin context:** Pilot Quality pass caught 2 false negatives where regex failed on `č` / `š` boundary in stems.

---

## Pattern P — Comprehensive Extraction Verification (CEV) before catalog matching

**Problem:** Extraction may complete per Phase 0a + Audit v2 + Quality pass, but **cross-source consistency** between TZ/DXF/Excel/Word/MD not verified. Catalog matching against unverified baseline = matching against potentially-inconsistent data.

**Algorithm — 5 layers + 4 matrices:**

**Layers (extract):**
1. TZ texts — all PDFs in tz/ + dokladova_cast/ + vykresy_pdf/
2. DXF files — re-verify all layers + entities
3. Excel inputs — all batch/source files, all sheets
4. Word documents — questions, decisions, narratives
5. Markdown outputs — cross-consistency of summary docs

**Matrices (cross-reference):**
- **Matrix A** — TZ requirements → items (COVERED / N/A_DOCUMENTED / GAP / EXTRA)
- **Matrix B** — DXF entities → items (same verdicts)
- **Matrix C** — items → source verifiability (VERIFIED / PARTIAL / NOT_VERIFIABLE)
- **Matrix D** — cross-document consistency (same fact mentioned in 2+ docs → consistent?)

**Outcomes:**
- Path A: All matrices clean → resume catalog matching with confident baseline
- Path B: Few gaps found → add items + re-audit subset → then catalog matching
- Path C: Significant gaps → halt + escalate

**Acceptance:** CEV final report s explicit Path A/B/C verdict before Phase 5 catalog matching.

**Anti-pattern:** Skip CEV, jump straight from extraction to catalog matching. Discover inconsistencies post-delivery.

**Origin context:** Pilot's CEV caught 3 GAPs + 1 ENRICHMENT after Audit v2 + Quality pass already passed. Without CEV, these would have shipped.

---

## Pattern Q — Two-file delivery — audit + production separation

**Problem:** Single deliverable trying to serve both audit transparency + production usage gets compromised on both fronts. Audit columns clutter production view; production codes pollute audit narrative.

**Algorithm — two separate files:**

**File A — Audit / Worksheet** (audit Excel):
- Multiple sheets for different audience views (aggregated / detailed / per-floor / per-construction / verification trail)
- Per item: provenance columns (source / formula / data_quality / confidence / vyjasneni_ref)
- For: investor (high-level), projektanti (technical), internal QA (provenance)
- Purpose: transparency, decision support, audit trail

**File B — Production** (catalog-system import):
- Standard catalog format (per system requirements — KROS, BKI, Batiprix, etc.)
- Clean: code | popis | MJ | qty | unit_price | total | flag
- Section dividers (chapter hierarchy) + items + formula breakdowns
- For: execution partner direct import
- Purpose: production usage, cenotvorba, system integration

**Both files reference same items.json source-of-truth.** Different rendering layers.

**Acceptance:** Both files delivered separately. Different naming convention. Different sheet structures.

**Anti-pattern:** Mix provenance columns into production file (pollutes import). Or omit provenance from audit (no transparency).

**Origin context:** Pilot required both — File A (Vykaz_vymer_VSE_VARIANTY) for investor + projektanti, File B (Vykaz_vymer_KROS_format) for Karel KROS systém import.

---

## Pattern R — Project synthesis before audit decisions

**Problem:** Iterative audits find new gaps each pass because agent lacks **holistic project mental model**. Only sees individual items, individual TZ sections, individual DXF entities. Without project-level synthesis, decisions become reactive to individual findings.

**Algorithm:**

Before fixing / delivering, agent produces structured project summary:

```
1. Investiční záměr — investor, lokalita, charakter zakázky, stupeň dokumentace
2. Stavební objekty — per SO: rozsah, geometrie, podlaží, jednotky
3. Klíčové konstrukce — per SO: skladby, materiály, specifika
4. Bourání — demolice m³, demontáže ks
5. Nové instalace — vytápění, voda, elektro, větrání
6. Cenové bloky — per kapitola item counts (HSV X / PSV Y / VRN Z)
7. Otevřené otázky — per projektant breakdown
8. Stav přípravy — audit chain status
```

**Two outputs:**
- Full summary (Project_Summary.md) — 8 sections, ~16 KB
- One-pager (Project_OnePager.md) — 1 A4 page for client quick orientation

**Acceptance:** Holistic synthesis forces mental model. Subsequent decisions (fix vs ship, accept vs escalate) become informed instead of reactive.

**Anti-pattern:** Jump from individual finding to immediate fix without project-level context. Pattern of "fix → re-audit → new finding → fix → re-audit" without synthesis.

**Origin context:** Pilot — after 4 audit layers caught gaps iteratively, user requested project summary. Holistic synthesis enabled informed decision: Path C (hybrid delivery: audit Excel now, KROS file later).

---

## Pattern S — Squash-merge anti-pattern + workflow discipline

**Problem:** GitHub default "Squash and merge" option breaks linear history. Each squash creates new commit hash on main, branch diverges from its own work, subsequent commits create false conflicts on identical content.

**Algorithm — repo configuration:**

```
GitHub repo → Settings → General → Pull Requests:
  ☐ Allow squash merging   (UNCHECK — critical)
  ☑ Allow merge commits    (keep checked)
  ☐ Allow rebase merging   (optional)
  
Default merge strategy: Merge commit
```

**Branch lifecycle workflow:**
1. Open PR only when work truly done.
2. Work on branch for days/weeks. Branch can live long.
3. Merge via "Create a merge commit" (NOT squash) to preserve linear history.
4. Delete branch only after acknowledged delivery.

**Acceptance:** Repo disables squash globally. Branch history preserved through merge.

**Anti-pattern:**
- Squash-merge mid-pilot (breaks linear history, creates false conflicts)
- Open PR + auto-merge before pilot done (creates diverging branches)
- Manual git checkout --ours conflicts repeatedly because of recurring squash

**Origin context:** Pilot encountered 4× false merge conflicts mid-work due to squash-merge from prior PR snapshots. Each took 10-15 min agent time to resolve. Root cause: repo squash-merge enabled.

---

## Pattern T — Honest cost transparency to user

**Problem:** User panics seeing "AI used $10-15 budget" assuming separate billing. Agent should clarify cost model to avoid false alarm.

**Algorithm — when discussing operational cost:**

1. State exact cost per operation (WebSearch ~$0.01 per query at Anthropic pricing).
2. Total for typical task (~$0.50-0.80 for 50-80 queries).
3. Billing model: bundled in user's subscription (NOT separate charge).
4. Compare to user's hesitation source (e.g., separate Google Cloud bill).
5. Explain unrelated charges separately if user conflates them.

**Acceptance:** User understands real cost magnitude + billing model.

**Anti-pattern:** Vague "budget concerns" without specifics. Or confuse user about which bill covers what.

**Origin context:** Pilot — user saw "$10-15 budget" in agent comment + received 1000 CZK Google Cloud bill same day. Conflated two separate things. Clarification: WebSearch real cost ~$0.50, GCP bill = STAVAGENT infrastructure unrelated to AI usage.

---

## Pattern U — Skill-of-the-pilot encoding for next iterations

**Problem:** Each pilot generates lessons learned. Without explicit codification, lessons evaporate. Future pilots repeat same mistakes.

**Algorithm:**
1. After pilot delivery, identify patterns caught during iteration.
2. Generalize each pattern (project-agnostic).
3. Write `<pattern_name>.md` to corpus patterns directory.
4. Update master `PATTERNS.md` registry with new entry + cross-references.
5. Update `CLAUDE.md` (or equivalent agent context file) with critical patterns as mandatory rules.
6. Update relevant SKILL.md files in skills directory.

**Acceptance:** Patterns codified in 3+ locations (per-pattern file + master registry + agent context). Next pilot automatically inherits.

**Anti-pattern:** Mental note only. Hope to remember next time. Lessons lost between pilots.

**Origin context:** Pilot RD Jáchymov produced 15+ patterns. Each codified in B5_tech_cards/real_world_examples/<pilot>/patterns/ + STAVAGENT_PATTERNS.md + CLAUDE.md updates.

---

## Pattern V — File staging convention for processed vs canonical inputs

**Problem:** Source documents arrive in mixed states (versions, drafts, supersededed). Without staging convention, agent processes wrong versions or processes same content multiple times.

**Algorithm — input directory convention:**

```
inputs/
├── tz/                      # Canonical TZ texts (current versions)
├── dokladova_cast/          # Canonical dokladová část
├── vykresy_pdf/             # Canonical drawings (current)
├── situace/                 # Canonical site plans
├── _reference/              # Reference examples (e.g., other projects' formats)
├── _superseded/             # Older versions kept for audit trail
│   └── YYYY-MM-DD_<reason>/ # Per-date subdirs explaining supersedence
└── meta/                    # Metadata (vyjasnění queue, inventory)
```

**Per-document attributes:**
- Version tag in filename
- Date in supersession subdir
- Reason note in meta/

**Acceptance:** Agent processes only canonical (current) inputs. Audit can re-verify by reviewing supersedence trail.

**Anti-pattern:** Mix canonical + superseded in same directory. Agent processes outdated version. Or duplicate-processes superseded version.

**Origin context:** Pilot inputs underwent multiple TZ revisions. Staging convention preserved audit trail while keeping canonical inputs clean.

---

# Task for agent — codify these patterns into existing library

Below is a task spec for agent to integrate these patterns into the STAVAGENT corpus library. Agent will discover existing structure and renumber accordingly.

```
TASK — Integrate new patterns into STAVAGENT corpus library

## Context

User extracted 22 patterns from recent pilot work (see content above).
These need integration into existing STAVAGENT pattern library, but numbering
is currently inconsistent across the repo (different chats, different sessions).

## Step 1 — Discover existing pattern library structure

Search the repo for existing pattern documentation:

```bash
# Find existing pattern files
find . -type f -name "*.md" | xargs grep -l "pattern" -i 2>/dev/null | head -30

# Common locations to check
ls -la app/knowledge_base/B5_tech_cards/real_world_examples/*/patterns/ 2>/dev/null
ls -la packages/core-backend/app/knowledge_base/B5_tech_cards/real_world_examples/*/patterns/ 2>/dev/null
ls -la docs/*PATTERNS*.md 2>/dev/null
ls -la docs/STAVAGENT_PATTERNS.md 2>/dev/null
ls -la CLAUDE.md 2>/dev/null

# Find master registry if exists
grep -l "Pattern #" docs/ 2>/dev/null
```

Determine:
- Canonical pattern directory location (likely B5_tech_cards/.../patterns/)
- Master registry file (likely STAVAGENT_PATTERNS.md)
- Highest existing pattern number across all locations
- Naming convention used (01_, 02_, ... vs pattern_<name>.md)
- Pattern .md template structure used

## Step 2 — Reconcile existing numbering

Patterns may exist in multiple places with conflicting numbers (different pilot sessions).
Read each existing pattern file. Build complete list:

| Pattern # | Name | Origin pilot | Location | Status |

Identify:
- Duplicates (same pattern documented twice with different numbers)
- Gaps in numbering (missing #N where #N-1 and #N+1 exist)
- Inconsistencies (master registry says #15 = X, individual file says #15 = Y)

## Step 3 — Renumber + integrate

Based on existing library state:

1. Establish canonical numbering (highest existing + sequential for new)
2. Resolve duplicates (merge or supersede with explanation)
3. Fill gaps if necessary
4. Add 22 new patterns from this conversation:
   - A through V — see content above
   - Each pattern becomes new `<NN>_<pattern_name>.md` in canonical dir
   - Each pattern added to master registry

## Step 4 — Update agent context files

Update `CLAUDE.md` (root) and any relevant `SKILL.md` files:
- New mandatory rules from critical patterns (e.g., Phase 0a, Audit v2 methodology, Pattern #15 sequence)
- Cross-references to new pattern files
- Updated workflow recommendations

## Step 5 — Validate consistency

After integration:
- Run script to verify all patterns referenced in CLAUDE.md exist
- Run script to verify master registry matches individual files
- Run script to verify no duplicate pattern numbers

## Step 6 — Commit + document

```
git checkout -b patterns/library-consolidation
git add <new pattern files>
git commit -m "feat(patterns): consolidate library — N new patterns from RD Jáchymov + reconciliation"
git push
```

Open PR with summary table:
- N patterns added
- M duplicates resolved
- K gaps filled
- Existing library state before vs after

## Forbidden

- Don't renumber existing patterns without checking which references depend on them
- Don't create new directory if existing one already serves purpose
- Don't lose origin context (each pattern must retain pilot origin reference)

## Output

Final summary table showing:
| Old # | New # | Name | Status (new / renumbered / merged / unchanged) |
```

This is the structured task. Agent reads it, discovers library, integrates patterns.
