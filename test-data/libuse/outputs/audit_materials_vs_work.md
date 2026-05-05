# Audit Part A — Materials vs work split

Identifies WORK-only items (kladení / pokládka / montáž) without a sibling 'dodávka materiálu' item per (kapitola, room).

**ÚRS context:** Per ÚRS RSPS conventions, many `kladení` items include material in the unit price. However, customer prefers explicit material dodávka rows for variant pricing + audit.

## Aggregated gaps

| Kapitola | Missing dodávka item | Affected rooms | Σ množství | MJ |
|---|---|---:|---:|---|
| `PSV-784` | Malba disperzní — dodávka barvy | 49 | 2231.42 | m2 |
| `PSV-762` | Dřevěné latě 30×50 — dodávka materiálu | 1 | 921.12 | m |
| `PSV-713` | EPS 200 — dodávka | 1 | 786.59 | m2 |
| `HSV-622.1` | Cihelné pásky Terca — dodávka materiálu | 1 | 542.58 | m2 |
| `PSV-776` | Vinyl Gerflor Creation 30 — dodávka | 28 | 490.02 | m2 |
| `PSV-765` | Tondach bobrovka — dodávka tašek | 1 | 304.00 | m2 |
| `PSV-781` | Obklad keramický — dodávka materiálu | 16 | 293.12 | m2 |
| `PSV-771` | Dlažba keramická — dodávka materiálu | 33 | 249.00 | m2 |
| `PSV-712` | PVC fólie DEKPLAN — dodávka | 1 | 152.90 | m2 |
| `PSV-713` | XPS 100 mm — dodávka | 1 | 40.49 | m2 |

**Total gaps to add**: 10 aggregated items (covering 132 room-instances)

## Estimated cost impact (rough)

| Material | Σ množství | Unit price (estimate) | Total |
|---|---:|---:|---:|
| Malba disperzní — dodávka barvy | 2231.4 m2 | ~50 Kč/m2 | ~111,571 Kč |
| Dřevěné latě 30×50 — dodávka materiálu | 921.1 m | ~200 Kč/m | ~184,224 Kč |
| EPS 200 — dodávka | 786.6 m2 | ~200 Kč/m2 | ~157,318 Kč |
| Cihelné pásky Terca — dodávka materiálu | 542.6 m2 | ~1800 Kč/m2 | ~976,644 Kč |
| Vinyl Gerflor Creation 30 — dodávka | 490.0 m2 | ~500 Kč/m2 | ~245,009 Kč |
| Tondach bobrovka — dodávka tašek | 304.0 m2 | ~30 Kč/m2 | ~9,120 Kč |
| Obklad keramický — dodávka materiálu | 293.1 m2 | ~500 Kč/m2 | ~146,560 Kč |
| Dlažba keramická — dodávka materiálu | 249.0 m2 | ~600 Kč/m2 | ~149,399 Kč |
| PVC fólie DEKPLAN — dodávka | 152.9 m2 | ~200 Kč/m2 | ~30,580 Kč |
| XPS 100 mm — dodávka | 40.5 m2 | ~350 Kč/m2 | ~14,172 Kč |
| **TOTAL estimated material gap** | | | **~2,024,596 Kč** |

## Recommendation

⚠️ **HIGH priority** — fix v Phase 6.4 before Phase 7a ÚRS lookup. Adding dodávka items now means ÚRS lookup batch covers them in one pass.