"""Fix follow-ups from PR #1226 D.1.4.2 VYTÁPĚNÍ:

1. Source documents landed at inputs/vykresy_pdf/ (per repo convention for
   výkresy + drawing-attached TZ), not inputs/dokumentace/ as the original
   commit assumed. Repath all audit_trail document refs in 12 M-UT items
   + ABMV_1.resolution_source + README internal paths.

2. TZ §8 + výkaz p.5 verified against encoded facts — all 11 facts MATCH
   (11 kW ztráta, 60 kW příkon, 20 ECOSUN S+ 12 × 1.2 kW = 24 kW, 4 Dalap
   E-HP × 9 kW = 36 kW, 5 m závěs výška, č.kat. 5401542, UET 15D, 4+4
   termostaty, 46 MWh/rok, 18 °C ti, rohy haly). Record verification in
   metadata.revisions[].

3. Two clarifying notes for Stage 3 catalog matcher:
   - výkaz p.5 ř.1.1 "ECOSUN ... včetně závěsných řetízků" — řetízky are
     part of ECOSUN supply. M-UT-003 audit_trail clarifies it captures
     montáž labor + doplňkový kotevní materiál (not duplicate dodávka).
   - výkaz p.5 ř.1.1 + ř.2.1 "termostaty viz projekt elektro" — M-UT-007
     keeps termostaty in M-UT scope per investor task spec, but
     audit_trail notes the elektro cross-reference for MaR + zapojení.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ITEMS_PATH = ROOT / "outputs" / "phase_1_etap1" / "items_hk212_etap1.json"
ABMV_PATH = ROOT / "outputs" / "abmv_email_queue.json"

OLD_DIR = "inputs/dokumentace/"
NEW_DIR = "inputs/vykresy_pdf/"

UT_DOC_BASENAMES = {
    "UT_HalaHK_TZ_DPS.doc",
    "UT_HalaHK_TZ_VM_DPS_E.pdf",
    "UT_HalaHK_PUDORYS_DPS_E.pdf",
}


def repath_reference(ref: dict) -> bool:
    doc = ref.get("document")
    if isinstance(doc, str) and doc.startswith(OLD_DIR):
        basename = doc[len(OLD_DIR) :]
        if basename in UT_DOC_BASENAMES:
            ref["document"] = NEW_DIR + basename
            return True
    return False


def fix_items(raw: dict) -> dict:
    counts = {"refs_repathed": 0, "items_touched": 0, "clarifying_notes_added": 0}
    for item in raw["items"]:
        if item.get("kapitola") != "M-UT":
            continue
        touched = False

        at = item.get("audit_trail", {})
        for ref in at.get("reference", []):
            if repath_reference(ref):
                counts["refs_repathed"] += 1
                touched = True

        # M-UT-003 — clarifying note on závěsné řetízky.
        if item["id"] == "M-UT-003":
            at["poznamka_vykaz_double_count_guard"] = (
                "Pozor pro Stage 3 catalog matching: výkaz materiálu p.5 ř.1.1 "
                "uvádí ECOSUN dodávku 'včetně závěsných řetízků prům délka 5 m/ks' — "
                "materiál řetízků je ZAHRNUT v ECOSUN dodávce (M-UT-001, č.kat. 5401542). "
                "M-UT-003 zachycuje MONTÁŽ + doplňkový kotevní materiál nad rámec "
                "balíčku ECOSUN (731xxx). Nemísit s materiálovou dodávkou — riziko "
                "double-count při mapování na Forestina ÚT katalog."
            )
            counts["clarifying_notes_added"] += 1
            touched = True

        # M-UT-007 — termostaty cross-reference s elektro.
        if item["id"] == "M-UT-007":
            at["poznamka_elektro_cross_reference"] = (
                "TZ §8 + výkaz p.5 ř.1.1 + ř.2.1 referencují termostaty s poznámkou "
                "'viz projekt elektro'. Per investor scope change 2026-05-26 zůstává "
                "dodávka 8 ks termostatů v kapitole M-UT (4× ECOSUN sekce + 4× Dalap). "
                "Z elektro profession přichází MaR kabeláž mezi termostatem + UET + "
                "topidlem, silové zapojení a revize (viz _scope_exclusion."
                "elektro_profession). Stage 3 catalog matcher: dodávka + osazení "
                "termostatu v 460xxx; kabeláž v elektro VV (mimo M-UT)."
            )
            counts["clarifying_notes_added"] += 1
            touched = True

        if touched:
            counts["items_touched"] += 1

    # ABMV_1 resolution_source repath happens in ABMV file, not items.json.

    raw["metadata"].setdefault("revisions", []).append(
        {
            "date": "2026-05-26",
            "change": (
                "Follow-up to D.1.4.2 VYTÁPĚNÍ commit: repath audit_trail document "
                "refs from inputs/dokumentace/ → inputs/vykresy_pdf/ (where investor "
                "uploaded TZ + výkaz + půdorys); record TZ verification (all 11 facts "
                "match); add 2 clarifying notes for Stage 3 catalog matcher "
                "(M-UT-003 řetízky double-count guard, M-UT-007 elektro cross-ref)."
            ),
            "reason": (
                "PR #1226 audit_trail document paths referenced inputs/dokumentace/ "
                "but files were uploaded to inputs/vykresy_pdf/ per repo convention "
                "for výkresy + drawing-attached TZ documents."
            ),
            "items_modified": ["M-UT-003", "M-UT-007"] + [
                f"M-UT-{n:03d}" for n in range(1, 13)
            ],
            "items_added": [],
            "items_removed": [],
            "tz_verification": {
                "status": "all_facts_match_dps_2026_05",
                "verified_facts": [
                    "tepelna_ztrata_11_kw (TZ §3 + §9 Qc=11046 W)",
                    "celkovy_prikon_60_kw (TZ §9)",
                    "ecosun_20_ks_1200w_kat_5401542 (TZ §8 + výkaz p.5 ř.1.1 + §9)",
                    "dalap_e_hp_4_ks_9_kw (TZ §8 + výkaz p.5 ř.2.1 + §9 'Sahara 9 kW')",
                    "vyska_zaves_5m (TZ §8)",
                    "uet_15d_ridici_jednotka (výkaz p.5 ř.2.1)",
                    "termostaty_4_ecosun_sekce_plus_4_dalap (TZ §8)",
                    "rocni_spotreba_46_MWh (TZ §6; §9 table 45803 kWh = 45.8 MWh)",
                    "vnitrni_teplota_18_C (TZ §9 ti)",
                    "dalap_rohy_haly (TZ §8)",
                    "elektro_cross_ref (výkaz p.5 'termostaty viz projekt elektro')",
                ],
                "tz_source": (
                    "inputs/vykresy_pdf/UT_HalaHK_TZ_VM_DPS_E.pdf "
                    "(5 stránek, podepsal Ing. Stanislav Jirucha ČKAIT 0009051, "
                    "2026.05.25 19:56)"
                ),
            },
        }
    )
    raw["metadata"]["counts"] = counts
    return raw


def fix_abmv(abmv: dict) -> bool:
    for entry in abmv["items"]:
        if entry.get("id") == "ABMV_1":
            src = entry.get("resolution_source", "")
            new_src = src.replace(OLD_DIR, NEW_DIR)
            if new_src != src:
                entry["resolution_source"] = new_src
                return True
    return False


def main() -> None:
    raw = json.loads(ITEMS_PATH.read_text(encoding="utf-8"))
    raw = fix_items(raw)
    counts = raw["metadata"].pop("counts")
    ITEMS_PATH.write_text(
        json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"items.json: {counts['refs_repathed']} refs repathed, "
        f"{counts['clarifying_notes_added']} clarifying notes added, "
        f"{counts['items_touched']} M-UT items touched"
    )

    abmv = json.loads(ABMV_PATH.read_text(encoding="utf-8"))
    if fix_abmv(abmv):
        ABMV_PATH.write_text(
            json.dumps(abmv, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print("abmv_email_queue.json: ABMV_1 resolution_source repathed")
    else:
        print("abmv_email_queue.json: no change (ABMV_1 source already correct)")


if __name__ == "__main__":
    main()
