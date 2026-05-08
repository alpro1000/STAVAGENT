"""Π.0a Foundation Extraction Layer — entry point.

Step 1: skeleton + idempotency wrapper.
Step 2: DXF block-name attrs absorption (parse_block_name).
Step 2.5: ezdxf-based direct DXF reading — full A/B/C/D coverage now
that scripts/infrastructure/build_libredwg.sh + dwg_to_dxf_batch.py
produce DXFs from sources/{objekt}/dwg/. Replaces the earlier legacy
dxf_parser_test.json fallback.

Usage:
    python -m pi_0.extract --objekt={A|B|C|D}
    python -m pi_0.extract --all

If sources/{objekt}/dxf/ is missing or empty, openings stays empty +
warning. Run scripts/infrastructure/dwg_to_dxf_batch.py (or the
Libuše-specific phase_0_5_batch_convert.py) first.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
from pathlib import Path

from pi_0 import SCHEMA_VERSION, __version__
from pi_0.cache import load_or_parse
from pi_0.extractors.dxf_openings import (
    find_nearest_iden_code, parse_block_name, parsed_anything,
    parse_dxf_full,
)
from pi_0.extractors.xlsx_dvere import extract_doors_for_objekt
from pi_0.extractors.xlsx_skladby import extract_skladby
from pi_0.schema import write_canonical

# Resolve the repo root from this file's location:
# scripts/pi_0/extract.py → ../../../../../  → repo root
REPO_ROOT = Path(__file__).resolve().parents[5]
SOURCES_ROOT = REPO_ROOT / "test-data" / "libuse" / "sources"
OUTPUTS_ROOT = REPO_ROOT / "test-data" / "libuse" / "outputs"
CACHE_DIR = REPO_ROOT / ".pi_0_cache"

VALID_OBJEKTY = ("A", "B", "C", "D")

# Tabulka 0041 — doors. Komplex-wide, lives under sources/shared/xlsx/.
TABULKA_DVERI_PATH = (
    SOURCES_ROOT / "shared" / "xlsx"
    / "185-01_DPS_D_SO01_100_0041_TABULKA DVERI.xlsx"
)

# Tabulka 0030 — skladby + povrchy. Komplex-wide; same content for all objekty.
TABULKA_SKLADEB_PATH = (
    SOURCES_ROOT / "shared" / "xlsx"
    / "185-01_DPS_D_SO01_100_0030_R01_TABULKA SKLADEB A POVRCHU_R01.xlsx"
)


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


EXTRACTABLE_SUFFIXES = {".dwg", ".dxf", ".pdf", ".xlsx", ".docx"}


def _kind_for(suffix: str) -> str:
    return {".dwg": "dwg", ".dxf": "dxf", ".pdf": "pdf",
            ".xlsx": "xlsx", ".docx": "docx"}.get(suffix.lower(), "other")


def files_for_objekt(objekt: str) -> list[Path]:
    """Yield extractable source files for `objekt`: per-objekt + shared.

    Filters to the formats extractors actually read (dwg/dxf/pdf/xlsx/docx).
    INVENTORY.md, .gitkeep, and other meta files are skipped.
    """
    if objekt not in VALID_OBJEKTY:
        raise ValueError(f"objekt must be one of {VALID_OBJEKTY}, got {objekt!r}")
    found: list[Path] = []
    for bucket in (SOURCES_ROOT / objekt, SOURCES_ROOT / "shared"):
        if not bucket.exists():
            continue
        for path in sorted(bucket.rglob("*")):
            if path.is_file() and path.suffix.lower() in EXTRACTABLE_SUFFIXES:
                found.append(path)
    return found


def build_metadata(objekt: str, source_files: list[Path]) -> dict:
    """metadata section: objekt + extractor version + source file catalog."""
    return {
        "objekt": objekt,
        "extracted_at": _dt.datetime.now(tz=_dt.timezone.utc).isoformat(timespec="seconds"),
        "extractor_version": __version__,
        "schema_version": SCHEMA_VERSION,
        "source_files": [
            {
                "path": str(p.relative_to(REPO_ROOT)),
                "sha256": _sha256_file(p),
                "kind": _kind_for(p.suffix),
                "size_bytes": p.stat().st_size,
            }
            for p in source_files
        ],
    }


def _dxf_files_for_objekt(objekt: str) -> list[Path]:
    """Return DXF files for `objekt`: per-objekt + shared. Sorted, stable."""
    found: list[Path] = []
    for bucket in (SOURCES_ROOT / objekt, SOURCES_ROOT / "shared"):
        dxf_dir = bucket / "dxf"
        if dxf_dir.exists():
            found.extend(sorted(dxf_dir.glob("*.dxf")))
    return found


def _parse_dxf_cached(dxf_path: Path) -> dict:
    """Cached wrapper around dxf_openings.parse_dxf_full()."""
    return load_or_parse(dxf_path, parse_dxf_full, cache_dir=CACHE_DIR)


def extract_dxf_data(objekt: str) -> tuple[list[dict], list[dict], dict, list[dict]]:
    """Step 5: parse all DXFs for `objekt` (cached) and return four sections.

    Returns (openings, rooms, segment_counts, warnings):
      - openings: per-instance INSERT entries shaped per SPEC §2.4
        with block_attrs + spatial-matched type_code from *-IDEN tags
      - rooms: per-room {code, polygon, centroid, area_m2, perimeter_m,
        source_drawing} filtered to objekt scope (e.g. starts with 'D.'
        or 'S.D.' for objekt D)
      - segment_counts: per-prefix census {prefix: {code: count, …}}
      - warnings: extraction-time issues
    """
    dxf_files = _dxf_files_for_objekt(objekt)
    if not dxf_files:
        return [], [], {}, [{
            "level": "warning",
            "category": "missing_dxf_input",
            "message": (
                f"No DXF files under sources/{objekt}/dxf/ or "
                f"sources/shared/dxf/. Run "
                f"scripts/infrastructure/dwg_to_dxf_batch.py or "
                f"phase_0_5_batch_convert.py first."
            ),
            "source_evidence": f"sources/{objekt}/dxf/ + sources/shared/dxf/",
        }]

    # Per-objekt room-code prefix filter (e.g. 'D' → starts D. or S.D.)
    prefix_match = lambda code: bool(code and (
        code.startswith(f"{objekt}.") or code.startswith(f"S.{objekt}.")
    ))

    openings: list[dict] = []
    rooms: list[dict] = []
    seen_room_codes: set[str] = set()  # dedupe across drawings
    segment_counts: dict[str, dict[str, int]] = {}
    warnings: list[dict] = []
    unparseable_count = 0
    drawings_read = 0

    for dxf_path in dxf_files:
        parsed = _parse_dxf_cached(dxf_path)
        if not parsed:
            continue
        drawings_read += 1
        drawing_key = parsed["drawing_key"]

        # ---- Rooms (filter by objekt prefix; dedupe by code) ----------
        for room in parsed["rooms"]:
            code = room.get("code")
            if not prefix_match(code):
                continue
            if code in seen_room_codes:
                continue
            seen_room_codes.add(code)
            rooms.append({
                "code": code,
                "polygon": room["polygon"],
                "centroid": room["centroid"],
                "area_m2": {
                    "value": round(room["area_m2"], 6),
                    "source": f"DXF|{drawing_key}|{LAYER_ROOM_BOUNDARY}",
                    "confidence": 0.95,  # derived from polygon
                },
                "perimeter_m": {
                    "value": round(room["perimeter_m"], 6),
                    "source": f"DXF|{drawing_key}|{LAYER_ROOM_BOUNDARY}",
                    "confidence": 0.95,
                },
                "source_drawing": drawing_key,
            })

        # ---- Segment counts (per prefix per code) ---------------------
        # Filter shared 1.PP segment tags only to objekty whose rooms
        # they actually touch — without spatial logic we accept all
        # shared tags for every objekt (slight over-count for non-D
        # but consistent with legacy dxf_segment_counts logic).
        for tag in parsed["segment_tags"]:
            prefix = tag["prefix"]
            code = tag["code"]
            segment_counts.setdefault(prefix, {})
            segment_counts[prefix][code] = segment_counts[prefix].get(code, 0) + 1

        # ---- Openings: INSERT + spatial-matched IDEN type_code --------
        # Group IDEN tags by source_layer for nearest-neighbour search
        iden_by_layer: dict[str, list[dict]] = {}
        for tag in parsed["opening_iden_tags"]:
            iden_by_layer.setdefault(tag["source_layer"], []).append(tag)

        for raw in parsed["raw_openings"]:
            block_name = raw["block_name"]
            block_attrs = parse_block_name(block_name)
            otvor_type = raw["otvor_type"]
            iden_layer = OPENING_IDEN_LAYERS.get(otvor_type, "")
            iden_candidates = iden_by_layer.get(iden_layer, [])
            spatial_code = find_nearest_iden_code(raw["position"],
                                                    iden_candidates)
            type_code = spatial_code or _heuristic_from_block(block_name)

            entry = {
                "id": f"{objekt}.{drawing_key}."
                      f"{type_code or 'unknown'}.{len(openings):04d}",
                "otvor_type": otvor_type,
                "type_code": type_code,
                "type_code_source": (
                    "spatial_iden" if spatial_code else (
                        "heuristic_block_name" if type_code else "unresolved"
                    )
                ),
                "source_drawing": drawing_key,
                "source_layer": raw["source_layer"],
                "block_name": {
                    "value": block_name,
                    "source": f"DXF|{drawing_key}|{raw['source_layer']}",
                    "confidence": 1.0,
                },
                "block_attrs": block_attrs,
                "position": raw["position"],
                "width_mm": {
                    "value": raw["width_mm"],
                    "source": f"DXF|{drawing_key}|block_name",
                    "confidence": 0.95,
                },
                "height_mm": {
                    "value": raw["height_mm"],
                    "source": f"DXF|{drawing_key}|block_name",
                    "confidence": 0.95,
                },
                "depth_mm": {
                    "value": raw["depth_mm"],
                    "source": f"DXF|{drawing_key}|block_name",
                    "confidence": 0.95,
                },
            }
            openings.append(entry)
            if not parsed_anything(block_attrs):
                unparseable_count += 1
                warnings.append({
                    "level": "warning",
                    "category": "block_name_unparseable",
                    "message": f"Could not parse any attribute from block_name: {block_name!r}",
                    "source_evidence": f"DXF|{drawing_key}|opening_id={entry['id']}",
                })

    if openings:
        parsed_pct = (len(openings) - unparseable_count) / len(openings)
        type_resolved = sum(1 for op in openings if op["type_code"])
        type_pct = type_resolved / len(openings) if openings else 0
        warnings.append({
            "level": "info",
            "category": "step_5_gate",
            "message": (
                f"Step 5: {drawings_read} DXFs read; "
                f"openings={len(openings)} ({parsed_pct:.1%} block_attrs "
                f"parseable, {type_pct:.1%} type_code resolved via "
                f"*-IDEN spatial match); "
                f"rooms={len(rooms)}; "
                f"segment_counts={sum(len(v) for v in segment_counts.values())} "
                f"distinct codes."
            ),
            "source_evidence": f"sources/{objekt}/dxf/ + sources/shared/dxf/",
        })

    return openings, rooms, segment_counts, warnings


# Backward-compat shim — keep `extract_openings()` callable for tests
# that imported it directly. New full path is `extract_dxf_data()`.
def extract_openings(objekt: str) -> tuple[list[dict], list[dict]]:
    openings, _rooms, _sc, warnings = extract_dxf_data(objekt)
    return openings, warnings


def _heuristic_from_block(block_name: str) -> str | None:
    """Fallback when *-IDEN spatial match fails (e.g. ŘEZY drawings)."""
    from pi_0.extractors.dxf_openings import _heuristic_type_code
    return _heuristic_type_code(block_name)


# Layer constants imported once for source-string consistency
from pi_0.extractors.dxf_openings import (
    LAYER_ROOM_BOUNDARY, OPENING_IDEN_LAYERS,
)


def _to_int_mm(value) -> int | None:
    """Coerce a width/height cell — Tabulka cells are sometimes str, sometimes
    int. Returns mm as int, or None if non-numeric."""
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        s = value.strip()
        if s.isdigit():
            return int(s)
    return None


def _cross_link_openings_to_doors(openings: list[dict], doors: list[dict]) -> int:
    """Annotate each opening with a `door_match` block that links to doors[].

    Match strategies, in priority order:
      (a) Unique (typ, width_mm) match → `door_match.cislo` set, conf 0.85.
      (b) Multiple cisla for same (typ, width_mm) → `door_match.typ` only,
          `door_match.cislo_candidates: [...]`, conf 0.70.
      (c) typ matches but width doesn't → `door_match.typ` only, conf 0.55.
      (d) typ unknown or no matches → no link.

    Most ArchiCAD opening blocks share the same typ across many physical
    instances (e.g. D04 appears 35× in Tabulka with same width); cislo
    disambiguation requires room-context spatial matching that lands in
    Step 5+.

    Returns the count of openings that got any link annotation.
    """
    if not openings or not doors:
        return 0
    # Index doors by (typ, width). Two width fields → two index entries each.
    by_typ_width: dict[tuple[str, int], list[dict]] = {}
    by_typ: dict[str, list[dict]] = {}
    for d in doors:
        typ = d["typ"]["value"]
        if not typ:
            continue
        by_typ.setdefault(typ, []).append(d)
        for w_field in ("sirka_otvoru_mm", "celkova_svetla_sirka_mm"):
            w_int = _to_int_mm(d[w_field]["value"])
            if w_int is not None:
                by_typ_width.setdefault((typ, w_int), []).append(d)

    linked = 0
    for op in openings:
        type_code = op.get("type_code")
        if not type_code:
            continue
        width_int = _to_int_mm(op.get("width_mm", {}).get("value"))

        # Strategy (a): unique (typ, width)
        if width_int is not None:
            candidates = by_typ_width.get((type_code, width_int), [])
            if len(candidates) == 1:
                op["door_match"] = {
                    "value": {"typ": type_code,
                              "cislo": candidates[0]["cislo"]["value"]},
                    "source": "DERIVED|opening.type_code+width_mm unique match",
                    "confidence": 0.85,
                }
                linked += 1
                continue
            elif len(candidates) > 1:
                # Strategy (b): ambiguous typ+width — list cisla
                op["door_match"] = {
                    "value": {
                        "typ": type_code,
                        "cislo_candidates": [c["cislo"]["value"] for c in candidates],
                    },
                    "source": "DERIVED|opening.type_code+width_mm ambiguous",
                    "confidence": 0.70,
                }
                linked += 1
                continue

        # Strategy (c): typ matches, width doesn't (or width unknown)
        typ_candidates = by_typ.get(type_code, [])
        if typ_candidates:
            op["door_match"] = {
                "value": {"typ": type_code,
                          "cislo_candidates": [c["cislo"]["value"]
                                               for c in typ_candidates]},
                "source": "DERIVED|opening.type_code only (no width match)",
                "confidence": 0.55,
            }
            linked += 1
    return linked


def extract(objekt: str) -> dict:
    """Produce master_extract for `objekt`.

    Step 1: metadata + empty section stubs.
    Step 2.5: openings[] populated from sources/{objekt}/dxf/ via ezdxf.
    Step 3: doors[] populated from Tabulka 0041 (full 28-col absorption);
            openings[] cross-linked to doors[] by typ + width.
    Subsequent steps fill rooms / walls / skladby / windows / etc.
    See TASK_PHASE_PI_0_SPEC.md §2 for the full schema.
    """
    sources = files_for_objekt(objekt)
    openings, rooms, segment_counts, warnings = extract_dxf_data(objekt)
    doors = extract_doors_for_objekt(TABULKA_DVERI_PATH, objekt)
    skladby = extract_skladby(TABULKA_SKLADEB_PATH)

    # Step 4: skladby coverage report.
    skladby_total = sum(len(by_kind) for by_kind in skladby.values())
    skladby_kinds = ",".join(sorted(skladby.keys())) or "<none>"
    if skladby_total == 0:
        warnings.append({
            "level": "warning",
            "category": "missing_tabulka_skladeb",
            "message": (
                f"Tabulka 0030 SKLADEB A POVRCHU.xlsx absent or empty for "
                f"objekt {objekt}; skladby{{}} is empty."
            ),
            "source_evidence": str(TABULKA_SKLADEB_PATH.relative_to(REPO_ROOT)),
        })
    else:
        warnings.append({
            "level": "info",
            "category": "step_4_gate",
            "message": (
                f"Step 4: {skladby_total} skladby lifted from Tabulka 0030 "
                f"across kinds [{skladby_kinds}]."
            ),
            "source_evidence": "sources/shared/xlsx/...0030_*.xlsx",
        })

    if not doors:
        warnings.append({
            "level": "warning",
            "category": "missing_tabulka_dveri",
            "message": (
                f"sources/shared/xlsx/...0041 TABULKA DVERI.xlsx absent or "
                f"empty for objekt {objekt}; doors[] is empty."
            ),
            "source_evidence": str(TABULKA_DVERI_PATH.relative_to(REPO_ROOT)),
        })
    else:
        link_count = _cross_link_openings_to_doors(openings, doors)
        warnings.append({
            "level": "info",
            "category": "step_3_gate",
            "message": (
                f"Step 3: {len(doors)} door rows lifted from Tabulka 0041; "
                f"{link_count} of {len(openings)} openings cross-linked "
                f"by (type_code, width_mm)."
            ),
            "source_evidence": "sources/shared/xlsx/...0041_*.xlsx",
        })

    return {
        "metadata": build_metadata(objekt, sources),
        "rooms": rooms,
        "walls": [],
        "openings": openings,
        "skladby": skladby,
        "doors": doors,
        "windows": [],
        "glass_partitions": [],
        "locksmith": [],
        "sheet_metal_TP": [],
        "lintels": [],
        "others_OP": [],
        "segment_counts": segment_counts,
        "footprint_areas": {},
        "legacy_vv": {},
        "warnings": warnings,
        "validation": {},
    }


def write_output(objekt: str, data: dict) -> Path:
    out = OUTPUTS_ROOT / f"master_extract_{objekt}.json"
    write_canonical(out, data)
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pi_0.extract", description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--objekt", choices=VALID_OBJEKTY, help="Single objekt")
    group.add_argument("--all", action="store_true", help="Run A + B + C + D")
    args = parser.parse_args(argv)

    targets = list(VALID_OBJEKTY) if args.all else [args.objekt]
    for obj in targets:
        data = extract(obj)
        path = write_output(obj, data)
        n_sources = len(data["metadata"]["source_files"])
        print(f"  {obj}: {n_sources} source files → {path.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
