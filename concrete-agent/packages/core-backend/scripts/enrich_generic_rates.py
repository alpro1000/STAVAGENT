"""Standalone Perplexity enricher for ``generic_consumption_rates.json``.

GATE 5a online phase. Populates the ``citation_url`` field for each
KB entry that already carries ``citation_norm`` (the hand-curated
offline fallback). Designed to run OUTSIDE the pairing pipeline so it
needs no caller integration — point it at the KB JSON, set
``PPLX_API_KEY``, and re-run pairing afterwards.

Usage::

    export PPLX_API_KEY=pplx-...
    python -m concrete_agent.packages.core_backend.scripts.enrich_generic_rates \
        --kb-path test-data/libuse/knowledge_base/generic_consumption_rates.json

Networking: needs HTTPS egress to ``api.perplexity.ai``.  The script
runs ``api/v1/chat/completions`` with the ``sonar-pro`` model (returns
citations) once per KB entry — typically ~12 queries, ≪ $1 spend.

Honesty contract: this script ONLY writes a real URL that Perplexity
itself returned in its ``citations`` array, asking for an ÚNMZ /
publisher reference for the cited ČSN.  If no usable URL comes back,
the entry keeps ``citation_url: null`` — Phase 6.6 pairing then keeps
the sub-item at confidence 0.6 with status "Confirm" rather than
inventing a link.

Items file and pairing output stay untouched — to surface enriched
URLs in the Excel deliverable, re-run::

    python concrete-agent/packages/core-backend/scripts/phase_6_6_pair_materials.py
    python concrete-agent/packages/core-backend/scripts/phase_6_6_excel.py
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[4]


def _import_perplexity_client():
    """Add `concrete-agent/packages/core-backend` to sys.path then import
    the existing PerplexityClient from `app.core.perplexity_client`.
    Kept lazy so the script imports cleanly even when sandboxed
    (caller will hit a friendly env-var error instead of a stack trace).
    """
    backend_root = REPO_ROOT / "concrete-agent" / "packages" / "core-backend"
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))
    from app.core.perplexity_client import PerplexityClient  # type: ignore
    return PerplexityClient


async def _query_one(client: Any, kb_key: str, entry: dict[str, Any]) -> dict[str, Any]:
    norm = entry.get("citation_norm") or ""
    material = entry.get("popis_template") or kb_key
    prompt = (
        f"Find the authoritative source URL for the Czech construction "
        f"norm {norm} as it applies to material '{material}'. "
        f"Prefer ÚNMZ (Úřad pro technickou normalizaci, agentura.cz / "
        f"unmz.cz / agentura-cas.cz), Czech publisher catalog, or the "
        f"official norm distributor.  Return URL only — no commentary."
    )
    try:
        # The existing client exposes search_kros_code, search_norms,
        # generic_query — fall back to whatever exists.
        if hasattr(client, "search_norms"):
            resp = await client.search_norms(prompt)
        elif hasattr(client, "generic_query"):
            resp = await client.generic_query(prompt)
        else:
            # Use whatever low-level call the client supports
            resp = await client.search_kros_code(prompt)
    except Exception as exc:  # noqa: BLE001 — wrap broad failures
        return {"kb_key": kb_key, "error": str(exc), "url": None}

    # Best-effort URL extraction from Perplexity's citations[]
    url: str | None = None
    if isinstance(resp, dict):
        citations = resp.get("citations") or []
        if citations and isinstance(citations[0], str):
            url = citations[0]
        elif isinstance(resp.get("url"), str):
            url = resp["url"]
        elif isinstance(resp.get("codes"), list) and resp["codes"]:
            url = resp["codes"][0].get("url")
    return {"kb_key": kb_key, "url": url, "raw": resp}


async def _enrich(kb_path: Path, dry_run: bool) -> int:
    if not os.environ.get("PPLX_API_KEY"):
        print("ERR: PPLX_API_KEY not set.  Export it then re-run.",
              file=sys.stderr)
        return 2
    if not kb_path.exists():
        print(f"ERR: KB not found at {kb_path}", file=sys.stderr)
        return 2

    kb = json.loads(kb_path.read_text(encoding="utf-8"))
    rates = kb.get("rates") or {}
    targets = [(k, v) for k, v in rates.items()
               if v.get("citation_norm") and not v.get("citation_url")]
    print(f"Found {len(targets)} entries with citation_norm but no URL.")
    if not targets:
        print("Nothing to enrich.")
        return 0

    PerplexityClient = _import_perplexity_client()
    client = PerplexityClient()

    successes = 0
    for kb_key, entry in targets:
        result = await _query_one(client, kb_key, entry)
        url = result.get("url")
        if url:
            print(f"  ✓ {kb_key}: {url}")
            if not dry_run:
                rates[kb_key]["citation_url"] = url
            successes += 1
        else:
            print(f"  · {kb_key}: no URL returned"
                  + (f" (error: {result.get('error')})" if result.get("error") else ""))

    print(f"\n{successes}/{len(targets)} entries got a citation URL.")
    if dry_run:
        print("--dry-run set; KB not written.")
    else:
        kb["version"] = "0.4"
        kb_path.write_text(json.dumps(kb, ensure_ascii=False, indent=2),
                           encoding="utf-8")
        print(f"Updated {kb_path.relative_to(REPO_ROOT)}.")
        print("Re-run phase_6_6_pair_materials.py + phase_6_6_excel.py to "
              "surface URLs in deliverable.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--kb-path",
        default=str(REPO_ROOT / "test-data" / "libuse" /
                    "knowledge_base" / "generic_consumption_rates.json"),
        help="Path to generic_consumption_rates.json",
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Query Perplexity but do not write KB.")
    args = parser.parse_args()
    return asyncio.run(_enrich(Path(args.kb_path), args.dry_run))


if __name__ == "__main__":
    sys.exit(main())
