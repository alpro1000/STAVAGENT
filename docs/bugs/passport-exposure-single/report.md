# passport-exposure-single — Report

> **Bug ID:** `passport-exposure-single`
> **Datum reportu:** 2026-07-11
> **Reporter:** Alexander Prokopov (živý prod-MCP prohon)
> **Severity:** P1 (korektnost — curing/ошетřování může být poddimenzované, viditelnost tříd ztracena)
> **Status:** analyzed → fixing
>
> **Affected:** shared mapper `bridge-passport.ts` (`parseConcreteClassString` → PlannerInput)
> **Version:** v4.39.0 (tz-passport Gate 2)

---

## 1. What's broken

Mapper z TZ třídy «C35/45-XF1+XD1+XC4» předá enginu jen PRVNÍ expoziční třídu (`exposure_class = exposures[0]`), zbytek zahodí — přestože engine má preferované pole `exposure_classes: string[]` s combined-rules logikou (max curing přes všechny třídy, per-class warnings).

---

## 2. Expected behavior

Beton označený XF1+XD1+XC4 musí vyhovět VŠEM uvedeným třídám současně — engine má dostat celý seznam a sám spočítat curing z nejnáročnější (`getExposureMinCuringDays` už bere max přes pole; komentář v kódu přímo cituje „bridge deck (XF2+XD1+XC4) correctly uses 5d (XF2 max) not 0d (XC4 alone)").

---

## 3. Actual behavior

Živý prohon: dříky dostaly jen XF1 → engine: `⚠️ XF1 neobvyklá pro dříky pilířů, vyberte XF2/XF4`. První třída ze stringu ≠ garantovaně vedoucí; nebezpečný případ je opačné pořadí — «C30/37-XC4+XF4» by předalo XC4 a curing by vyšel bez XF4 minima (7 d).

---

## 4. Reproduction steps

1. `parseConcreteClassString('C30/37-XC4+XF4')` → `exposure_class: 'XC4'`, `exposure_all: ['XC4','XF4']`.
2. `mapPassportToPlannerInputs` staví input jen s `exposure_class` (ř. 184) — `exposure_all` se nikam nepředá.
3. **Pozoruji:** engine počítá curing jen z XC4 (0 d floor), XF4 minimum 7 d se ztratí; warning o XF4 se nikdy neukáže.

---

## 5. Affected scenarios

- Všechny passport-driven výpočty, kde TZ třída nese víc expozic (v praxi téměř vždy — mostní beton má typicky 2–3 třídy).

## 6. Impact

- **Rozpočtář:** ошетřování/zrání poddimenzované, když nejnáročnější třída není první v pořadí; plán dní může být kratší, než norma dovolí.
- **Business:** quality/correctness (harmonogram), ne přímé peníze jako height-bug.
- **Workaround:** přepsat pořadí tříd v passport stringu (nejnáročnější první) — křehké, nikdo to neví.

## 7. Evidence

- Živý MCP output: ⚠️ XF1 pro dříky (jen první třída doletěla).
- Kód: `bridge-passport.ts:81` (`exposure_class: exposures[0]`), `:184` (jen single pole); engine `planner-orchestrator.ts:307-313` — `exposure_classes` je preferované API, `:1566` auto-wrap.
