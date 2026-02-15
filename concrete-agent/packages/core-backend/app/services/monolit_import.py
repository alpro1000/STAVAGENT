from typing import Dict, Any, List
from app.utils.monolit_matching import match_positions


def _flatten_monolit_positions(monolit: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = []
    for sheet in monolit.get("sheets", []):
        for pos in sheet.get("positions", []):
            copy = dict(pos)
            copy.setdefault("_source_sheet", sheet.get("name"))
            items.append(copy)
    return items


def _flatten_registry_positions(registry: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = []
    for obj in registry.get("objects", []):
        for pos in obj.get("positions", []):
            copy = dict(pos)
            copy.setdefault("_registry_object", obj.get("name"))
            copy.setdefault("_registry_object_id", obj.get("id"))
            items.append(copy)
    return items


def preview_import(monolit: Dict[str, Any], registry: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
    """Run matching preview between monolit project and registry snapshot.

    This function performs only preview matching and returns a report suitable for
    the frontend preview modal (Preview+Confirm flow).
    """
    monolit_items = _flatten_monolit_positions(monolit)
    registry_items = _flatten_registry_positions(registry)

    matches = match_positions(monolit_items, registry_items)

    summary = {"total": len(matches), "matched": 0, "ambiguous": 0, "new": 0}
    for r in matches:
        summary[r["tag"]] += 1

    return {"summary": summary, "matches": matches, "options": options}
