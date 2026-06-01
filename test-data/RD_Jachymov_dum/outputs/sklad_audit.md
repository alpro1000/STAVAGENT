# Sklad (260217) — re-verification audit — všechny rozměry + práce

> **Type:** read-only cross-check. 31 sklad položek × TZ statika sklad (D.2.1) + TZ ARS sklad + výkresy.
> **Date:** 2026-06-01 · **Gate:** STOP před opravami.
> **TZ statika fakta:** lichoběžník cca 6,35 × 3,34 m · zadní stěna = gravitační opěrná z prefa „lego" bloků (běhounová vazba) · obvod = tvarovky ztraceného bednění 250 mm · pasy prostý beton 500×500 · strop = stropnice 100/160 á 625 **rozpon cca 3,1 m** · záklop prkna 20 mm · parking IPE180 + pororošt, **délka stání 7,0 m (½ nad skladem, ½ nad svahem)** · svahovaná jáma 1:0,5 (F4) · navážka do 4,8 m · Rdt 300 kPa · XA1.

---

## ✅ Potvrzeno OK (odpovídá TZ statika)
| Položka | TZ |
|---|---|
| `HSV3.002` stěny ztracené bednění **250 mm** | ✓ |
| `HSV2.001` pasy prostý beton **500×500** | ✓ |
| `HSV4.001` stropnice **100/160 á 625** | ✓ profil/rozteč |
| `HSV4.002` záklop prkna **20 mm** | ✓ |
| `HSV3.001` opěrná stěna prefa „lego" bloky (koncept) | ✓ koncept |
| `HSV4.004` IPE180 921 kg (~8×6,35 m) + `HSV4.005` pororošt **44,6 = 7,0×6,35** | ✓ ~OK |
| `HSV2.004` beton patky C25/30 XC3 XF1 XA1 | ✓ třídy |
| `HSV5.001` mezipodesta schodiště · `PSV76.001` dveře RC3 · vjezd N1-N3 (Dodatek) | ✓ |
| Rdt 300, XA1, svah 1:0,5 | ✓ |

---

## ⚠️ DRIFT / TVAR — k opravě (verify)
| # | Položka | Problém | Návrh |
|---|---|---|---|
| **DS1** | `HSV1.002` (25,5 m³), `HSV3.002` (46,5 m²), `HSV4.002/4.003` (21,2 m²) | **Lichoběžník počítán jako obdélník** 6,35×3,34. TZ: *lichoběžníkového půdorysu*. Obdélník bounding → plochy/objemy **nadhodnocené**. | Vzít skutečnou plochu lichoběžníku z DXF (km_tabulka: sklad 0.01 = **17,6 m²** vnitřní). |
| **DS2** | `HSV1.005` štěrk (21,2), `HSV2.005` lože (21,2) | Podlahové vrstvy berou **21,2** (footprint obdélník), ale `PSV77.001` dlažba bere **17,6** (DXF vnitřní místnost). **Nekonzistentní.** | Podlahové vrstvy (štěrk/lože) → vnitřní **17,6**; strop/záklop → footprint (lichoběžník, ne 21,2). |
| **DS3** | `HSV4.001` | Label „rozpon 3,34" — TZ říká **rozpon cca 3,1 m** (3,34 = vnější šířka). Číslo 33,9 bm ~OK (3,1 rozpon + uložení ≈ 3,34 délka), ale label opravit. | Upřesnit: rozpon 3,1 + uložení. Počet: 6,35/0,625 = 10,16 → **11 ks**, ne 10. |

---

## 🟡 ČISTÉ ODHADY (Pattern 44 — geometrie nebo OVĚŘIT)
| # | Položka | Co je odhad |
|---|---|---|
| **ES1** | `HSV3.001` prefa „lego" bloky **60 ks** | Formule: „výška ~1,6 m × 6,35 / blok 0,8×0,4 = ~64 → 60". **Výška stěny 1,6 m je PŘEDPOKLAD** (TZ ji neuvádí). Opěrná stěna v prudkém svahu může být vyšší. → výkres/výkaz bloků nebo OVĚŘIT. |
| **ES2** | `HSV2.004` beton patky | „+ zídka **odhad ~1 m³**" — ruční přídavek bez geometrie. |
| **ES3** | `HSV1.001` sejmutí ornice + demolice zídek **8 m³** | odhad bez DXF. |
| **ES4** | `VRN.002` likvidace odpadu **8 t** | odhad (kameny ~6 t + dřevo/výkop ~2 t). |

---

## ❓ VYJASNĚNÍ (hloubka výkopu)
| # | Položka | Otázka |
|---|---|---|
| **VS1** | `HSV1.002` hloubení **H=1,2 m** | Objekt *zasazen do prudkého svahu*, navážka do **4,8 m**. Zadní strana (u opěrné stěny) řezaná hlouběji. H=1,2 m je průměr? Objem 25,5 m³ při svahování 1:0,5 (vyjasnění #33). |

---

## Souhrn k approve
- **DS1-DS3** (lichoběžník + podlaha konzistence): potřebuje skutečnou plochu lichoběžníku z DXF (vnitřní 17,6 známá; footprint trapezoid neznám přesně). Bez DXF dims → OVĚŘIT.
- **ES1** prefa bloky 60 ks: nejslabší — výška stěny předpoklad. Pattern 44 → buď výkres-count, nebo OVĚŘIT + ponechat odhad s flagem.
- **VS1** hloubka: → vyjasnění (rozšířit #33 o sklad výkop H).
- Drobné: stropnice count 10→11.

Žádné DUPLICITY/dvojí počítání nenalezeno (na rozdíl od soklu domu). Hlavní téma = lichoběžník-vs-obdélník nadhodnocení + slabé odhady (prefa bloky, hloubka).
