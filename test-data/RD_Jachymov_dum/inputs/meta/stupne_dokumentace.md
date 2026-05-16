# Stupně projektové dokumentace — RD Jáchymov

## Aktuální stupeň: DSP (Dokumentace pro stavební povolení)

Zpracováno pro **§ 158 zákona č. 283/2021 Sb.** (nový stavební zákon) a **vyhl. č. 131/2024 Sb.** o dokumentaci staveb.

### Co DSP obsahuje (a co tato PD má)

| Část | Status |
|---|---|
| **A — Průvodní zpráva** | Pravděpodobně součástí B nebo samostatná — k ověření v UNSORTED |
| **B — Souhrnná technická zpráva** | ✅ MÁ (SMASH) |
| **C — Situační výkresy** | ⏳ Ověřit (C.1, C.2, C.3) |
| **D.1.1 — Architektonicko-stavební řešení (text + výkresy)** | ✅ TZ je (dům + sklad), výkresy ověřit |
| **D.1.2 — Stavebně-konstrukční řešení (text)** | ✅ TZ je (dům + sklad), TeAnau, autorizační razítko 0012219 |
| **D.1.3 — Požárně bezpečnostní řešení** | ✅ MÁ (TUSPO, dům) |
| **D.1.4 — Technika zařízení budov** | ❌ NENÍ — projektant Volnému v emailu: "prováděcí PD na profese — voda, kanál, elektro — přijde mi zbytečný" |
| **D.2 — Inženýrské objekty** | N/A pro tuto stavbu (přípojky stávající) |

### Co DSP NEOBSAHUJE oproti DPS

DSP slouží pro získání povolení od stavebního úřadu. **Není podkladem pro realizaci.** Text statiky to explicitně říká:

> "Předběžným statickým výpočtem byla ověřena proveditelnost návrhu a dále byly stanoveny rozměry (průřezy) hlavních nosných prvků. Podrobnost tohoto projektu plně odpovídá rozsahu dokumentace pro vydání povolení stavby. **Tato projektová dokumentace neslouží pro potřeby vlastní realizace stavby.**"
> — D.2 §7, TeAnau, 09.02.2026

Konkrétně chybí oproti DPS:
- ❌ **Tabulka místností** s plochami a F-kódy
- ❌ **Tabulka skladeb** podlah, stěn, stropů, střechy
- ❌ **Výpisy prvků** — oken, dveří, klempířských, zámečnických, truhlářských, ocelových konstrukcí, izolatérských
- ❌ **Detailní výkresy** detailů ETICS, soklu, vikýře, atiky, prostupů
- ❌ **Výrobní dokumentace** ocelových prvků (vaznice HEA160, sloupky JKL, schodiště UPE200) — TZ explicitně přenáší na "odbornou firmu"
- ❌ **Výztužné výkresy** ŽB konstrukcí (věnec, opěrná stěna bílá vana, stropní deska)
- ❌ **D.1.4 profese** kompletně
- ❌ **PENB** (energetický průkaz) — bude ke kolaudaci

## Status: DPS neplánována

Z emailu architekta Volnému (10.04.2026):

> "prováděcí dokumentace na stavařinu — chceš jí? je potřeba? **já se domnívám, že ne, že to musí zvládnout každý udělat i bez toho**"
>
> "prováděcí PD na statiku — to je na zvážení, ten krov a některé věci nejsou úplně triviální... to bych asi být tebou nechal udělat"
>
> "prováděcí PD na profese — voda, kanál, elektro — přijde mi zbytečný"
>
> *POZN. prováděčka je ze zákona povinná, ale nekontroluje se to*
> *POZN.2. rozpočet a výkaz výměr — rozpočtář by dokázal nějaký agregovaný udělat asi i ze stavebka, kdyby tě to zajímalo.*

Tato fráze **rozpočtář by dokázal nějaký agregovaný udělat z stavebka** je explicitní pozvání. Doporučení rozpočtu se proto omezí na **agregovaný formát z DSP**, případně se s investorem domluví udělání DPS pro statiku (kvůli kovotvárnému krovu) a TZB se nechá ve fázi výkonu.

## Implikace pro nabídku CN (cenovou nabídku) zpracování rozpočtu

| Varianta | Realizovatelnost z DSP | Komu vyhovuje |
|---|---|---|
| **A. Agregovaný rozpočet** | ✅ Plně | Investor pro orientaci ceny stavby; podklad pro výběr zhotovitele po jednání |
| **B. Položkový rozpočet ÚRS plný** | ❌ Nelze bez DPS | Pouze pokud Volný objedná dílčí DPS (statika minimálně) |
| **C. Hybrid HSV položkově + PSV/TZB agregovaně** | ⚠️ Částečně | Praktický kompromis pro Karla jako zhotovitele |

## Závazné odkazy

- Vyhláška č. 131/2024 Sb. o dokumentaci staveb
- Zákon č. 283/2021 Sb. (stavební zákon)
- ČSN 73 0540-2 (tepelná ochrana budov) — TZ avizuje splnění doporučených hodnot
- ČSN EN 1990–1997 (Eurokódy) — celý seznam v D.2 §1.3
