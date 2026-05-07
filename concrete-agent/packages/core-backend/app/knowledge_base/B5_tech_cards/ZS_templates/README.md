# ZS Templates — Knowledge Base Index

**Path:** `concrete-agent/packages/core-backend/app/knowledge_base/B5_tech_cards/ZS_templates/`
**Purpose:** Cross-project reference corpus pre Zařízení staveniště + VRN pricing.
**Initialized:** 2026-05-08 (Žihle ZS retrofit Session 4).

## Classification matrix — 4 reference templates

| Template | Project type | Scope | Měs | ZS+VRN total | Poměr |
|---|---|---:|---:|---:|---:|
| **D6 SO 254** Opěrná stěna | highway / urban | 76 M | 12 | 7.5 M | 9.9 % |
| **D6 SO 205** | highway / urban | 21.8 M | 4.25 | 1.58 M | 7.2 % |
| **D6 SO 211/2** | highway / urban | 5.6 M | 2.5 | 1.45 M | **26 %** |
| **Kfely I/20** | **mostovy** | 70 M | 7 | 3.55 M | **5.0 %** |
| **Žihle 2062-1** (current) | **mostovy** | 10.5 M | 11 | 2.71 M | 25.7 % |
| Master vzor (blank) | generic 100 M / 10 měs | 100 M | 10 | qty=1 placeholders | n/a |

Žihle = mostovy (closest match Kfely I/20). D6 highway urban benchmark NOT applicable
without recalibration — see `PATTERNS.md` for highway-vs-mostovy delta breakdown.

## Directory structure

```
ZS_templates/
├── README.md                              ← this file (classification index)
├── PATTERNS.md                            ← cross-template patterns + benchmarks
├── highway_urban/
│   ├── D6_KV_Olsova_vrata_2022/
│   │   └── METADATA.md                    ← project metadata (XLS files NOT in repo;
│   │                                         path reference + extracted patterns only)
├── mostovy/
│   ├── Kfely_I_20_2022/
│   │   └── METADATA.md                    ← Kfely benchmark detail
│   └── Zihle_2062_1_2026/
│       └── METADATA.md                    ← link to current pilot
└── master_template_blank/
    └── METADATA.md                        ← canonical 100M/10měs structure ref
```

## Why this matters

A single project's ZS layout is an anecdote. Four reference templates with different
project types + scopes + durations make a **corpus** that lets us:

1. Detect when a new project's draft ZS deviates suspiciously from peer benchmark
   (e.g., Žihle initially applied D6 highway 200k BOZP — Kfely mostovy benchmark
   showed 80k is the right number for mostovy projects).
2. Justify pricing decisions to projektant/investor with cross-template evidence
   ("we use Kfely-style polír for small mostovy projects, ne D6-style full-time").
3. Onboard new pilot projects faster — pick correct base template by classification
   first, then customize.

## Important caveat — XLS file storage

The actual `.xls` files for D6 SO 254/205/211/2 + Kfely + blank vzor are **NOT
checked into this repo** (they live in user's local archive, may contain client/IČO
data not yet fully anonymized for KB inclusion).

Each `METADATA.md` file in subdirectories captures:
- Project metadata (type, scope, duration, ZS poměr)
- Source-of-truth file path / archive reference
- Extracted unit prices + structure patterns (anonymized)
- Cross-validation notes

When ready to anonymize and commit actual XLS templates, drop them in the
respective `original/` subdirectory alongside the METADATA.md.

## Anonymization rules

Before committing actual XLS files:
- Strip client/IČO/contact info from header rows
- Replace project name with template tag (e.g., "D6_HIGHWAY_TEMPLATE_2022")
- Remove vendor-specific markings (logo, contract numbers)
- Keep: structure, unit prices, formulas, scope categories
- Preserve: source attribution comment block at top
