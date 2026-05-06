# csn_73_6244_prechody_mostu

> **Source-of-truth pointer — STUB ENTRY.** Original norm is paid (ÚNMZ);
> not redistributable. This entry holds a **distillation** from a user-prepared
> structured summary (TASK §3.3, "ČSN 73 6244 — Maximální rekonstrukce z veřejných
> zdrojů") cross-checked against UPa skripta "05 Přechodové oblasti a přechody"
> as secondary teaching reference.

- **Slug:** `csn_73_6244_prechody_mostu`
- **Bucket:** `B7_regulations`
- **Norm code:** ČSN 73 6244
- **Title (cs):** Přechody mostů pozemních komunikací
- **Status:** `paid_standard_unavailable` — no PDF in repo
- **Publisher:** ÚNMZ
- **Edition year:** 2010 (Oprava 1: červen 2011)
- **Pages:** 40
- **Doc type:** `csn_norm_stub`
- **Language:** cs

## Files in this entry

| File | Purpose |
|------|---------|
| `INDEX.yaml` | Strukturovaná extrakce z user summary: čl. 1 Předmět + čl. 5 Materiály (zásyp ŠDA 0-32, ID 0,85-0,90, max vrstva 125 mm) + čl. 6 Geotechnika + čl. 7 Návrh (nerovnost 20/40 mm, drenáž DN 150, geomembrana 20 kN/m) + čl. 7.4 Návrh přechodové desky + **čl. 7.7 Integrované mosty** (Žihle relevant) + čl. 8 Provádění + čl. 9 Zkoušení + Příloha A míra zhutnění + Přílohy B-E. 6 validation rules. |
| `METADATA.md` | Tento soubor |
| `source_pointer.md` | Poznámka o paid status + acquisition path + secondary source pointer |

## Why a stub

ČSN 73 6244 je **placená norma** prodávaná ÚNMZ; full text nemůže být přidán
do gitu bez licenčního porušení. Pro Žihle Phase B/C/D (sandbox) postačí
distillation klíčových hodnot:

- **Frakce zásypu za opěrami:** ŠDA 0-32 mm
- **Relativní ulehlost:** ID 0,85-0,90
- **Maximální tloušťka vrstvy zhutňování:** 125 mm
- **Maximální nerovnost vozovky v přechodu:** 20 mm (dálnice) / **40 mm (silnice II/III tř.)** — Žihle = III. třída
- **Drenáž za opěrou:** min. DN 150
- **Geomembrana:** táhlost min. 20 kN/m
- **Čl. 7.7 Integrované mosty:** primární pro Žihle (rámový integrál bez ložisek/dilatací)

Pro skutečnou nabídku tendru zhotovitel musí získat originál (https://www.unmz.cz/
nebo https://www.agentura-cas.cz/).

## Cross-references

- **Primary norms:**
  - [`tkp_04_zemni_prace`](../tkp_04_zemni_prace/) — §4.3.10 Zpětný zásyp + §4.3.11 Přechodová oblast
  - [`vl_4_mosty`](../vl_4_mosty/) — vzorové výkresy VL 4-201.07 (drenáž za opěrou) + 302.01 (uložení přechodové desky)
  - [`en_1992_2_concrete_bridges`](../en_1992_2_concrete_bridges/) — EN 1992-2 §113 (execution stages)
- **Secondary teaching reference:**
  - [`B6_research_papers/upa_prechodove_oblasti/`](../../B6_research_papers/upa_prechodove_oblasti/) — UPa skripta (PDF v `B2_csn_standards/`)
- **Used by:**
  - [Žihle Phase B `02_design/varianta_01_integralni_ram.md`](../../../../../../../test-data/most-2062-1-zihle/02_design/varianta_01_integralni_ram.md) §4 Přechodové desky
  - [Žihle Phase B `02_design/concrete_classes.yaml`](../../../../../../../test-data/most-2062-1-zihle/02_design/concrete_classes.yaml) prechodove_desky element
  - [Žihle Phase D `04_documentation/TZ_DUR_zihle_2062-1.md`](../../../../../../../test-data/most-2062-1-zihle/04_documentation/TZ_DUR_zihle_2062-1.md) — B.2.3 Konstrukční řešení
