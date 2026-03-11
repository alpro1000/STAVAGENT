import unicodedata
from difflib import SequenceMatcher
from typing import Dict, List, Any, Optional


def normalize_text(s: Optional[str]) -> str:
    if not s:
        return ""
    s = s.lower().strip()
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s


def name_similarity(a: str, b: str) -> float:
    a_n = normalize_text(a)
    b_n = normalize_text(b)
    if not a_n or not b_n:
        return 0.0
    return SequenceMatcher(None, a_n, b_n).ratio()


def match_positions(monolit_positions: List[Dict[str, Any]], registry_positions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return list of match results for each monolit position.

    Simple algorithm:
      - try exact code match (if present)
      - else compute name similarity and quantity proximity
      - classify as matched (confidence>=0.9), ambiguous (0.6-0.9), new (<0.6)
    """
    # index registry by code
    registry_by_code = {}
    for rp in registry_positions:
        code = (rp.get("code") or "").strip()
        if code:
            registry_by_code.setdefault(code, []).append(rp)

    results = []
    for mp in monolit_positions:
        best = None
        confidence = 0.0
        matched = None

        mcode = (mp.get("code") or "").strip()
        mname = mp.get("name") or ""
        mqty = mp.get("quantity")

        # exact code
        if mcode and mcode in registry_by_code:
            # take first as primary match
            matched = registry_by_code[mcode][0]
            confidence = 1.0

        else:
            # fuzzy name match across all registry positions
            for rp in registry_positions:
                score = name_similarity(mname, rp.get("name", ""))
                qty_score = 0.0
                rqty = rp.get("quantity")
                if mqty is not None and rqty is not None:
                    try:
                        if rqty == 0:
                            qty_score = 0.0
                        else:
                            qty_score = max(0.0, 1 - abs((mqty - rqty) / max(abs(rqty), 1e-6)))
                    except Exception:
                        qty_score = 0.0
                combined = 0.7 * score + 0.3 * qty_score
                if combined > confidence:
                    confidence = combined
                    best = rp
            matched = best

        tag = "new"
        if confidence >= 0.9:
            tag = "matched"
        elif confidence >= 0.6:
            tag = "ambiguous"

        results.append({
            "monolit_position": mp,
            "matched_registry_position": matched,
            "confidence": round(float(confidence), 3),
            "tag": tag,
        })

    return results
