"""Shared helpers for lightweight enrichment normalisation."""

from __future__ import annotations

import re
import unicodedata
from typing import Dict, Set

_WHITESPACE_RE = re.compile(r"\s+")
_CONCRETE_RE = re.compile(r"C\d{1,2}/\d{1,2}", re.IGNORECASE)
_EXPOSURE_RE = re.compile(r"X[ACDFS][A-Z]?\d?", re.IGNORECASE)
_STEEL_RE = re.compile(r"B\d{3}[A-Z]?", re.IGNORECASE)
_DIAMETER_RE = re.compile(r"(?:Ø|⌀)?\s*\d{2}\b")
_UNIT_RE = re.compile(r"\b(m3|m2|m|t|ks)\b", re.IGNORECASE)


def normalize_text(value: str) -> str:
    """Return a lowercase ASCII-only representation with collapsed whitespace."""

    if not value:
        return ""
    # Remove accents using unicode decomposition.
    decomposed = unicodedata.normalize("NFKD", value)
    ascii_chars = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    lowered = ascii_chars.lower().strip()
    return _WHITESPACE_RE.sub(" ", lowered)


def extract_entities(text: str) -> Dict[str, Set[str]]:
    """Extract technical markers from the provided text."""

    if not text:
        return {
            "concretes": set(),
            "exposures": set(),
            "steel": set(),
            "diameters": set(),
            "units": set(),
        }

    matches = {
        "concretes": {m.upper() for m in _CONCRETE_RE.findall(text)},
        "exposures": {m.upper() for m in _EXPOSURE_RE.findall(text)},
        "steel": {m.upper() for m in _STEEL_RE.findall(text)},
        "diameters": {m.upper().replace(" ", "") for m in _DIAMETER_RE.findall(text)},
        "units": {m.lower() for m in _UNIT_RE.findall(text)},
    }
    return matches
