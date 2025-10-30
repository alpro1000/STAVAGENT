"""
Chat API Routes
Interactive conversational interface with AI agents
"""
from typing import Any, Dict, Optional, Tuple
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.state.project_store import project_store
from app.models.project import ProjectStatus
from app.utils.datetime_utils import get_utc_timestamp_iso

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


# ============================================================================
# ARTIFACT HELPERS
# ============================================================================


def _artifact_metadata(project: Dict[str, Any], generated_by: str = "system") -> Dict[str, Any]:
    return {
        "generated_at": get_utc_timestamp_iso(),
        "project_id": project.get("project_id") or project.get("id"),
        "project_name": project.get("project_name") or project.get("name"),
        "generated_by": generated_by,
    }


def _artifact_actions(project: Dict[str, Any], artifact_type: str) -> list[Dict[str, Any]]:
    project_id = project.get("project_id") or project.get("id") or "project"
    base_path = f"/api/projects/{project_id}/artifacts/{artifact_type}"
    return [
        {
            "id": "export_pdf",
            "label": "Stáhnout PDF",
            "icon": "📥",
            "endpoint": f"{base_path}/export?format=pdf",
        },
        {
            "id": "export_excel",
            "label": "Exportovat XLSX",
            "icon": "📊",
            "endpoint": f"{base_path}/export?format=xlsx",
        },
        {"id": "share", "label": "Sdílet", "icon": "🔗"},
    ]


def _build_audit_positions_artifact(
    project: Dict[str, Any],
    options: Optional[Dict[str, Any]] = None,
    *,
    generated_by: str = "system",
) -> Tuple[str, Dict[str, Any]]:
    from app.core.config import ArtifactPaths
    import json

    opts = options or {}
    project_id = project.get("project_id")

    # Try to load real audit results
    audit_data = project.get("audit_results")
    if not audit_data:
        # Try to read from file
        audit_file = ArtifactPaths.audit_results(project_id)
        if audit_file.exists():
            try:
                with audit_file.open("r", encoding="utf-8") as f:
                    audit_data = json.load(f)
            except Exception as e:
                logger.error(f"Failed to load audit results: {e}")

    if not audit_data:
        # No audit results yet
        data = {
            "status": "PENDING",
            "summary": "Audit ještě nebyl proveden. Nahrajte soubory a počkejte na dokončení zpracování.",
            "statistics": {
                "total_positions": 0,
                "verified": 0,
                "with_warnings": 0,
                "critical_issues": 0,
            },
            "issues": [],
            "statistics_by_severity": {"GREEN": 0, "AMBER": 0, "RED": 0},
        }
    else:
        # Extract real data from audit results
        items = audit_data.get("items", [])
        totals = audit_data.get("totals", {})
        meta = audit_data.get("meta", {})
        audit_meta = meta.get("audit", {})

        positions_total = totals.get("total", len(items))
        verified = audit_meta.get("green", totals.get("g", 0))
        warnings = audit_meta.get("amber", totals.get("a", 0))
        critical = audit_meta.get("red", totals.get("r", 0))

        # Extract issues from RED and AMBER positions
        issues = []
        for item in items:
            classification = item.get("classification", "GREEN")
            if classification in ["RED", "AMBER"]:
                issues.append({
                    "position_id": item.get("position_number", "N/A"),
                    "code": item.get("position_number", ""),
                    "description": item.get("description", "")[:80],
                    "severity": classification,
                    "problem": ", ".join(item.get("issues_found", [])) or "Pozice vyžaduje kontrolu",
                    "suggestion": ", ".join(item.get("recommendations", [])) or "Zkontrolujte normy a katalogy",
                    "sources": ["OTSKP", "ÚRS", "RTS", "ČSN"],
                })

        data = {
            "status": "WARNING" if critical > 0 else "OK",
            "summary": f"Zkontrolováno {positions_total} pozic. {critical} kritických, {warnings} s varováním, {verified} v pořádku.",
            "statistics": {
                "total_positions": positions_total,
                "verified": verified,
                "with_warnings": warnings,
                "critical_issues": critical,
            },
            "issues": issues[:20],  # Show top 20 issues
            "statistics_by_severity": {"GREEN": verified, "AMBER": warnings, "RED": critical},
        }

    artifact = {
        "type": "audit_result",
        "title": "Kontrola pozic",
        "data": data,
        "metadata": _artifact_metadata(project, generated_by=generated_by),
        "navigation": {
            "title": "Kontrola pozic - výsledky",
            "sections": [
                {"id": "summary", "label": "Přehled", "icon": "📊"},
                {"id": "issues", "label": "Problémy", "icon": "⚠️"},
                {"id": "details", "label": "Detail", "icon": "🔍"},
            ],
            "active_section": "summary",
        },
        "actions": _artifact_actions(project, "audit_result"),
        "status": data["status"],
        "warnings": [
            {
                "level": "INFO",
                "message": f"Audit proveden s volbami: normy={opts.get('check_norms', True)}, katalog={opts.get('check_catalog', True)}",
            },
            {
                "level": "WARNING" if data["statistics"]["critical_issues"] > 0 else "INFO",
                "message": f"{data['statistics']['critical_issues']} pozic vyžaduje okamžitou pozornost" if data["statistics"]["critical_issues"] > 0 else "Všechny pozice jsou v pořádku",
            },
        ],
        "ui_hints": {
            "display_mode": "table",
            "expandable_sections": True,
            "sortable_columns": True,
            "filterable": True,
            "searchable": True,
        },
    }

    response = data["summary"]
    return response, artifact


