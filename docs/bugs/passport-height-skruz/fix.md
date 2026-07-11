# passport-height-skruz — Fix

> **Bug ID:** `passport-height-skruz`
> **Status:** fixed (PR pending merge)
> **Approach:** analyze.md §5.1 Approach A (max přes křížení, konzervativně bez odpočtu stavební výšky)

---

## 1. Changes

- `Monolit-Planner/shared/src/parsers/bridge-passport.ts`
  - Nový exportovaný helper `maxDeckHeightOverTerrain(decks)` — přijímá number i objekt per křížení, garbage-safe, vrací max > 0.
  - Mostovková větev: když `height_m` nepřišla z `quantities` (explicitní override vyhrává), odvodí se z geometry + ℹ️ note „Výška skruže odvozena z geometry… max = X m".
  - `superstructure.deck.constant_depth_m ?? structural_system.constant_depth_m` → `deck_thickness_m` (v4.19 pole; volume-plausibility).
- `concrete-agent/.../app/models/bridge_passport.py` — `DeckGeometry.deck_height_over_terrain_m: Optional[Union[float, Dict[str, float]]]` + `Deck.constant_depth_m` deklarovány (governance: half A je teď konzumuje → STRICT).

## 2. Tests (golden)

`bridge-passport.test.ts` +4:
1. deck `height_m === 14.9` (max(8.1, 14.9, 9.9)) + `deck_thickness_m === 2.4` + note;
2. explicitní `qty.height_m` vyhrává nad geometrií;
3. helper: objekt/number/garbage/empty;
4. end-to-end `planElement`: ŽÁDNÝ ⛔ „není zadána výška", falsework/props náklady > 0.

Pydantic drift-guard `test_bridge_passport_schema.py` 5/5 (fixture validace beze změny).

## 3. Verification

- shared 1415/1415, tsc clean, build OK; backend engine parity 42/42; MCP golden passport 4/4.
- Živá verifikace po deployi: prod MCP na reálném passportu NEMÁ ⛔ skruž warning a aggregate obsahuje skruž/stojky (viz verify.md po deployi).

## 4. Spec follow-up

- `docs/specs/tz-passport-json` AC doplněn tímto fix záznamem (mapovaná pole: geometry heights → height_m; constant_depth → deck_thickness_m).
- Follow-up (analyze §5.2): per-span výšky → per-tact skruž = engine změna, samostatný ticket až bude poptávka.
