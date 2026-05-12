#!/usr/bin/env bash
# =============================================================================
# STAVAGENT — setup_hk212_hala.sh
# =============================================================================
# Reorganizuje test-data/HALA HK/_UNSORTED → test-data/hk212_hala/{inputs,outputs}
# Vytvoří meta soubory (README, project_header.json, abmv_queue.json, inventory.md)
#
# POUŽITÍ:
#   1. Umístit do kořene STAVAGENT repa
#   2. bash setup_hk212_hala.sh
#   3. git status — zkontrolovat změny
#   4. git add . && git commit -m "setup: hk212_hala project structure + DXF audit"
#
# Idempotentní: lze spustit opakovaně bez chyby (mv selže, ale skript pokračuje).
# =============================================================================

set -e
SRC="test-data/HALA HK/_UNSORTED"
DST="test-data/hk212_hala"

if [ ! -d "$SRC" ]; then
  echo "❌ Source not found: $SRC"
  echo "   Spustit z kořene repa STAVAGENT?"
  exit 1
fi

echo "📁 Vytváření struktury: $DST"
mkdir -p "$DST"/inputs/{tz,vykresy_pdf,vykresy_dwg,vykresy_dxf,situace,meta}
mkdir -p "$DST"/outputs
mkdir -p "$DST"/handoff

echo "📦 Move souborů z _UNSORTED → sorted struktura"

# Funkce: bezpečný mv s warningem (ne fatal)
safe_mv() {
  local from="$1"
  local to="$2"
  if [ -f "$from" ]; then
    mv "$from" "$to"
    echo "  ✓ $(basename "$to")"
  else
    echo "  ⚠ skipped (not found): $(basename "$from")"
  fi
}

# --- TZ dokumenty -----------------------------------------------------------
safe_mv "$SRC/212_HK_A_final.pdf"                "$DST/inputs/tz/01_ars_pruvodni_A.pdf"
safe_mv "$SRC/212_HK_B_final.pdf"                "$DST/inputs/tz/02_ars_souhrnna_B.pdf"
safe_mv "$SRC/212_HK_251027_D.pdf"               "$DST/inputs/tz/03_ars_d11_TZ.pdf"
safe_mv "$SRC/HALA_TZ_251030.pdf"                "$DST/inputs/tz/04_statika_d12_TZ_uplna.pdf"
safe_mv "$SRC/HALA_KONSTRUKCE_251030.pdf"        "$DST/inputs/tz/05_konstrukce_titul.pdf"
safe_mv "$SRC/HALA_ZAKLADY_251030.pdf"           "$DST/inputs/tz/06_zaklady_titul.pdf"
safe_mv "$SRC/PBŘ_2025_60-034_Sklad-hala-HK_V2_kpl_sRAZ.pdf" "$DST/inputs/tz/07_pbr_kpl.pdf"

# --- Výkresy PDF -------------------------------------------------------------
safe_mv "$SRC/212_HK_251027-Výkres-ÚVOD.pdf"             "$DST/inputs/vykresy_pdf/A100_uvod.pdf"
safe_mv "$SRC/212_HK_251027-Výkres-PŮDORYS 1NP.pdf"      "$DST/inputs/vykresy_pdf/A101_pudorys_1np.pdf"
safe_mv "$SRC/212_HK_251027-Výkres-PŮDORYS STŘECHY.pdf"  "$DST/inputs/vykresy_pdf/A102_pudorys_strechy.pdf"
safe_mv "$SRC/212_HK_251027-Výkres-ŘEZ A, B.pdf"         "$DST/inputs/vykresy_pdf/A103_rez_AB.pdf"
safe_mv "$SRC/212_HK_251027-Výkres-POHLEDY.pdf"          "$DST/inputs/vykresy_pdf/A104_pohledy.pdf"
safe_mv "$SRC/212_HK_251027-Výkres-ZÁKLADY.pdf"          "$DST/inputs/vykresy_pdf/A105_zaklady.pdf"

# --- Výkresy DWG -------------------------------------------------------------
safe_mv "$SRC/212_HK_volkajakub-Výkres - A100 - ÚVOD.dwg"                          "$DST/inputs/vykresy_dwg/A100_uvod.dwg"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A101 - PŮDORYS 1NP.dwg"                   "$DST/inputs/vykresy_dwg/A101_pudorys_1np.dwg"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A102 - PŮDORYS STŘECHY.dwg"               "$DST/inputs/vykresy_dwg/A102_pudorys_strechy.dwg"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A103 - ŘEZ A, B.dwg"                      "$DST/inputs/vykresy_dwg/A103_rez_AB.dwg"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A104 - POHLEDY.dwg"                       "$DST/inputs/vykresy_dwg/A104_pohledy.dwg"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A105 - ZÁKLADY.dwg"                       "$DST/inputs/vykresy_dwg/A105_zaklady.dwg"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A106 - PŮDORYS 1NP - STROJE.dwg"          "$DST/inputs/vykresy_dwg/A106_stroje.dwg"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A107 - PŮDORYS 1NP - STROJE - KOTVÍCÍ BODY.dwg" "$DST/inputs/vykresy_dwg/A107_stroje_kotvici_body.dwg"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A201 - VÝKOPY.dwg"                        "$DST/inputs/vykresy_dwg/A201_vykopy.dwg"

# --- Výkresy DXF (extraction targets) ---------------------------------------
safe_mv "$SRC/212_HK_volkajakub-Výkres - A101 - PŮDORYS 1NP.dxf"                   "$DST/inputs/vykresy_dxf/A101_pudorys_1np.dxf"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A102 - PŮDORYS STŘECHY.dxf"               "$DST/inputs/vykresy_dxf/A102_pudorys_strechy.dxf"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A104 - POHLEDY.dxf"                       "$DST/inputs/vykresy_dxf/A104_pohledy.dxf"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A105 - ZÁKLADY.dxf"                       "$DST/inputs/vykresy_dxf/A105_zaklady.dxf"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A106 - PŮDORYS 1NP - STROJE.dxf"          "$DST/inputs/vykresy_dxf/A106_stroje.dxf"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A107 - PŮDORYS 1NP - STROJE - KOTVÍCÍ BODY.dxf" "$DST/inputs/vykresy_dxf/A107_stroje_kotvici_body.dxf"
safe_mv "$SRC/212_HK_volkajakub-Výkres - A201 - VÝKOPY.dxf"                        "$DST/inputs/vykresy_dxf/A201_vykopy.dxf"

