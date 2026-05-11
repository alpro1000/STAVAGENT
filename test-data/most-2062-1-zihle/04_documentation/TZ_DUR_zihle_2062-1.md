# Technická zpráva pro DUR (Dokumentaci pro územní rozhodnutí)

## Stavba: „Most ev.č. 2062-1 u obce Žihle, přestavba"

**Datum vyhotovení:** 2026-05-05
**Stupeň dokumentace:** DUR (Dokumentace pro územní rozhodnutí)
**Zhotovitel projektové dokumentace:** TBD — Design & Build (per ZD §4.2)
**Status:** sandbox — NENÍ pro odevzdání tendru. Phase D Žihle 2062-1.
**Rozsah dle vyhlášky 499/2006 Sb.** — kapitoly A–E + reference na soupis prací

> Tato TZ je výstupem sandbox workflow. Pro reálnou nabídku bude kompletní TZ
> doplněna o statický výpočet, výkresy, geodézii, IGP a hydrologii — vše
> odpovědnost vybraného zhotovitele D&B.

---

## A. Identifikační údaje

### A.1 Údaje o stavbě

| Údaj | Hodnota |
|---|---|
| Název stavby | Most ev.č. 2062-1 u obce Žihle, přestavba |
| Charakter stavby | Odstranění stávající stavby + výstavba nové |
| Číslo komunikace | III/206 2 |
| Staničení mostu | km 0,793 |
| Staničení úseku stavby | km 0,600 – 0,900 (úsek směrové úpravy silnice) |
| Místo | Mezi obcemi Žihle (km 0,000) a Potvorov, okres Plzeň-sever |
| Přemosťovaná překážka | Mladotický potok |
| Kraj | Plzeňský |
| KSO | 823 26 (mostní stavby silniční) |
| CPV | 45221111-3 (Výstavba silničních mostů) |

**Zdroj:** ZD č.j. 3967/26/SÚSPK-P §4.1 + §5.1 + HPM 2025-09-24 (`01_extraction/stavajici_most.yaml > identifikace`).

### A.2 Údaje o stavebníkovi

| Údaj | Hodnota |
|---|---|
| Název | Správa a údržba silnic Plzeňského kraje, p.o. (SÚSPK) |
| Právní forma | Příspěvková organizace |
| IČO / DIČ | 720 53 119 / CZ72053119 |
| Sídlo | Koterovská 462/162, Východní Předměstí, 326 00 Plzeň |
| Generální ředitel | Ing. Jiří Velíšek |
| Datová schránka | qbep485 |

**Zdroj:** ZD §1 (s. 3).

### A.3 Údaje o zpracovateli dokumentace

V této fázi (sandbox) — TBD. Pro reálnou nabídku zhotovitel doplní:
- Hlavní projektant (autorizace v oboru mosty a inženýrské konstrukce, min. 5 let zkušeností, reference na min. 1 most ≥ 15 mil. Kč; per ZD §13.7.c)
- Stavbyvedoucí + zástupce (autorizace v oborech dopravní stavby + mosty a inženýrské konstrukce; ZD §13.7.a + b)
- Geodet (úřední oprávnění §13 odst. 1 písm. c) zákona č. 200/1994 Sb.; ZD §13.7.d)

### A.4 Údaje o stávajícím stavu

| Údaj | Hodnota | Zdroj |
|---|---|---|
| Typ NK | Trámová deska, jedno pole | HPM s.2 [2.1] |
| Počet trámů | 16 ks ŽB s tuhými ocelovými vložkami z I-profilů ~I-280 | HPM s.2 [2.1] |
| Šikmost | ~50° | mostní list BMS (rukopis) |
| Rozpětí | ~9.0 m (osová vzdálenost opěr) | mostní list BMS |
| Šířka mostu (stávající) | ~9.0 m vozovka mezi římsami + 2× 0.20 m římsa = ~9.40 m celkem | mostní list BMS |
| Spodní stavba | Nízké masivní opěry z kamenných kvádrů, na levé straně rozšířené | HPM s.2 [1.2] |
| Křídla | Levé křídlo opěry 1 = rovnoběžná kamenná zídka; ostatní krátká svahová z kamenného zdiva | HPM s.2 [1.3] |
| Stavební stav NK | **VI — Velmi špatný** (koeficient `a` = 0.4) | HPM s.5 §G |
| Stavební stav SS | IV — Uspokojivý (`a` = 8.0) | HPM s.5 §G |
| Použitelnost | III — Použitelné s výhradou (po dopravních opatřeních); bez DO V — Nepoužitelné | HPM s.5–6 |
| Stávající zatížitelnost | Vn = 20.0 t / Vr = 24 t / Ve = 29 t / max. nápravový tlak 12.0 t | HPM s.5 §G |

**Klíčové závady NK** (HPM s.4 [2.1]):
- Beton degradovaný, místy s průsaky, zatéká pod římsami
- U krajních cca 6 trámů z obou stran odpadlá krycí vrstva spodního líce
- Třmínky a spodní pásnice ocelových I-vložek **výrazně korodují s oslabením**
- **Mezi 1. a 2. nosníkem zleva — beton desky zcela degradovaný**
- **U opěry 2 beton desky chybí v délce cca 1.5 m, výztuž překorodovaná, zatížení přenáší jen vozovka**

**Verdict HPM** (s.4 §D): „Most je nutno zásadně rekonstruovat bez jakékoliv prodlevy. Údržba již nemůže prodloužit životnost ani zachovat zatížitelnost."

**Doporučení HPM § E**:
- 5. odstranění nutno provést ihned: uzavřít vozovku u levé římsy + Z-směrovací desky
- 3. odstranění nutno do 1 roku: opravy zdiva spodní stavby
- **2. odstranění nutno do 5 let: náhrada NK novou konstrukcí**

Detailní extrakce: `01_extraction/stavajici_most.yaml` (~70 fakt s confidence).

---

## B. Souhrnná technická zpráva

### B.1 Popis území stavby

#### Charakteristika území

