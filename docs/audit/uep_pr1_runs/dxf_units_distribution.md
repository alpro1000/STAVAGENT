# DXF $INSUNITS distribution across UEP PR1 verification corpus

| Project | File | $INSUNITS | scale → m | bbox W × H (m) | Layers | Entities | Verdict |
|---------|------|----------:|----------:|-----------------|-------:|---------:|---------|
| rd_jachymov_dum | `RD Jachymov dum _ DPZ _ 10.dxf` | 4 | 0.001 | 460 × 647 | 53 | 7476 | OK |
| rd_jachymov_dum | `RD Ja_chymov vjezd _ situace 04.dxf` | 0 | 1.0 | 4722 × 1687 | 35 | 4394 | ⛔ likely mm-as-metres |
| rd_jachymov_dum | `RD Ja_chymov vjezd _ DPZ _ 02.dxf` | 4 | 0.001 | 391 × 368 | 39 | 1176 | OK |
| rd_jachymov_dum | `RD Jachymov dum _ situace 02.dxf` | 0 | 1.0 | 4722 × 1687 | 43 | 4380 | ⛔ likely mm-as-metres |
| hk212_hala | `A105_zaklady.dxf` | 4 | 0.001 | 417 × 235 | 40 | 785 | OK |
| hk212_hala | `A201_vykopy.dxf` | 4 | 0.001 | 923 × 178 | 42 | 1550 | OK |
| hk212_hala | `A104_pohledy.dxf` | 4 | 0.001 | 504 × 15 | 238 | 1276 | OK |
| hk212_hala | `A101_pudorys_1np.dxf` | 4 | 0.001 | 411 × 159 | 53 | 640 | OK |
| hk212_hala | `A107_stroje_kotvici_body.dxf` | 4 | 0.001 | 205 × 159 | 56 | 675 | OK |
| hk212_hala | `A102_pudorys_strechy.dxf` | 4 | 0.001 | 409 × 159 | 27 | 213 | OK |
| hk212_hala | `A106_stroje.dxf` | 4 | 0.001 | 205 × 159 | 70 | 1311 | OK |
| libuse | `D_2NP_chl.dxf` | 4 | 0.001 | 46 × 63 | 13 | 2228 | OK |
| libuse | `D_1NP_vzt.dxf` | 4 | 0.001 | 69 × 69 | 15 | 275 | OK |
| libuse | `D_1NP_chl.dxf` | 4 | 0.001 | 42 × 63 | 13 | 2842 | OK |
| libuse | `D_3NP_vzt.dxf` | 4 | 0.001 | 70 × 69 | 14 | 261 | OK |
| libuse | `D_3NP_chl.dxf` | 4 | 0.001 | 80 × 85 | 13 | 2129 | OK |
| libuse | `D_2NP_vzt.dxf` | 4 | 0.001 | 68 × 69 | 16 | 305 | OK |

Summary distribution:

- `$INSUNITS=4` (mm (correct)): **15 DXFs**
- `$INSUNITS=0` (unitless (PR1 defaults to metres)): **2 DXFs**
