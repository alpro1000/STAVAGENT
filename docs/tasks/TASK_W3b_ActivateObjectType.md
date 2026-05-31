# TASK — W3b: Aktivace typu objektu z technické zprávy

**Dokončení W3.** Po W3 přijímá klasifikátor prvků autoritativní typ objektu, ale nikdo jej nevyplňuje — v provozu se proto stále používá křehká záloha podle názvu a kódu. Tato úloha zapojí určení typu objektu jednou z technické zprávy a jeho předání do klasifikace každého prvku daného objektu.

Fixtury: SO 250 (zárubní zeď) → opěrná zeď; SO 202 (most) → most. Stavba: D6 Olšová Vrata – Žalmanov, PDPS.

---

## 1. Cíl

Určit konstrukční typ objektu jednou z jeho technické zprávy, uložit jej do stavu projektu a předat jako autoritativní vstup do klasifikace každého prvku téhož objektu, aby klasifikace nezávisela na lexice v názvu jednotlivého prvku.

---

## 2. Pravidla

1. **Deterministické určení.** Typ objektu se určí z technické zprávy (název objektu a věta charakteristiky) pravidlovým párováním, ne jazykovým modelem. Jazykový model jen jako záloha, pokud pravidla typ neurčí, a to přes stávající směrování — bez nové integrace.
2. **Autoritativnost.** Určený typ objektu má přednost před zálohou odvozenou z názvu a kódu prvku.
3. **Jednorázovost.** Typ se určí jednou na objekt a uloží do stavu projektu, klíčováno kódem objektu. Klasifikace prvků jej nepřepočítává.
4. **Bezpečná záloha.** Pokud technická zpráva typ jednoznačně neurčí, zůstane neurčený a klasifikace spadne na dosavadní zálohu — bez změny chování oproti W3.

---

## 3. Mechanismus

- Z názvu objektu a věty charakteristiky se odvodí typ: výskyt slova „most" nebo „lávka" → most; „zárubní", „opěrná" nebo „úhlová zeď" → opěrná zeď; „budova" nebo „pozemní stavba" → pozemní stavba.
- Výsledek se uloží jednou na objekt do stavu projektu.
- Při atomizaci prací dostane každý prvek daného objektu tento typ jako autoritativní vstup klasifikace.

---

## 4. Kritéria přijetí (pokračuje od #71)

**#71 — určení typu z technické zprávy.** SO 250 (zárubní, úhlová železobetonová zeď) → opěrná zeď; SO 202 (trvalý dálniční most) → most.

**#72 — autoritativnost a předání.** Každý prvek daného objektu dostane stejný typ; klasifikace prvku přestane záviset na lexice jednotlivého názvu.

**#73 — most s obecným názvem (vlastní přínos aktivace).** Prvek pod typem „most", pojmenovaný bez mostní lexiky (holý „dřík", „základ"), se klasifikuje v mostovém kontextu (dřík → dříky pilířů, základ → základ pilíře), nikoli zálohou do zdi.

**#74 — zárubní zeď.** Prvek pod typem „opěrná zeď" se klasifikuje jako stěna nebo opěrná zeď i bez explicitní lexiky v názvu; žádný falešný mostový překlop.

**#75 — jednorázovost.** Typ se určí jednou na objekt a uloží do stavu projektu; opakovaná klasifikace prvků téhož objektu typ nepřepočítává.

**#76 — neurčený typ.** Pokud technická zpráva typ jednoznačně neurčí, klasifikace spadne na zálohu podle názvu a kódu beze změny chování oproti W3 (žádná regrese kritérií #63–#70).

---

## 5. Běh testů a kontrola

Nové testy #71–#76 se napojí na stejnou kontrolu jako golden sady (skip-proof, fail-not-skip jako u W3). Nejprve červené proti současnému stavu (kde typ objektu nikdo nevyplňuje), po zapojení zelené; kritéria #63–#70 z W3 zůstanou zelená jako regresní hlídka.

---

## 6. Rozsah a hranice

Součástí je určení typu objektu z technické zprávy, jeho uložení do stavu projektu a předání do klasifikace prvků. **Netýká se:** klasifikátoru prvků ani normalizátoru z W3 (zůstávají beze změny), vícezdrojového směrování modelů, betonového kalkulátoru ani sesterského klasifikátoru v kalkulátoru.

---

## 7. Postup

Nejprve rešerše: kde orchestrátor na cestě atomizace prací čte technickou zprávu, kde volá klasifikaci prvků a kde je stav projektu. Pak červené testy #71–#76. Pak určení typu, jeho uložení a předání. Pak zelená a zapojení do kontroly. Konkrétní pojmenování ve zdrojovém kódu se řídí mapou z rešerše.
