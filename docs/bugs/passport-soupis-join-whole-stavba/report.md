# Bug: soupis→passport join takes the WHOLE stavba, not the per-SO section

**Severity:** ⛔ CRITICAL (money path — SO-202 volumes inflated ×3.2 … ×20)
**Found:** 2026-07-13, live end-to-end run (Alexander) on real prod
**Surface:** `build_bridge_passport` (MCP tool 22) → `bridge_passport_assembler`
→ `map_soupis_to_elements` (`app/services/stage_gating/soupis_quantity_join.py`)

## How it was found (the live chain finally closed)

Variant B upload worked on live Cloud Run + Postgres: real 6.6 MB soupis
(`E_Soupis_praci_XC4_DI-014.xml`, AspeEsticon XC4, stavba «D6 Olšová Vrata –
Žalmanov») → `soupis-501b05bbf789bff64eea0791dc973c88`, `total_items: 3372`,
`format_detected: kros_xml`. Then `build_bridge_passport(soupis_ref, tz_text)`
produced a schema-valid passport with correct provenance / exposures /
pour-stages / heights — **but the quantities were wrong by multiples.**

## The defect, proven against the real XML

The soupis is the **whole construction: 125 distinct `<objekt>` (SO) sections,
3372 positions.** A BridgePassport is **per-SO** (`_meta.object.code = "SO 202"`).
The join ignores the SO entirely:

- `xc4_parser._iter_polozky` walks straight to every `<polozka>` and **discards
  the enclosing `<objekt><znacka>` (the SO code)**. Parsed items carry only
  `[code, description, quantity, unit, unit_price, total_price]` — no `object_code`.
- `map_soupis_to_elements` buckets **all 3372 items** by `element_type`, summing
  across every SO.

Numbers (code `422336`, the deck, verified in the source XML):

| scope | Σ m³ |
|---|---|
| SO 202 only (manual etalon) | **2 697.941** |
| whole stavba (flat parsed list) | 6 019.845 |
| **tool returned (deck)** | **8 561.045** — *more than the whole-stavba single code* → the keyword join also sums OTHER deck-classifying codes |

Live passport vs etalon:

| element | tool | etalon | error |
|---|---|---|---|
| superstructure_deck | 8 561.045 | 2 697.941 | ×3.2 |
| foundations_piers | 10 706.326 | 518.4 | ×20.6 |
| pier_shafts | 1 945.41 | 361.384 | ×5.4 |
| rims | 638.473 | 266.328 | ×2.4 |
| abutments | — (none joined) | 557.851 | missing |

Worse: `pier_shafts` was fed `96616 odvoz na skládku zajištěné` — **waste
disposal to landfill**, matched as reinforced concrete by fuzzy description.

## Two independent bugs (SO-filter separates them cleanly)

Simulating a **SO-202-filtered** join with the real classifier:

| element | SO-filter alone | etalon | needs |
|---|---|---|---|
| mostovkova_deska | **2 697.941** (422336) | 2 697.941 | ✅ SO-filter only |
| rimsa | **266.328** (317325) | 266.328 | ✅ SO-filter only |
| driky_piliru | 87.040 (451314 ← wrong) | 361.384 (334326) | code-based match |
| abutments | missing (333325 not typed) | 557.851 | code-based match |

- **⛔ Bug 1 — no SO filter.** The money-catastrophe. SO-filter alone recovers
  deck + rims EXACTLY and removes the ×3–20 inflation.
- **⛔ Bug 2 — classification by fuzzy description, not OTSKP code.** Even within
  SO 202: `451314` (podkladní-family) wrongly enters `driky_piliru`; the real
  `334326` (dříky) / `333325` (opěry) aren't typed as structural.

## Why the golden didn't catch it

The `build_bridge_passport` golden fixture is a **single-SO** soupis. The real
soupis is the whole stavba. Regression MUST use a **multi-SO** fixture.

## Fix plan (two increments)

