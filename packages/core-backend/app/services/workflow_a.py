"""Workflow A - Steps 1–6 implementation (upload → audit)."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import settings, ArtifactPaths
from app.models.project import ProjectStatus
from app.parsers.smart_parser import SmartParser
from app.parsers.drawing_specs_parser import DrawingSpecsParser
from app.services.audit_classifier import AuditClassifier
from app.services.position_enricher import PositionEnricher
from app.services.project_cache import (
    load_project_cache,
    load_or_create_project_cache,
    save_field,
    save_project_cache,
)
from app.services.specifications_validator import SpecificationsValidator
from app.validators import PositionValidator
from app.state.project_store import project_store
from app.utils.audit_contracts import build_audit_contract

logger = logging.getLogger(__name__)


_ARTIFACT_CONFIG: Dict[str, Dict[str, str]] = {
    "tech_card": {
        "cache_key": "tech_card",
        "filename": "tech_card.json",
    },
    "resource_sheet": {
        "cache_key": "resource_sheet",
        "filename": "resource_sheet.json",
    },
    "materials": {
        "cache_key": "material_analysis",
        "filename": "material_analysis.json",
    },
}


def _classify_position(position: Dict[str, Any]) -> str:
    """Classify a position according to validation and enrichment results."""

    if (
        position.get("validation_status") == "failed"
        or position.get("validation_error")
    ):
        return "RED"

    enrichment_block = position.get("enrichment") or {}
    match = (enrichment_block.get("match") or "none").lower()
    if match == "exact":
        return "GREEN"
    if match == "partial":
        return "AMBER"
    if match == "none":
        return "RED"
    return "AMBER"


class WorkflowA:
    """Handle Workflow A initialisation and parsing steps."""

    def __init__(self) -> None:
        self.smart_parser = SmartParser()
        self.drawing_parser = DrawingSpecsParser()
        self.validator = SpecificationsValidator()
        self.audit_classifier = AuditClassifier()
        self.schema_validator = PositionValidator()

    async def execute(
        self,
        project_id: str,
        generate_summary: bool = False,
        enable_enrichment: Optional[bool] = None,
        *,
        action: str = "execute",
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Run upload handling and parsing for Workflow A."""
        if action in _ARTIFACT_CONFIG:
            logger.info(
                "Project %s: Workflow A serving cached artifact '%s'", project_id, action
            )
            return self._serve_artifact(project_id, action)

        if action != "execute":
            logger.debug(
                "Project %s: Workflow A execute() received action '%s' (fallback to full pipeline)",
                project_id,
                action,
            )

        if kwargs:
            logger.debug(
                "Project %s: Workflow A execute() received extra kwargs: %s",
                project_id,
                sorted(kwargs.keys()),
            )
        logger.info(
            "Project %s: Starting Workflow A Step 1 (upload handling)",
            project_id,
        )

        project_meta = self._load_project_metadata(project_id)
        uploads = self._resolve_uploads(project_id, project_meta)

        base_cache = {
            "project_id": project_id,
            "workflow": "A",
            "files": uploads["files_by_type"],
        }
        cache_data, cache_path, cache_created = load_or_create_project_cache(
            project_id, base_cache
        )

        logger.info(
            "Project %s: Cache %s at %s",
            project_id,
            "created" if cache_created else "loaded",
            cache_path,
        )

        if enable_enrichment is None:
            enable_enrichment = settings.ENRICHMENT_ENABLED

        cache_data["enable_enrichment"] = enable_enrichment

        logger.info(
            "Project %s: Starting Workflow A Step 2 (parsing)",
            project_id,
        )
        parsing_summary = self._parse_cost_documents(
            project_id, uploads["cost_documents"]
        )

        schema_result = self.schema_validator.validate(parsing_summary["positions"])

        logger.info(
            "Project %s: Step 3 schema validation deduplicated=%s invalid=%s duplicates_removed=%s",
            project_id,
            schema_result.stats.get("deduplicated_total", 0),
            schema_result.stats.get("invalid_total", 0),
            schema_result.stats.get("duplicates_removed", 0),
        )

        cache_data["project_id"] = project_id
        cache_data["workflow"] = "A"
        cache_data["files"] = uploads["files_by_type"]
        parsing_summary["diagnostics"]["schema_validation"] = schema_result.stats

        cache_data.setdefault("diagnostics", {})
        cache_data["diagnostics"]["parsing"] = parsing_summary["diagnostics"]
        cache_data["diagnostics"]["schema_validation"] = schema_result.stats

        positions = schema_result.positions
        try:
            ArtifactPaths.parsed_positions(project_id).parent.mkdir(parents=True, exist_ok=True)
            with ArtifactPaths.parsed_positions(project_id).open("w", encoding="utf-8") as fp:
                json.dump({"items": positions}, fp, ensure_ascii=False, indent=2)
        except OSError as exc:
            logger.warning("Project %s: failed to persist parsed positions: %s", project_id, exc)
        cache_data["positions"] = positions
        cache_data["documents"] = parsing_summary["documents"]
        cache_data["updated_at"] = datetime.now().isoformat()

        save_project_cache(project_id, cache_data)

        self._update_project_store(
            project_id, parsing_summary, cache_path, uploads
        )

        # ------------------------------------------------------------------
        # Steps 3–6: Drawing enrichment → validation → audit
        # ------------------------------------------------------------------

        drawing_summary = self._extract_drawing_specs(
            project_id, uploads.get("drawing_files", [])
        )

        try:
            with ArtifactPaths.drawing_specs(project_id).open("w", encoding="utf-8") as fp:
                json.dump(drawing_summary, fp, ensure_ascii=False, indent=2)
        except OSError as exc:
            logger.warning("Project %s: failed to persist drawing specs: %s", project_id, exc)

        logger.info(
            "Project %s: Drawing specs detected=%s",
            project_id,
            len(drawing_summary["specifications"]),
        )

        enricher = PositionEnricher(enabled=enable_enrichment)
        enriched_positions, enrichment_stats = enricher.enrich(
            positions, drawing_summary["specifications"]
        )

        validated_positions, validation_stats = self.validator.validate(
            enriched_positions
        )

        audited_positions, audit_stats = self.audit_classifier.classify(
            validated_positions
        )

        logger.info(
            "Project %s: Audit summary GREEN=%s, AMBER=%s, RED=%s",
            project_id,
            audit_stats.get("green", 0),
            audit_stats.get("amber", 0),
            audit_stats.get("red", 0),
        )

        audit_payload = self._build_audit_payload(
            audited_positions,
            enrichment_stats,
            validation_stats,
            audit_stats,
            schema_result.stats,
        )

        totals = audit_payload.get("totals", {})
        meta = audit_payload.get("meta", {})
        audit_meta = meta.get("audit", {})
        preview = audit_payload.get("preview", [])

        cache_data["positions"] = audit_payload.get("items", [])
        cache_data["positions_preview"] = preview
        cache_data["enrichment"] = meta.get("enrichment", {})
        cache_data["validation"] = meta.get("validation", {})
        cache_data["audit"] = audit_meta
        cache_data["audit_results"] = audit_payload
        cache_data["green_count"] = audit_meta.get("green", totals.get("g", 0))
        cache_data["amber_count"] = audit_meta.get("amber", totals.get("a", 0))
        cache_data["red_count"] = audit_meta.get("red", totals.get("r", 0))
        cache_data["drawing_specs"] = drawing_summary
        cache_data["status"] = ProjectStatus.COMPLETED.value
        cache_data["progress"] = 90
        cache_data["message"] = (
            "Parsed + Enriched + Validated + Audited (Steps 1–6). Ready to export."
        )
        cache_data["updated_at"] = datetime.now().isoformat()

        save_field(project_id, "audit_results", audit_payload)
        try:
            with ArtifactPaths.audit_results(project_id).open("w", encoding="utf-8") as fp:
                json.dump(audit_payload, fp, ensure_ascii=False, indent=2)
        except OSError as exc:
            logger.warning("Project %s: failed to persist audit results: %s", project_id, exc)

        logger.info(
            "audit_results normalized: total=%d g=%d a=%d r=%d",
            totals.get("total", 0),
            totals.get("g", 0),
            totals.get("a", 0),
            totals.get("r", 0),
        )

        artifacts = self._build_artifacts(
            project_id=project_id,
            project_meta=project_store.setdefault(project_id, {}),
            audit_payload=audit_payload,
            parsing_diagnostics=parsing_summary["diagnostics"],
            drawing_summary=drawing_summary,
            enrichment_stats=enrichment_stats,
            validation_stats=validation_stats,
            schema_stats=schema_result.stats,
        )

        cache_data.setdefault("artifacts", {})

        for action_name, artifact in artifacts.items():
            config = _ARTIFACT_CONFIG[action_name]
            cache_data["artifacts"][config["cache_key"]] = artifact
            self._cache_artifact(project_id, config["cache_key"], artifact)
            self._write_artifact_to_disk(project_id, config["filename"], artifact)

        save_project_cache(project_id, cache_data)

        self._update_project_store_after_audit(
            project_id=project_id,
            cache_path=cache_path,
            uploads=uploads,
            audit_payload=audit_payload,
            enable_enrichment=enable_enrichment,
            parsing_diagnostics=parsing_summary["diagnostics"],
            drawing_diagnostics=drawing_summary["diagnostics"],
            drawing_summary=drawing_summary,
        )

        diagnostics = parsing_summary["diagnostics"]
        logger.info(
            "Project %s: Completed Steps 1–6 → %s document(s), %s positions",
            project_id,
            diagnostics["documents_processed"],
            diagnostics["normalized_total"],
        )

        return {
            "project_id": project_id,
            "workflow": "A",
            "status": ProjectStatus.COMPLETED.value,
            "cache_path": str(cache_path),
            "documents_processed": diagnostics["documents_processed"],
            "positions_total": totals.get("total", len(audited_positions)),
            "parsing": diagnostics,
            "files": uploads["files_by_type"],
            "missing_files": uploads["missing_files"],
            "enrichment": meta.get("enrichment", enrichment_stats),
            "validation": meta.get("validation", validation_stats),
            "audit": audit_meta or audit_stats,
            "audit_results": audit_payload,
            "drawing_specs": drawing_summary["diagnostics"],
            "progress": 90,
            "message": "Parsed + Enriched + Validated + Audited (Steps 1–6). Ready to export.",
            "artifacts": {
                _ARTIFACT_CONFIG[action_name]["cache_key"]: artifact
                for action_name, artifact in artifacts.items()
            },
        }

    def _build_audit_payload(
        self,
        positions: List[Dict[str, Any]],
        enrichment_stats: Dict[str, Any],
        validation_stats: Dict[str, Any],
        audit_stats: Dict[str, Any],
        schema_stats: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Normalise audit output for cache, API and export."""

        non_preview_positions: List[Dict[str, Any]] = []
        for pos in positions or []:
            if not isinstance(pos, dict):
                continue
            if pos.get("is_preview") or pos.get("preview"):
                continue
            non_preview_positions.append(pos)

        enriched_payload = build_audit_contract(
            non_preview_positions,
            enrichment_stats=enrichment_stats,
            validation_stats=validation_stats,
            audit_stats=audit_stats,
            schema_stats=schema_stats,
            classify=_classify_position,
        )

        return enriched_payload

    @staticmethod
    def _load_project_metadata(project_id: str) -> Dict[str, Any]:
        project_meta = project_store.get(project_id)
        if not project_meta:
            raise ValueError(f"Project {project_id} not found in store")
        return project_meta

    def _resolve_uploads(
        self, project_id: str, project_meta: Dict[str, Any]
    ) -> Dict[str, Any]:
        file_locations = project_meta.get("file_locations") or {}
        metadata_list = project_meta.get("files_metadata") or []

        files_by_type: Dict[str, List[Dict[str, Any]]] = {
            "vykaz_vymer": [],
            "rozpocet": [],
            "vykresy": [],
            "dokumentace": [],
            "zmeny": [],
        }
        all_files: List[Dict[str, Any]] = []
        missing_files: List[Dict[str, Any]] = []

        for meta in metadata_list:
            file_type = meta.get("file_type", "unknown")
            file_id = meta.get("file_id")
            path_str = file_locations.get(file_id)

            if not path_str:
                logger.warning(
                    "Project %s: Missing stored path for %s (%s)",
                    project_id,
                    meta.get("filename"),
                    file_type,
                )
                missing_files.append(
                    {
                        "filename": meta.get("filename"),
                        "file_type": file_type,
                        "reason": "missing_location",
                    }
                )
                continue

            path = Path(path_str)
            exists = path.exists()
            relative_path = self._safe_relative_path(path)

            file_entry = {
                "filename": meta.get("filename"),
                "file_type": file_type,
                "path": str(path),
                "relative_path": relative_path,
                "size": meta.get("size", 0),
                "uploaded_at": meta.get("uploaded_at"),
                "exists": exists,
            }

            if not exists:
                logger.warning(
                    "Project %s: File not found on disk %s (%s)",
                    project_id,
                    path,
                    file_type,
                )
                missing_files.append(
                    {
                        "filename": meta.get("filename"),
                        "file_type": file_type,
                        "path": str(path),
                        "reason": "file_missing",
                    }
                )

            files_by_type.setdefault(file_type, []).append(file_entry)
            all_files.append(file_entry)

        cost_documents = (
            files_by_type.get("vykaz_vymer", [])
            + files_by_type.get("rozpocet", [])
        )
        drawing_files = files_by_type.get("vykresy", [])

        logger.info(
            "Project %s: Resolved %s cost document(s) and %s drawing(s)",
            project_id,
            len(cost_documents),
            len(drawing_files),
        )

        if missing_files:
            logger.info(
                "Project %s: %s file(s) marked as missing",
                project_id,
                len(missing_files),
            )

        return {
            "files_by_type": files_by_type,
            "cost_documents": cost_documents,
            "drawing_files": drawing_files,
            "all_files": all_files,
            "missing_files": missing_files,
        }

    def _parse_cost_documents(
        self, project_id: str, cost_documents: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        positions: List[Dict[str, Any]] = []
        documents: List[Dict[str, Any]] = []
        diagnostics: Dict[str, Any] = {
            "documents_processed": 0,
            "raw_total": 0,
            "normalized_total": 0,
            "skipped_total": 0,
            "total_positions": 0,
            "files": [],
            "errors": [],
        }

        if not cost_documents:
            logger.warning(
                "Project %s: No Rozpočet or Výkaz výmer files found for parsing",
                project_id,
            )
            return {
                "positions": positions,
                "documents": documents,
                "diagnostics": diagnostics,
            }

        for doc in cost_documents:
            if not doc.get("exists"):
                diagnostics["errors"].append(
                    {
                        "filename": doc.get("filename"),
                        "file_type": doc.get("file_type"),
                        "error": "file_missing",
                    }
                )
                continue

            file_path = Path(doc["path"])
            logger.info(
                "Project %s: Parsing %s (%s)",
                project_id,
                doc.get("filename"),
                doc.get("file_type"),
            )

            try:
                parsed = self.smart_parser.parse(file_path, project_id=project_id)
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "Project %s: Failed parsing %s (%s): %s",
                    project_id,
                    doc.get("filename"),
                    doc.get("file_type"),
                    exc,
                )
                diagnostics["errors"].append(
                    {
                        "filename": doc.get("filename"),
                        "file_type": doc.get("file_type"),
                        "error": str(exc),
                    }
                )
                continue

            file_positions = parsed.get("positions") or []
            doc_info = parsed.get("document_info") or {}
            doc_diag = parsed.get("diagnostics") or {}

            documents.append(
                {
                    "filename": doc.get("filename"),
                    "file_type": doc.get("file_type"),
                    "document_info": doc_info,
                    "positions_count": len(file_positions),
                }
            )

            diagnostics["files"].append(
                {
                    "filename": doc.get("filename"),
                    "file_type": doc.get("file_type"),
                    "document_info": doc_info,
                    "diagnostics": doc_diag,
                    "positions_count": len(file_positions),
                }
            )

            diagnostics["raw_total"] += doc_diag.get(
                "raw_total", len(file_positions)
            )
            diagnostics["normalized_total"] += doc_diag.get(
                "normalized_total", len(file_positions)
            )
            diagnostics["skipped_total"] += doc_diag.get("skipped_total", 0)

            positions.extend(file_positions)

            logger.info(
                "Project %s: Parsed %s positions from %s",
                project_id,
                doc_diag.get("normalized_total", len(file_positions)),
                doc.get("filename"),
            )

        diagnostics["documents_processed"] = len(documents)
        diagnostics["total_positions"] = len(positions)

        return {
            "positions": positions,
            "documents": documents,
            "diagnostics": diagnostics,
        }

    def _update_project_store(
        self,
        project_id: str,
        parsing_summary: Dict[str, Any],
        cache_path: Path,
        uploads: Dict[str, Any],
    ) -> None:
        now_iso = datetime.now().isoformat()
        diagnostics = parsing_summary["diagnostics"]
        total_positions = len(parsing_summary["positions"])

        project_meta = project_store.get(project_id)
        if not project_meta:
            project_store[project_id] = {
                "project_id": project_id,
                "workflow": "A",
                "status": ProjectStatus.PROCESSING,
                "created_at": now_iso,
                "updated_at": now_iso,
                "progress": 50,
                "positions_total": total_positions,
                "positions_processed": total_positions,
                "positions_raw": diagnostics.get("raw_total", total_positions),
                "positions_skipped": diagnostics.get("skipped_total", 0),
                "diagnostics": {"parsing": diagnostics},
                "cache_path": str(cache_path),
                "files_snapshot": uploads["files_by_type"],
                "missing_files": uploads["missing_files"],
                "green_count": 0,
                "amber_count": 0,
                "red_count": 0,
                "message": "Cost documents parsed",
                "error": None,
            }
            return

        project_meta["status"] = ProjectStatus.PROCESSING
        project_meta["progress"] = max(project_meta.get("progress", 0), 50)
        project_meta["positions_total"] = total_positions
        project_meta["positions_processed"] = total_positions
        project_meta["positions_raw"] = diagnostics.get(
            "raw_total", total_positions
        )
        project_meta["positions_skipped"] = diagnostics.get("skipped_total", 0)
        project_meta["updated_at"] = now_iso
        project_meta["cache_path"] = str(cache_path)
        project_meta.setdefault("diagnostics", {})
        project_meta["diagnostics"]["parsing"] = diagnostics
        project_meta["files_snapshot"] = uploads["files_by_type"]
        project_meta["missing_files"] = uploads["missing_files"]
        project_meta["message"] = "Cost documents parsed"
        project_meta["error"] = None

    @staticmethod
    def _safe_relative_path(path: Path) -> str:
        try:
            return str(path.relative_to(settings.DATA_DIR))
        except ValueError:
            return path.name

    def _extract_drawing_specs(
        self, project_id: str, drawing_files: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        if not drawing_files:
            logger.info("Project %s: No drawing files available for enrichment", project_id)
            return {"specifications": [], "diagnostics": {"files_processed": 0, "specifications_found": 0, "errors": []}}

        logger.info(
            "Project %s: Extracting drawing specifications from %s file(s)",
            project_id,
            len(drawing_files),
        )

        result = self.drawing_parser.parse_files(drawing_files)

        return result

    def _update_project_store_after_audit(
        self,
        project_id: str,
        cache_path: Path,
        uploads: Dict[str, Any],
        audit_payload: Dict[str, Any],
        enable_enrichment: bool,
        parsing_diagnostics: Dict[str, Any],
        drawing_diagnostics: Dict[str, Any],
        drawing_summary: Optional[Dict[str, Any]] = None,
    ) -> None:
        now_iso = datetime.now().isoformat()
        project_meta = project_store.setdefault(project_id, {})

        items = audit_payload.get("items", [])
        totals = audit_payload.get("totals", {})
        meta = audit_payload.get("meta", {})
        enrichment_stats = meta.get("enrichment", {})
        validation_stats = meta.get("validation", {})
        schema_stats = meta.get("schema_validation", {})
        audit_stats = meta.get("audit") or {
            "green": totals.get("g", 0),
            "amber": totals.get("a", 0),
            "red": totals.get("r", 0),
        }
        positions_preview = audit_payload.get("preview") or items[:100]
        total_positions = totals.get("total", len(items))

        project_meta.update(
            {
                "project_id": project_id,
                "workflow": "A",
                "status": ProjectStatus.COMPLETED,
                "updated_at": now_iso,
                "progress": 90,
                "cache_path": str(cache_path),
                "files_snapshot": uploads.get("files_by_type", {}),
                "missing_files": uploads.get("missing_files", []),
                "positions_total": total_positions,
                "positions_processed": total_positions,
                "green_count": audit_stats.get("green", totals.get("g", 0)),
                "amber_count": audit_stats.get("amber", totals.get("a", 0)),
                "red_count": audit_stats.get("red", totals.get("r", 0)),
                "enable_enrichment": enable_enrichment,
                "message": "Parsed + Enriched + Validated + Audited (Steps 1–6). Ready to export.",
            }
        )

        project_meta.setdefault("diagnostics", {})
        project_meta["diagnostics"].update(
            {
                "parsing": parsing_diagnostics,
                "drawing_specs": drawing_diagnostics,
                "enrichment": enrichment_stats,
                "validation": validation_stats,
                "audit": audit_stats,
                "schema_validation": schema_stats,
            }
        )

        project_meta["audit_results"] = audit_payload
        project_meta["positions_preview"] = positions_preview

        drawing_summary = drawing_summary or {}
        drawing_spec_count = len(drawing_summary.get("specifications", []))
        page_states = dict(drawing_summary.get("diagnostics", {}).get("page_states", {}))
        page_states.setdefault("status", "completed")
        recovery_meta = {
            "used_pdfium": drawing_summary.get("used_pdfium", 0),
            "used_poppler": drawing_summary.get("used_poppler", 0),
            "ocr_pages": drawing_summary.get("ocr_pages", []),
        }

        project_meta["drawing_specs_detected"] = drawing_spec_count
        project_meta["drawing_page_states"] = {
            "good_text": page_states.get("good_text", 0),
            "encoded_text": page_states.get("encoded_text", 0),
            "image_only": page_states.get("image_only", 0),
            "status": page_states.get("status", "completed"),
        }
        project_meta["drawing_text_recovery"] = recovery_meta

        project_meta["summary"] = {
            "positions_total": total_positions,
            "green": audit_stats.get("green", totals.get("g", 0)),
            "amber": audit_stats.get("amber", totals.get("a", 0)),
            "red": audit_stats.get("red", totals.get("r", 0)),
        }

        artifacts = project_meta.get("artifacts")
        if isinstance(artifacts, dict):
            project_meta["artifacts"] = dict(artifacts)

    # ------------------------------------------------------------------
    # Artifact generation & caching helpers
    # ------------------------------------------------------------------

    def _serve_artifact(self, project_id: str, action: str) -> Dict[str, Any]:
        config = _ARTIFACT_CONFIG[action]
        project_meta = project_store.get(project_id)
        if not project_meta:
            raise ValueError(f"Project {project_id} not found in store")

        artifacts = project_meta.get("artifacts")
        if isinstance(artifacts, dict) and config["cache_key"] in artifacts:
            return artifacts[config["cache_key"]]

        disk_payload = self._read_artifact_from_disk(project_id, config["filename"])
        if disk_payload is not None:
            self._cache_artifact(project_id, config["cache_key"], disk_payload)
            self._update_cache_artifacts_field(project_id, config["cache_key"], disk_payload)
            return disk_payload

        generated = self._generate_artifact_from_cache(
            project_id=project_id,
            action=action,
            project_meta=project_meta,
        )
        self._cache_artifact(project_id, config["cache_key"], generated)
        self._write_artifact_to_disk(project_id, config["filename"], generated)
        self._update_cache_artifacts_field(project_id, config["cache_key"], generated)
        return generated

    def _artifact_dir(self, project_id: str) -> Path:
        return ArtifactPaths.artifacts_dir(project_id)

    def _write_artifact_to_disk(
        self, project_id: str, filename: str, artifact: Dict[str, Any]
    ) -> Path:
        path = self._artifact_dir(project_id) / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as file_obj:
            json.dump(artifact, file_obj, ensure_ascii=False, indent=2)
        logger.info("Project %s: Artifact %s saved to %s", project_id, filename, path)
        return path

    def _read_artifact_from_disk(
        self, project_id: str, filename: str
    ) -> Optional[Dict[str, Any]]:
        path = self._artifact_dir(project_id) / filename
        if not path.exists():
            return None
        try:
            with path.open("r", encoding="utf-8") as file_obj:
                payload = json.load(file_obj)
        except json.JSONDecodeError:
            logger.warning(
                "Project %s: Artifact %s corrupted on disk, ignoring cache", project_id, filename
            )
            return None
        logger.info("Project %s: Loaded artifact %s from disk", project_id, filename)
        return payload

    def _cache_artifact(self, project_id: str, cache_key: str, artifact: Dict[str, Any]) -> None:
        project_meta = project_store.setdefault(project_id, {})
        artifacts = project_meta.setdefault("artifacts", {})
        if not isinstance(artifacts, dict):
            artifacts = {}
            project_meta["artifacts"] = artifacts
        artifacts[cache_key] = artifact
        project_meta.setdefault("artifacts_updated_at", {})[cache_key] = datetime.now().isoformat()

    def _update_cache_artifacts_field(
        self, project_id: str, cache_key: str, artifact: Dict[str, Any]
    ) -> None:
        cache_payload, _ = load_project_cache(project_id)
        if cache_payload is None:
            cache_payload = {"project_id": project_id}
        artifacts = cache_payload.setdefault("artifacts", {})
        artifacts[cache_key] = artifact
        save_project_cache(project_id, cache_payload)

    def _generate_artifact_from_cache(
        self,
        project_id: str,
        action: str,
        project_meta: Dict[str, Any],
    ) -> Dict[str, Any]:
        cache_payload, _ = load_project_cache(project_id)
        if cache_payload is None:
            raise ValueError(f"Project {project_id} cache not initialised")

        audit_payload = cache_payload.get("audit_results")
        if not isinstance(audit_payload, dict):
            raise ValueError(f"Project {project_id} cache missing audit results")

        diagnostics = cache_payload.get("diagnostics") or {}
        parsing_diagnostics = diagnostics.get("parsing", {})
        enrichment_stats = diagnostics.get("enrichment")
        validation_stats = diagnostics.get("validation")
        schema_stats = diagnostics.get("schema_validation")
        drawing_summary = cache_payload.get("drawing_specs") or {}

        artifacts = self._build_artifacts(
            project_id=project_id,
            project_meta=project_meta,
            audit_payload=audit_payload,
            parsing_diagnostics=parsing_diagnostics,
            drawing_summary=drawing_summary,
            enrichment_stats=enrichment_stats,
            validation_stats=validation_stats,
            schema_stats=schema_stats,
        )
        return artifacts[action]

    def _build_artifacts(
        self,
        project_id: str,
        project_meta: Dict[str, Any],
        audit_payload: Dict[str, Any],
        parsing_diagnostics: Dict[str, Any],
        drawing_summary: Dict[str, Any],
        *,
        enrichment_stats: Optional[Dict[str, Any]] = None,
        validation_stats: Optional[Dict[str, Any]] = None,
        schema_stats: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Dict[str, Any]]:
        totals = audit_payload.get("totals", {})
        meta = audit_payload.get("meta", {})
        enrichment_stats = enrichment_stats or meta.get("enrichment", {})
        validation_stats = validation_stats or meta.get("validation", {})
        schema_stats = schema_stats or meta.get("schema_validation", {})
        audit_stats = meta.get("audit") or {
            "green": totals.get("g", 0),
            "amber": totals.get("a", 0),
            "red": totals.get("r", 0),
        }

        items: List[Dict[str, Any]] = [
            item
            for item in (audit_payload.get("items") or [])
            if isinstance(item, dict)
        ]

        project_name = (
            project_meta.get("project_name")
            or project_meta.get("name")
            or f"Projekt {project_id}"
        )

        tech_card = self._build_tech_card_artifact(
            items,
            parsing_diagnostics=parsing_diagnostics,
            drawing_summary=drawing_summary,
            audit_stats=audit_stats,
            validation_stats=validation_stats,
            metadata=self._build_artifact_metadata(project_id, project_name),
        )

        resource_sheet = self._build_resource_sheet_artifact(
            items,
            totals=totals,
            parsing_diagnostics=parsing_diagnostics,
            audit_stats=audit_stats,
            metadata=self._build_artifact_metadata(project_id, project_name),
        )

        materials = self._build_materials_artifact(
            items,
            enrichment_stats=enrichment_stats,
            validation_stats=validation_stats,
            metadata=self._build_artifact_metadata(project_id, project_name),
        )

        # Include schema stats for completeness in cache metadata
        for artifact in (tech_card, resource_sheet, materials):
            artifact.setdefault("metadata", {}).setdefault(
                "schema_validation", schema_stats
            )

        return {
            "tech_card": tech_card,
            "resource_sheet": resource_sheet,
            "materials": materials,
        }

    def _build_artifact_metadata(
        self, project_id: str, project_name: str
    ) -> Dict[str, Any]:
        return {
            "project_id": project_id,
            "project_name": project_name,
            "generated_at": datetime.now().isoformat(),
            "generated_by": "workflow_a",
        }

    def _build_tech_card_artifact(
        self,
        items: List[Dict[str, Any]],
        *,
        parsing_diagnostics: Dict[str, Any],
        drawing_summary: Dict[str, Any],
        audit_stats: Dict[str, Any],
        validation_stats: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        total_documents = parsing_diagnostics.get("documents_processed", 0)
        total_positions = parsing_diagnostics.get("total_positions") or len(items)

        steps = [
            {
                "step_num": 1,
                "title": "Příprava a normalizace",
                "description": "Zpracování vstupních dokumentů a sjednocení jednotek a čísel.",
                "duration_minutes": max(30, total_documents * 12),
                "workers": 2,
            },
            {
                "step_num": 2,
                "title": "Validace a obohacení",
                "description": "Automatická validace struktur a doplnění údajů ze znalostních bází.",
                "duration_minutes": max(45, total_positions * 3),
                "workers": 3,
            },
            {
                "step_num": 3,
                "title": "Audit a doporučení",
                "description": "Kontrola souladu s normami, příprava doporučení a exportních výstupů.",
                "duration_minutes": max(
                    60,
                    (
                        audit_stats.get("green", 0)
                        + audit_stats.get("amber", 0)
                        + audit_stats.get("red", 0)
                    )
                    * 4,
                ),
                "workers": 2,
            },
        ]

        quality_checks = [
            {
                "check": "Schválení datových struktur",
                "timing": "po parsování",
                "pass": f"{validation_stats.get('passed', 0)} položek bez chyb",
            },
            {
                "check": "Kontrola na odchylky",
                "timing": "po auditu",
                "pass": f"{audit_stats.get('amber', 0)} položek vyžaduje dohled, {audit_stats.get('red', 0)} kritických",
            },
        ]

        drawing_specs = drawing_summary.get("specifications") or []
        norms: List[Dict[str, Any]] = []
        for spec in drawing_specs[:5]:
            ref = spec.get("standard") or spec.get("id") or spec.get("code")
            detail = spec.get("description") or spec.get("title") or spec.get("type")
            if ref or detail:
                norms.append(
                    {
                        "ref": str(ref or detail),
                        "requirement": detail or "Viz specifikace výkresů",
                    }
                )

        if not norms:
            norms = [
                {
                    "ref": "ČSN 73 2601",
                    "requirement": "Technologická kázeň betonáže a kontrola krytí výztuže.",
                }
            ]

        safety_requirements = [
            "Používat OOPP pro práce ve výškách",
            "Zajistit vymezení pracovních zón a kontrolu vibrační techniky",
        ]

        sorted_items = sorted(
            items,
            key=lambda entry: entry.get("quantity") or 0,
            reverse=True,
        )
        materials_used = [
            {
                "material": entry.get("description", "Neznámá položka"),
                "qty": entry.get("quantity", 0) or 0,
                "unit": entry.get("unit") or "",
            }
            for entry in sorted_items[:5]
            if entry.get("quantity")
        ]

        status = "OK"
        warnings: List[Dict[str, Any]] = []
        if audit_stats.get("red", 0):
            status = "ERROR"
            warnings.append(
                {
                    "level": "ERROR",
                    "message": "Byly zjištěny kritické položky vyžadující zásah.",
                }
            )
        elif audit_stats.get("amber", 0):
            status = "WARNING"
            warnings.append(
                {
                    "level": "WARNING",
                    "message": "Některé položky vyžadují ruční ověření.",
                }
            )

        artifact = {
            "type": "tech_card",
            "title": f"Technologická karta – {metadata['project_name']}",
            "data": {
                "title": f"Technologický postup projektu {metadata['project_name']}",
                "steps": steps,
                "quality_checks": quality_checks,
                "safety_requirements": safety_requirements,
                "materials_used": materials_used,
                "norms": norms,
            },
            "metadata": metadata,
            "navigation": {
                "title": "Technologický postup",
                "sections": [
                    {"id": "steps", "label": "Postup", "icon": "🛠️"},
                    {"id": "quality", "label": "Kontroly", "icon": "✅"},
                    {"id": "safety", "label": "Bezpečnost", "icon": "⚠️"},
                ],
                "active_section": "steps",
            },
            "actions": [],
            "status": status,
            "warnings": warnings,
        }
        return artifact

    def _build_resource_sheet_artifact(
        self,
        items: List[Dict[str, Any]],
        *,
        totals: Dict[str, Any],
        parsing_diagnostics: Dict[str, Any],
        audit_stats: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        section_stats: Dict[str, Dict[str, Any]] = {}
        for entry in items:
            provenance = entry.get("provenance") or {}
            section_name = provenance.get("section") or "SO-001"
            bucket = section_stats.setdefault(
                section_name,
                {
                    "labor_hours": 0.0,
                    "equipment_hours": 0.0,
                    "materials_cost": 0.0,
                    "positions": [],
                },
            )
            quantity = entry.get("quantity") or 0.0
            bucket["labor_hours"] += max(quantity * 1.8, 1.0)
            bucket["equipment_hours"] += max(quantity * 0.6, 0.5)
            bucket["materials_cost"] += max(quantity * 950, 500)
            bucket["positions"].append(entry)

        by_section = []
        for section, stats in section_stats.items():
            labor_hours = int(round(stats["labor_hours"]))
            equipment_hours = int(round(stats["equipment_hours"]))
            materials_cost = int(round(stats["materials_cost"]))
            positions = stats.get("positions") or []
            first_position = positions[0] if positions else {}
            provenance = (
                first_position.get("provenance")
                if isinstance(first_position, dict)
                else {}
            ) or {}
            labor_by_trade = {
                "Tesař": {
                    "hours": int(labor_hours * 0.4),
                    "workers": 4,
                    "duration_days": max(2, labor_hours // 8),
                },
                "Betonář": {
                    "hours": int(labor_hours * 0.35),
                    "workers": 3,
                    "duration_days": max(2, labor_hours // 10),
                },
                "Kontrolor": {
                    "hours": max(4, labor_hours // 6),
                    "workers": 1,
                    "duration_days": max(1, labor_hours // 12),
                },
            }
            equipment_by_type = {
                "Jeřáb mobilní": {"hours": int(equipment_hours * 0.45)},
                "Vibrátor": {"hours": int(equipment_hours * 0.35)},
                "Doprava": {"hours": max(2, int(equipment_hours * 0.2))},
            }

            timeline_duration = max(3, labor_hours // 6)
            timeline = {
                "start_day": 1,
                "end_day": timeline_duration + 1,
                "critical_path": "Oppalubka → Armování → Betonáž",
            }

            by_section.append(
                {
                    "section": section,
                    "section_title": provenance.get("sheet") or section,
                    "labor": {
                        "total_hours": labor_hours,
                        "by_trade": labor_by_trade,
                    },
                    "equipment": {
                        "total_hours": equipment_hours,
                        "by_type": equipment_by_type,
                    },
                    "materials_cost": materials_cost,
                    "timeline": timeline,
                }
            )

        total_labor_hours = sum(section["labor"]["total_hours"] for section in by_section)
        total_equipment_hours = sum(
            section["equipment"]["total_hours"] for section in by_section
        )
        total_materials_cost = sum(section["materials_cost"] for section in by_section)

        summary = {
            "total_labor_hours": total_labor_hours,
            "total_equipment_hours": total_equipment_hours,
            "total_materials_cost": total_materials_cost,
            "estimated_duration_days": max(1, parsing_diagnostics.get("documents_processed", 1) * 10),
        }

        team_composition = {
            "Mistr": 1,
            "Technolog": max(1, totals.get("a", 0) + totals.get("r", 0)),
            "Kontrolor": max(1, totals.get("r", 0)),
            "Dělníci": max(4, totals.get("total", len(items)) // 3 or 4),
        }

        equipment_schedule = {
            "Jeřáb mobilní": "Den 1-30",
            "Autodomíchávač": "Den 5-20",
            "Vibrátor": "Podle potřeby během betonáže",
        }

        status = "OK"
        warnings: List[Dict[str, Any]] = []
        if audit_stats.get("red", 0):
            status = "ERROR"
            warnings.append(
                {
                    "level": "ERROR",
                    "message": "Kritické položky mohou ovlivnit kapacitní plán.",
                }
            )
        elif audit_stats.get("amber", 0):
            status = "WARNING"
            warnings.append(
                {
                    "level": "WARNING",
                    "message": "Plán zahrnuje položky s varováním, zvažte revizi zdrojů.",
                }
            )

        artifact = {
            "type": "resource_sheet",
            "title": "Zdroje",
            "data": {
                "summary": summary,
                "by_section": by_section,
                "team_composition": team_composition,
                "equipment_schedule": equipment_schedule,
            },
            "metadata": metadata,
            "navigation": {
                "title": "Zdroje - přehled",
                "sections": [
                    {"id": "summary", "label": "Souhrn", "icon": "📊"},
                    {"id": "labor", "label": "Práce", "icon": "👷"},
                    {"id": "equipment", "label": "Technika", "icon": "🚜"},
                ],
                "active_section": "summary",
            },
            "actions": [],
            "status": status,
            "warnings": warnings,
        }
        return artifact

    def _build_materials_artifact(
        self,
        items: List[Dict[str, Any]],
        *,
        enrichment_stats: Dict[str, Any],
        validation_stats: Dict[str, Any],
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        materials_block = []
        total_cost = 0.0
        material_types: List[str] = []

        for entry in items:
            quantity = entry.get("quantity") or 0.0
            unit = entry.get("unit") or ""
            description = entry.get("description", "Neznámá položka")
            material_type = self._guess_material_type(description)
            material_types.append(material_type)
            estimated_cost = float(quantity) * (1500 if entry.get("status") == "RED" else 1100)
            total_cost += estimated_cost
            provenance = entry.get("provenance") or {}

            materials_block.append(
                {
                    "id": provenance.get("position_id") or entry.get("code") or description,
                    "type": material_type,
                    "brand": description,
                    "quantity": {"total": quantity, "unit": unit},
                    "unit": unit,
                    "characteristics": {
                        "status": entry.get("status", "UNKNOWN"),
                        "issues": len(entry.get("issues") or []),
                    },
                    "used_in": [
                        {
                            "section": provenance.get("section") or "SO-001",
                            "work": provenance.get("sheet") or "Výkaz",
                            "qty": quantity,
                        }
                    ],
                    "suppliers": [
                        {
                            "name": "Regionální dodavatel",
                            "distance": "do 50 km",
                            "price": int(estimated_cost / quantity) if quantity else None,
                            "delivery": "48 h",
                        }
                    ],
                    "norms": ["ČSN", "Interní standardy"],
                }
            )

        summary = {
            "total_materials": len(materials_block),
            "material_types": sorted({typ for typ in material_types}),
            "total_cost": int(round(total_cost)),
            "enrichment_matched": enrichment_stats.get("matched") if isinstance(enrichment_stats, dict) else None,
            "validation_passed": validation_stats.get("passed") if isinstance(validation_stats, dict) else None,
        }

        status = "OK"
        warnings: List[Dict[str, Any]] = []
        amber_total = enrichment_stats.get("partial") if isinstance(enrichment_stats, dict) else 0
        red_total = enrichment_stats.get("unmatched") if isinstance(enrichment_stats, dict) else 0
        if red_total:
            status = "ERROR"
            warnings.append(
                {
                    "level": "ERROR",
                    "message": "Některé materiály nebyly ověřeny v znalostní bázi.",
                }
            )
        elif amber_total:
            status = "WARNING"
            warnings.append(
                {
                    "level": "WARNING",
                    "message": "Část materiálů má pouze částečné shody v enrichmentu.",
                }
            )

        artifact = {
            "type": "materials_detailed",
            "title": "Materiály",
            "data": {
                "materials": materials_block,
                "summary": summary,
            },
            "metadata": metadata,
            "navigation": {
                "title": "Materiály - detailní přehled",
                "sections": [
                    {"id": "summary", "label": "Souhrn", "icon": "📦"},
                    {"id": "materials", "label": "Materiály", "icon": "🧱"},
                ],
                "active_section": "materials",
            },
            "actions": [],
            "status": status,
            "warnings": warnings,
        }
        return artifact

    @staticmethod
    def _guess_material_type(description: str) -> str:
        token = (description or "").lower()
        if "beton" in token:
            return "Beton"
        if "arm" in token or "výzt" in token:
            return "Armatura"
        if "ocel" in token:
            return "Ocel"
        if "zem" in token:
            return "Zemní práce"
        return "Materiál"


class WorkflowAService:
    """Синглтон сервис для Workflow A"""

    def __init__(self):
        self._workflows = {}  # Кэш активных workflow

    async def run(
        self, project_id: str, action: str = "execute", **kwargs: Any
    ) -> Dict[str, Any]:
        """Dispatch all actions through WorkflowA.execute"""

        workflow = self._workflows.get(project_id)
        if workflow is None:
            workflow = WorkflowA()
            self._workflows[project_id] = workflow

        return await workflow.execute(
            project_id=project_id,
            action=action,
            **kwargs,
        )

    async def execute(self, project_id: str, **kwargs):
        """Алиас для совместимости"""
        return await self.run(project_id, **kwargs)


# Создаём синглтон
workflow_a = WorkflowAService()


# Экспортируем
__all__ = ['WorkflowA', 'workflow_a']
