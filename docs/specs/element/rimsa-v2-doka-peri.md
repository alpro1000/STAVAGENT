# ŘÍMSA (Mostní římsa) — Spецификация элемента для калькулятора

**Версия:** 1.0  
**Статус:** Проработка логики (перед Claude Code task)  
**Приоритет:** ВЫСОКИЙ (в таблице TODO отмечен как таковой)  
**Контекст:** Monolit-Planner, добавить в calculator_element_logic

---

## 0. ЧТО ТАКОЕ РИМСА И ЗАЧЕМ ОНА НУЖНА

Mostní římsa — prvek mostu sloužící k uchycení zábradlí či svodidla, tvoří zvýšenou obrubu. Проще: это боковой бортик моста, который:
- Удерживает сводидло/зábradlí
- Ограничивает проезжую часть
- Защищает краевую часть mostovky от воды
- Tvoří architektonické zakončení svršku mostu

**Положение в последовательности строительства моста:**  
Základ → Opěra → Pilíř → Mostovka → **ŘÍMSA** → Vozovka → Svodidla

Римса всегда после mostovky — это принципиально, потому что она монтируется/бетонируется на уже готовой консоли носной конструкции.

---

## 1. ТИПЫ РИМС — Podtypy

### 1.1 Классификация по технологии изготовления

| Podtyp | Описание | Когда применяется |
|--------|----------|-------------------|
| **Monolitická** | Целиком бетонируется на месте | Индивидуальные формы, сложный профиль |
| **Prefabrikovaná** | Готовые элементы с завода | Типовые мосты, скорость монтажа |
| **Kombinovaná (nejčastější)** | Prefabrikát (tl. 100mm, dl. 2000mm) zajišťuje pohledovou a bednicí funkci, monolitická část zakotvena třmínky | Большинство современных мостов ЧР |

### 1.2 Классификация по форме профиля

| Tvar | Описание | Nosný systém |
|------|----------|--------------|
| **Přímý obdélník** | Простой прямоугольный профиль | Малые мосты, пешеходные |
| **Typ T (se svodidlem)** | С вертikálním плечом для анкеровки сводидла | Все автомобильные мосты > 60 km/h |
| **Typ L (obruba)** | L-образный, для дорог до 60 km/h | Без сводidel |
| **Se soklem** | С отдельным цоколем для сводidla | Реконструкции |

### 1.3 Размеры (типовые, из практики ČR)

```
Výška římsy:      400–700 mm (bez svodidla: 200–400 mm)
Šířka u základny: 400–700 mm  
Šířka v koruně:   200–400 mm
Délka mostu:      = délce mostu (одна непрерывная или с dilatačními celky)

Průřez typické římsy se svodidlem (silniční most):
     ┌──────┐  ← 300mm
     │      │
     │      │  ← výška 600mm
     │      │
─────┴──────┴──────  ← 600mm u základny
```

**Objem na 1 bm délky:** 0.08–0.25 m³/bm (typicky 0.12–0.18 m³/bm)  
**Plocha průřezu:** 0.08–0.25 m² (lineárně)

---

## 2. MATERIÁLY

### 2.1 Třída betonu

Римса — один из самых агрессивных сред для бетона: соль, мороз, вода, абразия. Требуется высокая класс:

| Prostředí | Třída betonu | Kdy |
|-----------|-------------|-----|
| Silniční most, zimní údržba | **C35/45 – XF4, XD3** | Стандарт ЧР |
| Silniční most, bez chemie | C30/37 – XF2, XD1 | Редко |
| Železniční most | **C35/45 – XF4, XC4** | SŽ požadavek |
| Dálnice | **C40/50 – XF4, XD3** | ŘSD, extrémní zatížení |

**XF4** = nejtvrdší zmrazovací stupeň (nasycení vodou + tající posypové soli)  
**XD3** = cyklické zvlhčování chloridy

Nosná konstrukce typicky C35/45 – XF2, XD1, XC4; spodní stavba C30/37 – XF2, XD1. Римса — сложнее окружение чем NK, потому XF4.