1. **SO filter** — `xc4_parser` retains `object_code` per position (nearest
   ancestor `<objekt><znacka>`); `_normalize_items` carries it; the join filters
   to the passport's SO before bucketing; the assembler threads
   `_meta.object.code`. Recovers deck + rims exactly.
2. **Code-based classification** — OTSKP code → element_type as the primary join
   signal (`334326→driky_piliru`, `333325→opery_ulozne_prahy`, garbage codes like
   `96616` → not element-bound). Recovers pier_shafts + abutments. Own tests +
   Monolit parity.
3. **Multi-SO golden** fixture guarding both.

## Acceptance (re-run same live test)

deck **2 697.941** · rims **266.328** · abutments **557.851** · pier_shafts
**361.384** — no cross-SO bleed, no garbage-code joins.

Live `soupis_ref` (24 h TTL): `soupis-501b05bbf789bff64eea0791dc973c88`.

---

## Increment 1 — SHIPPED (PR #1503, merged, live-confirmed on prod)

SO filter. deck 2697.941 + rims 266.328 exact on prod; ×3–20 inflation gone.

## Increment 2 — resolved as `<nazev>`, NOT a code→type map

Investigation (all proven on the real XML) reframed «bug 2 = code-based matching»:
- Monolit `OTSKP_RULES` (element-classifier.ts:605) match the item **name**, not the
  numeric code. Rule `/mostní pilíře.*stativ/ → driky_piliru` already exists.
- The real OTSKP name is in the XML — `<nazev>` («MOSTNÍ PILÍŘE A STATIVA…»). The
  failing lines carry `<popis>`=«vč. nátěru ALP+2x ALN…» — a project sub-note with
  NO element noun. The parser preferred `<popis>` over `<nazev>`.

So the fix is NOT a code→type map (no parallel structure with the classifier): the
parser exposes `catalog_name` = `<nazev>`, and the join classifies on
`catalog_name or description`. The name-based classifier (Python + Monolit already
agree) then types 334326/333325 correctly and stops trapping 451314 («…pod základy
pilířů») into driky. Verified on the real file: **all four exact** (deck 2697.941,
rims 266.328, pier_shafts 361.384, abutments 557.851).

## Increment 2.5 — STALE HANDLE (found live during #1503 re-run) — FIXED

A `soupis_ref` stores `parsed_budget` (parser OUTPUT), not the raw XML. A handle
created BEFORE a parser deploy therefore silently serves old-parser data (no
`object_code`/`catalog_name`) for 24 h → old (wrong) numbers with no signal.
Proven: same ref after #1503 → deck 8561; fresh upload of the same file → 2697.941.

Fix (shipped with increment 2.5 PR): `PARSE_VERSION` in `app/mcp/tools/budget.py`
(single source, bumped with the item contract; history 1=base, 2=+object_code,
3=+catalog_name) is stamped on the handle at save (migration 015, nullable —
pre-versioning rows = stale by definition). `resolve()` compares AFTER the
owner-scoped SQL (a cross-owner stale handle still reads not-found — no existence
leak) and returns `{"stale": True}` withOUT the payload; the tool maps it to typed
`soupis_ref_stale: re-upload required`. Never a silent old result.

## Increment 3 — passport-path join semantics (live re-run after #1504: 3/5, ~20 % concrete lost)

Live prod after #1504: deck/rims/pier_shafts exact, but abutments lost, prostý
beton poisoned foundations, přechodové desky + podkladní beton dropped entirely
(4 205 of 5 248 m³ counted). All three verified against code + the real file:

