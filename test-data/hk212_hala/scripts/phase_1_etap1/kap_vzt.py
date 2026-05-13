"""Kapitola VZT — Vzduchotechnika (konceptu z TZ B kap. B.3.5 §1).

Per task spec §4.11: 10-15 items. **VŠECHNY položky** flag
`_status_flag: "concept_pending_vzt_drawings"` + `_completeness: 0.50`
(placeholder quantity, výrobce dle TZ koncepčně).

Reference TZ B kap. B.3.5 §1:
- Rekuperační jednotka venkovní 4000 m³/h
- Venkovní kondenzační jednotka chlazení 15 kW
- Dveřní clony horizontální 4700 m³/h š. 2 m × 8 ks (2 ks/vrata × 4 vrata)
- Potrubí SPIRO pozink (placeholders)
"""
from __future__ import annotations

from .item_schema import Item
from .kapitola_helpers import build_item


def build_items() -> list[Item]:
    items: list[Item] = []
    s = 0

    def add(**kw):
        nonlocal s
        s += 1
        items.append(build_item(
            seq=s, kapitola="VZT",
            status_flag="concept_pending_vzt_drawings",
            data_source="TZ_only",
            completeness=0.50,
            **kw,
        ))

    add(
        popis="Rekuperační jednotka venkovní 4000 m³/h s deskovým rekuperátorem + el. ohřev + přímý výparník",
        mj="ks", mnozstvi=1.0,
        qty_formula="1 ks (TZ B B.3.5 §1)",
        source="TZ B kap. B.3.5 §1 — koncepční specifikace",
        raw_description="rekuperační jednotka 4000 m³/h",
    )
    add(
        popis="Venkovní kondenzační jednotka chlazení 15 kW pro přímý výparník",
        mj="ks", mnozstvi=1.0,
        qty_formula="1 ks (TZ B B.3.5 §1)",
        source="TZ B kap. B.3.5 §1",
        raw_description="kondenzační jednotka 15 kW",
    )
    add(
        popis="Dveřní clona horizontální 4700 m³/h, š. 2 m, s el. ohřevem",
        mj="ks", mnozstvi=8.0,
        qty_formula="2 ks/vrata × 4 vrata = 8 ks",
        source="TZ B B.3.5 §1 + 4 sekční vrata",
        raw_description="dveřní clona 4700 m³/h š. 2m",
    )
    add(
        popis="Potrubí SPIRO pozink Ø 315 mm — hlavní rozvod",
        mj="bm", mnozstvi=60.0,
        qty_formula="placeholder 60 bm (hlavní páteř haly)",
        source="TZ B B.3.5 §1 koncepčně + standardní dimensioning",
        raw_description="SPIRO Ø 315",
    )
    add(
        popis="Potrubí SPIRO pozink Ø 250 mm — větve",
        mj="bm", mnozstvi=80.0,
        qty_formula="placeholder 80 bm (boční větve)",
        source="standardní dimensioning",
        raw_description="SPIRO Ø 250",
    )
    add(
        popis="Potrubí SPIRO pozink Ø 160 mm — koncové úseky + napojení clon",
        mj="bm", mnozstvi=120.0,
        qty_formula="placeholder 120 bm (přívody k 8 clonám)",
        source="standardní dimensioning",
        raw_description="SPIRO Ø 160",
    )
    add(
        popis="Tlumiče hluku v potrubí — kruhové, vč. připojovacích manžet",
        mj="ks", mnozstvi=4.0,
        qty_formula="placeholder 4 ks (na hlavním rozvodu)",
        source="ČSN hlukové limity + standardní design",
        raw_description="tlumiče hluku potrubí",
    )
    add(
        popis="Tepelná izolace VZT potrubí — kaučuková tl. 13 mm, parotěsná",
        mj="m²", mnozstvi=180.0,
        qty_formula="placeholder 180 m² (~70 % povrchu potrubí — venkovní úseky)",
        source="ČSN tepelná izolace VZT + TZ B",
        raw_description="tepelná izolace VZT 13 mm",
    )
    add(
        popis="Antivibrační pružná uložení rekuperace + manžety na přípojkách",
        mj="kpl", mnozstvi=1.0,
        qty_formula="1 kpl (rekuperační jednotka)",
        source="standardní detail",
        raw_description="antivibrační uložení rekuperace",
    )
    add(
        popis="Automatická regulace VZT s MaR (měření a regulace) — řízení rekuperace + clon",
        mj="kpl", mnozstvi=1.0,
        qty_formula="1 kpl",
        source="standardní vybavení rekuperační jednotky",
        raw_description="MaR VZT",
    )
    add(
        popis="Dálkové ovládání + napojení na centrální řízení haly",
        mj="kpl", mnozstvi=1.0,
        qty_formula="1 kpl",
        source="standardní vybavení",
        raw_description="dálkové ovládání VZT",
    )
    add(
        popis="Závěsy + příchytky potrubí SPIRO — komplet pro celý rozvod",
        mj="kpl", mnozstvi=1.0,
        qty_formula="1 kpl (komplet pro 260 bm rozvodů)",
        source="standardní detail",
        raw_description="závěsy + příchytky SPIRO",
    )
    add(
        popis="Spuštění + zaregulování VZT systému + měření hlučnosti a vzduchových výkonů",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="standardní VRN VZT",
        raw_description="spuštění + měření VZT",
    )
    add(
        popis="Doprava VZT komponentů — paušál pro veškeré jednotky a potrubí",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="standardní VRN doprava",
        raw_description="doprava VZT",
    )
    add(
        popis="Revize VZT + protokol o předání + zapojení do BMS",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="ČSN VZT + standardní revize",
        raw_description="revize VZT + protokol",
    )

    return items