### 2.2 Výztuž

Малый průřez, густое армирование:

| Параметр | Значение |
|----------|----------|
| Třída výztuže | B500B |
| Index vyztužení | **120–180 kg/m³** (bardzo densely reinforced!) |
| Krycí vrstva | **min. 50 mm** (agresivní prostředí XD3+XF4) |
| Průměry | Ø12–Ø20 (nosná výztuž), Ø8–Ø10 (třmínky) |

**Сравнение с другими элементами:**
- Základ: 80–120 kg/m³
- Pilíř: 120–180 kg/m³  
- Римса: **120–180 kg/m³** — как у pilíře, но малый объём!

---

## 3. СИСТЕМЫ ОПАЛУБКИ — DOKA A PERI (реальные данные)

### 3.1 Три systémy (podle DOKA školení 2026)

Existují přesně **3 systémy** pro bednění mostních říms. Výběr závisí primárně na délce mostu a poloměru zakřivení.

---

#### SYSTÉM 1: Římsové bednění T (DOKA)
*= PERI: konzolový systém MULTIFLEX GT / tradiční konzoly*

**Характеристика:** Rychlý ruční systém pomocí jednotlivých konzol.

**Kdy použít:**
- Optimální pro délku ≤ 50 m (celá římsa najednou)
- Optimální pro délku ≤ 150 m (s nízkým počtem přemísťování)
- Vhodné pro přímé mosty I mosty v půdorysném oblouku

**Komponenty (DOKA, hmotnosti):**
| Díl | Délka | Hmotnost |
|-----|-------|----------|
| Konzola římsového bednění T | 0,80 m | 22 kg |
| Římsový nosník T | 1,40 m | 16 kg |
| Římsová svěrka T | 0,40 m | 10 kg |
| Zábradlí | 1,00 m | 4 kg |
| **Celkem konzola** | — | **~52 kg** |

**Dimenzování:**
- Šířka římsy: b = **8–60 cm**
- Výška římsy: h = **0–76 cm**
- Rozteč konzol: a = **80–180 cm**
- Max. síly: Nd = 34,5 kN, Vd = 10,5 kN
- Přizpůsobení úklonům: ±15°

**Kotevní místo:** Hřebíkový konus 15,0 → po betonáži odstraněn → krycí vrstva kotvy a = 4 cm. Pro rekonstrukce: dodatečná kotva + krycí pouzdro 21 mm. Utěsnění: Zinková zátka 15,0 nebo Zátka 29 mm.

**PERI ekvivalent (z nabídky D6 Nové Strašecí 2018):**
PERI MULTIFLEX nosníkový systém — konzoly z příhradových nosníků GT, rozteč 2,00 m.
- Nájem: **138,31 Kč/bm/měsíc**
- Prodej ztratných dílů (kónusy DW15, kotvení): **62,50 Kč/bm**
- Neobsahuje: překližku/plášť bednění
- Dodávka stavby: podlahové fošny, prkna zábradlí pochůzí lávky

---

#### SYSTÉM 2: Římsový vozík TU (DOKA)
*= závěsný systém pro bednění říms*

**Kdy použít:**
- Optimální pro délku **> 150 m**
- Mosty přímé nebo R ≥ 250 m
- Vyšší množství pracovních taktů
- Vhodné pro sanace/rekonstrukce říms
- Vhodné pro mostní konstrukce s **širokými římsami** a vykonzolovanou NK

**Parametry:**
- Délka sekce vozíku: **4 m**
- Maximální délka betonovaného taktu: **6 × 4 = 24 m** (spojení až 6 jednotek)
- Obvyklá rychlost: **2 pracovní takty za týden**

**Výhody:**
- Volný přístup k betonované římse
- Armovací práce + betonáž bez narušení provozu pod mostem
- Rychlá de/montáž díky vysokému stupni předmontáže

---

#### SYSTÉM 3: Římsový vozík T (DOKA)
*= převěšené pojízdné bednění mostních říms*

