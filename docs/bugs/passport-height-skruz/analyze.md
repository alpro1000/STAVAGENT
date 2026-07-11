# passport-height-skruz — Analyze

> **Bug ID:** `passport-height-skruz`
> **Status:** analyzed
> **Owner:** Claude Code session 2026-07-11
> **Prerequisites:** report.md — reprodukce potvrzena živým prod-MCP prohonem

---

## 1. Audit findings

- `Monolit-Planner/shared/src/parsers/bridge-passport.ts` — `height_m` jen z `qty?.height_m` (ř. 186); `geometry.decks` čteno jen pro `deck_width_m`.
- `docs/specs/tz-passport-json/example_SO202_zalmanov.json` — `deck_height_over_terrain_m` je **objekt per křížení** (`{road_III_00625: 8.1, stream: 14.9, field_road: 9.9}`), identický na obou (symetrických) decích. Navíc `superstructure.deck.constant_depth_m: 2.4` (stavební výška NK) existuje a mapper ji do `deck_thickness_m` také nepředává.
- `app/models/bridge_passport.py` — `DeckGeometry` pole `deck_height_over_terrain_m` NEdeklaruje (projde jen díky `extra="allow"`). Governance schématu: „STRICT on the fields half A consumes" → jakmile je mapper začne číst, musí být deklarovaná.
- Engine: `PlannerInput.height_m` = výška podpěr/skruže (v4.19 A1 split; tloušťka průřezu = separátní `deck_thickness_m`); `planner-orchestrator.ts:2154` počítá props/skruž jen při `height_m > 0`.
- Testy: `bridge-passport.test.ts` (golden 10) — žádná asserce na height; `test_bridge_passport_schema.py` validuje fixture proti Pydantic.

## 2. Root cause

Mapper implementoval jen `quantities`-cestu pro výšku; geometrická sekce passportu (kam ji half B reálně píše) nebyla napojena. Spec Gate 2 výšku explicitně nejmenoval mezi mapovanými poli — mapa vznikla z quantities+concretes, geometry jen pro šířku.

## 3. Why it wasn't caught earlier

- [x] Missing golden asserce: „height doletěl + skruž v aggregate" (goldeny kontrolovaly objemy/takty/třídy).
- [x] Spec gap — tz-passport requirements nevyjmenoval height→skruž jako AC.
- Živé ověření po deployi bylo v backlogu („po deployi CORE + Monolit-backend") — bug našel právě první živý prohon.

## 4. Confidence level v root cause

- [x] **High** — jediné čtecí místo `height_m` je ř. 186; engine skip-path potvrzen živým ⛔ warningem.

## 5. Possible fix approaches

### 5.1 Approach A: `height_m = max(všech hodnot deck_height_over_terrain_m napříč decks)` — ZVOLENO

Doménové odůvodnění (Alexander Q + engineering call):
- Skruž na poymě fyzicky nese **spodní líc NK** — башни stojí na terénu (roznášecí panely) a drží bednění soffitu. Rozhodující výška = nejvyšší pole (stream 14.9): nejvyšší věže řídí volbu systémové rodiny (Staxo 100 / Top 50 tall, 8–20 m) a systém se uprostřed mostu nemění.
- Hodnoty jsou per KŘÍŽENÍ podél mostu (ne per deck — decks jsou symetrické) → jeden element s `num_bridges` zůstává správný tvar; výška = max přes křížení.
- **Nevyčítáme `constant_depth_m` od výšky:** nevíme jistě, zda pole měří k niveletě nebo k soffitu (u podjezdné výšky bývá k soffitu). Použití raw max je chyba na drahou stranu (max o stavební výšku 2.4 m) — pro tendr ±10–15 % čestný směr; třídu systému u 14.9 nemění.
- Priorita: explicitní `qty.height_m` (ruční override v quantities) vyhrává nad odvozenou geometrií.
- Viditelnost: ℹ️ note „výška skruže odvozena z geometry… max(8.1, 14.9, 9.9) = 14.9 m".
- Bonus téže třídy (geometry nepřenesená do enginu): `superstructure.deck.constant_depth_m ?? structural_system.constant_depth_m` → `deck_thickness_m` (v4.19 pole; zpřesní volume-plausibility check).
- Pydantic: deklarovat `deck_height_over_terrain_m: Optional[Union[float, Dict[str, float]]]` v `DeckGeometry` (+ `constant_depth_m` v `Deck`).

**Pros:** minimální, konzervativní, honest-visible; žádná změna tvaru mappingu. **Cons:** nízká pole mostu mírně předražená (skruž počítána na max výšku). **Effort:** ~2 h vč. goldenů.

### 5.2 Approach B: per-span výšky → per-tact skruž

Rozpad na pole/takty s výškou per křížení. **Pros:** přesnější cena skruže u nízkých polí. **Cons:** engine nemá per-tact výšku skruže (jedno `height_m` per element) — vyžaduje engine změnu; mimo rozsah bug-fixe. **Effort:** dny. → follow-up ticket, ne teď.

### 5.3 Doporučení

Approach A. Golden: (1) mapping — mostovka `height_m === 14.9` + note; (2) end-to-end `planPassport` — plan mostovky NEobsahuje ⛔ „není zadána výška" a `costs` nese skruž/stojky (props/falsework > 0); (3) `deck_thickness_m === 2.4`; (4) `qty.height_m` override vyhrává; (5) Pydantic fixture validace beze změny.

## 6. Related risks

- Půdorysně extrémní asymetrie decků (jiný most) — max stále bezpečný (konzervativní).
- Passporty s `deck_height_over_terrain_m` jako plain number — fix musí přijmout number i objekt.

## 7. Affected steering / specs

- [x] `docs/specs/tz-passport-json` — AC doplnit: geometry heights → height_m (poznámka v fix.md).
