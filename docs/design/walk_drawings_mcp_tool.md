# walk_drawings — MCP tool design (Part B, Pattern 40 host-delegated vision)

**Status:** prototype gate built (`test-data/RD_Jachymov_dum/tools/walk_drawings_gate.py`);
MCP server wiring = next implementation step.
**Purpose:** the vision fallback for what DXF-First (Pattern 49) cannot give — the
**hidden logic** Alexander reasons by hand (patky = 2 rows; S01 vynos beyond the
wall; wall face = obvod × řez height). DXF runs first (conf 1.0); walk_drawings
fills only the flagged-ambiguous remainder.

---

## Flow (Pattern 40 — host does vision, MCP validates)

```
1. MCP instructs the host (ChatGPT/Claude/Gemini vision):
   "Walk EVERY drawing as a rozpočtář. Per element: název / rozměry / skladba /
    how it is measured. Reason out loud. Where unsure say 'OVĚŘIT' — never invent."

2. Host vision walks + reasons (Alexander's style):
   "Stěna S03a: 14 řad tvárnic × 250 = 3.5 m, řada s patkami = 2 řady,
    3 strany trapézu 17.84 m ..."

3. Host submits each element via submit_element schema.

4. MCP runs the DETERMINISTIC validation gate (walk_drawings_gate.validate_element):
   - reject if no _source (ungrounded)
   - cross-ref DXF (Pattern 49 takeoff): area / count match?
   - cross-ref TZ: keyword present?
   - assign confidence per ladder
   - conf < 0.85 -> OVĚŘIT flag (like Alexander "neznám výšku dveří")
```

## submit_element schema (host must fill)

```jsonc
{
  "type": "string",            // element name (Czech)
  "reasoning": "string",       // out-loud derivation (mandatory — forces grounding)
  "_source": "string",         // REQUIRED — řez/výkres/TZ ref; empty -> REJECTED
  "area_m2": "number|null",
  "count": "integer|null",
  "length_m": "number|null",
  "dimensions": { }            // optional raw dims
}
```

## Confidence ladder (gate output)

| Grounding | verdict | conf |
|---|---|---|
| vision + DXF + TZ | VERIFIED | 0.95 |
| vision + DXF | VERIFIED | 0.90 |
| vision + TZ | TZ_GROUNDED | 0.85 |
| vision alone | VISION_ONLY_OVERIT | 0.60 + OVĚŘIT |
| no `_source` | **REJECTED_UNGROUNDED** | 0.00 |

Validated on the real hidden-logic gaps (demo in the gate module):
`sklad podlaha 17.6` → VERIFIED 0.95 (DXF room 0.01=17.56 + TZ); `výška dveří` with
no `_source` → REJECTED.

## P40 enforcement mechanisms (4)

1. **schema** — `submit_element` requires `{type, reasoning, _source}`; missing → rejected.
2. **description** — "read the drawing as an image, reason like a rozpočtář".
3. **validation gate** — `validate_element` rejects ungrounded; this module.
4. **cross-ref** — DXF (Pattern 49) + TZ deterministically check every vision claim.

## Known refinements (before MCP wiring)

- **Type-aware cross-ref** — current gate matches DXF by area/count number only;
  an unrelated room can false-match by area coincidence (demo: S01 vynos 6.0 ↔ room
  2.02=5.9). Production must match within the element's type/region, not bare number.
- **Region scoping** — pass the active view/room context so the gate checks against
  the right DXF subset (ties into A2 view separation).
- **MCP server** — expose as `walk_drawings` tool in `concrete-agent/app/mcp/tools/`
  alongside the existing 9 tools; host-delegation prompt + `submit_element` endpoint.

## Relation to the 3 automation levels (Část D)

walk_drawings is the **Level 1→2 vision fallback** — it does NOT replace DXF
(Level 1 determinism) nor reach IFC/BIM self-describing objects (Level 3); it
captures the reasoning layer between them, grounded and confidence-scored.
