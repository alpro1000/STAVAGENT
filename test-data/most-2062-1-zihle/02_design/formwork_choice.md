# Formwork & Skruž — Žihle 2062-1

**Princip:** výběr bednění + skruže pro integrální rámový most s **kritickým omezením** — světlá výška pod stávajícím mostem ~1 m → skruž zdola NEMOŽNÁ. Po demolici stávajícího mostu vznikne otevřený prostor → skruž **ze dna stavební jámy**.

## 1. Vertikální bednění (opěry, závěrné zídky)

### Výběr

**DOKA Framax Xlife** *(default)* nebo **PERI Trio** (vendor alternativa).

### Parametry

| Parametr | Hodnota | Poznámka |
|---|---|---|
| Typ | Rámové bednění (universální) | Klasický rámový panel pro vertikální stěny |
| Maximální tlak na bednění | ~80 kN/m² | Dle STAVAGENT formwork-systems.ts katalogu (Framax Xlife max pressure) |
| Aplikace | Dříky opěr (výška ~2 m) + závěrné zídky (výška 0.80 m) | Standardní rámový panel postačí |
| Tlak čerstvého betonu | ~40-50 kN/m² | Per DIN 18218 (h = 2 m, čerstvý beton ρ = 25 kN/m³, c = 0.85 standardní konzistence) |
| Manufacturer-prefer | DOKA (per `01_extraction/aplikovatelne_normy.yaml > kb_zdroje_pro_phase_b > Pokorný-Suchánek pevna_skruz typical_systems`) | DOKA / PERI / HUNNEBECK / PEINER / PIZMO |

### Zdůvodnění

- Tlak čerstvého betonu (40-50 kN/m²) je **POD** kapacitou Framax (80 kN/m²) → standardní rámové vyhovuje
- Žádná potřeba speciálního bednění pro vysoký tlak (Framax Xlife pro h ≤ 6 m)
- Citace: `B6_research_papers/upa_pokorny_suchanek_betonove_mosty_ii/INDEX.yaml > construction_technologies.pevna_skruz.typical_systems` (DOKA, PERI, HUNNEBECK, PEINER)

## 2. Horizontální bednění (mostovka deska)

### Výběr

**DOKA Top 50** *(default)* nebo **PERI Multiflex**.

### Parametry

| Parametr | Hodnota |
|---|---|
| Typ | Nosníkový bednící systém (slab system) |
| Aplikace | Mostovka deska 8.30 × 12 m × 0.40 m (~40 m² area, ~16 m³ beton) |
| Pour-role per STAVAGENT | `pour_role: 'formwork'` (Vrstva 1 — kontaktní povrch) |
| Reuse | Jediná betonáž → reuse irrelevant |

### Zdůvodnění

- Top 50 = standardní pro mostovky (per existing CLAUDE.md: "mostovka >5m → Staxo 100" — naše tloušťka 0.40 m bez stojek nad 5 m, takže jen Top 50 jako bednění + samostatné stojky níže)

## 3. Skruž / podpora desky (FALSEWORK)

### Výběr

**Stojky IP** (české inventární) *(default)* nebo **DOKA Multiprop** / **PERI Multiprop**.

### Parametry

| Parametr | Hodnota | Zdroj |
|---|---|---|
| Typ | Pevná skruž stojkami | Pokorný-Suchánek kap. 14a |
| Pour-role per STAVAGENT | `pour_role: 'falsework'` nebo `'formwork_props'` | per formwork-systems.ts |
| Místo umístění | **Z dna stavební jámy** (nikoliv z přirozeného terénu) | Světlá výška ~1 m → demolice + výkop nutný před skruží |
| Maximální výška | Stojky IP do 4-6 m | Naše ~3 m (od dna jámy po spodek desky) vyhovuje |
| Constraints (Pokorný) | `max_bridge_length_m: 100`, `max_height_above_ground_m: 15` | Žihle ~12 m × ~3 m → daleko pod limitem |

### Zdůvodnění

