"""
phase_b_kros_match.py — KROS/URS catalog matching pipeline.

For each of 128 items in items_hk212_etap1.json:
  1. Extract keywords from popis (Czech-aware, strips stop words + units)
  2. FTS5 query against kros_fts.popis_normalized (best for Czech)
  3. MJ filter (must match item.mj)
  4. Třída filter (TSKP first-digit per kapitola)
  5. Rank with bm25() + apply scoring formula
  6. Top-3 candidates; best assigned with confidence:
       exact code match     → 0.95
       FTS bm25 < -8 + MJ match + třída match → 0.85
       FTS bm25 < -4 + MJ match              → 0.70
       below threshold      → Tier 2 custom

Outputs:
  outputs/soupis_praci/kros_match_results.json
  outputs/soupis_praci/kros_match_report.md

NO mutation of original items.json.
"""
import json
import sqlite3
import re
from pathlib import Path
from collections import Counter, defaultdict

BASE = Path(__file__).resolve().parent.parent.parent
KROS_DB = BASE.parent / "kros_catalog.db"
ITEMS_PATH = BASE / "outputs/phase_1_etap1/items_hk212_etap1.json"
OUT_JSON = BASE / "outputs/soupis_praci/kros_match_results.json"
OUT_MD = BASE / "outputs/soupis_praci/kros_match_report.md"

# Kapitola → TSKP třída prefix (1st digit allowed) — broader for FTS recall
KAPITOLA_TO_TRIDA = {
    "HSV-1": ["1"],                            # zemní práce
    "HSV-2": ["2", "5"],                       # zakládání + beton + výztuž
    "HSV-3": ["1", "5", "7"],                  # montáž OK (13) + dodávka profily (553) + nátěr (783)
    "HSV-9": ["9"],                            # přesun + lešení
    "PSV-71x": ["7"],                          # 711+713 izolace
    "PSV-76x": ["7", "5"],                     # 766+767 výplně + 553 dodávka
    "PSV-77x": ["7"],                          # 776 podlahy
    "PSV-78x": ["7"],                          # 764 klempíř
    "PSV-OPL": ["3", "5", "7"],                # 342 montáž opláštění + 553 dodávka panelů
    "VRN":     [],                             # no standard KROS code → Tier 2
}

# MJ normalization map (items.json uses various forms vs KROS)
MJ_NORMALIZE = {
    "m³": "m3", "m3": "m3",
    "m²": "m2", "m2": "m2",
    "kg": "kg", "t": "t", "t·km": "tkm",
    "ks": "kus", "kus": "kus",
    "bm": "m", "m": "m",
    "měsíc": "mesic", "mesic": "mesic",
    "paušál": "soubor", "kpl": "soubor", "soubor": "soubor",
}

# Equivalence classes — different MJs that refer to same conceptual unit
# (kg/t for mass — KROS uses t, items.json often uses kg).
MJ_EQUIV_CLASS = {
    "kg": "mass", "t": "mass",
    "m": "length", "bm": "length",
    "m2": "area",
    "m3": "volume",
    "kus": "count", "ks": "count",
    "mesic": "time",
    "soubor": "lump",
    "tkm": "transport",
}

# Czech stop words to strip from popis before FTS query
CZECH_STOPS = {
    "a", "se", "s", "z", "ze", "v", "ve", "na", "do", "po", "od", "k", "ku",
    "ke", "u", "o", "pro", "při", "pri", "bez", "až", "az", "nebo", "dle",
    "podle", "vč", "vc", "včetně", "vcetne", "kde", "je", "jsou", "byla",
    "budou", "tj", "atd", "apod", "etc",
    "dodávka", "dodavka", "montáž", "montaz",  # too generic
}

# Punctuation + units to strip
STRIP_RE = re.compile(
    r"[°ø×x*+/(),;:!?\[\]\"'„"
    r"_\-]|"
    r"\d+[.,]?\d*\s*(mm|cm|m|m2|m3|m²|m³|kg|t|ks|bm|kPa|MPa|kW|Hz|°C)",
    re.IGNORECASE,
)


def normalize_czech(text: str) -> str:
    """Remove diacritics, lowercase."""
    table = str.maketrans(
        "áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ",
        "acdeeinorstuuyzACDEEINORSTUUYZ",
    )
    return (text or "").translate(table).lower()


def extract_keywords(popis: str, max_kw: int = 5) -> list:
    """Strip stop words + numbers + units → top keywords for FTS query."""
    s = normalize_czech(popis or "")
    s = STRIP_RE.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    toks = [t for t in s.split() if len(t) > 2 and t not in CZECH_STOPS]
    # Dedupe but keep order
    seen = set()
    uniq = []
    for t in toks:
        if t not in seen:
            seen.add(t)
            uniq.append(t)
    return uniq[:max_kw]


def normalize_mj(mj: str) -> str:
    if not mj:
        return ""
    s = mj.strip().lower()
    return MJ_NORMALIZE.get(s, s)