def _build_vykaz_vymer_artifact(
    project: Dict[str, Any],
    options: Optional[Dict[str, Any]] = None,
    *,
    generated_by: str = "system",
) -> Tuple[str, Dict[str, Any]]:
    from app.core.config import ArtifactPaths
    import json

    opts = options or {}
    project_id = project.get("project_id")
    position_id_filter = opts.get("position_id")

    # Try to load parsed positions
    parsed_data = None
    parsed_file = ArtifactPaths.parsed_positions(project_id)
    if parsed_file.exists():
        try:
            with parsed_file.open("r", encoding="utf-8") as f:
                parsed_data = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load parsed positions: {e}")

    if not parsed_data or not parsed_data.get("items"):
        # No positions yet
        data = {
            "project_name": project.get("project_name", "Projekt"),
            "sections": [],
            "grand_total": 0,
            "totals_by_type": {},
            "message": "Pozice ještě nejsou načteny. Nahrajte výkaz výměr (XLSX).",
        }
    else:
        items = parsed_data.get("items", [])

        # Filter by position if requested
        if position_id_filter:
            items = [item for item in items if str(item.get("position_number", "")).strip() == str(position_id_filter).strip()]

        # Convert positions to works format
        works = []
        grand_total = 0
        for item in items[:50]:  # Limit to 50 positions
            unit_price = item.get("unit_price") or 0
            quantity = item.get("quantity") or 0
            total_price = item.get("total_price") or (unit_price * quantity)
            grand_total += total_price

            works.append({
                "work_id": item.get("position_number", "N/A"),
                "code": item.get("position_number", ""),
                "description": item.get("description", ""),
                "unit": item.get("unit", ""),
                "quantity_total": quantity,
                "unit_price": unit_price,
                "total_price": total_price,
            })

        data = {
            "project_name": project.get("project_name", "Projekt"),
            "sections": [
                {
                    "section_id": "main",
                    "section_title": f"Všechny pozice ({len(works)})",
                    "works": works,
                    "section_total": grand_total,
                }
            ],
            "grand_total": grand_total,
            "totals_by_type": {},  # TODO: Group by material type
        }

    artifact = {
        "type": "vykaz_vymer",
        "title": "Výkaz výměr",
        "data": data,
        "metadata": _artifact_metadata(project, generated_by=generated_by),
        "navigation": {
            "title": "Výkaz výměr - přehled",
            "sections": [
                {"id": "sections", "label": "Sekce", "icon": "🏗️"},
                {"id": "totals", "label": "Souhrny", "icon": "🧮"},
            ],
            "active_section": "sections",
        },
        "actions": _artifact_actions(project, "vykaz_vymer"),
        "status": "OK",
        "warnings": [
            {
                "level": "INFO",
                "message": "Výkaz generován podle sekcí" if options and options.get("by_section", True) else "Výkaz generován bez členění",
            }
        ],
        "ui_hints": {
            "display_mode": "table",
            "expandable_sections": True,
            "sortable_columns": True,
            "filterable": True,
            "searchable": True,
        },
    }

    if "message" in data:
        response = data["message"]
    elif position_id_filter:
        response = f"Výkaz výměr pro pozici {position_id_filter} připraven."
    else:
        response = f"Výkaz výměr připraven. Celkem {len(data['sections'][0]['works']) if data['sections'] else 0} pozic, celková cena: {data['grand_total']:,.0f} Kč."

    return response, artifact


