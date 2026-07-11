# tz-passport half-B — Gate 0 audit (extraction infra, read-only)

> **Datum:** 2026-07-11 · **Status:** audit hotov, čeká B-INTERVIEW (Q2/Q3 + upřesnění)
> **Cíl half-B:** dokumenty (TZ PDF + výkresy + soupis XLSX) → `BridgePassport` JSON
> (single-source `app/models/bridge_passport.py`), který half-A už konzumuje
> (živě ověřeno 2026-07-11: +51 % aggregate catch na SO-202).

---

## 1. Co EXISTUJE (ingredience jsou, chybí emitor)

| Oblast | Stav | Poznámka |
|---|---|---|
| **Stage 1 TZ text** — `extract_tz_fields` | ✅ existuje | `{object, elements}` recipe-shape; Gate 3 geometrie (spans, nk_height/width, structural categoricals) deterministicky ze signed-sections; per-element `concrete_class` binding |
| **Stage 3 soupis** — parsery + join | ✅ existuje | `parse_construction_budget` → items; `map_soupis_to_elements` sumuje m³ per element_type s honest-blank + geometry cross-check |
| **Stage 2 výkresy** — vision gate | ✅ částečně | `validate_drawing_element` (P39/40): vision HOST-side, server = deterministický grounding gate. Bez cesty pro POZNÁMKY |
| **UEP** | ✅ existuje | DXF/PDF/DWG/IFC/XML → flat facts; není element-keyed, není passport writer |
| **Assembly seam** | ✅ existuje | `recipe_runner._quantify_from_documents` — TZ+soupis join per SO; emituje FLAT elements[], ne passport |
| **Emitor `BridgePassport`** | ❌ greenfield | Existuje JEN konzument (`passport_plan.py`); writer není |

## 2. Klíčové GAPy (co se musí postavit)

1. **Slovníková mapa klíčů:** classifier vocab (CZ: `mostovkova_deska`, `driky_piliru`, …) ↔ passport vocab (EN: `superstructure_deck`, `pier_shafts`, `foundations_piers`, …). Mapa dnes existuje JEDNOSMĚRNĚ v TS (`ELEMENT_RULES` v bridge-passport.ts). → povýšit na sdílená DATA (YAML → generované TS+Py, vzor element_types.yaml), tři konzumenti: assembler (B), mapper (A), budoucí UI.
2. **Concretes use-keyed tabulka:** stage 1 dnes binduje třídu na volný český název elementu, ne na `use` klíč.
3. **Quantities nad rámec m³:** `rebar_mass_kg` (t/kg), `prestress_strand_mass_kg`, `height_m`, `length_bm` — join dnes umí jen m³.
4. **Calculable-critical trio NEMÁ extrakční cestu:** `construction_process.{deck_pour_stages, deck_pour_stages_source, falsework_technology}` — poznámka «V 3 TAKTECH NA SKRUŽI» žije JAKO OBRAZ na výkrese 202/17; `DrawingNote` regex-cesta ji nespolehlivě nevidí a nestrukturuje. = jádro stage 2.
5. **Per-deck geometrie + post_tensioning:** drawing-side, dnes nikde.
6. **Store:** `passport_store` je type-locked na `ProjectPassport` (doc-analysis koncept!) — half-B potřebuje vlastní bridge-passport-typed store / schema-tagged cestu.

## 3. Nálezy mimo plán (zaznamenat / opravit)

- 🐛 **`budget.py` rozbité routing na dedikované parsery:** importuje `parse_komplet`/`parse_rts_rozpocet` (neexistují — reálná jména `parse_xlsx_komplet`/`parse_xlsx_rtsrozp`) → ImportError; fallback volá `UniversalParser().parse_file` (neexistuje — reálné `parse_any`). Soupisy s `komplet`/`rts` v názvu PADAJÍ; golden `E_Soupis…MOSTY_PHS.xlsx` funguje jen proto, že matchne `soupis` → generic ExcelParser. **V kritické cestě stage 3** → opravit v prvním B-gate.
- 📄 **Docs-truth:** docstring `extract_tz_fields` tvrdí «existing Vertex routing» — `_LLM` seam je ve skutečnosti default `None`, v produkci NIKDY LLM (jen test monkeypatch). Opravit docstring, nebo seam skutečně zapojit (interview Q3a).
- ⚠️ **Dva/tři „passport" koncepty + dvě `QuantityItem` třídy** (`passport_schema.py:176` vs `bridge_passport.py:55`) — import-path disciplína; pojmenování half-B modulů musí říkat `bridge_passport`.

## 4. Doporučený tvar half-B (k ratifikaci v B-interview)

Sibling-assembler vedle `recipe_runner` seamu (NE paralelní struktura, NE uvnitř recipe_runneru): `app/services/bridge_passport_assembler.py` skládá per-SO passport z existujících ingrediencí; konzumují ho (a) nový MCP tool `build_bridge_passport`, (b) recipe_runner (později, aditivně), (c) Portal UI (později). Stage pořadí: 1 (TZ text, rozšířit extract_tz_fields o use-keyed výstup) → 3 (soupis join + rozšíření polí) → 2 (výkresy: trio přes host-vision + nová notes-cesta ve validačním gate). Každé pole `_source` anchor (AC 5), honest-blank всюду.