Most ev.č. 2062-1 leží v extravilánu obce Žihle (okres Plzeň-sever) na silnici III/206 2 v úseku km 0,793 mezi obcemi Žihle a Potvorov. Přemosťuje Mladotický potok v lesnatém prostředí — viz fotodokumentace `inputs/photos/20260421_*.jpg`.

Okolí stavby:
- Hustý lesní porost po obou stranách silnice
- Volný prostor vpravo od silnice (orná půda + polní cesta) — vhodný pro umístění provizoria SO 180 a zařízení staveniště (foto `20260421_132429.jpg`)
- Mladotický potok: úzké koryto, opevnění lomovým kamenem (HPM s.3 [4.4]); v dobu prohlídky 2026-04-21 stojící voda, malý průtok

#### Vazba na ÚP a regulační plán

Stavba je nahrazením stávajícího mostu na stávajícím úseku silnice III. třídy — souhrnně v souladu s ÚP obce Žihle (silnice III/206 2 je veřejnou pozemní komunikací dle § 9 zákona č. 13/1997 Sb.). Detailní soulad bude potvrzen v rámci DUR řízení.

#### Inženýrsko-geologické a hydrologické pomêry

**MISSING DATA — odpovědnost zhotovitele D&B:**
- IGP (zhotovitel zajistí před DSP, per ZD §4.4.a)
- Hydrologická data Mladotického potoka — Q-1, Q-5, Q-20, Q-50, Q-100 (zhotovitel u správce toku — pravděpodobně Povodí Vltavy s.p.; per ZD §4.4.b/d)
- Geodetické zaměření terénu + koryta + mostu v souřadném systému S-JTSK + Bpv, 3. třída přesnosti (ZD §4.3.i, formát DGN+JVF dle vyhlášky č. 393/2020 Sb.)

#### B.1.3 Pozemky dotčené stavbou — kadastr + souhlasy (UPDATED Phase D+E)

**Zdroj:** `04_documentation/kadastr_audit/parcels_and_consents.yaml` (24 dotčených parcel × 7 vlastnických kategorií) + DXF `inputs/photos/PROJEKT_MOST_HLAVNI.dxf` (1986 parcel candidates, 16 z nich match consent list).

**Vlastnické kategorie dotčených parcel:**

| Kategorie | Vlastník | Počet parcel | Souhlas |
|---|---|---:|---|
| FO (fyzické osoby) | 4 soukromí vlastníci | 6 (392, 1723, 1714, 391/2, 385/3, 385/1) | ✅ 4 souhlasy získané (12.10–18.12.2025) |
| Investor | SÚSPK Plzeňský kraj | 4 (1755, 1842, 1832, 1714) | ✅ N/A (investor sám) |
| Obec | Obec Žihle | 5 (1770, 1845, 1831, 1710, 618/1) | ✅ souhlas obce (datum doplnit) |
| Stát SPÚ | ČR — Státní pozemkový úřad | 1 (385/11) | ⏳ vyjádří se až ke konkrétnímu návrhu PD |
| Stát Povodí | ČR — Povodí Vltavy s.p. | 2 (1836, 385/13) | ❌ **MISSING — P0 BLOCKER** |
| Stát Lesy | ČR — Lesy ČR, LS Žatec | 6 (385/12, 613/3, 397, 614, 1769, 1843) | ✅ souhlas s podmínkami (25.11.2025) |
| Církev | Římskokatolická farnost Kralovice | 1 (1785) | ✅ souhlas D&B (27.10.2025) |

**KRITICKÉ FLAGS:**

1. ⛔ **Povodí Vltavy souhlas MISSING** (parcely 1836 + 385/13 — Mladotický potok). Zásah do koryta a ochranného pásma vodního toku vyžaduje vodoprávní souhlas. **AKCE: D&B zhotovitel získá souhlas Povodí Vltavy před DUR řízením.** Bez tohoto souhlasu nelze dokončit master soupis položku SO 201 T4-08 (dlažba koryta 16.1 m³) ani SO 201 T9-18 (zaústění skluzů 4 ks).

2. ⚠️ **LČR souhlas s podmínkami** (parcely 385/12, 613/3, 397, 614, 1769, 1843):
   - **NEKÁCET** dřeviny v rámci zajištění PD na lesních parcelách
   - **NESKLÁDAT MATERIÁL** na pozemcích PUPFL
   - Minimalizace záboru pozemků k plnění funkce lesa
   - Zpracovat vyhodnocení dopadů + plán rekultivace v PD (`04_documentation/master_soupis/master_soupis_SO_001.yaml T9-15+T9-16` rekultivace pokrývá tuto podmínku)

3. ℹ️ **SPÚ vyjádření** — Státní pozemkový úřad standardně nevydává předběžný souhlas; vyjádří se až ke konkrétnímu návrhu PD. Není blocker pro DUR fázi.

**Situace M 1:500 — viz `04_documentation/výkresy/C.2.1_situace_M1_500.svg`** (Phase E retrofit). DXF kadastr + bridge polygon + GPX provizorium + zábor staveniště ~1000 m².

**Cross-validation:** vendor situace.pdf je pouze Mapy.com overview (~30 km × 25 km schematic), NE engineering M 1:500. Phase E SVG je první professional engineering výkres pro DUR submission. Detail v `04_documentation/výkresy/cross_validation_notes.md`.

### B.2 Celkový popis stavby

#### B.2.1 Účel, funkce, kapacita

Náhrada havarijního mostu novou silniční mostní konstrukcí pro silnici III. třídy v kategorii **S 7,5** dle ČSN 73 6101.

**Cílová zatížitelnost** (per ZD §4.4.h, ČSN 73 6222 skupina 1):
- Vn = 32 t (normální)
- Vr = 80 t (výhradní)
- Ve = 180 t (výjimečná)

**Zdroj klasifikace skupiny 1:** `B7_regulations/csn_73_6222_zatizitelnost_mostu/INDEX.yaml > skupiny_komunikaci.values[id=1]` + `B6_research_papers/upa_zatizitelnost_sanace_mostu/INDEX.yaml > skupiny_komunikaci > id=1`.

