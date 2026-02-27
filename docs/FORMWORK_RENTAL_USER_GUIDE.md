# Kalkulátor nájmu bednění - Návod pro uživatele

## 🎯 Co to je?

Kalkulátor nájmu bednění v Registry TOV umožňuje rychle spočítat náklady na pronájem bednění od dodavatelů (DOKA, Peri).

## 📋 Kdy použít?

Po výpočtu montáže a demontáže bednění v **Monolit Planner** potřebujete spočítat náklady na **nájem bednění** od dodavatele.

## 🔄 Workflow (3 kroky)

### Krok 1: Monolit Planner - Výpočet práce

1. Otevřete Monolit Planner
2. V části konstrukce klikněte na **"Kalkulátor bednění"**
3. Zadejte parametry:
   - Název konstrukce
   - Plocha (m²)
   - Systém bednění (FRAMI XLIFE, FRAMAX XLIFE, STAXO100)
   - Počet taktů
4. Klikněte **"Přenést Montáž + Demontáž"**

### Krok 2: Zkopírujte parametry z alertu

Po přenosu se zobrazí alert s parametry:

```
✅ Přeneseno 2 řádků (Montáž + Demontáž)

💡 NÁJEM BEDNĚNÍ - přidejte do Registry TOV:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Parametry pro kalkulátor:
   • Plocha: 100.0 m²
   • Termín nájmu: 15 dní
   • Systém: FRAMI XLIFE

🔗 Otevřete Registry TOV:
   https://stavagent-backend-ktwx.vercel.app
```

**Zkopírujte si tyto hodnoty!**

### Krok 3: Registry TOV - Výpočet nájmu

1. Otevřete **Registry TOV** (odkaz z alertu)
2. Klikněte na tlačítko **"🏗️ Nájem bednění"** v horní liště
3. Zadejte parametry z alertu:
   - **Plocha (m²)** - např. 100
   - **Systém bednění** - např. FRAMI XLIFE
   - **Výška (m)** - např. 2.7
   - **Dny nájmu** - např. 15
4. Klikněte **"Vypočítat"**
5. Zkontrolujte výsledek:
   - Cena za m²/den
   - Denní náklady
   - **Celkem nájem** (hlavní výsledek)
6. Klikněte **"Přidat do Registry TOV"**

## 💰 Příklad výpočtu

**Vstup:**
- Plocha: 100 m²
- Systém: FRAMI XLIFE
- Výška: 2.7 m
- Dny: 15

**Výpočet:**
- Základní cena: 8.5 Kč/m²/den
- Koeficient výšky (2.7m): 1.15
- Jednotková cena: 8.5 × 1.15 = **9.78 Kč/m²/den**
- Denní náklady: 9.78 × 100 = **978 Kč/den**
- **Celkem nájem: 978 × 15 = 14,670 Kč**

## 📊 Systémy bednění a ceny

### FRAMI XLIFE (stěnové bednění)
- Základní cena: **8.5 Kč/m²/den**
- Výšky: 1.2m, 1.5m, 2.4m, 2.7m, 3.0m
- Použití: Stěny, pilíře, základy

### FRAMAX XLIFE (stěnové bednění)
- Základní cena: **9.0 Kč/m²/den**
- Výšky: 1.5m, 2.4m, 2.7m, 3.0m
- Použití: Vysoké stěny, jádra

### STAXO100 (stropní podpěry)
- Základní cena: **12.0 Kč/m²/den**
- Výšky: 2.7m, 3.0m
- Použití: Stropy, desky

## ⚙️ Koeficienty výšky

| Výška | Koeficient |
|-------|------------|
| 1.2m  | 0.9        |
| 1.5m  | 1.0        |
| 2.4m  | 1.1        |
| 2.7m  | 1.15       |
| 3.0m  | 1.2        |

## 🔍 Jak se počítá termín nájmu?

Termín nájmu = **max**(Výztuž dny, Betonování dny, Zrání dny, Montáž dny, Demontáž dny)

Bednění musí být na staveništi po celou dobu všech prací.

## ❓ Časté otázky

### Q: Proč je nájem v Registry TOV a ne v Monolit?
**A:** Monolit počítá **práci** (montáž, demontáž), Registry TOV počítá **externí služby** (nájem od dodavatele). To umožňuje oddělit mzdové náklady od nákladů na služby.

### Q: Odkud jsou ceny?
**A:** Ceny jsou z oficiálního ceníku DOKA (2024). Jsou to orientační ceny, skutečné ceny závisí na dohodě s dodavatelem.

### Q: Můžu změnit ceny?
**A:** Ano, v budoucnu bude admin panel pro správu cen. Zatím jsou ceny pevně dané v kódu.

### Q: Co když mám jiný systém bednění?
**A:** Zatím jsou podporovány pouze FRAMI XLIFE, FRAMAX XLIFE a STAXO100. Další systémy budou přidány v budoucnu.

## 🚀 Tipy pro efektivní použití

1. **Zkopírujte parametry** z Monolit alertu - ušetříte čas
2. **Kontrolujte výšku** - má velký vliv na cenu (koeficient 0.9-1.2)
3. **Počítejte s rezervou** - přidejte 1-2 dny k termínu nájmu
4. **Porovnejte systémy** - FRAMI je levnější než FRAMAX
5. **Dokumentujte** - uložte výpočet do Registry TOV pro budoucí referenci

## 📞 Podpora

Máte problém nebo nápad na vylepšení?
- GitHub Issues: https://github.com/alpro1000/STAVAGENT/issues
- Dokumentace: `docs/FORMWORK_RENTAL_CALCULATOR.md`

---

**Verze:** 1.0
**Datum:** 2025-01-XX
**Status:** ✅ Aktivní
