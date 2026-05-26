# MCP Calculator Boundary — payload contract + known gaps

**Initialized:** 2026-05-26 (Phase C G6)
**Status:** Active — describes the in-production MCP → Monolit contract
**Audit reference:** `docs/audits/rimsa_fullstack/2026-05-20_phase_a_discovery.md`

---

## Architecture

```
MCP client (Claude / ChatGPT / 3rd-party agent)
     │
     │  calculate_concrete_works(volume_m3, concrete_class, exposure_class?, curing_class?, …)
     ▼
concrete-agent/packages/core-backend/app/mcp/tools/calculator.py
     │
     │  HTTP POST /api/calculate
     │  Payload: { element_type, concrete_m3, concrete_class, height_m, width_m,
     │            is_prestressed, formwork_area_m2?, preferred_manufacturer?,
     │            formwork_system_name?, rental_czk_override?,
     │            formwork_length_bm?, cycle_length_bm? }
     ▼
Monolit-Planner backend /api/calculate → planElement() (TS shared engine)
     │
     ▼
Result → MCP client
```

---

## Known gaps (Phase A + Phase C findings)

### Gap 1 — `exposure_class` + `curing_class` silently dropped on wire (P2)

**Location:** `concrete-agent/packages/core-backend/app/mcp/tools/calculator.py:766-786`

**Symptom:** MCP `calculate_concrete_works` tool accepts `exposure_class`
and `curing_class` as input arguments, but the HTTP payload sent to
Monolit `/api/calculate` does NOT include either field. Effect:
- User invokes MCP tool with `exposure_class="XF4"` for a bridge deck
- MCP validates the input + records it for audit
- Payload to Monolit omits the field → Monolit picks defaults via
  `RECOMMENDED_EXPOSURE[element_type]` and `getDefaultCuringClass(element_type)`
- For rimsa @ 15°C: `RECOMMENDED_EXPOSURE['rimsa']=['XF4','XD3']` happens to
  produce a comparable XF4-grade result, so the bug is invisible to most
  users. For elements where the user override would differ from the default,
  the override is silently lost.

**Snippet (current state, all fields included EXCEPT exposure/curing):**

```python
payload: dict = {
    "element_type": element_type,
    "concrete_m3": volume_m3,
    "concrete_class": concrete_class,
    "height_m": height_m or 3.0,
    "width_m": width_m or 0.3,
    "is_prestressed": is_prestressed,
}
if formwork_area_m2:
    payload["formwork_area_m2"] = formwork_area_m2
if preferred_manufacturer:
    payload["preferred_manufacturer"] = preferred_manufacturer
if formwork_system_name:
    payload["formwork_system_name"] = formwork_system_name
if rental_czk_override is not None:
    payload["rental_czk_override"] = rental_czk_override
if formwork_length_bm is not None:
    payload["formwork_length_bm"] = formwork_length_bm
if cycle_length_bm is not None:
    payload["cycle_length_bm"] = cycle_length_bm
# ← exposure_class and curing_class never added
```

**Fix:**

```python
if exposure_class:
    payload["exposure_class"] = exposure_class
if curing_class is not None:
    payload["curing_class"] = curing_class
```

Plus matching field acceptance in Monolit `/api/calculate` route handler
(verify presence; may already accept via PlannerInput which has both fields).

**Priority:** **P2 post-CSC** (per Phase C G6 spec). Cemex CSC pre-demo
window opens 2026-06-21 (production safety freeze). Defer to post-demo
unless a customer report surfaces. Add a Vitest case that asserts
round-trip preservation when fix lands.

**Test design (when fix shipped):**
1. Spin MCP tool with `exposure_class="XF4"` + `curing_class=4` on a
   foundation-grade element (default would be XF1 + class 2)
2. Assert Monolit response curing_days reflects class 4 (e.g. 9d @ 15°C
   for C30+ post-G1 calibration)
3. Without fix: returns ~1.5d (class 2 default). With fix: returns 9d.

---

## Out-of-scope notes

- Whether `calculate_concrete_works` could be split into two MCP tools
  (one for quick estimate, one for full calibration) is product-level
  decision, not architecture.
- The MCP → Monolit contract uses `concrete_m3` while Monolit internal
  field is `volume_m3` (alias mapping in the route handler). This is
  inconsistent naming but not a functional bug; ticket separately if
  desired.
- The orchestrator `planner-orchestrator.ts:1652` curing-class threading
  was initially flagged in Phase A subagent output as a wiring bug but
  later REVISED by Phase A closing direct read (lines 1535–1576 confirmed
  threading is correct). The real bug was the TS table calibration
  mismatch (5d vs Python 9d at 15°C class 4); fixed by Phase C G1.

---

## Related

- Phase A audit §B.2 (curing-class wiring revisit)
- Phase A audit §B.4 (single source of truth verdict)
- `concrete-agent/CLAUDE.md` (MCP tool list)
- `backlog/calc_hardcoded_to_kb.md` (companion debt — engine-side hardcoded
  matrices)
