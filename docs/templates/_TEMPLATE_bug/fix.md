# {Bug ID} — Fix

> **Bug ID:** `{bug-id-kebab}`
> **Status:** fixing | fixed (pre-verify) | verified
> **Owner:** Claude Code session / {dev}
> **Prerequisites:** `analyze.md` approved

---

## 1. Fix approach chosen

[Z `analyze.md` §5 — který approach a důvod.]

---

## 2. Changes made

> **Popis v doménových termínech, ne v file paths.**
> Konkrétní soubory jdou do PR diff, ne sem.

### 2.1 Backend changes

- {Doménové popis 1 — co se změnilo}
- {Doménové popis 2}

### 2.2 Frontend changes

- {Pokud relevant}

### 2.3 Schema / DB migrations

- {Pokud relevant — co se přidalo/odebralo na úrovni konceptu}

### 2.4 Config / infra changes

- {Pokud relevant}

---

## 3. Tests added/modified

### 3.1 Unit tests

- [ ] {Test 1 — co pokrývá}
- [ ] {Test 2}

### 3.2 Integration tests

- [ ] {Test}

### 3.3 Golden tests

- [ ] {Pokud relevant — který golden test cover}

### 3.4 Regression tests

> **Důležité:** Test který by tento bug zachytil příště.

- [ ] {Regression test name}

---

## 4. Confidence scoring check (STAVAGENT-specific)

[Pokud bug se týkal data fusion / merging.]

- [ ] Source confidence dodržen
- [ ] High doesn't overwrite low — ověřeno v testu
- [ ] Citation / provenance zachována

---

## 5. Backward compatibility

- [ ] **Plně backward compatible** — žádný existující uživatel/data nedotčen
- [ ] **Migration needed** — viz §6
- [ ] **Breaking change** — vyžaduje user announcement

---

## 6. Migration steps (pokud potřeba)

[Konkrétně co se musí udělat při deployi.]

1. {Krok 1}
2. {Krok 2}

---

## 7. Deployment plan

- [ ] Local testing complete
- [ ] Staging deploy
- [ ] Staging verification (manual + automated)
- [ ] Canary (pokud P0/P1)
- [ ] Production deploy
- [ ] Monitor for {N} hours/days
- [ ] Sign-off

---

## 8. Risks introduced (pokud nějaké)

[Co nového by se mohlo pokazit po fixu. Drift detection.]

| New risk | Likelihood | Mitigation |
|---|---|---|
| {What} | Low/Med/High | {How} |

---

## 9. Affected steering / specs (post-fix)

[Co je třeba updatovat v steering/spec dokumentech po tom co bug je opraven.]

- [ ] `docs/steering/{X}.md` — update sekce {Y}
- [ ] `docs/specs/{X}/requirements.md` — add acceptance pro tento případ
- [ ] `docs/soul.md` — log learning v Session log

---

## 10. Commit / PR references

- Branch: `bug/{bug-id}`
- Commits: [List]
- PR: [Link po vytvoření]

---

## 11. Versioning

| Date | Version | Changes |
|---|---|---|
| {YYYY-MM-DD} | 0.1 | Initial fix proposal |
