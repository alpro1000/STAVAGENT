# MCP `calculate_concrete_works` ↔ Monolit-Planner boundary

**Datum:** 2026-05-21
**Source files read:**
- `concrete-agent/packages/core-backend/app/mcp/tools/calculator.py` (1040 lines)
- `Monolit-Planner/shared/src/calculators/maturity.ts` (637 lines)
- `Monolit-Planner/shared/src/calculators/planner-orchestrator.ts` (relevant sections)

**Scope:** Q7 of říms Phase A audit — settle the architectural question "does the MCP tool re-implement scheduling logic, or does it HTTP-call the Monolit-Planner backend?"

---

## TL;DR

**The MCP tool is a soft-fallback wrapper.** On every call it first POSTs to `MONOLIT_API_URL/api/calculate` and returns whatever the TypeScript 7-engine pipeline says. If the Monolit-Planner API is unavailable (network error, 5xx, timeout 10 s), it falls back to a **deliberately simplified Python calc** that lives in `calculator.py` itself.

This is not a duplicated business-logic surface — it's a **degraded mode**. The Python fallback ships its own (smaller, less precise) constants tables and is documented as "Simplified estimate. For detailed calculation use Monolit Planner at kalkulator.stavagent.cz" (line 727).

```
MCP client (Claude.ai / ChatGPT / API consumer)
   │
   ▼
calculate_concrete_works(...) ─────────► _try_monolit_api()
   │                                          │
   │                                          ▼
   │                              POST {MONOLIT_API_URL}/api/calculate
   │                              (with formwork overrides forwarded)
   │                                          │
   │                                          ▼
   │                              ┌─── 200 OK ──┐
   │                              │             │
   │                              ▼             ▼
   │              data["source"] = "monolit_planner_api"
   │                              │             │
   │                              └─── return ──┘
   │
   ▼
(API unavailable / timeout / non-200)
   │
   ▼
Local simplified calc in calculator.py:
   • _validate_formwork_override (catalog allow-list)
   • _calculate_tacts
   • _lateral_pressure
   • _select_formwork
   • CURING_DAYS_TABLE (3 classes × 4 temp bands, Python-only)
   • _estimate_days (formwork + rebar + concrete + curing)
   ↓
data["source"] = "mcp_simplified"
```

---

## Where the boundary actually sits

| Concern | TS engine (Monolit `/api/calculate`) | Python fallback (`calculator.py`) |
|---|---|---|
| 7-engine pipeline (formwork selector, lateral pressure, props, rebar-lite, maturity, pour-decision/task, scheduler) | ✅ Canonical | ❌ Replaced by `_estimate_days` (4-line approximation) |
| Per-tact independence (`per_tact_concrete_days[]`, `tact_volumes`) | ✅ Supported | ❌ Uniform durations × `num_tacts` |
| MSS shortcut (`pour_role='mss_integrated'`) | ✅ Supported | ❌ Not present |
| Pile early branch (`runPilePath`) | ✅ Supported | ⚪ Partial (pile pressure skipped, no productivity table) |
| Curing class table (TKP18 §7.8.3) | ✅ TS `CURING_DAYS_TABLE` (5 temp × 3 concrete groups × 3 classes) | ⚪ Python `CURING_DAYS_TABLE` (4 temp × 3 classes, **no concrete-group axis**) |
| Element catalog (ELEMENT_CATALOG, 23 types) | ✅ Canonical | ⚪ `ELEMENT_TYPES` mirror in `classifier.py` (subset) |
| Formwork catalog (29 systems) | ✅ Canonical | ⚪ `KNOWN_FORMWORK_SYSTEMS` mirror (~15 entries) |
| T-bednění bm unit | ✅ Supported (engine knows pour_role) | ✅ Supported (line 575–578: `formwork_area_m2 = 0.0` when system unit is bm) |
| OTSKP/URS catalog lookup | Via separate tools (`find_otskp_code`, `find_urs_code`) — calls Core | Same |
| Lemon Squeezy billing / credit attribution | One credit per `calculate_concrete_works` call regardless of which branch fires | Same |

