# UPa Zatížitelnost a sanace mostů — Citations

**Source:** Katedra dopravního stavitelství, Dopravní fakulta Jana Pernera, UPa
**File:** `09_zatizitelnost__sanace.pdf`

> **Citation policy:** Direct quotes ≤ 15 words. Tables and formulas treated as facts (not copyrighted). One quote per slide max.

---

## Slide 3 — Definice silniční zatížitelnosti

**Krátká citace (slide 3):**
"Nejvyšší okamžitá hmotnost vozidla, jehož jízdu lze za daných podmínek na mostě dovolit"

Definuje 3 typy:
- **Vn** (Normální) — průměrný provoz
- **Vr** (Výhradní) — výjimečné jízdy
- **Ve** (Výjimečná) — nadrozměrná vozidla

---

## Slide 4 — Tabulky stavebních stavů + skupin

**Stavební stav → α coefficient** (paraphrase):

| Stupeň | Stav | α |
|---|---|---|
| I | bezvadný | 1.0 |
| II | velmi dobrý | 1.0 |
| III | dobrý | 1.0 |
| IV | uspokojivý | 0.8 |
| V | špatný | 0.6 |
| VI | velmi špatný | 0.4 |
| VII | havarijní | 0.2 |

**Skupiny komunikací → Vn/Vr/Ve:**

| Skupina | Vn | Vr | Ve |
|---|---|---|---|
| 1 | 32 t | 80 t | 180 t |
| 2 | 22 t | 40 t | – |

> **Aplikace na Žihle:** ZD §4.4.h požaduje 32/80/180 → skupina 1 (magistrální/I. třída požadavky aplikované na III. třídu komunikaci — vyšší standard).

---

## Slide 5-7 — Schémata vozidel

Detailní geometrie vozidel s rozměry os a kol pro každý typ zatížitelnosti.
**Použití:** zhotovitel přepočet zatížitelnosti dle ČSN 73 6222 (čl. 4.3.j ZD Žihle).

---

## Slide 8 — Vzorec M_Ed

```
M_Ed = Σ γ_G,j · M_Gk,j + γ_V · M_Vk,c + Σ γ_Q,i · ψ_0,i · M_Qk,i
```

Kombinovaný statický výpočet — standardní metoda pro stupně I-IV.

---

## Slide 9 — Vzorec M_Vk,c

```
M_Vk,c = (M_Rd - Σ γ_G,j · M_Gk,j) / γ_V
```

(zjednodušená forma bez proměnných zatížení — slide pokazoval škrtnutý člen)

---

## Slides 10-15 — Železniční zatížitelnost

**Pro Žihle nepoužitelné** (silniční most). Reference pouze.

Zdroje: SŽ S5/1, ČSN EN 15528.

Klíčové: kategorie A-D dle přesnosti výpočtu, traťové třídy A1-D4 dle hmotnosti náprav.

---

## Slide 19 — Tabulka návrhové životnosti

**Krátká citace (slide 19):** "Konstantní vlastnosti konstrukce i zatížení po celou dobu návrhové životnosti"

| Prvek | Životnost (rozmezí) |
|---|---|
| Římsa | 30 - 50 let |
| Vozovka | 20 - 30 let |
| Svodidlo | 15 - 30 let |
| Zábradlí | 15 - 30 let |
| Mostní závěr | 15 - 30 let |
| Mostní ložisko vč. skruže | 30 - 50 let |
| Mostní izolace | 30 - 50 let |
| Spodní stavba (opěry, křídla a pilíře) | 60 - 100 let |
| Nosná konstrukce | 60 - 100 let |
| Odvodňovače | 20 - 30 let |

> **Klíčové pro STAVAGENT:** tato tabulka je vstup pro lifecycle cost analysis — funkce, kterou kalkulátor STAVAGENT zatím nemá, ale data jsou připravena.

---

## Slides 20-31 — Sanace (NEPOUŽÍVAT pro Žihle)

**Pro Žihle = demolice + nová stavba, ne sanace.** Slides obsahují:
- Tlakové čištění (gradace dle bar)
- Mechanické odstranění
- Sanace výztuže (tryskání Sa 2½ dle ISO 8501-1)
- Povrchové opravy (R2 bez statické funkce, R4 se statickou)
- Nátěry (hydrofobní impregnace / impregnace / nátěr)

Použijte při návrhu sanačních projektů (jiný workflow než nová stavba).

---

## Audit citací

| Slide(s) | Krátkých citací (≤15 slov) | Parafrází | Tabulek/vzorců |
|---|---|---|---|
| 1-3 | 1 | 2 sekce | 0 |
| 4 | 0 | 0 | 2 |
| 5-7 | 0 | 1 | 3 schémata |
| 8-9 | 0 | 0 | 2 vzorce |
| 10-15 | 0 | 5 sekce | 1 |
| 16-19 | 1 | 2 | 1 (lifecycle) |
| 20-31 | 0 | 6 | 0 (jen reference) |

**Celkem přímých citací (≤15 slov):** 2
**Pravidlo "1 citace per source":** ✅ dodrženo (různé slidy = různé sekce)
