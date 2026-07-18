# PR2 Breakdown Geometry Parity — RECON MAP + INTERVIEW

**Status:** RECON HOTOVO. **KÓD SE NEPÍŠE** — spec §0.3 + §3 vyžadují
Pre-Implementation Interview. Níže mapa terénu + odpovědi na Q-A…Q-D z
recon + nové vidličky, které recon vskrýl. ČEKÁ na Alexandra.

**Metoda:** 2 read-only Explore agenti (internals + callers), 2026-07-18.
Řádky k datu reconu — před implementací re-grep.

---

## 1. Mapa terénu (kde breakdown bere geometrii)

Tři přeceňující heuristiky, všechny v `create_work_breakdown`
(`concrete-agent/.../app/mcp/tools/breakdown.py`), krmené konstantami, které
NEČTOU žádné vstupní pole:

| defekt | řádek | vzorec | konstanta |
|---|---|---|---|
| soffit (horizontální bednění) | breakdown.py:779 | `fw_area = volume / 0.25` | tl. 0.25 fikce |
| stěny / fundamentní bloky | breakdown.py:791-792 | `width=0.3; fw_area = volume/width×2` | ~×7 vs TS |
| skruž (podstavec) | breakdown.py:871 | `qty = (volume/thickness)×height` | tl. 0.25 fikce |
| curing_area | breakdown.py:814 | `curing_area = volume/thickness` | bez TS-protějšku |

Seed konstanty: `thickness = 0.25 (0.15 blinding)` (breakdown.py:740),
`width = 0.3` (791). **Ani jedna nečte reálné vstupní pole** — pole
`thickness`/`width_m` v kontraktu neexistují.

**TS kánon (parity-cíl):** `element-geometry.ts:75-79` — `V=L·W·H`,
`formwork = 2(L+W)·H`; `estimateFormworkArea` (`planner-orchestrator.ts:2866-2962`)
— reálné aspect/thickness modely (foundation block perimeter×H aspect 1.5/10;
vertical aspect 3; horizontal avgThickness 0.5/0.6). Tubus je z obojího
vyňat (§2.10, NON_PRISMATIC) — netýkat se.

**Skruž bundling (§2.3):** `CATALOG_BUNDLING` (breakdown.py:231-235) =
`{otskp: {bedneni, osetrovani}, urs: ∅, rts: ∅}`. **Skruž NENÍ v bundle** —
je vlastní work-type (`classify_work_type` → `skruz`, catalog_matching.py:52,
řešeno PŘED bedneni). Její nafouklé množství tedy jde jako vlastní řádek na
OBĚ větve.

**ÚRS vs OTSKP (§2.6):** OTSKP bandluje bedneni/osetrovani do betonu
(přeceněná opalubka SKRYTÁ). ÚRS/RTS má prázdný bundle → **emituje opalubku
per-řádek** → nafouklá množství jdou přímo do offert privátních zakázek
(hk212, RD Jáchymov). URS status cap `candidate`, floor 0.80.

---

## 2. Odpovědi na interview-vidličky z reconu

### Q-A (KRITICKÁ) — jaké % vызовů nese height/width/length?

**Recon verdikt: derived-větev je NEDOSAŽITELNÁ pro většinu reálných volání.**

| Vызывающий | file:line | Geometrie |
|---|---|---|
| Jediný živý orchestrátor `_atomize_step` | `recipe_runner.py:301,359-367` | z DOCUMENT_ANALYSIS |
| ↳ soupis join `map_soupis_to_elements` | `soupis_quantity_join.py:373,423` | JEN `volume_m3` (+ rebar/prestress mass, rimsa length_bm). NIKDY height/width/area/length_m |
| ↳ TZ extraktor `extract_tz_fields` | `:484-521` | `{name, object_code, concrete_class, volume_m3=None}`. Geometrie NK zůstává na objektu, NEpřipne se na `elements[]` (komentář :124 «height je v próze») |
| REST `BreakdownElement` | `routes.py:1569-1580` | schéma NESE `volume_m3/height_m/area_m2/length_m` (vše Optional), **NE `width_m`** — ale žádný in-repo klient je neposílá |
| Passport | — | create_work_breakdown NEVOLÁ (grep) |
| Frontend (Monolit/Portal) | — | breakdown-endpoint NEDĚRGÁ (jen UI-stringy) |
| Testy | fixtury | JEDINÉ místo, kde geometrie spolehlivě je (schválně, aby testovaly computed-větev) |

