# passport-mcp-error-transport — Verify

> **Bug ID:** `passport-mcp-error-transport`
> **Status:** verified → **CLOSED**
> **Owner:** Alexander Prokopov
> **Datum verifikace:** 2026-07-11
> **Prerequisites:** fix.md deployed (PR #1487 → main `6ffb7f0`)

---

## 1. Verification environment

- **Environment:** production (živý konektor → prod MCP)
- **Version:** main `6ffb7f0` (#1487)
- **Verified by:** Alexander (křivý passport přes konektor)

## 2. Reproduction check

- [x] Křivý passport → konektor vrátil čistý typed error, ŽÁDNÉ opakní «outputSchema defined but no structured output» ✅

## 3. Acceptance criteria check

| Criterion | Status | Evidence |
|---|---|---|
| Typed `invalid_passport` přežije transport | ✅ | `{"error":"invalid_passport","message":"Passport nevyhovuje schématu…","details":[…]}` |
| Details říkají CO chybí a KDE | ✅ | `{loc:["_meta","schema"],msg:"Field required"}`, `{loc:["quantities"],msg:"Input should be a valid dictionary…"}` — agent může passport opravit a zavolat znovu |

## 4. Regression check

- [x] Transport testy 2/2 + MCP compat lane zelené (CI #1487)

## 8. Sign-off

- [x] **Closed.**

## 10. Learnings

- Typed-error cesty se testují NA TRANSPORTU (in-process `fastmcp.Client`), ne přímým voláním funkce — pravidlo už v root CLAUDE.md authoring rules.
