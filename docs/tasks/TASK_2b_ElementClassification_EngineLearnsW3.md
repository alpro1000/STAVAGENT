# TASK_2b_ElementClassification_EngineLearnsW3

**Phase:** 2b (continues Phase 2a — SSOT calculation delegation, already merged & live)
**Estimated effort:** ~20–26h (recon-confirm + golden baseline ~3h · data → KB ~5h · head-noun layer port ~6h · reject + signal ladder ~3h · dřík fix ~2h · RED/golden tests ~5h)
**Dependencies:** Phase 2a merged. A deep recon of this territory was already completed in a prior session (W3 classifier + W3 name-normalizer in the Python/MCP side; the TS engine element-classifier; the January work_classifier; the kb-generated build path; the dřík bug located in two places). This task does NOT re-run that recon from zero — it confirms it still holds and proceeds.
**Demo role:** Correctness foundation. Goal = the UI-side (engine) classifies element types as well as the W3 (MCP) side. This unblocks later MCP classify-delegation. It is not itself a demo scene.

---

## Decision already made — do NOT reopen

The A-vs-B fork is **decided: B, with one narrow borrowing.**

- The concrete-**element** classifier is built on **W3's logic** (head-noun extraction + context priority + co-occurrence), NOT on the January work-group engine.
- The January `work_classifier` (axis = work groups: zemní práce / beton / výztuž / kotvení …) is a **different axis** and is **out of scope — do not touch it.**
- The **only** thing reused from January is the **data-format** of its rule schema (the include / exclude / boost / priority_over shape) as a place to **store** the element keyword & vocabulary lists. The matching **logic** is W3's, not January's.

Rationale (so the agent does not drift back toward A): element typing depends on the **head-noun and word order**. "obklad do dříku" is an *obklad*; "dřík obkladu" is a *dřík*. Same tokens, different head. A bag-of-words scorer cannot distinguish them. Head-noun is therefore an **algorithm**, not a lookup table — it must live as dedicated code (the W3 side already has it as a separate pure layer). January's schema only ever holds the **data lists**, never the head-noun decision.

---

## Mantra (read fully before ANY action)

Before writing a single line of code:

