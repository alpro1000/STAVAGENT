# TASK — Orchestrator: Work Ontology pro klasifikaci konstrukčních prvků

**Kick-off zadání. Akceptační fixtury: SO 250 (úhlová zárubní zeď) + SO 202 (most).**
Stavba: D6 Olšová Vrata – Žalmanov, VD-ZDS, stupeň PDPS.

---

## 1. Kontext a cíl

Stávající deterministický klasifikátor prvků rozhoduje podle výskytu klíčového slova v názvu, nikoli podle řídícího podstatného jména a kontextu konstrukce. Důsledkem jsou systematické chyby: nosné prvky stěny se ztrácejí nebo se přiřazují k pilíři jen proto, že se v textu objevilo slovo, které jinde patří mostnímu pilíři.

Cílem této úlohy je samostatná vrstva — work ontology — která **normalizuje název prvku ještě před klasifikací**. Normalizace rozkládá název na řídící podstatné jméno, určující kontext konstrukce, materiál s třídou betonu a status prvku. Teprve normalizovaný název vstupuje do klasifikace. Samotný klasifikátor ani jeho katalog se neopravují bodově; oprava je v normalizaci.

Tato úloha **neřeší** betonový kalkulátor ani extrakci parametrů dokumentu (to je samostatná schéma Statika D.1.2). Vícezdrojové směrování modelů se nemění.

---

## 2. Závazná pravidla

**Pravidlo 1 — řídící podstatné jméno, ne klíčové slovo.**
Prvek se klasifikuje podle řídícího podstatného jména názvu a podle kontextu konstrukce, ke které patří, nikoli podle náhodného výskytu jednotlivého slova. Předložkové a vedlejší vazby (například „kotven do dříku", „uložen na práh") nejsou řídícím podstatným jménem a nesmějí klasifikaci určovat.

**Pravidlo 2 — slovo „dřík" není totéž co pilíř.**
Slovo „dřík" se nesmí natvrdo mapovat na pilíř. „Dřík pilíře" patří do kategorie dříky pilířů. „Dřík úhlové, opěrné nebo zárubní zdi" patří do kategorie stěna. Určující kontext „zeď" musí přebít samotné slovo „dřík". Totéž platí pro slovo „trám": „římsa-kotevní trám" je římsa, „trámy nosné konstrukce" jsou nosná konstrukce, ani jedno není průvlak.

**Pravidlo 3 — grounding na zdroje, ne na confidence.**
Důvěryhodnost klasifikace se opírá o doložené zdroje (odkud byl údaj vzat — kapitola, strana, výkres), nikoli o číselnou hodnotu confidence. Dva výsledky se stejnou confidence, z nichž jeden má prázdné zdroje a druhý dva reálné odkazy, nejsou rovnocenné. Prvek bez doloženého zdroje se nepovažuje za potvrzený.

**Pravidlo 4 — vazba na status (nový versus stávající).**
Prvky popsané jako stávající, původní nebo určené k demolici se vylučují z ontologie a výkazu nového objektu. Popis bouraného objektu (rozměry, materiály, počty) se nesmí promítnout do prvků navržené konstrukce. Status „navržený" přebíjí status „stávající" stejně, jako dílčí dokumentace přebíjí souhrnnou.

---

## 3. Mechanismus normalizace názvu

Před klasifikací se z názvu prvku odvodí:

- **Řídící podstatné jméno** — co prvek skutečně je (základ, dřík, stěna, římsa, opěra, práh, křídlo, obklad, zábradlí, drenáž, kabel, ložisko).
- **Určující kontext konstrukce** — k čemu prvek patří (úhlová zeď / zárubní zeď / opěrná zeď, pilíř, most, opěra). Tento kontext rozhoduje při kolizi slov.
- **Materiál a třída betonu** — pevnostní třída a stupně vlivu prostředí, vázané vždy ke konkrétnímu prvku, nikoli volně k dokumentu.
- **Status** — navržený / stávající / k demolici.

Vazby uvedené předložkou se z řídícího podstatného jména vyloučí. Synonymní pojmenování téhož fyzického prvku se sjednotí (například „kotevní trám" a „římsa-kotevní trám" jsou jeden prvek typu římsa), aby tentýž prvek nedostával různé kategorie podle formulace.

---

## 4. Akceptační fixtury

### 4.1 SO 250 — úhlová zárubní zeď (negativní kontroly)

Objekt: monolitická železobetonová úhlová zárubní zeď, plošně založená, délka 515,20 m, 42 dilatačních celků, líc obložen lomovým kamenem.