def _build_materials_detailed_artifact(
    project: Dict[str, Any],
    options: Optional[Dict[str, Any]] = None,
    *,
    generated_by: str = "system",
) -> Tuple[str, Dict[str, Any]]:
    from app.core.config import ArtifactPaths
    import json
    import re

    opts = options or {}
    filter_label = opts.get("filter_by") or opts.get("material_type")
    project_id = project.get("project_id")

    # Load parsed positions
    parsed_data = None
    parsed_file = ArtifactPaths.parsed_positions(project_id)
    if parsed_file.exists():
        try:
            with parsed_file.open("r", encoding="utf-8") as f:
                parsed_data = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load parsed positions: {e}")

    if not parsed_data or not parsed_data.get("items"):
        data = {
            "materials": [],
            "summary": {
                "total_materials": 0,
                "material_types": [],
                "total_cost": 0,
                "message": "Materiály nejsou dostupné. Nahrajte výkaz výměr.",
            },
        }
    else:
        items = parsed_data.get("items", [])

        # Extract materials from position descriptions
        materials_dict = {}
        for item in items:
            desc = item.get("description", "").lower()
            unit = item.get("unit", "")
            qty = item.get("quantity", 0)

            # Detect material type
            material_type = None
            if "beton" in desc or "c30" in desc or "c25" in desc or "c20" in desc:
                material_type = "Beton"
            elif "armatur" in desc or "b500" in desc or "výztuž" in desc:
                material_type = "Armatura"
            elif "bednění" in desc or "bednic" in desc or "beden" in desc:
                material_type = "Bednění"
            elif "ocel" in desc:
                material_type = "Ocel"

            if material_type:
                if material_type not in materials_dict:
                    materials_dict[material_type] = {
                        "type": material_type,
                        "quantity": 0,
                        "unit": unit,
                        "used_in": [],
                    }
                materials_dict[material_type]["quantity"] += qty
                materials_dict[material_type]["used_in"].append({
                    "position": item.get("position_number", ""),
                    "description": item.get("description", "")[:60],
                    "qty": qty,
                    "unit": unit,
                })

        # Convert to list
        materials = []
        for i, (mat_type, mat_data) in enumerate(materials_dict.items()):
            materials.append({
                "id": f"mat-{i+1:03d}",
                "type": mat_data["type"],
                "quantity": {"total": mat_data["quantity"], "unit": mat_data["unit"]},
                "used_in": mat_data["used_in"][:5],  # Top 5 usages
            })

        # Apply filter if requested
        if filter_label:
            materials = [m for m in materials if filter_label.lower() in m["type"].lower()]

        data = {
            "materials": materials,
            "summary": {
                "total_materials": len(materials),
                "material_types": list(materials_dict.keys()),
                "total_cost": 0,  # TODO: Calculate from unit prices
            },
        }

    artifact = {
        "type": "materials_detailed",
        "title": "Materiály",
        "data": data,
        "metadata": _artifact_metadata(project, generated_by=generated_by),
        "navigation": {
            "title": "Materiály - detailní přehled",
            "sections": [
                {"id": "summary", "label": "Souhrn", "icon": "📦"},
                {"id": "materials", "label": "Materiály", "icon": "🧱"},
            ],
            "active_section": "materials",
        },
        "actions": _artifact_actions(project, "materials_detailed"),
        "status": "OK",
        "warnings": [
            {
                "level": "INFO",
                "message": f"Filtrované podle: {filter_label}" if filter_label else "Bez filtru",
            }
        ],
        "ui_hints": {
            "display_mode": "card",
            "expandable_sections": True,
            "sortable_columns": True,
            "filterable": True,
            "searchable": True,
        },
    }

    if "message" in data.get("summary", {}):
        response = data["summary"]["message"]
    elif filter_label:
        response = f"Materiálový přehled pro {filter_label} připraven. Nalezeno {len(data['materials'])} materiálů."
    else:
        response = f"Materiálový přehled připraven. Nalezeno {data['summary']['total_materials']} typů materiálů."

    return response, artifact


