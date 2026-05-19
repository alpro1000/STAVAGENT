# {Bug ID} — Analyze

> **Bug ID:** `{bug-id-kebab}`
> **Status:** analyzing | analyzed
> **Owner:** Claude Code session / {dev}
> **Prerequisites:** `report.md` confirmed reproducible

---

## 1. Audit findings

> **Inventarizace existujícího kódu před hypothesis.**

- Soubory které prozkoumány:
  - {Path / oblast 1}
  - {Path / oblast 2}
- Existující testy které k tomu vztahují:
  - {Test name}
- Předchozí PRs/commits které k tomu mohou souviset:
  - {PR #X — title}

---

## 2. Root cause

[1-3 věty: kde přesně bug vzniká a proč.]

[Příklad: "V `app/api/projects.py` endpoint `/api/projects` selektuje ze stávající tabulky bez filtru na `owner_id`. JWT subject se sice validuje na middleware, ale výsledek selectu se vrací bez další scope-down kontroly. Důsledkem je, že každý autentizovaný uživatel vidí všechny řádky."]

---

## 3. Why it wasn't caught earlier

[Pochopení proč se to do produkce dostalo. Aby se to neopakovalo.]

- [ ] Missing unit test pro {scénář}
- [ ] Missing integration test
- [ ] Missing manual QA step
- [ ] Spec gap — `requirements.md` to nepokrylo
- [ ] Design gap — `design.md` to neuvažoval
- [ ] Jiné: {co}

---

## 4. Confidence level v root cause

- [ ] **High** — root cause definitivně identifikovaná, reprodukoval jsem `analyze.md` hypotézu
- [ ] **Medium** — root cause pravděpodobná, ale nutno ověřit s fixem
- [ ] **Low** — hypothesis, potřeba další investigation

---

## 5. Possible fix approaches

[Více než jeden přístup — porovnání. Final výběr v `fix.md`.]

### 5.1 Approach A: {Název}

- **Pros:** {Co tím získáme}
- **Cons:** {Co tím riskujeme}
- **Effort:** {Hours / story points / "trivial"}

### 5.2 Approach B: {Název}

- **Pros:** ...
- **Cons:** ...
- **Effort:** ...

### 5.3 Doporučení

{Který approach a proč.}

---

## 6. Related risks

[Co dalšího může pokrýt tento bug nebo ho podobně reprodukovat.]

- {Related risk 1}
- {Related risk 2}

---

## 7. Affected steering / specs

[Pokud root cause odhalí, že některé steering/spec dokumenty jsou unprecise — uvést.]

- [ ] `docs/steering/{X}.md` se musí update
- [ ] `docs/specs/{X}/requirements.md` měl mít acceptance pro tento případ

---

## 8. Confidence rule check (STAVAGENT-specific)

[Pokud bug zahrnuje data fusion — zkontrolovat zda nedošlo k porušení rule "vysoký confidence nepřepisuje nízký".]

- [ ] Pravidlo dodrženo
- [ ] **PORUŠENO** — root cause souvisí s confidence inversion

---

## 9. Versioning

| Date | Version | Changes |
|---|---|---|
| {YYYY-MM-DD} | 0.1 | Initial analysis |
