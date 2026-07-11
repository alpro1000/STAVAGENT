# passport-mcp-error-transport — Fix

> **Bug ID:** `passport-mcp-error-transport`
> **Status:** fixed (PR pending merge)
> **Approach:** analyze.md §5.1 Approach A (sanitace details) + §5.4 transport test

---

## 1. Changes

- `app/mcp/tools/passport_plan.py` — `details: ve.errors(include_url=False, include_context=False, include_input=False)`; `msg` nese plný lidský detail, žádné živé objekty v payloadu.
- `tests/test_mcp_passport_error_transport.py` (nový) — 2 testy:
  1. in-process `fastmcp.Client` → `call_tool` s křivým passportem → structured content nese `error: "invalid_passport"` + detail s `loc`/`msg` (NE ToolError o chybějícím structured outputu);
  2. celý error payload projde `json.dumps` (přesná vlastnost, jejíž absence bug způsobila).
  `pytest.importorskip("fastmcp")` — lokálně bez fastmcp se skipne, běží v MCP CI lane.
- `.github/workflows/test-mcp-compatibility.yml` — test registrován ve 3 místech (push paths, PR paths, pytest list).
- Root `CLAUDE.md` „Authoring rules for MCP tools" — nové pravidlo: error dicty striktně JSON-serializovatelné + typed-error cesty vyžadují transport-level test.

## 2. Verification

- Lokálně (fastmcp 3.4.4 + pydantic 2.13): PŘED fixem repro vrací `ToolError: Output validation error: outputSchema defined but no structured output returned` (přesně hláška z konektoru); PO fixu 2/2 transport testy + 4/4 existující goldeny zelené.
- Živá verifikace po deployi: konektor na křivý passport vrátí typed `invalid_passport` (verify.md po deployi).

## 3. Related

- Grep potvrdil: `ve.errors()` bez sanitace bylo jediné výskyt v `app/` — třída chyby uzavřena i pravidlem v CLAUDE.md.
