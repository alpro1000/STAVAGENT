# Release Notes – v1.5.0-M1

- EU number parsing now recognises comma decimals and all common thin-space thousand separators, preventing quantity/price drift.
- Workflow A stores and serves a single `audit_results` contract with totals and item provenance for cache, API and exports.
- Excel export delivers populated **Audit_Triage** and **Positions** sheets driven directly by the contract payload.
