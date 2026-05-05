# Provizorium Specs — SO 180 Žihle 2062-1

> ⚠️ **TO-VERIFY WITH VENDOR RFQ.** Všechny náklady ORIENTAČNÍ — bez RFQ
> (request for quotation) od reálného vendora (Mabey, Bailey, Acrow). Pro
> nabídku do tendru zhotovitel musí získat skutečné ceny.

## 1. Požadavek (ZD §4.4.o + Vysvětlení ZD č.1)

| Parametr | Hodnota | Zdroj |
|---|---|---|
| Status | **POVINNÉ** | ZD §4.4.o + Vysvětlení ZD č.1 ad 2 |
| Alternativa "úplná uzavírka + objízdná" | **ZAMÍTNUTA** | Vysvětlení ZD č.1 ad 2: "alternativu úplné uzavírky komunikace v místě stavby mostu s vedením objízdné trasy po stávajících komunikacích a bez požadovaného mostního provizoria … nepřipouští. Vzhledem k zajištění dopravní obslužnosti obce Žihle …" |
| Typ minimální | Jednosměrné se světelnou signalizací | ZD §4.4.o |
| Povolená vozidla | Do 3.5 t + linková veřejná doprava | ZD §4.4.o |
| Konzultace s provozovatelem | Uchazeč zajistí parametry provozovatele linkové veřejné dopravy | ZD §4.4.o |

## 2. Vendor options

### Mabey Compact 200 *(Recommended)*

| Parametr | Hodnota |
|---|---|
| Typ | Modular panel bridge |
| Délka | 6-60 m (modular) |
| Únosnost | LM1 truck loading (do 40 t) — overkill pro 3.5 t |
| Šířka | Single lane 4.20 m / 2-lane 7.20 m |
| Montáž | Modular, ~3-5 dní pro 12 m |
| Nájem typický CZK/měsíc | ~80,000-120,000 (orientačně) |

### Bailey Panel (legacy, vintage)

| Parametr | Hodnota |
|---|---|
| Typ | Truss panel system |
| Únosnost | Variable, do 60 t |
| Mostní rozpětí | Do 100 m |
| Méně časté v ČR | Nájem může být obtížnější |

### Acrow 700 series

| Parametr | Hodnota |
|---|---|
| Typ | Modular truss bridge (US-origin) |
| Únosnost | Do 70 t |
| Pro Žihle | Overkill pro 3.5 t omezení |

### Doporučení

**Mabey Compact 200** — nejvhodnější pro Žihle:
- Široká dostupnost v ČR (vendor v EU)
- Modular = rychlá montáž
- Single lane konfigurace = úzká stavba (~4 m)
- Nízká únosnost LM1 daleko nad 3.5 t omezení

## 3. Specifikace pro Žihle

| Parametr | Hodnota |
|---|---|
| Délka | ~12 m (přemostění + nájezdy) |
| Šířka | 4.20 m (single lane) |
| Únosnost | LM1 (Mabey C200 default) |
| Konfigurace provozu | Jednosměrný + světelná signalizace |
| Lokalita | Vpravo od stávajícího mostu (per `01_extraction/site_conditions.yaml > site_conclusions.prostor_pro_stavenisti.prava_strana_za_mostem` — volný prostor + polní cesta) |
| Doba | ~6 měsíců (montáž 1 týden + provoz 5-6 měs + demontáž 1 týden) |

## 4. Náklady (orientačně)

| Položka | Náklady (CZK) | Note |
|---|---|---|
| Montáž | ~300,000 - 500,000 | Vendor-specifická |
| Nájem 6 měsíců | ~600,000 - 800,000 | 6 × ~100k/měs |
| Demontáž | ~200,000 - 300,000 | Méně než montáž (méně nastavení) |
| Doprava panel + zařízení | ~150,000 - 250,000 | Round-trip |
| Souhlas vlastníka pozemku | ~50,000 - 200,000 | Závisí na rozsahu staveniště |
| Dopravní opatření (znaků, signalizace) | ~100,000 - 200,000 | Po dobu stavby |
| Kompletní povolení | ~50,000 - 150,000 | DUR provizoria + ZAU |
| **CELKEM** | **~1,500,000 - 2,500,000** | **TO-VERIFY** |

> **Confidence:** LOW (~50 %) — bez RFQ. Range ±50 % je realistický pro orientační odhad.

## 5. Časový plán (orientačně)

| Fáze | Délka | Pozn. |
|---|---|---|
| Příprava + povolení provizoria (DUR + ZAU) | 2-3 měs | Začíná před demolicí |
| Montáž | 1 týden | Mabey Compact rapid setup |
| Provoz | 5-6 měs | Po dobu demolice + nového mostu |
| Demontáž | 1 týden | |

## 6. Rizika

1. **Souhlas vlastníka pozemku** — pravý prostor je mimo silniční pozemek (per ZD §11 z. 13/1997). Vlastník neznámý, vyžaduje šetření katastru.
2. **Dostupnost vendor** — Mabey/Bailey nájem může být obsazený. Alternativa: pevný drevěný/ocelový provisorní most stavebnické firmy (nájemní pool).
3. **Souhlas s provozovatelem linkové dopravy** — povinné per ZD §4.4.o. Pokud linková doprava neakceptuje 3.5 t omezení (např. autobus 8 t), bude nutné upravit konfiguraci.
4. **Hydrologické podmínky** — provizorium musí přemostit potok bez ovlivnění průtoku. Při Q-100 by kotvení mohlo být ohroženo.

## 7. Cross-references

- ZD §4.4.o (povinnost): `01_extraction/pozadavky_novy_most.yaml > provizorium`
- Vysvětlení ZD č.1 ad 2 (objízdná zamítnuta): `01_extraction/pozadavky_novy_most.yaml > provizorium.alternativa_objizdna_zamitnuta`
- Site location (vpravo): `01_extraction/site_conditions.yaml > site_conclusions.prostor_pro_stavenisti`
- Kfely SO 180 (objízdná, NE provizorium): `inputs/reference/20 Rekonstrukce mostu Kfely (zadání).xml` — analogie struktury, ne nákladů

## 8. Pre-Phase-C action items

Před Phase C kalkulátorem:

1. ✅ Provizorium **NENÍ** v Monolit-Planner kalkulátoru (calculator je pro betonové prvky). Bude přidáno jako **separate line item** v `cost_summary.xlsx Sheet 2: Per-SO summary`.
2. ✅ Range ~1.5-2.5 mil. Kč použijeme jako **midpoint = 2.0 mil. Kč** s flag "to-verify with vendor RFQ"
3. ⏳ Nereálná kompletní specifikace bez RFQ — finalní hodnota při nabídce
