# ✨ Průvodce tlačítkem "Aplikovat na podobné položky"

## Co dělá tlačítko ✨ (Sparkles)?

Tlačítko **Sparkles** (✨) automaticky **hledá a klasifikuje** podobné položky na základě popisu.

---

## 🎯 Jak to funguje?

### Krok 1: Přiřadíte skupinu jedné položce

```
Položka: "Betonáž základů C30/37"
Skupina: "Moje základy - fáze 1"
```

Vidíte tlačítko ✨ vedle pole skupiny.

---

### Krok 2: Kliknete na tlačítko ✨

Systém automaticky:

1. **Hledá podobné položky** v projektu:
   - Porovnává **popisy** (fuzzy matching)
   - Porovnává **kódy** pozic
   - Porovnává **celý popis**

2. **Vyhodnocuje shodu** (0-100%):
   - "Betonování základové desky" → 95% shoda
   - "Základy železobeton" → 88% shoda
   - "Základová konstrukce" → 72% shoda

3. **Filtruje výsledky**:
   - Pouze položky s **minimální shodou 70%**
   - Pouze **neklasifikované** položky (bez skupiny)

4. **Aplikuje skupinu**:
   - Všem podobným položkám přiřadí **stejnou skupinu**
   - Zobrazí **potvrzení**: "Skupina aplikována na 5 podobných položek"

---

## 📊 Příklad použití

### Máte 200 položek z rozpočtu:

```
✅ Klasifikováno:    50 položek
❌ Neklasifikováno: 150 položek
```

### Krok za krokem:

1. **Vyberte první položku:**
   ```
   Kod: 231112
   Popis: "Betonáž základů z betonu C30/37"
   ```

2. **Zadejte vlastní skupinu:**
   ```
   Skupina: "Základy - 1. fáze"
   ```
   *(Nová skupina se automaticky uloží)*

3. **Klikněte ✨:**
   ```
   Hledání podobných...
   ```

4. **Systém najde 8 podobných položek:**
   ```
   ✓ "Betonování základové desky C30/37" (96%)
   ✓ "Základy železobeton" (89%)
   ✓ "Základová konstrukce monolit" (78%)
   ✓ "Beton základů C25/30" (75%)
   ✓ "Základy - betonáž" (73%)
   ✓ ... (ještě 3)
   ```

5. **Všechny získají skupinu:**
   ```
   ✅ Aplikováno: 8 položek
   ```

6. **Výsledek:**
   ```
   ✅ Klasifikováno:    58 položek (+8)
   ❌ Neklasifikováno: 142 položek (-8)
   ```

---

## 🚀 Výhody

| Výhoda | Popis |
|--------|-------|
| ⚡ **Rychlost** | Klasifikace 10-20 položek jedním kliknutím |
| 🎯 **Přesnost** | Fuzzy matching najde i varianty s překlepy |
| 🔒 **Bezpečnost** | Pouze shoda ≥70% (nastavitelné) |
| 💾 **Úspora času** | Nemusíte ručně hledat každou podobnou položku |
| 🧠 **Učení** | Systém se učí z vašich klasifikací |

---

## 🎨 Vizuální indikátory

### Ikona tlačítka

```
✨ Sparkles (hvězdičky)
```

### Stavy tlačítka

| Stav | Vzhled | Popis |
|------|--------|-------|
| **Aktivní** | ✨ Oranžová ikona | Připraveno ke kliknutí |
| **Zpracování** | ⏳ Šedá ikona | Hledání podobných... |
| **Skryté** | - | Položka nemá skupinu |

---

## 📋 Typy odpovědí

### Úspěch ✅

```
┌────────────────────────────────────┐
│  ✅  Skupina aplikována            │
│                                    │
│  Skupina "Základy - 1. fáze" byla  │
│  úspěšně aplikována na 8 podobných │
│  položek.                          │
│                                    │
│  [         OK         ]            │
└────────────────────────────────────┘
```

### Žádné položky 💬

```
┌────────────────────────────────────┐
│  💬  Nenalezeny podobné položky    │
│                                    │
│  Pro tuto položku nebyly nalezeny  │
│  žádné podobné položky s           │
│  dostatečnou shodou (min. 70%).    │
│                                    │
│  [         OK         ]            │
└────────────────────────────────────┘
```