Co fixtura ověřuje:
- „Dřík konstrukce" patří stěně, ne pilíři.
- „Lícový obklad z lomového kamene kotvený do dříku" je kamenné zdivo a obklad, ne pilíř — slovo „dříku" je zde předložková vazba.
- „Železobetonový základ" má být klasifikován jako základ podle řídícího podstatného jména.
- Dva podkladní betony: pod základ třídy C25/30 (XF3, XA2, XC2) tloušťky 0,15 m a pod drenáž třídy C12/15 (X0) tloušťky nejméně 0,30 m.
- Rozpor v délce versus výšce: údaj „plná výška 500,0 m" je ve skutečnosti délka plnovýškového úseku (500,0 + dva náběhy po 7,6 m = 515,2 m celkové délky), nikoli výška.
- Rozpor třídy betonu základu: statický model počítá celou stěnu jako C30/37, ale výkres a technická zpráva určují základ jako C25/30 a třídu C30/37 jen pro dřík a římsu. Pro výkaz platí dokumentace stavby.

### 4.2 SO 202 — most přes Lomnický potok (pozitivní kontroly)

Objekt: trvalý dálniční most, směrově rozdělený, spojitá monolitická dvoutrámová konstrukce z předpjatého betonu o třech polích 32,0 + 44,5 + 32,0 m, masivní nízké obsypané opěry, členěné pilíře vždy se dvěma dříky, plošné založení, uložení na ložiskách.

Co fixtura ověřuje:
- „Dříky pilířů" patří do kategorie dříky pilířů — tentýž token „dřík", který je u SO 250 chybný, je zde správný. Toto je pozitivní kontrola k negativní kontrole ze SO 250.
- „Trámy nosné konstrukce" jsou nosná konstrukce, ne průvlak.
- Popis stávajícího mostu evidenčního čísla 6-049 a jeho demolice (prefabrikované nosníky typu Petra, šest nosníků, šířka 12,64 m, pole 26,30 + 27,0 + 27,0 + 26,30 m, pilíře průměru 2,0 m, přibetonovaná vrstva dříků 200 mm, úložné prahy 800 mm) se nezahrnuje do nového objektu.
- Šest tříd betonu vázaných na prvky: základy C30/37 (XF1, XA2, XC2); dříky pilířů C35/45 (XF1, XD1, XC4); opěry C30/37 (XF4, XD3, XC4); úložné prahy, závěrné zídky a křídla C30/37 (XF4, XD3, XC4); nosná konstrukce C35/45 (XF2, XD1, XC4); římsy C30/37 (XF4, XD3, XC4). Žádná osamocená exposiční třída bez vazby na prvek.
- Mezidokumentový rozpor v rozpětí (32,0 versus 31,0) je viditelný až po sloučení technické zprávy se statickým výpočtem nebo výkresem přes kód objektu; samotná technická zpráva uvádí 32,0 konzistentně.

---

## 5. Kritéria přijetí

Číslování pokračuje od #63.

**#63 — dvojí kontext slova „dřík".**
Vstup: „Dřík konstrukce" z technické zprávy stěny SO 250 a „Dříky pilířů" z technické zprávy mostu SO 202.
Pass: první se klasifikuje jako stěna, druhý jako dříky pilířů.

**#64 — předložková vazba se nepovažuje za řídící podstatné jméno.**
Vstup: „Lícový obklad z lomového kamene kotvený do dříku opěrné zdi".
Pass: klasifikace zdivo a obklad, nikoli dříky pilířů.

**#65 — řídící podstatné jméno „základ".**
Vstup: „Železobetonový základ 0,56 × 2,75".
Pass: klasifikace základ, nikoli zbytková kategorie.

**#66 — dvojí kontext slova „trám".**
Vstup: „Římsa-kotevní trám" a „trámy dvoutrámové nosné konstrukce".
Pass: první jako římsa, druhý jako nosná konstrukce; ani jeden jako průvlak.

**#67 — vazba na status.**
Vstup: odstavce popisující stávající most evidenčního čísla 6-049 a jeho demolici.
Pass: žádný prvek z popisu bouraného mostu se neobjeví ve výkazu nového objektu.

**#68 — vazba třídy betonu na prvek.**
Vstup: kapitola materiálů SO 202.
Pass: právě šest párů prvek a jeho třída betonu, žádná osamocená exposiční třída.

**#69 — grounding na zdroje.**
Vstup: kterýkoli klasifikovaný prvek.
Pass: u prvku je vyplněn zdroj (kapitola nebo strana nebo výkres); prvek bez zdroje se označí jako nepotvrzený.

**#70 — označení mezidokumentového rozporu.**
Vstup: sloučení dokumentů přes kód objektu, kde se liší rozměr (rozpětí 32,0 versus 31,0; údaj 500,0 m jako výška versus délka).
Pass: rozpor se označí k revizi, nepřepíše se tiše.

---

## 6. Rozsah a hranice

Součástí je vrstva normalizace názvu a work ontology nad existujícím katalogem kategorií. Součástí **není** betonový kalkulátor, extrakce parametrů dokumentu (samostatná schéma Statika D.1.2) ani změna vícezdrojového směrování modelů.

---

## 7. Postup prací

Nejprve přečíst celý repozitář a najít existující struktury: kde se prvky klasifikují, jak vypadá katalog kategorií a kde v toku dat je místo pro normalizaci názvu. Teprve potom psát. Zadání popisuje chování v běžné řeči; konkrétní pojmenování ve zdrojovém kódu se odvodí až ze čtení repozitáře.