**Kdy použít:**
- Optimální pro délku **> 150 m**
- Mosty přímé nebo s velkými poloměry zakřivení
- Vhodné pro rekonstrukce i jako demoliční vozík

**Parametry:**
- Obvyklé takty betonáže: **5 m** (max)
- Méně komponent než vozík TU
- Vyžaduje prostor na horním povrchu mostovky pro **protizávaží**

---

### 3.2 Rozhodovací matice (logika kalkulátoru)

```
délka_mostu ≤ 50m:
    → Systém 1 (Římsové bednění T / konzoly MULTIFLEX)
    → celá délka najednou, bez přemísťování

délka_mostu 50–150m:
    → Systém 1 (s přemísťováním konzol)
    → NEBO Systém 2/3 pokud mosty obloukové

délka_mostu > 150m, přímý nebo R ≥ 250m:
    → Systém 2 (vozík TU) — pro velké a obloukové mosty
    → Systém 3 (vozík T) — pro přímé mosty, potřeba protizávaží

délka_mostu > 150m, R < 250m (malý oblouk):
    → Systém 2 (vozík TU) — jediný vhodný

Rekonstrukce:
    → Všechny 3 systémy vhodné (Systém 2 = nejlepší pro sanace)
```

### 3.3 PERI ekvivalenty (pro doplnění katalogu)

| DOKA systém | PERI ekvivalent | Poznámka |
|-------------|----------------|----------|
| Římsové bednění T | PERI SB římsový systém, MULTIFLEX GT konzoly | Konzoly á 2m rozteč |
| Římsový vozík TU | PERI VRB / římsový vozík | Pronájem, projekt-specific |
| Římsový vozík T | PERI římsový vozík T | Méně běžný |

---

## 4. POSTUP PRACÍ — Graf operací

### 4.1 Základní cyklus (římsový vozík)

```
PŘEDPOKLAD: mostovka hotová, výztuž čeká na konzole

[CYKLUS pro každý záběr N]:

příprava_podkladu ──→ osazení_vozíku ──→ bednění_záběru ──→ armování ──→ betonáž ──→ ošetření ──→ odbednění_min ──→ posun_vozíku
     │                     │                   │              │           │            │               │
     │                     │                   │              │           │         12–24h          po 24–48h
  vyčistit NK          vozík se zavěsí    vnější bednění    B500B     čerpadlem   fólie/kropit    část bednění
  kontaktní plochu     na NK konzolu      + vnitřní       Ø12–Ø20    shora       zakrýt           uvolnit
                                          strana            120–180    malé objemy                  vozík posunout
                                                            kg/m³       0.5–3 m³/záběr

→ na dalším záběru: repeat
→ po odbednění (3–7 dní): kontrola geometrie + povrchu
```

### 4.2 Základní cyklus (kombinovaná metoda)

```
PŘEDPOKLAD: výztuž čeká na konzole NK

montáž_prefabrikátu ──→ výškové_uložení ──→ dovázání_výztuže ──→ dobetonávka ──→ ošetření ──→ montáž_svodidel
        │                     │                    │                  │              │
    jeřáb 25–50t          geodetická          třmínky z prefa     čerpadlem         7 dní min
    dl. 2000mm/ks          kontrola           + nosná výztuž      0.3–1 m³/ks      dle ČSN EN 13670
                          ±3mm výška          do proluk
```

### 4.3 Posun v celkovém harmonogramu mostu

```
Spodní stavba (základy + opěry + pilíře)
         ↓
Nosná konstrukce (mostovka)
         ↓
PŘEDPJETÍ (pokud je NK předpjatá) — min. 7 dní po betonáži NK
         ↓
ŘÍMSЫ — ZAČÍNÁ AŽ PO PŘEDPJETÍ NEBO DOSTATEČNÉM ZATVRDNUTÍ NK
         ↓
Vozovkové souvrství (hydroizolace + asfalt)
         ↓
Svodidla / zábradlí (osazení do zatvrdlé římsy — min. 14 dní po beton. římsy)
         ↓
Mostní závěry, odvodňovače
```

