# budget-parser-routing — Fix

> **Bug ID:** `budget-parser-routing`
> **Status:** fixed (half-B Gate 2 PR); analyze sloučen do report §5-6 (root cause
> triviální — nonexistent imports; žádná alternativa přístupů)

---

## 1. Changes

- `app/mcp/tools/budget.py`:
  - importy opraveny na reálná jména `parse_xlsx_komplet` / `parse_xlsx_rtsrozp`;
  - nový `_positions_from_parsed_document(doc)` — flatten `ParsedDocument`
    (SO→chapter→position, přes `all_positions` property) na item-dicty;
    Decimal → float (JSON-safe, MCP transport rule);
  - fallback opraven na reálné `universal_parser.parse_any` a rozšířen z
    `except ImportError` na `except Exception` — pád dedikovaného parseru teď
    degraduje na univerzální (fallback-chain pattern, ARCHITECTURE.md);
    `diagnostics.primary_error` nese původní chybu viditelně.

## 2. Tests

`tests/test_budget_parser_routing.py` (4, hermetické — parsery monkeypatched):
flattener Decimal→float; komplet-routing; rts-routing; crash→universal fallback
s viditelným primary_error. Registrováno v MCP CI workflow (3 místa).

## 3. Verification

- Lokálně 4/4 + MCP compat lane v CI.
- Živě po deployi: EstiCon/KOMPLET-pojmenovaný soupis přes MCP vrátí items.