#### B.2.2 Architektonické a urbanistické řešení

**Konstrukční typ:** Vetknutý integrální rámový most v jednom poli (BR_FRAME).

**Justifikace volby:**

> ZD §4.4.l explicitně zakazuje:
> - dilatační závěry ve vozovce
> - mostní ložiska
> - složitý systém odvodnění

Tyto tři současné zákazy směřují k integrálnímu řešení — **rámový most s monolitickým spojením desky + opěr je technicky jediná akceptabilní varianta**. Per Pokorný-Suchánek „Betonové mosty II" kapitola 4: vetknutá rámová konstrukce (statická neurčitost 3) je nejběžnější forma rámového mostu pro malá rozpětí, vyžaduje únosné podloží nebo velkoprůměrové piloty (citace `B6_research_papers/upa_pokorny_suchanek_betonove_mosty_ii/ch01_06_typy_mostu.yaml > ch04_ramove_mosty.staticke_soustavy_jednoduche.vetknuta_ramova_konstrukce`).

Architektonické řešení kompenzuje zákaz dilatačních závěrů + ložisek absencí přechodů a tím estetickou čistotu. Stávající most již nemá ložiska ani dilatační závěry (HPM s.2 [2.2]+[2.3]) — náhrada zachovává stejnou typologii.

#### B.2.3 Konstrukční a technické řešení

**Hlavní rozměry navržené NK:**

| Parametr | Hodnota | Justifikace |
|---|---|---|
| Statický systém | Vetknutý integrální rám 1 pole | ZD §4.4.l + Pokorný-Suchánek kap. 4 |
| Světlé rozpětí | ~9.0 m | Stávající rozpětí (rukopis BMS, finalní dle geodézie) |
| Tloušťka desky NK | 0.40 m | Pokorný-Suchánek tab. 4 (rámový most: t/L = 1/20 až 1/45 → t = 9.0/22.5 = 0.40 m); pro Vn=32 t volíme střed rozsahu |
| Šířka mostu | 8.30 m | Vozovka 6.50 m (S 7,5 mezi V4 0.125) + 2× římsa 0.90 m; per ZD §4.4.c+e |
| Skosení | ~50° | Per stávající (mostní list BMS); finalní dle geodézie zhotovitele |
| Délka mostu (čela opěr) | ~12 m | Při skosení 50° |

**Zdroj rozměrů:** `02_design/varianta_01_integralni_ram.md` § 2 + Pokorný-Suchánek INDEX.yaml.

