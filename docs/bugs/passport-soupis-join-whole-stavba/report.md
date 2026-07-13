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
