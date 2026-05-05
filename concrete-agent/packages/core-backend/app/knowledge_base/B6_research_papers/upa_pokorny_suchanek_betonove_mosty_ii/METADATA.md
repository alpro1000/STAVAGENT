---
title: "Betonové mosty II"
title_cz: "Betonové mosty II"
title_en: "Concrete Bridges II"
authors:
  - "Pokorný, Jiří (doc. Ing., CSc.)"
  - "Suchánek, Vladimír (Ing.)"
year_published: 2010
edition: "1"
publisher: "Univerzita Pardubice, Dopravní fakulta Jana Pernera"
isbn_or_code: null
language: cs
pages_total: 150
license:
  type: "academic_university_skripta"
  url: "https://dfjp.upce.cz/"
  notes: "Univerzitní skriptum DFJP UPa. Pro interní použití STAVAGENT — extrakce strukturovaných dat (vzorce, tabulky, klasifikace) jako reference."
priority: 2  # 1=primární, 5=pomocný; tento je sekundární k normám ČSN/Eurokód, ale primární pro klasifikaci typů mostů a technologií výstavby
topics:
  - bridge_classification
  - bridge_static_systems
  - slab_bridges
  - girder_bridges
  - frame_bridges
  - beam_grid
  - arch_bridges
  - prestressing_systems
  - anchorage_zone
  - prestress_losses
  - construction_technology_falsework
  - construction_technology_incremental_launching
  - construction_technology_balanced_cantilever
  - construction_technology_precast_segments
  - bridge_terminology_glossary

applies_to_elements:
  # Mapování na element types v STAVAGENT calculator (9 mostovních typů)
  - BR_DECK_SLAB           # mostní deska — kapitola 2 (Deskové mosty)
  - BR_GIRDER_T            # nosníky T průřezu — kapitola 3
  - BR_BOX_GIRDER          # komorový průřez — kapitoly 3, 17
  - BR_FRAME               # rámové mosty — kapitola 4
  - BR_BEAM_GRID           # nosníkový rošt — kapitola 5
  - BR_ARCH                # obloukové mosty — kapitola 6
  - BR_PIER                # opěry, pilíře — kapitola 6e
  - BR_BEARING_BLOCK       # úložný práh — terminologie
  - BR_PRESTRESS_GENERIC   # předpětí (kapitoly 7-12, 20-21)

applies_to_formwork_systems:
  # Texts mention specific systems — link to formwork catalog
  - DOKA_BEDNENI           # zmíněn explicitně str. 95
  - PERI                   # zmíněn explicitně str. 95
  - HUNNEBECK              # zmíněn explicitně str. 95
  - PEINER                 # zmíněn explicitně str. 95
  - PIZMO_STOJKY_IP        # ocelové inventární podpěry
  - MSS_MSSU               # posuvná skruž MSSU — explicitně použito v ČR (R 3509)
  - BINDER_MSS             # posuvná skruž Binder
  - POLENSKY_ZOLLNER       # posuvná skruž Polensky-Zöllner

applies_to_prestressing_systems:
  - DYWIDAG_LANO           # tyčový + lanový
  - VSL                    # vícelanový
  - FREYSSINET             # klínový systém
  - SKANSKA_DS
  - BBR
  - CCL
  - TENSACCIACI
  - MONOS
  - SOLO
  - FIRESTA

relevance_for_stavagent: |
  Primární zdroj pro klasifikaci typů mostů (deskové/trámové/rámové/oblouk/rošt) 
  a klasifikaci technologií výstavby (pevná skruž / posuvná skruž / výsuvná skruž / 
  vysouvané / otáčené / letmá betonáž / segmentové prefab). Klíčový vstup pro:
    1. Bridge classifier (22 element types — 9 mostovních) — určení správného typu z TZ
    2. Mostovka subtypes mapping (předpjatý/železobetonový × mostovní technologie)
    3. Element-scheduler — vazba mostní technologie na produktivitu a formwork systém
    4. Formwork engine — která mostní technologie vyžaduje který typ skruže/bednění
    5. Prestress engine — předem předpjatý vs dodatečně předpjatý vs vnější předpětí
  Mostní technologie z této knihy jsou kanonické pro CZ trh. Skruže a kabely jsou 
  konzistentní s českou inženýrskou praxí (rozdíl od německé nebo ruské tradice).

known_conflicts_with:
  # Známé konflikty s normami/jinými zdroji v repo
  - "csn_73_6207": "Norma ČSN 73 6207 byla nahrazena. Skripta uvádí staré + nové ČSN EN 1992-2 (str. 67-69)"
  - "csn_en_206": "Krytí výztuže — skripta cituje Eurokód, ale primární zdroj je ČSN EN 206 (str. 69)"

warnings:
  - "Skriptum z roku 2010 — některé citované normy nahrazené (ČSN 73 6207). Hodnoty jsou referenční, finální zdroj je platná ČSN/EC2."
  - "Hodnoty optimálních tlouštěk (1/N × L) jsou orientační pro předběžný návrh, nikoliv pro kontrolní výpočet."
  - "Některé předpínací systémy (KA-67, KA-73, I-67, I-73) jsou historické (do r. 1990) a v aktuálních projektech se nevyskytují."
---

# Betonové mosty II — STAVAGENT notes

## Co tento zdroj pokrývá

