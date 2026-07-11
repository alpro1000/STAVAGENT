# passport-mcp-error-transport — Report

> **Bug ID:** `passport-mcp-error-transport`
> **Datum reportu:** 2026-07-11
> **Reporter:** Claude Code session (nalezeno code-review), potvrzeno Alexander (živý konektor)
> **Severity:** P2 (DX/robustness — funkce vrací typed error správně, transport ho maskuje)
> **Status:** analyzed → fixing
>
> **Affected:** MCP tool `calculate_from_passport` přes FastMCP transport (Claude.ai konektor, ChatGPT)
> **Version:** v4.39.0

---

## 1. What's broken

Na křivý passport vrací funkce typed error `{"error": "invalid_passport", "message", "details"}` (test `test_malformed_passport_rejected` to pinuje) — ale klient přes FastMCP transport dostane opakní chybu `outputSchema defined but no structured output` místo typované odpovědi.

---

## 2. Expected behavior

Agent/konektor na křivý vstup dostane srozumitelný typed error (invalid_passport + validace detail), se kterým může pracovat (opravit passport a zavolat znovu).

---

## 3. Actual behavior

Konektor hlásí `outputSchema defined but no structured output` — typed error se přes transport nedostane. Funkce-vrstva je v pořádku (5 skeptiků v Gate 2 gónalo validní fixtures; transportní cesta „křivý passport → co vrátí konektor" nebyla pokryta).

---

## 4. Reproduction steps

1. Přes Claude.ai konektor (nebo FastMCP in-process client) zavolat `calculate_from_passport` s passportem bez `_meta` / se špatným `schema_version`.
2. **Pozoruji:** místo `{"error": "invalid_passport", ...}` přijde opakní transport chyba.

---

## 5. Affected scenarios

- Každý MCP klient posílající nevalidní passport (agent iterující nad extrakcí half B — přesně cílový uživatel toolu).

## 6. Impact

- **Agent přes MCP:** nedostane důvod odmítnutí → nemůže passport opravit; vypadá to jako rozbitý tool, ne jako špatný vstup.
- **Business:** DX/robustness; nejnižší priorita ze tří passport bugů (height = peníze, exposure = korektnost).
- **Workaround:** validovat passport předem proti `bridge_passport.py` mimo tool.

## 7. Evidence

- Živé pozorování konektoru (Alexander).
- Hypotéza root cause (viz analyze.md): `ve.errors()` v pydantic v2 může nést ne-JSON-serializovatelné objekty v `ctx` → FastMCP nesloží structured content.