# --- Situace ----------------------------------------------------------------
safe_mv "$SRC/212_HK_situace_03-C.1_širší vztahy.pdf"  "$DST/inputs/situace/C1_sirsi_vztahy.pdf"
safe_mv "$SRC/212_HK_situace_03-C.2_katastr.pdf"        "$DST/inputs/situace/C2_katastr.pdf"
safe_mv "$SRC/212_HHK_C.3 .pdf"                         "$DST/inputs/situace/C3_situace_kaceni.pdf"

# --- Cleanup ----------------------------------------------------------------
if [ -f "test-data/HALA HK/1" ]; then
  rm "test-data/HALA HK/1"
  echo "  ✓ removed marker file 'test-data/HALA HK/1'"
fi

# pokud _UNSORTED prázdný — odstranit; pokud non-prázdný — varovat
if [ -d "$SRC" ]; then
  REMAINING=$(ls -A "$SRC" 2>/dev/null | wc -l)
  if [ "$REMAINING" -eq 0 ]; then
    rmdir "$SRC"
    echo "  ✓ _UNSORTED is empty, removed"
    # také zkusit staré HALA HK pokud prázdné
    if [ -d "test-data/HALA HK" ]; then
      RR=$(ls -A "test-data/HALA HK" 2>/dev/null | wc -l)
      [ "$RR" -eq 0 ] && rmdir "test-data/HALA HK" && echo "  ✓ legacy 'test-data/HALA HK' removed"
    fi
  else
    echo "  ⚠ _UNSORTED still contains $REMAINING files — zkontrolovat manuálně"
  fi
fi

# =============================================================================
# Generování meta souborů
# =============================================================================
echo ""
echo "📄 Vytváření meta souborů"

# --- README.md --------------------------------------------------------------
cat > "$DST/README.md" << 'READMEEOF'
# Hala Hradec Králové (akce 212)

**Typ:** Skladová hala s technologií recyklace fotovoltaických panelů
**Investor:** SOLAR DISPOREC s.r.o. (IČO 19546220)
**Lokalita:** Vážní 857, 500 03 Hradec Králové – Slezské Předměstí, parc. č. 1939/1
**Deadline VV+rozpočet:** ~4 týdny (od 2026-05-12)

## Projektanti