**KRITICKÁ ZÁVISLOST:** Начало бетонировки римс — не раньше чем NK достигнет **70% pevnosti** (минимум 7 дней, обычно 14–28 дней).

---

## 5. БЕТОНИРОВАНИЕ — Technologie

### 5.1 Způsob podání betonu

- **Výhradně čerpadlem** — малый průřez, высокое расположение, точность укладки
- Hadicové čerpadlo (gumová hadice Ø100–125mm) → ручное направление
- Autodomíchávač → stacionární čerpadlo na mostovce → hadice → bednění

### 5.2 Objem betonu na záběr

Для типового профиля 0.12–0.18 m²:
- Záběr 10m: **1.2–1.8 m³**
- Záběr 15m: **1.8–2.7 m³**
- Záběr 20m: **2.4–3.6 m³**

Итого: малые объёмы на záběr → **1–4 m³/záběr**

### 5.3 Vibrování

- **Ponorný vibrátor** Ø38–50mm (malý průřez, hustá výztuž)
- **Příložný vibrátor** — у prefabrikované vnější stěny
- Обязательная вибрация каждого слоя, без перерыва

### 5.4 Ošetřování betonu

Очень важно для XF4+XD3:
- **Okamžité zakrytí** fólií po betonáži (ochrana před vysycháním + mrazem)
- **Min. 7 dní** nepřetržitého ošetřování (ČSN EN 13670, třída ošetřování 3 pro agresivní prostředí)
- Kropit vodou každé 4–6h při teplotách > 10°C
- При температурах < 5°C: tepelná ochrana (rohože)

---

## 6. БРИГАДА И ПРОИЗВОДИТЕЛЬНОСТЬ

### 6.1 Složení party (římsový vozík, záběr 15m)

| Operace | Počet | Poznámka |
|---------|-------|----------|
| Bednění (vozík, posun) | 2–3 tesaři | Hydraulický posun vozíku |
| Armování | 2–3 železáři | Hustá výztuž, složité tvary |
| Betonáž | 2 betonáři | Řízení hadice + vibrování |
| Ošetření a dokončení | 1 dělník | Fólie, kropit, povrch |
| Vedoucí party/geodet | 1 | Geometrická kontrola |
| **CELKEM** | **8–10** | Na jednu stranu |

Pokud 2 vozíky (obě strany současně): **~16–18 lidí**

### 6.2 Produktivita (reálná data z DOKA školení 2026)

| Metoda | Délka taktu | Takty/týden | Délka/týden |
|--------|-------------|-------------|-------------|
| Římsové bednění T (konzoly) | celá délka najednou ≤150m | — | celá délka |
| Římsový vozík TU | 4–24 m | **2 takty/týden** | 8–48 m/týden |
| Římsový vozík T | 5 m (max) | **2 takty/týden** | ~10 m/týden |

**Klíčová cifra z DOKA:** obvyklá rychlost = **2 pracovní takty za týden** pro vozíkové systémy.

Cyklus vozíku TU (takt 4m):
- Posunutí vozíku + bednění: 0,5 dne
- Armování: 1 den
- Betonáž: 0,5 dne
- Zrání min. 12–24h
- → **celkem: 2,5 dne = 2 takty za 5 dní (týden)**

---

## 7. MECHANIZACE

| Mechanismus | Použití | Kolik |
|-------------|---------|-------|
| Čerpadlo betonu | Povinné | 1 (stacionární nebo autodomíchávač s čerpadlem) |
| Autojeřáb | Osazení prefabrikátů, materiál | 1 × 25–50t (jen u prefabrikátové metody) |
| Římsový vozík | Systémové bednění | 1–2 ks (pronájem) |
| Vibrátor ponorný | Vibrování | 2 (vždy záloha) |
| Vibrátor příložný | U vnější stěny | 1 |
| Věžový jeřáb | Materiál na mostovku | Pokud není přístup jinak |