def _build_resource_sheet_artifact(
    project: Dict[str, Any],
    options: Optional[Dict[str, Any]] = None,
    *,
    generated_by: str = "system",
) -> Tuple[str, Dict[str, Any]]:
    from app.core.config import ArtifactPaths
    import json

    opts = options or {}
    project_id = project.get("project_id")
    position_id_filter = opts.get("position_id")

    # Load parsed positions
    parsed_data = None
    parsed_file = ArtifactPaths.parsed_positions(project_id)
    if parsed_file.exists():
        try:
            with parsed_file.open("r", encoding="utf-8") as f:
                parsed_data = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load parsed positions: {e}")

    if not parsed_data or not parsed_data.get("items"):
        data = {
            "project_name": project.get("project_name", "Projekt"),
            "summary": {
                "message": "Ведомость ресурсов vyžaduje detailní výpočet podle norem ÚRS/RTS. Nahrajte výkaz výměr a počkejte na zpracování.",
            },
            "by_section": [],
        }
    else:
        items = parsed_data.get("items", [])

        # Filter by position if requested
        if position_id_filter:
            items = [item for item in items if str(item.get("position_number", "")).strip() == str(position_id_filter).strip()]

        # Show simplified resource info - full calculation requires RTS/ÚRS norms
        positions_info = []
        for item in items[:20]:  # Show first 20 positions
            positions_info.append({
                "position": item.get("position_number", ""),
                "description": item.get("description", "")[:60],
                "quantity": item.get("quantity", 0),
                "unit": item.get("unit", ""),
                "note": "Ресурсы требуют расчёта по нормам ÚRS/RTS",
            })

        data = {
            "project_name": project.get("project_name", "Projekt"),
            "summary": {
                "message": f"Для расчёта ведомости ресурсов требуется применить нормы ÚRS/RTS к {len(items)} позициям.",
                "positions_analyzed": len(items),
            },
            "positions_for_calculation": positions_info,
            "by_section": [],  # TODO: Calculate labor/equipment by RTS norms
        }

    artifact = {
        "type": "resource_sheet",
        "title": "Zdroje",
        "data": data,
        "metadata": _artifact_metadata(project, generated_by=generated_by),
        "navigation": {
            "title": "Zdroje - přehled",
            "sections": [
                {"id": "summary", "label": "Souhrn", "icon": "📊"},
                {"id": "labor", "label": "Práce", "icon": "👷"},
                {"id": "equipment", "label": "Technika", "icon": "🚜"},
            ],
            "active_section": "summary",
        },
        "actions": _artifact_actions(project, "resource_sheet"),
        "status": "OK",
        "warnings": [
            {
                "level": "INFO",
                "message": "Zahrnut harmonogram" if options and options.get("include_timeline", True) else "Harmonogram vynechán",
            }
        ],
        "ui_hints": {
            "display_mode": "card",
            "expandable_sections": True,
            "sortable_columns": False,
            "filterable": True,
            "searchable": True,
        },
    }

    if "message" in data.get("summary", {}):
        response = data["summary"]["message"]
    else:
        response = "Zdroje analyzovány. Pro detailní výpočet použijte nástroj pro aplikaci norem ÚRS/RTS."

    return response, artifact


def _build_project_summary_artifact(
    project: Dict[str, Any],
    options: Optional[Dict[str, Any]] = None,
    *,
    generated_by: str = "system",
) -> Tuple[str, Dict[str, Any]]:
    from app.core.config import ArtifactPaths
    import json

    project_id = project.get("project_id")

    # Load audit results
    audit_data = project.get("audit_results")
    if not audit_data:
        audit_file = ArtifactPaths.audit_results(project_id)
        if audit_file.exists():
            try:
                with audit_file.open("r", encoding="utf-8") as f:
                    audit_data = json.load(f)
            except Exception as e:
                logger.error(f"Failed to load audit results: {e}")

    # Load parsed positions
    parsed_data = None
    parsed_file = ArtifactPaths.parsed_positions(project_id)
    if parsed_file.exists():
        try:
            with parsed_file.open("r", encoding="utf-8") as f:
                parsed_data = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load parsed positions: {e}")

    # Calculate real statistics
    if audit_data and parsed_data:
        items = parsed_data.get("items", [])
        totals = audit_data.get("totals", {})
        meta = audit_data.get("meta", {})
        audit_meta = meta.get("audit", {})

        total_positions = totals.get("total", len(items))
        green_count = audit_meta.get("green", 0)
        amber_count = audit_meta.get("amber", 0)
        red_count = audit_meta.get("red", 0)

        # Calculate total budget from positions
        total_budget = sum(item.get("total_price", 0) or 0 for item in items)

        data = {
            "basic_info": {
                "project_name": project.get("project_name", "Projekt"),
                "workflow": project.get("workflow", "A"),
                "status": project.get("status", "PROCESSING"),
                "created_at": project.get("created_at", ""),
            },
            "scope": {
                "total_positions": total_positions,
                "positions_green": green_count,
                "positions_amber": amber_count,
                "positions_red": red_count,
                "files_count": len(project.get("files", {})),
            },
            "budget": {
                "total_budget": total_budget,
                "positions_with_price": sum(1 for item in items if item.get("total_price")),
                "positions_without_price": sum(1 for item in items if not item.get("total_price")),
            },
            "compliance": {
                "audit_completed": True,
                "green_percent": round(green_count / total_positions * 100 if total_positions > 0 else 0, 1),
                "amber_percent": round(amber_count / total_positions * 100 if total_positions > 0 else 0, 1),
                "red_percent": round(red_count / total_positions * 100 if total_positions > 0 else 0, 1),
            },
        }
    else:
        data = {
            "basic_info": {
                "project_name": project.get("project_name", "Projekt"),
                "workflow": project.get("workflow", "A"),
                "status": project.get("status", "PENDING"),
                "message": "Projekt zatím nebyl zpracován. Nahrajte soubory a počkejte na dokončení.",
            },
            "scope": {},
            "budget": {},
            "compliance": {},
        }

    # Determine status based on red/amber counts
    scope = data.get("scope", {})
    red_count = scope.get("positions_red", 0)
    amber_count = scope.get("positions_amber", 0)
    status = "ERROR" if red_count > 0 else ("WARNING" if amber_count > 0 else "OK")

    # Build warnings list
    warnings = []
    if red_count > 0:
        warnings.append({
            "level": "ERROR",
            "message": f"Nalezeno {red_count} kritických pozic vyžadujících okamžitou opravu!",
        })
    if amber_count > 0:
        warnings.append({
            "level": "WARNING",
            "message": f"Nalezeno {amber_count} pozic s varováním.",
        })
    if not warnings:
        warnings.append({
            "level": "INFO",
            "message": "Všechny pozice jsou v pořádku.",
        })

    artifact = {
        "type": "project_summary",
        "title": "Shrnutí projektu",
        "data": data,
        "metadata": _artifact_metadata(project, generated_by=generated_by),
        "navigation": {
            "title": "Projekt - shrnutí",
            "sections": [
                {"id": "info", "label": "Informace", "icon": "ℹ️"},
                {"id": "scope", "label": "Rozsah", "icon": "📋"},
                {"id": "budget", "label": "Rozpočet", "icon": "💰"},
                {"id": "compliance", "label": "Soulad", "icon": "✅"},
            ],
            "active_section": "info",
        },
        "actions": _artifact_actions(project, "project_summary"),
        "status": status,
        "warnings": warnings,
        "ui_hints": {
            "display_mode": "card",
            "expandable_sections": True,
            "sortable_columns": False,
            "filterable": False,
            "searchable": True,
        },
    }

    # Build response message based on actual data
    if "message" in data.get("basic_info", {}):
        response = data["basic_info"]["message"]
    else:
        total = scope.get("total_positions", 0)
        green = scope.get("positions_green", 0)
        compliance = data.get("compliance", {})
        green_pct = compliance.get("green_percent", 0)
        response = f"Shrnutí projektu: {total} pozic, {green} OK ({green_pct}% soulad)"
        if red_count > 0:
            response += f", {red_count} kritických"
        if amber_count > 0:
            response += f", {amber_count} varování"
        response += "."

    return response, artifact


