# GOLDEN TEST — SO 11-20-04 Železniční most v km 123,980 (Podchod)

**Stavba:** Rekonstrukce žst. Turnov (SŽ, s.o., IČ 70994234)
**Část:** D.2.1.4 Mosty, propustky a zdi
**Stupeň:** DSP + PDPS, 31.08.2025
**Projektant:** PROJEKT servis + SUDOP Brno + ATELIER 4
**Typ zakázky:** veřejná (SŽ) → **OTSKP primary**

**Zdroje pravdy** (`test-data/SO_11-20-04/`, inventář v README.md):
- `tz/SO_112004_1_001_TZ.pdf` — technická zpráva (44 číslovaných stran; PDF má 62 stran vč. příloh)
- `vykaz/XDC_ZM_1.XML` — výkaz výměr, export AspeEsticon (celá stavba, 88 objektů), 45 položek v tomto SO
- `vykresy/` — 13 výkresů (situace, půdorysy 2.021/2.022, řezy, tvary vč. reliéfu a CRM)

**Status:** kalibrační fixture pro 24. typ elementu (task
`docs/tasks/TASK_Element24_UzavrenyRam_Tubus_v2_1.md`). Kubatury = ground truth.
Geometrie = ground truth. Rozpad na jednotlivé DC ve výkazu NENÍ (výkaz je
agregovaný za celý SO).

**Verifikace 2026-07-15:** všechna čísla §2–§7 ověřena strojově proti TZ
(pdfplumber full-text) a XDC (ElementTree); VV PDF křížově proti XDC (vzorek ✓).
Verbatim citace s kotvami: `test-data/SO_11-20-04/SO_112004_tz_facts.md`.

---

## 1. Klasifikace — co MUSÍ vyjít

| pole | očekávaná hodnota |
|---|---|
| typ objektu | mostní objekt, železniční |
| statické působení | **rám** (uzavřený železobetonový) |
| typ elementu | **uzavřený rám (tubus), podtyp podchod** — 24. typ dle task v2 (dosud neexistuje) |
| monolit/prefab | monolitický |
| založení | plošné na podkladní ŽB desce (NE piloty) |
| počet mostních otvorů | 1 |
| catalog routing | OTSKP (veřejná zakázka SŽ) |

**Anti-kritérium:** klasifikátor NESMÍ vrátit `jiné`. NESMÍ vrátit `mostovka`.
Otevřený polorám (schodiště) tímto typem NENÍ — zůstává u stávajících typů.

---

## 2. Geometrie — ground truth z TZ

### 2.1 Most jako celek
| parametr | hodnota |
|---|---|
| délka přemostění | 5,5 m |
| délka nosné konstrukce | 6,5 m |
| rozpětí NK | 6,0 m |
| šířka mostu | 61,23 m |
| úhel křížení | 90° |
| stavební výška | 1,425 m (pod kolejí č. 2) |
| výška přesypávky | min. 0,18 m |
| podélný sklon | 0,3 % |

### 2.2 Tubus — rozhodující pro kalkulátor
| parametr | hodnota | POZOR |
|---|---|---|
| světlá šířka mezi stěnami | 5,5 m | |
| **světlá výška mezi spodní a horní deskou** | **3,0 m** | **← toto je pracovní výška podpěrné konstrukce** (TZ §3.7.1) |
| volná výška pod podhledem | 2,65 m | **NENÍ konstrukční — hotový průchozí profil pod hliníkovým podhledem tl. 200 mm; POZOR: parametrický blok TZ §3.6 ji uvádí jako „Světlá výška"** |
| tloušťka spodní desky | 500 mm | |
| tloušťka stěn | 500 mm | |
| tloušťka horní desky | 450 mm v ose / 400 mm u náběhu | |
| náběh horní desky | délka 600 mm, výška 200 mm | |
| sklon horní desky | střechovitý 2,5 % | |
| zkosení horních rohů | 100/100 mm | |
| zkosení hran | 20/20 mm | |
| šířka dilatační spáry | 20 mm | |

