# Stavební Asistent - Construction Assistant

**Inteligentní AI помощник для českého stavebnictví БЕЗ DOKUMENTŮ**

---

## 🤖 Co je Stavební Asistent?

Stavební Asistent je specializovaný AI expert, který odpoví na vaše otázky o:

✅ **Technologických postupech**
- Jak montovat vodoměrnou šachtu?
- Jak pokládat kanalizační potrubí?
- Jak správně betonovat základy?

✅ **Českých normách ČSN**
- Jaké jsou požadavky pro beton C30/37?
- Co říká ČSN EN 206+A2?
- Jaké třídy prostředí platí?

✅ **Materiálech a specifikacích**
- Jaký beton použít pro základy?
- Jaká výztuž pro mostní konstrukce?
- Jakou izolaci pro hydroizolaci?

✅ **OTSKP/KROS/RTS kódech**
- Co znamená kód 214125?
- Jaké jsou normy pro zemní práce?

✅ **Bezpečnosti práce (BOZP)**
- Jaké OOPP potřebuji?
- Jak zajistit výkop proti sesunutí?

---

## 🚫 Na co NEODPOVÍ

Asistent zdvořile odmítne otázky mimo stavebnictví:

❌ Vaření a recepty
❌ Politika a náboženství
❌ Programování (mimo stavební software)
❌ Zdravotní rady
❌ Finance (mimo stavební rozpočty)

**Příklad odmítnutí:**
```
Otázka: "Jak uvařit guláš?"
Odpověď: "Promiň, jsem specializovaný na české stavebnictví.
         Pomůžu ti s montáží, normami ČSN nebo materiály.
         Máš nějaký stavební dotaz?"
```

---

## 📡 Jak používat (API)

### Endpoint:
```
POST /api/chat/assistant
```

### Request:
```json
{
  "question": "Jak montovat vodoměrnou šachtu?",
  "context": {
    "project_name": "Most přes potok",
    "materials": ["beton C30/37", "armatura B500B"]
  }
}
```

### Response:
```json
{
  "answer": "**MONTÁŽ VODOMĚRNÉ ŠACHTY**\n\n1. Potřebné materiály:\n- Betonová šachta DN 1000...",
  "relevant": true,
  "sources": ["Knowledge Base", "ČSN Normy", "OTSKP"],
  "related_norms": ["ČSN 75 5411", "ČSN EN 805"]
}
```

---

## 💬 Příklady otázek

### ✅ DOBRÉ OTÁZKY (odpovídá):

**1. Technologické postupy:**
- "Jak montovat vodoměrnou šachtu?"
- "Jaký je postup při pokládce kanalizačního potrubí?"
- "Jak správně betonovat základy v zimě?"
- "Jak provádět zásyp a hutňování?"

**2. Normy ČSN:**
- "Jaké jsou požadavky ČSN pro beton C30/37?"
- "Co říká ČSN 73 0600 o hydroizolaci?"
- "Jaké třídy prostředí platí podle ČSN EN 206?"

**3. Materiály:**
- "Jaký beton použít pro základy v agresivním prostředí?"
- "Jaká je třída oceli B500B?"
- "Jakou izolaci použít pro spodní stavbu?"

**4. Bezpečnost:**
- "Jaké OOPP potřebuji při betonáži?"
- "Jak zajistit hloubený výkop?"
- "Jaká je bezpečná hloubka výkopu bez pažení?"

---

### ❌ ŠPATNÉ OTÁZKY (odmítne):

- "Jak uvařit guláš?" → **Není stavebnictví**
- "Kdo vyhraje volby?" → **Politika**
- "Jak vytvořit webovou stránku?" → **Programování**
- "Mám bolest hlavy, co dělat?" → **Zdraví**

---

## 🏗️ Formát odpovědi

Pro technologické postupy asistent vždy strukturuje odpověď:

```
**[NÁZEV POSTUPU]**

**1. Potřebné materiály:**
- [seznam s množstvím]

**2. Potřebné nářadí:**
- [seznam nástrojů]

**3. Postup krok za krokem:**
1. [krok 1]
2. [krok 2]
...

**4. Bezpečnost (BOZP):**
- [bezpečnostní opatření]

**5. Relevantní normy:**
- ČSN [číslo]: [popis]

**6. Časová náročnost:**
- [odhad]

**7. Tipy:**
- [praktické rady]
```

---

## 🧠 Jak funguje filtr témat?

Asistent automaticky rozpozná, zda je otázka o stavebnictví:

### 1. Kontrola klíčových slov:
```python
konstrukce_keywords = [
    "beton", "cement", "ocel", "armatura", "výztuž",
    "montáž", "instalace", "betonáž", "výkop",
    "čsn", "otskp", "norma", "základy", "stěna"
]
```

### 2. Pokud není jasné → Claude double-check:
```
"Určete, zda je otázka relevantní pro stavebnictví..."
→ ANO / NE
```

---

## 🎯 Použití ve frontendu

### React komponenta:

```jsx
async function askAssistant(question) {
  const response = await fetch('/api/chat/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });

  const data = await response.json();

  if (!data.relevant) {
    console.log("Otázka není o stavebnictví");
  } else {
    console.log("Odpověď:", data.answer);
    console.log("Normy:", data.related_norms);
  }
}

// Použití:
askAssistant("Jak montovat vodoměrnou šachtu?");
```

---

## 📚 Znalostní báze

Asistent má přístup k:

- **OTSKP** - Odvětvový třídník stavebních prací
- **RTS** - Referenční technické standardy
- **ÚRS** - Ústřední rozpočtové standardy
- **ČSN normy** - České technické normy
- **Technologické karty**
- **Cenové databáze**

---

## 🔒 Bezpečnost

- **Filtruje nerelevantní témata**
- **Neodpovídá na zdravotní nebo právní rady**
- **Vždy upozorní na BOZP**
- **Doporučuje certifikované postupy**

---

## 💡 Tipy pro nejlepší odpovědi

1. **Buď konkrétní**:
   - ✅ "Jak montovat vodoměrnou šachtu DN 1000?"
   - ❌ "Jak dělat instalace?"

2. **Uveď kontext**:
   - Typ stavby (most, budova, inženýrské sítě)
   - Použité materiály
   - Podmínky (zima, agresivní prostředí)

3. **Ptej se na jeden věc**:
   - ✅ "Jak pokládat kanalizační potrubí?"
   - ❌ "Jak pokládat potrubí, betonovat a izolovat?"

---

## 🚀 Roadmap

Plánované vylepšení:

- [ ] Integrace s Knowledge Base B1-B9 (normy, ceny)
- [ ] Vyhledávání v OTSKP databázi
- [ ] Generování PDF návod
- [ ] Historie konverzace
- [ ] Vícejazyčná podpora (CZ + EN)

---

## 📞 Příklady použití

### Příklad 1: Montáž vodoměrné šachty

**Request:**
```json
{
  "question": "Jak montovat vodoměrnou šachtu?"
}
```

**Response:**
Kompletní návod se 7 kroky, materiály, nástroji, BOZP a normami ČSN 75 5411.

---

### Příklad 2: Nerelevantní otázka

**Request:**
```json
{
  "question": "Jak uvařit guláš?"
}
```

**Response:**
```json
{
  "answer": "Promiň, jsem specializovaný na stavebnictví...",
  "relevant": false,
  "sources": [],
  "related_norms": []
}
```

---

**Vytvořeno s ❤️ pro české stavařstvo**