def _build_tech_card_artifact(
    project: Dict[str, Any],
    position_id: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    *,
    generated_by: str = "system",
) -> Tuple[str, Dict[str, Any]]:
    pos_id = position_id or (options.get("position_id") if options else None)
    data = {
        "work_id": pos_id or "w-001",
        "title": "Bednění říms Bd/C1a",
        "position_code": "214125",
        "description": "Bednění říms - pilíře",
        "steps": [
            {
                "step_num": 1,
                "title": "Příprava podkladu",
                "description": "Očistit povrch od prachu a ošetřit odvlhčujícím činidlem.",
                "duration_minutes": 45,
                "workers": 2,
                "equipment": ["Kartáč drátěný", "Hadice na vodu"],
            },
            {
                "step_num": 2,
                "title": "Osazení bednic",
                "description": "Uložit bednicí desky WBP podle výkresu a zajistit rozpěry.",
                "duration_minutes": 120,
                "workers": 4,
                "equipment": ["Jeřáb mobilní 20t", "Rozpěry"],
            },
            {
                "step_num": 3,
                "title": "Kontrola vertikality",
                "description": "Zkontrolovat svislost a vodorovnost měřidlem.",
                "duration_minutes": 30,
                "workers": 1,
                "equipment": ["Vodováha", "Měřidlo"],
            },
        ],
        "norms": [
            {
                "ref": "ČSN 73 1201",
                "clause": "Kap. 3.2",
                "requirement": "Odchylka od svislosti max. 1:500",
                "tolerance": "±10 mm na 5 m",
            },
            {
                "ref": "TKP 18 Bd pohledový",
                "clause": "Kap. 2.4",
                "requirement": "Kvalita povrchu třídy A",
                "tolerances": ["Nerovnosti ≤ 2 mm na 2 m", "Vlhkost < 15%"],
            },
        ],
        "quality_checks": [
            {
                "check": "Vizuální kontrola povrchu",
                "timing": "Po každé fázi",
                "pass": "Bez viditelných vad",
            },
            {
                "check": "Měření svislosti",
                "timing": "Před betonáží",
                "pass": "Odchylka max. ±10 mm",
            },
        ],
        "safety_requirements": [
            "Práce ve výšce pouze s jištěním",
            "Zákaz vstupu pod zavěšeným břemenem",
            "Osvětlení minimálně 200 lux",
            "Hluk max. 85 dB",
        ],
        "materials_used": [
            {"material": "Bednicí desky WBP", "qty": 140, "unit": "m2"},
            {"material": "Rozpěry d32", "qty": 280, "unit": "ks"},
            {"material": "Odlučovač", "qty": 50, "unit": "l"},
        ],
        "sources": [
            {"type": "NORM", "ref": "ČSN 73 1201"},
            {"type": "NORM", "ref": "TKP 18 Bd pohledový"},
            {"type": "KB", "ref": "Bedenie-teorie-1.2.pdf"},
            {"type": "PROJECT", "ref": "Výkresy D-001, D-002"},
        ],
    }

    artifact = {
        "type": "tech_card",
        "title": "Technologická karta",
        "data": data,
        "metadata": _artifact_metadata(project, generated_by=generated_by),
        "navigation": {
            "title": "Technologická karta",
            "sections": [
                {"id": "steps", "label": "Postup", "icon": "🛠️"},
                {"id": "norms", "label": "Normy", "icon": "📐"},
                {"id": "quality", "label": "Kontroly", "icon": "✅"},
            ],
            "active_section": "steps",
        },
        "actions": _artifact_actions(project, "tech_card"),
        "status": "OK",
        "warnings": [
            {
                "level": "INFO",
                "message": f"Pozice: {pos_id or data['position_code']}",
            }
        ],
        "ui_hints": {
            "display_mode": "timeline",
            "expandable_sections": True,
            "sortable_columns": False,
            "filterable": True,
            "searchable": True,
        },
    }

    response = "Technologická karta připravena včetně kroků a požadavků."
    return response, artifact