### 2.3 Dilatační celky
- **Celkem 10 DC (DC1–DC10).**
- **Tubus** tvoří DC **2, 4, 6, 8, 10**.
- **Schodiště** (6 ks) jsou v DC **1, 3, 5, 7, 9, 10**.
- **ŽB výtahové šachty** jsou součástí DC **2, 6, 10** (3 výtahy typu „D").

Schodiště = otevřený ŽB „polorám". Světlá šířka mezi stěnami:
DC 1 a 3 → 2450 mm; DC 5, 7, 9 → 4200 mm; DC 10 → 3350 mm.
Tloušťka schodišťových desek ≥ 300 mm. Schodišťové zídky š. 350 mm, v. min. 1100 mm.

**Počet DC je VSTUP z projektu. Kalkulátor ho nesmí dopočítávat.**

### 2.4 Podkladní vrstvy
| vrstva | materiál | tloušťka |
|---|---|---|
| podkladní beton | C16/20 X0 | 100 mm, přesah min. 200 mm |
| podkladní ŽB deska | C25/30 XC2/XF1, Cl 0,4, Dmax 16 | 200 mm, ukončena 500 mm od vnější hrany stěn |

---

## 3. Materiály a prostředí — ground truth

| konstrukce | beton | prostředí |
|---|---|---|
| **nosná konstrukce podchodu + schodišť** | **C30/37** | **XD1, XC4, XF2, XA1** — Cl 0,4, Dmax 22 mm, S3, max průsak 35 mm, dle ČSN EN 206+A2 / TKP 18 |
| podkladní deska | C25/30 | XC2/XF1 |
| betonová mazanina pod dlažbu | C25/30 | XF2 *(pozn.: legenda výkresu 2.021 uvádí C20/25 XF2 — viz §9)* |
| podkladní beton | C16/20 | X0 |
| výztuž | **B500B** | |

**Kombinace XD1 + XC4 + XF2 + XA1 je pro zapuštěný železniční podchod NORMÁLNÍ.
Kalkulátor NESMÍ hlásit „neobvyklá kombinace".** Je předepsaná projektem.

XF2 → zavzdušněný beton dle TKP 18, obsah vzduchu 4,0–6,0 % (ČSN EN 12350-7), „nepřevibrovávat".

---

## 4. Bednění — ground truth

**Pohledový beton PB3** dle ČSN 73 2577 / TKP 18 čl. 18.3.3.6(9) / ČBS TP 03/2018.
Klasifikace: **PB3 – C2, H1 (20×20), U2, S2, B3, T2, Z2**.

**B3 = atypické bednění.** Stěny podchodu a schodišť nesou **reliéfní motiv „Skal"**, provedený
**negativní maticí (vložkou) do bednění**, doporučená hloubka reliéfu 20 mm.
Před betonáží se do bednění dále osazují: vnitřní těsnicí pásy dilatačních a pracovních spár,
měřicí body bludných proudů (CRM), matrice letopočtu (výška písma 175 mm), chráničky, niky.

**Důsledek pro katalog:** viz §6.

---

## 5. Postup výstavby — ground truth (TZ §6)

Postup NENÍ „10 × 3". Řídí ho výluky (ZOV), ne objem.

**Etapa I — DC 5, 6, 7, 8, 9, 10**
1. snesení kolejí 1, 2, 3a, 3b, 5, 7; demontáž nástupišť
2. výkopy (svahování 1:1; mezi kolejemi 7 a 11 záporové pažení HEB 300 + převázky 2×U300 / 2×U220, pramencové kotvy)
3. **technologická přestávka 14 dní na aktivaci kotev**
4. během aktivace: podkladní beton DC 5, 7, 8, 9 → základová deska + schodiště DC 5, 7, 8, 9 *(„a schodišť" vč. DC8 — viz §9.3)*
5. po aktivaci: podkladní beton DC 6, 10 → základová deska + schodiště DC 6, 10
6. stěny DC 5, 7, 8, 9 → stěny DC 6, 10
7. stropní deska DC 5, 7, 8, 9 → stropní deska DC 6, 10
8. hydroizolace, sítě, podhledy, dlažba, zpětný spoj
9. zásyp; čelo zajištěno CPS I + štětovnice B=600 mm + kotvy
10. demontáž pažení

**Etapa II — DC 1, 2, 3, 4** (svahování 1:1, bez pažení)
podkladní beton → podkladní ŽB deska → základová deska + schodiště DC 1, 3, 4
*(TZ doslova „a schodišť" vč. DC4 — viz §9.3)* → totéž DC 2 →
stěny DC 1, 3, 4 → stěny DC 2 *(TZ doslova „stěn u dilatačních dílů 2 a 4" —
DC4 podruhé, viz §9.2)* → stropní deska DC 1, 3, 4 → stropní deska DC 2 → dokončení

**Betonáže na jeden DC (5, ne 3):**
`podkladní beton` → `podkladní ŽB deska` → `spodní deska + schodiště` → `stěny` → `stropní deska`
Z toho **3 jsou C30/37 (rám)**: spodní deska, stěny, strop → **30 betonáží rámu na 10 DC**.

---

## 6. Katalogová politika — ground truth z výkazu

**V celém SO (45 položek) NENÍ ANI JEDNA položka bednění, odbednění, ošetřování ani skruže.**

Jediná opalubková položka:

| kód | název | množství |
|---|---|---|
| **R3893211** | PŘÍPLATEK NA ATYPICKÉ BEDNĚNÍ STĚN – Reliéf | 1 kpl (**R položka**, ne OTSKP) |

**Pravidlo (potvrzeno reálnou zakázkou):**
- OTSKP → bednění + odbednění + ošetřování jsou **zahrnuty v betonové položce**.
  Kalkulátor vrací deterministickou `None`, důvod „zahrnuto v betonu dle OTSKP", confidence 1,0.
- **Atypický povrch (PB3, reliéf) → samostatný R-položkový příplatek.** Ne OTSKP kód.
- Výztuž zůstává samostatnou položkou vždy.
- ÚRS / RTS → každý řádek se oceňuje samostatně (beze změny).

**Zdroje bednění se v rámci jedné pozice nemíchají** (DOKA vs. PERI) — stávající pravidlo platí.

---

## 7. Výkaz výměr — ground truth (XDC, 45 položek)

**Cenové soustavy v jednom objektu: OTSKP 2025 = 38 · OTSKP 2026 = 1 · R položka = 6.**
Pole `cenova_soustava` je v XDC **na každé položce**. Žádné dodatky
(`mnozstvi_puvodni == mnozstvi`, `mnozstvi_dodatky == 0` na všech 45).
Položky jsou členěny do **10 stavebních dílů (TSKP 0–9)**: 0 všeobecné · 1 zemní
práce · 2 zakládání · 3 svislé konstrukce · 4 vodorovné konstrukce · 5 komunikace ·
6 úpravy povrchů · 7 izolace + dokončující · 8 potrubí · 9 ostatní.

### Jádro (kalkulátor)
| kód | název | množství | MJ | soustava |
|---|---|---|---|---|
| **389325** | MOSTNÍ RÁMOVÉ KONSTRUKCE ZE ŽELEZOBETONU C30/37 | **1 046,800** | M3 | OTSKP 2025 |
| **389365** | VÝZTUŽ MOSTNÍ RÁMOVÉ KONSTRUKCE Z OCELI 10505, B500B | **137,161** | T | OTSKP 2025 |
| R3893211 | PŘÍPLATEK NA ATYPICKÉ BEDNĚNÍ STĚN – Reliéf | 1,000 | kpl | R |
| 272324 | ZÁKLADY ZE ŽELEZOBETONU DO C25/30 | 200,970 | M3 | OTSKP 2025 |
| 272366 | VÝZTUŽ ZÁKLADŮ Z KARI SÍTÍ | 20,718 | T | OTSKP 2025 |
| 311325 | ZDI A STĚNY PODP A VOL ZE ŽELEZOBET DO C30/37 | 7,250 | M3 | OTSKP 2025 |
| 311365 | VÝZTUŽ ZDÍ A STĚN Z OCELI 10505, B500B | 0,534 | T | OTSKP 2025 |
| 451313 | PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C16/20 | 113,440 | M3 | OTSKP 2025 |
| 451314 | PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C25/30 | 44,229 | M3 | OTSKP 2025 |
| 45131A | PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25 | 231,660 | M3 | OTSKP 2025 |
| 631384 | MAZANINA ZE ŽELEZOBETONU DO C25/30 VČET VÝZTUŽE | 62,550 | M3 | OTSKP 2025 |

### Zemní práce a zajištění jámy
| kód | název | množství | MJ |
|---|---|---|---|
| 125733 | VYKOPÁVKY ZE ZEMNÍKŮ A SKLÁDEK TŘ. I, ODVOZ DO 3KM | 864,712 | M3 |
| 131733 | HLOUBENÍ JAM ZAPAŽ I NEPAŽ TŘ. I, ODVOZ DO 3KM | 4 854,090 | M3 |
| 17411 | ZÁSYP JAM A RÝH ZEMINOU SE ZHUTNĚNÍM | 864,712 | M3 |
| 17482 | ZÁSYP JAM A RÝH Z NAKUPOVANÉ ZEMINY SE ZHUTNĚNÍM | 1 297,068 | M3 |
| 22694 | ZÁPOROVÉ PAŽENÍ Z KOVU DOČASNÉ | 16,517 | T |
| 22695 | VÝDŘEVA ZÁPOROVÉHO PAŽENÍ DOČASNÁ | 14,025 | M3 |
| 26123 | VRTY PRO KOTVENÍ, INJEKTÁŽ A MIKROPILOTY TŘ. II | 156,000 | M |
| 264127 | VRTY PRO PILOTY TŘ. I D DO 500MM | 136,000 | M |
| 285378 | KOTVENÍ NA POVRCHU Z PŘEDPÍNACÍ VÝZTUŽE DL. DO 10M | 8,000 | KUS |
| 285379 | PŘÍPLATEK ZA DALŠÍ 1M KOTVENÍ | 112,000 | M |
| R23217 | ŠTĚTOVÁ STĚNA K ZAJIŠTĚNÍ KOLEJOVÉHO LOŽE | 3,615 | T |
| 45869 | VÝPLŇ ZA OPĚRAMI ZE STABILIZOVANÉHO POPÍLKU | 281,000 | M3 |
| 564401 | KAMENIVO ZPEV POPÍLK SUSPENZÍ TŘ I (CPS1, čelo) | 281,000 | M3 |

### Izolace a povrchy
| kód | název | množství | MJ |
|---|---|---|---|
| 711112 | IZOLACE PROTI ZEMNÍ VLHKOSTI ASF. PÁSY | 3 461,270 | M2 |
| 711131 | IZOLACE PROTI VOLNĚ STÉKAJÍCÍ VODĚ | 63,800 | M2 |
| 711321 | IZOLACE PODZEM OBJ PROTI TLAK VODĚ ASF NÁTĚRY | 2 297,450 | M2 |
| 71150 | OCHRANA IZOLACE NA POVRCHU | 1 017,320 | M2 |
| 711507 | OCHRANA IZOLACE NA POVRCHU Z PE FÓLIE | 1 251,020 | M2 |
| 711509 | OCHRANA IZOLACE NA POVRCHU TEXTILIÍ | 2 297,450 | M2 |
| 7838H | NÁTĚRY BETON KONSTR ANTIGRAFITI | 388,000 | M2 |
| 46591 | DLAŽBY Z KAMENICKÝCH VÝROBKŮ | 535,248 | M2 |
| 465922 | DLAŽBY Z BETONOVÝCH DLAŽDIC NA MC | 442,288 | M2 | **OTSKP 2026** |
| 787117 | ZASKLÍVÁNÍ STĚN A PŘÍČEK BEZPEČNOSTNÍM SKLEM | 43,400 | M2 |
| 348945 | ZÁBRADLÍ A ZÁBRADEL ZÍDKY Z NEREZ OCELI (madla) | 1,420 | T |

### Potrubí
| kód | název | množství | MJ |
|---|---|---|---|
| 87614 | CHRÁNIČKY Z TRUB PLAST DN DO 40MM | 5,100 | M |

### Dilatační spáry
`931242` 155,640 M · `931325` 171,900 M · `931331` 145,000 M · `931335` 142,000 M · `93136` 137,520 M2

### R položky (mimo OTSKP)
`R02943` RDS 1 kpl · `R23217` štětovnice 3,615 T · `R3893211` reliéf 1 kpl ·
`R7679901` výtahové šachty 2,902 T · `R7679910` podhled v podchodu 451,420 M2 · `R7679911` poklopy 3 KS

---

## 8. Kalibrační konstanty odvozené z tohoto projektu

| veličina | hodnota | odvození | poznámka |
|---|---|---|---|
| **rebar index — mostní rámová konstrukce** | **131,0 kg/m³** | 137 161 kg ÷ 1 046,800 m³ | C30/37, OTSKP 389325/389365. **n = 1** — kalibrace z jednoho projektu, NE norma |
| rebar index — podkladní ŽB deska (KARI) | 103,1 kg/m³ | 20 718 kg ÷ 200,970 m³ | KARI sítě, ne prutová výztuž |
| rebar index — zdi a stěny podp. a vol. | 73,7 kg/m³ | 534 kg ÷ 7,250 m³ | malý objem, nízká váha |

**Křížové kontroly, které MUSÍ sedět:**
- `631384` mazanina ŽB 62,550 m³ ÷ 0,050 m = **1 251 m²** ≡ `711507` PE fólie **1 251,020 m²** ✓
- `272324` základy 200,970 m³ ÷ 0,200 m ≈ **1 005 m²** půdorysu podkladní ŽB desky ✓
- `451313` podkladní beton 113,440 m³ ÷ 0,100 m ≈ **1 134 m²** (> 1 005 m², odpovídá přesahu 200 mm) ✓

Průměry výztuže rámu: **z dostupných podkladů NEODVODITELNÉ.** Bez výkresu výztuže
(`SO_112004_..._Výztuž`) nezadávat default. Honest-blank.

---

## 9. Nesrovnalosti v projektu (NE defekty enginu)

Engine je má **detekovat a nahlásit**, ne opravit.

1. **Betonová mazanina — konflikt TZ vs. výkres.**
   TZ §3.7.5 a Tab. 1 (§3.19): **C25/30 XF2**.
   Legenda výkresu 2.021: **C20/25 XF2**.
   Výkaz obsahuje obojí: `451314` C25/30 (44,229 m³) i `45131A` C20/25 (231,660 m³).

2. **DC4 uveden v postupu dvakrát.**
   TZ §6 Etapa II: „stěny u dilatačních dílů 1, 3 a 4" a hned „stěny u dilatačních dílů 2 a 4".
   Zároveň §3.8.1 řadí DC4 k paženému úseku etapy I („mezi celky 6 a 4"), ale výstavba DC4
   je v etapě II.

3. **Schodiště přiřazeno tubusovým DC bez schodiště — v OBOU etapách.**
   Tubus = DC 2, 4, 6, 8, 10. Schodiště = DC 1, 3, 5, 7, 9, 10.
   Etapa I: „základové desky **a schodišť** u dilatačních dílů 5, 7, **8** a 9" — DC8 schodiště nemá.
   Etapa II: „základové desky **a schodišť** u dilatačních dílů 1, 3 **a 4**" — DC4 schodiště nemá.
   *(druhý výskyt nalezen při strojové verifikaci 2026-07-15 — stejná třída chyby)*

4. **Světlá výška — dvě hodnoty.**
   TZ §3.6.2: 2,65 m (pod podhledem, v parametrickém bloku jako „Světlá výška").
   TZ §3.7.1: 3,0 m (mezi deskami).
   Není to chyba projektu, ale je to past pro extraktor.

---

## 10. Registr defektů enginu (z live běhu, mapováno na příčinu)

| # | pozorované chování | kořenová příčina | fix |
|---|---|---|---|
| 1 | klasifikace `jiné`, confidence 0,3 | mezi 23 typy elementů **není rámová konstrukce** | PR1 — 24. typ |
| 2 | výztuž ~104 t místo 137,161 t (−24 %) | v rebar matici není řádek pro rám → fallback na generický default (~99 kg/m³) | PR1 — kalibrace 131,0 kg/m³ se zdrojem |
| 3 | 9 taktů místo 10 DC | počet záběrů dopočítán vzorcem místo převzetí z projektu | PR1 — DC je vstup |
| 4 | technologie zjednodušena na mostovku | chybí třífázová sekvence spodní deska → stěny → strop | PR1 |
| 5 | bednění navrženo jako pro mostovku | chybí stěnové bednění + podpěrná konstrukce stropu; a zároveň se nesmí generovat OTSKP položky bednění | PR1 |
| 6 | podpěrná konstrukce: záměna tl. stropu 0,45 m za pracovní výšku | pracovní výška se bere ze špatného pole | PR1 — světlá výška rámu = **3,0 m** |
| 7 | varování „neobvyklá kombinace XD1/XC4/XF2/XA1" | varování padá i na kombinace předepsané projektem | PR1 |
| 8 | 128 dní jako „termín" | výstup modelu prezentován jako harmonogram | UI/report — mimo PR1 |
| 9 | hardkód zdroj → verze katalogu | XDC nese `cenova_soustava` per položku; v tomto SO 2025 + 2026 + R | PR3 (Fix 3) |
| 10 | OTSKP 2025 vs 2026 nerozlišeno | `465922` je 2026, zbytek 2025 | PR3 (Fix 4) |

---

## 11. Acceptance — kdy je golden test zelený

1. Klasifikátor: **uzavřený rám (tubus), podtyp podchod, monolit** (ne `jiné`,
   ne `mostovka`; otevřený polorám tímto typem není), založení plošné.
2. Počet DC = **10**, převzat, nedopočítán.
3. Sekvence na DC: podkladní beton → podkladní ŽB deska → spodní deska + schodiště → stěny → strop.
4. Betonáží rámu C30/37: **30** (10 DC × 3 fáze, konvenční technologie A).
5. Pracovní výška podpěrné konstrukce = **3,0 m**. Hodnota 2,65 m ani 0,45 m se do ní nedostane.
6. Výztuž rámu při objemu 1 046,800 m³ → **137,1 t ± 3 %** (index 131,0 kg/m³).
7. Katalog OTSKP → **žádné položky bednění / odbednění / ošetřování**; deterministická `None`
   s důvodem a confidence 1,0.
8. Atypický povrch (PB3 + reliéf) → návrh **R-položkového příplatku**; volba
   technologie = **A konvenční** (niky, šachty, schodiště, reliéf, 2 etapy — task v2 §2.4).
9. Třídy XD1/XC4/XF2/XA1 → **bez varování**.
10. Hlášeny nesrovnalosti z §9 jako nálezy v dokumentaci (4 třídy, z toho #3 v obou etapách).
11. `cenova_soustava` čtena z položky, ne z globální konstanty; 2025 / 2026 / R rozlišeny.