1. **Read the whole repo structure.** Locate: the W3 element classifier (Python/MCP side), the W3 name-normalizer that runs *before* it, the TS engine element-classifier in the calculator, the January work_classifier and its rule schema + YAML rules, the kb-generated layer and whatever consumes it, the existing element-type vocabulary (the ~22–24 types), and the existing confidence convention.
2. **Re-confirm the prior recon still matches the current code** (the prior session's mapping table). If anything moved or was refactored since, report the delta before proceeding.
3. **Read how the TS engine classifier currently matches** (presence-match vs scoring, priorities, bridge boost, the křídla composite-suppression, the early-exits) and how it differs from the W3 side (which has a head-noun normalizer the engine lacks).
4. **Read the January rule schema in full** (the include/exclude/boost/priority_over/corrections fields and the scoring weights) — this is the data-format being borrowed.
5. **Read the kb-generated path** end to end: what is committed, what generates it, whether the generator and YAML source actually exist in the repo.
6. Only then begin — and only after the interview below is answered.

Do not reinvent any of the above. If existing code does 70% of what a gate needs, extend it; do not write a parallel implementation.

---

## Pre-Implementation Interview (AskUserQuestion — ask, then wait)

1. **kb-path fork (blocking).** The prior recon found the kb generator and YAML source are missing from the repo (only the generated output is committed). For the element-classification rule-data, pick one: **(i)** commit a small scoped generator (single YAML source-of-truth → single generated data file, both committed) so the data has one source and does not drift; **(ii)** for this phase, drive everything from the YAML the Python side reads directly, and treat the engine's data file as a known, logged divergence to be reconciled post-Cemex. Which?
2. **Does the Cemex demo path use the TS engine's classification, or only the W3 (MCP) classification?** This decides whether the engine-side data file must be correct *now* or can lag.
3. **Where should the shared element-classification rule-data live** so that both the Python side and the TS engine can consume the same source (or the same committed artifact)?
4. **Where do the head-noun / context / co-occurrence rules currently live on the W3 side**, and is porting that logic to the engine acceptable, or should the engine call the W3 side instead? (This phase assumes the engine gains its own head-noun layer; confirm.)
5. **What is the existing "reject / not-my-domain" behavior**, if any — does the classifier already have a way to say "this is not a concrete element," or does it always pick one of the types?
6. **Where are the golden / fixture outputs for the cases that currently classify correctly** (so we can snapshot them before any change)?
7. **What is the existing confidence convention** for a classification result, and does a result already carry alternatives (ranked candidates)?
8. **What is the existing test layout** for the engine classifier (where RED tests for #63–#70 + dřík should land)?

Then present a gated plan and **STOP** for confirmation before any code.

---

## Context

There are **two jobs**, and the element job is implemented **twice**:

- **Job 1 — work-group grouping** (January `work_classifier`). Different axis. **Untouched.**
- **Job 2 — element typing** (dřík pilíře / opěra / mostovka …). Implemented in **two places**: the **W3 side** (Python/MCP) which is **correct** because it has a head-noun normalizer, and the **TS engine** (calculator/UI) which is **worse** because it has no head-noun layer and matches on any keyword anywhere.

Observed failures of the engine side (from the prior recon / SO-250 probe), the cases this phase must fix:
- "obklad … kotvený do dříku" → engine says *dřík* (caught "dříku" in a prepositional phrase). Correct: this is an **obklad**, and it is **not even a concrete structural element** → should be rejected, not forced into a type.
- "Trámy nosné konstrukce" (NK) → engine loses the head-noun. Correct: **mostovka** (bridge deck), because NK + nosná konstrukce + (often) předpjatý.
- "dřík zárubní zdi" → engine cannot tell a wall from a pier. Correct: **opěrná / zárubní zeď**, not a pier.

**Goal of 2b:** teach the engine to type elements as well as W3 — **not by hand-merging two code paths** (that duplication is exactly what caused the divergence) — but by putting W3's *knowledge* into **shared rule-data** (one source) and porting W3's *head-noun algorithm* into the engine. Then the UI gets correct typing, and later the MCP side can delegate typing to the engine without regression.

---

## Business Logic

### 1. Split the knowledge: DATA vs ALGORITHM

W3's correctness is two separable things:

- **DATA** (lists): word→type mappings, exclusion words, bridge-remap, bridge/wall vocabularies, status markers, tail markers, object-type aliases. These are tables. They go into **shared rule-data**, stored in the borrowed January schema shape (include / exclude / boost / priority_over). Both surfaces consume the same source.
- **ALGORITHM** (logic): head-noun extraction (priority chain + context branching), context resolution (object-type authoritative, else derive; wall-context beats bridge-context where applicable), modifier stripping, the bridge-upgrade gate. These are **not tables** — they are dedicated code. The W3 side already has them as a separate pure layer; the **engine must gain an equivalent layer.**

### 2. The signal ladder — honest confidence, not a perfect oracle

The classifier is NOT required to always guess right. It is required to be **right when confident and honestly unsure when ambiguous.** Use the strongest available signal and let the signal set the confidence:

1. **Catalog code present** (the position carries an OTSKP/ÚRS code the system recognizes) → type is deterministic → confidence 1.0. No doubt.
2. **No code, but a name + context** (section heading, object/SO type, neighbouring lines, material/exposure such as C35/45 XF2 + předpjatý) → head-noun + context → confidence per the existing ladder.
3. **Only a bare name, no context** → keyword match → and where it is genuinely ambiguous (e.g. dřík co-occurring with opěr), the result must be **low-confidence with ranked alternatives**, so the orchestrator can show a list and a human confirms.

The win condition is not "never wrong" — it is "confident ⇒ correct, ambiguous ⇒ asks." A confidently-wrong result is worse than an honestly-unsure one, because HITL never triggers on it and the error goes silent into rebar → price.

### 3. Reject / not-my-domain option

The classifier must be able to return **"this is not a concrete structural element"** (e.g. stone facing obklad, podkladní/výplňové prostý beton, stříkaný beton handled as its own simple case) instead of being forced to pick one of the concrete types. Forcing everything into the type vocabulary is a root cause of the false-match. A bare-string with no concrete-element head-noun → reject (or route to the simple/"other" handling), not a high-confidence type.

### 4. Generation carries provenance; only ingestion doubts

Two directions, different doubt models — bake this in:

- **Ingestion** (classifying an externally-authored smeta/výkaz): bare položky → classify-from-text → honest doubt + HITL is correct.
- **Generation** (the system builds the list from a TZ): the element type is **assigned at item creation, with its source**, using full context (section, object/SO, neighbouring lines). It must **not** be re-derived later from a bare string. The only legitimate doubt in generation is "the TZ is silent / does not name the element" → that is doubt about the *source* (→ mark missing / ask, per the TZ-silent rule), not doubt about a word.

Therefore: when context is available, classification must use it (not strip it and re-guess from the bare phrase). The dřík failure is precisely context being thrown away.

### 5. Multilingual structure from day one

Structure the rule-data so language is a **separate dimension**, even if only Czech is filled now:

- **Type-core** (the element-type ontology) is **language-neutral** — it is a concept, not a Czech word.
- **Dictionaries** (which words in cs / sk / … map to which type) are **per-language**.
- **Head-noun rules** are grammar-shaped and therefore **per-language family** (cs/sk close; others later).

Adding a future language = adding a dictionary (+ head-noun rules for it), **never** editing the type-core. Fill cs now; leave the slot for sk and beyond.

### 6. Fix the dřík/opěra bug ONCE, on the shared layer

The bug exists in two places with two root causes:
- **W3 side:** the head-noun normalizer's dřík branch returns a pier-canonical form without checking for a co-occurring opěr. → **algorithm** fix in the normalizer.
- **Engine side:** the type scoring lets the pier type out-score the opěra type, and an opěra-ish phrase is hard-wired into the pier type's keyword list. → a **data** fix (a suppression/exclusion rule) **plus removing** the hard-wired opěra phrase from the pier list.

Single shared rule (lives once in the rule-data, both surfaces consume): **head/body term + opěr present + pier term absent ⇒ opěra/úložný práh, not pier.** The W3 head-noun normalizer fix is W3-only (the engine has no normalizer until this phase ports one). After porting, the engine reaches the same outcome via the shared suppression rule + its new head-noun layer. **Do not hand-patch both normalizers in parallel** — land the shared data rule first, then the algorithm fixes.

### 7. KB-path (per interview answer)

Per the chosen option (i) or (ii). If (i): one YAML source-of-truth + a small scoped generator emit the committed data artifact the engine imports; the Python side reads the same YAML. If (ii): the YAML is the single source for now and the engine's data artifact is a logged, tracked divergence to reconcile post-Cemex. Full restoration of the general kb generator is **out of scope** (separate post-Cemex tail).

### 8. Golden migration gate (do this BEFORE porting data)

If unifying onto the borrowed schema changes the engine's (or W3's) matching paradigm in any case (e.g. ordered first-match → additive scoring), it can silently regress cases that currently work. So:
- Snapshot the **currently-correct** outputs first (the working controls: wall→wall, foundation-slab→slab, římsa→římsa, plus whatever the existing golden set has).
- Migrate the data.
- Re-run: outputs must be **identical or better**. Any regression of a currently-working case is a STOP signal — tune priority/order before committing, do not ship the regression.

---

## Domain Rules

- Head-noun beats keyword. The element type is decided by the **governing noun** of the name; a word inside a prepositional phrase ("do dříku", "kotvený do …") must not decide the type.
- "dřík" inside an opěrná / zárubní zeď context is a **wall**, not a pier.
- Stone/quarry **obklad** is not a concrete structural element → reject (or simple handling), never a concrete type.
- "NK / nosná konstrukce / předpjatý nosník" → **mostovka** (bridge deck), not a generic beam.
- Bridge upgrade applies only on **real bridge context**, not a bare SO-number.
- Catalog code, when recognized, is the **strongest** signal → confidence 1.0 and overrides name-based guessing.
- Confidence must reflect signal strength: a genuinely ambiguous case must produce a **low** confidence with **ranked alternatives**, never a high-confidence single answer.
- Czech construction terminology is canonical in any human-facing label; the type-core identifiers stay language-neutral.

---

## Gated execution (STOP between gates)

- **Gate 0 — Recon-confirm + golden baseline.** Confirm prior recon holds; snapshot currently-correct classifications. Resolve kb-path fork (interview Q1). **STOP** with the plan.
- **Gate 1 — Extract W3 DATA into shared rule-data** (January schema shape), Czech filled, language-dimension structured. No behavior change yet beyond sourcing. **STOP.**
- **Gate 2 — Port the head-noun + context + modifier-strip ALGORITHM into the engine** as a pre-classification layer (mirroring the W3 normalizer). **STOP.**
- **Gate 3 — Reject option + signal ladder** (code→1.0, name+context, bare→low+alternatives). **STOP.**
- **Gate 4 — dřík shared suppression rule + remove hard-wired opěra phrase + W3 normalizer branch fix.** **STOP.**
- **Gate 5 — RED tests green + golden gate passes.** #63–#70 and the dřík cases classify as W3; ambiguous cases return low confidence + alternatives; reject cases reject; golden controls unchanged or better.

---

## Acceptance Criteria

1. The element-classification **rule-data** exists as a single shared source (or single committed artifact + logged divergence per the chosen kb-path option), in the borrowed include/exclude/boost/priority_over shape; the **head-noun decision is NOT in this data** — it is code.
2. The engine has a **head-noun / context / modifier-strip layer** that runs before type selection, mirroring the W3 normalizer's behavior.
3. The rule-data is structured with a **language-neutral type-core** and **per-language dictionaries**; Czech is filled; adding a language would require only a new dictionary, not editing the core.
4. The classifier can return **"not a concrete element"** (reject) instead of forcing a type; stone obklad and prostý podkladní/výplňový beton are not typed as structural concrete elements.
5. **Signal ladder** in effect: recognized catalog code → confidence 1.0; name+context → ladder confidence; bare ambiguous name → **low confidence with ranked alternatives**.
6. The **dřík/opěra rule is fixed once** in shared data (suppression: head/body + opěr + no pier ⇒ opěra), the hard-wired opěra phrase is removed from the pier keyword list, and the W3 head-noun normalizer branch is corrected.
7. RED tests for SO-250 cases **#63–#70 and the dřík cases go green** — the engine classifies them as the W3 side does.
8. "obklad … do dříku" → reject / obklad-handling (NOT pier). "Trámy NK" → mostovka. "dřík zárubní zdi" → wall, not pier.
9. A **genuinely ambiguous** input returns confidence below the auto-accept threshold **with alternatives** (verified by an explicit test), not a confident single type.
10. **Golden gate passes:** the currently-correct controls (wall→wall, foundation-slab→slab, římsa→římsa, and the existing golden set) produce identical-or-better output after the data migration. No regression of any currently-working case.
11. The January `work_classifier` is **unchanged** (no edits, no imports rewired).
12. Tests run with **no live LLM / network / DB** (cached/mocked); CI deterministic.
13. Czech terminology in any human-facing label is correct; type-core identifiers remain language-neutral.
14. After each gate, a short report: what changed, what is next, which acceptance items are now covered.

---

## What Is NOT Included

- **MCP classify-delegation** (the MCP side delegating typing to the engine). Only after the engine proves parity. Separate task.
- **Position decomposition into sub-elements** and the **master-detail UI**. That is the next phase (see TASK_Phase_PositionDecomposition_SubElements_UI).
- **Fixing the January work_classifier.** Acknowledged as imperfect; different axis; deliberate non-goal here.
- **Restoring the general kb generator** for all knowledge tables (maturity, pressure, formwork, …). Post-Cemex tail.
- **Filling sk/de/other dictionaries.** Only the *structure* for them is in scope; only Czech is filled.
- **Pricing, takt planning, Monte Carlo, vision/DXF dimension extraction.** Out of scope.

---

## Naming Determination

All component, file, field, function, type, and rule-key names above are **descriptive of business intent only**. Determine real names from existing repo conventions:
- If the engine classifier, the W3 normalizer, and the rule-data already have established names and locations, extend those; do not create parallel ones.
- Match the existing confidence field names, the existing alternatives/candidates shape, and the existing test-fixture layout.
- Match the existing kb-generated artifact naming and the existing rule-schema field names when borrowing the January format.
- When in doubt, match the most recently merged classifier/engine code, and ask rather than guess.
