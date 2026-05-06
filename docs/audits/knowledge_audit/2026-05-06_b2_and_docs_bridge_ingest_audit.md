# Audit: B2 + docs/ Bridge Documents Ingest — 2026-05-06

**Branch:** `claude/setup-bridge-test-project-X41DO`
**Mode:** read-only inventory + structured ingest plan (no calculator/classifier changes)
**Scope:** `concrete-agent/packages/core-backend/app/knowledge_base/B2_csn_standards/` + `docs/normy/`
**Trigger:** TASK_KB_MajorIngest_BridgesV2 (P1 enrichment, ~5-7h estimated)

---

## §1 B2_csn_standards/ inventory

7 PDFs + 1 DOC newly uploaded 2026-05-06 (commits `3af6b9aa`..`0c7b5746`); plus pre-existing material. Full state:

| File | Size | Type | Pages | Status |
|------|------|------|-------|--------|
| `TKP_4_2026_fin.pdf` | 376 KB | PDF text | 38 | ✅ NEW (Jan 2026 official, MD-3008/2026-940/2) |
| `TKP_04_2017.doc` | 451 KB | DOC binary | unknown | ⚠️ NOT readable (no pandoc/libreoffice/antiword in env) |
| `05_prechodove oblasti a prechody.pdf` | 3.65 MB | PDF | unknown | UPa skripta — secondary source for ČSN 73 6244 |
| `204.01 TECHNICKA ZPRAVA.pdf.pdf` | 206 KB | PDF | unknown | Real-world TZ template |
| `Příloha SoD č. 4_Technologický postup prací_zemni prace, bourani.pdf` | 1.48 MB | PDF | unknown | Technological postup pro zemní práce + bourání |
| `vykresy_mosty_I.pdf` | 5.10 MB | PDF | unknown | Bridge výkresy (UPa or VL 4 fragment — TBD) |
| `31697_Archive.pdf` | 6.37 MB | PDF scan | 19 | ⚠️ SCANNED IMAGE, no text layer (Litovel project archive) |
| `09_zatizitelnost, sanace.pdf` | 4.13 MB | PDF | 31 | ✅ already extracted to B6 (commit `b31bdf57`) |
| `SIST-EN-1992-2-2005.pdf` | 346 KB | PDF | — | ✅ already extracted to B7 (commit `b31bdf57`) |
| `VL_4_2021_Mosty_markdown.md` | 730 KB | MD | — | Pre-extracted, well-structured, ~4000+ lines |
| `csn_en_206.json` | 76 KB | JSON | — | Pre-existing structured |
| `metadata.json` | 1.7 KB | JSON | — | B2 catalog (updated 2026-05-05) |
| `tkp/` | folder | — | — | 7 pre-extracted JSONs (TKP 03/17/18/22/24, etc.) |

**Source PDF readability:** Read tool natively reads text-extractable PDFs (used in Phase A for ZD/HPM). For Litovel scan PDF, only filename-level metadata available without OCR.

---

## §2 docs/normy/ inventory

```
docs/normy/
├── tkp/         (36 PDFs — TKP 1-33 series, mostly 2008-2024 vintages)
└── navody/      (5 vendor manuals + 2 SKRUZ MD + CALCULATOR_PHILOSOPHY.md)
```

**`docs/normy/tkp/` (36 files):**
- TKP 1, 1A, 2-33 (full official Czech road TKP catalog)
- **`TKP04_2008_07.pdf`** = LEGACY 2008 version of Kapitola 4 Zemní práce (631 KB)
- TKP 18 not in folder (only as JSON in B2/tkp/)

**`docs/normy/navody/` (8 files):**
- domino, quattro, rundflex, sky-kotva, skydeck, srs — formwork system vendor manuals (PDFs)
- SKRUZ_TERMINOLOGIE_KANONICKA.md + Section9.md — internal terminology canonicals
- CALCULATOR_PHILOSOPHY.md — internal docs

---

## §3 Duplicate detection