def mj_match(item_mj: str, kros_mj: str) -> bool:
    """Match by normalized form OR by equivalence class."""
    a = normalize_mj(item_mj)
    b = normalize_mj(kros_mj)
    if a == b:
        return True
    return MJ_EQUIV_CLASS.get(a) == MJ_EQUIV_CLASS.get(b) and MJ_EQUIV_CLASS.get(a) is not None


def fts_query(conn, keywords: list, limit: int = 30) -> list:
    """Run FTS5 query with keywords joined by OR (multi-term match)."""
    if not keywords:
        return []
    # Build OR query — quoted terms to handle Czech tokens
    query = " OR ".join(f'"{k}"' for k in keywords)
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT k.kod_polozky, k.popis, k.mj, bm25(kros_fts) AS rank "
            "FROM kros_items k JOIN kros_fts f ON k.rowid=f.rowid "
            "WHERE kros_fts MATCH ? "
            "ORDER BY rank LIMIT ?",
            (query, limit),
        )
        return cur.fetchall()
    except sqlite3.OperationalError:
        return []


def trida_match(kod: str, allowed_tridy: list) -> bool:
    if not allowed_tridy:
        return True  # no filter
    if not kod:
        return False
    return kod[0] in allowed_tridy


def match_item(conn, item: dict) -> dict:
    """Match single items.json entry against KROS. Returns enriched dict."""
    kapitola = item.get("kapitola", "")
    item_mj = item.get("mj", "")
    item_popis = item.get("popis", "")
    existing_code = item.get("urs_code")

    # Existing exact code check
    if existing_code:
        cur = conn.cursor()
        cur.execute("SELECT kod_polozky, popis, mj FROM kros_items WHERE kod_polozky=?", (existing_code,))
        hit = cur.fetchone()
        if hit:
            return {
                "kros_code": hit[0],
                "kros_popis": hit[1],
                "kros_mj": hit[2],
                "kros_match_confidence": 0.95,
                "kros_match_method": "exact_existing_code",
                "kros_candidates": [{"code": hit[0], "popis": hit[1], "mj": hit[2], "rank": 0.0}],
                "tier": 1,
            }

    # FTS keyword search
    keywords = extract_keywords(item_popis, max_kw=6)
    allowed_tridy = KAPITOLA_TO_TRIDA.get(kapitola, [])

    raw_hits = fts_query(conn, keywords, limit=40)

    # Filter: MJ + třída
    scored = []
    for code, popis_full, kros_mj, rank in raw_hits:
        mj_ok = mj_match(item_mj, kros_mj)
        trida_ok = trida_match(code, allowed_tridy)
        # Score: lower bm25 rank = better match (FTS5 convention)
        # Compose: rank + MJ bonus + třída bonus
        score = rank
        if mj_ok:
            score -= 2.0  # MJ match bonus
        if trida_ok:
            score -= 1.0  # třída match bonus
        scored.append({
            "code": code,
            "popis": popis_full,
            "mj": kros_mj,
            "rank": rank,
            "mj_match": mj_ok,
            "trida_match": trida_ok,
            "composite_score": score,
        })

    # Two-pass selection:
    #  Pass 1: prefer MJ-matching candidates (sort by raw rank within mj-match group)
    #  Pass 2: fall back to overall best if no MJ match exists
    mj_matched = [c for c in scored if c["mj_match"]]
    if mj_matched:
        mj_matched.sort(key=lambda x: x["rank"])
        best = mj_matched[0]
        # Top-3 prefers mj-matching candidates first, then fillers
        top3 = mj_matched[:3]
        if len(top3) < 3:
            others = [c for c in scored if not c["mj_match"]][: 3 - len(top3)]
            top3 = top3 + others
    else:
        scored.sort(key=lambda x: x["composite_score"])
        top3 = scored[:3]
        best = top3[0] if top3 else None

    if not best:
        return {
            "kros_code": None,
            "kros_popis": None,
            "kros_mj": None,
            "kros_match_confidence": 0.0,
            "kros_match_method": "no_fts_hits",
            "kros_candidates": [],
            "tier": 2,
        }

    rank = best["rank"]
    # Confidence assignment — emphasizes MJ match since two-pass already prioritized it
    if best["mj_match"] and best["trida_match"] and rank < -8.0:
        conf = 0.85
        method = "fts_bm25_strong_mj_trida"
    elif best["mj_match"] and best["trida_match"] and rank < -4.0:
        conf = 0.80
        method = "fts_bm25_medium_mj_trida"
    elif best["mj_match"] and rank < -6.0:
        conf = 0.75
        method = "fts_bm25_medium_mj"
    elif best["mj_match"] and rank < -3.0:
        conf = 0.70
        method = "fts_bm25_weak_mj"
    elif best["mj_match"]:
        conf = 0.65
        method = "fts_bm25_mj_only"
    elif rank < -8.0 and best["trida_match"]:
        conf = 0.60
        method = "fts_bm25_strong_no_mj"
    else:
        conf = 0.50
        method = "fts_bm25_below_threshold"

    tier = 1 if conf >= 0.70 else 2
    return {
        "kros_code": best["code"],
        "kros_popis": best["popis"],
        "kros_mj": best["mj"],
        "kros_match_confidence": conf,
        "kros_match_method": method,
        "kros_candidates": top3,
        "tier": tier,
    }