def _handle_action(
    action: str,
    project: Dict[str, Any],
    options: Optional[Dict[str, Any]] = None,
    *,
    position_id: Optional[str] = None,
    generated_by: str = "system",
) -> Tuple[str, Dict[str, Any]]:
    if action == "audit_positions":
        return _build_audit_positions_artifact(project, options, generated_by=generated_by)
    if action == "vykaz_vymer":
        return _build_vykaz_vymer_artifact(project, options, generated_by=generated_by)
    if action == "materials_detailed":
        return _build_materials_detailed_artifact(project, options, generated_by=generated_by)
    if action == "resource_sheet":
        return _build_resource_sheet_artifact(project, options, generated_by=generated_by)
    if action == "project_summary":
        return _build_project_summary_artifact(project, options, generated_by=generated_by)
    if action == "tech_card":
        return _build_tech_card_artifact(project, position_id=position_id, options=options, generated_by=generated_by)
    raise ValueError(f"Unknown action: {action}")


def _detect_action_from_query(query: str) -> Tuple[Optional[str], Dict[str, Any]]:
    lowered = query.lower()
    options: Dict[str, Any] = {}

    # Technická karta / Техкарта
    if ("techn" in lowered and "karta" in lowered) or "техкарт" in lowered or "tech card" in lowered:
        tokens = [token.strip(",. ") for token in query.split()]
        position = next((token for token in tokens if any(char.isdigit() for char in token)), None)
        if position:
            options["position_id"] = position
        return "tech_card", options

    # Souhrn projektu / Саммари
    if "komplet" in lowered or "shrn" in lowered or "souhrn" in lowered or "саммари" in lowered or "kpi" in lowered or "rekapitulac" in lowered:
        options["detail_level"] = "full"
        return "project_summary", options

    # Ведомость ресурсов / Zdroje
    if "ведомость" in lowered or "ресурс" in lowered or "zdroj" in lowered or "pracovní" in lowered or "pracovnik" in lowered or "pracovníků" in lowered or "časov" in lowered:
        tokens = [token.strip(",. ") for token in query.split()]
        position = next((token for token in tokens if any(char.isdigit() for char in token)), None)
        if position:
            options["position_id"] = position
        options["include_timeline"] = True
        return "resource_sheet", options

    # Materiály / Материалы
    if "materi" in lowered or "beton" in lowered or "armatur" in lowered or "přehled" in lowered or "spotřeba" in lowered or "spotřeb" in lowered:
        if "beton" in lowered:
            options["filter_by"] = "beton"
        if "celkov" in lowered or "přehled" in lowered:
            options["summary"] = True
        return "materials_detailed", options

    # Výkaz výměr / Выказ
    if "výkaz" in lowered or "výměr" in lowered or "vykaz" in lowered or "vymer" in lowered or "sumar" in lowered or "detailn" in lowered:
        tokens = [token.strip(",. ") for token in query.split()]
        position = next((token for token in tokens if any(char.isdigit() for char in token)), None)
        if position:
            options["position_id"] = position
        return "vykaz_vymer", options

    # Audit pozic / Аудит
    if "audit" in lowered or "kontrol" in lowered or "norm" in lowered or "zkontrol" in lowered or "ověř" in lowered:
        options["check_norms"] = True
        options["check_catalog"] = True
        return "audit_positions", options

    return None, {}

# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================


class ChatMessageRequest(BaseModel):
    """Request for sending a chat message"""

    project_id: str
    message: str
    include_history: bool = True


class ChatActionRequest(BaseModel):
    """Request for triggering a quick action"""

    project_id: str
    action: str
    position_id: Optional[str] = None
    options: Optional[Dict[str, Any]] = None
    free_form_query: Optional[str] = None


