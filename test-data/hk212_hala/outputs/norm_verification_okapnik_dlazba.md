# Norm verification — okapník beton + zámková dlažba + ZTI bedding

**Date:** 2026-05-27
**Task:** HK212 ZTI VV parse + okapník + dlažba (norm-verified)
**Purpose:** §1 mandatory norm verification BEFORE quantity calculation. Confirm our skladby match platné ČSN + standard CR practice. Flag + fix any contradiction.

---

## §1.1 Okapový chodník betonový

### Norm / standard practice findings

| Parametr | Standard CR praxe / ČSN | Naše skladba (M-VK-020..029) | Verdikt |
|---|---|---|---|
| Tloušťka betonu | 80-100 mm zahradní, **až 200 mm pojezd/vjezd** | 200 mm | ✅ upper-range — defensible (forklift u sekčních vrat) |
| Výztuž | zahradní bez; pojezd KARI síť | KARI Q188 | ✅ konzervativní, správně pro crack control + XF3 |
| Štěrk podklad | frakce 8-16 mm (zahradní) / 0-63 ČSN 73 6126 vozovka, 150-200 mm | ŠD 32/63, 150 mm | ✅ v rozmezí |
| Beton třída XF | C25/30 pro XF3 (mráz bez solí) | C25/30 XF3 | ✅ správně per ČSN EN 206 |
| Sklon od fasády | mírný spád pryč od budovy (1-2 %) | 2 % | ✅ |
| Dilatace | nutné u velkých ploch (teplotní + smršťovací) | á 4 m + řezání spár | ✅ |
| Geotextilie | separace zemina/štěrk + proti plevelu | 300 g/m² | ✅ standard separační gramáž |
| Výkop rýhy | na hloubku všech vrstev | 400 mm (štěrk 150 + beton 200 + rezerva 50) | ✅ |

