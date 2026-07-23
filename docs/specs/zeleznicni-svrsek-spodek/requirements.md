# TASK: Modul „Železniční svršek + spodek" (ŽS/ŽSp)

**Status:** DRAFT — čeká na ratifikaci Александра
**Typ:** nový doménový modul (paralelní k monolit/mostní kalkulátoru)
**Princip:** Pattern 15 (Work-First, Catalog-Last), Pattern 16 (Universal Work Ontology + adaptery), determinismus před AI

---

## 0. MANTRA (povinné před psaním jakéhokoli kódu)

1. Přečti repo. Zjisti, jak je udělaný stávající kalkulátor (7-engine pipeline, element types,
   `recommended_*` kanonické výstupy, confidence ladder, honest-blank politika).
2. **Nezakládej paralelní strukturu.** Železniční modul je **další doména uvnitř existující
   ontologie prací**, ne druhý systém. Pokud se ti zdá, že potřebuješ nový engine — napřed
   vysvětli, proč nestačí rozšíření stávajícího.
3. Kde už existuje mechanismus (element registry, normativní báze, adapter katalogů,
   RCPSP scheduler, front-capacity staffing) — **napoj se na něj**, nekopíruj ho.
4. Žádný PR bez výslovného pokynu. Sekvenčně, jedna větev.

---

## 1. PRE-IMPLEMENTATION INTERVIEW (povinné, AskUserQuestion)

Než začneš psát, zeptej se na minimálně tato rozhodnutí. Nehádej.

1. **Rozsah prvního průchodu:** celá vertikála (spodek + svršek + výhybky + BK + mechanizace)
   nebo jen svršek (kolejový rošt + kolejové lože + BK) s tím, že spodek přijde druhý PR?
2. **Vstup:** modul počítá z ručně zadané geometrie (km od–do, počet kolejí, sestava),
   nebo z TZ/výkresu přes stávající extraction pipeline, nebo obojí?
3. **Katalogová vazba:** primární katalog pro železnici — ÚRS 824-1, cenová soustava ÚOŽI
   (SFDI), nebo oborový třídník železničních staveb? Podle typu zakázky?
4. **Mechanizace:** modelovat vlastní strojní park firmy (uživatelské výkonové normy),
   nebo obecné katalogové normy, nebo obojí s prioritou vlastních?
5. **Výluky:** má modul počítat s výlukovými okny (nepřetržitá výluka / noční okna),
   nebo v prvním průchodu pracovat s čistým výkonem bez výlukového omezení?
6. **Jednotka výstupu:** metr koleje, kolejové pole, nebo km? (ovlivňuje celý výkaz výměr)

**Stop and ask** místo dohadování platí i pro všechno, co narazíš během implementace.

---

## 2. KONTEXT — proč tenhle modul

Systém dnes umí monolitické betonové konstrukce (23 typů prvků) a mostní objekty.
Železniční stavby jsou samostatná doména s vlastní normativní základnou, vlastním
katalogem, vlastní mechanizací a — hlavně — **jinou logikou dekompozice**: práce se
neodvozuje z objemu betonu, ale z **délky koleje × zvolené sestavy svršku**.

Ekonomický důvod: železniční zakázky SŽ jsou velký a stabilní trh, kde dnes žádný
konkurent nedělá dekompozici — všichni jen párují položky na ceník.

---

## 3. DOMÉNOVÝ MODEL — co modul musí umět

### 3.1 Dvě vrstvy, které se nesmí míchat

Železniční těleso se dělí na dvě vrstvy s **oddělenou logikou, oddělenými normami
a oddělenými položkami**:

**Železniční spodek** (zemní těleso a jeho konstrukce):
- zemní práce — odkopávky, násypy, sanace pláně
- pláň tělesa železničního spodku a její příčný sklon
- konstrukční vrstvy pod kolejovým ložem (štěrkopísek, geosyntetika, stabilizace)
- odvodnění — trativody, příkopy, drenáže, propustky
- zpevnění svahů, opěrné a zárubní zdi
- přechodové oblasti u mostů a propustků
- řídí se předpisem správce infrastruktury pro železniční spodek a vzorovými listy
  železničního spodku

