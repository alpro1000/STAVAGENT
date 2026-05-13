# Email Draft — Vyjasňující dotazy k projektu hk212_hala

**To:** Ing. arch. Jakub Volka (volkajakub@basepoint.cz)  
**Cc:** Statik (Ing. Jiří Plachý / Bc. M. Doležal) — TBD  
**Subject:** [hk212 Hradec Králové hala] — vyjasnění před zpracováním rozpočtu (DPZ → DPS)

Vážený pane projektante,

při analýze PD pro halu HK 212 v Hradci Králové (Solar Disporec) jsme detekovali následující nesoulady mezi jednotlivými dokumenty PD. Prosíme o vyjasnění před zpracováním rozpočtu:

## 1. Zastavěná plocha — 3 různé hodnoty

- TZ A (Průvodní) p03: **540,10 m²**
- TZ B (Souhrnná) p07: **520 m²** (matches PBŘ p04+p06)
- TZ D.1.1 (ARS technická zpráva) p02: **541 m²**

**Otázka:** Které číslo je správné? Stejně tak obestavěný prostor TZ A=3694,62 m³ vs TZ B=2833 m³ vs TZ D.1.1=3404 m³.

## 2. Beton třídy v 06_zaklady_titul vs TZ statika D.1.2

- TZ statika D.1.2 p29 (ŽB deska): **C25/30 XC4**  Kari sítě Ø8 100/100, B500B, krytí 30 mm
- TZ statika D.1.2 p32 (pilota varianta): **C25/30 XC4** + 8× R25 B500B + třmínky R10 á 200 mm
- **06_zaklady_titul.pdf p01 (titul-list výkresu A105)** říká:
  - ŽB DESKA: **C16/20-XC0** ❌
  - PILOTA: **C30/37-XC2** ❌

**Otázka:** Titul-list je nesprávně, opraví se na C25/30 XC4 pro obojí? Nebo statika není finální?

## 3. Vrata rozměry — TZ vs DXF

- TZ D.1.1 p04: "dvojice sekčních vrat o rozměrech **3500 × 4000 mm**"
- A101 DXF: 4 INSERT bloky `M_Vrata_ výsuvná_ sekční - **3000X4000** MM`
- PBŘ p18 tabulka: `vrata 2 × 4,000 × 3,500` (4 × 3.5 m orientace?)

**Otázka:** Skutečná šířka vrat 3000 nebo 3500 mm?

## 4. Krajní vaznice — UPE 160 vs C150×19,3

- TZ + statika D.1.2 p23 + K01 výkres titul: **UPE 160 S235** (19× explicit label v K01)
- A104 DXF: 2 INSERT bloky `C profil - C150X19_3` v Řez 2 + Řez 3

**Otázka:** A104 Řez 2+3 obsahuje legacy bloky (knihovny CAD)? Měly by se vyměnit za UPE160 grafiku?

## 5. Lindab svody — 3 vs 4

- TZ B p14: "počet svodů je navržen min. 4 ks"
- TZ B p23: "4 svody DN100"
- A101 půdorys 1NP DXF: **3 Lindab INSERT bloky**
- A104 pohledy DXF: **4 Lindab INSERT bloky** ✓

**Otázka:** V A101 chybí 1 svod (asi v rohu, který není viditelný v 1NP pohledu)?

## 6. Stroje technologie — 230 kW (150 + 80) v A106 vs TZ energetická bilance

- A106 DXF MTEXT explicitně uvádí:
  - PRACOVIŠTĚ DRIFT_E1: "VÝŠKA STROJE 3,5 m" + "PŘÍKON STROJE cca **150 kW**"
  - PRACOVIŠTĚ DEFRAME: "PŘÍKON STROJE cca **80 kW**"
  - PRACOVIŠTĚ FILTRAČNÍ JEDNOTKA: (bez výkonu)
- TZ B energetická bilance (p13–p15): hlavní jistič **3 × 100 A**, P_inst **83 kW** (CYKY-J 5×35) — pokrývá pouze osvětlení/VZT/ÚT, NIKOLI 230 kW technologie

**Otázka:** Bude technologie napájena z vlastní přívodu (asynchronní k objektu)? Nebo bude P_inst zvýšen na ~330 kW včetně technologie? Nebo se 80 kW + 150 kW v A106 změní?

## 7. Externí výkres 2966-1 dispozice strojů

- 10 INSERT block referencí napříč PD (A104 × 8, A106 × 1, A107 × 1)
- Status: **NEDODÁNO** — výkres není součástí předaného balíku PD

**Otázka:** Bude tento výkres dodán? Bez něho nelze plně specifikovat kotvící body strojů, podlahové úchyty a uspořádání bezpečnostního oplocení.

## 8. Bezpečnostní oplocení strojů

- A106 DXF: 3× MTEXT "**BEZPEČNOSTNÍ OPLOCENÍ BUDE UPŘESNĚNO**"

**Otázka:** Bude upřesněn typ, výška a délka oplocení (např. drátěná síť 2,0 m, sloupky betonové á 2,5 m)?

## 9. Bilance zemních prací

- TZ B: "bilance zemních prací 32 m³"
- Nezávislý výpočet z DXF A105 + A201 + axes envelope: **~530 m³** (figura pod deskou 250 + dohloubky patek rámových 24 + štítových 2,2 + pasy 7,2 + ruční u sítí 30 + safety 1:1 svahy 10 % = ~530 m³)

**Otázka:** TZ 32 m³ pravděpodobně zahrnuje pouze ruční dokopávky, nikoli figuru pod deskou. Můžete bilanci přepočítat a uvést rozpis (figura / dohloubky patek / ruční u sítí / odvoz na skládku)?

## 10. Sloupy IPE 400 — počet 30 vs 36 v DXF

- DXF A101: **36 INSERT bloků** `Sloup IPE - NNNNNN-1NP` (každý unikátní ID)
- Geometrie axes (6,1 m osa × 5 fields + 3 m intermediate): očekáváme cca 6 rámů × 2 sloupy = 12 sloupů, nebo 6 rámů × (2 + 2 vnitřní) = 24 sloupů

**Otázka:** 36 sloupů znamená, že každý rám má 6 sloupů (3 v každé řadě?), nebo jsou některé bloky v DXF duplikované při kreslení (např. top + bottom of footing view)? Skutečný počet sloupů IPE 400?

---

Děkuji za vyjasnění. Po doplnění budeme moci dokončit rozpočet v plné přesnosti.

S pozdravem,
[STAVAGENT týmu]