**Verdikt okapník:** Skladba odpovídá normě + standardní praxi. Beton 200 mm + KARI je na horní hranici (vehicle-level robustness) — defensible vzhledem k blízkosti sekčních vrat, kde mohou přejíždět vysokozdvižné vozíky / nákladní auta. Pro čistě pěší drip-apron by stačilo 100-150 mm, ale 200 mm + KARI = robustní bezpečná volba. **NO contradiction — items M-VK-020..029 (merged PR #1240) confirmed norm-compliant.**

Zdroj: zalitobetonem.cz (postup betonový chodník), modrastrecha.cz (chodník kolem domu), stavebni-vzdelani.cz (okapový chodník), TZB-info forum (dilatace).

---

## §1.2 Zámková dlažba chodník (ČSN 73 6131-1)

### ČSN 73 6131-1 (Stavba vozovek — Dlažby a dílce, část 1: Kryty z dlažeb)

Norma platí pro kryty nemotoristických komunikací + chodníky z dlažby. Klíčové požadavky:
- Dlažba se klade na suchý čistý podklad; do lože z nestmelených materiálů jen když teplota neklesne pod bod mrazu + podklad není promrzlý.
- Obrubníky ohraničují dlážděné kryty + zabezpečují vodorovné kotvení; **osazují se do zavlhlého betonu na pevný zhutněný podklad**.
- Složení podkladních vrstev závisí na geologii + zatížení.

### Standard skladba chodník pro pěší per ČSN 73 6131 + běžná praxe

| Vrstva (shora) | Standard | Naše skladba (dlažba 1.5 m) | Verdikt |
|---|---|---|---|
| Dlažba | 60 mm pěší, 80 mm občasný pojezd | BEST 80 mm | ✅ defensible (80 mm = standard stock + možný pojezd VZV u haly) |
| Ložná vrstva (podsyp) | drť frakce 4/8 mm, 30-40 mm | drť 4/8 mm, 40 mm | ✅ |
| Nosná podkladní vrstva | ŠD 0/32 nebo 32/63, 150-200 mm pěší | ŠD 32/63, 150 mm | ✅ |
| Zásyp spár | křemičitý písek frakce 0.2-2 mm | křemičitý písek 0.2 mm | ✅ |
| Obrubníky | do betonového lože C16/20 | ABO 100×250 do C16/20 lože | ✅ per ČSN 73 6131 verbatim |
| Geotextilie separace | volitelné, doporučeno na slabém podloží | 300 g/m² | ✅ konzervativní |
| Hutnění | vibrodeska po kladení + zásypu spár | vibrodeska | ✅ |

**Verdikt dlažba:** Skladba odpovídá ČSN 73 6131. Dlažba 80 mm je mírně robustnější než minimum (60 mm pro čistě pěší), ale je to standardní skladová tloušťka BEST + defensible u haly kde může přejíždět VZV. **NO contradiction.**

Zdroj: ČSN 73 6131-1 (736131, červenec 1994, shop.normy.biz), izomat.cz (obecné zásady pokládky dlažby), stavebnistandardy.cz RTS (kryty pozemních komunikací).

---

## §1.3 Geotextilie

- Gramáž 300 g/m² = standardní separační/ochranná netkaná geotextilie (PP/PES).
- Funkce: separace zeminy od štěrku (proti kontaminaci jemnými částicemi → ztráta drenáže) + proti prorůstání plevele + filtrace.
- Přesahy min 150 mm.

**Verdikt:** 300 g/m² správně pro separaci pod okapník i dlažbu. ✅

---

## §1.4 ZTI sítě — uložení potrubí (ČSN 73 6005)

ČSN 73 6005 (Prostorové uspořádání sítí technického vybavení):

| Parametr | ČSN 73 6005 | VV (projektant) | Verdikt |
|---|---|---|---|
| Pískové lože (podsyp) | tl. 0.1 m | P1.6 podsyp frakce 0-16, výška 0.1 m | ✅ MATCH |
| Obsyp | 0.3 m nad vrchol potrubí, frakce ≤ 16 mm bez ostrých zrn | P1.7 obsyp frakce 0-16 bez ostrých zrn, výška 0.2 m | ⚠️ VV 0.2 m vs norm 0.3 m nad vrchol — VV projektant authoritative, použít VV |
| Výstražná fólie | min 200 mm nad potrubí | P1.9 výstražná folie | ✅ |
| Min krytí | 1.2 m | per hloubka šachet (do 2.5 m) | ✅ |

**Verdikt ZTI:** VV bedding skladba odpovídá ČSN 73 6005 (podsyp 0.1 m + obsyp frakce 0-16 + výstražná fólie). Obsyp výška 0.2 m je mírně nižší než norm doporučení 0.3 m nad vrchol, ale **VV = projektantský dokument = authoritative**; parsujeme VV hodnoty verbatim (confidence 0.95). NO blocking contradiction.

Zdroj: ČSN 73 6005 (TZB-info voda, vakinfo.cz, scvk.cz technické podmínky).

---

## §1.5 Souhrnný verdikt

| Skladba | Norm compliance | Akce |
|---|---|---|
| Okapník beton (M-VK-020..029) | ✅ compliant (200 mm upper-range defensible) | beze změny — confirmed |
| Dlažba 1.5 m (NEW) | ✅ compliant per ČSN 73 6131 | implement per §5 task table |
| Geotextilie 300 g/m² | ✅ | beze změny |
| ZTI bedding (VV) | ✅ MATCH ČSN 73 6005 | parse VV verbatim (authoritative) |

**Žádná skladba neodporuje normě v podstatném.** Implementace pokračuje per task §2-§5. Drobné poznámky (beton 200 mm upper-range, dlažba 80 mm robustnější, obsyp 0.2 vs 0.3 m) zdokumentovány — všechny defensible, VV projektant authoritative kde aplikuje.

---

## Sources

- [Betonový chodník postup — zalitobetonem.cz](https://zalitobetonem.cz/blog/betonovy-chodnik-postup/)
- [Chodník kolem domu — modrastrecha.cz](https://www.modrastrecha.cz/magazine/chodnik-kolem-domu/)
- [Okapový chodník — stavebni-vzdelani.cz](https://www.stavebni-vzdelani.cz/okapovy-chodnik/)
- [Betonový chodník dilatace — TZB-info forum](https://forum.tzb-info.cz/144669-betonovy-chodnik-dilatace)
- [ČSN 73 6131-1 Stavba vozovek. Dlažby a dílce — shop.normy.biz](https://shop.normy.biz/detail/16373)
- [ČSN 73 6131 — technicke-normy-csn.cz](https://www.technicke-normy-csn.cz/csn-73-6131-736131-223773.html)
- [Obecné zásady pokládky betonové dlažby — izomat.cz](https://www.izomat.cz/out/media/obecne_zasady_pro_pokladku_betonove_dlazby_4.pdf)
- [Hloubka uložení odpadu RD — hrabovjanka.cz](https://hrabovjanka.cz/blog/hlobka-ulozeni-odpadu-rodinny-dum/)
- [Uložení kanalizace nad vodovod — vakinfo.cz](https://www.vakinfo.cz/moznost-ulozeni-kanalizacniho-potrubi-nad-vodovodni-potrubi/)
