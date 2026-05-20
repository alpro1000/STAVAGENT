# {Feature Name} — Requirements

> **Spec ID:** `{feature-name-kebab-case}`
> **Datum:** {YYYY-MM-DD}
> **Status:** draft | review | approved | implementing | done
> **Priority:** P0 | P1 | P2 | P3
> **Owner:** Alexander Prokopov
>
> **Dependencies:** [List jiných specs/bugů na kterých tento depends]
> **Blocks:** [List specs/věcí které toto blokuje]

---

## 1. Kontext

### 1.1 Co teď je

[2-4 věty: jaký je stávající stav. NEpopisuj strukturu souborů — Claude Code si to najde sám.]

### 1.2 Proč to měníme

[2-4 věty: jaký problém řešíme. Pro koho? Jaký business outcome?]

### 1.3 Vztah ke steeringu

| Steering doc | Vztah |
|---|---|
| `product.md` | [Která sekce / mission point se sem vztahuje] |
| `tech.md` | [Které technologie / tier strategy se použije] |
| `structure.md` | [Kde v repu to bude žít] |
| `domain.md` | [Které doménové pravidlo se aplikuje] |
| `conventions.md` | [Co specifického pro session workflow] |

---

## 2. User stories

### 2.1 Story 1: {Title}

> **Jako** {role}
> **chci** {akce}
> **abych** {benefit}

### 2.2 Story 2: {Title}

> ...

---

## 3. Acceptance criteria (EARS format)

> **EARS format:** When/While/If [trigger/state] — then — Shall [observable behavior].
> Vždy **checkable** kritéria. Žádné "kvalitní kód", "dobrý výkon".

### 3.1 Krit. 1 — {Stručný název}

> **When** {trigger}
> **then** system **shall** {observable behavior}
> **Důkaz:** {Jak ověřím — golden test, API call, UI screenshot}

### 3.2 Krit. 2 — {Stručný název}

> **While** {ongoing state}
> **the system shall** {behavior}
> **Důkaz:** {ověření}

### 3.3 Krit. 3 — {Stručný název}

> **If** {edge case}
> **then** the system **shall** {behavior}
> **Důkaz:** {ověření}

[Pokračovat pro všechny acceptance criteria — minimum 3, maximum 15.]

---

## 4. Doménová pravidla

[Konkrétní business rules. Příklady:]

- "Vybavení CS6L-455MS: 76 ks v TZ a 76 ks v VV → match"
- "Kabel CXKH-R-J vs CXKH-R-O → mismatch (typ J ≠ O)"
- "Geologie XA1 → statika musí mít beton C30/37+"
- "Konfidence z OTSKP exact lookup = 1.00, nepřepisuje se AI návrhem (0.70)"

---

## 5. Out of scope (co toto **NENÍ**)

[Explicitní seznam co tento spec NEpokrývá. Drží scope.]

- ❌ {Něco co se může zdát jako součást, ale není}
- ❌ {Něco co bude v jiném spec}
- ❌ {Něco co je out of scope nadlouho}

---

## 6. Open questions

[Pokud něco není doдeфinováno — sem.]

- [ ] {Otázka 1 — kdo rozhoduje, do kdy}
- [ ] {Otázka 2}

---

## 7. References

- Steering: `docs/steering/{relevant}.md`
- Source TZ / norms: [Path to source files]
- Existující kód (pokud relevant): [Stručně co prozkoumat]
- Golden tests: [Pokud existují relevant]

---

<!-- ============================================== -->
<!-- PRAVIDLA PRO REQUIREMENTS.md:                    -->
<!--                                                  -->
<!-- 1. ŽÁDNÉ technické detaily (file names, types)  -->
<!--    Patří do design.md, ne sem.                  -->
<!--                                                  -->
<!-- 2. ŽÁDNÉ implementační kroky                    -->
<!--    Patří do tasks.md.                           -->
<!--                                                  -->
<!-- 3. EARS format pro každé acceptance kritérium   -->
<!--    Checkable, ne interpretable.                 -->
<!--                                                  -->
<!-- 4. Univerzalita po profesí (viz conventions §10)-->
<!--    Pokud spec se týká dokumentů — pamatovat:    -->
<!--    silnoproud, slaboproud, ZTI, VZT, ÚT,        -->
<!--    plynovod, MaR, statika, PBŘS, geologie,      -->
<!--    geodézie. Ne jen jeden obor.                 -->
<!-- ============================================== -->

---

## 8. Versioning

| Date | Version | Changes |
|---|---|---|
| {YYYY-MM-DD} | 0.1 | Initial draft |
