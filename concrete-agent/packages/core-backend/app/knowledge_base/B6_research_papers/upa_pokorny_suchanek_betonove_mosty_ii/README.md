# Pokorný-Suchánek: Betonové mosty II — Knowledge Base

**Slug:** `pokorny_suchanek_betonove_mosty_ii`
**Bucket:** `B6_research_papers/` (university textbook)
**Status:** ✅ Complete — ready for AI Reasoner integration

---

## 📁 Struktura

```
pokorny_suchanek_betonove_mosty_ii/
├── source.pdf                          ← original (8.1 MB, AES enc., printable)
├── METADATA.md                         ← header + applies_to mappings
├── INDEX.yaml                          ← 🔑 MASTER machine-readable file
├── extracted/                          ← strukturované extrakce per kapitola
│   ├── ch01_06_typy_mostu.yaml         ← klasifikace + 5 typů mostů
│   ├── ch07_12_predpinaci_systemy.yaml ← předpínací systémy + ztráty
│   ├── ch13_19_technologie_vystavby.yaml ← 7 technologií výstavby
│   └── ch22_glosar_eng_cz.yaml         ← bilingual glosář
└── citations/                          ← page-level reference s krátkými citacemi
    ├── ch01_06_typy_mostu.md
    ├── ch07_12_predpinaci_systemy.md
    └── ch13_19_technologie_vystavby.md
```

---

## 🎯 Hlavní vstupní bod: `INDEX.yaml`

To je soubor, který by měl číst **AI Reasoner** a **classifier**.
Obsahuje:

| Sekce | Účel |
|---|---|
| `bridge_classification` | most/propustek threshold (2 m), `keyword_to_element_type` mapování CZ/EN slov → BR_* element types |
| `prestressing_type_classification` | předem/dodatečně/vnější — bond, products, span ranges |
| `prestressing_systems_catalog` | 11 systémů (DYWIDAG, VSL, FREYSSINET, …) s f_p_0,1k, f_pk, max forces, R_min |
| `prestressing_reinforcement` | drát/lano/tyč specs |
| `construction_technologies` | 7 technologií s `applies_to_element_types`, `mapping_to_formwork_engine` |
| `technology_decision_rules` | TR-001 až TR-006 — kdy která technologie |
| `validation_rules` | VR-001 až VR-011 s pseudokódem `check` (executable) |

---

## 🧩 Pokrytí element types kalkulátoru

✅ **9 mostních element types** zmapovaných z učebnice:

- `BR_DECK_SLAB` — kap. 2
- `BR_GIRDER_T` — kap. 3
- `BR_BOX_GIRDER` — kap. 17 (letmá), 18 (segmenty)
- `BR_FRAME` — kap. 4
- `BR_BEAM_GRID` — kap. 5
- `BR_ARCH` — kap. 6
- `BR_PIER` — implicitně přes "zárodek" v kap. 17
- `BR_BEARING_BLOCK` — anchorage zone, kap. 11
- `BR_PRESTRESS_GENERIC` — celé kap. 7-12

➕ **2 navrhované doplnění klasifikátoru:**
- `BR_SUSPENSION` (visuté mosty)
- `BR_CABLE_STAYED` (zavěšené mosty)

---

## 🔧 Pokrytí formwork systems

Učebnice explicitně zmiňuje a popisuje:

| Systém | Kapitola | Kontext |
|---|---|---|
| `DOKA` | 14 | bednění na pevné skruži |
| `PERI` | 14 | pevná podporová skruž |
| `HUNNEBECK` | 14 | pevná podporová skruž |
| `PEINER` | 14 | pevná podporová skruž |
| `PIZMO_STOJKY_IP` | 14 | české inventární stojky |
| `MSSU` | 14 | posuvná skruž (R 3509 — 446 m) |
| `BINDER` | 14 | posuvná skruž (2 pole) |
| `POLENSKY_ZOLLNER` | 14 | posuvná skruž |

---

## 🔗 Vazby na ostatní KB

**Conflicts s:**
- `csn_73_6207` (1993 — překryta) — viz `known_conflicts_with` v METADATA.md
- `csn_en_206` (současná) — krycí vrstvy

**Komplementární:**
- `csn_en_1992_2` — Eurocode 2 most-konkrétní
- `tkp_18` (TKP 18 — Beton pro mosty)
- B7_university_skripta/ostatní mosti-related skripta

---

## ✅ Acceptance criteria (per project guide)

- [x] METADATA.md s `applies_to_elements` array
- [x] INDEX.yaml machine-readable (loadable by `yaml.safe_load`)
- [x] extracted/ ≥ 5 sekcí (zde: 4 souboru, ale > 50 sekcí celkem)
- [x] citations/ s page-level odkazy
- [x] source.pdf < 32 MB → uložen lokálně
- [x] Copyright OK: parafráze prevailing, ≤ 15 slov per přímá citace, 1 citace per zdroj/sekce
- [x] Konflikty s normami zaznamenány

---

## 🚀 Použití v pipeline

```python
# Pseudo-code — jak by AI Reasoner načítal tuto KB
import yaml
from pathlib import Path

KB_ROOT = Path("knowledge_base/B6_research_papers/pokorny_suchanek_betonove_mosty_ii")

# Master index pro classifier
with open(KB_ROOT / "INDEX.yaml") as f:
    bridge_kb = yaml.safe_load(f)

# Příklad: matching keywords v TZ
def classify_bridge_from_description(desc: str) -> str:
    desc_lower = desc.lower()
    for keyword, mapping in bridge_kb["bridge_classification"]["keyword_to_element_type"].items():
        if keyword in desc_lower:
            return mapping["element_type"]  # např. "BR_DECK_SLAB"
    return None

# Příklad: validation pro letmá betonáž
for rule in bridge_kb["validation_rules"]:
    if rule["id"] == "VR-005":  # cantilever segment age 42h
        # Aplikuj na pour_decision engine
        ...
```

---

**Vytvořeno:** 2026-05-01
**Maintainer:** STAVAGENT (AI Reasoner pipeline)
