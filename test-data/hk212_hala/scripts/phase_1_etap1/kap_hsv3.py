"""Kapitola HSV-3 — Ocelové konstrukce.

Per task spec §4.3: 18-25 items. Granularity per Rožmitál precedent:
2-3 položek per ocelový profil (specifikace + montáž + nátěr/povrch).

Facts (§1 invariants):
- Sloupy IPE 400 rámové: 36 ks S235, výška 4.3 m, hmotnost 66.3 kg/m
- Sloupy HEA 200 štítové: 8 ks S235, výška 4.3 m, hmotnost 42.3 kg/m
- Příčle IPE 450 s náběhem: 6 rámů, rozpon 18.5 m, hmotnost 77.6 kg/m × 1.1
- Vaznice IPE 160: 12 řad × 27.4 m, 15.8 kg/m
- Vaznice krajní UPE 160: 2 ks × 27.4 m, 18.8 kg/m
- Ztužidla stěnová L70/70/6: 8 ks × ~6.4 m, 6.4 kg/m
- Ztužidla střešní R20: 8 ks × ~12 m, 2.47 kg/m
- EXC2, P1, tolerance class 1, ČSN EN 1090-2
- Antikor 2-vrstvý C2 P1 životnost 15 let, R 15 DP1 protipožární
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
        items.append(build_item(seq=s, kapitola="HSV-3", **kw))

    # ── Specifikace + dodávka ocelových profilů S235 ─────────────────────
    add(
        popis="Specifikace + dodávka sloupy IPE 400 S235 jakost J0, EXC2 dle ČSN EN 1090-2",
        mj="kg", mnozstvi=36 * 4.3 * 66.3,
        qty_formula="36 ks × 4.3 m × 66.3 kg/m = 10 263 kg",
        source="DXF A101 INSERT 'Sloup IPE' × 36 + RE-RUN §3.3 + statika D.1.2",
        raw_description="Sloup IPE 400 S235 — A101 INSERT block name",
    )
    add(
        popis="Specifikace + dodávka sloupy HEA 200 S235 jakost J0, štítové, EXC2",
        mj="kg", mnozstvi=8 * 4.3 * 42.3,
        qty_formula="8 ks × 4.3 m × 42.3 kg/m = 1 455 kg",
        source="DXF A101 INSERT 'M_S profily_ sloup' × 8 + statika D.1.2",
        raw_description="M_S profily HEA 200 — A101 INSERT",
    )
    add(
        popis="Specifikace + dodávka příčlí IPE 450 S235 s náběhem (sklon 5.25°)",
        mj="kg", mnozstvi=6 * 18.5 * 77.6 * 1.1,
        qty_formula="6 rámů × 18.5 m × 77.6 kg/m × 1.1 (náběh) = 9 478 kg",
        source="statika D.1.2 + geom. rozpon 18.5 m + sklon 5.25° (NE 5.65° per RE-RUN §9.2)",
        raw_description="Příčle IPE 450 + náběh",
        completeness=0.85,
    )
    add(
        popis="Specifikace + dodávka vaznice IPE 160 S235 jakost J0",
        mj="kg", mnozstvi=12 * 27.4 * 15.8,
        qty_formula="12 řad × 27.4 m × 15.8 kg/m = 5 195 kg",
        source="statika D.1.2 + geom. délka haly + rozteca 1.5 m",
        raw_description="vaznice IPE 160",
        completeness=0.80,
    )
    add(
        popis="Specifikace + dodávka vaznice krajní UPE 160 S235 jakost J0",
        mj="kg", mnozstvi=2 * 27.4 * 18.8,
        qty_formula="2 ks × 27.4 m × 18.8 kg/m = 1 030 kg",
        source="statika D.1.2 (UPE 160 — NE C150×19.3 per RE-RUN §9.4)",
        raw_description="vaznice krajní UPE 160",
        vyjasneni_refs=["ABMV_15"],
    )
    add(
        popis="Specifikace + dodávka ztužidla stěnová L 70/70/6 S235",
        mj="kg", mnozstvi=8 * 6.4 * 6.4,
        qty_formula="8 ks × 6.4 m × 6.4 kg/m = 328 kg",
        source="statika D.1.2 L70/70/6 stěnová ztužidla",
        raw_description="ztužidla stěnová L 70/70/6",
        completeness=0.80,
    )
    add(
        popis="Specifikace + dodávka ztužidla střešní z kruhových tyčí Ø20 S235",
        mj="kg", mnozstvi=8 * 12.0 * 2.47,
        qty_formula="8 ks × 12 m × 2.47 kg/m = 237 kg",
        source="DXF A101 INSERT 'Kruhové tyče' × 8 + statika D.1.2",
        raw_description="ztužidla střešní Ø20",
    )
    add(
        popis="Styčníkové plechy + spojovací materiál šroubový grade 8.8 — celk. paušál 6%",
        mj="kg", mnozstvi=1450.0,
        qty_formula="~6% × součet OK 27 985 kg ≈ 1 450 kg",
        source="ČSN EN 1090-2 + standardní podíl spojovacího materiálu",
        raw_description="spojovací materiál grade 8.8",
        completeness=0.75,
    )

    # ── Kotvení a montáž ─────────────────────────────────────────────────
    add(
        popis="Kotvení sloupů ke patkám — chemická kotva M20 nebo zalité šrouby, výztužná deska",
        mj="ks", mnozstvi=44 * 4.0,
        qty_formula="(36 + 8) sloupů × 4 kotvy/sloup = 176 ks",
        source="A105 sokly patek + statika D.1.2 kotevní detail",
        raw_description="kotvení sloupů M20",
    )
    add(
        popis="Montáž ocelové konstrukce — kompletní rámová hala, dle ČSN EN 1090-2 EXC2 tol. cl. 1",
        mj="t", mnozstvi=28.0,
        qty_formula="součet OK profilů + kotev = ~28 t",
        source="statika D.1.2 + standardní montážní normohodiny",
        raw_description="montáž OK kompletní",
    )
    add(
        popis="Doprava ocelové konstrukce na stavbu (default 50 km)",
        mj="t·km", mnozstvi=28 * 50,
        qty_formula="28 t × 50 km",
        source="default 50 km výrobna → stavba",
        raw_description="doprava OK 50 km",
        completeness=0.70,
    )

    # ── Povrchové úpravy ─────────────────────────────────────────────────
    add(
        popis="Antikorozní nátěr 2-vrstvý dle ISO 12944, korozní katego­rie C2, P1, životnost 15 let",
        mj="m²", mnozstvi=850.0,
        qty_formula="celk. povrch profilů ~30 m²/t × 28 t = 850 m²",
        source="statika D.1.2 C2 P1 životnost 15 + ISO 12944",
        raw_description="antikor 2-vrstvý ISO 12944 C2 P1",
    )
    add(
        popis="Protipožární nátěr — interiérové prvky R 15 DP1",
        mj="m²", mnozstvi=850.0,
        qty_formula="= antikor plocha (interiérové prvky stejně)",
        source="PBŘ §1 nosné konstrukce R 15 DP1",
        raw_description="protipožární nátěr R 15",
    )

    # ── Revize / odevzdání ───────────────────────────────────────────────
    add(
        popis="Revize ocelové konstrukce + protokol o předání, EXC2 ČSN EN 1090-2",
        mj="paušál", mnozstvi=1.0,
        qty_formula="paušál",
        source="ČSN EN 1090-2 + autorský dozor",
        raw_description="revize OK + protokol",
    )

    return items