---

## 🔧 Technické detaily

### Algoritmus vyhledávání

1. **Fuse.js Fuzzy Search:**
   - Váhy polí:
     - `popis`: 50%
     - `popisFull`: 30%
     - `kod`: 20%

2. **Filtrování:**
   - Vyloučení aktuální položky
   - Pouze neklasifikované položky
   - Minimální shoda: 70%

3. **Maximální počet výsledků:**
   - 20 položek (nejlepší shody)

### Výpočet confidence

```javascript
confidence = (1 - fuzzyScore) × 100

Příklad:
fuzzyScore = 0.12 → confidence = 88%
fuzzyScore = 0.28 → confidence = 72%
fuzzyScore = 0.35 → confidence = 65% (zamítnuto, <70%)
```

---

## ❓ Časté otázky (FAQ)

### Q: Proč se tlačítko ✨ nezobrazuje?

**A:** Tlačítko se zobrazí pouze když:
- Položka **má přiřazenou skupinu**
- Jste v editačním režimu

---

### Q: Můžu změnit práh shody (70%)?

**A:** Ano, ve zdrojovém kódu:

```typescript
// src/services/similarity/similarityService.ts
export function autoAssignSimilarItems(
  sourceItem: ParsedItem,
  allItems: ParsedItem[],
  minConfidence: number = 70 // ← změňte zde
)
```

---

### Q: Co když najde moc položek?

**A:** Systém:
- Omezuje výsledky na **20 nejlepších shod**
- Seřazuje podle **nejvyšší shody**
- Zobrazí **počet aplikovaných položek**

---

### Q: Můžu vrátit změny zpět?

**A:** Momentálně ne, ale můžete:
1. **Přiřadit jinou skupinu** ručně
2. **Použít tlačítko znovu** s jinou položkou

*(Funkce Undo/Redo je v plánu)*

---

### Q: Funguje to i pro vlastní skupiny?

**A:** Ano! Systém pracuje se **všemi skupinami**:
- Přednastavené skupiny (Beton - monolitický, Výztuž...)
- **Vaše vlastní skupiny** (Můj základ, Fáze 1...)

---

## 💡 Tipy a triky

### Tip 1: Začněte s typickými položkami

```
❌ Špatně: Specifická položka
   "Speciální beton pro pilíř P-125A"

✅ Dobře: Obecná položka
   "Betonáž pilířů"
```

Obecné položky najdou víc podobných položek!

---

### Tip 2: Používejte popisné názvy skupin

```
❌ Špatně:
   "Beton 1", "Beton 2", "Beton 3"

✅ Dobře:
   "Základy - 1. fáze"
   "Sloupy - hlavní hala"
   "Stropy - 2. NP"
```

---

### Tip 3: Kombinujte s tlačítkem "Seskupit podle skupiny"

```
1. Aplikujte skupinu na podobné ✨
2. Klikněte "Seskupit podle skupiny" 📁
3. Vidíte všechny položky seskupené
```

---

## 🎓 Workflow doporučení

### Rychlá klasifikace velkého projektu (200+ položek)

```
1. Importujte Excel → 200 položek

2. Automatická klasifikace:
   ✅ Klasifikováno:   120 položek (60%)
   ❌ Neklasifikováno:  80 položek (40%)

3. Ručně klasifikujte první z každé kategorie:
   - "Betonáž základů" → "Základy"
   - "Osazení panelů" → "Prefabrikát"
   - "Svařování výztuže" → "Výztuž"

4. Použijte ✨ na každou:
   → +15 položek "Základy"
   → +8 položek "Prefabrikát"
   → +12 položek "Výztuž"

5. Výsledek po 5 minutách:
   ✅ Klasifikováno:   155 položek (78%)
   ❌ Neklasifikováno:  45 položek (22%)

6. Zbylé položky klasifikujte ručně nebo ignorujte
```

---

## 📞 Podpora

Pokud máte problémy:

1. Zkontrolujte **minimální shodu** (70%)
2. Zkuste **jiný popis** položky
3. Používejte **obecnější skupiny**

---

**Verze:** 1.0.0
**Datum:** 2026-01-22
**Autor:** STAVAGENT Team
