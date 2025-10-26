# Changelog

## v1.5.0-M1 - 2025-10-19

- Added EU locale number normalisation with support for thin and non-breaking space thousand separators across Excel parsing and validation.
- Unified the `audit_results` contract (`totals`, `items`, `preview`, `meta`) for Workflow A caching, API responses and XLSX export.
- Refreshed the Excel exporter to emit populated `Audit_Triage` and `Positions` sheets based on the new contract schema.
