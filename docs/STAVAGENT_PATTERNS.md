# STAVAGENT Product Patterns — Žihle-validated

**Last updated:** 2026-05-07
**Validated against:** Žihle 2062-1 D&B pilot (154 položek, 10.59M Kč bez DPH, status `tender_ready`)
**Source artefakty:** `test-data/most-2062-1-zihle/`

This document captures 7 reusable patterns that the Žihle pilot (2026-05) proved out in
production-shaped conditions. Treat each pattern as a default starting point for a new
project — diverge only with explicit reasoning.

---

## Pattern 1: Per-SO Chunking pro Master Soupis

**Problem:** monolithic `master_soupis.yaml` build pass times out the model API stream
(generation > ~15 min, single-document context length, no checkpoint recovery).

**Solution:** split master soupis into one YAML per stavební objekt — and further split
SO 201 (the bridge itself) into per-TSKP-třída parts.

```
master_soupis_SO_001.yaml         (Demolice — 30 položek)
master_soupis_SO_180.yaml         (Provizorium — 26 položek)
master_soupis_SO_201_t0.yaml      (Most administrativa — 10 položek)
master_soupis_SO_201_t1_t2.yaml   (Most zemní + základy — 10 položek)
master_soupis_SO_201_t3_t4.yaml   (Most CORE — 14 položek)
master_soupis_SO_201_t5_t6_t7.yaml (Most vozovka + izolace — 17 položek)
master_soupis_SO_201_t8_t9.yaml   (Most potrubí + ostatní — 21 položek)
master_soupis_SO_290.yaml         (Silnice — 12 položek)
master_soupis_SO_801.yaml         (ZS detailní — 9 položek)
master_soupis_VRN.yaml            (VRN — 5 položek)
master_soupis.yaml                (Index file — references + totals only)
```

**Aggregation:** trivial concat in `build_master_soupis.py`. Exports (UNIXML XML, XLSX,
validation_report.md) all generated from the union.

**Proven scale:** 154 položek, 6 SO objektů, 0 timeouts during generation.

**Generalization:** any per-row deliverable that may exceed ~5k tokens / single API call
should chunk along its natural domain axis (here: SO + TSKP třída). Aggregator script
reconstructs full picture deterministically.

---

## Pattern 2: Audit Trail Mandatory

**Problem:** smetní položka without traceable derivation = legal liability + audit
nightmare during tender review (CZ vyhláška 499/2006 Sb. + ČSN 73 0212 expectations).

**Solution:** every položka in master soupis carries:

```yaml
polozka_id:    "SO201-T4-01"
otskp_kod:     "421325"
popis:         "MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE ZE ŽELEZOBETONU C30/37"
mj:            "M3"
mnozstvi:      39.84
vypocet:
  formula:     "L × B × t"
  vstupy:
    L_m: {hodnota: 12.0, jednotka: m, popis: "...", zdroj: "Phase B"}
    B_m: {hodnota: 8.30, jednotka: m, popis: "...", zdroj: "Phase B"}
    t_m: {hodnota: 0.40, jednotka: m, popis: "...", zdroj: "Phase B + Pokorný-Suchánek"}
  vypocet_kroky:
    - "12.0 × 8.30 = 99.6 m² (plocha desky)"
    - "99.6 × 0.40 = 39.84 m³"
confidence:    1.0
source:        "calculator_deterministic"
```

**Rule:** ZERO fabrications. Žádný `mnozstvi` bez `formula + vstupy + vypocet_kroky +
confidence + source`. If the value can't be traced, it doesn't go into the soupis.

**Žihle audit:** 154/154 items carry full audit trail (`validation_report.md` § 8).

---

## Pattern 3: Triangulation Philosophy

**Problem:** any single source of mnozstvi (calculator alone, user manual alone, KB norm
alone) is wrong some of the time. Picking a "winner" hides the disagreement.

**Solution:** triangulate three sources, document the conflict inline, declare a primary
without erasing the alternatives.

```
Source 1: User manual SO_201_JŠ.xls   (Kfely template, 77 položek expert benchmark)
Source 2: Phase C calculator          (deterministic mnozstvi, 11 elementů)
Source 3: KB normy + OTSKP catalog    (cena unit + spec validation)
```

**Reconciliation rule:** if `|delta calc vs user| > 10 %` → inline `reconciliation:` block
with `status: FLAG` + explanation. No silent overwrite.

**Final value (per Žihle user choice C):** calculator deterministic mnozstvi as primary,
user manual as cross-check. 16 reconciliation FLAGS in Žihle (`validation_report.md` § 4)
all carry root-cause explanation (geometry diff / concept diff / rebar_index diff).

---

## Pattern 4: Anchor Pattern pre Cross-SO References

**Problem:** the same OTSKP code legitimately appears in multiple SO (e.g. provizorium
demontáž 027413 belongs both to SO 180 lifecycle AND SO 001 end-of-construction demolice
scope). Naive duplication double-counts cost.

**Solution:** put the cost in **one** SO; place an **anchor** with `cena = 0 Kč` in the
other(s) so visibility/structure is preserved.

```yaml
# In SO 180 (provizorium):
- polozka_id: "SO180-T0-06"
  otskp_kod:  "027413"
  popis:      "PROVIZORNÍ MOSTY — DEMONTÁŽ (anchor — actual cost in SO 001 T9-11)"
  mnozstvi:   60.0
  jedn_cena_kc: 0
  cena_celkem_kc: 0
  cross_ref:    "master_soupis_SO_001.yaml: SO001-T9-11"

# In SO 001 (demolice):
- polozka_id: "SO001-T9-11"
  otskp_kod:  "027413"
  popis:      "PROVIZORNÍ MOSTY — DEMONTÁŽ (ocelový mostní systém)"
  mnozstvi:   60.0
  jedn_cena_kc: 3086
  cena_celkem_kc: 185160
```

