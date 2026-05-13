"""Local URS catalog lookup for hk212_hala Phase 1.

Single canonical source: ``URS_MATCHER_SERVICE/backend/data/URS201801.csv``
(39 742 rows, semicolon-delimited, **stemmed Czech tokens**).

Format per row::

    <9-digit-code>;<type:K|M|S>;<space><stemmed_tokens_space_separated>

Example::

    273351215;K; bednn stnak desk zhotvn

URS201801 (2018-01 vintage) uses an older catalog numbering than the modern
RTS 24/II price book, so anchor-by-code coverage of Rožmitál SOL precedent is
poor (1/13 sampled codes match). Strategy is **semantic fuzzy match**:

1. Stem the query the same way (best-effort approximation of URS rules)
2. Token-overlap (Jaccard) against catalog rows
3. Boost for kapitola-prefix match (e.g. query in HSV-1 prefers URS 1xx codes)
4. Boost for numeric/dimensional token exact match (C16/20, IPE 400, Ø8 …)

Items without a confident match get ``urs_code = None`` and
``urs_status = "needs_review"``; alternatives top-3 are kept so a future
online URS_MATCHER + Perplexity rerank pass can complete the lookup.
"""
from __future__ import annotations

import csv
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parents[4]
URS_CSV_PATH = REPO_ROOT / "URS_MATCHER_SERVICE" / "backend" / "data" / "URS201801.csv"

VOWELS = set("aeiouyáéíóúýě")


