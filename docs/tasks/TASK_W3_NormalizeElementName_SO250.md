# TASK — W3: Normalizace názvu prvku před klasifikací

**Implementační zadání pro klasifikátor prvků na orchestrátorové cestě atomizace prací.**
Zdroj probe: `Monolit-Planner/shared/SO-250_smartextractor_probe.md`. Fixtury: SO 250 (úhlová zárubní zeď) + SO 202 (most). Stavba: D6 Olšová Vrata – Žalmanov, PDPS.

> Pozn. k pojmenování: tento dokument je **odlišný** od `TASK_Orchestrator_WorkOntology_SO250.md` (kritéria #1–#20, extrakční pipeline). Tato úloha řeší pouze vrstvu normalizace názvu nad klasifikátorem prvků.

---

## 1. Cíl

Klasifikátor prvků rozhoduje podle výskytu klíčového slova v názvu, nikoli podle řídícího podstatného jména a kontextu konstrukce. Cílem je nová samostatná čistá funkce, která normalizuje název prvku **těsně před vstupem do klasifikace**, a nechává samotný klasifikátor i jeho tabulku pravidel jako pouhý párovač kategorií. Žádný jazykový model; funkce je deterministická kvůli přehrávání.

---

## 2. Závazná pravidla

1. **Řídící podstatné jméno, ne klíčové slovo.** Prvek se klasifikuje podle řídícího podstatného jména a kontextu konstrukce, ke které patří. Předložkové a vedlejší vazby (například „kotvený do dříku", „na líci", „pro založení") jsou modifikátory, ne řídící podstatné jméno, a před párováním se odstraní.
2. **„Dřík" není totéž co pilíř.** „Dřík úhlové, opěrné nebo zárubní zdi" patří ke stěně opěrné zdi; „dřík pilíře" patří k dříkům pilířů. Určující kontext (zeď versus most a pilíř) musí přebít samotné slovo. Totéž platí pro „trám": „římsa-kotevní trám" je římsa, „trámy nosné konstrukce" jsou nosná konstrukce, ani jedno není průvlak.
3. **Poctivost důvěryhodnosti.** Pokud kontext přebije naivní shodu klíčového slova nebo je řídící podstatné jméno nejednoznačné, normalizace sníží vydávanou důvěryhodnost a zaznamená alternativy, aby se spustila lidská kontrola místo tiché chybné jistoty. (Plné dokládání zdrojů je věcí extrakční vrstvy, ne klasifikátoru.)
4. **Vazba na status.** Prvky popsané jako stávající, původní nebo určené k demolici se označí statusem „stávající" a vyloučí z atomizace prací nového objektu.

---

## 3. Mechanismus

Nová čistá funkce odvodí z názvu a kódu objektu strukturu se třemi signály a předá ji klasifikátoru:

- **Řídící podstatné jméno** — kanonizované (například „základ", „základy" i „železobetonový základ" vedou na tentýž kanonický tvar), aby křehké přípony v pravidlech (například požadavek na koncovku u slova „základ") shodu neblokovaly a aby předložkový ocas název neunesl.
- **Kontext konstrukce** — opěrná/zárubní zeď versus most a pilíř versus pozemní stavba, odvozený z názvu objektu a obsahových klíčových slov, **oddělený od domněnky, že kód objektu s číslem znamená most**.
- **Status** — nový versus stávající, podle výskytu slov stávající, demolice, odstranění, bourání; jinak nový.

Vrstva pouze anotuje; kategorii nadále vydává klasifikátor. Tabulka pravidel a katalog logiky zůstávají nedotčené.

---

## 4. Katalog — jediná povolená změna

Doplnit jednu novou kategorii: **lícové zdivo / obklad z lomového kamene**. Jde o samostatný druh prací (zednické a obkladové, ne beton): výztuž nula, orientace svislá, bednění žádné, jednotka plocha nebo objem zdiva. Bez této kategorie skončí lícový obklad v zbytkové kategorii a vypadne z výkazu. Žádná jiná změna katalogu ani logiky klasifikátoru se neprovádí.

---

## 5. Kritéria přijetí (klasifikátor, číslování pokračuje od #63)

Každé kritérium = jeden test v novém běhu golden testů. Kontext daný kódem objektu.

**#63 — „dřík" stěny.** „Dřík konstrukce" v kontextu úhlové zárubní zdi (objekt SO 250) → opěrná zeď, nikoli dříky pilířů.

**#64 — „dřík" pilíře (regresní, musí zůstat zelené).** „Dříky pilířů" v kontextu mostu (objekt SO 202) → dříky pilířů.

**#65 — předložková vazba není řídící.** „Lícový obklad z lomového kamene kotvený do dříku" → lícové zdivo a obklad, nikoli dříky pilířů.

**#66 — řídící podstatné jméno „základ".** „Železobetonový základ 0,56 × 2,75" → základy, nikoli zbytková kategorie; kanonizace překoná křehkou příponu v pravidle.

**#67 — „trám" římsy (regresní, musí zůstat zelené).** „Římsa-kotevní trám" → římsa.

**#68 — „trám" v nosné konstrukci.** „Trámy dvoutrámové nosné konstrukce" → nosná konstrukce, nikoli průvlak.

**#69 — neutralizace falešného mostního kontextu.** Kód objektu SO 250 v kontextu zárubní zdi nesmí nastavit mostní kontext; prvky základ, stěna a deska se na tomto objektu nepřeklápějí na pilířové ani mostovkové varianty. **Musí být nasazeno společně s #66** — jakmile „základ" začne odpovídat, falešný mostní kontext by jej jinak povýšil na základ pilíře.

**#70 — vazba na status.** Prvky z popisu stávajícího mostu evidenčního čísla 6-049 a jeho demolice se označí statusem „stávající" a nevstoupí do atomizace prací nového objektu.

Kritéria pro vazbu třídy betonu na prvek, dokládání zdrojů a označení mezidokumentového rozporu **nejsou** věcí klasifikátoru — patří do extrakční a slučovací vrstvy (dokument s kritérii #1–#20) a očíslují se tam od #71.

---

## 6. Běh golden testů a kontrola

- Nový běh golden testů pro objekt SO 250 zrcadlí stávající běh pro objekt SO 202: jeden test na každé kritérium #63–#70, vstupy řízené z přepisu technické zprávy SO 250. Nejprve červené proti současnému kódu (zamknou vady #63, #65, #66, #68, #69, #70), po nasazení normalizace zelené; #64 a #67 hlídají regresi.
- Golden testy se zapojí do kontrolního workflow. Stávající běh pro SO 202 dnes neběží v žádném workflow — zapojí se zároveň, aby byla sada skutečně vynucována.

---

## 7. Rozsah a hranice

Součástí je vrstva normalizace názvu (těsně před klasifikací) a jedna nová kategorie katalogu. Klasifikační logika ani tabulka pravidel se nemění. Vícezdrojové směrování modelů se nemění. Mimo rozsah: sesterský klasifikátor v kalkulátoru (stejná logika, stejné vady — eviduje se jako následný úkol kvůli riziku rozejití obou), betonový kalkulátor, extrakce parametrů dokumentu a slučovací vrstva.

---

## 8. Postup

Nejprve napsat červené testy podle kritérií #63–#70. Pak doplnit normalizační funkci a novou kategorii. Pak zelená a hlídání regrese. Nakonec zapojit golden sadu do kontrolního workflow. Konkrétní pojmenování ve zdrojovém kódu se řídí mapou z předchozí rešerše repozitáře.
