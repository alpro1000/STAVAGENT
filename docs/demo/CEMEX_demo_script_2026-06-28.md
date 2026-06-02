# CEMEX demo — scénář (deadline 28.6.2026)

**Cíl:** ukázat, že STAVAGENT automatizuje textovou/datovou vrstvu D&B nabídky pro
mostní/inženýrské objekty — výkaz výměr + kalkulace betonáže + OTSKP matching.
**Publikum:** CEMEX (dodavatel betonu) → důraz na objemy betonu, třídy, technologie
ukládání, CZK.
**Demo objekty:** SO-202 (most D6, OTSKP funguje) + SO-250 (opěrná/zárubní zeď, ŘSD D6).
**Záloha hloubky:** RD Jáchymov (247 položek, 374 atomic ops, plný audit trail).

> Pozicování: STAVAGENT = automatizace text/data vrstvy (TZ + soupis + audit trail +
> reconciliation), NE engineering CAD. Statika/výkres = projektant. To zužuje scope a
> posiluje produkt (ADR-005).

---

## 1. Co demo ukazuje (3 schopnosti)

1. **Kalkulátor betonáže** — z geometrie prvku → bednicí systém + harmonogram + četa +
   náklady práce. Deterministicky (regex/katalog před LLM).
2. **Správný technologický stack per prvek** — kalkulátor vybírá bednění dle typu prvku
   (ne nejlevnější, ale technologicky správné) + hlídá DIN 18218 tlak.
3. **Inteligentní varování** — jeřáb, stabilizační vzpěry, pořadí betonáže NK po spodní
   stavbě, pracovní spáry dle RDS.

---

## 2. Živé čísla (ověřeno golden testy 2026-06-02, 10/10 green)

| Prvek | Beton | Objem | Bednění (auto) | Dny | Práce Kč | Pronájem bednění Kč | Četa |
|---|---|---|---|---|---|---|---|
| SO-202 §5b Základ opěry OP1 | C25/30 | 35 m³ | **Frami Xlife** (DOKA) | 5.3 | 36 628 | 6 541 | 4T+4Ž+4B |
| SO-202 §5c Dřík opěry OP1 | C30/37 | 55 m³ | **TRIO** (PERI) | 6.4 | 63 582 | 31 571 | 4T+4Ž+4B |
| SO-202 §5f Mostovka NK | C30/37 | 605 m³ | **Top 50** (DOKA, nosníkové) | 326.7* | 3.97 M | 5.04 M* | 4T+4Ž+5B |
| SO-250 Opěrná zeď (záběr 33 m³) | C30/37 | 33 m³ | **TRIO** (PERI) | 4.7 | 38 081 | 13 807 | 4T+4Ž+4B |

\* Mostovka 605 m³ při 1 četě/1 čerpadle bez Resource Ceiling → 326 dní je
**záměrně nereálné jako ukázka**: v demu nastavit Resource Ceiling (12+ lidí, MSS skruž,
2+ čerpadla) → kalkulátor přepočte na reálných ~30–45 dní a sníží pronájem. Toto je
silný demo moment: *"u nás je fixně N lidí, jak to spočítáš?"* → Resource Ceiling.

> Pozn.: kalkulátor prvku počítá **práci + pronájem bednění**. Cena betonu (CZK/m³,
> třída, Dmax, konzistence) jde z modulu **Kalkulátor betonáže CZK/m³** — to je pro
> CEMEX nejrelevantnější vrstva, ukázat vedle.

---

## 3. Demo flow (~15 min)

1. **Intro (2 min)** — co STAVAGENT je, deterministic-first, pozicování (text/data, ne CAD).
2. **SO-202 most (6 min)** — postupně 3 prvky (základ → dřík → mostovka):
   - zadat geometrii → kalkulátor vybere bednění + spočte harmonogram + četu
   - ukázat *správný systém per prvek* (Frami pro základ, TRIO pro dřík, Top 50 pro mostovku)
   - ukázat varování (jeřáb, vzpěry, pořadí NK)
   - na mostovce ukázat **Resource Ceiling** (před/po — 326 → ~40 dní)
3. **SO-250 opěrná zeď (3 min)** — TRIO, dilatace 42 záběrů, ukázat per-záběr logiku.
4. **OTSKP (2 min)** — MCP `find_otskp_code` na položce → reálná databáze 17 904 kódů.
5. **Hloubka (2 min, na vyžádání)** — RD Jáchymov: 247 položek, audit trail, montáž/materiál
   split, vyjasnění projektantovi. *"Takhle vypadá kompletní výkaz."*

---

## 4. Klíčové talking points

- **Determinismus > AI** — regex/katalog běží PŘED LLM; vyšší confidence nikdy nepřepíše nižší.
- **Technologická správnost, ne nejlevnější** — bednění dle kanonické terminologie + DIN 18218.
- **±10–15 % přesnost** pro tendrovou kalkulaci — orientační odhad, detail u dodavatele (DOKA/PERI).
- **Audit trail per položka** — formula + vstupy + zdroj + confidence (právní dohledatelnost).
- **Resource Ceiling** — respektuje reálné zdroje firmy (lidi/čerpadla/skruž/deadline).

---

## 5. Příprava před demem (checklist)

- [ ] **Resource Ceiling pro mostovku** připravit hodnoty (12+ lidí, MSS, 2 čerpadla) — aby
      před/po přepočet seděl (jinak 326 dní mate publikum).
- [ ] **Modul CZK/m³ betonu** — ukázat vedle kalkulátoru prvku (pro CEMEX nejrelevantnější).
- [ ] **OTSKP MCP** — ověřit `/mcp/health` + `find_otskp_code` živě reachable.
- [ ] **Frontend** kalkulator.stavagent.cz — projít 3 SO-202 prvky předem (cache warm).
- [ ] **Fallback** — pokud služba spadne: golden testy lokálně (`npx vitest run golden-so202`)
      + tato tabulka čísel jako statická záloha.

---

## 6. Rizika / fallback

| Riziko | Mitigace |
|---|---|
| Cloud Run cold start / výpadek | golden testy lokálně + statická tabulka §2 |
| Mostovka 326 dní mate | Resource Ceiling nastaven předem (před/po) |
| Dotaz na cenu betonu | modul CZK/m³ připraven vedle |
| Dotaz "umíte celý rozpočet?" | RD Jáchymov 247 položek jako důkaz hloubky |

---

**Status golden testů:** SO-202 (7) + SO-203 (3) = 10/10 green (2026-06-02).
**Zdroje:** `test-data/SO_250/` (plný PD) · `test-data/tz/SO-202_D6_most_golden_test.md` ·
`Monolit-Planner/shared/src/calculators/golden-so202.test.ts`.