def strip_diacritics(text: str) -> str:
    """NFKD-decompose + drop combining marks. Lowercase."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


def stem_word(word: str) -> str:
    """Best-effort URS-style stemmer.

    URS201801 keeps first 3 chars then drops most vowels from the rest, with a
    Czech-specific quirk that ``ch`` (a digraph) collapses to ``h``. Exact
    replication is impossible from public examples alone — this matches the
    high-frequency cases (cinnst, nakld, geodtck, pruvdnch) used as anchors
    during pattern discovery.
    """
    word = strip_diacritics(word)
    word = word.replace("ch", "h")  # Czech digraph
    if len(word) <= 3:
        return word
    head = word[:3]
    tail = "".join(c for c in word[3:] if c not in VOWELS)
    return head + tail


def tokenize_text(text: str) -> list[str]:
    """Lower + strip diacritics + split into word tokens.

    Numeric and alphanumeric dimension tokens (``C16/20``, ``IPE400``,
    ``B500B``, ``XC4``) are preserved as single tokens rather than split.
    """
    if not text:
        return []
    text = strip_diacritics(text)
    # Replace some punctuation with spaces but KEEP dimensional dividers inside numbers
    text = re.sub(r"[,;()\[\]]+", " ", text)
    # Tokenize: words OR dimension tokens like "c16/20", "ipe450", "100x100", "ø8"
    tokens = re.findall(r"[a-z]+\d*[a-z\d/\-×x]*|\d+[a-z\d/\-×x]*", text)
    return [t for t in tokens if len(t) >= 2]


def is_dim_token(token: str) -> bool:
    """A token that carries a dimension or class signal (C16/20, IPE400, XC4, B500B, Ø8, 100x100…)."""
    if not token:
        return False
    if re.search(r"\d", token):
        return True
    if token in {"ipe", "hea", "heb", "upe", "upn", "xc", "xf", "xd", "xa", "xs", "xc0", "xc1", "xc2", "xc3", "xc4"}:
        return True
    return False


def stem_tokens(tokens: Iterable[str]) -> list[str]:
    """Apply stem_word to each non-dimension token; keep dimension tokens verbatim."""
    out = []
    for t in tokens:
        if is_dim_token(t):
            out.append(t)
        else:
            out.append(stem_word(t))
    return out


@dataclass(frozen=True)
class UrsEntry:
    code: str
    typ: str  # K | M | S
    tokens: tuple[str, ...]  # already stemmed by URS authors


@dataclass
class UrsMatch:
    code: str
    typ: str
    tokens: tuple[str, ...]
    score: float  # 0.0 .. 1.0


def _kapitola_prefix(code: str) -> str:
    """Return the leading digit-prefix used for kapitola routing.

    URS conventions:
    - 1xx Zemní práce
    - 2xx Základy a zvláštní zakládání
    - 27x Železobeton (svislé / vodorovné)
    - 3xx Svislé konstrukce
    - 4xx Vodorovné konstrukce
    - 6xx Úpravy povrchů
    - 7xx PSV
    - 71x Hydroizolace, 76x zámečnické (vrata/dveře/okna), 77x podlahy, 78x klempířské
    - 9xx Ostatní + 95x revize, 998 přesun hmot
    - 21-M / 22-M elektromontáže
    - 005x VRN
    """
    if not code:
        return ""
    return code[:3].lstrip("0") or code[:3]


def load_urs_catalog(path: Path | None = None) -> list[UrsEntry]:
    """Load and index URS201801.csv. Returns a list of UrsEntry."""
    p = path or URS_CSV_PATH
    if not p.exists():
        raise FileNotFoundError(f"URS catalog not found: {p}")
    entries: list[UrsEntry] = []
    with p.open(encoding="utf-8") as f:
        for raw in f:
            raw = raw.rstrip("\n\r")
            if not raw:
                continue
            parts = raw.split(";", 2)
            if len(parts) < 3:
                continue
            code = parts[0].strip()
            typ = parts[1].strip()
            tokens_str = parts[2].strip()
            # Catalog tokens already stemmed by URS authors
            tokens = tuple(t for t in tokens_str.split() if t)
            if not code or not tokens:
                continue
            entries.append(UrsEntry(code=code, typ=typ, tokens=tokens))
    return entries


class UrsIndex:
    """Inverted index over the stemmed catalog tokens for fast top-N retrieval."""

    def __init__(self, entries: list[UrsEntry]) -> None:
        self.entries = entries
        self.token_to_entries: dict[str, list[int]] = defaultdict(list)
        for i, e in enumerate(entries):
            for t in set(e.tokens):
                self.token_to_entries[t].append(i)

    def lookup(
        self,
        popis: str,
        kapitola_prefix_hint: str | None = None,
        top_n: int = 3,
        min_score: float = 0.15,
    ) -> list[UrsMatch]:
        """Return top-N catalog matches ranked by token overlap.

        - ``popis`` is the natural-language Czech description.
        - ``kapitola_prefix_hint`` (e.g. ``"1"`` for zemní, ``"27"`` for ŽB,
          ``"76"`` for zámečnické) boosts matches whose URS code begins with
          the same prefix (+0.10).
        - Dimension tokens (C16/20, IPE 400, XC4 …) that match exactly add
          an additional +0.05 per token.
        """
        tokens = stem_tokens(tokenize_text(popis))
        if not tokens:
            return []
        query_set = set(tokens)
        query_dims = {t for t in tokens if is_dim_token(t)}

        candidate_ids: set[int] = set()
        for t in query_set:
            candidate_ids.update(self.token_to_entries.get(t, ()))

        scored: list[UrsMatch] = []
        for idx in candidate_ids:
            e = self.entries[idx]
            cat_set = set(e.tokens)
            inter = query_set & cat_set
            if not inter:
                continue
            union = query_set | cat_set
            jaccard = len(inter) / len(union) if union else 0.0

            # Boosts
            boost = 0.0
            if kapitola_prefix_hint and e.code.startswith(kapitola_prefix_hint):
                boost += 0.10
            dim_overlap = query_dims & cat_set
            boost += 0.05 * len(dim_overlap)
            # If most query tokens are present in catalog row, boost (high precision)
            coverage = len(inter) / max(len(query_set), 1)
            if coverage >= 0.6:
                boost += 0.10

            score = min(1.0, jaccard + boost)
            if score >= min_score:
                scored.append(UrsMatch(code=e.code, typ=e.typ, tokens=e.tokens, score=round(score, 3)))

        scored.sort(key=lambda m: m.score, reverse=True)
        return scored[:top_n]


def categorize_match(score: float) -> str:
    """Map score → urs_status enum per §6 confidence ladder.

    Buckets aligned with ursMatcher.js CONFIDENCE_THRESHOLDS:
    - ≥ 0.85 matched_high
    - ≥ 0.60 matched_medium
    - < 0.60 needs_review (alternatives kept for manual / online rerank)
    """
    if score >= 0.85:
        return "matched_high"
    if score >= 0.60:
        return "matched_medium"
    return "needs_review"


def confidence_for(status: str) -> float:
    """Translate urs_status → numeric confidence per §6 ladder."""
    return {
        "matched_exact": 1.0,
        "matched_high": 0.85,
        "matched_medium": 0.75,
        "needs_review": 0.50,
        "custom_item": 0.50,
    }.get(status, 0.50)