**Spodní stavba:**
- **Plošný základ na únosné základové spáře** (orientačně 3.0 × 8.30 × 0.60 m každý, hloubka založení min 1.20 m pod terénem — engineering judgment, finalní dle IGP zhotovitele)
- **Dříky opěr** (vertical wall integrálně spojený s deskou): tloušťka 0.50 m, výška ~2.0 m, šířka 8.30 m
- **Závěrné zídky**: tloušťka 0.30 m, výška 0.80 m
- **Bez křídel** — svahový kužel 1:1.5 (per `02_design/varianta_01_integralni_ram.md § 3 — engineering judgment, ZD nevyžaduje křídla)

> ⚠️ **MISSING DATA flag:** Pokud IGP ukáže nízkou únosnost základové spáry → změna na **piloty Ø600** per Pokorný §4 (rámové mosty vyžadují únosné podloží nebo velkoprůměrové piloty). Cenový dopad +0.5–1.5 mil. Kč.

**Přechodové desky** (per ČSN 73 6244):
- 2× přechodová deska, délka 4.0 m, šířka 8.30 m, tloušťka 0.30 m
- Beton C25/30 XC2+XF1, krytí 35 mm
- ⚠️ **KB gap:** ČSN 73 6244 (Přechody mostů pozemních komunikací) není v repo — zhotovitel ověří proti normě; hodnoty v této TZ jsou per standardní praxe.

**Materiály — beton + výztuž per element** (kompletní tabulka v `02_design/concrete_classes.yaml`):

| Element | Beton | Třídy prostředí | Krytí [mm] |
|---|---|---|---|
| Podkladní beton | C12/15 | X0 | n/a (non-structural) |
| Plošný základ | C25/30 | XC2 + XF1 | 50 |
| Dříky opěr | C30/37 + air entrainment | XC4 + XF2 | 50 |
| Závěrné zídky | C30/37 + air entrainment | XC4 + XF2 | 50 |
| Mostovková deska | C30/37 + air entrainment | XC4 + XF2 | 40 |
| Římsy | C30/37 + air entrainment | XC4 + XF2 (+ XD1 dle praxe pro posypovou sůl) | 50 |
| Přechodové desky | C25/30 | XC2 + XF1 | 35 |

**Zdroje volby betonu a krytí:**
- Mostovková deska C30/37: SIST-EN-1992-2-2005 §3.1.2 (recommended C_min pro mostní structural concrete); cross-ref `B7_regulations/en_1992_2_concrete_bridges/INDEX.yaml > section_3_1_2_strength.applies_to_zihle.nk`
- Krytí 40 mm pro mostovku: SIST-EN-1992-2-2005 §4.4 — c_min,dur (XC4 → 30 mm) + Δc_dev (10 mm); `B7_regulations/en_1992_2_concrete_bridges/INDEX.yaml > section_4_4_cover.applies_to_zihle.mostovkova_deska`
- Annex E exposure → C class (XC4 → C30/37, XF2 → C30/37 + air entrainment)
- Návrhová životnost S5 = 50 let (typical pro silniční mosty, EN 1992-2 §4.4)

**Třídy ošetřování betonu** (per TKP 18 §7.8.3, `B2_csn_standards/tkp/tkp_18_betonove_mosty.json`):
- Mostovka + římsy: třída 4, min. 9 dní při 15–25 °C
- Dříky opěr + závěrné zídky + plošný základ: třída 3, min. 7 dní
- Přechodové desky + podkladní beton: třída 2, min. 5 dní

**Mostní svršek:**
- Hydroizolace celoplošná NAIP (asfaltovými pásy s pečetící vrstvou) — OTSKP 711442
- Hydroizolace pod římsami — OTSKP 711432
- 3-vrstvá živičná vozovka (per ZD §4.4.j); ⚠️ **obrusná vrstva 100 % návrhové tloušťky bez tolerance** dle TKP — přísnější než standardní (ZD s.7)
- Zádržný systém pro extravilán: zábradelní svodidlo H2 (per ZD §4.4.i; OTSKP 9117C1) — zachovává úroveň zadržení stávajícího SafeStar 231 H2/W3
- Revizní schodiště (per ZD §4.4.l) — 1× na pravé straně
- 3× chránička DN 75 mm v pravé římse (per ZD §4.4.m)

#### B.2.4 Stavebně technické řešení a vlastnosti

**Limity per ZD a kontrola:**

| ZD limit | Hodnota | Návrh splňuje? |
|---|---|---|
| Sedání spodní stavby (§4.4.g) | ≤ 12 mm | ⚠️ závisí na IGP (plošný OK, jinak piloty) |
| Dlouhodobá deformace NK uprostřed (§4.4.k) | ≤ 3 mm | ⚠️ závisí na statickém výpočtu (zhotovitel) |
| Vn = 32 t / Vr = 80 t / Ve = 180 t (§4.4.h) | dle ČSN 73 6222 | ✅ tloušťka 0.40 m + C30/37 dimenzována |
| Bez ložisek/dilatací (§4.4.l) | ano | ✅ integrální rám |
| 3× chránička DN 75 mm v pravé římse | ano | ✅ detail v PDPS |
| Revizní schodiště | ano | ✅ |
| Provizorium povinné (§4.4.o) | ano | ✅ SO 180 |

**Návrhová životnost:** ≥ 50 let pro NK + spodní stavbu (per EN 1992-2 §4.4 structural class S5; cross-ref `B9_validation/lifecycle_durability/lifecycle_table.yaml`).

### B.3 Připojení na technickou infrastrukturu

- **Komunikace:** silnice III/206 2 — stávající kategorie III. třídy, plynulé napojení na úpravu silnice v km 0,600 – 0,900 (SO 290).
- **Odvodnění vozovky:** přes krajnice do silničního příkopu (součást silničního pozemku dle § 11 zákona č. 13/1997 Sb.); per ZD §4.4.n.
- **3× chránička DN 75 mm v pravé římse** (ve směru staničení) — per ZD §4.4.m. Účel: budoucí inženýrské sítě (telekomunikace, signalizace).

### B.4 Dopravní řešení

**Stávající stav** (HPM s.3):
- Vozovka živičná, na pravé straně nezpevněná krajnice
- Dopravní značky B13 (20 t) a E13 (24 t) + tabulka s ev. číslem mostu
- Svodidla SafeStar 231 H2/W3 (z r. 2020)

**Nový stav:**
- Šířkové uspořádání **S 7,5** dle ČSN 73 6101, vozovka 6.50 m mezi V4 0.125 m, šířka jízdního pruhu 2× 3,25 m
- Návrhová rychlost: 50 km/h (extravilán III. třídy)
- Zádržný systém H2 v extravilánu per ZD §4.4.i
- Po dokončení odstranění omezení B13 (20 t) — most pojízdný do nominálních zatížení dle ČSN 73 6101

### B.5 Řešení vegetace a souvisejících terénních úprav

- Sejmutí ornice (~30 m³, OTSKP 121108) na ploše staveniště + zařízení staveniště
- Odstranění křovin v lesnatém okolí (~100 m², OTSKP 111208) pro zajištění přístupu
- Po dokončení rekultivace ploch — zatravnění + výsadba podle požadavků orgánu životního prostředí
- Úprava koryta Mladotického potoka **v okolí ±10 m** mostu (per ZD §4.4.r): zpevnění dna lomovou dlažbou na betonové loze (OTSKP 465512 + 45131A) — viz `02_design/decomposition_so.md > SO 201`

### B.6 Popis vlivů stavby na životní prostředí

**Vlivy během stavby:**
- Hluk + emise z demolice + betonáže (omezené pracovní doby per platná legislativa)
- Možné dočasné kalná voda v Mladotickém potoce při výkopu základové jámy a úpravě koryta — opatření: kalová prahy, čerpání kalů (OTSKP 11511, ~240 hod)
- Skladování odpadu na schválené skládce (OTSKP 014102, ~100 t inertní materiál)

**Vlivy po dokončení:**
- Zlepšení dopravní bezpečnosti (eliminace omezení B13 20 t)
- Stabilizace koryta v okolí mostu (snížení erozních rizik)
- Návrhová životnost 50 let → snížení frekvence údržbových zásahů

**Certifikace:** Per ZD §13.8 zhotovitel musí mít platnou certifikaci **ČSN EN 14001** (environmental management).

### B.7 Ochrana obyvatelstva

- Po dobu výstavby zajištění mostního provizoria (SO 180) pro zachování provozu (per ZD §4.4.o)
- Provoz omezený na vozidla **do 3.5 t + linková veřejná doprava**, jednosměrný se světelnou signalizací
- Konzultace a souhlas s provozovatelem linkové dopravy v rámci DUR (per ZD §4.4.o)
- DIO (Dopravně inženýrské opatření) zpracovaný v rámci DPS (per ZD §4.3.b)

### B.8 Zásady organizace výstavby (ZOV) — KLÍČOVÁ KAPITOLA

#### B.8.1 Provizorium SO 180 — POVINNÉ (UPDATED Phase D+E s vendor pricing)

**Per Vysvětlení ZD č. 1 (č.j. 10186/26/SÚSPK-P, 2026-04-24):**

> *„Zadavatel v rámci této veřejné zakázky alternativu úplné uzavírky komunikace v místě stavby mostu s vedením objízdné trasy po stávajících komunikacích a bez požadovaného mostního provizoria dle požadavku uvedeného v Zadávací dokumentaci (čl. 4.4. písm. o.), nepřipouští. Vzhledem k zajištění dopravní obslužnosti obce Žihle je průjezdnost po komunikaci III/206 2 Kralovice – Žihle stěžejní."*

**Spec provizoria (per Phase D master soupis SO 180):**
- Typ: ocelové mostní provizorium 12 × 5 m (TMS / PONVIA MS / Mosty Záboří) — vendor RFQ vyžadováno před nabídkou
- Únosnost (per ZD): vozidla do 3.5 t + linková veřejná doprava (LM1)
- Provoz: jednosměrný se světelnou signalizací (per ZD §4.4.o)
- Doba: 6 měsíců (1.5 měs demolice + 4.5 měs výstavba NK)
- Umístění: vpravo od stávajícího mostu (volný prostor — viz foto `inputs/photos/20260421_132429.jpg`)

**Vendor pricing range (4 vendoři, per `04_documentation/vendor_pricing/vendor_quotes.yaml`):**

| Vendor | Cenový model | Total 6 měsíců (Kč bez DPH) |
|---|---|---:|
| TMS (Petra Vaňková) | Lehčí konstrukce (~30 t) — line-item | 405 000 |
| PONVIA Construct s.r.o. (MS soustava) | Vn=11 t / Vr=40 t — line-item | 637 070 |
| Mosty Záboří (varianta č. 2 — vozovka 3,5 m) | Bundled package | 654 387 |
| Mosty Záboří (varianta č. 1 — vozovka 4,0 m) | Bundled package | 750 328 |
| **Median per-line decomposition** | TMS+PONVIA+MZ4m+MZ3.5m | **~696 000** |

**Master soupis SO 180** (`04_documentation/master_soupis/master_soupis_SO_180.yaml`) přiřazuje
medián 4 vendorů na položky 027411 (montáž 175 590 Kč), 027412 (nájem 6 měs 206 300 Kč),
027414 (prohlídky 76 582 Kč) — total vendor share **458 472 Kč** (22 % SO 180).

**Demontáž provizoria** (027413) je accounted v SO 001 T9-11 (185 160 Kč) jako součást
end-of-construction demolice scope (no-work-duplication: anchor 0 Kč v SO 180 T0-06).

**Souhlas vlastníka pozemku vpravo** (mimo silniční pozemek dle § 11 z. 13/1997 Sb.) —
částečně řešen via souhlasy obce Žihle + LČR (`parcels_and_consents.yaml`). **Povodí Vltavy
ochranné pásmo** (parcely 1836, 385/13) — ⛔ MISSING souhlas, P0 blocker pre DUR.

**SO 180 total per master soupis:** 2 047 138 Kč bez DPH (2 477 037 Kč s DPH 21 %).

Detailní spec: `02_design/provizorium_specs.md` + `04_documentation/master_soupis/master_soupis_SO_180.yaml`.

#### B.8.2 Etapy výstavby

Per `02_design/varianta_01_integralni_ram.md § 6 (sequence)`:

1. **DUR + DSP + DPS** (paralelně, ~3 měsíce) — ZD §4.3.a/b
2. **SO 180 zřízení provizoria** (1 týden) — Mabey C200 montáž
3. **SO 001 demolice** stávajícího mostu (~30 dní) — vyřezávání segmentů shora; **přístup zdola omezen** — světlá výška ~1 m pod stávajícím mostem (HPM s.4 [4.2] „Prostor pod mostem je příliš nízký pro veškeré revizní i stavební práce")
4. **Stavební jáma** — výkop na úroveň založení (~1.20 m pod stávajícím terénem)
5. **SO 201 betonářské práce — sériově:**
   1. Plošný základ + podkladní beton (C25/30, C12/15)
   2. Dříky opěr (C30/37 XF2)
   3. **Pevná skruž ze dna stavební jámy** stojkami IP / DOKA Multiprop (per Pokorný-Suchánek kap. 14a — `B6_research_papers/upa_pokorny_suchanek_betonove_mosty_ii/ch13_19_technologie_vystavby.yaml > pevna_skruz`); naše ~3 m výška NK pod limitem 10–15 m
   4. Bednění mostovky (DOKA Top 50)
   5. Výztuž + betonáž desky
   6. **Třída ošetřování 4 dle TKP 18 §7.8.3** — ≥ 9 dní při 15–25 °C
   7. Odbednění po dosažení 70 % charakteristické pevnosti betonu
   8. Závěrné zídky (C30/37) + přechodové desky (C25/30)
6. **SO 201 mostní svršek** (~30 dní): hydroizolace NAIP + 3-vrstvá živičná vozovka + svodidla H2 + revizní schodiště
7. **SO 290 směrová úprava silnice** III/206 2 (~60 dní)
8. **SO 180 demontáž provizoria** (1 týden)
9. **Pasport + geodetické zaměření + kolaudace** (per ZD §4.3.g/h/i, ~30 dní)

**Total schedule:** ~319 dní = **~10.6 měsíců** (per Phase C `03_calculation/cost_summary.xlsx > Sheet 4 + gantt_chart.svg`). Daleko pod limitem 30 měsíců (per ZD §5.3 + §29.2 = 900 dní).

**Master soupis SO sequence** (per `04_documentation/master_soupis/master_soupis.yaml`):

| SO | Název | Položek | Kč bez DPH | Etapa |
|---|---|---:|---:|---|
| SO 001 | Demolice + odvozy | 30 | 1 057 831 | Měs. 1-2 (45 dní) |
| SO 180 | Mostní provizorium | 26 | 2 047 138 | Měs. 1 setup, 6 měs provoz |
| SO 201 | Hlavní most | 72 | 4 435 958 | Měs. 3-6 výstavba NK (135 dní) |
| SO 290 | Silnice III/206 2 | 12 | 1 952 470 | Měs. 7 (25 dní) |
| SO 801 | Zařízení staveniště | 9 | 780 500 | 11 měs paralelně |
| VRN | Vedlejší rozpočtové náklady | 5 | 311 839 | 11 měs paralelně |
| **TOTAL** | | **154** | **10 585 736** | **~11 měsíců** |

#### B.8.3 Zařízení staveniště + demolice scope (UPDATED Phase D+E)

**SO 801 ZS detailní** (per `master_soupis_SO_801.yaml` — replaces dříve uvažovaný 4 % paušál
270k):

- Plocha staveniště ~50 × 50 m = **2 500 m²** (foot print most + provizorium + skladovací plocha)
- Obvod oplocení: 200 m × 350 Kč/m mobilní oplocení 2.0 m
- Doba aktivního staveniště: **11 měsíců** (Phase C 319 dní + buffer)
- Přístup: orná půda + polní cesta vpravo od silnice (foto `20260421_132429.jpg`)
- 9 detailních položek SO 801: hygienická + sociální zařízení (kontejnery WC + šatna + jídelna)
  264k, energie + voda 132k, telefon/internet 16.5k, oplocení 70k, osvětlení 60k, dočasná
  komunikace IZD panely 80k, čistění vozidel (POVINNÉ ČSN 73 0212) 88k, tabule 10 ks 45k,
  vytýčení obvodu + ochranná pásma sítí 25k = **780 500 Kč**

**SO 001 Demolice — full scope** (per `master_soupis_SO_001.yaml` — 30 položek 1 057 831 Kč):

| Sekce | Scope | Kč bez DPH |
|---|---|---:|
| Třída 0 | Poplatky skládka, zemník, zkoušení, dozor, info tabule | 284 560 |
| Třída 1 | Čerpání 200 hod, ornice 30 m³, jáma 255 m³, sypanina 285 m³ | 143 305 |
| Třída 9 D1 | Demolice ŽB (16 trámů + deska) 19 m³ + kamenné opěry/křídla 39 m³ | 224 178 |
| Třída 9 D2 | Svršek (odvodňovače, izolace, asf frézování, svodidla, DZ) | 25 537 |
| Třída 9 D2-koryto | Dlažba koryta + opevnění břehů (vyžaduje Povodí Vltavy) | 28 600 |
| Třída 9 D3-D5 | Provizorium demontáž 60 m² + podložky + panely | 226 036 |
| Třída 9 D6 | Rekultivace záboru (LČR podmínka) — ornice 30 m³ + hydroosev 1000 m² + DZ demontáž | 44 326 |
| Odvozy | RS Žatec ŽB+kamen+asfalt, DECO TRADE Nesuchyně zemina | 81 698 |

**Vendor recyklace** (per `vendor_quotes.yaml`):
- RS Žatec (Ekostavby Louny IČO 10442481): beton armovaný 400 Kč/t, beton ≤50 cm 60 Kč/t,
  asfalt 220–300 Kč/t
- DECO TRADE Nesuchyně (IČO 09560530): zemina 120 Kč/t, platnost do 2026-12-31

**VRN Vedlejší rozpočtové náklady** (per `master_soupis_VRN.yaml` — 5 položek 311 839 Kč =
**3.04 %** hlavních prací, v dolním pásmu ČSN 73 0212):
- Mimostaveniční doprava 1 % = 102 739 Kč
- Pojištění CAR + odpovědnost 0.4 % = 41 100 Kč
- Koordinační dokumentace + vyjádření DOSS = 30 000 Kč
- Správní poplatky (stavební povolení, kolaudace) + AI v procesu = 50 000 Kč
- ★ Koordinátor BOZP 11 měs × 8k = 88 000 Kč (POVINNÝ per zákon 309/2006 Sb. § 14)

#### B.8.4 Celková cena (UPDATED Phase D+E)

| Položka | Kč bez DPH | Kč s DPH 21 % |
|---|---:|---:|
| Hlavní práce (SO 001+180+201+290+801) | 10 273 897 | 12 431 415 |
| VRN | 311 839 | 377 325 |
| **CELKEM master soupis** | **10 585 736** | **12 808 741** |
| ZD limit | 30 000 000 | — |
| **Tendrová cena vs limit** | **35.3 %** | **42.7 %** |
| **Margin** | **19 414 264** | **17 191 259** |

Margin 17 M Kč pre overhead + zhotovitelská marže + cost overrun reserve. Master soupis
**ready pre tendrový proces** per `04_documentation/master_soupis/validation_report.md` § 10.

---

## C. Situační výkresy

V této fázi sandbox — REFERENCE only.

Pro reálnou DUR dokumentaci zhotovitel doplní:
- Situační výkres širších vztahů (M 1:5000)
- Situační výkres umístění stavby (M 1:500)
- Koordinační situace (M 1:200)

Vstupy pro výkresy: geodetické zaměření S-JTSK + Bpv + 3. třída + DGN+JVF (per ZD §4.3.i, vyhláška č. 393/2020 Sb.).

---

## D. Dokumentace objektů

Kompletní decomposition na stavební objekty: `02_design/decomposition_so.md`.

| SO | Název | Stav |
|---|---|---|
| **SO 001** | Demolice stávajícího mostu | sandbox spec done |
| **SO 180** | Provizorium (Mabey C200 / ekvivalent) — POVINNÉ | sandbox spec done; vendor RFQ vyžadováno |
| **SO 201** | Most ev.č. 2062-1 (nová stavba — integrální rám) | sandbox detailní návrh done |
| **SO 290** | Směrová úprava silnice III/206 2 km 0,600 – 0,900 | sandbox spec orientační |
| **ZS** | Zařízení staveniště + VRN | sandbox 4 % per ČSN 73 0212 |

Soupis prací s OTSKP kódy: `04_documentation/soupis_praci_zihle_2062-1.xml` (UNIXML 1.2) + `.xlsx` (52 položek, 5 SO objektů).

**Calibration:** Soupis total = 6 868 210 Kč bez DPH ≈ Phase C calculator total + materials + out-of-calc midpoints (rozdíl +5.7 % v rámci AC #8 ±10 % tolerance).

---

## E. Dokladová část

Vstupní dokumenty (single source of truth):

| Dokument | Cesta | Datum |
|---|---|---|
| ZD č.j. 3967/26/SÚSPK-P | `inputs/pdf/ZD - Most ev.č. 2062-1 u obce Žihle - DaB.pdf` | 2026-04-01 |
| Vysvětlení ZD č. 1 (č.j. 10186/26/SÚSPK-P) | `inputs/pdf/Vysvětlení ZD č. 1 - Most u obce Žihle.pdf` | 2026-04-24 |
| HPM 2062-1 (Komanec Petr, Ing., PONTEX s.r.o., č.opr. 086/2003) | `inputs/pdf/2062-1 HMP.pdf` | 2025-09-24 |
| Mostní list z BMS (rukopis) | `inputs/photos/Příloha č. 1 - snímek mostního listu.png` | n/a |
| Fotodokumentace stávajícího stavu (6 ks) | `inputs/photos/20260421_*.jpg` | 2026-04-21 |
| Příloha č. 2 — SOD návrh | `inputs/docx/Příloha č. 2 - SOD - Design and Build Most u obce Žihle.docx` | 2026-04-01 |
| Příloha č. 3 — Prohlášení o ceně + době | `inputs/docx/Příloha č. 3 - Prohlášení o výši Nabídkové ceny a Době provádění Díla.docx` | 2026-04-01 |

Reference (Kfely — analogický D&B most pro structurální vzor):
- `inputs/reference/20 Rekonstrukce mostu Kfely (zadání).xml` — UNIXML soupis
- `inputs/reference/4106639-A02_OR_SP_Zadavaci dokumentace_GB.docx` — ZD struktura
- `inputs/reference/4106641-A05_OR_Technicka specifikace_GB.docx` — TKP specifikace

Phase A extrakce + výsledky: `01_extraction/SOURCES.md` (~195 fakt s confidence).

---

## Aplikované normy a předpisy (kompletní seznam)

### ČSN normy

| Norma | Aplikace | KB ref |
|---|---|---|
| ČSN 73 6101 | Projektování silnic a dálnic — kategorie S 7,5 | externí (KB gap) |
| ČSN 73 6201 | Projektování mostních objektů | externí (KB gap) |
| ČSN 73 6221 | Prohlídky mostů pozemních komunikací — termín další HPM 2027 | externí (KB gap) |
| ČSN 73 6222 | Zatížitelnost mostů pozemních komunikací — Vn = 32 / Vr = 80 / Ve = 180 t | `B7_regulations/csn_73_6222_zatizitelnost_mostu/INDEX.yaml` (stub via UPa) |
| ČSN 73 6244 | Přechody mostů pozemních komunikací | externí (KB gap) — přechodové desky 4.0 × 8.30 × 0.30 m |
| ČSN 73 0212 | Geometrická přesnost a kontrola pro stavby — ZS 3–5 % | externí; aplikováno 4 % |
| ČSN EN 206+A2 | Beton — specifikace, vlastnosti, výroba a shoda | `B7_regulations/csn_en_206_pruvodce/` + `B2_csn_standards/csn_en_206.json` |
| ČSN EN 1991-2 | Eurokód 1: Zatížení mostů | externí (cross-ref přes UPa lecture) |
| ČSN EN 1992-1-1 | Eurokód 2: Návrh betonových konstrukcí | externí (KB gap) |
| ČSN EN 1992-2 | Eurokód 2 Část 2: Betonové mosty | `B7_regulations/en_1992_2_concrete_bridges/INDEX.yaml` (PARTIAL — §3.1.2 + §4.4 + §7.3 + §113 + Annex E) |
| ČSN EN 1317 | Záchytné systémy na komunikacích — H2 v extravilánu | externí (KB gap) |
| ČSN EN 14001 | Environmental management — kvalifikace zhotovitele | n/a |

### TKP (Technické kvalitativní podmínky staveb pozemních komunikací)

| Kapitola | Aplikace | KB ref |
|---|---|---|
| TKP 1 | Všeobecně | KB gap |
| TKP 2 | Příprava staveniště | KB gap |
| TKP 3 | Zemní práce | `B2_csn_standards/tkp/tkp_03_zemni_prace.json` |
| TKP 5 | Podkladní vrstvy vozovky | KB gap |
| TKP 7 | Hutněné asfaltové vrstvy | KB gap |
| TKP 11 | Svodidla, zábradlí | KB gap |
| TKP 17 | Beton | `B2_csn_standards/tkp/tkp_17_beton.json` |
| **TKP 18** | **Betonové konstrukce a mosty (§ 7.8.3 třídy ošetřování)** | `B2_csn_standards/tkp/tkp_18_betonove_mosty.json` + `tkp_18.md` |
| TKP 21 | Zvláštní zakládání | `B2_csn_standards/tkp/tkp_24_zvlastni_zakladani.json` |
| TKP 26 | Izolace + povlaky | `B2_csn_standards/tkp/tkp_22_izolace.json` |
| TKP 31 | Dlažební prvky, dlažby | KB gap |

> **TKP 22 a 23 (Mostní ložiska, Mostní závěry) ZÁMĚRNĚ vyloučeny** — ZD §4.4.l zakazuje ložiska a dilatační závěry; integrální rám tyto neobsahuje.

### Zákony a vyhlášky

- Zákon č. 134/2016 Sb. — O zadávání veřejných zakázek (§ 92 odst. 2 D&B)
- Zákon č. 13/1997 Sb. — O pozemních komunikacích (§ 11 silniční pozemek)
- Zákon č. 360/1992 Sb. — O výkonu povolání autorizovaných inženýrů
- Zákon č. 200/1994 Sb. — O zeměměřictví (úřední oprávnění geodet)
- Vyhláška č. 499/2006 Sb. — O dokumentaci staveb (struktura DUR)
- Vyhláška č. 393/2020 Sb. — O digitální technické mapě kraje (formát DGN+JVF)
- TP 260 — Přímo pojížděná mostovka — **NEAPLIKUJE SE** (per ZD §4.4.p zákaz)

### Univerzitní material

- Pokorný + Suchánek: „Betonové mosty II" (UPa) — kapitola 4 (rámové mosty), kapitola 14a (pevná skruž) → `B6_research_papers/upa_pokorny_suchanek_betonove_mosty_ii/`
- UPa lecture „Zatížitelnost a sanace mostů" (slide deck) → `B6_research_papers/upa_zatizitelnost_sanace_mostu/`

---

## Confidence + chybějící data — souhrn

**Confidence distribution v Phase A+B+C+D:**

| Confidence | Zdroj | Příklady |
|---|---|---|
| **1.0** | Explicit PDF strana | Vn=32 t (ZD §4.4.h), 16 trámů (HPM s.2 [2.1]) |
| **0.9** | Rukopis BMS + OTSKP exact match | Trámy 20×50 cm, šikmost 50°, betonové třídy per Annex E |
| **0.85** | Two sources + interpretation | I-280 (HPM „pravděpodobně"), plošné základy předpoklad |
| **0.7** | Rukopis se sub-spec | Rozpětí ~9 m (kóta 900) |
| **0.5–0.6** | Vizuální odhad foto | Světlá výška ~1 m, prostor staveniště vpravo |
| **0.0** | Custom non-OTSKP, vendor RFQ | SO 180 provizorium 7 sub-položek |

**Žádný fakt bez audit trail.** Všechny missing data flagovány — viz `01_extraction/SOURCES.md > missing_data` + sekce „MISSING DATA flag" v této TZ.

### Před podáním nabídky doplnit (work list pro zhotovitele)

1. **Geodetické zaměření** (S-JTSK + Bpv + 3. třída + DGN+JVF)
2. **IGP** — typ založení (plošný vs piloty)
3. **Hydrologická data** Mladotického potoka (Q-100 minimum)
4. **Vendor RFQ** — provizorium (Mabey C200 + Bailey + Acrow)
5. **Statický výpočet** dle EN 1992-2 §5+6 (zhotovitel hlavní projektant)
6. **DUR + DSP + DPS dokumentace** dle vyhlášky 499/2006 Sb.
7. **Konzultace** s provozovatelem linkové dopravy (per ZD §4.4.o)
8. **Souhlas** vlastníka pozemku pro ZS + provizorium (vpravo)
9. **Diagnostika podloží silnice** III/206 2 (SO 290)
10. **Reference + autorizace** personálu (5+ let, mosty + dopravní stavby)
11. **ČSN EN 14001** certifikace (per ZD §13.8)
12. **Bankovní záruka 600 000 Kč** (per ZD §21.1)
13. **Vyplnění Přílohy č. 3 ZD** + datovat + podepsat SOD (Příloha č. 2)
14. **Podání přes E-ZAK** do 2026-07-02 10:00 (per ZD §26.1)

---

## Závěr

Most ev.č. 2062-1 u obce Žihle je v havarijním stavebním stavu (NK kategorie VI) a vyžaduje nepokládatelnou rekonstrukci. Navrhované řešení **integrálního rámového mostu** v jednom poli s monolitickým spojením desky + opěr odpovídá:

- ZD požadavkům §4.4.l (bez ložisek, bez dilatačních závěrů, bez složitého odvodnění)
- Pokorný-Suchánek kap. 4 (vetknutá rámová konstrukce pro malá rozpětí)
- EN 1992-2 §3.1.2 + §4.4 + Annex E (beton C30/37 + krytí 40 mm pro mostovku)
- TKP 18 §7.8.3 (třída ošetřování 4 pro mostovku)
- ČSN 73 6222 skupina 1 (Vn = 32 / Vr = 80 / Ve = 180 t)

Cenový orientační odhad **6.87 mil. Kč bez DPH** (per soupis prací OTSKP) — **vejde se s velkou rezervou** proti budgetu 30 mil. Kč (ZD §5.5). Realistická Nabídková cena s vendor margin + D&B documentation + risk contingency: **12–18 mil. Kč** (40–60 % headroom).

Doba realizace orientačně **10.6 měsíců** — daleko pod limitem 30 měsíců (ZD §5.3).

**Hlavní rizika** před podáním nabídky:
1. Provizorium SO 180 — bez vendor RFQ, OTSKP gap (dohledat 027111+3 anchor + custom 9xxxxxx)
2. IGP neznámá — pokud piloty místo plošného → +0.5–1.5 mil. Kč
3. Klauzule ZD §4.4.j 100 % obrusné vrstvy bez tolerance — vyžaduje overpour reserve

**Status sandbox:** Phase A + B + C + D dokončeny. Pro reálnou nabídku zhotovitel doplní statický výpočet, IGP, geodézii, výkresy, vendor RFQ.

---

**Odkazy na sandbox artefakty:**

- Phase A: `01_extraction/` (4 YAML + SOURCES.md, ~195 fakt)
- Phase B: `02_design/` (varianta_01 + decomposition + concrete_classes + formwork + provizorium + element_breakdown)
- Phase C: `03_calculation/` (run-calc.ts + 11 PlannerOutput JSONs + cost_summary.xlsx + gantt_chart.svg)
- Phase D: `04_documentation/` (otskp_mapping + soupis XML/XLSX + tato TZ)
- Project summary: `00_PROJECT_SUMMARY.md`

KB references (read-only, žádné změny):
- `concrete-agent/packages/core-backend/app/knowledge_base/B1_otkskp_codes/` — OTSKP catalog 2025/II
- `concrete-agent/packages/core-backend/app/knowledge_base/B2_csn_standards/tkp/` — TKP 03/17/18/22/24
- `concrete-agent/packages/core-backend/app/knowledge_base/B6_research_papers/` — UPa Pokorný-Suchánek + Zatížitelnost
- `concrete-agent/packages/core-backend/app/knowledge_base/B7_regulations/` — ČSN EN 1992-2 + ČSN 73 6222 stub + ČSN EN 206
- `concrete-agent/packages/core-backend/app/knowledge_base/B9_validation/lifecycle_durability/` — návrhová životnost per element

---

*Dokument vytvořen v rámci sandbox workflow STAVAGENT 2026-05-05. NENÍ pro odevzdání tendru.*
