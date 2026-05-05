"""Phase 7a v2 Part 2 — offline ÚRS lookup using URS201801.csv catalog.

Cloud URS_MATCHER blocked (HTTP 403, sandbox allowlist). Offline approach:
  1. Load URS201801.csv (39 742 rows, ÚRS RSPS 9-digit codes)
  2. Char-n-gram TF-IDF (3-5 grams) on encoded popisy
  3. Per query group: search top-5 candidates
  4. Apply codes to groups + propagate to items
  5. Validate format + flag suspicious

Char-n-gram TF-IDF tolerates the URS vowel-stripping encoding because
consonant sequences match between our diacritic-stripped popisy and the
catalog's encoded form.
"""
from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

OUT_DIR = Path("test-data/libuse/outputs")
GROUPS = OUT_DIR / "urs_query_groups.json"
ITEMS = OUT_DIR / "items_objekt_D_complete.json"
URS_CSV = Path("URS_MATCHER_SERVICE/backend/data/URS201801.csv")
CACHE = OUT_DIR / "urs_lookup_cache.json"
SUSPICIOUS = OUT_DIR / "items_suspicious_for_urs_review.json"

# ÚRS RSPS code regex — 9 digits with optional letter suffix
URS_CODE_RE = re.compile(r"^\d{9}[A-Z]?\d{0,2}$")

# Thresholds (calibrated for char-ngram TF-IDF on encoded URS popisy —
# URS catalog uses Czech vowel-stripping ('činnost' → 'cinnst') so cosine
# scores are typically low; tuned via sample 50 manual reviews)
SCORE_HIGH = 0.20
SCORE_MED = 0.10
SCORE_LOW = 0.05


