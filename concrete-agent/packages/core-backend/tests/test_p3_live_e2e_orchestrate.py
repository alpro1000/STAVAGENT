"""P3 — env-gated LIVE end-to-end seal for the document → quantified-elements path.

The offline goldens (P1 join, P2 recipe wiring) MOCK the engine + document tools.
This is the one test that exercises the REAL stack end-to-end through the live
`/orchestrate` endpoint: a real Postgres session store, the Portal-JWT principal,
the real document tools (`extract_tz_fields` + `parse_construction_budget`), the
P1+P2 join, and the live Monolit calculator.

It is OPT-IN and SKIPPED by default — it is NOT a CI gate. CI collects it (so it
stays import-clean and cannot silently rot) and reports it SKIPPED; the real run
is manual/staged per docs/specs/doc_to_quantified_elements/e2e_runbook.md.

Black-box by design: this test is a thin HTTP client. It builds NO app and
touches NO DB directly — the operator stands up the stack (Postgres + Monolit URL
+ a minted Portal JWT + a running server) per the runbook, then sets:

  STAGEGATING_LIVE_E2E=1
  STAGEGATING_E2E_ORCHESTRATE_URL=http://localhost:8000/api/v1/orchestrate
  STAGEGATING_E2E_JWT=<minted Portal JWT>
  STAGEGATING_E2E_SOUPIS_XLSX=<path to a real SO-202 soupis .xlsx>
  STAGEGATING_E2E_TZ_TXT=<path to the SO-202 TZ text>

and runs:  pytest tests/test_p3_live_e2e_orchestrate.py -v -s

It asserts the live path end-to-end: the DOCUMENT_ANALYSIS step really invoked the
document tools (P2 wiring fired against real parsers), the EXTRACTED elements drove
atomization (verified work items, with NO caller-supplied `elements`), and export
produced the deliverable.
"""

import base64
import os
from pathlib import Path
from uuid import uuid4

import pytest

# Skip at COLLECTION when the opt-in flag is unset — keeps CI green (SKIPPED, not
# errored) while still importing the module so import rot is caught.
pytestmark = pytest.mark.skipif(
    os.environ.get("STAGEGATING_LIVE_E2E") != "1",
    reason="live e2e is opt-in: set STAGEGATING_LIVE_E2E=1 (see e2e_runbook.md)",
)

_OBJECT = {
    "object_code": "SO-202",
    "object_name": "Most na sil. I/6 přes Lomnický potok",
    "charakteristika": "Trvalý dálniční most o třech polích.",
}


def _require_env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        pytest.skip(
            f"set {name} — see docs/specs/doc_to_quantified_elements/e2e_runbook.md"
        )
    return val


def _step(steps: list, state: str) -> dict:
    """Find the step record for `state`, or fail with the available states — a
    clear, actionable message instead of a bare StopIteration when the live
    pipeline did not reach the expected state."""
    found = next((s for s in steps if s.get("state") == state), None)
    if found is None:
        pytest.fail(f"{state} step not found; available: {[s.get('state') for s in steps]}")
    return found


def test_live_orchestrate_quantifies_from_documents():
    import httpx

    url = _require_env("STAGEGATING_E2E_ORCHESTRATE_URL")
    jwt_token = _require_env("STAGEGATING_E2E_JWT")
    soupis_path = Path(_require_env("STAGEGATING_E2E_SOUPIS_XLSX"))
    tz_path = Path(_require_env("STAGEGATING_E2E_TZ_TXT"))
    if not soupis_path.is_file() or not tz_path.is_file():
        pytest.skip(f"soupis/tz file not found: {soupis_path} / {tz_path}")

    options = {
        "target_output": "full",
        "object": dict(_OBJECT),
        # NO 'elements' — the quantities MUST come from the documents via the join.
        "documents": {
            "tz_text": tz_path.read_text(encoding="utf-8"),
            "soupis_file_base64": base64.b64encode(soupis_path.read_bytes()).decode("ascii"),
            "soupis_filename": soupis_path.name,
        },
    }
    headers = {"Authorization": f"Bearer {jwt_token}"}
    pid = str(uuid4())

    with httpx.Client(timeout=300.0) as client:
        # ── submit → the recipe runs DOCUMENT_ANALYSIS + WORK_ATOMIZATION, pauses
        r1 = client.post(url, headers=headers, json={"project_id": pid, "options": options})
        assert r1.status_code == 200, r1.text
        b1 = r1.json()

        # the document → join wiring fired LIVE against the real document tools
        da = _step(b1["steps"], "DOCUMENT_ANALYSIS")
        assert "extract_tz_fields" in da["tools_invoked"], da
        assert "parse_construction_budget" in da["tools_invoked"], da

        # the EXTRACTED + quantified elements drove atomization (no caller elements)
        atom = _step(b1["steps"], "WORK_ATOMIZATION")
        assert "create_work_breakdown" in atom["tools_invoked"], atom
        assert atom.get("work_items_verified", 0) > 0, atom

        assert b1["status"] == "paused_for_input", b1
        assert b1["workflow_state"] == "COMMIT_PENDING", b1

        # ── resume → export the rendered deliverable → completed
        r2 = client.post(url, headers=headers, json={
            "project_id": pid, "session_id": b1["session_id"], "confirmation_token": "ok",
        })
        assert r2.status_code == 200, r2.text
        b2 = r2.json()
        assert b2["status"] == "completed", b2
        assert b2["workflow_state"] == "EXPORTED", b2
        committed = _step(b2["steps"], "COMMITTED")
        assert "export_soupis" in committed["tools_invoked"], committed

        # Opportunistic (only if the response surfaces committed outputs): the
        # ingest quantification provenance reached the deliverable (pin A), live.
        outputs = committed.get("outputs") or {}
        if "quantification_summary" in outputs:
            assert isinstance(outputs["quantification_summary"].get("extracted"), int)
        for w in outputs.get("quantification_warnings") or []:
            assert w.get("origin") == "ingest:soupis_vs_geometry", w