---

## Forwarded parameters (`_try_monolit_api` payload)

`calculator.py:740–797` constructs the HTTP payload:

```python
payload = {
    "element_type":   element_type,
    "concrete_m3":    volume_m3,           # ⚠️ MCP "volume_m3" → Monolit "concrete_m3"
    "concrete_class": concrete_class,
    "height_m":       height_m or 3.0,
    "width_m":        width_m or 0.3,
    "is_prestressed": is_prestressed,
}
# Optional, omitted when None (backward-compat with older Monolit):
if formwork_area_m2:           payload["formwork_area_m2"]       = …
if preferred_manufacturer:     payload["preferred_manufacturer"] = …
if formwork_system_name:       payload["formwork_system_name"]   = …
if rental_czk_override is not None: payload["rental_czk_override"] = …
if formwork_length_bm is not None:  payload["formwork_length_bm"]  = …
if cycle_length_bm is not None:     payload["cycle_length_bm"]     = …
```

**Parameters NOT forwarded** (MCP fallback path keeps them, TS path is asked to infer):
- `exposure_class`, `exposure_classes`
- `nk_subtype`, `span_m`, `num_spans`, `construction_technology`
- `temperature_c`, `curing_class`
- `num_bridges`
- `pile_diameter_mm`, `pile_count`, `pile_geology`

⇒ For říms specifically, **exposure_class and curing_class are dropped on the wire**. The TS engine then auto-derives them from `element_type` via `RECOMMENDED_EXPOSURE[rimsa] = ['XF4','XD3']` and `getDefaultCuringClass('rimsa') = 4`. The end result is correct *if* the user accepted the defaults, but a UI-side override of `exposure_class` would silently disappear when the request is routed through MCP. This is a **minor consistency hole**, not a blocker.

---

## Override warnings: cross-path consistency

`override_warnings` (formwork allow-list, manufacturer catalog) are computed up-front in `calculator.py:464–479` **before** the API call. When the API returns 200, the warnings are appended to the API's `warnings[]` (line 494–496). When the API fails, they end up in the fallback path's `warnings[]` (line 662). ⇒ override semantics are identical in both branches.

---

## Failure modes & timeouts

`httpx.AsyncClient(timeout=10.0)` — line 787. On timeout / exception:
```python
except Exception as e:
    logger.debug(f"[MCP/Calculator] Monolit API unavailable: {e}")
    return None
```
Silent fallback. The caller cannot tell from the response alone whether the TS engine ran or the Python fallback fired, **except by inspecting `result["source"]`** (`monolit_planner_api` vs `mcp_simplified`).

For Phase C debugging, the curing-class issue (see §A.7 closing addendum) is **only visible in the TS path** — Python fallback's table gives 9 d @ 15-25°C class 4 (matches task spec). TS path gives 5 d at the same input. The user-visible answer depends on whether MONOLIT_API_URL is reachable.

---

## Phase C implication

Per Q3 answer: **TS catalog wins** for this task; MCP HTTP delegates. That matches the current architecture — no MCP refactor needed in Phase C beyond:
1. **Forward `exposure_class` + `curing_class` in the HTTP payload** (minor consistency fix). Probably belongs in Phase F (MCP tool parameter additions), not Phase C.
2. **Resolve the Python ↔ TS `CURING_DAYS_TABLE` divergence** as a Phase C subtask (or earlier — it changes the result for ANY rimsa estimate where the fallback fires).
3. **No need to remove the Python fallback.** It serves a real role (graceful degradation when Monolit-Planner Cloud Run is cold or rolling-deploying). Just keep it labelled `source: mcp_simplified` and document the precision delta.

---

**Author:** Říms Phase A — Q7 boundary read closing.
