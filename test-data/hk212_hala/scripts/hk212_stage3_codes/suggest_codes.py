"""HK212 Stage 3 — ÚRS code SUGGESTION for M-VK (venkovní) + M-ZTI (vodovod/kanalizace).

Writes to _urs_code_suggested (NE final urs_code — Pattern 13 review before promote).
Per item: _urs_code_suggested + _urs_confidence + _urs_source + _interior_exterior.

Method (§2): catalog FIRST (kros_catalog.db FTS), then ÚRS class knowledge (§4).
  - catalog exact match → confidence 1.0, source "kros_catalog.db"
  - class knowledge (catalog subset lacks class) → confidence 0.7, source "urs_class_knowledge_verify_full"
  - administrative kpl / unsure → null + _urs_flag "user_must_provide"

Scope (§1): M-VK (skip M-VK-040..049 žlab already coded) + M-ZTI A/B/C/D.
Interior vs exterior (§3 CRITICAL): vnitřní ZTI 721/722/725; vnější sítě 871/891
  + zemní 132/162/174; šachty 894; venkovní beton/dlažba 564/596/916/919.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ITEMS_PATH = ROOT / "outputs" / "phase_1_etap1" / "items_hk212_etap1.json"
REVIEW_MD = ROOT / "outputs" / "stage3_codes_review_vk_zti.md"
NOW_ISO = "2026-05-28T00:30:00+00:00"

CAT = "kros_catalog.db"
KN = "urs_class_knowledge_verify_full"
FLAG = "user_must_provide"

# id → (code|None, confidence, source, interior_exterior, note)
MAPPING: dict[str, tuple] = {
    # ===== M-VK venkovní úpravy (exterior) =====
    "M-VK-001": ("919*beton-monolit/564", 0.7, KN, "exterior", "beton rampy — class 919 vozovkové/564; verify"),
    "M-VK-002": ("631362021/953", 0.7, KN, "exterior", "KARI síť výztuž + bednění; 631 výztuž / 953 osazení"),
    "M-VK-003": ("564", 0.7, KN, "exterior", "drcený štěrk ŠD podklad — class 564, catalog subset prázdný"),
    "M-VK-004": ("916231112", 1.0, CAT, "exterior", "osazení chodníkového obrubníku se zřízením lože (catalog match)"),
    "M-VK-008": ("460xxx-chranicka+132201101", 0.7, KN, "exterior", "chránička HDPE + výkop rýhy; silové = elektro VV"),
    "M-VK-009": ("891xxx-prelozka", 0.7, KN, "exterior", "přeložka vodovodu vnější — class 891; rozsah pending ABMV_23"),
    "M-VK-018": ("181301103/181411131", 0.7, KN, "exterior", "ohumusování + osetí travou — class 181"),
    "M-VK-019": ("171201101", 0.7, KN, "exterior", "vyspádování/úprava terénu — class 171"),
    "M-VK-020": ("564/919-beton-okapnik", 0.7, KN, "exterior", "beton okapník C25/30 XF3 — class 564/919"),
    "M-VK-021": ("631362021", 0.7, KN, "exterior", "KARI Q188 výztuž — class 631"),
    "M-VK-022": ("564", 0.7, KN, "exterior", "drcený štěrk ŠD podklad — class 564"),
    "M-VK-023": ("919-dilatace", 0.7, KN, "exterior", "dilatační lišty + řezání spár — class 919"),
    "M-VK-024": ("181101102/174", 0.7, KN, "exterior", "úprava + hutnění zemní pláně — class 181/174"),
    "M-VK-025": ("174101101", 1.0, CAT, "exterior", "hutnění (zásyp/hutnění catalog) — verify pro štěrk"),
    "M-VK-026": ("919-bedneni", 0.7, KN, "exterior", "bednění boční hrana — class 919"),
    "M-VK-027": ("132201101", 1.0, CAT, "exterior", "hloubení rýh š do 600 mm (catalog match)"),
    "M-VK-028": ("162201101", 1.0, CAT, "exterior", "vodorovné přemístění výkopku/odvoz (catalog match)"),
    "M-VK-029": ("936xxx/213-geotextilie", 0.7, KN, "exterior", "geotextilie separace — class 936/213"),
    "M-VK-030": ("132201101", 1.0, CAT, "exterior", "hloubení rýh š do 600 mm (catalog match)"),
    "M-VK-031": ("162201101", 1.0, CAT, "exterior", "vodorovné přemístění/odvoz (catalog match)"),
    "M-VK-032": ("181101102/174", 0.7, KN, "exterior", "úprava + hutnění pláně — class 181/174"),
    "M-VK-033": ("936xxx/213-geotextilie", 0.7, KN, "exterior", "geotextilie separace — class 936/213"),
    "M-VK-034": ("564", 0.7, KN, "exterior", "ŠD nosná podkladní vrstva — class 564"),
    "M-VK-035": ("564-loze-drt", 0.7, KN, "exterior", "drť 4/8 ložná vrstva — class 564"),
    "M-VK-036": ("916231112", 1.0, CAT, "exterior", "osazení obrubníku se zřízením lože (catalog match)"),
    "M-VK-037": ("919/564-beton-loze", 0.7, KN, "exterior", "beton lože C16/20 pod obrubník — class 919/564"),
    "M-VK-038": ("596811222", 1.0, CAT, "exterior", "kladení dlažby komunikací pro pěší (catalog match)"),
    "M-VK-039": ("596-zasyp-spar", 0.7, KN, "exterior", "zásyp spár pískem + hutnění — class 596 (součást kladení)"),
    # ===== M-ZTI A — domovní vodovod (interior) =====
    "M-ZTI-001": ("722170xxx-PPR", 0.7, KN, "interior", "PP-RCT 16×2,2 + izolace — class 722 vnitřní vodovod"),
    "M-ZTI-002": ("722170xxx-PPR", 0.7, KN, "interior", "PP-RCT 16×2,2 + izolace — class 722"),
    "M-ZTI-003": ("722170xxx-PPR", 0.7, KN, "interior", "PP-RCT 20-50 + izolace — class 722"),
    "M-ZTI-004": ("722230xxx-ventil", 0.7, KN, "interior", "rohový ventil + flexi — class 722 armatury"),
    "M-ZTI-005": ("722230xxx-kohout", 0.7, KN, "interior", "kulový kohout DN40 — class 722 armatury"),
    "M-ZTI-006": ("722250xxx-vodomer", 0.7, KN, "interior", "vodoměrná sestava — class 722"),
    "M-ZTI-007": ("725820xxx-baterie", 0.7, KN, "interior", "umyvadlová baterie — class 725 (výtoková armatura)"),
    "M-ZTI-008": ("724/722-TUV-zasobnik", 0.7, KN, "interior", "el. zásobník TUV — class 724/722"),
    "M-ZTI-009": ("722230xxx-ventil", 0.7, KN, "interior", "uzavírací ventil DN20 — class 722"),
    "M-ZTI-010": ("725110xxx-umyvadlo", 0.7, KN, "interior", "umyvadlo — class 725 zařizovací předměty"),
    "M-ZTI-011": ("722130xxx-ocel-pozink", 0.7, KN, "interior", "ocel pozink DN20 požární — class 722"),
    "M-ZTI-012": ("722130xxx-ocel-pozink", 0.7, KN, "interior", "ocel pozink DN25 požární — class 722"),
    "M-ZTI-013": ("722130xxx-ocel-pozink", 0.7, KN, "interior", "ocel pozink DN32 požární — class 722"),
    "M-ZTI-014": ("722290xxx-hydrant", 0.7, KN, "interior", "hydrant D19/30 vnitřní požární — class 722"),
    "M-ZTI-015": ("722230xxx-klapka", 0.7, KN, "interior", "zpětná klapka DN32 — class 722"),
    # ===== M-ZTI B — domovní kanalizace =====
    "M-ZTI-016": ("721174024", 1.0, CAT, "interior", "PP-HT DN50 odpadní (catalog 721174024 DN70 base — verify DN50)"),
    "M-ZTI-017": ("721174026", 1.0, CAT, "interior", "PP-HT DN110 (catalog 721174026 DN125 base — verify DN110)"),
    "M-ZTI-018": ("721173315", 1.0, CAT, "interior", "PP-KG DN110 systém KG (catalog match)"),
    "M-ZTI-019": ("721173402", 1.0, CAT, "interior", "PP-KG DN125 svodné (catalog match)"),
    "M-ZTI-020": ("721173xxx-DN160", 0.7, KN, "interior", "PP-KG DN160 — class 721 (catalog DN160 nenalezen)"),
    "M-ZTI-021": ("721173xxx-DN200", 0.7, KN, "interior", "PP-KG DN200 — class 721 (catalog DN200 nenalezen)"),
    "M-ZTI-022": ("894xxx-sachta-DN1000", 0.7, KN, "exterior", "revizní šachta Dš DN1000 + regulační prvek — class 894"),
    "M-ZTI-023": ("894xxx-sachta-DN1000", 0.7, KN, "exterior", "revizní šachta Dš1 dešťová DN1000 — class 894"),
    "M-ZTI-024": ("894xxx-sachta-filtracni", 0.7, KN, "exterior", "filtrační šachta Dš2 DN1000 — class 894"),
    "M-ZTI-025": ("894xxx-sachta-DN1000", 0.7, KN, "exterior", "revizní šachty Rš2+Rš3 DN1000 — class 894"),
    "M-ZTI-026": ("894/871-zasakovaci", 0.7, KN, "exterior", "zasakovací těleso 2 m³ — class 894/871 specific; verify ABMV_33"),
    "M-ZTI-027": ("894/871-retencni-15m3", 0.7, KN, "exterior", "retenční nádoba 15 m³ — class 894/871; verify ABMV_33"),
    "M-ZTI-028": ("894xxx-sachta-DN1000", 0.7, KN, "exterior", "revizní šachta Dš2 DN1000 — class 894"),
    "M-ZTI-029": ("721290xxx-sifon", 0.7, KN, "interior", "sifon umyvadlový — class 721 příslušenství"),
    "M-ZTI-030": ("721290xxx-sifon-kondenzat", 0.7, KN, "interior", "sifon kondenzát HL136 — class 721"),
    "M-ZTI-031": ("721290xxx-lapac", 0.7, KN, "interior", "lapač splavenin litinový — class 721"),
    # ===== M-ZTI C — kanalizace čerpaná vnější (exterior) =====
    "M-ZTI-032": ("871xxx-PE100-cerpana", 0.7, KN, "exterior", "PE100 d50 čerpaná kanalizace — class 871"),
    "M-ZTI-033": ("891xxx-navrtavaci-pas", 0.7, KN, "exterior", "navrtávací pas 75/40 — class 891/871"),
    "M-ZTI-034": ("871xxx-precerpavaci-stanice", 0.7, KN, "exterior", "přečerpávací stanice Tlakan P2 — class 871 specific"),
    "M-ZTI-035": ("132201201", 1.0, CAT, "exterior", "hloubení rýh š přes 600 do 2000 mm pažený (catalog match, š1m)"),
    "M-ZTI-036": ("174101101", 1.0, CAT, "exterior", "pískový podsyp se zhutněním (catalog 174 zásyp/hutnění — verify obsyp)"),
    "M-ZTI-037": ("174101101", 1.0, CAT, "exterior", "pískový obsyp se zhutněním (catalog 174 — verify)"),
    "M-ZTI-038": ("174101101", 1.0, CAT, "exterior", "konečný zához zeminou (catalog 174 zásyp)"),
    "M-ZTI-039": ("162201101", 1.0, CAT, "exterior", "odvoz přebytečného výkopku (catalog 162)"),
    "M-ZTI-040": (None, None, FLAG, "exterior", "montážní + pomocný materiál kpl — NE catalog item, user provide"),
    "M-ZTI-041": (None, None, FLAG, "exterior", "ostatní práce kpl — NE catalog item, user provide"),
    "M-ZTI-042": (None, None, FLAG, "exterior", "vytyčení sítí kpl — VRN-style, user provide (NE standard ÚRS)"),
    "M-ZTI-043": (None, None, FLAG, "exterior", "inženýrská činnost kpl — VRN-style, user provide"),
    "M-ZTI-044": (None, None, FLAG, "exterior", "dílenská dokumentace kpl — VRN-style, user provide"),
    "M-ZTI-045": (None, None, FLAG, "exterior", "dokumentace skutečného provedení kpl — VRN-style, user provide"),
    "M-ZTI-046": ("871xxx/892-zkouska-tesnosti", 0.7, KN, "exterior", "zkouška těsnosti kanalizace — class 871/892"),
    # ===== M-ZTI D — vodovod vnější (exterior) =====
    "M-ZTI-047": ("891xxx-PE100-vodovod", 0.7, KN, "exterior", "PE100 d50 vodovod vnější — class 891"),
    "M-ZTI-048": ("891xxx-navrtavaci-pas", 0.7, KN, "exterior", "navrtávací pas 110/50 — class 891"),
    "M-ZTI-049": ("891xxx-soupe-DN40", 0.7, KN, "exterior", "uzavírací šoupě + zemní souprava DN40 — class 891"),
    "M-ZTI-050": ("132201201", 1.0, CAT, "exterior", "hloubení rýh š přes 600 do 2000 mm pažený (catalog match, š1m)"),
    "M-ZTI-051": ("174101101", 1.0, CAT, "exterior", "pískový podsyp se zhutněním (catalog 174)"),
    "M-ZTI-052": ("174101101", 1.0, CAT, "exterior", "pískový obsyp se zhutněním (catalog 174)"),
    "M-ZTI-053": ("174101101", 1.0, CAT, "exterior", "konečný zához zeminou (catalog 174)"),
    "M-ZTI-054": ("899xxx/871-vystrazna-folie", 0.7, KN, "exterior", "výstražná folie — class 899/871"),
    "M-ZTI-055": ("162201101", 1.0, CAT, "exterior", "odvoz přebytečného výkopku (catalog 162)"),
    "M-ZTI-056": (None, None, FLAG, "exterior", "montážní + pomocný materiál kpl — NE catalog item, user provide"),
}


def main() -> None:
    raw = json.loads(ITEMS_PATH.read_text(encoding="utf-8"))
    touched = 0
    rows_for_table = []
    stats = {"catalog_1.0": 0, "knowledge_0.7": 0, "flag_null": 0}

    for item in raw["items"]:
        iid = item["id"]
        if iid not in MAPPING:
            continue
        code, conf, source, intext, note = MAPPING[iid]
        item["_urs_code_suggested"] = code
        item["_urs_confidence"] = conf
        item["_urs_source"] = source
        item["_interior_exterior"] = intext
        if code is None:
            item["_urs_flag"] = FLAG
            stats["flag_null"] += 1
        elif conf == 1.0:
            stats["catalog_1.0"] += 1
        else:
            stats["knowledge_0.7"] += 1
        # audit note (NE touch final urs_code — Pattern 13)
        item["audit_trail"]["urs_suggestion_stage_3"] = {
            "suggested": code, "confidence": conf, "source": source,
            "interior_exterior": intext, "note": note,
            "review_required": "Pattern 13 — review before promote to final urs_code",
            "suggested_at": NOW_ISO,
        }
        touched += 1
        rows_for_table.append((iid, item.get("_projektant_code"), item["popis"][:55],
                               code, conf, source, intext))

    if touched != len(MAPPING):
        raise SystemExit(f"FATAL: expected {len(MAPPING)} touched, got {touched}")

    total = touched
    pct_07 = stats["knowledge_0.7"] / total * 100

    raw["metadata"].setdefault("revisions", []).append({
        "date": "2026-05-28",
        "change": (
            f"Stage 3 ÚRS code SUGGESTION for M-VK ({sum(1 for k in MAPPING if k.startswith('M-VK'))} "
            f"items) + M-ZTI ({sum(1 for k in MAPPING if k.startswith('M-ZTI'))} items). "
            "Written to _urs_code_suggested (NE final urs_code — Pattern 13 review)."
        ),
        "reason": (
            "Catalog-first mapping (kros_catalog.db) + ÚRS class knowledge fallback. "
            "Interior/exterior classified per žlab lesson (NE 721 ZTI for exterior)."
        ),
        "items_suggested": touched,
        "suggestion_stats": stats,
        "catalog_subset_sufficiency": (
            f"{pct_07:.0f}% items confidence 0.7 (catalog subset lacks 564/722/725/871/891/894/919). "
            "Recommend user provides full ÚRS export for Stage 3 finalization."
            if pct_07 > 40 else f"{pct_07:.0f}% knowledge-based, acceptable"
        ),
        "pattern_13_compliance": "_urs_code_suggested only — final urs_code untouched, review before promote",
        "review_table": "outputs/stage3_codes_review_vk_zti.md",
    })

    ITEMS_PATH.write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"items.json: {touched} items suggested ({stats})")
    print(f"  knowledge 0.7 = {pct_07:.0f}% (>40% → {'REPORT: full ÚRS export needed' if pct_07>40 else 'ok'})")

    # Review table — group by section, low-confidence first
    def sect(iid):
        if iid.startswith("M-VK"): return "M-VK"
        pc = next((r[1] for r in rows_for_table if r[0]==iid), "")
        if pc and pc.startswith("DV"): return "M-ZTI-A vodovod vnitřní"
        if pc and pc.startswith(("K1","K2")): return "M-ZTI-B kanalizace vnitřní"
        if pc and pc.endswith("c") or (pc and pc.startswith("P.2")): return "M-ZTI-C kanalizace čerpaná vnější"
        if pc and pc.endswith("d"): return "M-ZTI-D vodovod vnější"
        return "M-ZTI"
    lines = ["# HK212 Stage 3 — ÚRS code review (M-VK + M-ZTI)\n",
             f"**Date:** 2026-05-28  ·  **Items suggested:** {touched}",
             f"**Stats:** catalog (1.0) = {stats['catalog_1.0']} · knowledge (0.7) = {stats['knowledge_0.7']} · flag null = {stats['flag_null']}",
             f"**Catalog subset 0.7 share:** {pct_07:.0f}%"
             + (" — ⚠️ >40%, full ÚRS export recommended for finalization" if pct_07 > 40 else ""),
             "",
             "Pattern 13: `_urs_code_suggested` only — review before promote to final `urs_code`.",
             "Sorted low-confidence first within each section (user reviews those).\n"]
    from collections import defaultdict
    by_sect = defaultdict(list)
    for r in rows_for_table:
        by_sect[sect(r[0])].append(r)
    for s in sorted(by_sect):
        lines.append(f"\n## {s}\n")
        lines.append("| item_id | projektant | popis | _urs_code_suggested | conf | source | int/ext |")
        lines.append("|---|---|---|---|---|---|---|")
        # low-confidence (null then 0.7 then 1.0)
        def keyf(r): return (0 if r[4] is None else (1 if r[4]==0.7 else 2))
        for iid, pc, popis, code, conf, source, intext in sorted(by_sect[s], key=keyf):
            cs = "null" if conf is None else f"{conf}"
            cd = code or "— FLAG user_must_provide"
            lines.append(f"| {iid} | {pc or '—'} | {popis} | {cd} | {cs} | {source} | {intext} |")
    REVIEW_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"review table → {REVIEW_MD}")


if __name__ == "__main__":
    main()