- **NE posuvná skruž (MSS)** — jen 1 pole, MSS ekonomická pro 5+ polí (per Pokorný `posuvna_skruz.economic_for_total_length_m_min: 400`)
- **NE výsuvná skruž** — pro výškovo malý integrál nemá smysl
- **Pevná skruž stojkami** = jediná správná metoda pro 1-polový rám (per `B6/upa_pokorny_suchanek_*/ch13_19_technologie_vystavby.yaml > pevna_skruz`)
- Citace: "možnost použití i pro složitá geometrie" + "ekonomicky výhodné při opakovaném použití (3-4 polí celá; dlouhé = přestavování)" → naše 1 pole je triviální případ

## 4. Specifická pro mostovku (deska + stojky pod)

Per STAVAGENT calculator logiky (`element-classifier.ts` + `formwork-systems.ts`):

- `mostovkova_deska` element_type → `recommended_formwork[0]` = `Top 50` (per Gate 2.1 v4.22.0 — Top 50 = Vrstva 1 nosníkové bednění, NE Vrstva 2 nosníky)
- Doplňkové stojky pod deskou:
  - Pro mostovku h_světlá ≤ 5 m → Staxo 40 nebo equivalentní
  - Pro mostovku h_světlá > 5 m → Staxo 100
- Naše: světlá výška pod deskou ~3 m (od dna jámy) → **Staxo 40 / IP stojky** dostačují

Per `Monolit-Planner/shared/src/calculators/formwork-selector.ts` (typeahead):
```typescript
recommendFormwork({ element_type: 'mostovkova_deska', height_m: 3.0 })
// → returns: { system: 'Top 50', pour_role: 'formwork', formwork_subtype: 'nosnikove' }
// + props.recommendation: 'Staxo 40' or similar
```

## 5. Náklady (orientačně z STAVAGENT katalogu)

| Položka | Jednotka | Cena CZK/jednotka | Zdroj |
|---|---|---|---|
| Framax Xlife — práce + nájem | m² | ~600-900 | `Monolit-Planner/shared/src/calculators/formwork-systems.ts` |
| Top 50 — práce + nájem | m² | ~700-1000 | dtto |
| Staxo 40 / IP stojky | m² (půdorys) | ~400-600 | dtto |

Konkrétní hodnoty per Phase C kalkulátor — viz `03_calculation/cost_summary.xlsx`.

## 6. Speciální požadavky

### Odbednění

- Po dosažení **70 % charakteristické pevnosti** betonu (typicky 7-14 dní v závislosti na teplotě + třídě cementu)
- Pro mostovku C30/37: typicky 9-11 dní při 15-25 °C (curing class 4)
- Pour decision sequence: bednění + výztuž → betonáž → ošetřování min 9 dní → odbednění

### Třída ošetřování

**Class 4 pro mostovku** (per CLAUDE.md default: "mostovka/rimsa/rigel → 4"). Min 9 dní při 15-25 °C dle TKP 18 §7.8.3.

### Pracovní spáry

- Pro 1-polový rám malého rozpětí (9 m) lze betonovat v 1 záběru → žádné pracovní spáry v desce
- Pracovní spára pouze mezi opěrou (1. záběr) a deskou (2. záběr) — typický monolitický rám
- Detail spojení: vyčnívající výztuž z opěry, drsnění povrchu spáry per TKP 18 §7

## 7. Cross-references

- Pokorný-Suchánek kap. 14a (pevna_skruz): `concrete-agent/packages/core-backend/app/knowledge_base/B6_research_papers/upa_pokorny_suchanek_betonove_mosty_ii/ch13_19_technologie_vystavby.yaml`
- STAVAGENT formwork systems catalog: `Monolit-Planner/shared/src/calculators/formwork-systems.ts`
- DIN 18218 (tlak čerstvého betonu) — NORMA NEDOSTUPNÁ V REPO; aplikováno automaticky v Monolit-Planner `lateral-pressure.ts`
- TKP 18 §7.8.3 (ošetřování betonu): `B2_csn_standards/tkp/tkp_18_betonove_mosty.json`

## 8. MISSING DATA

- **DIN 18218** — neexistuje v KB; výpočet tlaku čerstvého betonu se spoléhá na výpočtový algoritmus v Monolit-Planner (audited)
- **Konkrétní RFQ od DOKA / PERI** — náklady jsou orientační z calculator katalogu, finalní vendor RFQ při nabídce
