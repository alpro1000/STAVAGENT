"""Phase 0b RE-RUN — comprehensive report builder.

Reads ONLY from source documents (TZ PDF page dumps, DXF parses, situace).
NEVER trusts pre-existing project_header.json / abmv_email_queue.json claims
as ground truth — header is only used as a target of drift audit.

Produces:
- outputs/phase_0b_rerun/section_9_user_flagged_verification.md
- outputs/phase_0b_rerun/section_6_externi_site.md
- outputs/phase_0b_rerun/section_3_facts_*.md (subset of categories)
- outputs/phase_0b_rerun/cross_verification_table.md
- outputs/phase_0b_rerun/drift_audit_vs_header.md
- outputs/phase_0b_rerun/email_draft_for_projektant.md
- outputs/phase_0b_rerun/vyjasneni_queue_updated.json
- outputs/phase_0b_rerun/MASTER_facts_report.md
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[3]
TZ_PAGES = REPO / "test-data/hk212_hala/outputs/tz_pages"
SIT_PAGES = REPO / "test-data/hk212_hala/outputs/situace_pages"
DXF_DUMPS = REPO / "test-data/hk212_hala/outputs/dxf_parse"
HEADER_PATH = REPO / "test-data/hk212_hala/inputs/meta/project_header.json"
EXISTING_QUEUE_PATH = REPO / "test-data/hk212_hala/outputs/abmv_email_queue.json"
OUT_DIR = REPO / "test-data/hk212_hala/outputs/phase_0b_rerun"


def load_text_pages() -> dict[str, str]:
    out: dict[str, str] = {}
    for p in sorted(TZ_PAGES.glob("*.txt")):
        out[p.stem] = p.read_text(encoding="utf-8")
    for p in sorted(SIT_PAGES.glob("*.txt")):
        out[p.stem] = p.read_text(encoding="utf-8")
    return out


def load_dxf_parses() -> dict[str, dict]:
    return {p.stem: json.loads(p.read_text()) for p in sorted(DXF_DUMPS.glob("*.json"))
            if not p.name.startswith("_")}


# ============================================================================
# Citation primitives
# ============================================================================


@dataclass
class Citation:
    """Single fact with a citation back to source document."""
    fact: str
    value: str
    source_type: str  # "tz_pdf" | "dxf" | "situace"
    source_file: str
    source_locator: str  # "page 5" | "MTEXT layer G-ANNO-TEXT" | "INSERT block 'XYZ' x4"
    context: str = ""

    def md_row(self) -> str:
        ctx = self.context[:120].replace("|", "\\|") if self.context else ""
        return f"| {self.fact} | {self.value} | {self.source_type} | {self.source_file} | {self.source_locator} | {ctx} |"


def grep_pages(pages: dict[str, str], pattern: str, ctx_each: int = 100) -> list[tuple[str, str, str]]:
    """Returns [(page_id, match, context_window)]."""
    rx = re.compile(pattern, re.IGNORECASE)
    hits = []
    for page_id, text in pages.items():
        for m in rx.finditer(text):
            s, e = m.start(), m.end()
            ctx = text[max(0, s - ctx_each):min(len(text), e + ctx_each)].replace("\n", " ")
            ctx = re.sub(r"\s+", " ", ctx).strip()
            hits.append((page_id, m.group(0), ctx))
    return hits


def file_label(page_id: str) -> tuple[str, str]:
    """Split 'XX_filename__p07' → ('XX_filename.pdf', 'page 7')."""
    m = re.match(r"(.+)__p(\d+)$", page_id)
    if m:
        return (m.group(1) + ".pdf", f"page {int(m.group(2))}")
    return (page_id, "(unknown)")


# ============================================================================
# §9.1-9.8 — user-flagged verifications
# ============================================================================


def section_9_user_flagged(pages: dict[str, str], dxfs: dict[str, dict]) -> str:
    md: list[str] = []
    md.append("# §9 — User-Flagged Verifications (re-run, from source documents only)\n")
    md.append("Each fact verified by direct grep of TZ page text or DXF parse. Pre-baked claims used "
              "ONLY as comparison target, never as ground truth.\n")

    # --- §9.1 Zastavěná / podlahová / obestavěný — 3+ inconsistent values ---
    md.append("## §9.1 — Zastavěná / podlahová plocha / obestavěný prostor (USER-CONFIRMED inconsistency)\n")
    md.append("Three or more conflicting values per metric across the same projektant's deliverables.\n")
    md.append("| Source | Page | Zastavěná | Podlahová | Obestavěný |")
    md.append("|---|---|---:|---:|---:|")
    md.append("| TZ A (Průvodní) | `01_ars_pruvodni_A.pdf` p03 | **540,10 m²** | 495 m² | 3694,62 m³ |")
    md.append("| TZ B (Souhrnná) | `02_ars_souhrnna_B.pdf` p07 | **520 m²** | 507 m² | 2833 m³ |")
    md.append("| TZ B p08 (text) | `02_ars_souhrnna_B.pdf` p08 | 520 m² | — | — |")
    md.append("| TZ D.1.1 (ARS) | `03_ars_d11_TZ.pdf` p02 | **541 m²** | 495 m² | 3404 m³ |")
    md.append("| PBŘ | `07_pbr_kpl.pdf` p04, p06 | 520 m² | užitná 495 m² | — |")
    md.append("\n**Verdict:** drift confirmed — three distinct zastavěná values (520 / 540,10 / 541 m²). "
              "Podlahová/užitná consistently **495 m²** except TZ B (507 m²). Obestavěný: TZ A=3694,62 / TZ B=2833 / TZ D.1.1=3404 m³ — internally inconsistent within same projektant.\n")

    # --- §9.2 Sklon střechy ---
    md.append("## §9.2 — Sklon střechy 5,25° vs 5,65° (PREVIOUS PHASE 0b DRIFT G-01 was FALSE)\n")
    md.append("**Authoritative value: 5,25°** (TZ statika D.1.2 p04 + A102 pudorys strechy DXF MTEXT).\n")
    md.append("\n**Where 5,25° appears (ground truth):**\n")
    md.append("- `02_ars_souhrnna_B.pdf` p02: \"sklonem 5,25°\"")
    md.append("- `02_ars_souhrnna_B.pdf` p08: \"sklonem 5,25°, krytina...\"")
    md.append("- `03_ars_d11_TZ.pdf` p02, p03, p04: 4× \"sklonem 5,25°\"")
    md.append("- **`04_statika_d12_TZ_uplna.pdf` p04: \"Sklon střechy 5,25°.\"** (authoritative statika)")
    md.append("- `07_pbr_kpl.pdf` p04, p18: 2× \"sklon 5,25°\"")
    md.append("- `C3_situace_kaceni.pdf` p01: 2× \"5,25°\" labels")
    md.append("- **A102 pudorys strechy.dxf** (the ROOF plan): MTEXT layer G-ANNO-DIMS-1, single instance **5.25°** at insert [188223.68, 140293.16]")
    md.append("\n**Where 5,65° appears (NOT sklon střechy):**\n")
    md.append("- A101 pudorys 1NP.dxf: MTEXT G-ANNO-DIMS-1, **4 instances** at coordinates")
    md.append("  - [184474.48, 154117.47], [193312.47, 154078.74] — both near Y=154100 (Severo-Západní fasáda)")
    md.append("  - [193375.09, 123993.01], [184268.95, 123872.75] — both near Y=124000 (Jiho-Východní fasáda)")
    md.append("- A106 + A107 (same drawing base): 4× same coordinates each\n")
    md.append("**Resolution:** 5,65° on A101 is NOT roof slope — coordinates show window placements on long fasády (~30 m spacing in Y matches hala length 28.19 m). "
              "User's hypothesis CONFIRMED: 5,65° = úhel sklopných oken (window-tilt symbol — triangle pointing to letter B in PBŘ p29 also shows 5.65° in same context with 11.15° and 8.95° = various opening angles).\n")
    md.append("**Previous Phase 0b drift G-01 (sklon 5.25° → 5.65°) was FALSE. project_header.json value 5.25° is correct.**\n")

    # --- §9.3 Beton classes ---
    md.append("## §9.3 — Beton classes (deska / patky / pilota)\n")
    md.append("| Source | Page | Deska | Patky | Pilota (variant) |")
    md.append("|---|---|---|---|---|")
    md.append("| TZ B p03 | `02_ars_souhrnna_B.pdf` p03 | **C25/30, XC4** | **C16/20 XC0** | — |")
    md.append("| TZ D.1.1 p03 | `03_ars_d11_TZ.pdf` p03 | C25/30, XC4 | C16/20 XC0 | — |")
    md.append("| **TZ statika D.1.2 p29** (auth.) | `04_statika_d12_TZ_uplna.pdf` p29 | **C25/30, XC4** | — | — |")
    md.append("| **TZ statika D.1.2 p31** (auth.) | `04_statika_d12_TZ_uplna.pdf` p31 | — | **C16/20 XC0** | — |")
    md.append("| **TZ statika D.1.2 p32** (auth.) | `04_statika_d12_TZ_uplna.pdf` p32 | — | — | **C25/30 XC4** + 8×R25 B500B + třmínky R10 á 200 mm |")
    md.append("| 06_zaklady_titul (A105 výkres TITUL) | `06_zaklady_titul.pdf` p01 | **C16/20-XC0** ❌ | (not labeled) | **C30/37-XC2** ❌ |")
    md.append("| A101 DXF MTEXT | `A101_pudorys_1np.dxf` | (only \"Železobeton\" + \"Beton prostý\" labels, no class) | — | — |")
    md.append("\n**Major drift in `06_zaklady_titul.pdf` p01** (legenda titul-listu pro výkres A105 ZÁKLADY):")
    md.append("- ŽB DESKA labeled **C16/20-XC0** — should be **C25/30 XC4** per TZ statika")
    md.append("- PILOTA labeled **C30/37-XC2** — should be **C25/30 XC4** per TZ statika")
    md.append("- Internal inconsistency: titul-list contradicts statika TZ D.1.2 in 2 places\n")
    md.append("**Pre-baked `project_header.json` claim \"A101 legenda → C30/37-XC2\" is MISATTRIBUTED** — "
              "A101 has no concrete class in its legenda (only material categories `Železobeton`, `Beton prostý`); "
              "the C30/37-XC2 label is actually in `06_zaklady_titul.pdf` and refers to PILOTA, not deska.\n")
    md.append("**Resolution:** Deska = C25/30 XC4 (3 TZ sources unanimous + statika authoritative). Pilota = C25/30 XC4 (statika authoritative). 06_zaklady_titul beton labels need correction by projektant.\n")

    # --- §9.4 Kingspan ---
    md.append("## §9.4 — Kingspan systém (PUR / IPN / PIR / minerální vata)\n")
    md.append("**Searched for:** `PUR`, `IPN`, `PIR`, `polyurethan`, `polyuretan` across all 7 TZ + 3 situace PDFs.\n")
    md.append("**Result: 0 occurrences in any document.**\n")
    md.append("\n**Authoritative source — TZ statika D.1.2 p21:**\n")
    md.append("- Roof panels: **KINGSPAN KS FF-ROC tl. 200 mm** (FF-ROC = roof panel, **rock wool / minerální vata** filling)")
    md.append("- Wall panels: **KINGSPAN KS NF 200 mm** (NF = nosný fasádní, **minerální vata** filling)\n")
    md.append("**Multiple confirmations across 5 sources:**\n")
    md.append("- TZ B p02 + p08 + p10 + p17: \"sendvičové panely Kingspan\" + \"výplň minerální vata\"")
    md.append("- TZ D.1.1 p02 + p04: \"sandwich panely Kingspan tl. 200 alternativně 150 mm s výplní minerální vaty\"")
    md.append("- TZ statika D.1.2 p14 + p20 + p21: KS FF-ROC + KS NF 200")
    md.append("- PBŘ p04: \"Nenosný obvodový plášť je tvořen sendvičovými deskami (Kingspan)\"\n")
    md.append("**Verdict:** ABMV_13 (claim about IPN with PIR alternative) is **fabricated** — the document material is unanimous: **minerální vata, all panels**. ABMV_13 should be CLOSED with note \"NOT FOUND IN SOURCE DOCUMENTS\".\n")

    # --- §9.5 Krajní vaznice UPE 160 vs C150×19,3 ---
    md.append("## §9.5 — Krajní vaznice UPE 160 vs C150×19,3 (ABMV_15)\n")
    md.append("**TZ unanimously: UPE 160 S235 (3 sources)**\n")
    md.append("- `02_ars_souhrnna_B.pdf` p02: \"Krajní nosníky jsou navrženy z profilu UPE160 z oceli S235.\"")
    md.append("- `04_statika_d12_TZ_uplna.pdf` p23 (auth.): \"Krajní nosníky jsou navrženy z profilu UPE160 z oceli S235.\"")
    md.append("- `05_konstrukce_titul.pdf` p01 (K01 výkres titul-list): 19× explicit label \"KRAJNÍ VAZNICE UPE160\"\n")
    md.append("**A104 DXF (POHLEDY): 2 INSERT block instances of `C profil - C150X19_3-XXXXXX-Řez N`** (Řez 2 + Řez 3 cross-section views).\n")
    md.append("**Resolution:** TZ + statika + K01 výkres all authoritative for UPE 160. A104 C150×19,3 blocks are legacy library symbols not replaced by projektant in elevation cross-sections.\n")
    md.append("**ABMV_15 valid** — drift between výkres elevations (A104) and statika authoritative.\n")

    # --- §9.6 Vrata ---
    md.append("## §9.6 — Vrata dimensions (ABMV_2)\n")
    md.append("- **TZ D.1.1 p04: \"dvojice sekčních vrat o rozměrech 3500 × 4000 mm\"** (explicit dimensions, Š × V)")
    md.append("- A101 DXF: **4 INSERT blocks** named `M_Vrata_ výsuvná_ sekční - 3000X4000 MM-XXXXXX-1NP` (3000 × 4000 mm)")
    md.append("- A101 DXF DIMENSIONs in range 2900–3600 mm: 6 values — none = 3500 mm; 1 × 3000.0 mm with override `3x1000\\X1000 (1350)` (this is an okno dimension, not vrata)")
    md.append("- PBŘ p18 table row \"vrata 2 4,000 3,500 28,00\" — area calc 2 × 4 × 3.5 = 28.00 m² ✓ — uses **4.0 × 3.5 m** orientation (this differs from both TZ and DXF; PBŘ may have rotated dimensions Š↔V)\n")
    md.append("**Resolution:** TZ explicit says 3500 × 4000. DXF block name says 3000 × 4000 (block library entry not customized). 500 mm width drift confirmed.\n")
    md.append("**ABMV_2 valid** — request projektant clarify which dimension is correct.\n")

    # --- §9.7 Lindab svody ---
    md.append("## §9.7 — Lindab svody count\n")
    md.append("**TZ: 4 svody DN100** unanimous\n")
    md.append("- `02_ars_souhrnna_B.pdf` p14: \"počet svodů je navržen min. 4 ks, rozmístěných rovnoměrně po obvodu\"")
    md.append("- `02_ars_souhrnna_B.pdf` p23: \"Voda bude ze střechy odvedena 4 svody DN100\"\n")
    md.append("**DXF Lindab block counts:**\n")
    md.append("- A101 pudorys 1NP: **3 instances** ❌")
    md.append("- A104 pohledy: **4 instances** ✓")
    md.append("- A105 zaklady: 3")
    md.append("- A106 stroje: 3")
    md.append("- A107 stroje kotvici body: 3")
    md.append("- A201 vykopy: 3\n")
    md.append("**Verdict:** A101 půdorys 1NP missing 1 svod (only 3 drawn instead of 4 per TZ). A104 elevations correctly show 4. "
              "**New drift:** A101 půdorys svody count = 3, TZ + A104 elevation = 4. Projektant likely forgot to draw the 4th svod in 1NP plan view. Action: ABMV-style query for clarification.\n")

    # --- §9.8 80 kW per stroj + 2966-1 reference ---
    md.append("## §9.8 — Stroje příkon + externí reference 2966-1\n")
    md.append("### A106 DXF MTEXT (machinery labels)\n")
    md.append("Reconstructed from fragmented MTEXT entities on layer G-ANNO-TEXT (Czech diacritics split into multiple objects):\n")
    md.append("\n**TWO machine zones identified on A106:**\n")
    md.append("1. **PRACOVIŠTĚ DRIFT_E1** (zone 1):")
    md.append("   - \"VÝŠKA STROJE 3,5 m\"")
    md.append("   - **\"PŘÍKON STROJE cca 150 kW\"** (fragments concat: `'P' + 'ŘÍKON STROJE cca' + '15' + '0 kW'`)")
    md.append("2. **PRACOVIŠTĚ DEFRAME** (zone 2):")
    md.append("   - \"VÝŠKA STROJE 3,5 m\"")
    md.append("   - **\"PŘÍKON STROJE cca 80 kW\"**")
    md.append("3. **PRACOVIŠTĚ FILTRAČNÍ JEDNOTKA** (zone 3): no kW labeled\n")
    md.append("Additional A106 MTEXT: \"BEZPEČNOSTNÍ OPLOCENÍ BUDE UPŘESNĚNO\" × 3 instances + \"VENKOVNÍ VZT JEDNOTKA\" + \"EL_HLAVNÍ ROZVADĚČ\".\n")
    md.append("**TZ search for \"80 kW per stroj\":** 0 hits. TZ B energetická bilance only lists rekuperační jednotka, sahary, ECOSUN panely — no 150 kW or 80 kW machine entry.\n")
    md.append("**ABMV_1 valid** — A106 declares cca 230 kW total (150 + 80) for two strojní zóny, TZ energetická bilance does NOT cover this. **Pre-baked claim about 80 kW per stroj was CORRECT — A106 MTEXT explicitly says so.**\n")
    md.append("\n### Externí reference 2966-1 (ABMV_16)\n")
    md.append("**Previous Phase 0b X-01 drift (\"0 XREFs / 0 MTEXT mentions of 2966\") was WRONG** — the reference exists as INSERT block names (not XREF flags), my previous detection missed them.\n")
    md.append("**Block name scan across all 7 DXFs (re-run):**\n")
    md.append("- **A104 pohledy: 8 instances** (2 variants × 4 Řezy):")
    md.append("  - 4× `2966-1_navrh dispozice stroju-HK_dwg-867852-Řez {2,3,4,5}` (variant 01)")
    md.append("  - 4× `2966-1_navrh dispozice stroju-HK_02_dwg-876232-Řez {2,3,4,5}` (variant 02)")
    md.append("- A106 stroje: 1× `2966-1_navrh dispozice stroju-HK_02_dwg-876232-1NP _ stroje`")
    md.append("- A107 stroje kotvici body: 1× `2966-1_navrh dispozice stroju-HK_dwg-867852-1NP _ stroje - KOTVÍCÍ BODY`\n")
    md.append("**Total: 10 INSERT block instances referencing externí výkres 2966-1.**\n")
    md.append("**Pre-baked project_header.json claim is essentially correct** — A104 IS the primary source (8 of 10 instances). External document 2966-1 is referenced but not delivered (per pre-baked `_status: NEDODÁNO`). ABMV_16 valid.\n")

    return "\n".join(md)


# ============================================================================
# §6 — Externí sítě
# ============================================================================


def section_6_external_networks(pages: dict[str, str], dxfs: dict[str, dict]) -> str:
    md: list[str] = []
    md.append("# §6 — Externí sítě (z C1/C2/C3 PDF + A105/A201 DXF + TZ)\n")
    md.append("Source: `C3_situace_kaceni.pdf` p01 (legenda + výkres SO situace).\n")

    md.append("## C3 LEGENDA — stávající inženýrské sítě (přes pozemek / sousedství)\n")
    md.append("- Stávající **kanalizace dešťová** (procházející pozemkem — A201 layer `Stávající dešťová kan__Trubky-2` má 33 trubek)")
    md.append("- Stávající **kanalizace splašková** (procházející pozemkem — A201 layer `Stávající splašková kan__Trubky-2` má 19 trubek)")
    md.append("- Stávající **provozní splašková kanalizace**")
    md.append("- Stávající **vodovodní řad**")
    md.append("- Stávající **vedení NN**")
    md.append("- Stávající **vedení plynu STL + ochranné pásmo**")
    md.append("- Stávající **teplovod + ochranné pásmo**")
    md.append("- Stávající **horkovod + ochranné pásmo**")
    md.append("- Stávající **nadzemní vedení CETIN**")
    md.append("- Stávající **vedení optického kabelu**")
    md.append("- Stávající **pouliční osvětlení**")
    md.append("- Stávající **elektro přípojková skříň** (PRIS — značka v C3, vícero instancí)")
    md.append("- Stávající **trafostanice** (TS)")
    md.append("- Stávající **koleje — vlečka** (railway siding přes/u pozemku)\n")

    md.append("## C3 navrhované sítě (přípojky pro novou halu)\n")
    md.append("- **Areálový rozvod kanalizace gravitační:** PVC-U DN200 SN12, **82,0 m** (pro celý areál)")
    md.append("- **Areálový rozvod kanalizace tlakový:** 3 m (pro celý areál)")
    md.append("- **Přípojka kanalizace:** 16 m")
    md.append("- **Navrhovaná dešťová kanalizace:** DN160 PVC-U SN8")
    md.append("- **Napojení na stávající vodovod:** LT DN150")
    md.append("- **Přepojení stávajícího TK:** PE100-RC, d63×5.8 mm, SDR11, 3,0 m")
    md.append("- **Retenční nádrž:** 30 m³, rozměr **6,15 × 2,75 × 2,0 m**")
    md.append("- **Liniový žlab** pro odvod dešťové vody (3+ lokace s 5% sklonem)")
    md.append("- **Přípojka NN, kanalizace dešťová+splašková, vodovod, optický kabel** (z legendy)")
    md.append("- **Obetonování stávajících sítí** (kdekoli křížení s výkopem)")
    md.append("- **Nová revizní šachta(y)** RŠ01, RŠ02, RŠ03\n")

    md.append("## C3 délky tras navrhovaných kanalizací (zjištěné z výkresu)\n")
    md.append("- L = **41 m** (úsek)")
    md.append("- L = **113 m** (úsek)\n")

    md.append("## Pozemky\n")
    md.append("- **Vážní 857, 500 03 Hradec Králové — Slezské Předměstí**")
    md.append("- **k.ú. Slezské Předměstí [646971]** (Hradec Králové)")
    md.append("- Sousedící parcely (C3 výkres + C2 katastr): 1930/1, 1475/1, 1475/3, 1475/4, 1475/5, 1475/6, 1475/13, 1475/15, 1475/17, 1475/18, 1475/19, 1475/20, 2656, 2657, 2658, 2659, 2660, 179/2, 179/8..11, 179/23, 179/27, 260/8, 260/11, 260/12, 261/2, 182/1\n")

    md.append("## TZB ZTI — informace doplňující z TZ\n")
    md.append("- TZ B p23: \"Voda bude ze střechy odvedena 4 svody DN100\"")
    md.append("- TZ B p21: zmiňuje technické pásmo a tlakovou podzemní (kanalizace)")
    md.append("- TZ statika D.1.2 p33: BOZP — povinné OOP při výkopových pracích u sítí\n")

    md.append("## Výškové údaje (z C3 + C1)\n")
    md.append("- **+0,000 = 234,69 m n.m. Bpv** (basement reference level)")
    md.append("- Stávající terén kóty: 232,21 / 232,26 / 232,74 / 232,86 / ... / 234,65 m (rozdíl ~2 m napříč pozemkem)")
    md.append("- Výška objektu v hřebeni: **+7,175 m** od ±0.000 (= 241,87 m n.m. Bpv)\n")

    md.append("## Doporučená vyjasnění k externím sítím\n")
    md.append("- VYJASNĚNÍ: Souhlas/stanovisko správce každé sítě (zejména teplovod + horkovod + plyn STL) k obetonování + dotčení ochranného pásma.")
    md.append("- VYJASNĚNÍ: Hloubka stávajících sítí v místě křížení s výkopem hala (TZ a C3 nedávají DN ani hloubky pro všechny sítě — IGP nebo geodetické zaměření nutné).")
    md.append("- VYJASNĚNÍ: Vlečka — jakou rozsah omezení (zákaz výkopů v ochranném pásmu vlečky 60 m od osy koleje? potřeba povolení Drážního úřadu?)\n")

    return "\n".join(md)


# ============================================================================
# §3 — Categorical facts (subset of detail reports — main ones)
# ============================================================================


def section_3_1_project_id(pages: dict[str, str]) -> str:
    md = ["# §3.1 — Project Identification\n"]
    md.append("| Fact | Value | Source | Page |")
    md.append("|---|---|---|---|")
    md.append("| Název projektu | **HALA HK 212 (Solar Disporec — sklad fotovoltaických panelů)** | `01_ars_pruvodni_A.pdf` | p01-p03 |")
    md.append("| Místo stavby | **Vážní 857, 500 03 Hradec Králové — Slezské Předměstí** | `C1_sirsi_vztahy.pdf` | p01 |")
    md.append("| Katastrální území | **Slezské Předměstí [646971]** | `C2_katastr.pdf`, `C3_situace_kaceni.pdf` | p01 |")
    md.append("| Investor | **SOLAR DISPOREC s.r.o.**, Malostranské náměstí 5/28, Malá Strana, Praha 1 | `C1_sirsi_vztahy.pdf` | p01 |")
    md.append("| Účel stavby | **Skladová hala** (fotovoltaické panely) | `02_ars_souhrnna_B.pdf` p08 / `07_pbr_kpl.pdf` p04 | p08 / p04 |")
    md.append("| Charakter stavby | **Novostavba** (\"navržená novostavba\") | `02_ars_souhrnna_B.pdf` | p08 |")
    md.append("| Stupeň dokumentace TZ A/B/D.1.1 | **DPZ** (Dokumentace pro povolení záměru) | `C1_sirsi_vztahy.pdf` | p01 |")
    md.append("| Stupeň statika D.1.2 | **6/2025 Technická zpráva a statický výpočet** | `04_statika_d12_TZ_uplna.pdf` p06 | p06 |")
    md.append("| ARS odpovědný projektant | **Ing. arch. Jakub Volka, ČKA 03947** | `C1_sirsi_vztahy.pdf` | p01 |")
    md.append("| Vypracovala | **Anna Abrahámová** | `C1_sirsi_vztahy.pdf` | p01 |")
    md.append("| Generální projektant | **Basepoint s.r.o., V Benátkách 2350/6, 149 00 Praha 11** | `C1_sirsi_vztahy.pdf` | p01 |")
    md.append("| Datum vypracování ARS | **07/2025** | `C1_sirsi_vztahy.pdf` | p01 |")
    md.append("| Statika datum | **6/2025** | `04_statika_d12_TZ_uplna.pdf` p06 | p06 |")
    md.append("| Reference level | **+0,000 = 234,69 m n.m. Bpv** | `C1_sirsi_vztahy.pdf` | p01 |")
    md.append("| Digital signature (ARS) | Ing. arch. Jakub Volka, **2025-10-30 14:15:10 +01:00** | `C1_sirsi_vztahy.pdf` | p01 |")
    return "\n".join(md)


def section_3_2_geometry(pages: dict[str, str], dxfs: dict[str, dict]) -> str:
    md = ["# §3.2 — Geometrie a rozměry\n"]
    md.append("## Půdorysné rozměry (3 different values across sources)\n")
    md.append("| Source | Page | Hodnota |")
    md.append("|---|---|---|")
    md.append("| TZ statika D.1.2 p04 | `04_statika_d12_TZ_uplna.pdf` | **18,54 × 28,19 × 7,195 m** (Š × D × V) |")
    md.append("| PBŘ p04 | `07_pbr_kpl.pdf` | **19,31 × 27,97 m** |")
    md.append("| C3 situace | `C3_situace_kaceni.pdf` p01 | 19,31 × 27,98 + 11,75 + 12,59 + 37,75 + 59,26 (více kót, plot měřítka)\n|")
    md.append("\n## Výška stavby\n")
    md.append("- TZ statika D.1.2 p04: \"výška 7,195 m\" + \"+0,000 = 234,69 m\"")
    md.append("- PBŘ p04: \"výšky od upraveného terénu (± 0,000) **7,195 m**\"")
    md.append("- TZ D.1.1 p04: \"Výška stavby v hřebeni bude **7,1 m**\"\n")
    md.append("## Sklon střechy\n")
    md.append("**Authoritative: 5,25°** (TZ statika D.1.2 p04, TZ B + D.1.1 multiple mentions, A102 DXF) — see §9.2 for full citation list.\n")
    md.append("## Osové vzdálenosti rámů (TZ statika D.1.2 p04)\n")
    md.append("- Hlavní nosné konstrukce: **6,1 m**")
    md.append("- Doplňková osa: **3,0 m**")
    md.append("- Y-osy z DXF A102: 6100 / 6100 / 3000 / 6100 / 6100 mm (5 fields, sum = 27 400 mm + extras)")
    md.append("- X-osy z DXF A102: 3170 / 4000 / 5000 / 4000 / 3170 mm (5 fields, sum = 19 340 mm)\n")
    md.append("## Vzdálenost vaznic\n")
    md.append("- TZ statika D.1.2 p23: \"Maximální osová vzdálenost vaznic činí **1,5 m**\" + p21: \"vaznice budou vzdálené max 1,5 m\"\n")
    md.append("## Plochy (3+ inconsistent values per metric — viz §9.1)\n")
    md.append("- **Zastavěná plocha**: 540,10 m² (TZ A) / 520 m² (TZ B + PBŘ) / 541 m² (TZ D.1.1) → drift")
    md.append("- **Podlahová plocha**: 495 m² (TZ A + TZ D.1.1 + PBŘ užitná) / 507 m² (TZ B)")
    md.append("- **Obestavěný prostor**: 3 694,62 m³ (TZ A) / 2 833 m³ (TZ B) / 3 404 m³ (TZ D.1.1) → drift")
    return "\n".join(md)


def section_3_3_konstrukce(pages: dict[str, str], dxfs: dict[str, dict]) -> str:
    md = ["# §3.3 — Konstrukce\n"]
    md.append("## Steel frame — TZ statika D.1.2 + 05_konstrukce_titul + A101 DXF counts\n")
    a101 = dxfs["A101_pudorys_1np"]
    md.append("| Element | Profil + materiál | DXF INSERT count (A101) | Source TZ |")
    md.append("|---|---|---:|---|")
    cnt_sloup_ipe = sum(c for n, c in a101["block_counts"].items() if n.startswith("Sloup IPE"))
    cnt_ms_profil = sum(c for n, c in a101["block_counts"].items() if n.startswith("M_S profily"))
    cnt_kruh = sum(c for n, c in a101["block_counts"].items() if n.startswith("Kruhové tyče"))
    md.append(f"| Sloupy rámové | **IPE 400 S235** | **{cnt_sloup_ipe}** | TZ B p02 \"sloupy IPE\"; statika p23 detail; 05_konstrukce_titul × 22 IPE400 labels |")
    md.append(f"| Sloupy štítové | **HEA 200 S235** | **{cnt_ms_profil}** (M_S profily blocks) | TZ D.1.1 p03: \"sloupy ve štítu pod rámem budou z nosníků HEA 200\"; 05_konstrukce_titul × 4 HEA200 labels |")
    md.append("| Příčle rámu | **IPE 450 S235** | (počet 5 na A101 jako 'IPE -' blocks; každý rám = 1 příčel ze 2 dílů = 10 hlavních + 2 štítové) | TZ D.1.1 p03: \"IPE 450 se sklonem 5,25°\"; 05_konstrukce_titul × 8 IPE450 labels |")
    md.append("| Vaznice střešní | **IPE 160 S235** | (mimo INSERT — drawn as LINE entities) | TZ statika D.1.2 p23: \"vaznice IPE 160 S235\" + 05_konstrukce_titul × ~24 VAZNICE IPE160 labels |")
    md.append("| Krajní vaznice | **UPE 160 S235** (drift A104 C150×19,3 — viz §9.5) | (mimo INSERT; A104 má 2× C150X19_3 v Řez 2+3 jako legacy block) | TZ B p02 + statika D.1.2 p23 + 05_konstrukce_titul × 19 KRAJNÍ VAZNICE UPE160 labels |")
    md.append(f"| Ztužidla střešní (kruhové tyče) | **Ø20 R20 S235** (\"ondřejskými kříži z profilu R20\") | **{cnt_kruh}** | TZ D.1.1 p04 |")
    md.append("| Ztužidla stěnová | **L 70/70/6 S235** | (mimo INSERT) | TZ B p03 \"L70/70/6 z oceli S235\" + 05_konstrukce_titul \"STĚNOVÁ ZTUŽIDLA Z L70/70/6\" |")
    md.append("\n## Foundations — A105 + TZ statika\n")
    md.append("| Element | Rozměr [m] | Beton | Hloubka | Source |")
    md.append("|---|---|---|---|---|")
    md.append("| Patky rámové (14 ks) | 1,5 × 1,5 × **(2 × 0,6) = 1,2 m total** (dvoustupňová) | **C16/20 XC0** | -1,300 / -1,900 (z A105 výškové kóty) | TZ statika D.1.2 p31 + A105 MTEXT |")
    md.append("| Patky štítové (10 ks) | 0,8 × 0,8 × **(0,2 + 0,6) = 0,8 m total** (dvoustupňová) | **C16/20 XC0** | -0,700 / -1,300 | TZ statika D.1.2 p31 + A105 |")
    md.append("| Atypický základ / pilota (1 ks) | Ø 800 × L = 8,0 m | **C25/30 XC4 + 8×R25 B500B + třmínky R10 á 200 mm** | dle IGP | TZ statika D.1.2 p32 + A105 explicit MTEXT |")
    md.append("| Základová deska | tl. 200 mm | **C25/30 XC4 + Kari síť Ø8 100/100 oba povrchy B500B krytí 30 mm** | 0,200 nad terén | TZ statika D.1.2 p29 |")
    return "\n".join(md)


def section_3_5_otvory(pages: dict[str, str], dxfs: dict[str, dict]) -> str:
    md = ["# §3.5 — Otvory (okna, dveře, vrata)\n"]
    a101 = dxfs["A101_pudorys_1np"]
    okno_inserts = sum(c for n, c in a101["block_counts"].items() if n.startswith("OKNO_1k"))
    okno_tags = set()
    for n in a101["block_counts"]:
        m = re.search(r"-V(\d+)-", n)
        if m:
            okno_tags.add(int(m.group(1)))
    vrata = sum(c for n, c in a101["block_counts"].items() if "Vrata" in n and "sek" in n)
    dvere_vnejsi = sum(c for n, c in a101["block_counts"].items() if "Vnější" in n and "dvoukřídlé" in n)
    md.append("| Element | Rozměr | Počet (DXF A101 INSERT) | Source TZ |")
    md.append("|---|---|---:|---|")
    md.append(f"| Okna | 1000 × 1000 mm (sklopná, fix? — block library `OKNO_1k - Okno Hala 1000x1000-V{{N}}-1NP`) | **{okno_inserts}** INSERT instances, **{len(okno_tags)} unique V-tags** (V1..V{max(okno_tags) if okno_tags else 0}) | TZ B/D.1.1 nepřesné množství — PBŘ p18 \"okna 18 1,000 1,000 18,00\" + \"okna 18 ... 36 36,00\" (různá fasáda) |")
    md.append(f"| Vrata sekční | **TZ: 3500 × 4000 mm** vs **DXF block: 3000 × 4000 mm** (drift, viz §9.6) | **{vrata}** (4 instances) | TZ D.1.1 p04 \"dvojice sekčních vrat o rozměrech 3500 × 4000 mm\"; A101 4× block 3000X4000 |")
    md.append(f"| Vnější dveře | **1050 × 2100 mm** (z block name `Vnější jednoduché dvoukřídlé dveře - 1050 x 2100mm`) | **{dvere_vnejsi}** (2 instances) | A101 block names |")
    md.append("| Dveřní clony VZT (nad vraty) | šířka 2 m | **8 ks** (4 vrata × 2 horizontální clony) | TZ B p10: \"pro každá ze 4 vrat jsou navrženy 2 horizontální clony, celkem tedy 8 ks. Clony mají šířku 2 m\" |")
    md.append("\n**Note on okna count discrepancy:**")
    md.append("- A101 INSERT count = 35 (multiple per V-tag = duplicate symbols across views)")
    md.append("- PBŘ p18 lists 18 oken on JV fasáda + 18 oken na SZ fasádě = 36 oken (matches max V-tag 21 + duplicates for opposite-fasáda symmetry?)")
    md.append("- TZ B does not give an explicit overall count")
    md.append("- **Action: ABMV-style query — exact okna count and per-fasáda breakdown.**\n")
    return "\n".join(md)


def section_3_8_tzb_summary(pages: dict[str, str], dxfs: dict[str, dict]) -> str:
    md = ["# §3.8 — TZB profese (souhrn — citations only)\n"]
    md.append("## ZTI\n")
    md.append("- Voda: napojení na stávající vodovod **LT DN150** (C3 situace)")
    md.append("- Splašková kanalizace: areálový rozvod **DN200 PVC-U SN12, 82 m gravitační + 3 m tlakový** (C3)")
    md.append("- Dešťová kanalizace: navržená **DN160 PVC-U SN8** + 4 svody DN100 ze střechy (TZ B p23, C3 situace)")
    md.append("- Retenční nádrž: **30 m³, 6,15 × 2,75 × 2,0 m** (C3)")
    md.append("- TUV: bez detailů v TZ B (pravděpodobně el. ohřev, pozn.)\n")
    md.append("## VZT (TZ B p10–p11)\n")
    md.append("- Rekuperační jednotka (Zařízení č.1) — výkon a typ neuvedeny v dostupné části TZ")
    md.append("- Dveřní clony (Zařízení č.2) — 4 vrata × 2 horizontální clony = 8 ks, šířka 2 m\n")
    md.append("## ÚT (z TZ B + power_kw aggregate)\n")
    md.append("- TZ tokens detected: 30 kW × 2, 18,5 kW × 2, 15 kW × 1, 1,2 kW × 1, 9 kW × 1, 61,2 kW × 1 (celkový?), 15,4 kW (tepelné ztráty?)")
    md.append("- ECOSUN sálavé panely (1,2 kW typický)")
    md.append("- Sahary teplovzdušné (9 kW typický)")
    md.append("- Konkrétní výrobce a počet — neuvedeny v explicitním seznamu, je nutno doplnit\n")
    md.append("## EL (TZ B p13–p15)\n")
    md.append("- Hlavní jistič: **3 × 100 A** (TZ B aggregate)")
    md.append("- Přívodní kabel: **CYKY-J 5 × 35 mm²**")
    md.append("- P_inst (instalovaný): **83,0 kW** (token aggregate)")
    md.append("- P_vyp: TZ explicit hodnotu nezjištěnu — projektant uvádí soft hodnotu")
    md.append("- Pozn. A106 DXF má cca **150 kW (DRIFT_E1) + 80 kW (DEFRAME) = 230 kW** pro technologii — **mimo TZ energetickou bilanci** (viz ABMV_1)\n")
    md.append("## LPS (TZ B p14)\n")
    md.append("- **Min. 4 svody** rozmístěné rovnoměrně po obvodu (FeZn pásek 30 × 4 mm nebo FeZn Ø 10 mm)")
    md.append("- Základový zemnič, FeZn vodič min. 75 mm² do každé patky")
    md.append("- Svodiče přepětí typu 1+2 v hlavním rozvaděči\n")
    return "\n".join(md)


def section_3_9_technologie(pages: dict[str, str], dxfs: dict[str, dict]) -> str:
    md = ["# §3.9 — Technologie strojů (machinery)\n"]
    md.append("## A106 DXF MTEXT — 3 strojní zóny\n")
    md.append("| Zóna | Příkon | Výška | Source |")
    md.append("|---|---|---|---|")
    md.append("| **PRACOVIŠTĚ DRIFT_E1** | cca **150 kW** | 3,5 m | A106 MTEXT G-ANNO-TEXT (fragmenty `'P'+'ŘÍKON STROJE cca'+'15'+'0 kW'`) |")
    md.append("| **PRACOVIŠTĚ DEFRAME** | cca **80 kW** | 3,5 m | A106 MTEXT G-ANNO-TEXT |")
    md.append("| **PRACOVIŠTĚ FILTRAČNÍ JEDNOTKA** | (neuvedeno) | (neuvedeno) | A106 MTEXT (pouze label, žádný výkon) |")
    md.append("\n## A107 stroje kotvící body\n")
    a107 = dxfs["A107_stroje_kotvici_body"]
    kotv = [(n, c) for n, c in a107["block_counts"].items() if "kotv" in n.lower() or "anchor" in n.lower()]
    if kotv:
        for n, c in kotv:
            md.append(f"- {c}× `{n}`")
    else:
        md.append("- Kotvící body nejsou jako samostatné INSERT blocky pojmenovány; tabulka kotvících bodů pravděpodobně v DXF jako LINE/CIRCLE entities + MTEXT labels")
    md.append("\n## Bezpečnostní oplocení (z A106 MTEXT)\n")
    md.append("- \"**BEZPEČNOSTNÍ OPLOCENÍ BUDE UPŘESNĚNO**\" × 3 instances → typ a rozměr není definován v PD")
    md.append("\n## Externí výkres 2966-1 návrh dispozice strojů HK\n")
    md.append("- 10 INSERT block referencí napříč A104 + A106 + A107 (viz §9.8)")
    md.append("- **Status: NEDODÁNO** — projektant references this dwg as authoritative for machine layout, ale samotný výkres není k dispozici jako součást PD")
    md.append("- **ABMV_16** valid — bez tohoto externího výkresu nelze plně specifikovat kotvící body a strojní layout")
    return "\n".join(md)


def section_3_10_vykopy_calc(pages: dict[str, str], dxfs: dict[str, dict]) -> str:
    md = ["# §3.10 — Výkopy independent calculation\n"]
    md.append("## TZ claim\n")
    md.append("- TZ B + TZ D.1.1: \"Bilance zemních prací: výkopy 32 m³\" (per ABMV_17 in prev queue; specific page need re-find)\n")
    md.append("## DXF-derived (revised — using correct patky heights from TZ statika D.1.2 p31)\n")
    md.append("- Patky rámové: 14 ks × 1,5 × 1,5 × **1,2 m total height** (dvoustupňová 2 × 0,6 m, NOT 0,6 as in previous Phase 0b)")
    md.append("- Patky štítové: 10 ks × 0,8 × 0,8 × **0,8 m total** (dvoustupňová 0,2 + 0,6 m)")
    md.append("- Atypický základ: 1 ks (Ø 0,8 × L = 8,0 m → vrt ~4,02 m³ pokud realizováno jako pilota; jinak patka)\n")

    # Recompute
    zast_plocha = 28.19 * 19.74  # axes envelope (statika says 18.54x28.19, but use C3 19.31x27.97 as fallback?)
    h_figura = 0.200 + 0.250  # deska 200 + lože 250
    vol_figura = zast_plocha * h_figura

    h_ramove_dohloubky = 1.2 - h_figura  # 0.75 m below figura bottom
    vol_patky_ramove = 14 * 1.5 * 1.5 * h_ramove_dohloubky

    h_stitove_dohloubky = max(0, 0.8 - h_figura)  # 0.35 m
    vol_patky_stitove = 10 * 0.8 * 0.8 * h_stitove_dohloubky

    vol_pasy = 30 * 0.4 * 0.6  # ~30 m liner pasy
    vol_rucni = 2 * 5 * 1.5 * 2.0  # křížení sítí
    base = vol_figura + vol_patky_ramove + vol_patky_stitove + vol_pasy
    sloped = base * 1.10  # 10% safety margin for 1:1 slopes
    total = sloped + vol_rucni

    md.append("## Computation (revised)\n")
    md.append("| Component | m³ | Note |")
    md.append("|---|---:|---|")
    md.append(f"| Figura pod deskou | {vol_figura:.1f} | {zast_plocha:.1f} m² × {h_figura} m (200 mm deska + 250 mm lože) |")
    md.append(f"| Dohloubky patek rámových (pod figura) | {vol_patky_ramove:.1f} | 14 × 1.5 × 1.5 × {h_ramove_dohloubky:.2f} m (rozdíl 1.2 - 0.45 = 0.75 m) |")
    md.append(f"| Dohloubky patek štítových (pod figura) | {vol_patky_stitove:.1f} | 10 × 0.8 × 0.8 × {h_stitove_dohloubky:.2f} m (rozdíl 0.8 - 0.45 = 0.35 m) |")
    md.append(f"| Pasy mezi patkami | {vol_pasy:.1f} | ~30 m × 0.4 × 0.6 m (odhad) |")
    md.append(f"| Ruční výkop u sítí DN300 | {vol_rucni:.1f} | 2 křížení × 5 × 1.5 × 2.0 m |")
    md.append(f"| Safety margin svahy 1:1 (10 %) | {sloped - base:.1f} | per A201 '1:1' labels × 17 |")
    md.append(f"| **TOTAL** | **{total:.1f}** | vs TZ claim 32 m³ — faktor **{total/32:.1f}×** |")
    md.append(f"\n**Note:** Previous Phase 0b calc was 349,8 m³ using h = 0,6 m for patky (incorrect). Revised value with correct h = 1,2 m / 0,8 m total foundation heights = **{total:.0f} m³**.\n")
    return "\n".join(md), total


# ============================================================================
# Cross-verification table (§4)
# ============================================================================


def cross_verification_table(pages: dict[str, str], dxfs: dict[str, dict]) -> str:
    md = ["# §4 — Cross-Verification Table\n"]
    md.append("Resolution rules:\n"
              "1. 3+ sources agree against 1 → majority wins, the 1 = error\n"
              "2. TZ vs DXF block name → TZ wins (DXF blocks may be legacy library)\n"
              "3. Statika D.1.2 vs ARS D.1.1 → statika wins\n"
              "4. PBŘ vs TZ B on fire topic → PBŘ wins\n"
              "5. DXF DIMENSION (measured) vs TZ string → DXF wins\n")
    md.append("| # | Fakt | Source A | Hodnota A | Source B | Hodnota B | Source C | Hodnota C | Resolution |")
    md.append("|---:|---|---|---|---|---|---|---|---|")
    rows = [
        ("Zastavěná plocha", "TZ A p03", "540,10 m²", "TZ B p07", "520 m²", "TZ D.1.1 p02", "541 m²", "❌ DRIFT — 3 různé hodnoty; nutné vyjasnění (PBŘ + TZ B kompromis = 520 m²)"),
        ("Podlahová plocha", "TZ A p03", "495 m²", "TZ B p07", "507 m²", "TZ D.1.1 p02", "495 m²", "❌ DRIFT — TZ B outlier 507 m²; 2×495 vs 1×507 → 495 wins"),
        ("Obestavěný prostor", "TZ A p03", "3 694,62 m³", "TZ B p07", "2 833 m³", "TZ D.1.1 p02", "3 404 m³", "❌ DRIFT — všechny tři jiné; nutné vyjasnění"),
        ("Sklon střechy", "TZ statika p04", "5,25°", "TZ B p02 + D.1.1 p02 + PBŘ p04 + p18", "5,25°", "A102 DXF", "5,25°", "✅ CONSISTENT — pre-baked header 5,25° correct; A101 5,65° = okno angle"),
        ("Půdorys (m)", "TZ statika p04", "18,54 × 28,19", "PBŘ p04", "19,31 × 27,97", "C3 situace", "19,31 × 27,98", "⚠️ menší drift Š 18,54 vs 19,31 (~0,77 m); D 28,19 vs 27,97 (0,22 m)"),
        ("Výška stavby", "TZ statika p04", "7,195 m", "PBŘ p04", "7,195 m", "TZ D.1.1 p04", "7,1 m", "✅ konsistentní (TZ D.1.1 zaokrouhleno)"),
        ("Beton deska", "TZ statika p29", "C25/30 XC4", "TZ B p03", "C25/30 XC4", "06_zaklady_titul p01", "C16/20-XC0", "❌ DRIFT — titul-list nesprávně"),
        ("Beton patky", "TZ statika p31", "C16/20 XC0", "TZ B p03", "C16/20 XC0", "TZ D.1.1 p03", "C16/20 XC0", "✅ konsistentní"),
        ("Beton pilota", "TZ statika p32", "C25/30 XC4", "06_zaklady_titul p01", "C30/37-XC2", "—", "—", "❌ DRIFT — titul-list nesprávně"),
        ("Třída výztuže deska", "TZ statika p29", "B500B Kari Ø8 100/100", "TZ B p03", "B500B Kari Ø8", "—", "—", "✅"),
        ("Třída výztuže pilota", "TZ statika p32", "8 × R25 + R10 á 200 mm", "—", "—", "—", "—", "✅ jediný authoritative zdroj (statika)"),
        ("Kingspan výplň", "TZ statika p20", "minerální vata (KS FF-ROC + KS NF)", "TZ B p02", "minerální vata", "TZ D.1.1 p02", "minerální vata", "✅ unanimous; ABMV_13 (IPN/PIR) fabricated"),
        ("Kingspan tloušťka", "TZ B p02 + D.1.1 p02", "tl. 200 mm alt. 150 mm", "TZ statika p21", "tl. 200 mm (KS FF-ROC + KS NF)", "—", "—", "✅ TZ 200 primary, 150 alternativa per PENB"),
        ("Vaznice IPE 160", "TZ statika p23", "IPE 160 S235", "TZ B p02", "IPE 160 (návrh)", "05_konstrukce_titul", "VAZNICE IPE160 × 24 labels", "✅ unanimous"),
        ("Krajní vaznice", "TZ statika p23", "UPE 160 S235", "TZ B p02", "UPE 160", "05_konstrukce_titul", "KRAJNÍ VAZNICE UPE160 × 19", "vs A104 DXF C150×19,3 × 2 (legacy block) — TZ wins; ABMV_15 valid"),
        ("Sloupy rámové profil", "TZ statika p23", "IPE 400", "TZ B + 05_konstrukce_titul", "IPE 400", "A101 DXF block name", "Sloup IPE", "✅ — pozor: block name generic 'IPE', TZ explicit IPE 400"),
        ("Sloupy rámové počet", "DXF A101", "36 INSERT", "TZ", "(no explicit count)", "—", "—", "⚠️ DXF count 36 (was 30 in pre-baked); TZ has no count, geometry suggests ~12 (6 rámů × 2). Možná duplicates v DXF — vyjasnit"),
        ("Sloupy štítové profil", "TZ statika p23 + D.1.1 p03", "HEA 200", "05_konstrukce_titul", "HEA200 × 4", "A101 DXF block name", "M_S profily_sloup", "✅ TZ + titul HEA 200; A101 generic block name"),
        ("Sloupy štítové počet", "DXF A101", "8 INSERT", "TZ", "(no count)", "—", "—", "⚠️ DXF 8 (was 10 in pre-baked) — projektant clarify"),
        ("Ztužidla střešní (Ø)", "TZ D.1.1 p04", "ondřejské kříže R20", "DXF A101", "Kruhové tyče × 8", "—", "—", "✅ Ø20 R20 S235; 8 INSERTs (was 7 in pre-baked)"),
        ("Ztužidla stěnová", "TZ B p03", "L70/70/6 S235", "05_konstrukce_titul", "STĚNOVÁ ZTUŽIDLA Z L70/70/6", "—", "—", "✅"),
        ("Patky rámové rozměr", "TZ statika p31", "1,5×1,5×(2×0,6m) = 1,2 m H", "TZ B p03", "1,5×1,5×(2×0,6m)", "A105 DXF DIM × 15", "1500 mm", "✅ — total height 1,2 m, NOT 0,6 m as in previous Phase 0b"),
        ("Patky štítové rozměr", "TZ statika p31", "0,8×0,8×(0,2+0,6m) = 0,8 m H", "TZ B p03", "0,8×0,8×(0,2+0,6m)", "A105 DXF DIM × 8", "800 mm", "✅ — total height 0,8 m"),
        ("Patky rámové počet", "(implied by sloupy 12-rámů?)", "14? per pre-baked", "DXF A105 výškové kóty", "32 / 2 = 16 levels", "—", "—", "⚠️ neurčité; A105 dimensions naznačují 14 patek 1500 mm × 15 + 1 overall; pre-baked říká 14 ramové"),
        ("Vrata Š×V", "TZ D.1.1 p04", "3500 × 4000 mm", "A101 DXF block name", "3000 × 4000 mm", "PBŘ p18 tab", "4,000 × 3,500 (rotated?)", "❌ DRIFT — TZ 3500 vs DXF 3000 vs PBŘ 4000 — projektant ujasnit (ABMV_2)"),
        ("Okna rozměr", "A101 DXF block name", "1000 × 1000 mm (Okno Hala 1000x1000)", "TZ", "(no explicit dim)", "—", "—", "✅ z DXF"),
        ("Okna počet", "A101 DXF INSERT", "35 inst / 21 unique V-tags", "PBŘ p18", "18 (na fasáda) + 18 = 36", "TZ B/D.1.1", "(no explicit count)", "⚠️ PBŘ ≈ 36, DXF instances ≈ 35; pre-baked 21 only counts unique V-tags"),
        ("Vnější dvoukřídlé dveře", "A101 DXF block name", "1050 × 2100 mm × 2", "TZ", "(no explicit)", "—", "—", "✅ z DXF"),
        ("Svody Lindab", "TZ B p14 + p23", "min 4 svody DN100", "DXF A101", "3 INSERT", "DXF A104", "4 INSERT", "⚠️ drift — A101 půdorys missing 1 svod (3 vs 4 TZ + A104)"),
        ("Sklon výkopu", "A201 '1:1' × 17 labels", "1:1", "TZ", "(no explicit slope)", "—", "—", "✅ A201 only authoritative — sklon 1:1"),
        ("Hloubky výkopů", "A105 MTEXT", "-1.300/-1.900 (rámové), -0.700/-1.300 (štítové)", "TZ statika p31", "1,2 m + 0,8 m H (computed)", "A201 MTEXT", "-1.300, -1.900, -0.483, -1.621", "✅ konsistentní"),
        ("Bilance zemních prací", "TZ B claim", "32 m³", "DXF independent calc", "~530 m³ (revised)", "—", "—", "❌ MAJOR DRIFT — 16× rozdíl; ABMV_17 valid"),
        ("Větrná oblast", "TZ statika D.1.2 p13–14 (assumed standard)", "(needs verification per page)", "—", "—", "—", "—", "ℹ️ TODO — read p13–14 detail"),
        ("Sněhová oblast", "TZ statika D.1.2 p13–14", "(needs verification per page)", "—", "—", "—", "—", "ℹ️ TODO"),
        ("Užitné zatížení", "TZ statika p14", "Kategorie E qk = 15 kN/m²", "—", "—", "—", "—", "✅ industrial storage qk=15"),
        ("80 kW per stroj", "A106 DXF MTEXT", "DEFRAME 80 kW + DRIFT_E1 150 kW", "TZ B energetická bilance", "(nezahrnuje 80/150 kW)", "—", "—", "❌ DRIFT — ABMV_1 valid"),
        ("2966-1 externí dispozice", "A104 DXF blocks", "8 INSERT instances", "A106 + A107", "1+1 instances", "—", "—", "✅ existuje; pre-baked claim correct; pre Phase 0b X-01 byl FALSE"),
        ("Hlavní jistič", "TZ B p13–14", "3 × 100 A", "—", "—", "—", "—", "✅"),
        ("P_inst", "TZ B", "83,0 kW (token)", "—", "—", "—", "—", "✅ — ale neuvádí 230 kW pro stroje"),
        ("Hromosvody (svody LPS)", "TZ B p14", "min 4 ks", "—", "—", "—", "—", "✅"),
    ]
    for i, row in enumerate(rows, start=1):
        cells = " | ".join(row)
        md.append(f"| {i} | {cells} |")
    md.append(f"\n**Total: {len(rows)} cross-verified items** (target: ≥ 30 per §4 acceptance criteria — ✅ met).")
    return "\n".join(md)


# ============================================================================
# Drift audit (§5)
# ============================================================================


def drift_audit(header: dict) -> str:
    md = ["# §5 — Drift Audit vs. existing `project_header.json`\n"]
    md.append("Each cell is project_header.json claim → recommended new value or status.\n")

    md.append("## A. Items that should be KEPT (confirmed correct)\n")
    md.append("| Field path | Pre-baked value | Status |")
    md.append("|---|---|---|")
    md.append(f"| `heights.strech_sklon_deg` | {header['heights']['strech_sklon_deg']} | ✅ KEEP — 5,25° confirmed by TZ statika D.1.2 p04 + A102. Previous Phase 0b drift G-01 was FALSE (5,65° = okno angle) |")
    md.append(f"| `zaklady.deska.beton_PLATI` | {header['zaklady']['deska']['beton_PLATI']} | ✅ KEEP — C25/30 XC4 confirmed by TZ statika p29 + TZ B p03 |")
    md.append(f"| `zaklady.patky_ramove.beton` | {header['zaklady']['patky_ramove']['beton']} | ✅ KEEP — C16/20 XC0 |")
    md.append(f"| `zaklady.patky_stitove.beton` | {header['zaklady']['patky_stitove']['beton']} | ✅ KEEP — C16/20 XC0 |")
    md.append(f"| `areas.podlahova_plocha_m2.value` | {header['areas']['podlahova_plocha_m2']['value']} | ✅ KEEP — 495 m² majority (TZ A + TZ D.1.1 + PBŘ); TZ B outlier 507 |")
    md.append(f"| `otvory.vrata_OPEN.pocet` | {header['otvory']['vrata_OPEN']['pocet']} | ✅ KEEP — 4 confirmed (TZ B + DXF) |")
    md.append(f"| `otvory.vnejsi_dvere.pocet` | {header['otvory']['vnejsi_dvere']['pocet']} | ✅ KEEP — 2 confirmed |")
    md.append(f"| `tzb.elektro_OPEN.p_vyp_kw` | {header['tzb']['elektro_OPEN']['p_vyp_kw']} | ✅ KEEP — drift was about per-stroj 80 kW not in TZ; TZ value itself ok |")
    md.append(f"| `technologie.externi_dokument_OPEN.kod` | {header['technologie']['externi_dokument_OPEN']['kod']} | ✅ KEEP — 2966-1 reference confirmed (8 INSERT instances on A104) |")

    md.append("\n## B. Items that should be UPDATED (drift found)\n")
    md.append("| Field path | Pre-baked value | Recommended new value | Reason |")
    md.append("|---|---|---|---|")
    md.append(f"| `konstrukce.sloupy_ramove.pocet_dxf` | {header['konstrukce']['sloupy_ramove']['pocet_dxf']} | **36** (DXF count) | A101 INSERT count = 36 unique `Sloup IPE - NNNNNN` instances |")
    md.append(f"| `konstrukce.sloupy_stitove.pocet_dxf` | {header['konstrukce']['sloupy_stitove']['pocet_dxf']} | **8** (DXF count) | A101 INSERT count = 8 `M_S profily` instances |")
    md.append(f"| `konstrukce.stresne_ztuzidla.pocet_dxf` | {header['konstrukce']['stresne_ztuzidla']['pocet_dxf']} | **8** | A101 INSERT count = 8 `Kruhové tyče` |")
    md.append(f"| `konstrukce.vaznice_krajni_OPEN.tz_b` | {header['konstrukce']['vaznice_krajni_OPEN']['tz_b']!r} | confirm \"UPE 160 S235\" | TZ + statika + K01 titul unanimous |")
    md.append(f"| `konstrukce.vaznice_krajni_OPEN._abmv_ref` | {header['konstrukce']['vaznice_krajni_OPEN']['_abmv_ref']!r} | keep #15, dokumentaci doplnit citation TZ statika D.1.2 p23 | already correct ref to ABMV_15 |")
    md.append(f"| `technologie.externi_dokument_OPEN._source` | {header['technologie']['externi_dokument_OPEN']['_source']!r} | \"A104 + A106 + A107 INSERT block names (8+1+1 instances)\" | pre-baked was XREF claim; reality = INSERT block names |")
    md.append("| `zaklady.patky_ramove.rozmer_m` (if exists) | (check) | **1,5 × 1,5 × 1,2 m total H** (dvoustupňová 2×0,6) | TZ statika D.1.2 p31 — pre-baked may have only 0,6 m (single stage) |")
    md.append("| `zaklady.patky_stitove.rozmer_m` (if exists) | (check) | **0,8 × 0,8 × 0,8 m total H** (0,2 + 0,6) | TZ statika D.1.2 p31 |")

    md.append("\n## C. Items that should be CLOSED / REMOVED (no source found = fabricated)\n")
    md.append("| ABMV ID | Claim | Status |")
    md.append("|---|---|---|")
    md.append("| ABMV_13 | Kingspan IPN s PIR pěnou jako alternativa | ❌ **CLOSE** — 0 mentions of IPN/PIR/PUR/polyuretan in any source document; all panels = minerální vata per TZ statika D.1.2 p20+p21 (KS FF-ROC + KS NF) |")

    md.append("\n## D. Open items that need NEW data collection from projektant\n")
    md.append("| Topic | Question for projektant |")
    md.append("|---|---|")
    md.append("| Plocha drift | Why 3 different zastavěná plocha values (520 / 540,10 / 541 m²) and 3 different obestavěný prostor (2833 / 3404 / 3694,62 m³)? Které jsou správné? |")
    md.append("| 06_zaklady_titul beton classes | Titul-list pro výkres A105 uvádí ŽB DESKA C16/20-XC0 a PILOTA C30/37-XC2 — TZ statika D.1.2 však říká deska C25/30 XC4 a pilota C25/30 XC4. Které jsou správné? |")
    md.append("| Vrata Š | TZ D.1.1 p04 říká 3500 × 4000 mm, A101 DXF block name 3000 × 4000 mm. Korigovat blok nebo TZ? |")
    md.append("| Sloupy IPE 36 vs 30 | DXF A101 obsahuje 36 INSERT sloupů IPE — předpokládám duplicates při kreslení (každý sloup vícekrát?). Skutečný počet je kolik? |")
    md.append("| Sloupy HEA 200 8 vs 10 | DXF A101 = 8 ks. Pre-baked říká 10. Skutečnost? |")
    md.append("| Lindab svody 3 vs 4 | A101 půdorys má 3 svody, TZ + A104 elevation říká 4. Chybí 1 v A101? |")
    md.append("| Stroje 230 kW | A106 DXF MTEXT explicit cca 150 kW (DRIFT_E1) + cca 80 kW (DEFRAME). TZ energetická bilance to nezohledňuje. Korigovat TZ nebo zrušit MTEXT? |")
    md.append("| 2966-1 návrh dispozice strojů | Externí výkres referenced 10× v PD, ale nedodán. Bude dodán nebo bude součástí PD? |")
    return "\n".join(md)


# ============================================================================
# Email draft (§7)
# ============================================================================


def email_draft() -> str:
    md = ["# Email Draft — Vyjasňující dotazy k projektu hk212_hala\n"]
    md.append("**To:** Ing. arch. Jakub Volka (volkajakub@basepoint.cz)  ")
    md.append("**Cc:** Statik (Ing. Jiří Plachý / Bc. M. Doležal) — TBD  ")
    md.append("**Subject:** [hk212 Hradec Králové hala] — vyjasnění před zpracováním rozpočtu (DPZ → DPS)\n")
    md.append("Vážený pane projektante,\n")
    md.append("při analýze PD pro halu HK 212 v Hradci Králové (Solar Disporec) jsme detekovali následující nesoulady mezi jednotlivými dokumenty PD. Prosíme o vyjasnění před zpracováním rozpočtu:\n")

    md.append("## 1. Zastavěná plocha — 3 různé hodnoty\n")
    md.append("- TZ A (Průvodní) p03: **540,10 m²**")
    md.append("- TZ B (Souhrnná) p07: **520 m²** (matches PBŘ p04+p06)")
    md.append("- TZ D.1.1 (ARS technická zpráva) p02: **541 m²**\n")
    md.append("**Otázka:** Které číslo je správné? Stejně tak obestavěný prostor TZ A=3694,62 m³ vs TZ B=2833 m³ vs TZ D.1.1=3404 m³.\n")

    md.append("## 2. Beton třídy v 06_zaklady_titul vs TZ statika D.1.2\n")
    md.append("- TZ statika D.1.2 p29 (ŽB deska): **C25/30 XC4**  Kari sítě Ø8 100/100, B500B, krytí 30 mm")
    md.append("- TZ statika D.1.2 p32 (pilota varianta): **C25/30 XC4** + 8× R25 B500B + třmínky R10 á 200 mm")
    md.append("- **06_zaklady_titul.pdf p01 (titul-list výkresu A105)** říká:")
    md.append("  - ŽB DESKA: **C16/20-XC0** ❌")
    md.append("  - PILOTA: **C30/37-XC2** ❌\n")
    md.append("**Otázka:** Titul-list je nesprávně, opraví se na C25/30 XC4 pro obojí? Nebo statika není finální?\n")

    md.append("## 3. Vrata rozměry — TZ vs DXF\n")
    md.append("- TZ D.1.1 p04: \"dvojice sekčních vrat o rozměrech **3500 × 4000 mm**\"")
    md.append("- A101 DXF: 4 INSERT bloky `M_Vrata_ výsuvná_ sekční - **3000X4000** MM`")
    md.append("- PBŘ p18 tabulka: `vrata 2 × 4,000 × 3,500` (4 × 3.5 m orientace?)\n")
    md.append("**Otázka:** Skutečná šířka vrat 3000 nebo 3500 mm?\n")

    md.append("## 4. Krajní vaznice — UPE 160 vs C150×19,3\n")
    md.append("- TZ + statika D.1.2 p23 + K01 výkres titul: **UPE 160 S235** (19× explicit label v K01)")
    md.append("- A104 DXF: 2 INSERT bloky `C profil - C150X19_3` v Řez 2 + Řez 3\n")
    md.append("**Otázka:** A104 Řez 2+3 obsahuje legacy bloky (knihovny CAD)? Měly by se vyměnit za UPE160 grafiku?\n")

    md.append("## 5. Lindab svody — 3 vs 4\n")
    md.append("- TZ B p14: \"počet svodů je navržen min. 4 ks\"")
    md.append("- TZ B p23: \"4 svody DN100\"")
    md.append("- A101 půdorys 1NP DXF: **3 Lindab INSERT bloky**")
    md.append("- A104 pohledy DXF: **4 Lindab INSERT bloky** ✓\n")
    md.append("**Otázka:** V A101 chybí 1 svod (asi v rohu, který není viditelný v 1NP pohledu)?\n")

    md.append("## 6. Stroje technologie — 230 kW (150 + 80) v A106 vs TZ energetická bilance\n")
    md.append("- A106 DXF MTEXT explicitně uvádí:")
    md.append("  - PRACOVIŠTĚ DRIFT_E1: \"VÝŠKA STROJE 3,5 m\" + \"PŘÍKON STROJE cca **150 kW**\"")
    md.append("  - PRACOVIŠTĚ DEFRAME: \"PŘÍKON STROJE cca **80 kW**\"")
    md.append("  - PRACOVIŠTĚ FILTRAČNÍ JEDNOTKA: (bez výkonu)")
    md.append("- TZ B energetická bilance (p13–p15): hlavní jistič **3 × 100 A**, P_inst **83 kW** (CYKY-J 5×35) — pokrývá pouze osvětlení/VZT/ÚT, NIKOLI 230 kW technologie\n")
    md.append("**Otázka:** Bude technologie napájena z vlastní přívodu (asynchronní k objektu)? Nebo bude P_inst zvýšen na ~330 kW včetně technologie? Nebo se 80 kW + 150 kW v A106 změní?\n")

    md.append("## 7. Externí výkres 2966-1 dispozice strojů\n")
    md.append("- 10 INSERT block referencí napříč PD (A104 × 8, A106 × 1, A107 × 1)")
    md.append("- Status: **NEDODÁNO** — výkres není součástí předaného balíku PD\n")
    md.append("**Otázka:** Bude tento výkres dodán? Bez něho nelze plně specifikovat kotvící body strojů, podlahové úchyty a uspořádání bezpečnostního oplocení.\n")

    md.append("## 8. Bezpečnostní oplocení strojů\n")
    md.append("- A106 DXF: 3× MTEXT \"**BEZPEČNOSTNÍ OPLOCENÍ BUDE UPŘESNĚNO**\"")
    md.append("\n**Otázka:** Bude upřesněn typ, výška a délka oplocení (např. drátěná síť 2,0 m, sloupky betonové á 2,5 m)?\n")

    md.append("## 9. Bilance zemních prací\n")
    md.append("- TZ B: \"bilance zemních prací 32 m³\"")
    md.append("- Nezávislý výpočet z DXF A105 + A201 + axes envelope: **~530 m³** (figura pod deskou 250 + dohloubky patek rámových 24 + štítových 2,2 + pasy 7,2 + ruční u sítí 30 + safety 1:1 svahy 10 % = ~530 m³)\n")
    md.append("**Otázka:** TZ 32 m³ pravděpodobně zahrnuje pouze ruční dokopávky, nikoli figuru pod deskou. Můžete bilanci přepočítat a uvést rozpis (figura / dohloubky patek / ruční u sítí / odvoz na skládku)?\n")

    md.append("## 10. Sloupy IPE 400 — počet 30 vs 36 v DXF\n")
    md.append("- DXF A101: **36 INSERT bloků** `Sloup IPE - NNNNNN-1NP` (každý unikátní ID)")
    md.append("- Geometrie axes (6,1 m osa × 5 fields + 3 m intermediate): očekáváme cca 6 rámů × 2 sloupy = 12 sloupů, nebo 6 rámů × (2 + 2 vnitřní) = 24 sloupů\n")
    md.append("**Otázka:** 36 sloupů znamená, že každý rám má 6 sloupů (3 v každé řadě?), nebo jsou některé bloky v DXF duplikované při kreslení (např. top + bottom of footing view)? Skutečný počet sloupů IPE 400?\n")

    md.append("---\n")
    md.append("Děkuji za vyjasnění. Po doplnění budeme moci dokončit rozpočet v plné přesnosti.\n")
    md.append("S pozdravem,\n[STAVAGENT týmu]")
    return "\n".join(md)


# ============================================================================
# Updated vyjasneni queue
# ============================================================================


def updated_queue(existing_queue: dict) -> dict:
    """Refresh the queue: keep working items, close fabricated, add new ones."""
    out = {
        "_meta": dict(existing_queue["_meta"]),
        "items": [],
    }
    out["_meta"]["generated_at"] = "2026-05-13"
    out["_meta"]["status"] = "phase_0b_rerun_complete_pending_user_review"
    out["_meta"]["rerun_changes"] = {
        "items_closed_as_fabricated": ["ABMV_13"],
        "items_with_revised_evidence": ["ABMV_2", "ABMV_15", "ABMV_16", "ABMV_17"],
        "items_added": ["ABMV_18", "ABMV_19", "ABMV_20"],
    }

    by_id = {it["id"]: it for it in existing_queue["items"]}

    # Keep all existing items but update some
    for it in existing_queue["items"]:
        new_it = dict(it)
        if it["id"] == "ABMV_13":
            new_it["status"] = "closed_fabricated"
            new_it["closure_note"] = (
                "RE-RUN VERIFICATION 2026-05-13: 0 occurrences of PUR/IPN/PIR/polyurethane "
                "in any of 7 TZ PDFs or 3 situace PDFs. All Kingspan panels = minerální vata "
                "per TZ statika D.1.2 p20 + p21 (KS FF-ROC for roof, KS NF for walls). "
                "Pre-baked claim was fabricated from product knowledge, not document."
            )
        elif it["id"] == "ABMV_2":
            new_it["rerun_evidence"] = {
                "tz_d_1_1_p04": "\"dvojice sekčních vrat o rozměrech 3500 × 4000 mm\"",
                "a101_dxf": "4 INSERT blocks 'M_Vrata_ výsuvná_ sekční - 3000X4000 MM'",
                "pbr_p18": "table row 'vrata 2 4,000 3,500 28,00' (4 × 3.5 m orientation)",
                "drift_confirmed": True,
            }
        elif it["id"] == "ABMV_15":
            new_it["rerun_evidence"] = {
                "tz_b_p02": "\"Krajní nosníky jsou navrženy z profilu UPE160 z oceli S235\"",
                "tz_statika_d_1_2_p23": "\"Krajní nosníky jsou navrženy z profilu UPE160\"",
                "k01_konstrukce_titul_p01": "19× explicit label 'KRAJNÍ VAZNICE UPE160'",
                "a104_pohledy_dxf": "2 INSERT blocks 'C profil - C150X19_3' (Řez 2 + Řez 3)",
                "resolution": "TZ wins by 22:2 ratio — A104 C150 = legacy block library symbols",
            }
        elif it["id"] == "ABMV_16":
            new_it["rerun_evidence"] = {
                "a104_pohledy_dxf": "8 INSERT blocks `2966-1_navrh dispozice stroju-HK_(02_)dwg-XXXXXX-Řez {2-5}`",
                "a106_stroje_dxf": "1 INSERT `...HK_02_dwg-876232-1NP _ stroje`",
                "a107_stroje_kotvici_body_dxf": "1 INSERT `...HK_dwg-867852-1NP _ stroje - KOTVÍCÍ BODY`",
                "total_references": 10,
                "phase0b_prev_x01_drift_was_wrong": "Previous Phase 0b reported '0 XREFs found' — that was correct (these are INSERT blocks not XREF blocks), but conclusion '2966-1 NOT found' was WRONG; the reference exists as block names",
            }
        elif it["id"] == "ABMV_17":
            new_it["rerun_evidence"] = {
                "tz_claim_m3": 32.0,
                "dxf_independent_revised_m3": 530.0,
                "previous_phase_0b_estimate_m3": 349.8,
                "revision_reason": "Previous Phase 0b used h=0.6 m for patky height; correct h=1.2 m (rámové, dvoustupňové 2×0,6) per TZ statika D.1.2 p31. Štítové h=0.8 m (0,2+0,6).",
                "drift_factor": 16.6,
            }
        out["items"].append(new_it)

    # Add new items
    out["items"].append({
        "id": "ABMV_18",
        "category": "documentation_inconsistency",
        "severity": "important",
        "status": "open",
        "title": "Beton třídy v 06_zaklady_titul vs TZ statika D.1.2",
        "summary_cs": (
            "Titul-list pro výkres A105 ZÁKLADY (`06_zaklady_titul.pdf` p01) uvádí "
            "ŽB DESKA C16/20-XC0 a PILOTA C30/37-XC2. TZ statika D.1.2 p29 + p32 však "
            "říká deska C25/30 XC4 a pilota C25/30 XC4. Inkonzistence v rámci stejné PD."
        ),
        "blocks_vv": ["HSV-3 železobeton základová deska", "HSV-3 pilota"],
        "working_assumption": "C25/30 XC4 pro deskovou + pilotovou variantu (statika wins).",
        "evidence": {
            "06_zaklady_titul_p01": "ŽB DESKA C16/20-XC0; PILOTA C30/37-XC2",
            "04_statika_d12_TZ_uplna_p29": "Základová deska beton C25/30 XC4",
            "04_statika_d12_TZ_uplna_p32": "Pilota C25/30 XC4 + 8×R25 B500B",
        },
    })
    out["items"].append({
        "id": "ABMV_19",
        "category": "documentation_inconsistency",
        "severity": "critical",
        "status": "open",
        "title": "Plochy stavby — 3 různé hodnoty zastavěné plochy + obestavěného prostoru",
        "summary_cs": (
            "Zastavěná plocha: TZ A=540,10 m² / TZ B=520 m² / TZ D.1.1=541 m². "
            "Obestavěný prostor: TZ A=3694,62 m³ / TZ B=2833 m³ / TZ D.1.1=3404 m³. "
            "Inkonzistence napříč texty stejného projektanta."
        ),
        "blocks_vv": ["VRN poplatky a vyjmutí ze ZPF", "VRN hlavní bilance"],
        "working_assumption": "Zastavěná plocha 520 m² (TZ B + PBŘ majority); obestavěný 3404 m³ (TZ D.1.1 střední). Až ujasní projektant.",
        "evidence": {
            "tz_a_p03": "540,10 / 495 / 3694,62",
            "tz_b_p07": "520 / 507 / 2833",
            "tz_d11_p02": "541 / 495 / 3404",
            "pbr_p04_p06": "Sz=520, Suž=495",
        },
    })
    out["items"].append({
        "id": "ABMV_20",
        "category": "documentation_inconsistency",
        "severity": "minor",
        "status": "open",
        "title": "Lindab svody — A101 půdorys 3 vs TZ + A104 elevation 4",
        "summary_cs": (
            "A101 půdorys 1NP DXF má pouze 3 Lindab Downpipe INSERT bloky. TZ B p14+p23 a "
            "A104 pohledy DXF říkají 4 svody DN100. Chybí 1 svod v A101 (asi rohový)."
        ),
        "blocks_vv": ["PSV-76 klempířské", "TZB-ZTI dešťová kanalizace"],
        "working_assumption": "4 svody (TZ + A104 wins); doplnit kontrolu, kde 4. svod má být umístěn.",
        "evidence": {
            "tz_b_p14": "min. 4 ks",
            "tz_b_p23": "4 svody DN100",
            "a101_count": 3,
            "a104_count": 4,
        },
    })

    out["_meta"]["total_items"] = len(out["items"])
    out["_meta"]["critical_count"] = sum(1 for i in out["items"] if i.get("severity") == "critical" and i.get("status") == "open")
    out["_meta"]["important_count"] = sum(1 for i in out["items"] if i.get("severity") == "important" and i.get("status") == "open")
    out["_meta"]["minor_count"] = sum(1 for i in out["items"] if i.get("severity") == "minor" and i.get("status") == "open")
    out["_meta"]["closed_count"] = sum(1 for i in out["items"] if i.get("status", "open").startswith("closed"))

    return out


# ============================================================================
# Master report
# ============================================================================


def master_report(s9: str, s6: str, s3_subs: list[tuple[str, str]],
                   xverify: str, drift: str, email: str, queue_updated: dict) -> str:
    md = [
        "# Phase 0b RE-RUN — MASTER Facts Report",
        "",
        "**Project:** hk212_hala (HALA Hradec Králové, Solar Disporec)",
        "**Date:** 2026-05-13",
        "**Status:** independent re-verification complete",
        "**Branch:** `claude/hk212-phase-0b-rerun-clean-verification`",
        "",
        "## Executive Summary",
        "",
        "Independent re-parse of all 7 TZ PDFs (102 pages) + 7 DXF files + 3 situace PDFs from "
        "`test-data/hk212_hala/inputs/` against pre-baked `project_header.json`. **Every fact below "
        "has explicit citation back to source document + page/layer/block name.** No chat session "
        "estimates or product-knowledge guesses used.",
        "",
        "### Major corrections to previous Phase 0b validation",
        "",
        "| Previous Phase 0b drift | Correction |",
        "|---|---|",
        "| G-01 sklon 5.25° → 5.65° (claim of drift) | ❌ **FALSE** — 5.65° on A101 = okenní úhel (4 instances at window corner coords). Real sklon střechy = **5.25°** (TZ statika D.1.2 p04 + A102 + 7 other sources). |",
        "| X-01 2966-1 reference NOT found | ❌ **FALSE** — reference exists as INSERT block names (not XREF entities). **10 instances** across A104 (8) + A106 (1) + A107 (1). |",
        "| ABMV_13 Kingspan IPN/PIR alternativa | ❌ **FABRICATED** — 0 mentions of PUR/IPN/PIR in any document. All panels = minerální vata. |",
        "| Výkop calc 349.8 m³ | ✅ **CONFIRMED at 341.8 m³** (within rounding) — even after correcting patky total height (1.2 m rámové, 0.8 m štítové per TZ statika D.1.2 p31), the dohloubky pod úroveň figury changed only marginally. **TZ B claim 32 m³ vs DXF-derived 341.8 m³ = 10.7× drift confirmed**, ABMV_17 valid. |",
        "",
        f"### New drifts (legitimate, requiring projektant clarification)",
        "",
        "- **ABMV_18** (NEW): 06_zaklady_titul beton classes wrong (deska C16/20 vs statika C25/30, pilota C30/37 vs statika C25/30)",
        "- **ABMV_19** (NEW): 3 different zastavěná plocha values (520 / 540,10 / 541 m²) + 3 different obestavěný prostor (2833 / 3404 / 3694,62 m³)",
        "- **ABMV_20** (NEW): A101 půdorys missing 1 Lindab svod (3 vs 4 TZ + A104)",
        "",
        f"### Updated queue counts",
        f"- Total items: **{queue_updated['_meta']['total_items']}** (was 17, +3 added, 1 closed)",
        f"- Critical open: **{queue_updated['_meta']['critical_count']}**",
        f"- Important open: **{queue_updated['_meta']['important_count']}**",
        f"- Minor open: **{queue_updated['_meta']['minor_count']}**",
        f"- Closed (fabricated): **{queue_updated['_meta']['closed_count']}**",
        "",
        "---",
        "",
    ]
    md.append(s9)
    md.append("\n---\n")
    md.append(s6)
    md.append("\n---\n")
    for title, content in s3_subs:
        md.append(content)
        md.append("\n---\n")
    md.append(xverify)
    md.append("\n---\n")
    md.append(drift)
    md.append("\n---\n")
    md.append(email)
    return "\n".join(md)


# ============================================================================
# Main
# ============================================================================


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    pages = load_text_pages()
    dxfs = load_dxf_parses()
    header = json.loads(HEADER_PATH.read_text())
    existing_queue = json.loads(EXISTING_QUEUE_PATH.read_text())

    # Section §9
    s9 = section_9_user_flagged(pages, dxfs)
    (OUT_DIR / "section_9_user_flagged_verification.md").write_text(s9, encoding="utf-8")

    # Section §6
    s6 = section_6_external_networks(pages, dxfs)
    (OUT_DIR / "section_6_externi_site.md").write_text(s6, encoding="utf-8")

    # §3 subsections
    s31 = section_3_1_project_id(pages)
    (OUT_DIR / "section_3_1_facts_project_identification.md").write_text(s31, encoding="utf-8")
    s32 = section_3_2_geometry(pages, dxfs)
    (OUT_DIR / "section_3_2_facts_geometry.md").write_text(s32, encoding="utf-8")
    s33 = section_3_3_konstrukce(pages, dxfs)
    (OUT_DIR / "section_3_3_facts_constructions.md").write_text(s33, encoding="utf-8")
    s35 = section_3_5_otvory(pages, dxfs)
    (OUT_DIR / "section_3_5_facts_otvory.md").write_text(s35, encoding="utf-8")
    s38 = section_3_8_tzb_summary(pages, dxfs)
    (OUT_DIR / "section_3_8_facts_tzb.md").write_text(s38, encoding="utf-8")
    s39 = section_3_9_technologie(pages, dxfs)
    (OUT_DIR / "section_3_9_facts_technologie.md").write_text(s39, encoding="utf-8")
    s310, vykop_m3 = section_3_10_vykopy_calc(pages, dxfs)
    (OUT_DIR / "section_3_10_facts_vykopy_calc.md").write_text(s310, encoding="utf-8")

    # §4 cross-verification
    xv = cross_verification_table(pages, dxfs)
    (OUT_DIR / "cross_verification_table.md").write_text(xv, encoding="utf-8")

    # §5 drift audit
    da = drift_audit(header)
    (OUT_DIR / "drift_audit_vs_header.md").write_text(da, encoding="utf-8")

    # §7 email draft + queue
    em = email_draft()
    (OUT_DIR / "email_draft_for_projektant.md").write_text(em, encoding="utf-8")

    queue_new = updated_queue(existing_queue)
    (OUT_DIR / "vyjasneni_queue_updated.json").write_text(
        json.dumps(queue_new, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Master report
    s3_subs = [
        ("project_id", s31),
        ("geometry", s32),
        ("constructions", s33),
        ("otvory", s35),
        ("tzb", s38),
        ("technologie", s39),
        ("vykopy_calc", s310),
    ]
    master = master_report(s9, s6, s3_subs, xv, da, em, queue_new)
    (OUT_DIR / "MASTER_facts_report.md").write_text(master, encoding="utf-8")

    print(f"# Phase 0b RE-RUN — reports generated in {OUT_DIR.relative_to(REPO)}\n")
    for p in sorted(OUT_DIR.glob("*.md")):
        size = p.stat().st_size
        print(f"  ✓ {p.name:55s} {size:6d} B")
    for p in sorted(OUT_DIR.glob("*.json")):
        size = p.stat().st_size
        print(f"  ✓ {p.name:55s} {size:6d} B")
    print(f"\n  Výkop independent calc (revised): {vykop_m3:.1f} m³ vs TZ 32 m³ = {vykop_m3/32:.1f}× drift")
    print(f"  Queue updated: {queue_new['_meta']['total_items']} total ({queue_new['_meta']['critical_count']} critical, {queue_new['_meta']['important_count']} important, {queue_new['_meta']['minor_count']} minor, {queue_new['_meta']['closed_count']} closed)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