**Validator:** `master_soupis.yaml` index + `validation_report.md` § 6 detect every
shared OTSKP base-code across SO and require an explicit explanation per case.

---

## Pattern 5: TSKP Hierarchical Structure (0–9)

**Problem:** Czech smetní praxe expects TSKP-ordered output. Random ordering = manual
post-processing for the recipient.

**Solution:** structure každé SO file by TSKP třídy. Sequence within třída = OTSKP code
numerical order.

| Třída | Doména | Examples |
|---|---|---|
| **0** | Všeobecné konstrukce a práce | 014102 skládka, 02991 tabule, 02953 HPM, 0296 dozor |
| **1** | Zemní práce | 121108 ornice, 13173 jáma, 11511 čerpání, 17411 zásyp |
| **2** | Základy | 272325 ŽB základy, 272365 výztuž, 28997 geotextilie |
| **3** | Svislé konstrukce | 333325 opěry, 317325 římsy, 31717 kotvení |
| **4** | Vodorovné konstrukce | 421325 mostovka, 420324 přechodové desky, 451xxx podkladní |
| **5** | Komunikace | 56xxx vrstvy, 574xxx asfaltobetony, 575xxx litý asfalt |
| **6** | Úpravy povrchů | 62592 striáž, 938255 otryskání |
| **7** | Přidružená stavební výroba | 711xxx izolace, 78xxx nátěry |
| **8** | Potrubí | 87xxxx drenáže, chráničky |
| **9** | Ostatní konstrukce a práce | svodidla 91xx, dilatace 93xx, zatěžovací zkouška 93311 |

**Žihle confirmation:** all SO/per-třída files use this layout; UNIXML export and XLSX
respect the same order.

---

## Pattern 6: No Work Duplication Rule

**Problem:** real projects need the same OTSKP code in different contexts (geographic /
lifecycle / spec). Blanket "one OTSKP per project" is too rigid.

**Solution:** **each OTSKP code in ONE SO maximum, OR multiple SO with explicit
context-separation explanation in `no_work_duplication_validation.shared_otskp_kody`.**

5 separation strategies validated by Žihle:

| Strategy | Žihle example | Where |
|---|---|---|
| **Geographic** | 574C78 ACL: SO 201 most+nájezdy 565 m² ≠ SO 290 silnice 1350 m² | SO 290 ← SO 201 t5 |
| **Lifecycle** | 9117xx: SO 001 demontáž stávajícího ≠ SO 201 montáž nového | SO 001 ← SO 201 t9 |
| **Spec** | 113728 frézování: 1.8 m³ most asfalt ≠ 67.5 m³ silnice asfalt (different úsek + tloušťka) | SO 001 ← SO 290 |
| **Length** | 935212 příkopy: 25.68 m u nájezdů ≠ 225 m podél širší silnice | SO 201 t9 ← SO 290 |
| **Sum** | 11511 čerpání: SO 001 200 hod + SO 180 100 hod + SO 201 160 hod = 460 hod (časově oddělené etapy) | three SO |

**Validator:** `validation_report.md` § 6 lists every shared base-code across SO with
status check.

---

## Pattern 7: Vendor Pricing Integration

**Problem:** OTSKP catalog has cena = 0 (regional or "vendor RFQ required") for many
specialty položek (mostní provizorium, recyklace, atypické bednění). Single-vendor quote
biases the estimate.

**Solution:** quote ≥ 3 vendors (4 ideal), compute per-line median, attach range in audit.

```yaml
- polozka_id: "SO180-T0-04"
  otskp_kod:  "027411"
  popis:      "PROVIZORNÍ MOSTY — MONTÁŽ (median 4 vendorů)"
  jedn_cena_kc: 2926
  cena_celkem_kc: 175590
  source: "vendor_pricing_median"
  vendor_pricing_aggregate:
    source_vendors: [TMS_9m, PONVIA_MS_9m, MOSTY_ZABORI_4m, MOSTY_ZABORI_3_5m]
    decomposed_per_line_kc: [102000, 268300, 187582, 163597]
    median_per_line_kc: 175590
```

**Confidence ladder:** custom non-OTSKP code with no quote = 0.0 (RFQ required) → vendor
median across 3+ sources = 0.85+ → exact OTSKP catalog match = 1.0.

**Storage:**

- `B3_current_prices/` — anonymized vendors per-domain (provizorium, skládka, recyklace)
- `test-data/<project>/04_documentation/vendor_pricing/vendor_quotes.yaml` — named per
  pilot project

---

## Cross-references

- ADR index: `docs/architecture/decisions/README.md`
- ADR-005 Phase E dropped: `docs/architecture/decisions/ADR-005_phase_E_dropped.md`
- Žihle reference project: `test-data/most-2062-1-zihle/`
- Calculator philosophy: `docs/CALCULATOR_PHILOSOPHY.md`
- Knowledge base placement: `docs/KNOWLEDGE_PLACEMENT_GUIDE.md`

---

**When to update this file:** after every pilot project that either (a) validates a new
pattern, (b) breaks an existing one (with reason), or (c) refines wording. Each pattern
should reference the project + commit that proved it.
