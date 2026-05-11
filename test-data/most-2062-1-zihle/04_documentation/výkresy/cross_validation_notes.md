# Cross-Validation: C.2.1 situace SVG vs vendor situace.pdf

**Generated:** 2026-05-07
**Phase E output:** `C.2.1_situace_M1_500.svg` + PNG
**Vendor reference:** `inputs/pdf/Most ev.č. 2062-1 u obce Žihle, přestavba - situace.pdf`

---

## Source comparison

| Aspect | Phase E SVG | Vendor situace.pdf |
|---|---|---|
| Type | Engineering situace M 1:500 | Mapy.com overview (~30 km × 25 km) |
| Scale | **1:500** (133.5 × 180 m draw area) | ~1:50 000 schematic |
| Coord system | S-JTSK (EPSG:5514) → SVG | Mapy.com tile (Mercator) |
| Detail level | Bridge polygon + 16 parcel labels + GPX + zábor | Single červený kroužek mezi Žihle a Potvorov |
| Format | A3 portrait SVG + PNG | A4 portrait PDF (publisher SÚSPK) |
| Suitability for DUR | ✅ Vhodný (bridge geometry + parcels visible) | ❌ Pouze orientační lokalizace |

## Position cross-check

| Geographic feature | Phase E (SJTSK center) | Vendor PDF (visual) | Match |
|---|---|---|---|
| Most ev.č. 2062-1 | center (-816220, -1037705) ≈ 13.396°E, 50.040°N | červený kroužek mezi Žihle (km 0.793) a Potvorov | ✅ konsistent |
| Mladotický potok | perpendicular to silnice III/206 2, ~120 m crossover | NOT shown explicitly | n/a (overview) |
| silnice III/206 2 | azimut ~75° (Žihle → Potvorov SE→NW) | shown as line between obcí | ✅ |
| Žihle obec | ~2 km west of bridge | shown as label NW | ✅ |
| Potvorov obec | ~1.5 km east of bridge | shown as label SE | ✅ |

## Engineering deliverables comparison

**Vendor situace** je **jen overview map** (Mapy.com publisher SÚSPK) — slouží pouze
pro **lokalizaci** v rámci ZD/HPM. **Není** podkladovým výkresem M 1:500 pro DUR
submission per vyhláška 499/2006 Sb.

**Phase E SVG (`C.2.1_situace_M1_500.svg`)** je **NOVÝ** podkladový výkres pro DUR
zhotovené z DXF kadastru:
- Bridge polygon 9 × 8.30 m, šikmost 50°
- 16 ze 24 parcel se souhlasy (`parcels_and_consents.yaml`) v SJTSK
- 37 kadastr polyline boundaries (DXF layers)
- GPX provizorium 116 m bypass trace
- Zábor staveniště ~1000 m² (T0-04 SO 801)
- Title block + scale bar + N arrow + legenda

## DXF parcel matching results

Z 24 parcel uvedených v `parcels_and_consents.yaml`:

- **16 parcel match** v DXF jako TEXT/MTEXT labels (v draw area)
  - Žihle k.ú.: 1710, 1714, 1723, 1755, 1769, 1770, 1785, 1831, 1832, 1836, 1842, 1843, 1845
  - Přehořov u Žihle k.ú.: 392, 397, 614

- **8 parcel NOT FOUND** v DXF jako simple text:
  - 385/1, 385/3, 385/11, 385/12, 385/13, 391/2, 613/3, 618/1
  - **Důvod:** subdivision parcels (s lomítkem) jsou v DXF uloženy jiným způsobem —
    pravděpodobně jako sub-labels v MTEXT formátu nebo jako polyline labels nad parcel
    boundaries. Pro DPS by bylo třeba parsovat polyline-attribute layers separately.

## Improvement notes pro Phase F (DPS)

1. **Subdivision parcel labels** — extend DXF parser to find `/`-suffix labels in MTEXT
   nested attributes. Cca 8 ze 24 parcel chybí v current SVG.
2. **Real bridge skew** — currently 50° per task spec. DPS by měl ověřit z geodet.
   zaměření (real azimut silnice vs koryta).
3. **Real GPX trace** — currently parametric curve. DPS by měl import GPX z user měření.
4. **Polyline coloring** — current DXF layer-name heuristics by mohly být refined
   (silnice/kadastr/most subset-detection).
5. **Mlaadotický potok** — currently representative dashed line. DPS by importoval
   skutečnou polyline z DXF water layer.

## Audit trail

```yaml
generated_by: build_situace_svg.py (Phase E session 2)
inputs:
  dxf:        inputs/photos/PROJEKT_MOST_HLAVNI.dxf
  parcels:    04_documentation/kadastr_audit/parcels_and_consents.yaml
  bridge_geometry:
    L_m:  9.0
    B_m:  8.30
    skew_deg: 50.0
    sjtsk_center: [-816220.0, -1037705.0]
  zabor_m2: 1000
  prov_length_m: 116.0
outputs:
  svg: 04_documentation/výkresy/C.2.1_situace_M1_500.svg  (14,765 bytes)
  png: 04_documentation/výkresy/C.2.1_situace_M1_500.png (~466 KB, A3 210 DPI)
verified:
  - svg renders v browseru: yes
  - png export via cairosvg: yes
  - parcel match count: 16/24 (67%) — 8 subdivisions NOT FOUND, dokumentováno
  - polylines in draw area: 37 (kadastr boundaries + roads)
flag:
  level: info
  message: "Sandbox výstup. Pre real DUR submission, DPS by ověřil bridge skew a parsoval
            subdivision-parcel labels separately."
```
