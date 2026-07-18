# Pre-Implementation Interview — dvě aritmetiky dní

**Status:** ČEKÁ na Alexandra. Kód se nepíše, dokud nejsou zodpovězeny Q1–Q6.
Předběžné pozice (P) jsou z verdiktu 2026-07-18 — potvrdit / opravit.

---

## Q1 — Kdo vyhrává při konfliktu: ruční editace vs kalkulátorová projekce?

Když element prošel «Aplikovat» (má `schedule_info`) a pak uživatel ručně změní
`days` některého řádku:

- **(a)** Ruční editace INVALIDUJE projekci: `schedule_info` se označí `stale`,
  všichni čtenáři (Celkem dní / Gantt / KPI Čas) přepnou na ruční SUM a ukážou
  badge «ručně upraveno — přepočítat kalkulátorem?». *(P: Alexander — toto.)*
- **(b)** Ruční editace se do projekce vpíše (přepočet overlaps in-place).
- **(c)** Projekce vyhrává tiše (dnešní stav — ruční editace neviditelná).

**P → (a).** Potvrdit. Otevřené pod-otázky pokud (a):
- Q1.1: «přepočítat» = tlačítko, které smaže `schedule_info` a nechá element na
  ruční SUM, nebo které znovu otevře kalkulátor?
- Q1.2: stale-flag je per-element (celý blob), ne per-řádek? (blob je na beton-pozici)

## Q2 — Editace zrání: kalendář, nebo osobo-hodiny?

- **(a)** Editace `days` řádku zrání = editace KALENDÁŘE (technologické čekání) —
  peníze se NEhýbou (zrání už dnes `cost=0`), mění se jen kdy skončí zrání a tedy
  kritická cesta. *(P: Alexander předběžně — toto.)*
- **(b)** Zrání nese osobo-hodiny ošetřovatele (kalkulátor emituje 1 os. × 5h/den)
  → editace dní by měla hýbat i Nh ošetřování.

**P → (a) pro peníze-neutralitu**, ALE pozor na konflikt: kalkulátor DNES emituje
ošetřování jako placený-Nh řádek (1 os. × 5h). Pokud zrání = čistý kalendář, kdo
nese Nh ošetřovatele? Rozhodnout: (a1) ošetřování zůstává vlastní Nh-řádek
oddělený od kalendáře zrání; (a2) nebo se Nh ošetřovatele odvozuje z délky zrání.

## Q3 — Jedno pravidlo skládání dní pro všechny čtenáře?

Dnes 3+ pravidla (kritická cesta / Σ všech řádků / Σ jen beton-řádků v exportu).
Cíl: JEDNA funkce «dny elementu», kterou volají tabulka, Gantt, export i KPI
(vzor: `isMonolithGroup` z bugu monolit-jen-monolity-predicate — jeden predikát
pro všechny povrchy).

- Q3.1: Když projekce EXISTUJE → `total_days` (kritická cesta). Když NEEXISTUJE
  nebo je `stale` → co? Sekvenční `Σ p.days` všech řádků, nebo overlap-aware i
  ručně (zrání jako překryv)? *(P: ruční = sekvenční SUM je poctivé a
  srozumitelné; overlap-aware bez kalkulátoru = předstírání přesnosti.)*
- Q3.2: Export musí sčítat STEJNOU množinu jako ElementBlock (dnes export jen
  beton-řádky, tabulka všechny) — sjednotit. Potvrdit.

## Q4 — «Tři nositelé zrání»: který je kanonický?

Řádek `subtype='zrání'.days` vs skalár `curing_days` na beton-pozici vs fáze
`schedule_info`. Návrh: **nositel je JEDEN** (řádek zrání = to, co uživatel vidí
a edituje), skalár i fáze jsou PROJEKCE odvozené z něj + kalkulátoru.

- Q4.1: `curing_days` skalár čte dnes jen nezapojený `calculateElementTotalDays`
  — smazat skalár, nebo nechat jako derived cache? *(P: derived-only, nikdy
  nezávislý zdroj.)*

## Q5 — Rozsah PR: jen tabulka, nebo i backend/export?

Divergence je na 6 místech (frontend tabulka/Gantt/KPI + backend export/formulas).
- **(a)** Vše jedním PR (jeden predikát dní + stale-flag + export sjednocení).
- **(b)** Frontend-viditelnost napřed (stale badge + jeden čtenář), export zvlášť.

**P → potvrdit rozsah.** Pozn.: sdílená funkce dní musí žít v `shared/` (jako
`isMonolithGroup`), aby ji viděl frontend i backend-export.

## Q6 — Viditelnost sdvigu pro uživatele

Badge «ručně upraveno — přepočítat?» — kde přesně? Na úrovni elementu (řádek
hlavičky partu), nebo i v KPI «Čas» kartě («N elementů ručně upraveno»)?
*(P: obojí — element badge + KPI souhrn, ať uživatel vidí kolik elementů je
mimo kalkulátorovou projekci.)*

---

## Po interview

Design.md (cílová architektura: jedna `computeElementDays` v shared + stale-flag
kontrakt + osud tří nositelů) → tasks.md (gaty) → implementace. Fixture:
SO 11-20-04 + ruční editace zrání = pin obou aritmetik na živých číslech.
