# passport-height-skruz — Report

> **Bug ID:** `passport-height-skruz`
> **Datum reportu:** 2026-07-11
> **Reporter:** Alexander Prokopov (živý prod-MCP prohon reálného passport fixture)
> **Severity:** P0 (peníze ve smetě — aggregate podhodnocen o typicky 15–25 % nákladů mostovky)
> **Status:** analyzed → fixing
>
> **Affected:** shared mapper `bridge-passport.ts` (planPassport) → Monolit backend `/api/calculate-from-passport` → MCP `calculate_from_passport`
> **Version:** v4.39.0 (tz-passport Gate 2)

---

## 1. What's broken

Mapper `mapPassportToPlannerInputs` nepředává výšku mostovky (`geometry.decks[].deck_height_over_terrain_m`) do `PlannerInput.height_m` → engine přeskočí výpočet skruže + stojek a celý aggregate SO je podhodnocen o největší položku mostovky.

---

## 2. Expected behavior

Passport nese výšky nad terénem per křížení (`{road_III_00625: 8.1, stream: 14.9, field_road: 9.9}`). Mostovkový element má dostat `height_m` a engine má spočítat skruž (pevná skruž Top 50 / Staxo dle výšky) — pro předpjatou NK ve ~15 m je to typicky 15–25 % nákladů mostovky (engine to sám říká ve varování).

---

## 3. Actual behavior

Živý prohon (prod MCP, 2026-07-11):

```
⛔ Mostovka vyžaduje skruž (nosníky) + stojky, ale není zadána výška …
   chybí Skruž + Stojky (typicky 15-25% nákladů mostovky)
```

Výška v passportu JE (`geometry.decks[].deck_height_over_terrain_m`: stream 14.9, road 8.1) — mapper ji nečte. Skruž ve smetě NENÍ.

---

## 4. Reproduction steps

1. Vzít golden fixture `docs/specs/tz-passport-json/example_SO202_zalmanov.json` (nese `deck_height_over_terrain_m` na obou decích).
2. Zavolat `planPassport(passport)` (shared) nebo prod MCP `calculate_from_passport`.
3. **Pozoruji:** mostovkový element má `input.height_m === undefined`, plan obsahuje ⛔ „není zadána výška" warning, `costs` bez skruže/stojek.

---

## 5. Affected scenarios

- Každý passport-driven výpočet mostovky (MCP tool, backend route, budoucí UI viewer plánu).
- Nejvíc bolí u pevné skruže s velkou výškou (údolí/poyma — přesně SO-202 case).

## 6. Impact

- **Rozpočtář/agent přes MCP:** dostane celo-SO číslo bez největší nákladové položky NK — pod-nabídka v tendru.
- **Business:** finanční impact přímý (15–25 % NK), horší než transport-gap typed-error.
- **Workaround:** ručně zadat `height_m` do `quantities.items[]` (mapper čte `qty.height_m` — řádek 186) — ale extrakce (half B) tam výšku nepíše, píše ji do geometry.

## 7. Evidence

- Živý MCP output (Alexander, 2026-07-11): ⛔ warning výše + `num_tacts:3, tact_volume_m3:449.66` (mapper jinak funguje).
- Kód: `Monolit-Planner/shared/src/parsers/bridge-passport.ts:186` — jediný zdroj `height_m` je `qty?.height_m`; `geometry.decks` se čte jen pro `deck_width_m` (řádek 114).
- Engine: `planner-orchestrator.ts:2154-2199` — props/skruž jen když `input.height_m > 0`, jinak skip + ⛔.
