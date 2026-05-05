"""Phase 5 step 2 — TF-IDF fuzzy match starý VV ↔ nové items.

Filters starý VV to sheet '100 - Architektonicko-stavební' (finishing
scope only, 1423 items vs 2277 nové D-items).

Match score = weighted:
  popis_similarity (50 %)  — TF-IDF cosine on normalized popis
  MJ_match         (20 %)  — exact MJ match (1.0) else 0.0
  kapitola_match   (15 %)  — old section first-3-digits matches new
                              kapitola HSV-NNN/PSV-NNN (1.0) else 0.0
  volume_proximity (15 %)  — log-scale magnitude diff capped 1.0

Output: match_candidates.json
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

OUT_DIR = Path("test-data/libuse/outputs")
STARY = OUT_DIR / "stary_vv_normalized.json"
COMBINED = OUT_DIR / "items_objekt_D_complete.json"
OUT = OUT_DIR / "match_candidates.json"

# D-share assumption (4 equal objekty)
D_SHARE = 0.25
# Confident match threshold
SCORE_HIGH = 0.55
SCORE_LOW = 0.30
# Volume tolerance (% of komplex × D_share vs new D quantity)
VOL_TOLERANCE_PCT = 5.0


def normalize(s: str) -> str:
    if not s:
        return ""
    out = s.lower()
    out = re.sub(r"[^\w\sáčďéěíňóřšťúůýž]", " ", out)
    out = re.sub(r"\s+", " ", out).strip()
    return out


def normalize_mj(mj: str) -> str:
    if not mj:
        return ""
    s = mj.strip().lower()
    return {"m²": "m2", "m³": "m3", "kus": "ks", "soubor": "kpl", "soub": "kpl",
            "hod": "h", "bm": "m"}.get(s, s)


def kapitola_section_code(kap: str) -> str | None:
    """Extract NNN from 'HSV-622.1' / 'PSV-771' → '622' / '771'."""
    m = re.match(r"^[A-Z]{3}-(\d{2,3})", kap)
    return m.group(1) if m else None


def section_first_token(section: str) -> str | None:
    """'712 - Povlakové krytiny' → '712'."""
    if not section:
        return None
    m = re.match(r"^\s*(\d{2,3})", section)
    return m.group(1) if m else None


def volume_proximity(qty_old_d: float | None, qty_new: float | None) -> float:
    """Log-scale proximity: 1.0 if equal, 0 if 10× different."""
    if qty_old_d is None or qty_new is None or qty_old_d <= 0 or qty_new <= 0:
        return 0.0
    import math
    ratio = max(qty_old_d, qty_new) / min(qty_old_d, qty_new)
    if ratio <= 1.05:
        return 1.0
    return max(0.0, 1.0 - math.log10(ratio))


def main() -> None:
    print("Loading inputs…")
    stary = json.loads(STARY.read_text(encoding="utf-8"))
    combined = json.loads(COMBINED.read_text(encoding="utf-8"))
    new_items = combined["items"]

    # Filter starý to architektonicko-stavební (finishing scope only)
    old_items = [it for it in stary["items"] if "Architektonicko" in it["sheet"]]
    print(f"Starý VV (architektonicko): {len(old_items)} items")
    print(f"Nové D items: {len(new_items)}")

    # Pre-normalize popis on both sides
    new_popis = [normalize(it["popis"]) for it in new_items]
    old_popis = [it["popis_normalized"] for it in old_items]
    new_mj = [normalize_mj(it["MJ"]) for it in new_items]
    old_mj = [normalize_mj(it["MJ"]) for it in old_items]
    new_section = [kapitola_section_code(it["kapitola"]) for it in new_items]
    old_section = [section_first_token(it.get("section", "")) for it in old_items]
    new_qty = [it.get("mnozstvi") for it in new_items]
    old_qty = [it.get("mnozstvi") for it in old_items]

    # Build TF-IDF on union vocabulary
    print("Building TF-IDF matrix…")
    vec = TfidfVectorizer(min_df=1, ngram_range=(1, 2))
    vec.fit(new_popis + old_popis)
    new_tfidf = vec.transform(new_popis)
    old_tfidf = vec.transform(old_popis)

    print("Computing similarity matrix…")
    sim = cosine_similarity(old_tfidf, new_tfidf)  # shape (len_old, len_new)

    # For each old item, compute composite score for top candidates
    print("Selecting best matches…")
    candidates: list[dict] = []
    for i, old_it in enumerate(old_items):
        sims = sim[i]
        # Top-5 by popis similarity
        top_n = sims.argsort()[::-1][:5]
        alts = []
        for j in top_n:
            popis_sim = float(sims[j])
            mj_match = 1.0 if (old_mj[i] and new_mj[j] and old_mj[i] == new_mj[j]) else 0.0
            sec_match = 1.0 if (old_section[i] and new_section[j] and old_section[i] == new_section[j]) else 0.0
            # Old komplex × D_share for comparison vs new D qty
            old_qty_d = (old_qty[i] * D_SHARE) if old_qty[i] is not None else None
            vol_prox = volume_proximity(old_qty_d, new_qty[j])
            composite = (
                0.50 * popis_sim
                + 0.20 * mj_match
                + 0.15 * sec_match
                + 0.15 * vol_prox
            )
            alts.append({
                "new_item_idx": int(j),
                "new_item_id": new_items[j]["item_id"],
                "new_popis": new_items[j]["popis"],
                "new_MJ": new_items[j]["MJ"],
                "new_kapitola": new_items[j]["kapitola"],
                "new_mnozstvi": new_items[j]["mnozstvi"],
                "popis_similarity": round(popis_sim, 3),
                "mj_match": mj_match,
                "section_match": sec_match,
                "volume_proximity": round(vol_prox, 3),
                "composite_score": round(composite, 3),
                "old_qty_komplex": old_qty[i],
                "old_qty_d_estimate": round(old_qty_d, 3) if old_qty_d is not None else None,
            })
        alts.sort(key=lambda x: -x["composite_score"])
        best = alts[0]
        candidates.append({
            "old_idx": i,
            "old_code": old_it["code"],
            "old_popis": old_it["popis"],
            "old_MJ": old_it["MJ"],
            "old_section": old_it.get("section"),
            "old_mnozstvi_komplex": old_qty[i],
            "best_match": best,
            "alternatives": alts[1:],
        })

    # Stats
    score_buckets = Counter()
    for c in candidates:
        s = c["best_match"]["composite_score"]
        if s >= SCORE_HIGH:
            score_buckets["confident"] += 1
        elif s >= SCORE_LOW:
            score_buckets["possible"] += 1
        else:
            score_buckets["no_match"] += 1

    out = {
        "metadata": {
            "old_items_processed": len(old_items),
            "new_items_in_pool": len(new_items),
            "score_thresholds": {"confident": SCORE_HIGH, "possible_min": SCORE_LOW},
            "weights": {"popis": 0.50, "mj": 0.20, "section": 0.15, "volume": 0.15},
            "d_share_assumption": D_SHARE,
            "score_distribution": dict(score_buckets),
        },
        "candidates": candidates,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT} ({OUT.stat().st_size:,} bytes)")
    print(f"Score distribution: {dict(score_buckets)}")


if __name__ == "__main__":
    main()
