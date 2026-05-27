#!/usr/bin/env python3
"""
Phase 3.5 — sklad S-code traceability.

Per user-provided drawing screenshots (sklad SKLADBY KONSTRUKCÍ legenda) +
DXF S-code call-outs (cev_dxf_full_text_dump.json — S01-S05 + S03a/S03b
confirmed in sklad DXF), apply `realizuje_skladbu` field to 27 sklad
items in items.json.

Sklad S-code legenda (ground truth from user's drawing screenshots):
  S01 podlaha sklad:        beton. dlažba 50 + drť 4-8 40 + drť 4-8 150 + zhutněná pláň 30 MPa
  S02 stropní konstrukce:   pojezd pororošt 50 + ocel. nosníky 180 + HI fólie +
                            záklop prken 20 + dřev. nosné trámy KVH 100/160 160
  S03a obvodová stěna pod úrovní terénu:  povrch surový + obv. stěna + tvárnice ZB 250
                            + asfalt. penetrace + 2× hydroizol+protiradon 2×4 + drenáž 20
  S03b obvodová stěna nad úrovní terénu:  povrch surový + obv. stěna + tvárnice ZB 250
                            (above terrain — no HI required)
  S04 opěrná stěna:         povrch surový + opěr. stěna + prefa bloky usazené na zámek 600
                            + asfalt. penetrace + 2× hydroizol+protiradon 2×4 + drenáž 20
  S05 schodiště:            schod z betonového prefa bloku + kladecí vrstva zavlhlého betonu
                            + podkladní betonová deska + zhutněná pláň

Per-item mapping (27 sklad items, manual review):

HSV-1 Zemní práce (6 items) — earthworks, no skladba layer assignment
  except where skladba's terrain prep layer matches a specific HSV-1 item:
  - HSV1.001 sejmutí ornice + demolice                       → null (prep)
  - HSV1.002 hloubení jam pro objekt skladu                  → null (prep)
  - HSV1.003 hloubení rýh pro základové pasy                 → null (prep for S03)
  - HSV1.004 hloubení patek pro IPE180 parking               → null (prep)
  - HSV1.005 štěrkopískový násyp pod podlahu + IPE patky     → ["S01"] (zhutněná pláň 30 MPa pod S01)
  - HSV1.006 odvoz výkopku                                   → null (prep)

HSV-2 Základové a ŽB (6 items):
  - HSV2.001 základové pasy C16/20 500×500 pro obvod skladu  → ["S03a", "S03b"] (base of obvodová stěna)
  - HSV2.002 dvoustupňové patky pro IPE180 parking — spodní → null (parking patky, ne sklad skladba)
  - HSV2.003 dvoustupňové patky — horní část tvarovek ZB     → null (patky)
  - HSV2.004 beton C25/30 zalití tvarovek + lemujících zídek → null (patky + lemujících zídek parkingu)
  - HSV2.005 štěrkopískové lože pod podlahu + schodiště      → ["S01", "S05"] (base layer)
  - HSV2.006 ŽB schodišťová deska + základový pas terén-ke-skladu → ["S05"] (schodiště)

HSV-3 Svislé konstrukce (3 items):
  - HSV3.001 zadní opěrná stěna prefa Herkul H-BLOK          → ["S04"] (opěrná stěna prefa bloky)
  - HSV3.002 obvodové stěny tvarovky ZB tl. 250 × výška 2.4  → ["S03a", "S03b"] (obvodová stěna)
  - HSV3.003 výztuž B500B do tvarovek ZB                     → ["S03a", "S03b"]

HSV-4 Vodorovné (6 items) — all part of S02 stropní konstrukce
  (parking roof IS sklad ceiling per layered design):
  - HSV4.001 dřevěné stropnice 100/160 á 625 (primární)      → ["S02"] (dřev. nosné trámy KVH layer)
  - HSV4.002 prkenný záklop 20 mm + impregnace               → ["S02"] (záklop layer)
  - HSV4.003 hydroizolační střešní souvrství SBS             → ["S02"] (HI fólie layer)
  - HSV4.004 sekundární zastřešení parkingu IPE180 á 1000    → ["S02"] (ocel. nosníky 180 layer)
  - HSV4.005 pojezdové ocelové pororošty parkingu            → ["S02"] (pojezd. pororošt 50 mm)
  - HSV4.006 žárově zinková povrchová úprava IPE180+pororošt → ["S02"] (surface treatment)

PSV-76 Výplně otvorů (1):
  - PSV76.001 (sklad) dveře vstupní do skladu                → null (door, not a skladba)

PSV-77 Podlahy (1):
  - PSV77.001 (sklad) nášlapná vrstva nebo finální povrch    → ["S01"] (top layer of podlaha sklad)

VRN (4) — Doprava+odpad (2), Geodet (1), Společné (1) — all null
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
ITEMS_PATH = ROOT / "outputs" / "items_rd_jachymov_complete.json"
SNAPSHOT_PATH = ROOT / "outputs" / "items_consolidated_FROZEN_2026-05-20.json"
TODAY = str(date.today())

# Explicit per-item id → skladba mapping (sklad scope)
# Keys are the second segment of id (e.g. "HSV2.005"); objekt = 260217_sklad.
SKLAD_SKLADBA_MAP: dict[str, list[str] | None] = {
    "HSV1.001": None,
    "HSV1.002": None,
    "HSV1.003": None,
    "HSV1.004": None,
    "HSV1.005": ["S01"],
    "HSV1.006": None,
    "HSV2.001": ["S03a", "S03b"],
    "HSV2.002": None,
    "HSV2.003": None,
    "HSV2.004": None,
    "HSV2.005": ["S01", "S05"],
    "HSV2.006": ["S05"],
    "HSV3.001": ["S04"],
    "HSV3.002": ["S03a", "S03b"],
    "HSV3.003": ["S03a", "S03b"],
    "HSV4.001": ["S02"],
    "HSV4.002": ["S02"],
    "HSV4.003": ["S02"],
    "HSV4.004": ["S02"],
    "HSV4.005": ["S02"],
    "HSV4.006": ["S02"],
    "PSV76.001": None,
    "PSV77.001": ["S01"],
}


# Sklad S-code skladba legenda (ground truth from user's drawing screenshots)
SKLAD_SKLADBY_LEGENDA = {
    "S01": {
        "name": "podlaha sklad",
        "layers": [
            "betonová dlažba 50 mm",
            "kladecí vrstva - kamenná drť 4-8 mm 40 mm",
            "podkladní nosná vrstva - kamenná drť 4-8 mm 150 mm",
            "zhutněná zemní pláň (30 MPa)",
        ],
    },
    "S02": {
        "name": "stropní konstrukce (parking roof = sklad ceiling)",
        "layers": [
            "pojezdový ocelový pororošt 50 mm",
            "nosná ocelová konstrukce - ocel. nosníky 180 mm",
            "hydroizolační fólie",
            "záklop z dřevěných prken 20 mm",
            "dřevěné nosné trámy - KVH 100/160 160 mm",
        ],
    },
    "S03a": {
        "name": "obvodová stěna pod úrovní terénu",
        "layers": [
            "povrch surový bez omítky",
            "obvodová stěna (dle legendy materiálů)",
            "betonové tvárnice ztraceného bednění 250 mm",
            "asfaltová penetrace",
            "2× hydroizolační + protiradonový pás z modif. asfaltu 2×4 mm",
            "drenážní vrstva - nopová folie 20 mm",
        ],
    },
    "S03b": {
        "name": "obvodová stěna nad úrovní terénu",
        "layers": [
            "povrch surový bez omítky",
            "obvodová stěna (dle legendy materiálů)",
            "betonové tvárnice ztraceného bednění 250 mm",
            "povrch surový bez omítky (exterior)",
        ],
    },
    "S04": {
        "name": "opěrná stěna (zadní, prefa Herkul)",
        "layers": [
            "povrch surový bez omítky",
            "opěrná stěna (dle legendy materiálů)",
            "betonové prefa bloky usazené na zámek 600 mm",
            "asfaltová penetrace",
            "2× hydroizolační + protiradonový pás z modif. asfaltu 2×4 mm",
            "drenážní vrstva - nopová folie 20 mm",
        ],
    },
    "S05": {
        "name": "schodiště přístupové ke skladu",
        "layers": [
            "schod z betonového prefa bloku",
            "kladecí vrstva ze zavlhlého betonu",
            "podkladní betonová deska",
            "zhutněná zemní pláň",
        ],
    },
}


def main() -> None:
    data = json.load(ITEMS_PATH.open())
    items = data["items"]

    tagged = 0
    explicit_null = 0
    changes_by_kapitola: Counter[str] = Counter()
    for it in items:
        if it["objekt"] != "260217_sklad":
            continue
        # Extract id last segment after first dot
        id_short = it["id"].split(".", 1)[1] if "." in it["id"] else ""
        if id_short not in SKLAD_SKLADBA_MAP:
            continue
        mapping = SKLAD_SKLADBA_MAP[id_short]
        it["realizuje_skladbu"] = mapping
        if mapping:
            tagged += 1
        else:
            explicit_null += 1
        changes_by_kapitola[it["kapitola"]] += 1

    # Persist sklad SKLADBY KONSTRUKCÍ legenda as a separate canonical file
    LEGENDA_PATH = ROOT / "outputs" / "sklad_skladby_legenda_canonical.json"
    LEGENDA_PATH.write_text(json.dumps({
        "_schema_version": "1.0",
        "_generated_at": TODAY,
        "_purpose": (
            "Canonical sklad SKLADBY KONSTRUKCÍ legenda ground truth — from "
            "user-provided drawing screenshots (D.1.1.02.R1 půdorys suterénu + "
            "C.03 koord. situace) cross-validated against DXF S-code call-outs "
            "in cev_dxf_full_text_dump.json (km_kóty layer)."
        ),
        "n_codes": len(SKLAD_SKLADBY_LEGENDA),
        "skladby": [{"code": k, **v} for k, v in SKLAD_SKLADBY_LEGENDA.items()],
    }, indent=2, ensure_ascii=False))

    # Append Phase 3.5 log
    data["_phase3_5_sklad_skladby_log"] = {
        "applied_at": TODAY,
        "purpose": (
            "Phase 3.5 — sklad S-code traceability. Tags 27 sklad items with "
            "realizuje_skladbu against sklad-specific S01-S05/S03a/S03b namespace "
            "(distinct from dům řez A-A legenda)."
        ),
        "tagged_skladba_items": tagged,
        "explicit_null_marker_items": explicit_null,
        "items_reviewed_total": tagged + explicit_null,
        "changes_by_kapitola": dict(changes_by_kapitola),
        "ground_truth_source": "user drawing screenshots + cev_dxf_full_text_dump.json km_kóty layer",
        "canonical_legenda_file": "outputs/sklad_skladby_legenda_canonical.json",
    }

    ITEMS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    # Refresh frozen snapshot
    SNAPSHOT_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    print(json.dumps({
        "tagged_skladba_items": tagged,
        "explicit_null_marker_items": explicit_null,
        "items_reviewed_total": tagged + explicit_null,
        "changes_by_kapitola": dict(changes_by_kapitola),
        "canonical_legenda_file": str(LEGENDA_PATH.relative_to(ROOT)),
        "snapshot_refreshed": str(SNAPSHOT_PATH.relative_to(ROOT)),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
