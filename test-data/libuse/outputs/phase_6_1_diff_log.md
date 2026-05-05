# Phase 6.1 diff log — count source updates

Per-item changes from uniform 0.25 D-share fallback to best-available source.

## Stats

- Items before: 2277
- Items after:  2332
- Updated via Tabulka per-objekt: **49**
- Updated via DXF spatial count:  **30**
- ks/kpl items rounded up:        **86**
- PSV-768 revizní dvířka removed: **3**
- HSV-642 osazení items added (paired with OP##): **58**

## Confidence distribution after fix

| Confidence | Items |
|---:|---:|
| 1.0 | 49 |
| 0.95 | 43 |
| 0.9 | 1425 |
| 0.85 | 793 |
| 0.8 | 3 |
| 0.7 | 10 |
| 0.6 | 8 |
| 0.5 | 1 |

## Sample changes (D## doors via Tabulka)

| Code | Popis | Old qty | New qty | Source |
|---|---|---:|---:|---|
| `D04` | Dveře D04 — dodávka (rám + křídlo + obložky) | 39 | 35 | tabulka_dveri_per_objekt |
| `D04` | Dveře D04 — kotvení + spárování | 39 | 35 | tabulka_dveri_per_objekt |
| `D04` | Dveře D04 — klika + zámek | 39 | 35 | tabulka_dveri_per_objekt |
| `D34` | Dveře D34 — dodávka (rám + křídlo + obložky) | 22 | 16 | tabulka_dveri_per_objekt |
| `D34` | Dveře D34 — kotvení + spárování | 22 | 16 | tabulka_dveri_per_objekt |
| `D34` | Dveře D34 — klika + zámek | 22 | 16 | tabulka_dveri_per_objekt |
| `D31` | Dveře D31 — dodávka (rám + křídlo + obložky) | 16 | 17 | tabulka_dveri_per_objekt |
| `D31` | Dveře D31 — kotvení + spárování | 16 | 17 | tabulka_dveri_per_objekt |

## Sample changes (OP## via DXF)

| Code | Popis | Old qty | New qty | Source |
|---|---|---:|---:|---|
| `OP08` | OP08: Revizní dvířka KAN 300 x 300 | 11.25 | 15 | dxf_spatial_count OP |
| `OP10` | OP10: Revizní dvířka VOD 300 x 300 | 7.75 | 11 | dxf_spatial_count OP |
| `OP18` | OP18: Revizní dvířka do podhledu 600 x 600 | 15.5 | 21 | dxf_spatial_count OP |
| `OP19` | OP19: Revizní dvířka fasáda 200 x 200 | 3.75 | 6 | dxf_spatial_count OP |
| `OP25` | OP25: Vanová revizní dvířka 300 x 300 | 8.5 | 11 | dxf_spatial_count OP |

## Sample changes (LI## via DXF)

| Code | Popis | Old qty | New qty | Source |
|---|---|---:|---:|---|
| `LI01` | LI01: Porotherm KP11,5 | 25.5 | 19 | dxf_spatial_count LI |
| `LI02` | LI02: Porotherm KP11,5 | 28.75 | 30 | dxf_spatial_count LI |
| `LI03` | LI03: Porotherm KP11,5 | 7.75 | 10 | dxf_spatial_count LI |
| `LI04` | LI04: Porotherm KP11,5 | 3.0 | 5 | dxf_spatial_count LI |
| `LI11` | LI11: Porotherm KP7 | 24.75 | 10 | dxf_spatial_count LI |

## Sample changes (LP## via DXF)

| Code | Popis | Old qty | New qty | Source |
|---|---|---:|---:|---|
| `LP60` | LP60: Skleněné zábradlí francouzských oken — dodáv | 5.0 | 10 | dxf_spatial_count LP |
| `LP60` | LP60: Skleněné zábradlí francouzských oken — montá | 5.0 | 10 | dxf_spatial_count LP |
| `LP63` | LP63: Skleněné zábradlí francouzských oken — dodáv | 1.5 | 4 | dxf_spatial_count LP |
| `LP63` | LP63: Skleněné zábradlí francouzských oken — montá | 1.5 | 4 | dxf_spatial_count LP |