def strip_diacritics(s: str) -> str:
    """ä → a, č → c, ě → e, etc."""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def normalize_for_matching(s: str) -> str:
    """Lowercase + diacritic strip + non-letter strip + collapse whitespace."""
    s = strip_diacritics((s or "").lower())
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def load_urs_catalog() -> list[tuple[str, str, str]]:
    """Returns [(code, type_letter, popis), ...]."""
    rows: list[tuple[str, str, str]] = []
    with URS_CSV.open(encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split(";", 2)
            if len(parts) != 3:
                continue
            code, type_letter, popis = parts[0].strip(), parts[1].strip(), parts[2].strip()
            if not code or not popis:
                continue
            rows.append((code, type_letter, popis))
    return rows


def kapitola_to_urs_prefix(kap: str) -> str:
    """HSV-611 → '611', PSV-771 → '771', PSV-622.1 → '622'."""
    m = re.match(r"^[A-Z]{3}-(\d{2,3})", kap)
    return m.group(1) if m else ""


def main() -> None:
    print("Loading inputs…")
    groups_blob = json.loads(GROUPS.read_text(encoding="utf-8"))
    groups = groups_blob["groups"]
    items = json.loads(ITEMS.read_text(encoding="utf-8"))["items"]
    catalog = load_urs_catalog()
    print(f"  ÚRS catalog: {len(catalog):,} rows")
    print(f"  Query groups: {len(groups)}")

    # Build TF-IDF index over catalog popisy
    print("Building TF-IDF index (char_wb 3-5 grams)…")
    catalog_popisy_norm = [normalize_for_matching(p) for _, _, p in catalog]
    vec = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(3, 5),
        min_df=1,
        sublinear_tf=True,
    )
    cat_tfidf = vec.fit_transform(catalog_popisy_norm)

    # Build catalog code → index
    catalog_codes = [c for c, _, _ in catalog]
    catalog_popisy_orig = [p for _, _, p in catalog]

    # Pre-compute kapitola → row indices for prefix-filtered search
    print("Pre-computing kapitola buckets…")
    kap_buckets: dict[str, list[int]] = defaultdict(list)
    for idx, code in enumerate(catalog_codes):
        kap = code[:3]
        kap_buckets[kap].append(idx)

    # Persistent cache (in case of re-runs)
    cache: dict[str, dict] = {}
    if CACHE.exists():
        try:
            cache = json.loads(CACHE.read_text(encoding="utf-8"))
        except Exception:
            cache = {}

    print("Matching groups…")
    score_buckets: Counter = Counter()
    for i, g in enumerate(groups):
        cache_key = f"{g['kapitola']}|{g['popis_template']}|{g['MJ']}"
        if cache_key in cache:
            cached = cache[cache_key]
            g["urs_code"] = cached["urs_code"]
            g["urs_description"] = cached["urs_description"]
            g["urs_confidence"] = cached["urs_confidence"]
            g["urs_alternatives"] = cached["urs_alternatives"]
            g["urs_status"] = cached["urs_status"]
            score_buckets[g["urs_status"]] += 1
            continue

        # Search FULL catalog — kapitola prefix filtering proved too strict
        # (HSV-NNN ≠ ÚRS section number 1:1; PSV malby kapitola 784 maps to
        # URS 612 omítka section etc.). Let TF-IDF popis match drive ranking.
        search_subset = cat_tfidf
        search_codes = catalog_codes
        search_popisy = catalog_popisy_orig

        # Prefix the kapitola number to the query so e.g. HSV-611 search
        # gives weight to URS rows starting with 611. Char-ngram TF-IDF
        # picks up the digit prefix as a signal.
        urs_prefix = kapitola_to_urs_prefix(g["kapitola"])
        query_norm = normalize_for_matching(
            f"{urs_prefix} {g['popis_canonical']}" if urs_prefix else g["popis_canonical"]
        )
        if not query_norm:
            g["urs_code"] = None
            g["urs_status"] = "no_match"
            g["urs_confidence"] = 0.0
            g["urs_alternatives"] = []
            g["urs_description"] = None
            score_buckets["no_match"] += 1
            continue

        q_vec = vec.transform([query_norm])
        sims = cosine_similarity(q_vec, search_subset).flatten()
        top_idx = sims.argsort()[::-1][:5]
        alts = []
        for ti in top_idx:
            alts.append({
                "code": search_codes[ti],
                "description": search_popisy[ti][:80],
                "confidence": round(float(sims[ti]), 3),
            })

        best = alts[0] if alts else None
        score = best["confidence"] if best else 0.0
        if best is None or score < SCORE_LOW:
            g["urs_code"] = None
            g["urs_status"] = "no_match"
        elif score < SCORE_MED:
            g["urs_code"] = best["code"]
            g["urs_status"] = "needs_review"
        elif score < SCORE_HIGH:
            g["urs_code"] = best["code"]
            g["urs_status"] = "matched_medium"
        else:
            g["urs_code"] = best["code"]
            g["urs_status"] = "matched_high"

        # Format validation
        if g["urs_code"] and not URS_CODE_RE.match(g["urs_code"]):
            g["urs_code"] = None
            g["urs_status"] = "no_match"

        g["urs_description"] = best["description"] if best else None
        g["urs_confidence"] = score
        g["urs_alternatives"] = alts[1:]
        score_buckets[g["urs_status"]] += 1
        cache[cache_key] = {
            "urs_code": g["urs_code"],
            "urs_description": g["urs_description"],
            "urs_confidence": g["urs_confidence"],
            "urs_alternatives": g["urs_alternatives"],
            "urs_status": g["urs_status"],
        }

        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{len(groups)} groups matched · cache size {len(cache)}")

    # Persist cache + updated groups
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    groups_blob["groups"] = groups
    groups_blob["metadata"]["score_distribution"] = dict(score_buckets)
    GROUPS.write_text(json.dumps(groups_blob, ensure_ascii=False, indent=2), encoding="utf-8")

    # Apply codes back to items via group lookup
    print("Applying codes to items…")
    item_id_to_group: dict[str, dict] = {}
    for g in groups:
        for item_id in g["items_ids"]:
            item_id_to_group[item_id] = g

    # Backup pre-URS items file
    backup = OUT_DIR / "items_objekt_D_complete_pre_urs.json"
    if not backup.exists():
        backup.write_text(json.dumps(json.loads(ITEMS.read_text(encoding="utf-8")),
                                      ensure_ascii=False, indent=2), encoding="utf-8")

    items_with_code = 0
    items_no_match = 0
    suspicious_items: list[dict] = []
    for it in items:
        g = item_id_to_group.get(it["item_id"])
        if g is None:
            it["urs_code"] = None
            it["urs_status"] = "no_match"
            it["urs_confidence"] = 0.0
            items_no_match += 1
            continue
        it["urs_code"] = g.get("urs_code")
        it["urs_description"] = g.get("urs_description")
        it["urs_confidence"] = g.get("urs_confidence", 0.0)
        it["urs_alternatives"] = g.get("urs_alternatives", [])
        # Override urs_status only if it was previously 'pending' or 'NOVE'
        # (preserves Phase 5 audit statuses like VYNECHANE_KRITICKE)
        if it.get("urs_status") in ("pending", "NOVE", None):
            it["urs_status"] = g["urs_status"]
        if g.get("urs_code"):
            items_with_code += 1
        else:
            items_no_match += 1
        # Suspicious flag — popis vs urs_description very different
        if g.get("urs_code") and g.get("urs_confidence", 0) < SCORE_MED:
            suspicious_items.append({
                "item_id": it["item_id"],
                "kapitola": it["kapitola"],
                "popis": it["popis"][:80],
                "urs_code": g["urs_code"],
                "urs_description": (g.get("urs_description") or "")[:80],
                "urs_confidence": g.get("urs_confidence"),
            })

    # Persist updated items
    combined = json.loads(ITEMS.read_text(encoding="utf-8"))
    combined["items"] = items
    combined["metadata"]["items_count"] = len(items)
    combined["metadata"]["phase_7a_v2_applied"] = True
    ITEMS.write_text(json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8")

    SUSPICIOUS.write_text(json.dumps(suspicious_items[:200], ensure_ascii=False, indent=2),
                          encoding="utf-8")

    print()
    print("=" * 60)
    print("ÚRS LOOKUP RESULTS (offline TF-IDF on URS201801.csv)")
    print("=" * 60)
    print(f"Total groups: {len(groups)}")
    print(f"Score distribution:")
    for status, n in sorted(score_buckets.items(), key=lambda x: -x[1]):
        pct = n / len(groups) * 100
        print(f"  {status:25s} {n:>4} ({pct:>5.1f} %)")
    print()
    print(f"Items: {len(items)} total · {items_with_code} with URS code · "
          f"{items_no_match} no_match")
    print(f"Suspicious items (low confidence): {len(suspicious_items)}")
    print(f"Cache: {CACHE} ({len(cache)} entries)")
    print(f"Suspicious: {SUSPICIOUS}")


if __name__ == "__main__":
    main()