- **A — abutments 557.851 lost.** NOT the classifier (composite «MOSTNÍ OPĚRY A
  KŘÍDLA» → opery_ulozne_prahy, conf 0.9 — composite suppression works). Root =
  the join's never-split AMBIGUITY rule: the real TZ names Opěry + Úložné prahy +
  Křídla (deferred bug #5 prahy family) → several TZ elements of one etype → the
  bucket assigned to NO ONE. Proven: without the fix all three read
  ambiguous/missing. Fix: `collapse_same_type` (assembler opts in) — same-type
  elements merge into ONE passport key downstream anyway, so the bucket is
  assigned exactly once (to the carrier), siblings collapse.
- **B — prostý beton into ŽB.** «PATKY Z PROSTÉHO BETONU» (12.733) name-classifies
  as zaklady → poisoned foundations. Fix: `_PROSTY_BETON_RE` guard on the join
  axis only (shared classifier untouched, no W3 risk) reroutes unreinforced-
  concrete lines to podkladni_beton — per the passport map's own `plain_footings`
  doctrine («Prostý beton — computed as podkladni_beton»).
- **C — soupis-only buckets dropped.** TZ prose rarely narrates přechodové desky /
  podkladní beton → their buckets had no TZ element → silently dropped. Fix:
  `emit_soupis_only` (assembler opts in) — orphan buckets become synthetic
  quantity-carrying elements (named by the line that classified them; no invented
  concrete_class).
- **D — NOT a bug (data limit):** 272325 = 867.136 = ALL SO-202 foundations in ONE
  soupis position. No fabricated split — lands whole in foundations_piers with the
  soupis line cited in `source`.

**REGRESSION CAUGHT BY ALEXANDER before ship (the third live-method catch):**
the first cut of increment 3 mislabeled 45152 «PODKLADNÍ A VÝPLŇOVÉ VRSTVY
Z KAMENIVA DRCENÉHO» (CRUSHED STONE, 144.69 m³) a "bonus find" and let it into
blinding_concrete — the name shares the «PODKLADNÍ A VÝPLŇOVÉ VRSTVY» prefix
with the C12/15 concrete lines; 465512 «DLAŽBY Z LOMOVÉHO KAMENE» is the same
trap class. A concrete element computed from gravel fabricates betonáž / curing
/ formwork / pump work that physically does not exist, and emit_soupis_only
AMPLIFIES the class (no TZ corroboration gate). Fixed in the same increment:

- **negative material guard** (every path): a line naming a non-concrete
  material (kamenivo / štěrk / drcené / dlažby / lomový kámen / zemina / asfalt
  / geotextilie) with NO concrete signal is never element-bound;
- **positive concrete-signal requirement on the ORPHAN path**: a soupis-only
  bucket is emitted only if ≥1 line carries an explicit concrete signal
  (beton / železobet / BET / C-grade / B-grade). TZ-joined buckets keep the
  negative guard only — a strict positive there would drop legit short names
  («Nosná konstrukce mostovka», pinned by test) into a false NEPOČÍTÁNO.

Final verification on the real file with a PROD-REPRODUCING TZ (multi-opery
elements, no podkladní/přechodová): deck 2697.941 · rims 266.328 · pier_shafts
361.384 · abutments 557.851 · foundations 867.136 (12.733 OUT) ·
transition_slabs 81.9 · blinding_concrete **415.825** (403.092 + patky 12.733;
kamenivo 144.69 and dlažby 188.815 OUT). No other keys emitted.
**Σ 5 248.365 m³ — exactly the manual SO-202 concrete inventory.** Goldens:
45152 + 465512 stay out of blinding; signal-less orphan not emitted;
signal-carrying orphan emitted; TZ-joined short name still joins.

### Increment 3, round 2 — Alexander's data refutation accepted (positive guard on catalog_name)

The "deviation" (positive guard only on the orphan path) was refuted with data:
ALL 8 real SO-202 concrete positions carry a concrete signal in <nazev>
(ŽELEZOBETONU / ŽELEZOVÉHO BETONU / PŘEDPJ BET / PROSTÉHO BETONU) — OTSKP names
are standardized and always name the material; the counterexample («Nosná
konstrukce mostovka») was a line WITHOUT catalog_name. And the blacklist is
provably incomplete: 3272A7 «ZDI OPĚR…Z GABIONŮ» (283.47 m³, contains «OPĚR» —
one classifier change from abutments), 014101 «POPLATKY ZA SKLÁDKU» (4 639 m³ of
landfill FEES in m³).

Final rule shipped: **positive concrete-signal guard on every m³ line that
carries an OTSKP catalog_name**; lines without catalog_name (non-OTSKP formats)
degrade to the negative guard; mass/length lines exempt («B500B» is a STEEL
grade — no beton word by design). Goldens: gabiony (with a classifier stub that
DOES type them opery — the guard is structural, not luck) + poplatky + steel
exemption.

**Bonus real-file find (mass axis, same class as increment 2):** all four real
tonne lines («VÝZTUŽ … Z OCELI 10505, B500B») carry an EMPTY <popis> — the
P1-era `if not desc: continue` silently dropped every rebar/prestress line of
the real soupis (never seen: hermetic tests always set description). Fixed:
line text = catalog_name-first; `_mass_kind` reads it; evidence falls back to
the nazev. Recovered on the real file: deck prestress 82 840 kg · pier_shafts
rebar 62 577 kg · transition_slabs rebar 12 348 kg.

**NEW FINDING — deck rebar 468 886 kg still orphaned (separate increment):**
«VÝZTUŽ MOSTNÍ TRÁMOVÉ KONSTRUKCE» (no «NOSNÉ») classifies as **pricinik**
(příčník) — no passport key → mass orphaned. This is a SHARED-classifier vocab
imprecision (the 422xxx family is the NK; the NK-beats-trám normalizer keys on
«nosn», absent here). Fixing it touches W3-parity vocab → its own gated
increment per the monolith-classification discipline, NOT smuggled into this PR.

Final real-file state: all 7 volume keys exact (Σ 5 248.365 = manual inventory)
· masses: pier 62 577 + transition 12 348 + deck prestress 82 840 joined; deck
passive rebar pending the classifier increment.

### Increment 3, round 3 — Alexander's mass audit (full 7-line table) + t-axis guard

Answer to «where are 272365 / 317365 / 333365»: **two of three joined and were
simply unreported** (my reporting fault) — the third is a REAL fourth hole:

| line | etalon kg | status |
|---|---|---|
| 272365 VÝZTUŽ ZÁKLADŮ | 129 877 | ✅ joined (via the orphan foundations bucket) |
| 317365 VÝZTUŽ ŘÍMS | 30 074 | ✅ joined |
| 333365 VÝZTUŽ OPĚR A KŘÍDEL | 64 164 | ❌ **classifier → jine (0.3)** |
| 334365 VÝZTUŽ PILÍŘŮ | 62 577 | ✅ joined |
| 420365 VÝZTUŽ PŘECH. DESEK | 12 348 | ✅ joined |
| 42237 PŘEDPÍNACÍ | 82 840 | ✅ joined (prestress) |
| 422365 VÝZTUŽ TRÁM. KONSTR | 468 886 | ❌ classifier → pricinik |

**333365 root:** «VÝZTUŽ MOSTNÍCH **OPĚR** A **KŘÍDEL**» is GENITIVE — the v4.34
genitive-opěr suppression (built so «základy opěr» doesn't type as opěra) kills
it → jine. The nominative volume twin «MOSTNÍ OPĚRY A KŘÍDLA» types 0.9. Same
axis as 422365 (shared-classifier vocab, W3-parity) → **both go to increment 4**:
deck rebar 468 886 (trám-vs-NK) + abutment rebar 64 164 (genitive on VÝZTUŽ
lines). Pending masses: 533 t of 851 t — calculate_from_passport correctly held
until increment 4.

**t-axis watch-point closed:** the negative guard sits AFTER the mass kind-gate
and BEFORE classify → it applies to t/kg lines. For 015760 «POPLATKY … Z
IZOLACÍ» protection is double (kind-gate doesn't match; `izolac` added to the
blacklist). Golden: «GEOTEXTILIE VÝZTUŽNÁ» in tonnes (rebar kind-gate matches
`vyztuz` as a substring!) is killed by the material guard even under a greedy
classifier.