---

## 8. CELKOVÁ DOBA (orientace)

| Délka mostu | Metoda | Orientační doba pro obě římsy |
|-------------|--------|-------------------------------|
| < 50m | Tradiční / kombinovaná | **2–4 týdny** |
| 50–200m | Kombinovaná / vozík | **4–10 týdnů** |
| 200–500m | Římsový vozík | **8–20 týdnů** |
| > 500m | 2 vozíky paralelně | **16–30 týdnů** |

**Faktor prodloužení:**
- Déšť a teplota < 5°C → přerušení
- Problém se zásobováním betonem → přerušení
- Geometrické odchylky → oprava

---

## 9. NORMY A PŘEDPISY

| Norma/Předpis | Relevance pro římsu |
|---------------|---------------------|
| **ČSN EN 13670** | Provádění betonových konstrukcí — min. ošetřování, tolerance |
| **ČSN EN 206+A1** | Specifikace betonu — XF4, XD3 třídy |
| **ČSN 73 6201** | Projektování mostních objektů — geometrie, vybavení |
| **VL 4** | Vzorový list VL4 definuje uspořádání mostního svršku — svodidla, obruby, římsy |
| **TKP 18** | Betonové konstrukce a mosty — klíčový pro provádění |
| **VTP/ZP/09/24** | SŽ — pro železniční mosty |
| **TP 204** | Hydrotechnické posouzení — zmínka odvodnění přes konzoly |

---

## 10. ВХОДНЫЕ ПАРАМЕТРЫ ДЛЯ КАЛЬКУЛЯТОРА

### 10.1 Обязательные (пользователь вводит)

| Parametr | Jednotka | Typické hodnoty | Откуда |
|----------|----------|-----------------|--------|
| Celková délka říms | m | 20–2000 | Z projektu |
| Plocha průřezu římsy | m² | 0.08–0.25 | Z výkresů / default |
| Třída betonu | — | C35/45 | Z projektu / default XF4 |
| Metoda provedení | — | vozík/tradiční/kombinovaná | Výběr |
| Délka záběru (vozík) | m | 10–20 | Default 15m |
| Počet vozíků | — | 1 nebo 2 | Default 1 |

### 10.2 Vypočtené (kalkulátor počítá)

| Výsledek | Vzorec |
|----------|--------|
| Celkový objem betonu | délka × plocha_průřezu |
| Počet záběrů | ceil(délka / délka_záběru) |
| Objem/záběr | délka_záběru × plocha_průřezu |
| Celková doba | záběry × dny_na_záběr |
| Hmotnost výztuže | objem × index_vyztužení (130–160 kg/m³) |
| Plocha bednění | délka × (výška + šířka × 2) |

### 10.3 Defaults

```python
defaults = {
    "trida_betonu": "C35/45",
    "stupen_prostred": "XF4, XD3",
    "index_vyztuzeni_kg_m3": 150,  # střed rozsahu
    "kryci_vrstva_mm": 50,
    "metoda": "rims_vozik",  # pro delší mosty
    "delka_zaberu_m": 15,
    "pocet_voziku": 1,
    "dni_na_zaberou": 2.5,  # střed 2–3 dny
    "crew_size_per_side": 9,
}
```

---

## 11. SPECIÁLNÍ SITUACE

### 11.1 Železniční mosty (SŽ)

- Vyšší požadavky na kvalitu povrchu (prašnost, pohledový beton)
- Dle VTP/ZP: třída ošetřování betonu 4 (> 7 dní)
- Prefabrikáty méně časté → více monolitických
- Římsový vozík standardní technologií

### 11.2 Dálniční mosty (ŘSD)

- C40/50 – XF4, XD3 (vyšší třída)
- Římsový vozík povinný pro délky > 100m
- 2 vozíky paralelně pro urychlení
- Postřik ošetřovacím prostředkem místo fólie

### 11.3 Rekonstrukce (náhrada starých říms)

