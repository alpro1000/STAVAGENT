# tkp_04_zemni_prace

> **Source-of-truth pointer.** Source PDF lives in `docs/normy/tkp/TKP04_2026_01.pdf`
> (canonical location for all TKP — kapitola 4, edition 7). Extracted YAML lives here
> in `B7_regulations/` per [`docs/KNOWLEDGE_PLACEMENT_GUIDE.md`](../../../../../../docs/KNOWLEDGE_PLACEMENT_GUIDE.md)
> §16 (regulations bucket).

- **Slug:** `tkp_04_zemni_prace`
- **Bucket:** `B7_regulations`
- **PDF in repo:** `../../../../../../docs/normy/tkp/TKP04_2026_01.pdf` (376 KB, 38 pages)
- **Title (cs):** TKP — Kapitola 4: Zemní práce
- **Issuer:** Ministerstvo dopravy, Odbor pozemních komunikací
- **Approval ID:** MD-3008/2026-940/2 (19.1.2026)
- **Effective:** 1.2.2026
- **Edition:** 7 (replaces 2017 edition č.j. 143/2017-120-TN/1)
- **Doc type:** `tkp_md_norm`
- **Language:** cs
- **Status:** **full extraction** (Scenario A, ≤50 stran)
- **License:** Free (Ministerstvo dopravy, dostupné na pjpk.rsd.cz)

## Files in this entry

| File | Purpose |
|------|---------|
| `INDEX.yaml` | Strukturovaná extrakce všech §4.1–§4.12 + Příloha P1 (opravy a údržba); klíčové hodnoty (zhutnění %, odchylky, kontroly) + cross-references na související normy |
| `METADATA.md` | Tento soubor |
| `source_pointer.md` | Pointer na PDF v `docs/normy/tkp/` |

## Žihle relevance

TKP 4 governs zemní práce pro Most 2062-1 Žihle — všechny pre-construction zemní práce,
demolice, výkop základové jámy, zásypy za opěrami:

- **§4.3.4.4 Výkopy pro zakládání objektů** — pro plošný základ integrálního rámu (per `02_design/varianta_01_integralni_ram.md > §3 Spodní stavba`)
- **§4.3.10 Zpětný zásyp** — pro zásypy za opěrami + závěrné zídky
- **§4.3.11 Přechodová oblast** — pro přechodové desky (cross-ref ČSN 73 6244)
- **Příloha P1** — prohlídky a klasifikace poruch (relevant pro budoucí HPM po dokončení rekonstrukce, per ZD §4.3.j + ČSN 73 6221)

## Cross-references

- **Companion norms:**
  - [`csn_73_6244_prechody_mostu`](../csn_73_6244_prechody_mostu/) — primárně pro přechodové oblasti
  - [`vl_4_mosty`](../vl_4_mosty/) — vzorové výkresy zásypů + drenáží
  - ČSN EN 1997-1 (Eurokód 7) — externí (KB gap)
  - ČSN 73 6133 (návrh zemního tělesa) — externí (KB gap)
- **Real-world postup:**
  - [`B5_tech_cards/technological_postupy/zemni_prace_bourani/`](../../B5_tech_cards/technological_postupy/zemni_prace_bourani/)
- **Used by:** Žihle Phase B/C (`02_design/element_breakdown.yaml`, `03_calculation/`) + Phase D TZ (`04_documentation/TZ_DUR_zihle_2062-1.md`)

## Replaces

`TKP_04_2017.doc` (legacy 2017 edition, č.j. 143/2017-120-TN/1, 7.8.2017) — superseded.
The DOC file remains in `B2_csn_standards/` as historical reference but is **NOT readable**
in current sandbox env (no pandoc/libreoffice/antiword). Per task acceptance criterion #9
conflict resolution: **2026 edition wins**, 2017 kept as legacy-only.
