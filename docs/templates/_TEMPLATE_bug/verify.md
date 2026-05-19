# {Bug ID} — Verify

> **Bug ID:** `{bug-id-kebab}`
> **Status:** verifying | verified | failed
> **Owner:** Alexander Prokopov / QA
> **Datum verifikace:** {YYYY-MM-DD}
> **Prerequisites:** `fix.md` deployed (staging nebo production)

---

## 1. Verification environment

- **Environment:** local | staging | production-canary | production
- **Version:** {commit SHA / version tag}
- **Verified by:** {Kdo}
- **Date:** {Kdy}

---

## 2. Reproduction check

> Použít kroky z `report.md` §4.

- [ ] Step 1 — {expected: bug NEnastává}
- [ ] Step 2 — {expected: bug NEnastává}
- [ ] Step 3 — {expected: bug NEnastává}
- [ ] **Bug se NEopakuje** ✅

---

## 3. Acceptance criteria check

[Z `analyze.md` / `fix.md` — všechna kritéria fixu]

| Criterion | Status | Evidence |
|---|---|---|
| {Krit. 1} | ✅ / ❌ | {Screenshot / log / test output} |
| {Krit. 2} | ✅ / ❌ | {Evidence} |

---

## 4. Regression check

> Verifikuj že fix nerozbil něco jiného.

- [ ] Related feature 1: {Co — funguje OK}
- [ ] Related feature 2: {Co — funguje OK}
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All golden tests pass

---

## 5. Performance check (pokud relevant)

- [ ] Latency: {Před vs Po}
- [ ] Memory: {Před vs Po}
- [ ] DB query count: {Před vs Po}

---

## 6. User-facing impact

- [ ] Žádný uživatel nehlásil regresi po deployi
- [ ] Monitoring (errors, latencies) v normálu

---

## 7. Cross-env check

| Env | Verified | Date | Notes |
|---|---|---|---|
| Local | ☐ | | |
| Staging | ☐ | | |
| Production (canary) | ☐ | | |
| Production (full) | ☐ | | |

---

## 8. Sign-off

- [ ] **Closed** — bug verified, no further action needed
- [ ] **Re-opened** — verification failed, viz §9
- [ ] **Partial fix** — bug fixed in scope A, follow-up potřeba pro B

---

## 9. Re-opening notes (pokud verification failed)

[Pokud bug nebyl opraven nebo se vrátil — popis, co je špatně.]

- {Co konkrétně neprosло}
- Next steps: {Co dál — back to `analyze.md` nebo nový `analyze_v2.md`}

---

## 10. Learnings (do soul.md)

[Klíčové učení které stojí za to zaznamenat do `docs/soul.md` pro budoucí sessions.]

- {Learning 1}
- {Learning 2}

---

## 11. Versioning

| Date | Version | Changes |
|---|---|---|
| {YYYY-MM-DD} | 0.1 | Initial verification |