- Bourání staré římsy: pneumatická kladiva, řezání
- Kontrola výztuže NK pod římsou (koroze?)
- Přídavné kotvy do NK pokud stará výztuž nestačí
- Objem menší → spíše tradiční bednění

### 11.4 Zimní betonáž (teploty < 5°C)

- Předehřev bednění
- Ohřátá betonová směs (t > +10°C)
- Tepelná ochrana min. 48h (rohože, stany)
- Záznam do stavebního deníku povinný

---

## 12. VÝSTUP DO TOV + REÁLNÉ CENY PRONÁJMU

### 12.1 Výstup do TOV

| TOV sekce | Co kalkulátor vyplní |
|-----------|---------------------|
| **Práce** | Počet dělníků × dny × sazba |
| **Pronájem bednění** | Pronájem systému: Kč/bm/měsíc × délka × měsíce |
| **Beton** | Objem m³ (cenu doplní uživatel) |
| **Mechanizmy** | Čerpadlo: hodiny × sazba |
| **Materiály** | Výztuž: hmotnost t; ztratné díly (kónusy, zátky) |

### 12.2 Reálné ceny pronájmu bednění (PERI, 2018, stavba D6)

**VAROVÁNÍ: Ceny z roku 2018 — navýšit o inflaci ~40–50% pro aktuální odhad.**

| Pozice | Systém | Sazba | Jednotka |
|--------|--------|-------|----------|
| Bednění římsy | PERI MULTIFLEX GT konzoly | **138,31 Kč** | bm × měsíc |
| Bednění římsy — ztratné | Kónusy DW15, kotvení | **62,50 Kč** | bm (prodej) |
| Nosníkový rošt GT24 (NK) | PERI GT 24 | 65,00 Kč | m² × měsíc |
| Překližka (nájem) | 3-vrstvá smrk 21mm | 61,80 Kč | m² × měsíc |
| Překližka (prodej) | TOPOL F/F 21mm | 210,00 Kč | m² (prodej) |
| Podpěrné věže ST100 | PERI ST100 | 31,00 Kč | m³ × měsíc |
| Podpěrné věže ROSETT | PERI UP ROSETT FLEX | 100–200 Kč | m³ × měsíc |

**Pro kalkulátor — aktualizovaný odhad (2025):**
- Římsové bednění konzoly: ~**200–250 Kč/bm/měsíc** (nájem)
- Ztratné díly: ~**90–100 Kč/bm** (prodej)
- Vozíkový systém TU/T: projekt-specific, poptávka u DOKA/PERI

**Kalkulátor nechá pole ceny pronájmu prázdné s defaultem → uživatel doplní aktuální nabídku od DOKA/PERI.**

---

## 13. ACCEPTANCE CRITERIA (navazují na globální čísla projektu)

Numbering navazuje na existující kritéria v projektu — doplnit aktuální číslo.

- Kalkulátor rozlišuje 3 metody provedení a přepíná logiku
- Pro metodu vozík: počítá záběry, dny/záběr, celkovou dobu
- Objem a hmotnost výztuže správně vypočteny
- Default beton C35/45 – XF4 (ne C25/30 jako pro základy)
- Crew size odpovídá metodě (vozík vs. tradiční)
- TOV předvyplněn správně
- Celková doba pro most 200m, záběr 15m, 1 vozík ≈ 13–20 záběrů × 2.5 dne ≈ 33–50 dní

---

## 14. VAZBY NA OSTATNÍ ELEMENTY

- **Mostovka (mostovkova_deska)** → PŘEDCHŮDCE. Bez hotové mostovky nelze začít římsu.
- **Předpjetí** (pokud NK předpjatá) → PŘEDCHŮDCE. Римса až po vnesení předpjetí.
- **Svodidla** → NÁSTUPCE. Osazení až po zatvrdnutí římsy (min. 14 dní).
- **Vozovkové souvrství** → NÁSTUPCE (může být paralelně s římsami na jiných polích).

---

*Připraveno jako podklad pro Claude Code task. Naming a strukturu určovat dle konvencí v repozitáři.*