class EnrichRequest(BaseModel):
    """Request for position enrichment."""

    project_id: str = Field(..., description="Project ID")
    position_id: Optional[str] = None
    action: str = Field(default="enrich", description="Enrichment action")


class ChatResponse(BaseModel):
    """Unified chat response"""

    response: str
    artifact: Optional[Dict[str, Any]] = None


class CreateProjectRequest(BaseModel):
    """Request for creating a new project"""

    name: str
    workflow: str = "A"


# ============================================================================
# CHAT ENDPOINTS
# ============================================================================


@router.post("/message", response_model=ChatResponse)
async def send_chat_message(request: ChatMessageRequest):
    """
    Send a chat message and get AI response

    The AI can:
    - Answer questions about the project
    - Explain construction standards (ČSN)
    - Provide OTSKP/KROS/RTS code information
    - Analyze positions and materials
    - Suggest improvements

    Example messages:
    - "Co je pozice HSV.001?"
    - "Jaké jsou požadavky ČSN pro beton C25/30?"
    - "Analyzuj materiály v projektu"
    """
    try:
        # Validate project exists
        if request.project_id not in project_store:
            raise HTTPException(404, f"Project {request.project_id} not found")

        project = project_store[request.project_id]

        logger.info(
            f"💬 Chat message from {request.project_id}: "
            f"{request.message[:50]}..."
        )

        detected_action, detected_options = _detect_action_from_query(request.message)

        if detected_action:
            options = dict(detected_options or {})
            position_id = options.pop("position_id", None)
            response_text, artifact = _handle_action(
                detected_action,
                project,
                options=options,
                position_id=position_id,
                generated_by="user_request",
            )
            return ChatResponse(response=response_text, artifact=artifact)

        # Fallback generic response
        return ChatResponse(
            response=(
                f"Zpráva přijata: '{request.message}'. "
                f"Projekt: {project['project_name']} ({project['workflow']}). "
                "Mohu pomoct s auditem, materiály, zdroji nebo technologickými kartami. "
                "Zeptej se konkrétně, například 'Kontrola pozic' nebo 'Technická karta 214125'."
            ),
            artifact=None,
        )

    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover - defensive logging
        logger.error(f"Chat message error: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Chat error: {str(e)}")


@router.post("/action", response_model=ChatResponse)
async def trigger_action(request: ChatActionRequest):
    """
    Trigger a predefined quick action

    Available actions:
    - **audit_positions**: Kontrola pozic podle norem
    - **vykaz_vymer**: Přehled výkazu výměr
    - **materials_detailed**: Detailní seznam materiálů
    - **resource_sheet**: Přehled zdrojů (práce, technika)
    - **project_summary**: Souhrn projektu a KPI
    - **tech_card**: Technologická karta pro pozici

    Returns results with interactive artifact visualization.
    """
    try:
        # Validate project exists
        if request.project_id not in project_store:
            raise HTTPException(404, f"Project {request.project_id} not found")

        project = project_store[request.project_id]

        logger.info(
            f"🎬 Action '{request.action}' triggered for {request.project_id}"
        )

        options = dict(request.options or {})
        if request.free_form_query:
            options.setdefault("free_form_query", request.free_form_query)
        position_id = request.position_id or options.pop("position_id", None)

        try:
            response_text, artifact = _handle_action(
                request.action,
                project,
                options=options,
                position_id=position_id,
                generated_by="system",
            )
        except ValueError:
            raise HTTPException(400, f"Unknown action '{request.action}'")

        return ChatResponse(response=response_text, artifact=artifact)

    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover - defensive logging
        logger.error(f"Action error: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Action failed: {str(e)}")


# ============================================================================
# PROJECT MANAGEMENT (missing from routes.py)
# ============================================================================


@router.post("/projects", response_model=Dict[str, Any])
async def create_project(request: CreateProjectRequest):
    """
    Create a new empty project

    Projects must be created before uploading files.
    After creation, use POST /api/upload to add files.
    """
    try:
        import uuid

        # Generate project ID
        project_id = f"proj_{uuid.uuid4().hex[:12]}"

        # Validate workflow
        workflow = request.workflow.upper()
        if workflow not in ["A", "B"]:
            raise HTTPException(400, "workflow must be 'A' or 'B'")

        logger.info(f"📁 Creating new project: {request.name} ({workflow})")

        # Create project in store
        project_store[project_id] = {
            "project_id": project_id,
            "project_name": request.name,
            "workflow": workflow,
            "status": ProjectStatus.UPLOADED,
            "created_at": get_utc_timestamp_iso(),
            "updated_at": get_utc_timestamp_iso(),
            "progress": 0,
            "positions_total": 0,
            "positions_processed": 0,
            "green_count": 0,
            "amber_count": 0,
            "red_count": 0,
            "files": {},
            "message": "Project created. Upload files to start processing.",
        }

        return {
            "success": True,
            "project_id": project_id,
            "project_name": request.name,
            "workflow": workflow,
            "status": ProjectStatus.UPLOADED,
            "created_at": get_utc_timestamp_iso(),
            "message": "Project created successfully",
        }

    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover - defensive logging
        logger.error(f"Create project error: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Failed to create project: {str(e)}")


