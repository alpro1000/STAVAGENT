# passport-exposure-single — Fix

> **Bug ID:** `passport-exposure-single`
> **Status:** fixed (PR pending merge)
> **Approach:** analyze.md §5.1 Approach A (předat celé pole; engine = single source of truth)

---

## 1. Changes

- `Monolit-Planner/shared/src/parsers/bridge-passport.ts`
  - Mapper předává `exposure_classes: parsed.exposure_all` (preferované engine API) místo single `exposure_class = exposures[0]`.
  - `parseConcreteClassString` beze změny tvaru (single `exposure_class` zůstává pro display-label callery; mapper ho už neposílá — jeden zdroj pravdy).

## 2. Tests (golden)

`bridge-passport.test.ts` +2 a 3 piny aktualizovány:
1. **Order-independence pin (nebezpečný případ):** «C35/45-XC4+XF4» → `exposure_classes` nese obě + `planElement().formwork.curing_days ≥ 7` (XF4 TKP18 minimum) — first-token by vzal XC4 a XF4 minimum ztratil.
2. Dříky «XF1+XD1+XC4» (živý bug string): všechny tři doletí + plan warnings viditelně flagují XF1 (netypická pro dříky; TZ hodnota honorována — flag, never gate).
3. Piny deck/piers/abutments: `exposure_class` → `exposure_classes` (plný seznam z fixture).

## 3. Verification

- shared 1415/1415, tsc clean; backend parity 42/42; MCP golden 4/4.
- Pozn. k původnímu očekávání „pier = XF2/XF4": TZ dříkům XF2/XF4 NEpřiřadila — fabrikace třídy by porušila ratified AC (TZ authority). Správné chování = všechny TZ třídy doletí + engine viditelně varuje.

## 4. Spec follow-up

- Žádný — engine combined-rules logika byla kanonická už od Task 2 (2026-04-20); mapper ji nyní používá.
