# passport-exposure-single — Verify

> **Bug ID:** `passport-exposure-single`
> **Status:** verified → **CLOSED**
> **Owner:** Alexander Prokopov
> **Datum verifikace:** 2026-07-11
> **Prerequisites:** fix.md deployed (PR #1486 → main `bf3b464`)

---

## 1. Verification environment

- **Environment:** production (prod MCP)
- **Version:** main `bf3b464` (#1486)
- **Verified by:** Alexander (tentýž reálný passport)

## 2. Reproduction check

- [x] Dříky: mapper předal **celý set** `exposure_classes: ["XF1","XD1","XC4"]` — ne jen první token ✅

## 3. Acceptance criteria check

| Criterion | Status | Evidence |
|---|---|---|
| Všechny TZ třídy doletí | ✅ | `["XF1","XD1","XC4"]` v inputu dříků |
| Engine flaguje netypické per-class | ✅ | `⚠️ XF1, XD1 neobvyklé pro dříky, vyberte XF2/XF4` — SPRÁVNÉ chování (viditelný TZ-vs-doporučení signál, flag never gate), ne bug mapperu |
| Curing z nejnáročnější třídy | ✅ | engine bere max přes set (combined-rules) |

## 8. Sign-off

- [x] **Closed.**

## 10. Learnings

- Varování po fixu NEZMIZELO a nemělo zmizet — TZ dříkům opravdu přiřadila XF1; fix je o tom, že engine VIDÍ celý set a rozhoduje sám. Rozdíl „bug mapperu" vs „čestný domain signál" je přesně to, co verify na produkci umí rozlišit.