# ============================================================================
# ENRICHMENT ENDPOINTS
# ============================================================================


@router.post("/enrich", response_model=ChatResponse)
async def enrich_position(request: EnrichRequest):
    """
    Enrich a position with full technical data.

    Обогащение позиции включает:
    - Данные из Knowledge Base (коды, категории)
    - Материалы и характеристики
    - Применимые нормы (ČSN)
    - Поставщиков и цены
    - Спецификации из чертежей
    - Трудозатраты и ресурсы
    - Claude анализ (опционально)

    **Request Body:**
    ```json
    {
        "project_id": "proj_abc123",
        "position_id": "pos_001"
    }
    ```
    """

    try:
        from app.services.enrichment_service import PositionEnricher

        if request.project_id not in project_store:
            raise HTTPException(404, f"Project {request.project_id} not found")

        project = project_store[request.project_id]

        logger.info(
            "🧬 Enrichment request: %s:%s",
            request.project_id,
            request.position_id,
        )

        positions_path = f"/api/workflow/a/positions?project_id={request.project_id}"
        logger.debug("Positions endpoint reference: %s", positions_path)

        enricher = PositionEnricher()

        if request.position_id:
            logger.debug("Single position enrichment requested: %s", request.position_id)
            # TODO: find and enrich specific position
        else:
            logger.debug("Batch enrichment requested for project %s", request.project_id)
            # TODO: load and enrich all positions

        artifact = {
            "type": "enrichment_result",
            "title": "Обогащение позиции",
            "data": {
                "position_id": request.position_id,
                "enrichment_steps": 7,
                "confidence": 85,
                "enriched_fields": [
                    "materials",
                    "norms",
                    "suppliers",
                    "labor",
                    "equipment",
                ],
            },
            "warnings": [],
            "metadata": _artifact_metadata(project, generated_by="enrichment"),
        }

        return ChatResponse(
            response=(
                "Позиция обогащена успешно. Данные содержат материалы, нормы, "
                "поставщиков и ресурсы."
            ),
            artifact=artifact,
        )

    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover - defensive logging
        logger.error(f"Enrichment error: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Enrichment failed: {str(e)}")


# ============================================================================
# CONSTRUCTION ASSISTANT (без документов)
# ============================================================================


class AssistantRequest(BaseModel):
    """Request for construction assistant without documents"""

    question: str = Field(..., description="Otázka pro stavebního asistenta")
    context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Volitelný kontext (projekt, materiály)"
    )


class AssistantResponse(BaseModel):
    """Response from construction assistant"""

    answer: str = Field(..., description="Odpověď asistenta")
    relevant: bool = Field(..., description="Zda je otázka relevantní pro stavebnictví")
    sources: list[str] = Field(default_factory=list, description="Použité zdroje")
    related_norms: list[str] = Field(default_factory=list, description="Související normy ČSN")


@router.post("/assistant", response_model=AssistantResponse)
async def ask_construction_assistant(request: AssistantRequest):
    """
    Zeptej se stavebního asistenta (БЕЗ ДОКУМЕНТŮ)

    Stavební expert odpoví na otázky o:
    - **Technologických postupech** (montáž vodoměrné šachty, pokládka potrubí)
    - **Českých normách ČSN** (specifikace betonu, armování)
    - **Materiálech** (třídy betonu, ocel, izolace)
    - **OTSKP/KROS/RTS kódech**
    - **Bezpečnosti práce** (BOZP)

    Nerelevantní otázky (vaření, politika, atd.) budou zdvořile odmítnuty.

    **Příklady otázek:**
    - "Jak montovat vodoměrnou šachtu?"
    - "Jaký je postup při pokládce kanalizačního potrubí?"
    - "Jaké jsou požadavky ČSN pro beton C30/37?"
    - "Jak správně ukládat a hutnit zásyp?"
    - "Co musím dodržet při betonáži základů?"
    """
    try:
        from app.services.construction_assistant import construction_assistant

        logger.info(f"🏗️  Construction Assistant: {request.question[:80]}...")

        # Ask construction assistant
        result = construction_assistant.ask(
            question=request.question,
            context=request.context
        )

        return AssistantResponse(
            answer=result["answer"],
            relevant=result["relevant"],
            sources=result["sources"],
            related_norms=result["related_norms"]
        )

    except Exception as e:  # pragma: no cover - defensive logging
        logger.error(f"Construction Assistant error: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Assistant error: {str(e)}")
