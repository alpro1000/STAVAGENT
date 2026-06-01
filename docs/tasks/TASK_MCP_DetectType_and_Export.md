# TASK — MCP nástroje: detect_object_type + export (Varianta 2)

**Dvě díry z auditu MCP se uzavřou jako skutečné nástroje.** Po nich začne dělíverabl
(soupis prací v Excelu) vznikat přes MCP a typ objektu (W3b) se aktivuje jako nástroj.

**Předpoklad:** PR s W3b (#1262) je zelený a smergovaný — Část A obaluje jeho detektor.

---

## Společné zásady (3-vrstvý princip z auditu)

Každý nový nástroj: jedna zodpovědnost; jasné vstupní schéma; deterministický (bez
jazykového modelu, ten jen jako záloha přes stávající směrování, pokud vůbec); nese
`_source` pro grounding (Pattern 29); žádná byznys-logika navíc ani UI; zaregistrovaný
v MCP serveru, s REST obálkou a v seznamu nástrojů — stejným vzorem jako stávající
nástroje (např. ten pro work breakdown).

---

## Část A — detect_object_type jako nástroj

### Cíl
Vystavit detektor typu objektu z W3b jako MCP nástroj, aby ho mohl volat orchestrátor
(a krok, který plní mezipaměť typů). Sám nástroj jen určuje typ; mezipaměť podle kódu
objektu plní volající (orchestrátor), ne nástroj — kvůli jedné zodpovědnosti.

### Chování
- **Vstup:** název objektu a věta charakteristiky. Detekce se opírá **pouze** o tyto
  autoritativní údaje, **nikdy o plný text** dokumentu — v technické zprávě SO 250 se
  v geologii vyskytují slova „mostní objekt" a „lávka SO 222", a plnotextové hledání
  „most" by stěnu chybně určilo jako most.
- **Výstup:** typ objektu (most / opěrná zeď / pozemní stavba) nebo neurčeno; plus
  `_source` s údajem, který tuto volbu určil.
- **Determinismus:** pravidlové párování (most/lávka → most; zárubní/opěrná/úhlová zeď
  → opěrná zeď; budova/pozemní → pozemní stavba). Jazykový model jen jako záloha, pokud
  pravidla neurčí, přes stávající směrování.
- **Bezpečná záloha:** když ani název, ani charakteristika typ neurčí — neurčeno, bez
  pádu; položka se označí jako nepotvrzená.

### Kritéria přijetí
**#77** — SO 250 (název „Zárubní zeď", charakteristika „Úhlová železobetonová zeď")
→ opěrná zeď, a to i přesto, že se v těle technické zprávy vyskytují „mostní objekt"
a „lávka SO 222".
**#78** — SO 202 (název „Most…", charakteristika „Trvalý dálniční most") → most.
**#79** — vstup bez určujících údajů → neurčeno, bez pádu, signalizovaná záloha.
**#80** — nástroj nese `_source` s polem, které volbu určilo; chybí-li název i
charakteristika, výsledek je nepotvrzený. Nástroj je zaregistrovaný, má REST obálku,
default cesta je deterministická (bez jazykového modelu).

---

## Část B — export jako nástroj (první dělíverabl: soupis prací)

### Cíl
Povýšit logiku sestavení soupisu (dnes skript mimo MCP) na MCP nástroj, aby orchestrátor
mohl vydat dělíverabl end-to-end. Tím se zároveň zpřístupní koncový stav workflow, který
je dnes deklarovaný, ale nedosažitelný (žádný nástroj do něj nevede).

### Chování
- **Vstup:** strukturovaný seznam položek (nebo identifikátor projektu, ze kterého se
  načtou) — typicky výstup work breakdownu a dekompozice (atomické operace montáž/materiál).
- **Výstup:** soubor Excel podle kanonické šablony soupisu prací + metadata (počet řádků,
  druh dělíverablu). **Žádný jazykový model** — čistý deterministický render šablony.
- **Provenience:** `_source` z položek breakdownu se do exportu **přenese** (sloupec nebo
  dohledatelná vazba), aby byla smeta obhajitelná. Žádný vymyšlený údaj.
- **Rozšiřitelnost:** navrhnout tak, aby další dělíverably (výměry, zařízení staveniště)
  šly doplnit jako další druh téhož nástroje, bez přepisu. (Tato úloha dodává jako první
  jen soupis prací.)

### Kritéria přijetí
**#81** — daný strukturovaný seznam položek → platný Excel se všemi řádky; `_source`
zachován a dohledatelný; žádný vymyšlený údaj ani kód.
**#82** — render je deterministický a přehratelný: stejný vstup → stejné řádky a hodnoty;
bez jazykového modelu.
**#83** — koncový stav exportu je nově dosažitelný: nástroj je zaregistrovaný v příslušné
kategorii a povolovací seznam pro export je naplněn — dříve mrtvá deklarace stavu má teď
skutečný nástroj.
**#84** — nástroj je zaregistrovaný, má REST obálku a je v seznamu nástrojů; nese `_source`.

---

## Hranice

Nedotýkat se W3 klasifikátoru/normalizátoru ani vícezdrojového směrování. Stage-gating
neměnit kromě zpřístupnění koncového stavu exportu. Žádné UI. `extract_vymery` a další
dělíverably exportu jsou mimo tuto úlohu (následný bod backlogu). Při příležitosti uklidit:
mrtvý nástroj pro čtení dokumentace projektu (deklarovaný, nezaregistrovaný) — odstranit
nebo doplnit; nezhoršovat rozjezd typů mezi klasifikátorem a šablonami prací.

---

## Postup

Nejprve rešerše: kde je dnes skript sestavení soupisu a generátor reportů, kde detektor
typu z W3b, jak se nástroje registrují v MCP serveru a jak vypadá vzor REST obálky, kde je
povolovací seznam pro export a koncové stavy workflow. Pak červené testy #77–#84 (skip-proof,
jako u golden sad). Pak oba nástroje. Pak zelená + zapojení do kontrolního workflow. Konkrétní
pojmenování ve zdrojovém kódu se řídí mapou z rešerše a z auditu.
