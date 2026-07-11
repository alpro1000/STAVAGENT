# passport-mcp-error-transport — Analyze

> **Bug ID:** `passport-mcp-error-transport`
> **Status:** analyzed (root cause REPRODUKOVÁN lokálně, in-process FastMCP client)
> **Owner:** Claude Code session 2026-07-11
> **Prerequisites:** report.md

---

## 1. Audit findings

- `app/mcp/tools/passport_plan.py:103-108` — invalid_passport větev vrací `"details": ve.errors()`.
- pydantic 2.x: `ve.errors()` u custom `field_validator` ValueError vrací záznam s `ctx: {'error': ValueError(...)}` — **živý exception objekt, není JSON-serializovatelný** (`json.dumps` → TypeError).
- FastMCP 3.x: tool s návratovou anotací `dict` deklaruje outputSchema `{"type":"object", additionalProperties: true}`; při stavbě structured content serializuje návratový dict → serializace selže → FastMCP vyhodí `ToolError: Output validation error: outputSchema defined but no structured output returned`. Klient (Claude.ai konektor) vidí přesně tuto opakní hlášku.
- **Repro (2026-07-11, in-process `fastmcp.Client`):** passport se `schema_version: "999"` → RAISED `ToolError: Output validation error: outputSchema defined but no structured output returned`. Tentýž dict s `ve.errors(include_url=False, include_context=False, include_input=False)` je JSON-safe (`type`/`loc`/`msg` zachovány, msg nese celý detail).
- Ostatní error větve (`to_error_dict`, broad-except `str(e)`) jsou string-only → serializovatelné; maskuje se JEN validation path.
- Existující test `test_malformed_passport_rejected` volá funkci PŘÍMO (bez transportu) — proto zelený.

## 2. Root cause

`ve.errors()` bez sanitace nese ne-serializovatelné `ctx` objekty; FastMCP structured-output serializace na nich selže a nahradí typed error opakní transport chybou.

## 3. Why it wasn't caught earlier

- [x] Missing transport-level test (funkce testována přímo; „křivý passport → co vidí konektor" nikdo negónal).
- [x] Design gap — authoring rules pro MCP tools neříkají „error dict musí být JSON-serializovatelný" (doplnit do CLAUDE.md authoring rules — fix.md).

## 4. Confidence level v root cause

- [x] **High** — reprodukováno lokálně end-to-end včetně přesné hlášky z konektoru.

## 5. Possible fix approaches

### 5.1 Approach A: sanitovat details (`ve.errors(include_url=False, include_context=False, include_input=False)`) — ZVOLENO

**Pros:** minimální, zachová typed-error tvar (`error`/`message`/`details`), msg nese plný detail; žádná změna schématu. **Cons:** ztrácí `input` echo (agent ho má — sám ho poslal). **Effort:** 1 řádek + transport test.

### 5.2 Approach B: raise ToolError místo error dictu

**Cons:** mění kontrakt (isError=true text místo typed dictu), rozchází se s konvencí ostatních tools (error dicty, `_err_text`); klienti by parsovali text. Zamítnuto.

### 5.3 Approach C: definovat explicitní outputSchema s error variantou (anyOf)

**Cons:** neřeší serializaci (ctx objekt spadne i tak); jen kosmetika schématu. Zamítnuto.

### 5.4 Doporučení

Approach A + **transport test** `test_mcp_passport_error_transport.py`: in-process `fastmcp.Client` → `call_tool` s křivým passportem → assert structured content nese `error: "invalid_passport"` (a NE ToolError). Test běží v MCP CI lane (fastmcp installed) → registrovat do `test-mcp-compatibility.yml` (3 místa: push paths, PR paths, pytest list — stejně jako parity test 2026-07-11).

## 6. Related risks

- Stejný vzor (`ve.errors()` bez sanitace) může být v jiných tools/routes — grep při fixu; nalezené výskyty buď opravit (pokud jdou přes FastMCP transport) nebo aspoň zmínit ve fix.md.

## 7. Affected steering / specs

- [x] Root CLAUDE.md „Authoring rules for MCP tools" — doplnit pravidlo o JSON-serializovatelných error dictech.
