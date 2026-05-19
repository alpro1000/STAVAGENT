"""
UEP project type detection — Phase 0 of the pipeline (PR3 §3.6).

Decides which coverage matrix + reconciliation rule set + derivation
defaults to apply for a freshly-uploaded project. Pure regex over
filename + TZ content per the v3 §4.4 heuristic decision tree:

    1. filename / TZ content contains "most|mostní|opěra|pilíř" → bridge
    2. filename / TZ contains "silnice|vozovka|kryt|ŘSD|TKP PK"  → road
    3. filename / TZ contains "průmyslová hala|skladová hala|
       technologie linka"                                       → industrial
    4. filename / TZ contains "rodinný dům|bytový dům|obytný|
       rezidenční"                                              → residential
    5. only D.1.4 files (no construction drawings)              → mep_only
    6. else                                                     → ambiguous

Per task §2 Q15 = B (default): when two types tie within ε confidence,
the heuristic returns a list and the caller decides — REST returns a
400 with the candidate list, CLI prints the list and exits.

Reference: docs/TASK_DocumentExtraction_Universal_Pipeline.md §4.4
Reference: docs/tasks/TASK_UEP_PR3.md §3.6
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ProjectTypeCandidate(BaseModel):
    """One candidate in the detection result."""

    project_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[str] = Field(default_factory=list)


class ProjectTypeDetection(BaseModel):
    """Output of `detect_project_type()`.

    - `top_choice` populated when one candidate clearly wins
      (confidence diff to the runner-up ≥ AMBIGUITY_GAP).
    - `ambiguous_candidates` populated when ≥ 2 candidates are within
      AMBIGUITY_GAP — caller picks one via the REST/CLI prompt.
    """

    top_choice: str | None = None
    candidates: list[ProjectTypeCandidate] = Field(default_factory=list)
    ambiguous_candidates: list[str] = Field(default_factory=list)
    files_scanned: int = 0
    tz_chars_scanned: int = 0


# ---------------------------------------------------------------------------
# Heuristic constants
# ---------------------------------------------------------------------------


# Per-type keyword patterns. Czech-canonical forms; case-insensitive
# at match time. The pattern is the union of "filename hint" + "TZ
# content hint" so we can reuse one regex per type.
# NOTE on Czech regex shape: trailing `\b` on a Czech token followed by
# a vowel (e.g. "hal\b" vs "hala") FAILS because Python's word-boundary
# treats both letters as word chars. Patterns therefore end with `\w*`
# to allow declension endings, not `\b`. Leading `\b` stays because
# the preceding char is usually whitespace / punctuation.
_TYPE_PATTERNS: dict[str, re.Pattern[str]] = {
    "bridge": re.compile(
        r"\b(most(?:n[ií])?\w*|op[eě]r[ay]\w*|pil[ií][rř]\s*most\w*"
        r"|nadje[zs]d\w*|estakad\w*|pomostov[áa]\w*)",
        re.IGNORECASE,
    ),
    "road": re.compile(
        r"\b(silnic\w*|vozovk\w*|kryt(?:ov)?\w*|\bACO\b|\bACL\b|\bCB\s*kryt"
        r"|ŘSD|TKP\s*PK|sta[nň]ičen[ií]\w*|kruhov[áé]\s*objezd\w*"
        r"|sm[ěe]rov[ée]\s*pom[eě]r\w*)",
        re.IGNORECASE,
    ),
    "industrial": re.compile(
        r"\b(pr[uů]myslov[áaeéý]\w*\s*hal\w*|sklad(?:ov[áaeéý])?\s*hal\w*"
        r"|technologi[íiec]\w*\s*link\w*|v[ýy]robn[ií]\s*hal\w*"
        r"|logistick(?:[ýáéíý]|ého)\s*centr\w*)",
        re.IGNORECASE,
    ),
    "residential": re.compile(
        r"\b(rodinn[ýyáé]\s*d[uů]m\w*|bytov[ýyáé]\s*d[uů]m\w*"
        r"|obytn[ýyáaéíý]\w*|rezidenčn\w*"
        r"|byty(?:[\s\.-]|$)|RD\s*(?:Ja|Z|[A-Z]))",
        re.IGNORECASE,
    ),
}


# Names of D.1.4 profession indicator files (filename heuristics).
_D14_FILENAME_HINTS: re.Pattern[str] = re.compile(
    r"(?:^|[_\-\s/])(chl|vzt|topen[ií]|UT|ZTI|kanal|vodov"
    r"|silnoproud|slaboproud|MaR|elektro)(?:[_\-\s\.]|$)",
    re.IGNORECASE,
)


# Filename hints for construction drawings — presence means it's NOT
# a MEP-only project.
_CONSTRUCTION_DRAWING_HINTS: re.Pattern[str] = re.compile(
    r"(p[uů]dorys|p[uů]dorsy|ř[ée]z|pohled|architekt|tvar|v[ýy]ztu[žz]|statik"
    r"|p[áa]dorys|skladb|fasád)",
    re.IGNORECASE,
)


# Two candidates within this confidence gap → ambiguous.
AMBIGUITY_GAP = 0.15

# Minimum confidence to count as a candidate at all.
MIN_CONFIDENCE = 0.20

# Score weights — filename match counts double a content match
# because filenames are deterministic and content can mention many
# project types peripherally.
_FILENAME_WEIGHT = 2.0
_CONTENT_WEIGHT = 1.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


@dataclass
class _Scores:
    raw: dict[str, float] = field(default_factory=dict)
    evidence: dict[str, list[str]] = field(default_factory=dict)

    def add(self, project_type: str, weight: float, evidence: str) -> None:
        self.raw[project_type] = self.raw.get(project_type, 0.0) + weight
        self.evidence.setdefault(project_type, []).append(evidence)


# Filename normalisation pattern — replaces `_`, `-`, `.`, `/`, `\` with
# spaces so word boundaries `\b` fire correctly on tokens inside
# typical CZ filenames like `SO_201_most_2062.dxf`. Without this,
# `\bmost\b` doesn't match inside the underscored stem because `_` is
# a word char in Python regex.
_FILENAME_SEGMENT_SPLIT = re.compile(r"[_\-./\\]+")


def _normalise_filename(name: str) -> str:
    return _FILENAME_SEGMENT_SPLIT.sub(" ", name)


def _scan_filenames(
    filenames: Iterable[str], scores: _Scores
) -> tuple[int, int]:
    """Scan filenames; return (total_count, mep_filename_hits)."""

    total = 0
    mep_hits = 0
    construction_hits = 0
    for raw_name in filenames:
        total += 1
        name = _normalise_filename(raw_name)
        if _D14_FILENAME_HINTS.search(name):
            mep_hits += 1
        if _CONSTRUCTION_DRAWING_HINTS.search(name):
            construction_hits += 1
        for ptype, pattern in _TYPE_PATTERNS.items():
            if pattern.search(name):
                scores.add(ptype, _FILENAME_WEIGHT, f"filename:{raw_name}")
    # mep_only is detected post-hoc: 0 construction drawing files +
    # any mep file → mep_only candidate
    if mep_hits > 0 and construction_hits == 0:
        scores.add("mep_only", _FILENAME_WEIGHT * max(1, mep_hits), "mep-only inventory")
    return total, mep_hits


def _scan_tz_text(tz_text: str, scores: _Scores) -> int:
    """Scan TZ text body; returns char count scanned (capped)."""

    if not tz_text:
        return 0
    chunk = tz_text[:200_000]  # cap to keep regex cost bounded
    for ptype, pattern in _TYPE_PATTERNS.items():
        for m in pattern.finditer(chunk):
            scores.add(ptype, _CONTENT_WEIGHT, f"tz:{m.group(0)}")
    return len(chunk)


def _normalise_scores(scores: _Scores) -> list[ProjectTypeCandidate]:
    """Convert raw weights → confidence in [0, 1]."""

    if not scores.raw:
        return []
    total = max(sum(scores.raw.values()), 1.0)
    out: list[ProjectTypeCandidate] = []
    for ptype, weight in scores.raw.items():
        conf = weight / total
        if conf < MIN_CONFIDENCE:
            continue
        out.append(
            ProjectTypeCandidate(
                project_type=ptype,
                confidence=round(conf, 3),
                evidence=scores.evidence.get(ptype, [])[:10],
            )
        )
    out.sort(key=lambda c: c.confidence, reverse=True)
    return out


def detect_project_type(
    filenames: Iterable[str] = (),
    tz_text: str = "",
) -> ProjectTypeDetection:
    """Run the heuristic decision tree, return structured detection.

    Pure function — no I/O. Caller supplies the iterable of filenames
    (basename or relative path is fine) and the concatenated TZ text.

    Multi-type packages (a project with both bridge AND road keywords
    in volume) will surface as `ambiguous_candidates` — task §2 Q15=B
    default; caller picks one via the REST/CLI prompt.
    """

    scores = _Scores()
    file_list = list(filenames)
    files_scanned, _mep_hits = _scan_filenames(file_list, scores)
    tz_chars = _scan_tz_text(tz_text, scores)

    candidates = _normalise_scores(scores)

    top_choice: str | None = None
    ambiguous: list[str] = []
    if candidates:
        top = candidates[0]
        runner_up = candidates[1] if len(candidates) > 1 else None
        if runner_up is None or (top.confidence - runner_up.confidence) >= AMBIGUITY_GAP:
            top_choice = top.project_type
        else:
            # Group all candidates within the gap as ambiguous.
            ambiguous = [
                c.project_type
                for c in candidates
                if (top.confidence - c.confidence) < AMBIGUITY_GAP
            ]

    return ProjectTypeDetection(
        top_choice=top_choice,
        candidates=candidates,
        ambiguous_candidates=ambiguous,
        files_scanned=files_scanned,
        tz_chars_scanned=tz_chars,
    )


def detect_from_project_dir(project_dir: Path, max_tz_files: int = 5) -> ProjectTypeDetection:
    """Convenience wrapper — walks `project_dir`, picks up to
    `max_tz_files` PDFs whose filenames look TZ-shaped, reads their
    text, and runs detection.

    NOT a high-fidelity reader — we use pdfplumber for the text grab.
    Callers that want a richer signal should pass `tz_text` directly
    to `detect_project_type()` (e.g. after the PDF TZ extractor has
    already run).
    """

    filenames: list[str] = []
    for p in sorted(project_dir.rglob("*")):
        if not p.is_file():
            continue
        filenames.append(p.name)

    tz_text_parts: list[str] = []
    tz_pattern = re.compile(r"(?:^|[_\-\s])(TZ|technick[áa])", re.IGNORECASE)
    picked = 0
    for p in sorted(project_dir.rglob("*.pdf")):
        if picked >= max_tz_files:
            break
        if not tz_pattern.search(p.name):
            continue
        try:
            # Lazy import — pdfplumber is heavy and the regex-only
            # detection path shouldn't drag it in.
            import pdfplumber  # type: ignore[import-not-found]

            with pdfplumber.open(str(p)) as pdf:
                for page in pdf.pages[:10]:  # first 10 pages enough for TZ
                    txt = page.extract_text() or ""
                    tz_text_parts.append(txt)
            picked += 1
        except Exception:  # noqa: BLE001 — degrade gracefully on bad PDF
            continue

    return detect_project_type(filenames, "\n".join(tz_text_parts))
