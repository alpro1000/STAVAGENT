# PROBE 9 Backlog (post-VELTON D delivery)

**Date opened:** 2026-05-10
**Source:** PROBE 9 Part 5A + Part 5B implementation findings
**Status:** All deferred — none blocks D delivery 2026-05-19

---

## Ticket #1 — VZT/chl DWG conversion fix

**Priority:** High (closes PROBE 9 confidence gap from 0.70 → 0.95
for 200 currently-heuristic items)
**Estimated effort:** 2–4 h trial + retry conversion + re-run Step 8c
**Trigger:** Post-VELTON D delivery, OR before A/B/C komplex pricing

### Problem

7 source DWG files fail LibreDWG dwg2dxf 0.13.4 conversion:

| File | Discipline | Error |
|---|---|---|
| `D_1NP_vzt.dwg` | VZT 1.NP | `Invalid group code "125.00\n" at line 53865` |
| `D_2NP_vzt.dwg` | VZT 2.NP | `Invalid group code "125.00\n" at line 54637` |
| `D_3NP_vzt.dwg` | VZT 3.NP | `Invalid group code at line 58069` |
| `1pp_VZT.dwg`   | VZT 1.PP | `Invalid group code "200.00\n" at line 531511` |
| `D_1NP_chl.dwg` | chlazení 1.NP | `Object handle not found 37748/0x9374 in 4711 objects` |
| `D_2NP_chl.dwg` | chlazení 2.NP | same |
| `D_3NP_chl.dwg` | chlazení 3.NP | same |

VZT bug = malformed group-code lines (decimal point + embedded newline).
chl bug = unresolved object handles (likely broken xref).

### Mitigation paths (try in order)

1. **ezdxf recover mode** — `doc = ezdxf.recover.read(path)` fault-tolerant
   parser. May handle the malformed group codes gracefully. Effort: 30 min.
2. **Teigha File Converter** (free, ODA-proprietary) — alternative DWG→DXF
   converter. Often handles edge cases LibreDWG misses. Effort: 1 h.
3. **ABMV email re-export request** — ABMV item #11 already opened.
   Request DWG AC1024 (AutoCAD 2010) format instead of current AC1027.
   Effort: hours-to-days lead time.

### Success criteria

- All 7 DWGs convert to DXF
- Step 8c extractor recovers VZT + chl prostupy directly from per-discipline
  files (replaces 200 Part 5B heuristic items with 0.95-confidence direct
  extractions)
- Re-run `python -m pi_0.tests.test_dxf_tzb` — 15/15 pass
- Re-run `probe_9_generate_items.py` — items_probe_9_tzb.json regenerated
  with confidence-uplift (Part 5B heuristic block disabled when direct
  extracts available)

---

## Ticket #2 — DN proximity widening (Step 8c follow-up)

**Priority:** Medium (improves item quality, doesn't block billing)
**Estimated effort:** 4–6 h
**Trigger:** Optional cleanup pass before next komplex project (Π.1 V1)

### Problem

`pi_0/extractors/dxf_tzb_prostupy.py` uses a 250 mm spatial proximity
threshold to match TEXT DN labels to nearby CIRCLE prostupy. Per audit
§3, DN labels in the source DXFs are placed along PIPE RUNS (not at
prostup positions), so most prostupy don't have an inline DN label
within 250 mm.

Current state: ~80 % of records have `dn_mm.value: null`,
`dn_mm.confidence: 0.0`. Counts (HSV-963 quantity) are correct;
DN-tier price differentiation is not auto-derivable.

### Proposed fix

Pipe-segment graph traversal:

1. For each prostup CIRCLE, find connected LWPOLYLINE on same layer
   (proximity to circle centroid < radius + tolerance).
2. Walk the polyline; for each TEXT/MTEXT on the same or sibling
   discipline layer within proximity to ANY polyline vertex, accept
   as DN label for the prostup at the polyline's other end.
3. If multiple DN candidates, take the one with highest spatial
   adjacency score (min euclidean to nearest vertex).

Estimated DN recovery: ~70 % of currently-null records (those with a
labeled pipe segment in the same drawing). Confidence: 0.75 (graph
traversal vs direct adjacency).

### Out of scope

- Cross-drawing DN propagation (e.g. DN labelled in 9421 jadra zoom
  applied to same physical pipe in D_2NP_kan) — too risky without
  coordinate-system normalization.

---

## Ticket #3 — 1.PP silnoproud special-case extractor

**Priority:** Low (only 3 silnoproud entries in 1.PP currently affected)
**Estimated effort:** 2 h
**Trigger:** Optional cleanup pass before Π.1 V1

### Problem

1.PP has NO standalone silnoproud DWG (verified in audit §7). 1.PP
silnoproud content lives embedded in `_100_9000` koord overlay on
`_silnoproud` layer (33 entities per audit). Current Step 8c
extractor catches it via `silnoproud_embedded` discipline tag, but
only finds 3 prostupy — the layer carries mostly LINE entities (cable
runs) without explicit prostup symbols.

### Proposed fix

Add explicit prostup detection for 1.PP silnoproud:

1. Detect LINE intersections with floor-slab polygon boundaries
   (already in `parse_dxf_full` rooms[] — slab outline = room polygon
   union).
2. Each intersection within 100 mm tolerance → emit prostup record.
3. Confidence: 0.75 (geometric inference, not explicit symbol).

Expected recovery: 5–10 additional 1.PP silnoproud prostupy.

---

## Ticket #4 — 9421 jadra _vodovod + _kanalizace overlap dedup

**Priority:** Low (data-quality refinement)
**Estimated effort:** 1 h
**Trigger:** Discovered during Part 5B; not affecting D delivery

### Problem

9421 jadra D 2.NP DXF carries `_vodovod` (24 CIRCLE) + `_kanalizace`
(7 CIRCLE) layers with content that OVERLAPS the per-discipline
`D_2NP_vod.dxf` + `D_2NP_kan.dxf`. Current Part 5A extractor walks
`D_2NP_vod.dxf` and `D_2NP_kan.dxf` directly; 9421 isn't sourced for
those disciplines (only VZT_partial recovery from 9421 is added in
Part 5B).

Risk: minor under-count if jadra zoom contains prostupy NOT in the
flat-floor per-discipline DWGs (corner cases). Mitigation:
spot-check 9421 byt-core CIRCLE positions vs D_2NP_vod CIRCLE positions
to validate full coverage. If mismatch found, add 9421 as secondary
source for vod + kan with deduplication by spatial proximity.

---

_Generated by Claude Code, PROBE 9 backlog, 2026-05-10._
