"""Lightweight position enrichment using local knowledge bases."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from app.core.config import settings
from app.core.kb_loader import KnowledgeBaseLoader, get_knowledge_base
from app.core.normalization import extract_entities, normalize_text

logger = logging.getLogger(__name__)

_CODE_RE = re.compile(r"[^A-Z0-9]")


@dataclass(frozen=True)
class CatalogEntry:
    """Simplified representation of a KB record."""

    code: str
    catalog: str
    unit: str
    description: str
    tech_spec: str
    normalized_text: str
    entities: Dict[str, set[str]]


class PositionEnricher:
    """Attach enrichment metadata to cost positions."""

    def __init__(self, enabled: Optional[bool] = None, kb_loader: Optional[KnowledgeBaseLoader] = None) -> None:
        self.enabled = settings.ENRICHMENT_ENABLED if enabled is None else enabled
        self.score_exact = settings.ENRICH_SCORE_EXACT
        self.score_partial = settings.ENRICH_SCORE_PARTIAL
        self.max_evidence = settings.ENRICH_MAX_EVIDENCE

        self._code_index: Dict[str, CatalogEntry] = {}
        self._entries_by_unit: Dict[str, List[CatalogEntry]] = {}
        self._entries: List[CatalogEntry] = []
        self.catalog_present = False

        if not self.enabled:
            return

        loader = kb_loader or get_knowledge_base()
        try:
            self._bootstrap_catalog(loader)
        except Exception:  # noqa: BLE001 - logged for diagnostics
            logger.exception("Failed to initialise enrichment catalog")
            self.enabled = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def enrich(
        self,
        positions: Iterable[Dict[str, Any]],
        drawing_payload: Any,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        drawing_texts = self._collect_drawing_texts(drawing_payload)

        enriched_positions: List[Dict[str, Any]] = []
        stats = {"enabled": self.enabled, "matched": 0, "partial": 0, "unmatched": 0}

        if not self.enabled or not self.catalog_present:
            for position in positions:
                enriched_positions.append(self._fallback_payload(dict(position)))
                stats["unmatched"] += 1
            logger.info(
                "enrichment: matched=%s partial=%s unmatched=%s thresholds={%.2f,%.2f}",
                stats["matched"],
                stats["partial"],
                stats["unmatched"],
                self.score_exact,
                self.score_partial,
            )
            stats["catalog_present"] = self.catalog_present
            return enriched_positions, stats

        for position in positions:
            enriched = self._enrich_single(dict(position), drawing_texts)
            label = enriched.get("enrichment", {}).get("match", "none")
            if label == "exact":
                stats["matched"] += 1
            elif label == "partial":
                stats["partial"] += 1
            else:
                stats["unmatched"] += 1
            enriched_positions.append(enriched)

        logger.info(
            "enrichment: matched=%s partial=%s unmatched=%s thresholds={%.2f,%.2f}",
            stats["matched"],
            stats["partial"],
            stats["unmatched"],
            self.score_exact,
            self.score_partial,
        )
        stats["catalog_present"] = self.catalog_present
        return enriched_positions, stats

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _bootstrap_catalog(self, loader: KnowledgeBaseLoader) -> None:
        seen_codes: set[str] = set()

        def register(entry: CatalogEntry) -> None:
            if entry.code in seen_codes:
                return
            seen_codes.add(entry.code)
            code_key = self._normalise_code(entry.code)
            if code_key:
                self._code_index[code_key] = entry
            self._entries.append(entry)
            unit_key = self._normalise_unit(entry.unit)
            self._entries_by_unit.setdefault(unit_key, []).append(entry)

        for catalog_key in ("otskp", "urs", "rts"):
            records = loader.kb_b1.get(catalog_key, {}) if hasattr(loader, "kb_b1") else {}
            if not records:
                continue
            self.catalog_present = True
            for payload in records.values():
                code = str(payload.get("code") or "").strip()
                if not code:
                    continue
                description = str(payload.get("name") or payload.get("description") or "").strip()
                tech_spec = str(payload.get("tech_spec") or "").strip()
                unit = str(payload.get("unit") or "").strip()
                normalized = normalize_text(" ".join(filter(None, [description, tech_spec])))
                entry = CatalogEntry(
                    code=code,
                    catalog=catalog_key.upper(),
                    unit=unit,
                    description=description,
                    tech_spec=tech_spec,
                    normalized_text=normalized,
                    entities=extract_entities(f"{description} {tech_spec}"),
                )
                register(entry)

        if not self.catalog_present:
            self.enabled = False

    def _enrich_single(self, position: Dict[str, Any], drawing_texts: Sequence[str]) -> Dict[str, Any]:
        evidence: List[Dict[str, str]] = []
        candidates: List[Dict[str, Any]] = []
        match = "none"
        score = 0.0

        code = str(position.get("code") or "").strip()
        if code:
            entry = self._code_index.get(self._normalise_code(code))
            if entry:
                match = "exact"
                score = 1.0
                evidence.append(
                    {
                        "source": "kb",
                        "reason": "code_exact",
                        "snippet": entry.description[:120],
                    }
                )
                candidates = [self._candidate_payload(entry, score)]

        description_text = str(position.get("description") or "")
        tech_text = self._flatten_text(position.get("technical_specs"))
        description_entities = extract_entities(description_text)
        tech_entities = extract_entities(tech_text)

        if match != "exact":
            pair_evidence = self._match_spec_pair(description_text, tech_entities, drawing_texts)
            if pair_evidence:
                match = "exact"
                score = 0.95
                evidence.append(pair_evidence)

        if match == "none":
            partial = self._match_concrete_without_exposure(position, description_entities, tech_entities)
            if partial:
                entry = partial
                match = "partial"
                score = max(score, 0.75)
                evidence.append(
                    {
                        "source": "kb",
                        "reason": "concrete_unit",
                        "snippet": entry.description[:120],
                    }
                )
                candidates = [self._candidate_payload(entry, score)]

        if match == "none":
            fuzzy_candidates = self._match_fuzzy(description_text, position.get("unit"))
            if fuzzy_candidates:
                match = "partial"
                best_score = fuzzy_candidates[0][0]
                score = max(score, best_score)
                for ratio, entry in fuzzy_candidates:
                    if len(evidence) < self.max_evidence:
                        evidence.append(
                            {
                                "source": "kb",
                                "reason": "desc_fuzzy",
                                "snippet": entry.description[:120],
                            }
                        )
                    candidates.append(self._candidate_payload(entry, ratio))

        match_status = "matched" if match == "exact" else "partial" if match == "partial" else "unmatched"
        enrichment_block = {
            "match": match,
            "score": round(score, 4),
            "evidence": evidence[: self.max_evidence],
        }
        if candidates:
            enrichment_block["candidates"] = candidates[:3]

        position["match_status"] = match_status
        position["enrichment_status"] = match_status if match != "none" else "unmatched"
        position["enrichment_score"] = enrichment_block["score"]
        position["candidate_codes"] = candidates[:3]
        position["enrichment"] = enrichment_block
        return position

    def _fallback_payload(self, position: Dict[str, Any]) -> Dict[str, Any]:
        position.setdefault("match_status", "unmatched")
        position.setdefault("enrichment_status", "unmatched")
        position.setdefault("candidate_codes", [])
        block = {"match": "none", "score": 0.0, "evidence": []}
        position["enrichment"] = block
        position["enrichment_score"] = 0.0
        return position

    @staticmethod
    def _flatten_text(value: Any) -> str:
        if isinstance(value, str):
            return value
        if isinstance(value, dict):
            return " \n".join(str(v) for v in value.values() if v)
        if isinstance(value, list):
            return " \n".join(str(item) for item in value if item)
        return ""

    @staticmethod
    def _collect_drawing_texts(payload: Any) -> List[str]:
        if isinstance(payload, dict):
            specs = payload.get("specifications") or []
        elif isinstance(payload, list):
            specs = payload
        else:
            specs = []
        texts: List[str] = []
        for spec in specs:
            if isinstance(spec, dict):
                text = spec.get("text") or ""
                if text:
                    texts.append(str(text))
        return texts

    def _match_spec_pair(
        self,
        description_text: str,
        tech_entities: Dict[str, set[str]],
        drawing_texts: Sequence[str],
    ) -> Optional[Dict[str, str]]:
        concretes = tech_entities.get("concretes") or set()
        exposures = tech_entities.get("exposures") or set()
        if not concretes or not exposures:
            return None

        search_targets = [("position", description_text)] + [("drawing", text) for text in drawing_texts]
        for concrete in concretes:
            for exposure in exposures:
                for source, target_text in search_targets:
                    upper = target_text.upper()
                    if concrete in upper and exposure in upper:
                        snippet = target_text.strip()
                        return {
                            "source": source,
                            "reason": "spec_pair",
                            "snippet": snippet[:160],
                        }
        return None

    def _match_concrete_without_exposure(
        self,
        position: Dict[str, Any],
        description_entities: Dict[str, set[str]],
        tech_entities: Dict[str, set[str]],
    ) -> Optional[CatalogEntry]:
        concretes = set(description_entities.get("concretes", set())) | set(
            tech_entities.get("concretes", set())
        )
        exposures = set(description_entities.get("exposures", set())) | set(
            tech_entities.get("exposures", set())
        )
        if not concretes or exposures:
            return None

        unit_key = self._normalise_unit(position.get("unit"))
        if not unit_key:
            return None

        for entry in self._entries_by_unit.get(unit_key, []):
            if entry.entities.get("concretes") & concretes:
                return entry
        return None

    def _match_fuzzy(
        self,
        description: str,
        unit: Optional[str],
    ) -> List[Tuple[float, CatalogEntry]]:
        normalized_description = normalize_text(description)
        if not normalized_description:
            return []
        candidates = self._entries_by_unit.get(self._normalise_unit(unit), self._entries)
        matches: List[Tuple[float, CatalogEntry]] = []
        for entry in candidates:
            ratio = SequenceMatcher(None, normalized_description, entry.normalized_text).ratio()
            if ratio >= 0.70:
                matches.append((ratio, entry))
        matches.sort(key=lambda item: item[0], reverse=True)
        return matches[:3]

    @staticmethod
    def _candidate_payload(entry: CatalogEntry, score: float) -> Dict[str, Any]:
        return {
            "code": entry.code,
            "system": entry.catalog,
            "description": entry.description,
            "unit": entry.unit,
            "score": round(score, 4),
        }

    @staticmethod
    def _normalise_code(code: str) -> str:
        return _CODE_RE.sub("", code.upper())

    @staticmethod
    def _normalise_unit(unit: Optional[str]) -> str:
        return normalize_text(unit or "").replace(" ", "")
