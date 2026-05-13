"""Kapitola HSV-1 — Zemní práce, bourání, kácení.

Per task spec §4.1: 22-30 items. Every item carries ABMV_17 reference
(earth-works bilance 32 m³ TZ vs 341.8 m³ independent calc — 10.7× drift).

Quantities derived from Phase 0b RE-RUN MASTER facts + spec §1 invariants:
- 14 patek rámových 1.5×1.5 (DXF verified)
- 8 patek štítových 0.8×0.8 (DXF verified)
- 1 atypický základ / pilota variant
- 495 m² podlahová plocha
- 250 mm štěrkové lože pod deskou
- Sklon výkopu 1:1, hloubky -1.30 / -1.90 m
- 2 stávající sítě DN300 křížení (splašková + dešťová)
"""
from __future__ import annotations

from .item_schema import Item
from .kapitola_helpers import build_item

ABMV17 = ["ABMV_17"]


def build_items() -> list[Item]:
    items: list[Item] = []
    s = 0

    def add(**kw):
        nonlocal s
        s += 1
        items.append(build_item(seq=s, kapitola="HSV-1", **kw))

    # ── Hloubení ─────────────────────────────────────────────────────────
    add(
        popis="Hloubení figury pod základovou desku, stroj. v hor. tř. 3",
        mj="m³", mnozstvi=495 * 0.45,
        qty_formula="495 m² × 0.45 m (deska 0.20 + lože 0.25)",
        source="A102 zastavěná 28.19×19.74 + TZ B m.10.g + Phase 0b RE-RUN §3.10",
        raw_description="figura pod deskou — výkop pro polštář a desku",
        vyjasneni_refs=ABMV17,
    )
    add(
        popis="Hloubení dohloubek pro patky rámové, hor. tř. 3, do 1 m hloubky",
        mj="m³", mnozstvi=14 * 1.5 * 1.5 * 1.0,
        qty_formula="14 ks × 1.5 m × 1.5 m × 1.0 m (od úr. figury -0.45 do -1.45/-1.90)",
        source="A105 ZÁKLADY DIM 1500 mm × 15 + RE-RUN §3.3 sloupy IPE 400 = 36 ks (14 rámových pos)",
        raw_description="dohloubky patek rámových",
        vyjasneni_refs=ABMV17,
    )
    add(
        popis="Hloubení dohloubek pro patky štítové, hor. tř. 3, do 0.5 m hloubky",
        mj="m³", mnozstvi=8 * 0.8 * 0.8 * 0.25,
        qty_formula="8 ks × 0.8 × 0.8 × 0.25 m (od figury -0.45 do -0.70)",
        source="A105 DIM 800 mm × 8 + RE-RUN §3.3 sloupy HEA 200 = 8 ks",
        raw_description="dohloubky patek štítových",
        vyjasneni_refs=ABMV17,
    )
    add(
        popis="Hloubení atypického základu — varianta jako pilota Ø800 / L=8 m",
        mj="m³", mnozstvi=12.0,
        qty_formula="placeholder 12 m³ (vrt + zaplnění; variantní řešení per A105 mtext)",
        source="A105 MTEXT 'ATYPICKÝ ZÁKLAD MOŽNO VYMĚNIT ZA PILOTU Ø800 / L=8,0m'",
        raw_description="atypický základ — pilota variant",
        vyjasneni_refs=["ABMV_11", "ABMV_17"],
        status_flag="variant_pending_IGP",
        completeness=0.60,
    )
    add(
        popis="Hloubení rýh pro krátké pasy mezi patkami, hor. tř. 3, do 0.6 m hloubky",
        mj="m³", mnozstvi=30 * 0.4 * 0.6,
        qty_formula="~30 bm × 0.4 m × 0.6 m (krátké propojovací pasy)",
        source="A105 layout estimate (Phase 0b RE-RUN §3.10 pasy_mezi_patkami)",
        raw_description="pasy mezi patkami",
        vyjasneni_refs=ABMV17,
    )
    add(
        popis="Ruční výkop v ochranných pásmech stávajících sítí DN300, hor. tř. 3",
        mj="m³", mnozstvi=30.0,
        qty_formula="2 křížení × 5 m délka × 1.5 m š × 2.0 m h",
        source="A201 layer Stávající_kan + TZ B m.10.g + RE-RUN §6 splašková+dešťová DN300",
        raw_description="ruční výkop u sítí",
        vyjasneni_refs=ABMV17,
    )
    add(
        popis="Příplatek za stížené podmínky — ruční výkop u stávajících sítí",
        mj="m³", mnozstvi=30.0,
        qty_formula="= ruční výkop u sítí (m³)",
        source="ČSN požadavek na opatrný výkop v ochranných pásmech",
        raw_description="příplatek ruční výkop",
        vyjasneni_refs=ABMV17,
    )
    add(
        popis="Pažení výkopů hloubky nad 1.3 m — atypický základ",
        mj="m²", mnozstvi=20.0,
        qty_formula="placeholder 20 m² (perimetr atypického základu × hloubka)",
        source="ČSN 73 3050 + Phase 0b RE-RUN §3.10 hloubka -1.90",
        raw_description="pažení výkopu",
        vyjasneni_refs=["ABMV_11", "ABMV_17"],
        status_flag="placeholder_engineering_estimate",
        completeness=0.70,
    )

    # ── Obetonování stávajících sítí ──────────────────────────────────────
    add(
        popis="Obetonování stávajícího potrubí splaškové kanalizace DN300 betonem C16/20",
        mj="m³", mnozstvi=5.0,
        qty_formula="placeholder ~5 m³ (úsek 5 m × tlouš. 0.3 m × š. 0.8 m + ofset)",
        source="A201 stávající splašková kan DN300 + TZ B m.10.g obetonování",
        raw_description="obetonování splaškové DN300",
        vyjasneni_refs=ABMV17,
        completeness=0.70,
    )
    add(
        popis="Obetonování stávajícího potrubí dešťové kanalizace DN300 betonem C16/20",
        mj="m³", mnozstvi=5.0,
        qty_formula="placeholder ~5 m³ (úsek 5 m × 0.3 × 0.8 + ofset)",
        source="A201 stávající dešťová kan DN300 + TZ B m.10.g",
        raw_description="obetonování dešťové DN300",
        vyjasneni_refs=ABMV17,
        completeness=0.70,
    )

    # ── Pomocné výkopy pro nové přípojky ──────────────────────────────────
    add(
        popis="Pomocné výkopy pro novou přípojku vodovod DN150 LT",
        mj="m³", mnozstvi=8.0,
        qty_formula="cca 16 m × 0.5 m š × 1.0 m h (TZ B m.10.g + RE-RUN §6)",
        source="RE-RUN §6 externí sítě — vodovod LT DN150",
        raw_description="pomocný výkop vodovod",
        vyjasneni_refs=ABMV17,
    )
    add(
        popis="Pomocné výkopy pro novou areálovou kanalizaci DN200",
        mj="m³", mnozstvi=82 * 0.5 * 1.2,
        qty_formula="82 m gravitační × 0.5 m š × 1.2 m h",
        source="RE-RUN §6 — Areálová kanalizace DN200 SN12 (82 m grav. + 3 m tlak.)",
        raw_description="pomocný výkop kanalizace nová",
        vyjasneni_refs=ABMV17,
    )

    # ── Lože a zhutnění ───────────────────────────────────────────────────
    add(
        popis="Štěrkové lože pod základovou deskou, tl. 250 mm, frakce 0/63",
        mj="m³", mnozstvi=495 * 0.25,
        qty_formula="495 m² × 0.25 m",
        source="TZ B + statika D.1.2 + §1 invariant",
        raw_description="štěrkové lože tl. 250 mm",
        vyjasneni_refs=ABMV17,
    )
    add(
        popis="Zhutnění podloží Edef,2 ≥ 45 MPa, Edef2/Ede < 1.75",
        mj="m²", mnozstvi=495.0,
        qty_formula="= plocha desky",
        source="TZ B + statika D.1.2 § ground bearing",
        raw_description="zhutnění lože pod deskou",
        vyjasneni_refs=ABMV17,
    )
    add(
        popis="Zásyp výkopů kolem patek + okolo obetonovaných sítí, zhutněný",
        mj="m³", mnozstvi=30.0,
        qty_formula="placeholder ~30 m³ (zásypy okolo patek + nad obetonovanými sítěmi)",
        source="Phase 0b RE-RUN §3.10 zásypy",
        raw_description="zásyp výkopů zhutněný",
        vyjasneni_refs=ABMV17,
        completeness=0.70,
    )

    # ── Doprava zeminy ────────────────────────────────────────────────────
    total_vykop = 350.0  # baseline Phase 0b
    add(
        popis="Nakládání zeminy hor. tř. 1-4 na dopravní prostředek",
        mj="m³", mnozstvi=total_vykop,
        qty_formula="= celkový objem výkopu 350 m³ (Phase 0b baseline)",
        source="Phase 0b RE-RUN §3.10 total výkop 341.8 m³ rounded 350 m³",
        raw_description="nakládání zeminy",
        vyjasneni_refs=ABMV17,
    )
    add(
        popis="Vodorovné přemístění zeminy do 5000 m, sklon do 5 %",
        mj="m³", mnozstvi=total_vykop,
        qty_formula="= 350 m³ × 1 (default 5 km deponie)",
        source="RE-RUN — deponie default 5 km",
        raw_description="vodorovné přemístění zeminy",
        vyjasneni_refs=ABMV17,
        completeness=0.80,
    )
    add(
        popis="Odvoz výkopu na deponii / skládku — kontejnerová doprava",
        mj="m³", mnozstvi=total_vykop,
        qty_formula="= 350 m³",
        source="Phase 0b RE-RUN baseline + ABMV_17",
        raw_description="odvoz výkopu",
        vyjasneni_refs=ABMV17,
    )
    add(
        popis="Skládkovné — uložení vytěžené zeminy na řízené skládce",
        mj="t", mnozstvi=350 * 1.8,
        qty_formula="350 m³ × 1.8 t/m³ (zhutněná zemina)",
        source="ČSN výpočet objem→hmotnost",
        raw_description="skládkovné zemina",
        vyjasneni_refs=ABMV17,
        completeness=0.75,
    )

    # ── Kácení dřevin (z TZ B m.7.b — chráněné porosty) ──────────────────
    add(
        popis="Kácení vzrostlých stromů Ø < 80 cm — bříza, dub červený",
        mj="ks", mnozstvi=2.0,
        qty_formula="2 ks (TZ B m.7.b)",
        source="TZ B chapter m.7.b chráněné porosty + C3 situace kácení",
        raw_description="kácení vzrostlé dřeviny",
    )
    add(
        popis="Kácení drobných dřevin a semenáčků — javor klen, dub letní",
        mj="ks", mnozstvi=5.0,
        qty_formula="placeholder 5 ks (TZ B m.7.b)",
        source="TZ B + C3 situace kácení",
        raw_description="kácení drobné dřeviny",
        completeness=0.75,
    )
    add(
        popis="Frézování pařezů po kácení dřevin",
        mj="ks", mnozstvi=7.0,
        qty_formula="2 vzrostlé + 5 drobné = 7 pařezů",
        source="ČSN postup likvidace pařezů",
        raw_description="frézování pařezů",
    )
    add(
        popis="Odvoz dřevní hmoty po kácení a likvidace",
        mj="m³", mnozstvi=6.0,
        qty_formula="placeholder ~6 m³ dřevní hmoty",
        source="estimate na základě počtu stromů",
        raw_description="odvoz dřevní hmoty",
        completeness=0.70,
    )
    add(
        popis="Náhradní výsadba dřevin per rozhodnutí orgánu životního prostředí",
        mj="ks", mnozstvi=2.0,
        qty_formula="2 ks (per TZ B m.7.b náhradní výsadba)",
        source="TZ B m.7.b",
        raw_description="náhradní výsadba",
    )

    # ── Bourání stávající zpevněné plochy ────────────────────────────────
    add(
        popis="Odstranění stávající asfaltové vrstvy + podkladu, tl. do 250 mm",
        mj="m²", mnozstvi=540.0,
        qty_formula="placeholder ~540 m² (z C3 situace + plocha pod halou)",
        source="C3 situace + Phase 0b RE-RUN §3.10",
        raw_description="odstranění asfaltu + podkladu",
        vyjasneni_refs=ABMV17,
        completeness=0.70,
    )
    add(
        popis="Nakládání stavební suti na dopravní prostředek",
        mj="t", mnozstvi=80.0,
        qty_formula="placeholder 540 m² × 0.25 m × 2 t/m³ × 30% = ~80 t",
        source="estimate na základě plochy bouraného povrchu",
        raw_description="nakládání suti",
        vyjasneni_refs=ABMV17,
        completeness=0.70,
    )
    add(
        popis="Odvoz stavební suti k recyklaci — vč. skládkovného",
        mj="t", mnozstvi=80.0,
        qty_formula="= nakládání suti",
        source="zákon o odpadech 541/2020 Sb. recyklace",
        raw_description="odvoz suti recyklace",
        vyjasneni_refs=ABMV17,
        completeness=0.70,
    )

    return items