Univerzitní skriptum (UPa DFJP, 2010) zaměřené na konstrukčně-dopravní obor.
Pokrývá **kompletně** českou praxi navrhování betonových mostů:

1. **Klasifikace mostů** (kap. 1): rozlišení most/propustek (světlost 2.0 m), vrchní vs spodní stavba
2. **5 hlavních typů nosných konstrukcí** (kap. 2-6): deskové, trámové, rámové, nosníkový rošt, obloukové
3. **Předpínací systémy** (kap. 7-12): předem/dodatečně/vnější předpětí, kotvy, kotevní oblast, ztráty
4. **Moderní technologie výstavby** (kap. 13-19): skruže, vysouvání, otáčení, letmá betonáž, segmenty
5. **Statické metody** (kap. 20-21): konkordantní kabely, třímomentová rovnice
6. **Anglicko-český slovník** (kap. 22): cca 80 termínů

## Klíčové kapitoly pro STAVAGENT

| Kap. | Název | Strany | Priorita STAVAGENT | Relevance |
|------|-------|--------|--------------------|-----------|
| 1 | Rozdělení mostů | 12-15 | 🔥 P0 | Bridge classifier — typy + faktory volby |
| 2 | Deskové mosty | 16-18 | 🔥 P0 | BR_DECK_SLAB — tlouštky, příčné řezy |
| 3 | Trámové mosty | 19-24 | 🔥 P0 | BR_GIRDER_T, BR_BOX_GIRDER — rozpony, t/L poměry |
| 4 | Rámové mosty | 25-37 | 🟡 P1 | BR_FRAME — tlouštky, statické soustavy |
| 5 | Nosníkový rošt | 38-40 | 🟢 P2 | BR_BEAM_GRID — řešení s tuhým příčníkem |
| 6 | Obloukové mosty | 41-60 | 🟡 P1 | BR_ARCH — opěry, výztuž, štíhlost, vzepětí |
| 7-9 | Předpínací systémy + kotvy | 61-77 | 🔥 P0 | Prestress subtypes + anchor catalog |
| 10 | DYWIDAG | 78-81 | 🟡 P1 | Konkrétní systém + tabulky předpínacích sil |
| 11 | Kotevní oblast | 82-90 | 🟢 P2 | Pouze pro statika, ne sметčíka |
| 12 | Změny předpětí (ztráty) | 91-92 | 🟢 P2 | Statika — ztráty okamžité a dlouhodobé |
| 13 | Moderní technologie — přehled | 93-94 | 🔥 P0 | Klasifikace technologií výstavby |
| 14 | Výstavba na skružích | 95-100 | 🔥 P0 | Pevná vs posuvná skruž → formwork engine |
| 15 | Vysouvané konstrukce | 101-104 | 🔥 P0 | Incremental launching (ILM) |
| 16 | Otáčené konstrukce | 105 | 🟢 P2 | Vzácná technologie |
| 17 | Letmá betonáž | 106-112 | 🔥 P0 | Balanced cantilever — segmenty 3-5 m |
| 18 | Prefabrikované konstrukce | 113-118 | 🔥 P0 | Segmenty 2.5-4 m, dlouhá vs krátká dráha |
| 19 | Spojité konstrukce | 119-129 | 🟢 P2 | Statika |
| 20-21 | Konkordantní kabely + 3-moment | 130-140 | 🟢 P2 | Statika |
| 22 | Anglicko-český slovník | 141-143 | 🟡 P1 | Pro multi-language UI / parser |

## Vztah k jiným zdrojům v repo

- **Doplňuje:**
  - `B7_regulations/csn_en_1992_2/` — Eurokód 2 část 2 (mosty) — skriptum dává praktický kontext
  - `B7_regulations/tkp_18_rsd/` — TKP 18 — skriptum pokrývá aspekty, které TKP nepokrývá (statika, klasifikace)
  - `B5_tech_cards/formwork_vendor/doka_*` — skriptum uvádí, kde se který systém používá
- **Nahrazuje (legacy):**
  - žádné — ČVUT skripta Hrdoušek-Kukaň zůstávají primární referencí pro hloubkový design
- **Konfliktní:**
  - `csn_73_6207` — viz `B9_validation/conflicts/csn_73_6207_vs_ec2_part2.yaml` (ČSN 73 6207 byla nahrazena ČSN EN 1992-2)

## Jak použít v calculator pipeline

```
TZ Document → Document Parser → text "most přes Vltavu, rozpětí 145 m, dodatečně předpjatý komorový"
     ↓
Bridge Classifier (uses INDEX.yaml from this KB)
     ↓
Match: BR_BOX_GIRDER (komorový) + post_tensioned (dodatečně předpjatý) + L=145m
     ↓
Lookup in extracted/ch03_typy_mostu.yaml: 
     - L=145m → komorový nosník je optimální (rozpětí 40-300 m)
     - tloušťka stěny: L/3 až L/10 = 14.5-48 m? → ne, to je tlouštka stěny u svislých stěn
     - tloušťka deska mostovky: L/12 až L/30 = 4.83-12.1 m
     ↓
Lookup in extracted/ch13_19_technologie.yaml:
     - L=145m + komorový → kandidáti: letmá betonáž (L>200m hraniční), MSS, vysouvání 
     - rozhodující: výška nad terénem, přístupnost
     ↓
Output: classification + engineering hints + technology candidates
```
