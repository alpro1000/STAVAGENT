# Žihle 2062-1 (2026) — Mostovy ZS pilot

**Project type:** mostovy (silnice III/206 2 mostek)
**Project scope:** Most ev.č. 2062-1 u obce Žihle, přestavba D&B
**Project size:** 10.5 M Kč hlavní práce
**Duration:** 11 měs
**ZS+PH+VRN total:** 2 708 126 Kč (Session 4 recalibrated)
**ZS poměr:** **22.6 %** (long-duration small project disproportion — Pattern A)
**Source year:** 2026 (current pilot)

## Reference back to current pilot

This is the active pilot project. All artifacts:
**`test-data/most-2062-1-zihle/`**

**Full real-world example KB entry:**
**`B5_tech_cards/real_world_examples/zihle_2062_1/`** — METADATA + master_soupis_summary +
reconciliation_findings (G1-G4) + vendor_pricing_snapshot (anonymized) + patterns_validated.

Specifically:
- `04_documentation/master_soupis/master_soupis_SO_801.yaml` — 25 položek 1.20 M
- `04_documentation/master_soupis/master_soupis_PRESUN_HMOT.yaml` — 3 položek 0.56 M
- `04_documentation/master_soupis/master_soupis_VRN.yaml` — 13 položek 0.94 M
- `04_documentation/master_soupis/master_soupis.yaml` — index file

## Status

- Session 1 (audit): commits 7d0d9135..ea5b286a
- Session 2 (per-SO master soupis): commits cc9dd1e2..4d1199f4
- Session 2 wrap (Phase E + TZ + tender_ready): commit 218f03a2
- ZS+PH+VRN initial detailized retrofit: commit 25e913dc
- ZS Kfely benchmark recalibration: **Session 4 (current)**

## Why kept here in KB

Žihle is the first STAVAGENT-completed mostovy pilot. As a **production-shaped reference**
for future mostovy projects:
- Per-SO YAML structure = canonical layout
- 11-column XLSX schema (Session 4) = canonical export schema
- 7 patterns from `docs/STAVAGENT_PATTERNS.md` validated here
- 4 patterns from `../../PATTERNS.md` (B/C/D/F) applied/validated

When 2nd mostovy pilot starts, copy `test-data/most-2062-1-zihle/` skeleton + apply
this METADATA's lessons.

## Lessons from Žihle (post-Session 4)

1. **D6 highway template was wrong default.** Kfely mostovy benchmark recalibration
   (Session 4) required -248k delta. Future mostovy projects: start from Kfely
   benchmark, NOT D6.
2. **Long-duration small projects → high ZS poměr.** Žihle 22.6 % vs typical mostovy
   5-8 %. This is correct (Pattern A), not over-scoped — fixed monthly costs (polír,
   buňky, oplocení nájem) accumulate over 11 měs vs Kfely 7 měs.
3. **Grid + záložní generator** = correct default for mostovy v obci. Generator
   primary is only for remote venkov (Kfely-style open spaces).
4. **Part-time stavbyvedoucí** is real CZ market practice for small mostovy. 30k/měs
   ~12 hod/týden. Full-time polír 90k/měs disproportionate pre projekty < 20 M.

## Outstanding flags

P0 blockers documented v `test-data/most-2062-1-zihle/metadata.yaml::outstanding_blockers_pre_DUR`:
- Povodí Vltavy souhlas missing (parcels 1836+385/13)

D6+Kfely unit prices = 2022. Vendor RFQ before tender for accurate 2026 prices.