| File in B2 | Equivalent in docs/normy/? | Action |
|------------|----------------------------|--------|
| `TKP_4_2026_fin.pdf` (NEW) | `TKP04_2008_07.pdf` (LEGACY 2008) | **MOVE** new PDF to `docs/normy/tkp/TKP04_2026_01.pdf`; legacy 2008 stays as historical reference. |
| `TKP_04_2017.doc` (legacy 2017) | NO 2017 version in docs | LEAVE in B2 with audit note (DOC unreadable in env, low strategic value — 2026 supersedes anyway). |
| `05_prechodove oblasti a prechody.pdf` (UPa) | NO | LEAVE in B2; reference from `B6_research_papers/upa_prechodove_oblasti/` (NEW B6 entry, secondary source for ČSN 73 6244). |
| `204.01 TECHNICKA ZPRAVA.pdf.pdf` | NO | LEAVE in B2; reference from `B5_tech_cards/real_world_examples/204_01_technicka_zprava/source_pointer.md`. |
| `Příloha SoD č. 4_…bourani.pdf` | NO | LEAVE in B2; reference from `B5_tech_cards/technological_postupy/zemni_prace_bourani/source_pointer.md`. |
| `vykresy_mosty_I.pdf` | NO | LEAVE in B2; reference from `B6_research_papers/upa_vykresy_mosty/source_pointer.md` (assumption: UPa lecture výkresy per filename). |
| `31697_Archive.pdf` (Litovel) | NO | **MOVE** to `test-data/most-litovel/inputs/source/31697_Archive.pdf` (NOT in KB — это project не norma, per task §2.3). |

**Strategy chosen:** **Option A from task §3.1** — `B7_regulations/` and `B5_tech_cards/` entries hold extracted YAML/MD with `source_pointer.md` referencing PDFs in B2 (legacy bucket) or `docs/normy/` (canonical for normativní PDFs). No PDF duplication.

**Per Q2 audit:** 0 actual duplicates; new TKP 4 (2026) is the modern version of legacy TKP04 2008.

---

## §4 New ingest candidates (per this task)

### B7_regulations/

| Slug | Source | Action | Pages |
|------|--------|--------|-------|
| `tkp_04_zemni_prace` | `docs/normy/tkp/TKP04_2026_01.pdf` (after move) | **FULL extraction (Scenario A, 38 pages)** — INDEX.yaml + METADATA.md + structured chapters. | 38 |
| `csn_73_6244_prechody_mostu` | Task §3.3 inline summary + UPa skripta secondary | **Stub** with INDEX.yaml from inline structured text (čl. 5/6/7/7.3/7.4/7.7/8/9, Příloha A) + cross-ref to UPa entry. PDF paid (ÚNMZ), not in repo. | n/a (stub) |
| `vl_4_mosty` | `B2/VL_4_2021_Mosty_markdown.md` (pre-extracted) | **Move** + INDEX.yaml with section index (drenáž za opěrou, přechody, římsy, izolace, atd.) + cross-references. | (4000 řádků MD) |

### B6_research_papers/

| Slug | Source | Action |
|------|--------|--------|
| `upa_prechodove_oblasti` | `B2/05_prechodove oblasti a prechody.pdf` | **Stub entry** — METADATA.md + source_pointer.md. Sekunderní zdroj pro ČSN 73 6244. |
| `upa_vykresy_mosty` | `B2/vykresy_mosty_I.pdf` | **Stub entry** — METADATA.md + source_pointer.md. (Identifikace per filename = UPa lecture výkresy mostů.) |

### B5_tech_cards/

| Slug | Source | Action |
|------|--------|--------|
| `real_world_examples/204_01_technicka_zprava` | `B2/204.01 TECHNICKA ZPRAVA.pdf.pdf` | **Stub entry** — METADATA.md + source_pointer.md. Real-world TZ template; structurally compare s naší Žihle Phase D `TZ_DUR_zihle_2062-1.md`. |
| `technological_postupy/zemni_prace_bourani` | `B2/Příloha SoD č. 4_…bourani.pdf` | **Stub entry** — METADATA.md + source_pointer.md. Technologický postup zemní + bourání (Žihle SO 001 cross-ref). |

### test-data/most-litovel/ (NOT in KB — per task §2.3)

| Item | Action |
|------|--------|
| `31697_Archive.pdf` | **Move** to `test-data/most-litovel/inputs/source/31697_Archive.pdf` |
| metadata.yaml | Create with `bridge_element_type: BR_DECK_SLAB`, `status: archive_reference`, `text_extractable: false` (scanned). |
| README.md | Status, structure, OCR-pending flag. |

---

## §5 Open questions (resolved without escalation)

