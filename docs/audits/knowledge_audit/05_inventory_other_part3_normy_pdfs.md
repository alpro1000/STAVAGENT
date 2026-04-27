# Other Inventory — Part 3: raw norm sources (TKP + vendor PDFs) + extracted catalogs

**Scope:** `docs/normy/tkp/`, `docs/normy/navody/`, `data/peri-pdfs/`, `test-data/`, `scripts/`.
**Source:** Gate 1+2 Explore agent E (repo root + docs).

---

## TKP PDFs — `docs/normy/tkp/` (33 files, ~36 MB total)

| filename | size | publication date | TKP # / topic | extracted_counterpart in CORE | usage |
|---|---|---|---|---|---|
| TKP01_2022_04.pdf | 1.1 MB | 2022-04 | TKP01 Betonové konstrukce | `B2/all_pdf_knowledge.json` | Concrete grades + curing — primary source for `CURING_DAYS_TABLE` |
| TKP01A_2024_06.pdf | 601 KB | 2024-06 | TKP01 Amendment | `B2/all_pdf_knowledge.json` | 2024 amendment, higher precedence |
| TKP02_2022_04.pdf | 617 KB | 2022-04 | TKP02 Betony | `B2/all_pdf_knowledge.json` | Concrete properties + testing |
| TKP03_2008_07.pdf | varies | 2008-07 | TKP03 Zemní práce | `B2/tkp/tkp_03_zemni_prace.json` | Earthworks |
| TKP04 – TKP16 (13 files) | varies | 2008–2024 | various | aggregated extract only | Specialized norms |
| TKP17_2022_04.pdf | varies | 2022-04 | TKP17 Beton | `B2/tkp/tkp_17_beton.json` | Concrete production catalog |
| TKP18_2022_05.pdf | 631 KB | 2022-05 | TKP18 Betonové mosty | `B2/tkp/tkp_18.md` + `tkp_18_betonove_mosty.json` | **Critical:** prestress + curing class + cover for bridges |
| TKP19 – TKP21 (3 files) | varies | 2002–2015 | various | aggregated extract only | Misc |
| TKP22_2022_06.pdf | varies | 2022-06 | TKP22 Izolace | `B2/tkp/tkp_22_izolace.json` | Waterproofing thickness norms |
| TKP23 – TKP24 (2 files) | varies | 2003–2006 | various | `B2/tkp/tkp_24_zvlastni_zakladani.json` (TKP24) | Special foundations |
| TKP25A_2018_09.pdf, TKP25B_2001_11.pdf, TKP25B_2024_06.pdf | varies | 2001–2024 | TKP25 (two versions of B sub-part) | aggregated extract only | Two TKP25B versions co-exist — newer = 2024-06 |
| TKP26 – TKP33 (8 files) | varies | 2003–2017 | various | aggregated extract only | Specialized norms |

**Total:** 33 raw PDFs. All batch-extracted into `concrete-agent/.../knowledge_base/all_pdf_knowledge.json` (12,837 lines). Only TKP03/17/18/22/24 have dedicated structured JSONs in `B2/tkp/`. Recommendation: keep PDFs as raw source-of-truth. TKP25B has two amendments (2001 + 2024) — confirm only the newer one is referenced by extractors.

---

## Vendor manual PDFs — `docs/normy/navody/` (6 files, ~30 MB total)

| filename | size | vendor | usage | extracted form |
|---|---|---|---|---|
| rundflex-návod.pdf | 15 MB | Rundflex | Formwork system manual | partial — sections in `data/peri-pdfs/formwork_catalog_PERI_DOKA_2025.md` |
| skydeck-návod.pdf | 4.4 MB | Sky | Climbing formwork | none (raw only) |
| quattro-návod.pdf | 3.8 MB | DOKA | Table formwork | partial — same MD as above |
| domino-prospekt.pdf | 3.1 MB | DOKA | Modular formwork brochure | none (raw only) |
| sky-kotva-návod.pdf | 3.1 MB | Sky | Anchoring system | none (raw only) |
| srs-návod.pdf | 1.4 MB | SRS | Prop + brace | none (raw only) |

**Recommendation:** keep as raw source. Three of six (skydeck, domino, sky-kotva, srs) have **no extracted counterpart** — Gate 0 in `INVENTORY_BEFORE_WORKS_PIPELINE.md` is the natural place to add structured YAML.

---

## Extracted vendor catalogs — `data/peri-pdfs/`

| path | size | content_type | theme | importers | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `data/peri-pdfs/formwork_catalog_PERI_DOKA_2025.md` | 19 KB / 486 lines | markdown | formwork_catalog_extracted | `INVENTORY_BEFORE_WORKS_PIPELINE.md` (Gate 0 input) | 2026-04-24 | yes (Monolit `formwork-systems.ts` + Registry `formwork_knowledge.json` + CORE `B3/formwork_systems_doka.json`) | keep_in_place | PERI + DOKA 2025 catalog, extracted from rundflex/quattro PDFs. **QUADRUPLE-SOURCED with Monolit/Registry/CORE** |
| `data/peri-pdfs/rimsa_element_spec_v2_DOKA_PERI.md` | 21 KB / 512 lines | markdown | element_spec_extracted | INVENTORY (Gate 0 input) | 2026-04-24 | no | keep_in_place | Detailed Římsa spec v2 — **only 1 of 3 promised element specs located** |
| `data/peri-pdfs/parse_peri_pdfs.py` | 7 KB | python | parser_utility | local use | 2026-04-24 | no | keep_in_place | Extraction script for PERI/DOKA PDFs |

---

## Test data + scripts

| path | size | content_type | theme | importers | last_modified | dup_hint | category | justification |
|---|---|---|---|---|---|---|---|---|
| `test-data/tz/SO-202_D6_most_golden_test.md` | 12 KB / 243 lines | markdown | golden_test_input | CLAUDE.md, STAVAGENT_CONTRACT | 2026-04-24 | no | keep_in_place | Bridge mostovka golden test — concrete C35/45, curing class 4, prestress 11d |
| `test-data/tz/SO-203_D6_most_golden_test_v2.md` | 38 KB / 982 lines | markdown | golden_test_input | CLAUDE.md, Monolit tests | 2026-04-24 | no | keep_in_place | SO-203 multi-match conflict + field state history |
| `test-data/tz/SO-207_D6_estakada_golden_test_v2.md` | 41 KB / 1067 lines | markdown | golden_test_input | Smart Extractor tests | 2026-04-24 | no | keep_in_place | Estakáda SO-207 — exposure array + curing class auto-assign |
| `scripts/check-vertex-ai-prod.sh`, `scripts/check_model_connections.sh` | 4 KB combined | bash | operational | GCP monitoring | 2026-04-24 | no | move_to_central | Health checks → recommend `gcp/health-checks/` |
| `scripts/dangerous/README.md`, `scripts/dangerous/clear-production-db.sql` | 4 KB combined | docs+sql | dangerous_operations | emergency only | 2026-04-24 | no | keep_in_place | DB-clear with safeguards — keep as-is |

---

End of part 3. Continued in `05_inventory_other_part4_archive.md` (legacy archive + missing artifacts).
