# TASK v2.1: 24. typ elementu — UZAVŘENÝ RÁM (TUBUS)

**Nahrazuje:** v2 (byte-identická kopie v repu `docs/tasks/`) a v1. Změny v2 → v2.1:
§2.10 geometrie jen z explicitních vstupů (ochrana proti heuristikám breakdown,
pin #1514) · §2.11 Dotazy na projektanta (třetí kategorie nálezů) · AC 14–15.
Změny v1 → v2: typ je rodina (tubus s podtypy); výběr technologie bednění
(konvenční vs. bednící vozík); PB3 filtr systémů; prefab větev; pětifázová sekvence.

**Sekvence:** PR1 ze 4. Následuje XDC adapter (PR2) → Fix 3+4 (PR3) → golden test (PR4).
**Rozsah:** Core Engine + MCP + Monolit-Planner frontend. Jedna větev, jeden PR.

---

## 0. MANTRA — před jakýmkoli kódem

1. Přečti repo: jak je definováno 23 typů, jak klasifikátor rozeznává, jak se z typu
   odvozuje sekvence, bednění, rebar index. Nevytvářej paralelní strukturu.
2. Přečti stávající pravidla: OTSKP bundling, SKRUŽ vs. STOJKY, DIN 18218,
   zákaz míchání dodavatelů bednění v jedné pozici.
3. **Pre-Implementation Interview (AskUserQuestion)** na vše nejednoznačné.
   STOP a zeptej se — nehádej.

---

## 1. Kontext

Kalkulátor nezná uzavřenou monolitickou rámovou konstrukci. Reálný dopad
(SO 11-20-04 ŽST Turnov, podchod, XDC výkaz): klasifikace `jiné` @ 0,3;
výztuž −24 % (104 t místo 137,161 t); 9 taktů místo 10 DC; technologie
zredukována na mostovku; pracovní výška podpěrné konstrukce zaměněna
za tloušťku stropu (0,45 m místo 3,0 m); falešné varování na XD1/XC4/XF2/XA1.

Podchod přitom NENÍ unikát — je to jeden člen rodiny. Stejnou stavební podstatu
mají rámové propustky, podjezdy, hloubené tunely, kolektory. Úzký typ „podchod"
by za měsíc poslal rámový propustek zase do `jiné`.

---

## 2. Business logika

### 2.1 Definice typu: uzavřený rám (tubus)

Monolitická ŽB konstrukce uzavřeného pravoúhlého průřezu: **spodní deska +
dvě stěny + stropní deska**, zasypaná zeminou, členěná na dilatační celky.

**Podtypy (jedno pole, ne čtyři typy):**

| podtyp | typický rozpon | poznámka |
|---|---|---|
| `ramovy_propustek` | 1–4 m | často PREFABRIKOVANÝ — viz §2.6 |
| `podchod` | 4–8 m | pěší; PB3, niky, podhled, schodiště |
| `podjezd` | 6–15 m | pod komunikací, větší přesypávka |
| `hloubeny_tunel` | 8–15+ m | cut-and-cover, mnoho stejných bloků |
| `kolektor` | 2–4 m | dlouhý, desítky stejných sekcí |

Klasifikační signály v TZ: „uzavřená rámová konstrukce", „rám", „tubus",
„dilatační celky", „podchod/podjezd/propustek/kolektor", „přesypávka",
„světlá šířka × světlá výška". Otevřený polorám (schodiště, U-profil) NENÍ
tento typ — zůstává u stávajících typů.

### 2.2 Dilatační celky — vstup, ne výpočet

Počet DC je **vstup z projektu**. Kalkulátor ho nesmí dopočítávat z objemu
ani délky. Pořadí výstavby DC řídí ZOV/výluky, ne vzorec.

### 2.3 Sekvence betonáží na jeden DC

Úplná svislá skladba (dle TKP 18 praxe, potvrzeno SO 11-20-04):

1. `podkladní beton` (prostý, C12/15–C16/20, 100–200 mm) — bez bednění / obvodové
2. `podkladní ŽB deska` (volitelná — jen u plošného založení s hydroizolací zdola)
3. **`spodní deska rámu`** — fáze rámu 1
4. **`stěny`** — fáze rámu 2
5. **`stropní deska`** — fáze rámu 3 (u technologie „vozík" spojena s fází 2 — viz §2.4)

**Počet betonáží rámu (nosný beton) = DC × počet fází rámu** (3 konvenčně, 2 s vozíkem).
Podkladní vrstvy se počítají zvlášť, nejsou fází rámu.

**Pracovní spáry (vodotěsné, dle TNŽ 73 6280 / TKP 18):**
- dno–stěna: průběžný těsnicí plech („waterstop plech", typ. š. 160 mm) v ose spáry
- stěna–strop: vnitřní elastomerový nebo hydrofilní pás, krytí ≥ 50 mm
- přerušení betonáže > 24 h = pracovní spára: vysokotlaký vodní paprsek + epoxidový
  adhezní můstek
Dilatační spáry mezi DC: šířka typ. 20 mm, vnitřní elastomerový pás s baňkou, XPS výplň.

### 2.4 Technologie bednění — VOLBA, kterou dělá kalkulátor

Dvě varianty; kalkulátor navrhne obě, doporučí jednu a zdůvodní:

**A. Konvenční (fázová):**
- spodní deska: obvodové bednění
- stěny: oboustranné stěnové bednění; tlak čerstvého betonu dle stávajícího
  DIN 18218 enginu
- strop: podpěrná konstrukce + palubní bednění UVNITŘ tubusu.
  **Pracovní výška podpěrné konstrukce = SVĚTLÁ VÝŠKA RÁMU** (horní líc spodní
  desky → spodní líc stropu). Nikdy tloušťka stropní desky. Nikdy „volná výška
  pod podhledem" (podhled je dokončovací konstrukce, ne beton).
- SKRUŽ vs. STOJKY dle stávajícího pravidla ze vstupů (světlá výška, zatížení).

**B. Bednící vozík (tunelová forma):**
- vnitřní forma na pojezdu (hydraulika) bední současně obě stěny + strop;
  zvenku jen kontra-bednění stěn spínané skrz
- **stěny + strop = JEDNA betonáž** → 2 fáze rámu na DC, jedna vodotěsná
  pracovní spára místo dvou
- systémy v ČR praxi: Doka SL-1 + TOP 50, PERI VARIOKIT, ULMA MK,
  individuální formy (MC 120 apod.). Zapiš jako data se zdrojem, ne hardcode.

**Rozhodovací pravidlo (data, ne konstanta v kódu):**

| kritérium | → A konvenční | → B vozík |
|---|---|---|
| počet stejných sekcí | < ~8 | ≥ ~8–10 |
| průřez | proměnný / niky / vestavěné šachty / reliéf | konstantní |
| atypický pohledový povrch (PB3 + matrice) | ano → A | ne |
| navazující konstrukce uvnitř sekcí (schodiště) | ano → A | ne |
| výstavba v etapách v oddělených jámách | penalizuje B | souvislý postup |

Kalibrační případ: SO 11-20-04 má 10 DC (mluví pro B), ale niky, výtahové šachty
v DC 2/6/10, schodiště v 6 z 10 DC, reliéf „Skal" a dvě etapy → správně **A**.
Kolektor 30 sekcí konstantního průřezu → správně **B**. Oba případy musí být testem.

### 2.5 Filtr bednicích systémů pro pohledový beton

Pokud stěny nesou třídu pohledového betonu **PB2/PB3** nebo **reliéf matricí**:
- přípustné jen **nosníkové stěnové systémy** (plášť + rastr spínání dle RDS):
  DOKA Top 50, PERI VARIO GT 24 a ekvivalenty
- **rámové systémy (Framax Xlife, TRIO, ULMA ORMA…) NEPŘÍPUSTNÉ** — otisky
  rámů a rastr spár neprojdou akceptací PB3 (ČBS TP 03/2018)
- reliéf = negativní matrice do bednění → generovat **R-položkový příplatek** (§2.6)
Filtr aplikovat na stávající katalog 25 systémů. Dodavatelé se nemíchají (stávající pravidlo).

**Technologická poznámka XF2 × PB3 (construction advisor):** XF2 = provzdušněný
beton, „nepřevibrovávat"; PB3 = pórovitost líce ≤ 0,6 %. Konflikt řešit referenční
plochou — kalkulátor generuje upozornění, ne chybu.

### 2.6 Monolit vs. prefabrikát

Rámové propustky (a části kolektorů) jsou v ČR běžně **prefabrikované**.
Nový typ nese příznak `monolityczny | prefabrikovaný`:
- prefab → ŽÁDNÉ bednění, žádné fáze betonáže; jen montáž dílců + podkladní
  vrstvy + zálivky spár. Kalkulátor nesmí generovat opalubkový plán.
- monolit → plná logika výše.
Klasifikační signál: „prefabrikované rámy", „IZM/ZBM dílce", „montáž" vs.
„betonáž na místě", „monolitický rám".

### 2.7 Katalogová politika — potvrzeno reálnou zakázkou

Ve výkazu SO 11-20-04 (45 položek) není jediná položka bednění/odbednění/
ošetřování/skruže; jediná opalubková položka je R-příplatek za atypické bednění.

- **OTSKP:** bednění + odbednění + ošetřování zahrnuty v betonové položce rámu
  (389325 apod.). Deterministická `None`, důvod „zahrnuto v betonu dle OTSKP",
  confidence 1,0. Výztuž vždy samostatně.
- **Atypický povrch (PB3, reliéf) → samostatný R-položkový příplatek**, ne OTSKP kód.
- **ÚRS / RTS:** každý řádek samostatně (catalog-aware, beze změny).

### 2.8 Rebar index — kalibrace

| položka | hodnota | zdroj | status |
|---|---|---|---|
| mostní rámová konstrukce C30/37 | **131,0 kg/m³** | SO 11-20-04: 389365/389325 = 137 161 kg / 1 046,8 m³ | **n = 1**, kalibrace, NE norma |
| propustek (orientačně) | 60–100 kg/m³ | stávající katalog elementů (PK #32) | orientační rozsah |

Zapsat jako data se zdrojem a confidence odpovídající jednomu vzorku.
Průměry výztuže: bez výkresu výztuže NEZADÁVAT default — AskUserQuestion.

### 2.9 Třídy prostředí

Kombinace typu XD1 + XC4 + XF2 + XA1 je pro zasypaný železniční/silniční tubus
normální. Varování jen při vzájemně se vylučujících třídách; třídy převzaté
z dokumentace varování nevyvolávají nikdy.

### 2.10 Geometrie tubusu — jen z explicitních vstupů

Množství bednění, skruže/stojek a betonu tubusu se odvozují VÝHRADNĚ z explicitní
geometrie zadání: tloušťky spodní desky / stěn / stropu, světlá šířka × světlá
výška, délka sekce. Obecné heuristiky breakdown (soffit V/0,25; stěnový model
V/0,3×2 apod.) jsou pro tento typ **ZAKÁZÁNY** — jejich závady jsou zapinovány
testem parity (#1514) a nesmí se dědit na nový typ. Nový typ se NEPŘIDÁVÁ do
obecných WORK_TEMPLATES breakdownu zkratkou; dostává deterministické vzorce
z vlastních vstupů. Chybí-li vstup → honest-blank / AskUserQuestion, ne default.

Kalibrační kontrola: strop SO 11-20-04 tl. 450 mm — heuristika V/0,25 by
nadhodnotila podložní plochu ~1,8×; správně = délka sekce × světlá šířka.

### 2.11 Dotazy na projektanta — třetí kategorie nálezů

Rozpor mezi zdroji jednoho projektu (TZ ↔ výkres ↔ výkaz) NENÍ chyba enginu
ani automaticky chyba projektu. Je to **dotaz na projektanta** — běžná realita
dokumentace (typicky třída betonu: TZ C25/30 vs. legenda výkresu C20/25).

Výstup kalkulátoru nad objektem obsahuje sekci **„Dotazy na projektanta"**:
- každý nález = citace OBOU zdrojů s kotvou (dokument, strana/pole)
- kde je rozpor oceněný (jiná třída betonu × množství) → **cenová delta v CZK**;
  kalkulátor počítá OBĚ varianty, nevybírá „konzervativnější" sám
- úrovně nálezů: `otazka_na_projektanta` (rozpor mezi zdroji) ·
  `sloppy_wording` (nedbalá formulace, upřesní RDS) ·
  `chyba_v_dokumentaci` (zdroj si protiřečí sám sobě)
Engine rozpory detekuje a reportuje; NIKDY je tiše neřeší volbou jednoho zdroje.

---

## 3. MCP

- klasifikace vrací `uzavreny_ram_tubus` + podtyp + monolit/prefab příznak
  (ne `jiné`, ne `mostovka`)
- výpočet přijímá: počet DC, světlou šířku, **světlou výšku rámu**, tloušťky
  (spodní deska / stěny / strop), délku sekce, technologii (A/B/auto), prefab flag
- zpětná kompatibilita ostatních 23 typů nedotčena

## 4. Frontend (Monolit-Planner)

Nový typ v selektoru. Vstupy dle §3. Výstup: fáze betonáže na DC (3 nebo 2 dle
technologie), obě varianty bednění se zdůvodněním doporučení. Zapadnout do
stávajícího UI vzoru, žádný nový design jazyk.

---

## 5. Acceptance criteria

1. Klasifikátor: TZ podchodu → `uzavreny_ram_tubus / podchod / monolit`.
   TZ rámového propustku → `uzavreny_ram_tubus / ramovy_propustek`.
   Nikdy `jiné`, nikdy `mostovka`. Otevřený polorám tímto typem není.
2. Prefab propustek → žádné bednění, žádné fáze; jen montáž + zálivky.
3. Počet DC převzat ze vstupu; kalkulátor ho nedopočítává.
4. Konvenční technologie: 3 fáze rámu na DC (spodní deska → stěny → strop);
   pro 10 DC → 30 betonáží rámu. Podkladní vrstvy zvlášť, nejsou fází rámu.
5. Technologie „vozík": stěny + strop = jedna fáze → 2 fáze rámu na DC.
6. Volba A/B: SO 11-20-04 profil (niky, šachty, schodiště, reliéf, 2 etapy) → A;
   kolektor 30 konstantních sekcí → B. Obě rozhodnutí zdůvodněná, řízená daty.
7. Pracovní výška podpěrné konstrukce = světlá výška rámu (SO 11-20-04: 3,0 m).
   Test prokáže, že tloušťka stropu (0,45) ani výška pod podhledem (2,65)
   se do ní nedostanou.
8. SKRUŽ vs. STOJKY dle pravidla ze vstupů; oba výsledky dosažitelné.
9. PB2/PB3 nebo reliéf → jen nosníkové stěnové systémy; rámové systémy
   vyfiltrovány; návrh R-položkového příplatku; poznámka XF2×PB3.
10. OTSKP → žádné položky bednění/odbednění/ošetřování, deterministická `None`
    s důvodem, confidence 1,0; výztuž samostatně. ÚRS/RTS beze změny.
11. Rebar index 131,0 kg/m³ v matici jako datová položka se zdrojem a n=1.
12. XD1/XC4/XF2/XA1 z dokumentace → bez varování.
13. Typ dostupný přes MCP i Monolit-Planner; 23 stávajících typů beze změny;
    stávající testy zelené; nové testy bez sítě/DB/AI.
14. Množství tubusu nezávisí na defaultních heuristikách breakdown; parity
    pin-test (#1514) zůstává zelený — jakákoli změna společných větví geometrie
    jen přes explicitní rozbor. Test prokáže, že strop tl. 450 mm nedostane
    podložní plochu z heuristiky V/0,25.
15. Při rozporu zdrojů (třída betonu TZ vs. výkres) výstup obsahuje dotaz na
    projektanta s citacemi obou zdrojů a cenovou deltou; engine počítá obě
    varianty a žádnou tiše nevybírá.

## 6. Mimo rozsah

XDC parser (PR2) · Fix 3+4 (PR3) · golden test SO 11-20-04 (PR4) ·
změny 7-engine pipeline nad rámec nového typu · žádný PR bez pokynu,
jedna větev, nic paralelně.

## 7. Naming

Naming a strukturu určuj podle stávajících konvencí v repu. Zabuduj se do
existujícího kódu. (Identifikátory v tomto zadání jsou popisné, ne závazné.)