1. **TKP_4_2026 page count** — agent reported "blocked", but Read tool successfully extracted 38 pages. **Resolved: Scenario A (≤50 pages full embed)**.
2. **TKP_04_2017.doc accessibility** — agent claimed libreoffice available; my `which libreoffice unoconv antiword pandoc` returned empty. **Resolved: SKIP, document audit-only note. 2026 supersedes 2017 anyway.**
3. **`vykresy_mosty_I.pdf` content** — filename suggests UPa lecture výkresy. **Resolved: Place in B6 with stub + flag for full identification by domain expert.**
4. **`31697_Archive.pdf` Litovel content** — scanned, no text layer. **Resolved: Metadata-only stub per AC #5-7 (which doesn't require text extraction).**
5. **ČSN 73 6244 user-prepared text** — agent reported "BLOCKER: NOT FOUND". **Resolved: re-reading task §3.3, the structured factual content IS embedded inline (čl. 5: zásyp 125 mm, ŠDA 0-32, ID 0,85-0,90; čl. 7: nerovnost 20/40 mm; čl. 7.3: drenáž DN 150, geomembrana 20 kN/m; čl. 7.4 / 7.7 / 8 / 9 / Příloha A). Use inline data + UPa skripta as secondary.**

**Net escalations to user:** 0 (all unknowns resolvable from audit + task body).

---

## §6 Coverage matrix — bridge element types vs KB references

After this ingest, per-element KB density (B# = bucket, count = number of distinct entries referencing the element):

| Element type | B6 (research) | B7 (regulations) | B5 (tech cards) | B9 (validation) | Total |
|---|---|---|---|---|---|
| `mostovkova_deska` | 1 (Pokorný-Suchánek) | 2 (EN 1992-2 + VL 4) | 1 (TZ template) | 1 (lifecycle) | 5 |
| `prechodova_deska` | 2 (Pokorný + UPa přechody) | 2 (ČSN 73 6244 + VL 4) | 0 | 1 | 5 |
| `mostni_zavirne_zidky` | 1 | 2 (ČSN 73 6244 + VL 4) | 0 | 1 | 4 |
| `zaklady_oper` | 1 | 2 (TKP 4 + EN 1997 ext.) | 1 (postup) | 0 | 4 |
| `opery_ulozne_prahy` | 1 | 2 (EN 1992-2 + VL 4) | 1 | 1 | 5 |
| `rimsa` | 1 | 3 (EN 1992-2 + VL 4 + TKP 11 ext.) | 0 | 1 | 5 |
| zásyp (component, not element) | 0 | 3 (TKP 4 + ČSN 73 6244 + VL 4) | 1 (postup) | 0 | 4 |

**Pre-task baseline (after `b31bdf57`):**
- mostovková_deska: 3 entries (Pokorný + EN 1992-2 + lifecycle)
- prechodova_deska: 1 entry (lifecycle table)
- zaklady_oper: 0 entries
- zásyp: 0 entries

**Post-task expected:** roughly **+10 entries** across B5/B6/B7, **+50% per-element coverage** for bridge components.

---

## §7 Strategy summary

1. **PDFs stay in their canonical bucket** (B2 legacy, docs/normy/ for normy after move) — NO duplication.
2. **Extracted YAML/MD lives in B6/B7/B5/B9** with `source_pointer.md` linking to PDF.
3. **Litovel** = test-data project (NOT in KB) per task §2.3.
4. **Žihle Phase A-D artefacts** unchanged (read-only references from new entries).
5. **No code changes** outside KB enrichment + test-data/.

---

## §8 Acceptance criteria mapping

| Task AC | Status |
|---------|--------|
| 1. Audit report exists | ✅ this document |
| 2. Inventory B2 + docs/normy/ | ✅ §1 + §2 |
| 3. Duplicate detection | ✅ §3 (0 duplicates, 8 unique-to-B2) |
| 4. Litovel as project not norma | ✅ §4 (placement in test-data/most-litovel/) |
| 5-7. Litovel ingest | (pending Part 2 implementation) |
| 8. TKP 4 full | (pending Part 3.1 — Scenario A confirmed) |
| 9. TKP 4 2017 conflict resolution | (pending — DOC unreadable, will skip + document) |
| 10. ČSN 73 6244 stub | (pending Part 3.2 — inline data + UPa secondary) |
| 11. VL 4 restructure | (pending Part 3.3) |
| 12. No PDF duplication | ✅ strategy committed in §3 |
| 13-15. Real-world templates B5 | (pending Part 4) |
| 16-17. KPGuide §16 + cross-ref graph | (pending Part 5) |
| 18-22. Cross-cutting | (pending — verified at commit time) |

---

*Audit completed 2026-05-06. Ingest implementation begins next.*
