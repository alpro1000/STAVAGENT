# EN 1992-2 — Concrete Bridges (Eurocode 2, Part 2)

```yaml
title: EN 1992-2 — Eurocode 2 — Design of concrete structures — Concrete bridges
year: 2005
type: european_standard
language: en
slug: en_1992_2_concrete_bridges
recommended_bucket: B7_regulations
source_pdf: SIST-EN-1992-2-2005.pdf
total_pages: 95
extraction_status: PARTIAL
extraction_notes: "Pouze sekce kritické pro Žihle Phase B. Plná extraction je samostatný TODO task."
publisher_note: "Slovenian publication SIST EN 1992-2:2005, identical text per CEN agreement"
```

## Status & scope

This is a **PARTIAL extraction**, focused on sections needed for Žihle 2062-1 Phase B/C:
- §3.1.2 Strength classes
- §4.4 Concrete cover
- §5.10 Prestressed members (skipped — not applicable to integral frame)
- §7.3 Crack control (overview)
- §113 Design for execution stages (overview)
- Annex E (informative) — Indicative strength classes for durability

**Full extraction is a separate task** (5-10 hours work given 95 pages with formulas).

## Why partial first

ČSN EN 1992-2 jako národní implementace se nakupuje za poplatek. SIST EN 1992-2 (Slovenian publication) je **legálně identická** kopie ze CEN agreement (members must publish identical text). Pro účely STAVAGENT toto stačí jako primary reference.

Plná extrakce všech 95 stran + Annexes (A-QQ) = velký úkol s analogou Pokorného-Suchánka strukturu (METADATA, INDEX.yaml, citations.md, possibly extracted/ submodules per section).

Zde děláme jen to, co potřebuje **Žihle Phase B**: krytí, exposure, execution stages, strength classes.

## Sections covered in this partial extraction

### §3.1.2 — Strength classes

**Recommended values (informative for National Annex):**
- C_min = C30/37 (recommended for new bridges)
- C_max = C70/85 (rarely needed; Žihle uses C30/37)

**For Žihle:** všechny prvky C30/37 odpovídá doporučení. Outliers:
- Podkladní beton C12/15 (X0) — pod limit, ale je to non-structural blinder
- Přechodové desky C25/30 — pod doporučení, ale akceptovatelné per ČSN 73 6244

### §4.4 — Concrete cover

**Cover calculation:**
- c_nom = c_min + Δc_dev
- c_min = max(c_min,b, c_min,dur, 10 mm)

Where:
- c_min,b = bond cover (depends on bar diameter)
- c_min,dur = durability cover (depends on exposure class + structural class)
- Δc_dev = deviation allowance (recommended 10 mm, may be reduced for QA)

**Structural class:** for bridges typically S5 (50 years design life) or S6 (100 years).

### §113 — Design for execution stages

**Key principle:** during construction, structure must be checked at all intermediate stages (not just final stage).

For Žihle integral frame:
- **Stage 1:** Foundation + opěry as standalone walls (no top connection yet)
- **Stage 2:** Falsework + bednění desky in stavební jámě
- **Stage 3:** Concreting deska — connection to opěry forms continuity
- **Stage 4:** Removal of falsework after curing reaches required strength

§113 says:
- ULS verification at each stage (γ factors may be reduced — see National Annex)
- SLS check during execution (cracks, deflections)

### Annex E — Indicative strength classes for durability

| Exposure | Min strength (informative) |
|---|---|
| X0 | C12/15 |
| XC1 | C20/25 |
| XC2, XC3 | C25/30 |
| XC4 | C30/37 |
| XD1, XS1 | C30/37 |
| XD2, XS2 | C35/45 |
| XD3, XS3 | C35/45 |
| XF1 | C30/37 |
| XF2, XF3 | C30/37 (with air entrainment) |
| XF4 | C30/37 (with air entrainment) |
| XA1 | C30/37 |
| XA2 | C30/37 (sulfate resistant) |
| XA3 | C35/45 (sulfate resistant) |

**For Žihle (přes potok, v extravilánu, mírně agresivní voda):**
- Spodek desky + římsy: XC4 + XF2 → minimum C30/37 ✅
- Horní povrch desky (pod izolací): XC3 + XF1 → minimum C25/30 (užijeme C30/37 unifikace)
- Opěry + dříky: XC4 + XF2 → C30/37
- Přechodové desky: XC2 + XF1 → C25/30

## Sections NOT yet covered (TODO for full extraction)

- Section 5: Structural analysis (full)
- Section 6: ULS — Bending, Shear, Torsion, Fatigue
- Section 7: SLS (full)
- Section 8: Detailing of reinforcement
- Section 9: Detailing — particular rules for beams/columns
- Section 10: Precast elements (Žihle bude potenciálně relevantní pro moduly přechodových desek)
- Annex A-D, F-QQ (Annexes)

**Owner:** STAVAGENT KB team. Track as separate task.

## Cross-references

- `B7_regulations/csn_en_206_beton/` — concrete classes (companion norm)
- `B7_regulations/csn_en_1992_1_1_pozemni/` — Eurocode 2 Part 1 (general rules referenced extensively)
- `B6_research_papers/upa_pokorny_suchanek_betonove_mosty_ii/` — bridge-specific application
- `B7_regulations/tkp_18*/` — TKP 18 betonové konstrukce (CZ implementation guidance)
