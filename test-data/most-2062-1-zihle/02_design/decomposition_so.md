# SO Decomposition — Žihle 2062-1

**Vzor:** Kfely XML (`inputs/reference/20 Rekonstrukce mostu Kfely (zadání).xml`) — 4 SO objekty: SO 001 Demolice, SO 180 Objízdná, SO 201 Most, ZS.

**Klíčová diference vs Kfely:** Kfely měl objízdnou trasu (SO 180), Žihle má **provizorium** (SO 180) — ZD §4.4.o + Vysvětlení ZD č.1 ad 2 (alternativa objízdné explicitně **zamítnuta**).

## SO breakdown

| SO | Název | Status pro Žihle | Vs Kfely |
|---|---|---|---|
| **SO 001** | Demolice stávajícího mostu (16 ŽB trámů + ŽB deska + kamenné opěry) | ✅ standardní | analogicky |
| **SO 180** | **Provizorium** (mostní provizorium poblíž stávajícího mostu) | ✅ povinné | ⚠️ KFely má objízdnou — DIFERENCE |
| **SO 201** | Most ev.č. 2062-1 (nová stavba — integrální rám) | ✅ analogicky | typově odlišné (rám vs prefab nosníky) |
| **SO 290** | Směrová úprava silnice III/206 2 km 0,600 – 0,900 (případně) | ✅ povinné | ne v Kfely |
| **ZS** | Zařízení staveniště + VRN | ✅ standardní | analogicky |

## Detail per SO

### SO 001 — Demolice

| Položka | Detail |
|---|---|
| Co se bourá | 16× ŽB trámů 20×50 cm s I-280 vložkami + ŽB deska mostovky + kamenné opěry + římsy |
| Objem demolice | ~46 m² mostovky × cca 0.3 m efektivní tloušťka = ~14 m³ NK + ~30-40 m³ kamenné opěry |
| Postup | Vyřezávání segmentů shora (světlá výška ~1 m pod mostem omezuje dostupnost zdola) |
| Speciální omezení | Práce s ohledem na koryto Mladotického potoka (ZD §4.4.r — úprava koryta v okolí ±10 m) |
| Reference Kfely SO 001 | Kfely je ~17× větší most (815 m² vs 46 m²); cena nepřebírána, jen struktura |

### SO 180 — Provizorium *(KRITICKÁ DIFERENCE vs Kfely)*

Detail viz [`provizorium_specs.md`](provizorium_specs.md).

| Položka | Detail |
|---|---|
| Typ | Mostní provizorium (Mabey Compact 200 / Bailey panel / Acrow 700 — vendor RFQ) |
| Délka | ~12 m (přemostění + nájezdy) |
| Únosnost | 3.5 t + linková doprava (ZD §4.4.o) |
| Provoz | Jednosměrný se světelnou signalizací |
| Trvání | ~6 měsíců (demolice 1-2 měs + výstavba 4 měs) |
| Umístění | Vpravo od stávajícího mostu (volný prostor per `site_conditions.yaml` foto 132429) |
| Kfely vs Žihle | **Kfely SO 180 = objízdná trasa** (cca 14-30 km extra). **Žihle SO 180 = provizorium na místě**, mnohem dražší. |

### SO 201 — Nový most (integrální rám)

Detail viz [`varianta_01_integralni_ram.md`](varianta_01_integralni_ram.md).

| Položka | Detail | Kalkulátor element_type |
|---|---|---|
| Plošné základy 2× | C25/30 XC2 + XF1 | `zaklady_oper` |
| Dříky opěr 2× (vertical wall, integrální) | C30/37 XC4 + XF2 | `opery_ulozne_prahy` |
| Mostovka deska | C30/37 XC4 + XF2 | `mostovkova_deska` |
| Závěrné zídky 2× | C30/37 XC4 + XF2 | `mostni_zavirne_zidky` |
| Římsy 2× (RIGHT s 3× DN75 chráničkou) | C30/37 XC4 + XF2 | `rimsa` |
| Přechodové desky 2× | C25/30 XC2 + XF1 | `prechodova_deska` |
| Podkladní beton (~10 cm pod základy) | C12/15 X0 | `podkladni_beton` |

Plus mostní svršek (izolace + vozovka 3-vrstvá živičná + zádržný systém + revizní schodiště) — viz `varianta_01_integralni_ram.md` §6 step 10.

### SO 290 — Směrová úprava silnice III/206 2

Per ZD §4.4.n (s.6-7):

| Položka | Detail |
|---|---|
| Strana Žihle | Povinná — úprava směrového vedení oblouku před nájezdem |
| Strana Potvorov | Podmíněná (bude-li nutná po geodézii) |
| Šířkové uspořádání | S 7,5 (2× 3,25 m + VDZ V4) |
| Vozovka | 3-vrstvá živičná, **100 % návrhová tloušťka obrusné vrstvy bez tolerance** |
| Odvodnění | Krajnice → silniční příkop (součást silničního pozemku §11 z. 13/1997) |
| Rozsah obnovy | Původní těleso silnice odstraněno + rekultivováno; podloží lze ponechat jen po diagnostickém průzkumu |
| Délka úpravy | Cca 300 m (úsek 0,600 – 0,900 km per ZD §5.1, mínus délka mostu ~12 m) |

### ZS — Zařízení staveniště + VRN

| Položka | Detail |
|---|---|
| Plocha staveniště | Vpravo od silnice (per foto 132429), pravděpodobně mimo silniční pozemek — vyžaduje souhlas vlastníka |
| ČSN 73 0212 | Doporučený podíl ZS = 3-5 % z hlavních prací |
| Doprovodné práce | Geodézie (S-JTSK, Bpv, 3. třída — ZD §4.3.i), IGP (ZD §4.4.a), pasport (ZD §4.3.g), kolaudace (ZD §4.3.h) |
| ČSN EN 14001 | Zhotovitel musí mít certifikaci environmental management (ZD §13.8) |

---

## Souhrn

| SO | % z celkové ceny (orientačně) | Komentář |
|---|---|---|
| SO 001 (demolice) | 5-10 % | Malý objem (~30-40 m³), ale obtížnost přístupu zdola |
| SO 180 (**provizorium**) | **15-25 %** | Velká část díky vendor montáži + nájmu 6 měsíců |
| SO 201 (nový most) | 50-60 % | Hlavní stavba: ~46 m² × tloušťka × kalkulátor |
| SO 290 (směrová úprava) | 10-15 % | ~300 m vozovky 3-vrstvé živičné (přísnější obrusná vrstva) |
| ZS + VRN | 5-7 % | ČSN 73 0212 (3-5 % + dokumentace + dozory) |
| **Celkem** | **100 %** | Phase C kvantifikuje proti budgetu 30 mil. Kč |

Detailní rozpad per `03_calculation/cost_summary.xlsx`.