**Železniční svršek** (kolejový rošt + kolejové lože):
- kolejnice (tvar, jakost, délka, úklon úložné plochy)
- pražce (materiál, typ, rozdělení)
- upevnění (typ soustavy — podkladnicové / bezpodkladnicové, svěrky, podložky)
- drobné kolejivo, spojky, izolované styky
- kolejové lože (frakce, tloušťka, profil, nadvýšení v obloucích)
- výhybky a výhybkové konstrukce
- bezstyková kolej (svary, upínací teplota, dýchající konce)
- zvláštní konstrukce — svršek na mostních objektech, přejezdy, pevná jízdní dráha

**Doménové pravidlo:** položka spodku nikdy nesmí spadnout do výkazu svršku a naopak.
Tloušťka kolejového lože se měří **od ložné plochy pražce po pláň tělesa železničního
spodku** — to je právě rozhraní obou vrstev a musí být v modelu explicitní.

### 3.2 Sestava svršku je primární volba

Uživatel (nebo extraktor z TZ) nevybírá jednotlivé komponenty. Vybírá **sestavu**
(kolejnice + pražec + upevnění), která je normativně schválená kombinace. Z sestavy
se pak **deterministicky** odvozuje všechno ostatní.

Modul musí mít sestavy jako **data se zdrojem**, ne jako konstanty v kódu:
- tvar kolejnice (např. 60E1/UIC 60, 49E1/S 49, R 65, T)
- typ pražce (betonový předpjatý, dřevěný, ocelový včetně tvaru „Y", plastový)
- typ upevnění (žebrová podkladnice + svěrka, pružné bezpodkladnicové upevnění)
- rozdělení pražců (písmenné označení b/c/d/e/u)
- povolený rozsah rychlosti a provozního zatížení

### 3.3 Rozdělení pražců → počet kusů (klíčový deterministický převod)

Rozdělení je písmenný kód, který udává počet pražců na kolejové pole a na kilometr.
Tabulka musí být **datová položka s citací zdroje** (ceníková příloha „Rozdělení pražců
u normálně rozchodné koleje" cenové soustavy pro dráhy kolejové), ne hardcode.

Orientační hodnoty, které musí modul reprodukovat (jen jako golden test, ne jako pravdu
v kódu):

| Sestava | Délka pole | Rozdělení | ks/pole | ks/km |
|---|---|---|---|---|
| R 65 | 25 m | c / d / e | 38 / 41 / 46 | 1520 / 1640 / 1840 |
| S 49, T stykovaná | 25 m | b / c / d / e | 34 / 38 / 41 / 46 | 1360 / 1520 / 1640 / 1840 |
| S 49 bezstyková | 25 m | u | 42 | 1680 |
| UIC 60 bezstyková | 20 m | u | 34 | 1700 |
| UIC 60 bezstyková | 25 m | u | 42 | 1680 |

Zdroj: cenová soustava ÚRS, ceník 824-1 Dráhy kolejové, příloha „Rozdělení pražců".

Doménová pravidla navíc:
- u **stykované** koleje je rozdělení v oblasti styku **zhuštěno**, u bezstykové je po celé
  délce pravidelné — počet z tabulky je průměr, ne rozteč
- dvojčitý dřevěný pražec u stykované koleje se počítá jako **dva** pražce
- pražec tvaru „Y" nemá stejnou logiku: počet se odvozuje z rozteče upevňovacích bodů,
  ne z délky pole — potřeba samostatného vzorce, ne položky v téže tabulce
- při dvojkolejné trati se všechno počítá **na kolej**, ne na trať; km trati ≠ km koleje

### 3.4 Odvozené výměry ze sestavy a délky

Ze sestavy + délky úseku musí modul deterministicky spočítat (každá hodnota s vzorcem
a zdrojem):
- počet pražců (ks) a jejich hmotnost (t) — vstup pro dopravu a jeřáby
- délku kolejnicových pásů (m) a hmotnost kolejnic (t) — z metrové hmotnosti tvaru
- počet kompletů upevnění = počet pražců × počet upevňovacích uzlů na pražec
- objem kolejového lože (m³) — z návrhového příčného profilu, ne z paušálu na metr;
  profil závisí na: tloušťce pod pražcem, šířce koruny, sklonu svahu lože, převýšení
  v oblouku, jedno-/dvoukolejném uspořádání
- počet kolejových polí (u stykované koleje) a počet styků
- počet svarů (u bezstykové koleje)

**Honest-blank:** pokud chybí příčný profil kolejového lože, objem se **nepočítá paušálem**.
Vrátí se NEPOČÍTÁNO s důvodem, ne fabrikovaná nula ani odhad bez varování.

### 3.5 Bezstyková kolej (BK) — samostatná technologická logika

BK není „svršek bez styků". Je to samostatný technologický řetězec s vlastními pravidly:
- svařování kolejnic (odtavovací stykové svařování, aluminotermické svary, závěrné svary)
- **upínací teplota** — rozsah, ve kterém se kolej upne; mimo něj je nutná úprava
  (napínání / ohřev), což je samostatná práce s vlastní cenou a vlastním časem
- **dýchající konce** na začátku a konci BK — dilatační pohyb, délka závisí na podélném
  odporu koleje
- podmínkou zřízení BK je provedená směrová a výšková úprava koleje a ověření prostorové
  polohy koleje před upnutím — **to je předchůdce v harmonogramu, ne volitelný krok**
- svařování výhybek a jejich vevaření do BK má vlastní pravidla
- BK na mostních objektech se řídí samostatnou částí předpisu — na některých mostech
  BK zřídit nelze

**Modelové pravidlo:** BK generuje minimálně tyto skupiny prací: příprava a ověření polohy →
svařování → napínání/upnutí → závěrné svary → kontrolní měření. Nikdy jen „svar × počet".

### 3.6 Výhybky

Výhybka není metr koleje. Je to **kusová konstrukce** s vlastní pracností podle tvaru
(poměr × poloměr, např. 1:9-300, 1:11-300, 1:12-500, 1:14-760, 1:18,5-1200, 1:26,5-2500),
plus zvláštní konstrukce (dvojitá kolejová spojka, výhybkové křížení).

Pracnost úpravy výhybky se udává **v hodinách na kus**, ne v m/h — modul musí umět obojí
metriku a nesmí je míchat.

### 3.7 Mechanizace — jádro odlišení od konkurence

Konkurence oceňuje položku. My **modelujeme nasazení strojní linky**. Modul musí mít
strojní park jako datový registr, kde každý stroj má:
- typ práce, kterou umí (podbíjení koleje / podbíjení výhybek / úprava lože do profilu /
  dynamická stabilizace / čištění lože / pokládka kolejových polí / zdvih)
- **výkonovou normu závislou na režimu**, ne jedno číslo
- **obsazení stroje** (počet zaměstnanců)
- omezení (min. poloměr oblouku v pracovním režimu, sklon, klimatické limity, potřeba
  napěťové výluky)
- ztrátové časy (příprava do pracovní / přepravní polohy, přejezdy)

Zásadní doménové pravidlo, které musí být v modelu explicitní:
**výkon podbíječky není konstanta, závisí na režimu nasazení.** Tentýž stroj má jiný
výkon při propracování tratě, jiný při jednom záběru s daty z automatického měření polohy
koleje, jiný po pokládce (novostavba) a jiný na výhybkách.

Orientační rozsahy (pro golden test a kalibraci, **ne jako hardcode** — do dat se zapíšou
až uživatelské normy firmy):

| Kategorie stroje | Režim | Řádový výkon |
|---|---|---|
| kontinuální ASP, 16 pěchů | propracování / 2 záběry / po pokládce | ~600 / ~400 / ~350 m/h |
| kontinuální ASP, 32 pěchů (2 pražce naráz) | traťové podbíjení | ~800 m/h |
| kontinuální ASP, 3 pražce naráz | traťové podbíjení, zdvih ~2 cm | až ~1600 m/h |
| traťová ASP, 16 pěchů, dvounápravová | propracování / s daty z APK | ~250–350 / ~400 m/h |
| ASP pro výhybky | jednoduchá výhybka | ~35–45 min/ks; složitější tvary 1–4,5 h/ks |
| dvoucestná podbíječka | propracování / s daty APK / pražce „Y" | ~150 / ~200 / ~120 m/h |

Obsazení stroje je rovněž datová položka (u kontinuálních ASP typicky ~4 zaměstnanci).

Zdroj kategorie: technologické listy strojů (přílohy předpisu správce infrastruktury pro
provoz kolejových mechanismů) a katalogové listy provozovatelů kolejové mechanizace.

**Pravidlo priority zdrojů výkonů:**
1. uživatelská norma firmy (vlastní strojní park) — confidence 0.99
2. technologický list stroje / předpis správce — confidence 0.85
3. katalogový údaj provozovatele — confidence 0.80
4. AI odhad — **zakázáno**; místo toho honest-blank

### 3.8 Lidé — profese a osádky

Modul musí rozlišovat:
- **osádku stroje** (je vázaná na stroj, ne na objem práce)
- **četu na trati** — montéři tratí / traťoví dělníci, kteří pracují souběžně se strojní
  linkou (příprava, demontáž překážek, dotahování, měření)
- **specialisty** — svářeč kolejnic (s platným oprávněním pro danou technologii), geodet
  pro ověření prostorové polohy koleje, obsluha měřicího vozíku
- **bezpečnostní role** vyžadované provozem na dráze (dozor, hlásná služba) — nejsou
  volitelné a musí se objevit v osádce, ne v režii

Aplikuj **Pattern 50 (front-capacity staffing)**: četa je omezena kapacitou pracovní fronty
(délka výlukového úseku), ne objemem prací. Zvětšení objemu neznamená lineární nárůst lidí.

### 3.9 Technologická posloupnost (vstup do plánovače)

Modul musí vygenerovat závislosti, ne jen seznam položek. Kanonická posloupnost:

```
zemní práce spodku → pláň tělesa žel. spodku → konstrukční vrstvy →
kolejové lože (spodní vrstva) → pokládka kolejového roštu →
doplnění a úprava kolejového lože → 1. podbití → 2. podbití →
dynamická stabilizace → zřízení BK (svary + upnutí) →
finální směrová a výšková úprava → kontrolní měření GPK → předání
```

Doménová pravidla posloupnosti:
- ověření prostorové polohy koleje musí proběhnout **před** zřízením BK
- před nasazením strojní linky musí být demontovány překážky (přejezdy, přechody,
  ukolejnění, pojistné úhelníky, magnetické informační body) a po práci opět namontovány —
  **to jsou samostatné položky**, které konkurence běžně zapomíná
- po dosažení konsolidace spodku se kolejové lože pročišťuje a doplňuje kamenivem
  příslušné frakce a třídy
- počet podbití není konstanta: závisí na tom, jde-li o novostavbu, rekonstrukci nebo údržbu

---

## 4. NORMATIVNÍ ZÁKLADNA — jak s ní zacházet

**Každá normativní hodnota = datová položka se zdrojem (dokument, kapitola/článek, verze,
datum účinnosti). Žádná konstanta v kódu.** Napoj se na stávající normativní znalostní bázi
(registry + rules + advisor), nezakládej druhou.

Modul musí rozeznat, že u železnice existují **tři vrstvy závaznosti** a v tomto pořadí:
1. zvláštní technické podmínky konkrétní zakázky (ZTP) — mají přednost
2. všeobecné technické podmínky a technické kvalitativní podmínky staveb státních drah
3. předpisy a vzorové listy správce infrastruktury, poté ČSN / TNŽ / TSI

Když modul nemá ZTP zakázky, musí to říct — ne předstírat, že obecná norma stačí.

---

## 5. KATALOGOVÁ VAZBA (Catalog-Last)

Dekompozice prací **nesmí** začínat od katalogu. Pořadí: rozklad prací → validace →
teprve pak vazba na kód.

Železnice má vlastní katalogové prostředí, odlišné od pozemních staveb:
- ceník pro dráhy kolejové (normálně a širokorozchodné) v cenové soustavě ÚRS —
  členěný na zřízení konstrukcí objektů železničního **spodku** a **svršku**
- cenová soustava ÚOŽI (sborník pro údržbu a opravy železniční infrastruktury) —
  položky bývají v soupisech SŽ označeny odděleně od položek ÚRS
- oborový třídník stavebních konstrukcí a prací **železničních staveb** — závazný pro
  nákladovou část dokumentace staveb SŽ

**Routing (rozšíření stávajícího pravidla):**
- zakázka SŽ / veřejná → oborový třídník železničních staveb + ÚOŽI jako primární,
  ÚRS jako doplněk
- soukromá vlečka / průmyslová kolej → ÚRS 824-1 jako primární
- v jednom soupisu se cenové soustavy **nemíchají bez označení** — každá položka nese,
  z jaké soustavy pochází

---

## 6. DETERMINISMUS A CONFIDENCE

- geometrický převod (délka → počet pražců, sestava → komponenty) = **regex/vzorec, 1.0**
- normativní hodnota s citací konkrétního článku = **0.85**
- uživatelská norma firmy = **0.99**
- klasifikace typu konstrukce z textu TZ přes AI = **max 0.80**, vždy s možností přepsání
- výkon stroje z AI = **zakázáno**

Replay guarantee platí beze změny: stejné vstupy → stejný výstup, každé číslo s vzorcem
a zdrojem.

---

## 7. ACCEPTANCE CRITERIA

1. Modul rozlišuje železniční spodek a svršek jako oddělené vrstvy; položka jedné vrstvy
   se nikdy neobjeví ve výkazu druhé.
2. Sestavy svršku, rozdělení pražců, hmotnosti kolejnic a normativní hodnoty jsou uloženy
   jako **data se zdrojem**; v kódu není žádná z těchto hodnot zapsaná natvrdo.
3. Ze zadané délky úseku a sestavy modul deterministicky spočítá počet pražců, délku
   a hmotnost kolejnic, počet kompletů upevnění a počet svarů/styků — každé číslo
   s vzorcem a citací.
4. Reprodukuje tabulku rozdělení pražců (golden test) pro všechny kombinace z bodu 3.3
   včetně pravidla dvojčitého pražce a odlišného vzorce pro pražec „Y".
5. Objem kolejového lože se počítá z příčného profilu; při chybějícím profilu vrátí
   honest-blank s důvodem, nikdy paušál ani nulu.
6. Bezstyková kolej generuje kompletní technologický řetězec (příprava → ověření polohy →
   svary → upnutí → závěrné svary → kontrola), ne jednu položku svaru.
7. Výhybky jsou modelovány kusově, s pracností v hodinách na kus podle tvaru; metrické
   a kusové metriky se nemíchají.
8. Registr mechanizace obsahuje pro každý stroj: typy prací, **výkonové normy podle
   režimu nasazení**, obsazení stroje, provozní omezení a ztrátové časy.
9. Volba stroje respektuje omezení (poloměr oblouku, typ pražce, výhybka vs. trať);
   nevhodný stroj se nenabídne, nebo se nabídne s explicitním varováním.
10. Uživatelská norma firmy má při výpočtu času přednost před katalogovou; zdroj použité
    normy je viditelný ve výstupu.
11. Osádky: osádka stroje je vázaná na stroj, četa na trati na kapacitu fronty
    (Pattern 50), bezpečnostní role jsou povinnou součástí osádky, ne režií.
12. Výstupem je technologická posloupnost se závislostmi, použitelná stávajícím
    plánovačem — ne plochý seznam.
13. Demontáž a zpětná montáž překážek před/po nasazení strojní linky je generována
    automaticky jako samostatné položky.
14. Vazba na katalog probíhá **až po** dekompozici a validaci prací; každá položka nese
    označení cenové soustavy, ze které pochází.
15. Modul rozlišuje km trati a km koleje; u vícekolejných úseků počítá na kolej.
16. Testy běží bez sítě, bez databáze a bez AI.
17. Golden test na reálném železničním objektu (dodá Александр) prochází v celém řetězci
    TZ → dekompozice → výměry → mechanizace → osádky → posloupnost.

---

## 8. EXPLICITNÍ VYLOUČENÍ (mimo rozsah tohoto zadání)

- trakční vedení a energetika
- zabezpečovací a sdělovací zařízení
- nástupiště, přístřešky, pozemní objekty stanic
- pevná jízdní dráha (bezštěrková konstrukce) — pouze detekovat a označit jako
  nepodporované, nepočítat
- metro a tramvajové tratě (jiná normativní základna)
- úzkorozchodné dráhy
- diagnostika a hodnocení geometrické polohy koleje v provozu (jen jako kontrolní krok
  v posloupnosti, ne vlastní engine)
- jakákoli změna stávajícího 7-engine kalkulátoru pro monolit

---

## 9. URČENÍ POJMENOVÁNÍ

Naming souborů, tříd, tabulek, polí a endpointů **urči podle stávajících konvencí v repu**.
Nezakládej paralelní strukturu. Železniční doména se musí zapsat do existující ontologie
prací a existujícího registru prvků stejným způsobem, jakým jsou zapsané stávající typy
konstrukcí.

---

## PŘÍLOHA A — Zdroje k dohledání a nahrání do Project Knowledge

Александр nahraje; agent je smí použít jen po nahrání, ne z internetu.

**Předpisy správce infrastruktury (spravazeleznic.cz, volně ke stažení):**
- S3 Železniční svršek — díly I až XVII (zvlášť: I základní ustanovení, IV kolejnice,
  V pražce, VI upevnění, VII sestavy svršku, IX výhybky, X kolejové lože,
  XI stykovaná kolej, XII svršek na mostních objektech, XVII vysokorychlostní tratě)
- S3/1 — směrová a výšková úprava koleje, příprava před nasazením strojní linky
- S3/2 — bezstyková kolej
- S3/5 — svářečské práce na součástech železničního svršku
- S4 — železniční spodek
- S8/3 + přílohy — provoz kolejových mechanismů; **přílohy jsou technologické listy
  jednotlivých strojů s výkony a obsazením — to je nejcennější zdroj pro §3.7**
- M20/MP004 — měření prostorové polohy koleje (už v systému)
- S11 — prostorové uspořádání

**TKP staveb státních drah (typdok.tudc.cz):**
- kapitola 8 — Železniční svršek
- kapitola 9 — Železniční přejezdy a přechody
- kapitola pro železniční spodek (číslo ověřit v aktuálním seznamu kapitol)
- vzorové listy železničního spodku (řada Ž)

**Normy:**
- ČSN 73 6360-1 a -2 — konstrukční a geometrické uspořádání koleje, mezní odchylky
- ČSN 73 6320 — průjezdný průřez
- TNŽ řady 73 62xx (mostnice, drobné kolejivo)
- TSI INF — nařízení komise EU pro subsystém infrastruktura

**Katalogy a ceníky:**
- ÚRS ceník 824-1 Dráhy kolejové — normální a širokorozchodné (včetně příloh
  a technických podmínek; příloha „Rozdělení pražců" je zdroj tabulky v §3.3)
- cenová soustava ÚOŽI / sborník pro údržbu a opravy železniční infrastruktury (SFDI)
- oborový třídník stavebních konstrukcí a prací železničních staveb (SFDI)
- směrnice správce infrastruktury pro stanovení a členění investičních nákladů staveb

**Výrobci a mechanizace (technické listy, veřejné):**
- katalog betonových pražců (ŽPSV) — typy, únosnost, rozsah rozdělení, typ upevnění
- technické podmínky dodací pro kolejnice (výrobce)
- katalogové listy provozovatelů kolejové mechanizace v ČR (výkony a omezení strojů)

**Akademické zdroje (pro doménové vzorce a vysvětlení, ne pro závazné hodnoty):**
- vysokoškolské učební texty „železniční spodek a svršek" (ČVUT FD, VUT FAST)
- práce k teorii a zřizování bezstykové koleje (podélný odpor, dýchající konec,
  upínací teplota)

---

## PŘÍLOHA B — Golden test, který je potřeba připravit

Aby modul nebyl slepý, potřebuje minimálně jeden reálný objekt s:
- TZ železničního objektu (SO svršek nebo kombinovaný)
- situací a podélným profilem s km staničením
- vzorovým příčným řezem s profilem kolejového lože
- reálným soupisem prací téhož objektu (pro zpětnou kalibraci)

Bez soupisu prací se dá ověřit dekompozice, ale ne úplnost. Ideálně objekt, kde firma
sama realizovala a zná skutečné nasazení strojů a skutečné časy.