→ Reálná volání dnes končí na `volume`-only cestě → `assumed` odhady
(nebo NEPOČÍTÁNO u tubusu/nula). **Odvození opalubky z geometrie vyžaduje
NEJDŘÍV rozšířit vstupy vызывающих (TZ extraktor + soupis join), ne jen
změnit breakdown.py.**

### Strukturní strop (test_row11 pin)
`BreakdownElement` (routes.py) NEMÁ `width_m` → TS pravidlo `2(L+W)·H`
LITERÁLNĚ nelze aplikovat na MCP povrchu bez změny kontraktu
(ticket `breakdown-element-width_m-contract`).

### Q-B — parity-допуск: strict vs ε? → k rozhodnutí (P: ε pro zaokrouhlení jednotek).
### Q-C — osud pinů #1514: 1:1 positivní parity-наследник za každý snятý pin (report PR). Souhlas.
### Q-D — viditelnost sdvigu (warnings_structured «dřívější odhad ×N odstraněn»)? → k rozhodnutí.

---

## 3. Interview — otázky k ratifikaci (STOP, negádat)

**Q-A1 (nosná):** Vzhledem k tomu, že derived-větev je dnes nedosažitelná
(soupis join + TZ extraktor nesou jen volume) — pořadí PR2:
- **(a)** NEJDŘÍV honest NEPOČÍTÁNO: smazat 0.25/0.3 fikce, volume-only →
  «chybí tl./výška/délka — vstup X». Většina dnešních čísel s odhadem se
  stane NEPOČÍTÁNO (spec §2.2 to CHCE — jistá čuš > honest díra, precedent
  tunel 8,3M). Rozšíření vstupů = navazující PR.
- **(b)** NEJDŘÍV rozšířit vstupy (soupis join / TZ extraktor plní
  height/width/length → contract `width_m` na BreakdownElement) → PAK derived
  parity. Větší, dotýká se extraktoru.

*(P: (a) — menší, honest hned, odblokuje privátní offerty od nafouklé
opalubky; (b) jako navazující. Ale je to tvůj call — mění to rozsah PR2.)*

**Q-A2:** Contract `width_m` na `BreakdownElement` — součást PR2, nebo
samostatný ticket `breakdown-element-width_m-contract`? *(P: samostatný,
protože derived-parity na width závisí a bez vызывающих je stejně mrtvá.)*

**Q-B:** Parity-допуск proti TS: strict rovnost, nebo ε (např. ±1 %)?

**Q-D:** V prvním releasu warnings_structured nota «dřívější odhad ×N
odstraněn» — potřeba (audit trail sdvigu), nebo šum?

**Q-skruž:** §2.3 — ověřit reálnou specifikaci OTSKP 421/422-семьи: bandluje
se skruž mostovky do NK-položky (TKP/spec), nebo ne? Metoda #1519 (pravidlo
z katalogu s citací). Mám na to pustit recon do OTSKP XML + TKP, nebo máš
spec po ruce?

---

## Po interview
design.md (jeden zdroj geometrie: parity s `estimateFormworkArea` /
`element-geometry`, lestница explicit→derived→NEPOČÍTÁNO) → tasks.md (gaty) →
implementace. Fixtura SO 11-20-04 (§AC4: stěny ~180 m²/захватка, строп
~52 m²/захватка z Excelu Alexandra ±5 %). Tubus netýkat (AC7).
