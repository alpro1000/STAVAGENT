# passport-height-skruz — Verify

> **Bug ID:** `passport-height-skruz`
> **Status:** verified → **CLOSED**
> **Owner:** Alexander Prokopov
> **Datum verifikace:** 2026-07-11
> **Prerequisites:** fix.md deployed (PR #1486 → main `bf3b464`, CORE + Monolit backend deploy 2026-07-11)

---

## 1. Verification environment

- **Environment:** production (prod MCP → Cloud Run engine)
- **Version:** main `bf3b464` (#1486)
- **Verified by:** Alexander (živý prohon TÉHOŽ reálného passportu jako při reportu)

## 2. Reproduction check

- [x] Tentýž passport přes prod MCP `calculate_from_passport`
- [x] Mapper předal `height_m: 14.9` + ℹ️ nota «Výška skruže odvozena z geometry.decks … max = 14.9 m … konzervativně»
- [x] **⛔ „Mostovka vyžaduje skruž … není zadána výška" se NEOBJEVIL** ✅

## 3. Acceptance criteria check

| Criterion | Status | Evidence |
|---|---|---|
| height_m doletěl z geometry | ✅ | `height_m: 14.9` v mapping inputu + nota |
| skruž/stojky reálně v aggregate | ✅ | props blok: **Staxo 100, 576 stojek/takt, 92,2 t, pronájem 42 d** → `props_rental_czk: 1 814 400` + `props_labor_czk: 653 357` = **2 467 757 Kč** nově ve smetě |
| aggregate vzrostl o skruž | ✅ | **6 325 799 → 9 531 702 Kč (+3 205 903, +51 %)**; dny 252 → 284 (delta = props + prodloužený harmonogram → mzdy/pronájmy) |

## 4. Regression check

- [x] Golden suite shared 1415/1415 (CI #1486), backend parity 42/42, MCP goldens 4/4
- [x] Pour-window signál zůstal (449.66 m³/takt fyzika křičí dál — správně)

## 8. Sign-off

- [x] **Closed** — bug verified živě na produkci.

## 10. Learnings (→ soul.md)

- **Impact byl PODhodnocen:** report odhadoval 15–25 % nákladů mostovky (engine warning text) — reálně chybějící skruž = **+51 % celého SO aggregate** (třetina smety objektu). Skruž + stojky na 15m předpjatém mostě je největší jednotlivá položka.
- **Verify-na-produkci je nenahraditelný:** zelené golden testy autora prošly, protože fixture procházel mapper — ale nikdo neassertoval, že ČÍSLO v aggregate vzrostlo o cenu skruže. Golden po fixu už to pinuje (falsework > 0), příště pinovat i řádový dopad na aggregate.