| Část | Firma / osoba | Stupeň | Datum |
|---|---|---|---|
| ARS (D.1.1) | Basepoint s.r.o. — Ing. arch. Jakub Volka, ČKA 0003947 | **DPZ** | 08/2025 |
| Statika (D.1.2) | Ing. Jiří Plachý, ČKAIT 0013051 (zpracoval Bc. M. Doležal) | **DSP** | 09/2025 |
| PBŘ | externí, č. dok. 2025/60-034 | — | 2025 |
| Technologie strojů | externí, č. dok. 2966-1 (**NEDODÁNO** — viz ABMV #16) | — | — |

## Struktura projektu


```
hk212_hala/
├── inputs/
│   ├── tz/              7 PDF (TZ A, B, D.1.1, D.1.2, konstrukce, základy, PBŘ)
│   ├── vykresy_pdf/     6 PDF (A100–A105)
│   ├── vykresy_dwg/     9 DWG (A100–A107, A201)
│   ├── vykresy_dxf/     7 DXF (A101, A102, A104–A107, A201; A103 jen DWG)
│   ├── situace/         C1, C2, C3
│   └── meta/            project_header.json, abmv_queue.json, inventory.md
├── outputs/             (generated by Π.0a, Π.1, Π.2)
└── handoff/             (session handoff docs)
```


## Status

- [x] **Phase 0a (Foundation extraction)** — DXF audit completed during chat session 2026-05-12
- [x] **ABMV inventory** — 16 items (3 kritické, 10 důležitých, 3 drobné)
- [x] **ABMV email draft** — připraven, čeká odeslání po Phase 1 cross-check
- [ ] **Phase 0b** — Validation gate (rooms count, hard-fail confidence)
- [ ] **Phase 1** — Generator (items per kapitola) + URS matching
- [ ] **Phase 2** — Excel output (13 sheets)
- [ ] **PROBE iterations** — audit + fixes
- [ ] **Delivery** — Excel + cover letter + ABMV reply

## Klíčové specifika

- **1 PÚ, 1 místnost** (Sklad 495 m²)
- **Skladová + technologická** funkce (DRIFT, DEFRAME, FILTRACE)
- **Příkon strojů 80+ kW/ks** vs P_vyp_TZ_B = 60.5 kW → **kritický rozpor** (ABMV #1)
- **Odhad scope:** ~180–255 položek (HSV + PSV + TZB + VRN)

## Inheritované kanonické soubory

- `subdodavatel_mapping.json` v1.1+ — bude doplněn před Phase 1 (až budou známé trades)
- Confidence ladder: regex=1.0, dxf_block=0.95, regex_desc=0.85, perplexity=0.85, ai=0.70, manual=0.99
- Regen chain order: phase_7a → phase_6_excel → phase_8_list11 → phase_0_20 → phase_0_21
- 4 invariants (a)-(d) hard-fail před commit

## Kontakty

| Role | Jméno | Kontakt |
|---|---|---|
| ARS hlavní | Ing. arch. Jakub Volka | volkajakub@basepoint.cz · +420 733 575 363 |
| ARS team | Anna Abrahámová, Kristián Pócsik | (přes Volku) |
| Statika | Ing. Jiří Plachý (ČKAIT 0013051) | — |
| Statika prováděcí | Bc. Martin Doležal | +420 606 287 393 (IČO 21981078) |
| Investor | SOLAR DISPOREC s.r.o. | Malostranské nám. 5/28, Praha 1 |
READMEEOF

# --- inputs/meta/inventory.md -----------------------------------------------
cat > "$DST/inputs/meta/inventory.md" << 'INVEOF'
# Inventory — hk212_hala/inputs/

## TZ dokumenty (7 PDF)

| # | Soubor | Část | Stupeň | Stran | Author |
|---|---|---|---|---|---|
| 01 | 01_ars_pruvodni_A.pdf | A — Průvodní TZ | DPZ¹ | 4 | Basepoint (Volka, Abrahámová) |
| 02 | 02_ars_souhrnna_B.pdf | B — Souhrnná TZ | DPZ¹ | 25 | Basepoint (Volka, Abrahámová, Pócsik) |
| 03 | 03_ars_d11_TZ.pdf | D.1.1 — ARS | DPZ | 5 | Basepoint |
| 04 | 04_statika_d12_TZ_uplna.pdf | D.1.2 — Stavebně konstrukční | **DSP** | 33 | Plachý / Doležal |
| 05 | 05_konstrukce_titul.pdf | D.1.2 — titulka | DSP | 1 | Plachý / Doležal |
| 06 | 06_zaklady_titul.pdf | D.1.2 — základy titulka | DSP | 1 | Plachý / Doležal |
| 07 | 07_pbr_kpl.pdf | D.1.3 — PBŘ | — | 32 | externí, č. 2025/60-034 |

¹ TZ A+B titulky uvádějí "DPS", ale výkresy ARS + TZ D.1.1 uvádějí "DPZ" — pravděpodobně překlep v hlavičkách. Viz ABMV #4.

## Výkresy (PDF + DWG + DXF)

| Kód | PDF | DWG | DXF | Stadium | Popis |
|---|---|---|---|---|---|
| A100 | ✅ | ✅ | — | DPZ | Úvodní list |
| A101 | ✅ | ✅ | ✅ | DPZ | Půdorys 1NP s tabulkou místností |
| A102 | ✅ | ✅ | ✅ | DPZ | Půdorys střechy |
| A103 | ✅ | ✅ | — | DPZ | Řezy A, B |
| A104 | ✅ | ✅ | ✅ (24 MB) | DPZ | Pohledy 4 fasád + materiálový výkaz |
| A105 | ✅ | ✅ | ✅ | DPZ | Základy |
| A106 | — | ✅ | ✅ | DPZ | Půdorys 1NP — stroje |
| A107 | — | ✅ | ✅ | DPZ | Půdorys 1NP — stroje — kotvící body |
| A201 | — | ✅ | ✅ | DPZ | Výkopy (3 typy řezů) |

## Situace (3 PDF)

| Soubor | Popis |
|---|---|
| C1_sirsi_vztahy.pdf | Širší vztahy v území |
| C2_katastr.pdf | Katastrální situace |
| C3_situace_kaceni.pdf | Koordinační situace + kácení dřevin |

## Chybějící podklady (k vyžádání)

- **IGP** — Inženýrsko-geologický průzkum (TZ uvazuje, ABMV #11)
- **TZB profesní dokumentace** (D.1.4: VZT, ÚT, EL, ZTI) — pouze koncepčně v TZ B (ABMV #12)
- **Energetický průkaz (PENB)**
- **2966-1 návrh dispozice strojů HK** (externí, referencováno z A104 DXF — ABMV #16)
INVEOF

# --- inputs/meta/stupne_dokumentace.md --------------------------------------
cat > "$DST/inputs/meta/stupne_dokumentace.md" << 'STUEOF'
# Stupně dokumentace projektu

Projekt je v **smíšeném stupni** — to není chyba, ale typický fázovaný progress:

| Část | Stupeň | Zpracoval | Stav |
|---|---|---|---|
| ARS (D.1.1) | **DPZ** (Dokumentace pro povolení záměru) | Basepoint, Volka | 08/2025 hotovo |
| Statika (D.1.2) | **DSP** (Dokumentace pro stavební povolení) | Plachý, Doležal | 09/2025 hotovo |
| PBŘ (D.1.3) | bez explicitního stupně | externí (č. 2025/60-034) | hotovo |
| TZB profese (D.1.4) | nedoručeno | různé | **chybí** |
| Technologie strojů | externí (2966-1) | neznámá kancelář | **nedodán** |

## Co znamená DPZ vs DSP pro rozpočet

- **DPZ** je nižší stupeň PD — schéma + základní rozměry + materialitelnost, **bez tabulek elementů** (0020–0080).
- **DSP** má vyšší detail — tabulky dveří, oken, skladeb (typicky), ale ne kompletní detaily provádění.
- **DRS/DPS** (Dokumentace pro provádění stavby) — má všechny tabulky + detaily.

Pro tento projekt:
- ARS = DPZ → **tabulky elementů (0020/0030/0041/0042/0080) neexistují** (musíme spatial extraction z DXF + textovou analýzu TZ).
- Statika = DSP → **kompletní výpočet** dostupný, ale bez prováděcích výkresů armování.

## Pracovní přístup

Jelikož mezi částmi je rozdíl ve stupni, **přednost má vždy vyšší stupeň**:
- Statika (DSP) přebíjí ARS (DPZ) pro konstrukční otázky (např. třída betonu — ABMV #5).
- PBŘ přebíjí ARS pro požární klasifikace (DP1/DP3 — ABMV #6).
- ARS určuje rozměry a uspořádání kde neexistuje statický nebo PBŘ rozpor.

## Nekonzistence titulků

TZ A a TZ B (Basepoint) mají v hlavičce "Dokumentace pro povolení stavby (DPS)", ale obsah i razítka výkresové části říkají DPZ. Pracovní interpretace: **překlep v hlavičkách**, ARS = DPZ.

Viz ABMV #4 (žádost o oficiální sjednocení).
STUEOF

# --- inputs/meta/project_header.json ----------------------------------------
# (Plný JSON s confidence-tagged facts — vygenerován z DXF audit session)
cat > "$DST/inputs/meta/project_header.json" << 'PHJEOF'
{
  "_meta": {
    "schema_version": "1.0",
    "generated_at": "2026-05-12",
    "generated_from": "STAVAGENT_Drawings_to_VV_Rozpocet_Playbook v1.0",
    "extraction_session": "claude_chat_2026-05-12_dxf_audit",
    "confidence_ladder": {
      "otskp_or_urs_exact": 1.0,
      "regex_on_code": 1.0,
      "dxf_block_count": 0.95,
      "dxf_dimension": 0.95,
      "regex_on_description": 0.85,
      "perplexity_norm": 0.85,
      "urs_matcher_fuzzy": 0.80,
      "ai_extraction": 0.70,
      "dxf_visual_inference": 0.60,
      "manual_judgement": 0.99
    }
  },
  "project": {
    "name": "Hala Hradec Králové",
    "internal_code": "212",
    "type": "skladová hala s technologií recyklace FV panelů",
    "investor": {
      "name": "SOLAR DISPOREC s.r.o.",
      "ico": "19546220",
      "address": "Malostranské náměstí 5/28, Malá Strana, 118 00 Praha 1"
    },
    "site": {
      "address": "Vážní 857, 500 03 Hradec Králové – Slezské Předměstí",
      "katastr_kod": "646971",
      "parcel": "1939/1",
      "current_owner": "KOVOŠROT GROUP CZ s.r.o."
    },
    "projektant_ars": {
      "firma": "Basepoint s.r.o. (IČO 27646793)",
      "address": "Květoslava Mašity 251, 252 31 Všenory",
      "main": "Ing. arch. Jakub Volka",
      "cka": "0003947",
      "email": "volkajakub@basepoint.cz",
      "phone": "+420 733 575 363",
      "team": ["Anna Abrahámová", "Kristián Pócsik"]
    },
    "projektant_statika": {
      "zakazkove_cislo": "6/2025",
      "main": "Ing. Jiří Plachý",
      "ckait": "0013051",
      "team": ["Bc. Martin Doležal (IČO 21981078, tel. +420 606 287 393)"]
    },
    "stupne_dokumentace": {
      "ars": "DPZ (08/2025)",
      "statika_d12": "DSP (09/2025)",
      "_abmv_ref": "#4"
    },
    "deadline_VV": "4 týdny od 2026-05-12"
  },
  "geometry": {
    "footprint_overall_mm": {"x": 28190, "y": 19740, "_source": "A102 střecha DXF"},
    "axes_x_mm_distances": [3170, 4000, 5000, 4000, 3170],
    "axes_x_labels": ["A", "B", "C", "D", "E", "F"],
    "axes_y_mm_distances": [6100, 6100, 3000, 6100, 6100],
    "axes_y_labels": ["1", "2", "3", "4", "5", "6"],
    "_confidence": 0.95
  },
  "areas": {
    "podlahova_plocha_m2": {"value": 495, "confidence": 1.0, "_source": "A101 DXF tabulka mistností + TZ D.1.1"},
    "zastavena_plocha_m2_range": [520, 541, "_abmv #7 — nekonzistence"],
    "obestaveny_prostor_m3_range": [2833, 3694, "_abmv #7"]
  },
  "heights": {
    "hreben_m": 7.195,
    "okap_jvsv_m": 6.285,
    "hloubka_zalozeni_pasy_m": -1.300,
    "hloubka_zalozeni_patky_m": -1.900,
    "hloubka_desky_m": -0.205,
    "strech_sklon_deg": 5.25,
    "_source": "A103 řezy + A102 + A105"
  },
  "konstrukce": {
    "nosny_system": "ocelová rámová montovaná konstrukce S235 ČSN EN 10025",
    "sloupy_ramove": {"profil": "IPE 400", "pocet_dxf": 30, "confidence": 0.95},
    "sloupy_stitove": {"profil": "HEA 200", "pocet_dxf": 10, "confidence": 0.90},
    "pricle_ramu": {"profil": "IPE 450", "pocet_dxf": 5, "spojeni": "šroubovaný náběh"},
    "vaznice_stresne": {"profil": "IPE 160", "rozteca_mm": 1500},
    "vaznice_krajni_OPEN": {"tz_b": "UPE 160", "a104_dxf": "C150×19,3", "_abmv_ref": "#15"},
    "stresne_ztuzidla": {"profil": "kruhové tyče Ø20 mm", "pocet_dxf": 7, "system": "ondřejské kříže"},
    "stenove_ztuzidla": {"profil": "L70/70/6", "umisteni": "kříže ve 2 polích na delších stranách"}
  },
  "zaklady": {
    "deska": {
      "tloustka_mm": 200,
      "beton_PLATI": "C25/30 XC4 (statika přebíjí ARS)",
      "_legenda_a101_uvadi": "C30/37-XC2",
      "_abmv_ref": "#5",
      "vyztuz": "KARI Ø8 oka 100×100 (oba povrchy)",
      "vyztuz_grade": "B500B",
      "kryti_mm": 30,
      "podklad_lozisko_mm": 250,
      "edef_2_mpa": 45,
      "edef_2_pomer": "< 1.75",
      "confidence": 0.95
    },
    "patky_ramove": {
      "rozmery_mm": "1500×1500×(2×600) dvoustupňové",
      "beton": "C16/20 XC0 prostý",
      "pocet_dxf": 14,
      "confidence": 0.95
    },
    "patky_stitove": {
      "rozmery_mm": "800×800×(200+600) dvoustupňové",
      "beton": "C16/20 XC0",
      "pocet_dxf": 10
    },
    "atypicky_zaklad_alternativa": {
      "pilota_prumer_mm": 800,
      "pilota_delka_m": 8.0,
      "beton": "C25/30 XC4",
      "vyztuz": "8× R25 B500B",
      "_podminka": "závisí na IGP",
      "_abmv_ref": "#11"
    },
    "unosnost_zeminy_kpa": 200
  },
  "otvory": {
    "okna": {
      "pocet": 21,
      "rozmer_mm": "1000×1000",
      "ramy": "plastové, šedá",
      "sklo": "izolační dvojsklo",
      "labels_dxf": "V1..V21",
      "confidence": 1.0
    },
    "vrata_OPEN": {
      "pocet": 4,
      "typ": "sekční výsuvná",
      "rozmer_dxf_mm": "3000×4000",
      "rozmer_tz_mm": "3500×4000",
      "_abmv_ref": "#2",
      "confidence": 0.7
    },
    "vnejsi_dvere": {
      "pocet": 2,
      "rozmer_mm": "1050×2100",
      "typ": "vnější jednoduché dvoukřídlé",
      "confidence": 1.0
    }
  },
  "fasada_strecha": {
    "obvodovy_plast": {
      "system_OPEN": "K-roc (min. vata, DP1) NEBO IPN (PIR, DP3)",
      "_abmv_ref": "#13",
      "_pbr_vyzaduje": "DP1",
      "_pracovni_volba": "KS FR K-roc 150 mm (min. vata)",
      "barva": "bílá KS NF 100 + modrá KS NF 100",
      "pozarna_klasifikace": "EW 15 DP1 (per PBŘ — viz ABMV #6)"
    },
    "strecha": {
      "krytina": "sendvičový panel s plechovým povrchem (titanzinek)",
      "_pracovni_volba": "KS FF K-roc 150 mm (alt. IPN RW 160 — viz ABMV #13)",
      "klasifikace": "BROOF(t3) + EI 15 DP1",
      "sklon_deg": 5.25
    },
    "sokl": "stěrka s výztužnou tkaninou + fasádní nátěr šedý"
  },
  "podlaha_OPEN": {
    "tz_uvadi": "stěrka",
    "_predpoklad": "epoxidová nebo PU stěrka (zatížení ≥ 1600 kg/m² + technologie)",
    "_abmv_ref": "#10",
    "confidence": 0.5
  },
  "odvodneni": {
    "svody_dest_OPEN": {
      "system": "Lindab Round Downpipe 150/100 Antique White",
      "pocet_dxf": 3,
      "tz_b_uvadi": 4,
      "_abmv_ref": "#14"
    },
    "stresne_vpusti": {"system": "Wavin Tegra", "pocet_dxf": 3},
    "liniovy_zlab": "MEA Mearin Plus 3000 NW300 (podél JZ + SZ fasády)",
    "retencni_nadrz_m3": 30
  },
  "tzb": {
    "vzt": {
      "jednotka": "venkovní rekuperační, reference Duplex 4500 flexi",
      "vykon_m3_h": 4000,
      "dvere_clony": {"pocet": 8, "vykon_m3_h_ks": 4700, "sirka_m": 2},
      "chlazeni_kw": 15
    },
    "ut": {
      "system": "plně elektrické",
      "salavé_panely_ECOSUN_Splus_12": {"vykon_ks_kw": 1.2, "pocet": 21, "celkem_kw": 25.2},
      "sahary_teplovzdusne": {"vykon_ks_kw": 9, "pocet": 4, "celkem_kw": 36},
      "celkem_topny_vykon_kw": 61.2,
      "tepelne_ztraty_kw": 15.4
    },
    "elektro_OPEN": {
      "p_inst_kw": 83,
      "p_vyp_kw": 60.5,
      "soudobost": 0.8,
      "hlavni_jistic": "3×100 A",
      "privodni_kabel": "CYKY-J 5×35 mm²",
      "rozvadec": "Typ 1 nástěnný oceloplechový (ČSN EN IEC 61439-2)",
      "_critical_abmv": "#1 — nepočítá s technologií strojů 80+ kW"
    },
    "zti": {
      "pripojka_voda": "PE 50",
      "vnitrni_potrubi": "PP-RCT EVO",
      "splaskova_kanalizace_DN": 160,
      "destova_kanalizace_DN": 200,
      "pozarni_voda_l_s": 0.3,
      "hydrant": "DN 25 s tvarově stálou hadicí",
      "umyvadlo_OPEN": {"pocet": 1, "rozmer_cm": "50×40", "_abmv_ref": "#9", "_source": "A101 DXF"}
    },
    "lps": {
      "norma": "ČSN EN 62305",
      "trida_lpz": ["LPZ 0A", "LPZ 0B", "LPZ 1"],
      "svody_pocet_min": 4,
      "svody_material": "FeZn pásek 30×4 mm nebo kulatina Ø10",
      "uzemneni": "FeZn 75 mm² v patkách",
      "max_odpor_ohm": 10
    }
  },
  "technologie": {
    "stroje": [
      {"id": "DRIFT_E1", "popis": "delaminator / separace skla z FV panelu", "vykon_kw": 80, "vyska_m": 3.5},
      {"id": "DEFRAME", "popis": "odstranění rámu z FV panelů"},
      {"id": "FILTRACE", "popis": "filtrační jednotka"}
    ],
    "bezpecnostni_oploceni_OPEN": {"_status": "BUDE UPŘESNĚNO", "_abmv_ref": "#8"},
    "externi_dokument_OPEN": {
      "kod": "2966-1",
      "nazev": "návrh dispozice strojů HK",
      "_source": "A104 DXF external reference",
      "_abmv_ref": "#16",
      "_status": "NEDODÁNO",
      "_leverage": "vysoká — řeší ABMV #1 + #3"
    },
    "_all_critical_abmv": ["#1", "#3", "#8", "#16"]
  },
  "pbr": {
    "pocet_pu": 1,
    "plocha_pu_m2": 495,
    "stupen_pb": "II",
    "pozarni_zatezeni_kg_m2": 90,
    "ekvivalentni_doba_pozaru_min": 48,
    "obvodovy_plast_pozarna": "EW 15 DP1",
    "stresny_plast_pozarna": "EI 15 DP1 + BROOF(t3)",
    "nosne_konstrukce_pozarna": "R 15 DP1",
    "hasici_pristroje": ["2× PHP práškový 27A", "2× PHP sněhový CO2 144B"],
    "pozarni_hydrant_DN": 25,
    "_source": "PBŘ č. 2025/60-034"
  },
  "vykopy": {
    "typy_dxf": ["A-VYKOP", "B-VYKOP", "C-VYKOP"],
    "sklon_svahu": "1:1",
    "krizeni_se_sitemi": [
      {"typ": "stávající splašková kanalizace", "dn": 300, "opatreni": "ručné výkopy + obetonování při křížení"},
      {"typ": "stávající dešťová kanalizace", "dn": 300, "opatreni": "ručné výkopy + obetonování"}
    ],
    "celkem_m3_tz": 32,
    "_source": "A201 DXF + TZ B kap. m.10.g"
  },
  "additional_elements": {
    "rampy_OPEN": {"pocet": 4, "_source": "A102 DXF (Rampa-... blocks)", "_predpoklad": "u vrat pro vjezd vozíky", "_not_in_tz": true}
  },
  "scope_estimate": {
    "total_items_min": 180,
    "total_items_max": 255,
    "by_kapitola": {
      "HSV_1_zemni": "25-35",
      "HSV_2_zaklady": "15-20",
      "HSV_3_ocelove_konstrukce": "25-35",
      "HSV_9_ostatni": "15-20",
      "PSV_71x_izolace": "10-15",
      "PSV_76x_dvere_vrata_okna": "10-15",
      "PSV_77x_podlahy": "5-10",
      "TZB_extended": "50-70",
      "M_konstrukce_anchorage": "5-10",
      "VRN_ZRN": "20-25"
    }
  }
}
PHJEOF

# --- outputs/abmv_email_queue.json ------------------------------------------
cat > "$DST/outputs/abmv_email_queue.json" << 'ABMVEOF'
{
  "_meta": {
    "schema_version": "1.0",
    "project": "hk212_hala",
    "generated_at": "2026-05-12",
    "total_items": 16,
    "critical_count": 4,
    "important_count": 9,
    "minor_count": 3,
    "status": "ready_for_send_pending_phase1_crosscheck",
    "addressees": [
      {"role": "ARS hlavní", "name": "Ing. arch. Jakub Volka", "email": "volkajakub@basepoint.cz"},
      {"role": "Statika", "name": "Ing. Jiří Plachý / Bc. M. Doležal", "email": "TBD"}
    ]
  },
  "items": [
    {
      "id": "ABMV_1",
      "category": "design_clarification",
      "severity": "critical",
      "status": "open",
      "title": "Energetická bilance vs. technologie strojů",
      "summary_cs": "TZ B uvádí Pvyp = 60,5 kW, jistič 3×100 A. Výkres A106 ukazuje stroje DRIFT_E1, DEFRAME, filtrační jednotka s příkonem cca 80 kW/stroj. Při souběhu provozu navržené dimenzování nestačí.",
      "blocks_vv": ["elektro VV", "rozvaděč VV", "přívodní kabel"],
      "addressee": ["Volka"]
    },
    {
      "id": "ABMV_2",
      "category": "design_clarification",
      "severity": "critical",
      "status": "open",
      "title": "Šířka sekčních vrat: 3000 vs 3500 mm",
      "summary_cs": "TZ B a TZ D.1.1 uvádí 4× sekční vrata 3500×4000 mm. DXF A101 obsahuje block 'M_Vrata_výsuvná_sekční - 3000X4000 MM'.",
      "blocks_vv": ["vrata VV", "klempířina kolem vrat"]
    },
    {
      "id": "ABMV_3",
      "category": "missing_specification",
      "severity": "critical",
      "status": "open",
      "title": "Technologická specifikace strojů (DRIFT, DEFRAME, FILTRACE)",
      "summary_cs": "A106/A107 zobrazují pracoviště + kotvící body, TZ je nepopisuje. Potřebujeme: výrobce/typ, hmotnost, požadované kotvy, přívody médií, zda dodávku zajistí investor.",
      "blocks_vv": ["anchorage VV", "rozšířené elektro", "lokální výztuž desky", "VRN"],
      "related": ["ABMV_16"]
    },
    {
      "id": "ABMV_4",
      "category": "documentation_metadata",
      "severity": "important",
      "status": "open",
      "title": "Stupeň PD — sjednocení DPS/DPZ/DSP",
      "summary_cs": "TZ A+B → DPS; výkresy ARS + TZ D.1.1 → DPZ; TZ statika D.1.2 → DSP. Předpokládáme překlep v TZ A+B (ARS = DPZ).",
      "working_assumption": "ARS = DPZ, statika = DSP"
    },
    {
      "id": "ABMV_5",
      "category": "documentation_conflict",
      "severity": "important",
      "status": "working_assumption",
      "title": "Třída betonu základové desky",
      "summary_cs": "Legenda A101 → C30/37-XC2. TZ B + TZ D.1.2 → C25/30 XC4. Statika má přednost.",
      "working_assumption": "C25/30 XC4"
    },
    {
      "id": "ABMV_6",
      "category": "documentation_conflict",
      "severity": "important",
      "status": "working_assumption",
      "title": "Požární odolnost obvodového pláště",
      "summary_cs": "TZ B str.4 → EW 15 DP3. A101 + PBŘ → EW 15 DP1. PBŘ má přednost.",
      "working_assumption": "EW 15 DP1"
    },
    {
      "id": "ABMV_7",
      "category": "documentation_conflict",
      "severity": "important",
      "status": "open",
      "title": "Nekonzistentní plochy a kubatura",
      "summary_cs": "Zastavěná plocha: A=540,10; B=520; D.1.1=541 m². Podlahová: A=495; B=507; D.1.1=495 m². Obestavěný prostor: A=3694,62; B=2833; D.1.1=3404 m³.",
      "working_assumption": "podlahová 495 m² (DXF + 2 ze 3 zdrojů), zbytek čeká"
    },
    {
      "id": "ABMV_8",
      "category": "missing_specification",
      "severity": "important",
      "status": "open",
      "title": "Bezpečnostní oplocení strojů",
      "summary_cs": "A106 uvádí 'BUDE UPŘESNĚNO'. Pro VV potřebujeme typ (Troax/Axelent/Brück), výšku, délku, umístění."
    },
    {
      "id": "ABMV_9",
      "category": "missing_specification",
      "severity": "important",
      "status": "open",
      "title": "Umyvadlo v hale — ZTI vnitřní",
      "summary_cs": "A101 obsahuje umyvadlo 50×40 cm. TZ B §B.3.1 → zázemí v sousední hale. Bude ZTI vnitřní (přívody SV + napojení splaškové)?"
    },
    {
      "id": "ABMV_10",
      "category": "missing_specification",
      "severity": "important",
      "status": "working_assumption",
      "title": "Typ podlahy 'stěrka'",
      "summary_cs": "Při zatížení ≥ 1600 kg/m² + technologie předpokládáme epoxidovou nebo PU stěrku.",
      "working_assumption": "epoxidová nebo PU stěrka 3-5 mm"
    },
    {
      "id": "ABMV_11",
      "category": "missing_input",
      "severity": "important",
      "status": "blocking",
      "title": "IGP — kdy bude k dispozici",
      "summary_cs": "Závisí varianta fundamentu (patky vs pilota 800/8000). Bez IGP nelze finalizovat zemní práce + fundament VV."
    },
    {
      "id": "ABMV_12",
      "category": "missing_input",
      "severity": "important",
      "status": "open",
      "title": "TZB profesní PD (D.1.4)",
      "summary_cs": "VZT, ÚT, EL, ZTI pouze koncepčně v TZ B. Budou samostatné výkresy a tabulky?"
    },
    {
      "id": "ABMV_13",
      "category": "documentation_conflict",
      "severity": "important",
      "status": "working_assumption",
      "title": "Kingspan systém: K-roc vs IPN",
      "summary_cs": "A102 uvádí KS FR/FF K-roc (minerální vata, DP1) + KS NF/RW IPN (PIR pěna, DP3) jako alternativy. PBŘ vyžaduje DP1.",
      "working_assumption": "K-roc s minerální vatou (DP1 satisfies PBŘ)"
    },
    {
      "id": "ABMV_14",
      "category": "minor",
      "severity": "minor",
      "status": "working_assumption",
      "title": "Počet svodů dešťové vody: 3 vs 4",
      "summary_cs": "TZ B → 4 svody DN100. A101+A105 ukazují 3 Lindab Round Downpipe + 3 Wavin vpusti.",
      "working_assumption": "3 (DXF má přednost)"
    },
    {
      "id": "ABMV_15",
      "category": "minor",
      "severity": "minor",
      "status": "open",
      "title": "Krajní vaznice: C150×19,3 vs UPE160",
      "summary_cs": "TZ B → UPE160 S235. A104 DXF → C150×19,3 S235."
    },
    {
      "id": "ABMV_16",
      "category": "missing_input",
      "severity": "critical",
      "status": "open",
      "title": "Externí dokument '2966-1 návrh dispozice strojů HK'",
      "summary_cs": "A104 DXF obsahuje external reference '2966-1_navrh dispozice stroju-HK_dwg'. Dokument není v inputs. Jeho dodání by uzavřelo ABMV #1 + #3 najednou.",
      "related": ["ABMV_1", "ABMV_3"],
      "leverage": "high"
    }
  ]
}
ABMVEOF

# --- handoff/session_handoff_2026-05-12.md ----------------------------------
cat > "$DST/handoff/session_handoff_2026-05-12.md" << 'HOEOF'
# Session Handoff — 2026-05-12

**Phase:** Setup + DXF audit (před Phase 0a)
**Branch:** main (před commit)
**Status:** Setup completed via setup_hk212_hala.sh

## Co bylo uděláno

1. Načteno 16 souborů z _UNSORTED (TZ + výkresy + PBŘ + situace)
2. Auditován každý dostupný DXF (A101, A102, A104, A105, A106, A107, A201)
3. Identifikováno 16 ABMV items (4 kritické, 9 důležitých, 3 drobné)
4. Project header s confidence-tagged facts uložen do inputs/meta/project_header.json
5. ABMV queue uložen do outputs/abmv_email_queue.json
6. ABMV e-mail draft (2 verze — formální + stručná) připraven, čeká na odeslání po Phase 1 cross-check

## Pracovní interpretace (working_assumption) — co bylo aplikováno

- ARS = DPZ, statika = DSP (ABMV #4)
- Beton desky = C25/30 XC4 (ABMV #5 — statika přebíjí ARS)
- EW 15 DP1 (ABMV #6 — PBŘ přebíjí TZ B)
- Vrata typ = sekční (ABMV #4 původní, vyřešeno DXF block name)
- Kingspan = K-roc s minerální vatou (ABMV #13 — PBŘ vyžaduje DP1)
- 3 svody dešťové vody (ABMV #14 — DXF přebíjí TZ)
- Podlaha = epoxidová nebo PU stěrka (ABMV #10)
- Podlahová plocha = 495 m² (ABMV #7 částečně — pouze podlaha potvrzena)

## Otevřené blokující

- ABMV #1 — energetická bilance (kritické pro elektro VV)
- ABMV #2 — šířka vrat 3000 vs 3500 (kritické pro klempířinu)
- ABMV #3 — technologická specifikace strojů (kritické)
- ABMV #11 — IGP termín (blokuje zemní práce + fundament finalizaci)
- ABMV #16 — externí dokument 2966-1 (řešil by #1 + #3)

## Next session

1. Phase 0a — Foundation Extraction skutečná (parsing DXF + Tabulka místností z A101)
2. Cross-check VV vs DXF (může najít další nesoulady → update ABMV queue před odesláním e-mailu)
3. Po Phase 0a validation gate → rozhodnutí o odeslání ABMV e-mailu
4. Phase 1 Generator s úspěšnou foundation
HOEOF

# --- ABMV e-mail draft (do handoff/) ----------------------------------------
cat > "$DST/handoff/abmv_email_draft.md" << 'EMAILEOF'
# ABMV e-mail draft — Hala HK (akce 212)

**STATUS:** připraveno k odeslání **po Phase 1 cross-check** (nemusí přibyt další nesoulady)

**Adresáti:**
- To: volkajakub@basepoint.cz (Ing. arch. Jakub Volka)
- Cc: TBD — Ing. Jiří Plachý (statika); Bc. Martin Doležal (+420 606 287 393)

**Předmět:** Hala Hradec Králové (akce 212) — žádost o vyjasnění před zpracováním výkazu výměr a rozpočtu

---

## Verze A — formální (12 bodů, plný rozsah)

Vážený pane inženýre arch. Volko,
vážený pane inženýre Plachý,

při přípravě výkazu výměr a rozpočtu pro stavbu „Hala Hradec Králové" (akce 212, par. č. 1939/1, k.ú. Slezské předměstí) jsme při křížové analýze dokumentace narazili na několik míst, která vyžadují vaše potvrzení či upřesnění. Žádáme vás laskavě o vyjádření k následujícím bodům:

── KRITICKÉ (ovlivňují dimenzování instalací) ──

**1) ENERGETICKÁ BILANCE VS. TECHNOLOGIE**
TZ B (§3.1 Elektroinstalace) uvádí P_inst = 83 kW, výpočtový příkon 60,5 kW, hlavní jistič 3×100 A, přívodní kabel CYKY-J 5×35 mm². Výkres A106 (Půdorys 1NP — stroje) však ukazuje pracoviště s technologií (DRIFT_E1, DEFRAME, filtrační jednotka) s údajem „příkon stroje cca 80 kW" na jeden stroj. Pokud jsou obě technologie provozovány současně, předpokládaný výpočtový příkon objektu přesahuje 140 kW a navržený jistič 3×100 A i přívodní kabel jsou nedostatečné.
→ Prosíme o potvrzení režimu provozu technologií (současný / střídavý) a, popřípadě, o aktualizaci energetické bilance v TZ B.

**2) TECHNOLOGICKÁ SPECIFIKACE STROJŮ**
Výkresy A106 a A107 zobrazují pracoviště DRIFT_E1 a DEFRAME vč. kotvících bodů, technická zpráva je však nepopisuje. Pro správný návrh položek (kotvení v podlaze, lokální výztuž desky, přívody médií, bezpečnostní oplocení) potřebujeme:
- výrobce a typ strojů (DRIFT, DEFRAME, filtrační jednotka),
- hmotnost a požadované kotvy (M16 / M20 / chemkotva atd.),
- spotřebu médií (stlačený vzduch, voda, odtažený vzduch),
- zda dodávku strojů zajišťuje investor (vynětí z rozpočtu stavby).

V DXF výkresu A104 jsme nalezli externí referenci na dokument „2966-1 návrh dispozice strojů HK". Pokud by bylo možné tento dokument poskytnout, vyřešilo by se mnoho otevřených bodů najednou.

**3) BEZPEČNOSTNÍ OPLOCENÍ**
Výkres A106 uvádí „BEZPEČNOSTNÍ OPLOCENÍ — BUDE UPŘESNĚNO". Pro zavedení do rozpočtu potřebujeme typ (rozebíratelné pletivo, systémové ploty Troax / Axelent / Brück), výšku, délku a umístění.

── ROZDÍLY MEZI ČÁSTMI DOKUMENTACE ──

**4) STUPEŇ DOKUMENTACE**
Titulky TZ A a TZ B (architektura, Basepoint) uvádějí „DPS", výkresová část ARS a TZ D.1.1 uvádějí „DPZ", TZ statiky (D.1.2, Plachý — značka 6/2025) uvádí „DSP". Předpokládáme, že jde o překlep v hlavičkách TZ A/B (reálne ARS = DPZ, statika = DSP). Prosíme o potvrzení sjednocení.

**5) TŘÍDA BETONU ZÁKLADOVÉ DESKY**
Legenda výkresu A101 uvádí pro základovou desku C30/37-XC2. TZ B (statický posudek) i TZ D.1.2 statiky uvádějí C25/30 XC4. Předpokládáme, že platí varianta statika — C25/30 XC4 — a legenda A101 obsahuje chybu. Prosíme o potvrzení.

**6) POŽÁRNÍ ODOLNOST OBVODOVÉHO PLÁŠTĚ**
TZ B (str. 4) uvádí „EW 15 DP3", leg. A101 uvádí „EW 15 DP1", PBŘ (č. 2025/60-034) potvrzuje DP1. Předpokládáme platnost DP1 dle PBŘ. Prosíme o potvrzení.

**7) ŠÍŘKA VRAT**
TZ B (§B.3.5) a TZ D.1.1 uvádějí 4× sekční vrata 3500×4000 mm. DXF výkresu A101 však obsahuje bloky „M_Vrata_výsuvná_sekční — 3000×4000 mm" (šířka 3000, ne 3500). Prosíme o určení platného rozměru.

**13) MATERIÁL KINGSPAN PANELŮ**
Výkres A102 uvádí dvě alternativy: „KS FR/FF K-roc 150 mm" (s minerální vatou, DP1) a „IPN KS NF/RW 120/160 mm" (s PIR pěnou, DP3). PBŘ však vyžaduje DP1. Předpokládáme tedy platnost varianty K-roc. Prosíme o potvrzení.

── TECHNICKO-EKONOMICKÉ ATRIBUTY ──

**8) NEKONZISTENTNÍ PLOCHY A KUBATURA**
Mezi dokumenty se rozcházejí plošné údaje:
- zastavěná plocha: A = 540,10 m² ; B = 520 m² ; D.1.1 = 541 m²,
- podlahová plocha: A = 495 m² ; B = 507 m² ; D.1.1 = 495 m²,
- obestavěný prostor: A = 3 694,62 m³ ; B = 2 833 m³ ; D.1.1 = 3 404 m³.

Prosíme o jednu finální verzi TEA pro rozpočet.

── UPŘESNĚNÍ MATERIÁLU A SKLADEB ──

**9) TYP PODLAHY**
TZ B i tabulka místností A101 uvádějí „stěrka". S ohledem na zatížení ≥ 1600 kg/m² a technologii v hale předpokládáme epoxidovou nebo polyuretanovou stěrku, nikoliv pouze finalizační cementovou. Prosíme o specifikaci systému (název produktu, tloušťka, povrchová úprava — protiskluz, anti-static, chemická odolnost).

**10) UMYVADLO V HALE — ZTI VNITŘNÍ**
Výkres A101 obsahuje blok „Umyvadlo 50×40 cm". TZ B však v §B.3.1 uvádí, že zázemí (soc. zařízení) je v sousední hale. Bude v této hale instalováno umyvadlo s přívodem studené vody a napojením na splaškovou kanalizaci? Pokud ano, prosíme o doplnění výkresů ZTI.

── CHYBĚJÍCÍ PODKLADY ──

**11) INŽENÝRSKO-GEOLOGICKÝ PRŮZKUM (IGP)**
TZ D.1.1 a TZ D.1.2 uvazují s eventuální výměnou atypického základu za pilotu Ø 800 / délka 8,0 m podle výsledků IGP. Kdy lze očekávat závěrečnou zprávu IGP?

**12) DOKUMENTACE TZB (VZT, ÚT, EL, ZTI)**
Profesní TZB části jsou popsány pouze v TZ B koncepčně. Budou samostatné části D.1.4 vč. výkresů a tabulek? Pokud ano, kdy budou dodány?

── DROBNÉ ──

**14) POČET SVODŮ DEŠŤOVÉ VODY**
TZ B uvádí 4 svody DN100. Výkresy A101 + A105 zobrazují 3 svody Lindab Round Downpipe 150/100 + 3 Wavin Tegra střešní vpusti.

**15) KRAJNÍ VAZNICE**
TZ B uvádí profil UPE 160. DXF A104 zobrazuje C150×19,3.

