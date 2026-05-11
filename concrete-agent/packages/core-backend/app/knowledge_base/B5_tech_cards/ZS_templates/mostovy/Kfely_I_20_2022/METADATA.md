# Kfely I/20 (2022) — Mostovy ZS template ★ benchmark

**Project type:** mostovy (silnice I. třídy mostek)
**Project scope:** I/20 Kfely rekonstrukce mostu
**Project size:** 70 M Kč
**Duration:** 7 měs
**ZS+PH+VRN total:** 3.55 M Kč
**ZS poměr:** **5.0 %**
**Source year:** 2022

## Why this is the canonical mostovy benchmark

Kfely I/20 is the **closest match** to small/mid mostovy projects in CZ:
- Silnice I. třídy mostek (same kategorie as Žihle III/206 2 — same engineering practice)
- Mid-size scope (70 M, vs Žihle 10.5 M small mostovy)
- Standardní 7-měsíční doba (most peer projects fall 5–9 měs)
- 5.0 % ZS poměr is the mostovy benchmark for sizing / staffing / equipment

D6 highway templates are over-scoped for mostovy — see `../../PATTERNS.md` Pattern B/C.

## Source files

**XLS file NOT in this directory** — `ZS_-_Kfely.xls` uploaded by user during Žihle
Session 4 task, kept in user's local archive. Reference XML in repo:
`test-data/most-2062-1-zihle/inputs/reference/20 Rekonstrukce mostu Kfely (zadání).xml`
(zadání only, ZS sheet not extracted as standalone file yet).

When ready to commit XLS:
- Strip atelier header / project ID
- Replace tag with "KFELY_MOSTOVY_TEMPLATE_2022"
- Drop in `original/` subdirectory

## Mostovy benchmark unit prices (Kfely-specific)

These are the **mostovy benchmarks** (NOT identical to D6 highway):

| Položka | Kfely cena | D6 highway cena | Delta | Pattern |
|---|---:|---:|---:|---|
| BOZP zabezpečení (kpl) | **80 000 Kč** | 200 000 Kč | -60 % | Pattern B |
| Doprava buněk | **4 400 Kč/cesta** | 4 000 Kč/cesta | +10 % | Pattern F |
| Pojištění stavby CAR | 95 000 Kč | 87 000 Kč | +9 % | (project-scaled) |
| Generator pre režim | **primary 210 dní** | záložní jen | flip | Pattern D |
| Polír | 2× full-time × 7 měs | 1× × 12 měs | scaled | Pattern C |
| Buňky kanceláře | 4 ks (large project) | 1-3 ks | n/a | scope-scaled |

## Žihle application

Kfely I/20 mostovy benchmark applied to Žihle Session 4 retrofit:
- BOZP 80k (was D6 200k) — Pattern B
- Doprava buněk 4 400 (was D6 4 000) — Pattern F
- Polír part-time 30k/měs (mostovy small project derivation z Kfely's 90k full-time
  scaled DOWN per Žihle 10.5M scope) — Pattern C

Net Žihle delta: -248 200 Kč. Žihle ZS+PH+VRN total 2 956 326 → 2 708 126 Kč.
ZS poměr 24.6 → 22.6 % (still high vs Kfely 5 % protože Žihle small + long-duration
hits Pattern A "small long-duration" 22-28 % expected).

## Cross-validation

| Aspect | Žihle Session 4 | Kfely I/20 | Match? |
|---|---|---|---|
| Project type | mostovy III. třídy | mostovy I. třídy | ✅ similar |
| ZS poměr base | 22.6 % | 5.0 % | ⚠️ different (Žihle long-duration disproportion — Pattern A) |
| BOZP 80k | applied | benchmark | ✅ |
| Doprava 4 400 | applied | benchmark | ✅ |
| Polír part-time | 30k/měs | (full-time scaled) | ⚠️ Žihle aggressive part-time, smaller project |
| Generator primary? | NO (grid primary) | YES (open spaces) | ⚠️ Žihle in obec → grid primary |
