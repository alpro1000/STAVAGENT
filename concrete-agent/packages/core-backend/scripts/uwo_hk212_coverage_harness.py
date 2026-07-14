#!/usr/bin/env python3
"""UWO Gate-3 coverage harness — HK212 corpus vs vocabulary (axis A).

Mechanics per the Gate-3 GO (Alexander, 2026-07-14): coverage is judged by a
HAND-CURATED verdict map (scripts/uwo_hk212_verdicts.yaml), NEVER by keyword
matching — seed keywords are uncalibrated and token overlap yields both false
gaps and false hits (the `{patek}` case). The keyword matcher is calibrated BY
this corpus later; it is not its own judge.

The deliverable is the per-item verdict TABLE (and the aggregated v1.3
candidate list), not a green percentage. Gaps are findings, not failures:
the exit code is nonzero only on CONSISTENCY errors (unmapped items, stale
verdicts, exact codes missing from the vocabulary, proposed codes that
already exist — i.e. a stale map after a v1.3 data-fix).

Usage (repo root or core-backend):
    python3 scripts/uwo_hk212_coverage_harness.py \
        [--corpus test-data/.../hk212_sequential_list.json] \
        [--out docs/audits/uwo_vocabulary/YYYY-MM-DD_hk212_coverage.md]
"""

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

import yaml

_HERE = Path(__file__).resolve().parent          # core-backend/scripts/
_CORE = _HERE.parent                             # core-backend/
_REPO = _CORE.parent.parent.parent               # STAVAGENT/
sys.path.insert(0, str(_CORE))

from app.services.uwo_vocabulary import load_vocabulary  # noqa: E402

DEFAULT_CORPUS = _REPO / "test-data/hk212_hala/outputs/sequential_list/hk212_sequential_list.json"
DEFAULT_VERDICTS = _HERE / "uwo_hk212_verdicts.yaml"
VERDICT_ORDER = [
    "exact_code", "needs_keyword", "needs_new_code",
    "needs_decomposition", "not_work", "not_covered_ok",
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS)
    ap.add_argument("--verdicts", type=Path, default=DEFAULT_VERDICTS)
    ap.add_argument("--out", type=Path, default=None, help="markdown report path")
    args = ap.parse_args()

    corpus_raw = json.loads(args.corpus.read_text(encoding="utf-8"))
    items = corpus_raw if isinstance(corpus_raw, list) else corpus_raw.get("items") or []
    by_id = {i["id"]: i for i in items}

    verdicts = yaml.safe_load(args.verdicts.read_text(encoding="utf-8"))["verdicts"]
    vocab = load_vocabulary()
    codes = vocab["codes"]

    errors: list[str] = []

    # ── Consistency: bijection corpus ↔ verdict map ──────────────────────────
    unmapped = sorted(set(by_id) - set(verdicts))
    stale = sorted(set(verdicts) - set(by_id))
    for i in unmapped:
        errors.append(f"UNMAPPED corpus item: {i} — add a verdict")
    for i in stale:
        errors.append(f"STALE verdict: {i} not in corpus")

    # ── Per-verdict validation ───────────────────────────────────────────────
    rows: list[tuple[str, str, str, str, str]] = []  # id, verdict, code, popis, note
    proposals: dict[str, list[str]] = defaultdict(list)  # proposed code → item ids
    for iid in sorted(set(by_id) & set(verdicts)):
        v = verdicts[iid]
        verdict, code, note = v["verdict"], v.get("code", ""), v.get("note", "")
        if verdict not in VERDICT_ORDER:
            errors.append(f"{iid}: unknown verdict {verdict!r}")
            continue
        if verdict in ("exact_code", "needs_keyword"):
            entry = codes.get(code)
            if entry is None:
                errors.append(f"{iid}: verdict {verdict} but code {code} NOT in vocabulary")
            # domain declared is implied: loader validates domain membership
        elif verdict == "needs_new_code":
            if not code:
                errors.append(f"{iid}: needs_new_code without a proposed code")
            elif code in codes:
                errors.append(
                    f"{iid}: proposed {code} ALREADY exists — stale map, flip verdict to exact_code"
                )
            else:
                proposals[code].append(iid)
        popis = (by_id[iid].get("popis") or "").replace("\n", " ")[:80]
        rows.append((iid, verdict, code, popis, note))

    counts = Counter(v["verdict"] for v in verdicts.values())
    total = sum(counts.values())
    new_domains = sorted(
        {c.split(".", 1)[0] for c in proposals} - set(vocab["domains"])
    )

    # ── Report ───────────────────────────────────────────────────────────────
    lines = [
        "# UWO Gate-3 — HK212 coverage verdict table",
        "",
        f"**Corpus:** `{args.corpus.name}` — **{len(by_id)} items** "
        "(244, not the historical 138 — full sequential list; ~43 % MEP tail).",
        f"**Vocabulary:** {vocab['version']} ({len(codes)} codes).",
        "**Mechanics:** hand-curated verdict map (no keyword matching) → "
        "harness validates code-exists + domain-declared.",
        "",
        "## Summary",
        "",
        "| Verdict | Count | Share |",
        "|---|---:|---:|",
    ]
    for vd in VERDICT_ORDER:
        n = counts.get(vd, 0)
        lines.append(f"| {vd} | {n} | {n * 100 // max(total, 1)} % |")
    lines += [
        f"| **total** | **{total}** | |",
        "",
        "> `needs_decomposition` = consolidated pack per **SPEC document-to-worklist §4 (Stage 2 —",
        "> Decomposition on demand)**: the item is a bundle of atoms (výkop+potrubí+zásyp) and must",
        "> be split with parent-ref + rationale + inherited sources — it is NOT a vocabulary gap.",
        "> These rows are the first live confirmation that Stage 2 exists for real corpora, not",
        "> theoretically.",
        "",
    ]

    lines += ["## v1.3 candidates (proposed codes, aggregated)", ""]
    lines += ["| Proposed code | Hits | Items |", "|---|---:|---|"]
    for code, ids in sorted(proposals.items(), key=lambda kv: -len(kv[1])):
        lines.append(f"| `{code}` | {len(ids)} | {', '.join(ids)} |")
    if new_domains:
        lines += ["", f"**New domains proposed:** {', '.join(new_domains)}"]

    lines += ["", "## Per-item verdicts", "",
              "| id | verdict | code | popis | note |", "|---|---|---|---|---|"]
    for iid, verdict, code, popis, note in rows:
        lines.append(f"| {iid} | {verdict} | `{code}` | {popis} | {note} |")

    if errors:
        lines += ["", "## CONSISTENCY ERRORS", ""] + [f"- {e}" for e in errors]

    report = "\n".join(lines) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(report, encoding="utf-8")
        print(f"report → {args.out}")

    print(f"corpus={len(by_id)} verdicts={total} "
          + " ".join(f"{k}={counts.get(k,0)}" for k in VERDICT_ORDER))
    print(f"proposed codes={len(proposals)} new domains={new_domains or '—'}")
    if errors:
        print(f"\n{len(errors)} CONSISTENCY ERRORS:")
        for e in errors:
            print(" -", e)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