────────────────────

Pro hladké pokračování prací na rozpočtu bychom uvítali vaše vyjádření do 5 pracovních dnů. Body 1–3, 7 a 13 považujeme za kritické, ostatní za důležité, ale ne blokující.

Děkujeme za součinnost a jsme k dispozici pro případné osobní nebo telefonické konzultace.

S pozdravem,
[Jméno]
STAVAGENT — příprava rozpočtů
[telefon] | [e-mail]

---

## Verze B — stručná (3 kritické + zbytek krátce)

[Stručná verze viz drift bodů 1-3 + krátký seznam zbytek — viz výše v Verzi A]
EMAILEOF

echo ""
echo "✅ Setup completed."
echo ""
echo "📁 Struktura:"
find "$DST" -type d | sort | sed 's|^|   |'
echo ""
echo "📄 Soubory v inputs/meta/:"
ls -la "$DST/inputs/meta/" | tail -n +2
echo ""
echo "📄 Soubory v outputs/:"
ls -la "$DST/outputs/" | tail -n +2
echo ""
echo "📄 Soubory v handoff/:"
ls -la "$DST/handoff/" | tail -n +2
echo ""
echo "─────────────────────────────────────────────────────"
echo "DALŠÍ KROK:"
echo "  git status            # zkontrolovat změny"
echo "  git add ."
echo "  git commit -m 'setup(hk212): project structure + DXF audit + 16 ABMV items'"
echo "─────────────────────────────────────────────────────"