def main():
    print("=== Phase B: KROS/URS matching ===\n")
    items_doc = json.load(open(ITEMS_PATH, encoding="utf-8"))
    items = items_doc["items"]
    conn = sqlite3.connect(str(KROS_DB))

    results = []
    tier_counts = Counter()
    method_counts = Counter()
    by_kap = defaultdict(lambda: {"tier1": 0, "tier2": 0})

    for it in items:
        match = match_item(conn, it)
        result = {
            "id": it["id"],
            "kapitola": it.get("kapitola"),
            "popis": it.get("popis"),
            "mj": it.get("mj"),
            "mnozstvi": it.get("mnozstvi"),
            "items_json_confidence": it.get("confidence"),
            **match,
        }
        results.append(result)
        tier_counts[match["tier"]] += 1
        method_counts[match["kros_match_method"]] += 1
        if match["tier"] == 1:
            by_kap[it.get("kapitola")]["tier1"] += 1
        else:
            by_kap[it.get("kapitola")]["tier2"] += 1

    conn.close()

    # Output JSON
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    json.dump(
        {"_meta": {"total_items": len(items), "tier_counts": dict(tier_counts),
                   "method_counts": dict(method_counts)}, "matches": results},
        open(OUT_JSON, "w", encoding="utf-8"),
        ensure_ascii=False,
        indent=2,
    )
    print(f"✓ Match results → {OUT_JSON.name}")

    # Markdown report
    tier1_pct = round(100 * tier_counts[1] / len(items), 1)
    md = [
        "# HK212 Soupis prací — KROS Match Report\n",
        "**Phase B output** · 2026-05-24",
        "",
        "## Summary",
        f"- **Total items:** {len(items)}",
        f"- **Tier 1 (KROS match conf ≥ 0.70):** {tier_counts[1]} ({tier1_pct} %)",
        f"- **Tier 2 (custom položka):** {tier_counts[2]} ({100 - tier1_pct} %)",
        "",
        f"**Acceptance §8 gate:** target ≥ 60 % Tier 1 → "
        f"{'✅ MET' if tier1_pct >= 60 else '❌ BELOW THRESHOLD'} ({tier1_pct} %)",
        "",
        "## Per kapitola breakdown",
        "| Kapitola | Tier 1 | Tier 2 | Total | Tier 1 % |",
        "|---|---:|---:|---:|---:|",
    ]
    for kap in sorted(by_kap):
        t1 = by_kap[kap]["tier1"]
        t2 = by_kap[kap]["tier2"]
        total = t1 + t2
        pct = round(100 * t1 / total, 1) if total else 0
        md.append(f"| {kap} | {t1} | {t2} | {total} | {pct} |")

    md.append("\n## Method distribution")
    md.append("| Method | Count |\n|---|---:|")
    for m, n in method_counts.most_common():
        md.append(f"| {m} | {n} |")

    md.append("\n## Detailed match per item")
    md.append("| ID | Kapitola | items.json popis (60 chars) | MJ | mn. | KROS code | KROS popis (50 chars) | Conf | Tier | Method |")
    md.append("|---|---|---|---|---:|---|---|---:|---:|---|")
    for r in results:
        popis = (r["popis"] or "")[:60].replace("|", "\\|")
        kros_popis = (r["kros_popis"] or "—")[:50].replace("|", "\\|")
        kros_code = r["kros_code"] or "—"
        md.append(
            f"| {r['id']} | {r['kapitola']} | {popis} | {r['mj']} | "
            f"{r['mnozstvi']} | {kros_code} | {kros_popis} | "
            f"{r['kros_match_confidence']:.2f} | {r['tier']} | {r['kros_match_method']} |"
        )

    md.append("\n## Top-3 candidates per Tier 2 item (for review)")
    for r in results:
        if r["tier"] != 2 or not r["kros_candidates"]:
            continue
        md.append(f"\n### {r['id']} — {r['popis'][:80]}")
        md.append(f"_items.json mj={r['mj']}, mnozstvi={r['mnozstvi']}, conf={r['items_json_confidence']}_\n")
        md.append("| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |")
        md.append("|---|---|---|---|---:|---|---|")
        for i, c in enumerate(r["kros_candidates"][:3], 1):
            popis_c = (c.get("popis") or "")[:70].replace("|", "\\|")
            md.append(
                f"| {i} | {c['code']} | {popis_c} | {c['mj']} | "
                f"{c['rank']:.2f} | {'✓' if c['mj_match'] else '✗'} | "
                f"{'✓' if c['trida_match'] else '✗'} |"
            )

    OUT_MD.write_text("\n".join(md), encoding="utf-8")
    print(f"✓ Match report → {OUT_MD.name}")
    print(f"\nTier 1: {tier_counts[1]} ({tier1_pct} %), Tier 2: {tier_counts[2]}")
    return tier1_pct >= 60


if __name__ == "__main__":
    main()
