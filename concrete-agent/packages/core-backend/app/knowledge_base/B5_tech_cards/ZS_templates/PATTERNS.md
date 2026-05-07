# ZS Templates — Cross-Pattern Insights

**Initialized:** 2026-05-08 (Žihle Session 4 retrofit)
**Reference corpus:** D6 KV-Olšova vrata 2022 (3 souborů highway/urban) +
Kfely I/20 2022 (mostovy) + blank vzor 2022 + Žihle 2062-1 2026 (mostovy pilot).

---

## Pattern A — Project type drives ZS poměr base level

| Project type | Typical ZS+VRN poměr | Sample |
|---|---|---|
| **mostovy** (silnice I+II, mostovy < 70 m délky) | **5–8 %** | Kfely I/20: 5.0 %, similar peers |
| **highway / urban** (silnice I+dálnice, urbanizováno) | **8–12 %** | D6 SO 205 (7.2 %), SO 254 (9.9 %) |
| **small short-duration** (< 10 M, < 4 měs) | **20–28 %** (fixed costs disproportionate) | D6 SO 211/2 (26 %) |
| **small long-duration** (< 20 M, > 9 měs) | **22–28 %** (long fixed costs) | Žihle: 25.7 % |

**Rule:** when classifying a new project, project-type alone gives ±3 % envelope on
ZS poměr. Duration shift can push small projects to 25 %+ even outside D6/Kfely
quartiles. Verify against ≥ 2 peers before signing off pricing.

---

## Pattern B — BOZP zabezpečení cost split mostovy vs urban

`zákon 309/2006 Sb.` requires physical safety measures (zábradlí + záchytné sítě +
ohrada nebezpečných míst). **Cost is heavily project-type dependent:**

| Type | BOZP zabezpečení (kpl) | Reasoning |
|---|---|---|
| Highway urban (D6 SO 254) | **200 000 Kč** | Multiple risk zones, public access density |
| Mostovy small (Kfely I/20) | **80 000 Kč** | Fewer risk zones, controlled access |
| Žihle (Session 4 recalibrated) | **80 000 Kč** | Mostovy benchmark applied |

**Rule:** apply mostovy 80k for any small mostovy project. D6 200k urban is over-scoped
for venkov mostovy stavby and doesn't reflect actual risk density.

---

## Pattern C — Polír staffing model split

| Project scope | Polír model | Cena/měs | Source |
|---|---|---:|---|
| Highway 50 M+ (D6) | Full-time dedicated | 90 000 | D6 templates |
| Mostovy 20-70 M (Kfely) | Full-time, 2× rotational | 90 000 × 2 | Kfely I/20 |
| Mostovy < 20 M (Žihle) | **Part-time stavbyvedoucí ~30 % (12 h/týden)** | **30 000** | Kfely-derived + CZ trh 2026 |

**Rule:** Žihle 10.5 M project does NOT justify full-time dedicated polír (would be
495k for 50 % time). Realistic CZ market rate for small mostovy supervision is
30k/měs part-time. Detail v `master_soupis_VRN.yaml::VRN-01`.

---

## Pattern D — Electricity scenario varies with site

| Site type | Primary | Backup | Tariff |
|---|---|---|---|
| Urban highway D6 | grid (close ČEZ) | generator small záložní | ČEZ D02 obchod |
| Mostovy open spaces (Kfely) | **generator primary** (no grid in remote countryside) | none | PHM only |
| Mostovy v obci (Žihle, ČEZ ~150 m) | **grid primary** | generator záložní | ČEZ D02 6.5 Kč/kWh + buffer |

**Rule:** check obec ČEZ rozvaděč distance before pricing. < 200 m → grid primary
+ záložní generator. > 500 m → generator primary + možné PHM volumes.

---

## Pattern E — Highway-only items NOT applicable to mostovy

Items routinely v D6 templates which **MUST NOT** appear in mostovy projects:

- Strážní služba 24h/12h (urban density justification, mostovy = venkov)
- Kanceláře 3-4 ks (mostovy 1 ks dostatečný)
- Vzorový byt/modul (komerční, ne mostovy)
- BREEAM/LEED certifikace (komerční, ne stavební)
- Pasportizace okolních objektů (urban density, mostovy = volný terén)
- Plachta na oplocení neprůhledná (urban privacy, mostovy = venkov)
- Věžové jeřáby J1/J2/J3 (vertikální stavby, mostovy = horizontální → autojeřáb)

**Rule:** when copying D6 template as starting point, run "exclude list" check first.
Žihle exclusions documented v `master_soupis_PRESUN_HMOT.yaml::excluded_per_zihle_scope`.

---

## Pattern F — Doprava buněk cena drift

| Source | Kč/cesta | Year |
|---|---:|---|
| D6 highway templates | 4 000 | 2022 |
| Kfely I/20 mostovy | 4 400 | 2022 |
| 2026 RFQ recommended | unknown — apply Kfely as floor | — |

**Rule:** prefer Kfely 4 400 over D6 4 000 — newer/more realistic for mostovy logistics.

---

## Pattern G — Inflation 2022-2026 not applied across templates

All 4 reference templates are 2022-2023. Žihle pilot uses these prices verbatim and
flags "vendor RFQ doporučeno před tendrem" rather than apply blanket +10-15 %
inflation factor. Reasons:

1. CZ stavebnictví price index 2022→2026 is heterogeneous (+10 % průměr, ale
   některé položky -5 %, jiné +25 %).
2. Vendor RFQ at tender time gives accurate 2026 prices, ne speculative inflation.
3. Audit trail prefers "trustworthy old number flagged for refresh" over
   "extrapolated new number".

**Rule:** keep 2022-2023 unit prices as audit anchor. Add `flag: vendor_rfq_required`
on any položka where the project will go to real tender. Refresh at RFQ time.

---

## Žihle Session 4 application of these patterns

Applied to `test-data/most-2062-1-zihle/04_documentation/master_soupis/`:

- ZS-08 doprava buněk: 4 000 → **4 400** (Pattern F)
- ZS-17 elektrika: 30 000 paušál → **66 000** grid spotřeba (Pattern D)
- ZS-23 BOZP zabezpečení: 200 000 → **80 000** (Pattern B)
- VRN-01 polír: 50 % × 90k = 495 000 → **30 % × 30k × 11 měs = 330 000** (Pattern C)

Net delta: -248 200 Kč. Total ZS+PH+VRN: 2 956 326 → **2 708 126 Kč**.
Žihle ZS+VRN poměr: 24.6 % → 22.6 %, fits Pattern A "small long-duration mostovy".

---

## Future template additions

When 5th+ project comes through pilot pipeline, add ZS template here following
`README.md` directory convention. Update PATTERNS.md if new project either:
- Validates an existing pattern (cite project + commit)
- Stress-tests a pattern (document edge case)
- Reveals a new pattern (add Pattern H, I, ...)
