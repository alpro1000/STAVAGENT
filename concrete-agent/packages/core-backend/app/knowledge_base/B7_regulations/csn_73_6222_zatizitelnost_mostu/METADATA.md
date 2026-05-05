# ČSN 73 6222 — Zatížitelnost mostů pozemních komunikací

```yaml
title: ČSN 73 6222 Zatížitelnost mostů pozemních komunikací
status: paid_standard_full_text_unavailable
slug: csn_73_6222_zatizitelnost_mostu
recommended_bucket: B7_regulations
last_attempt_to_acquire: 2026-05-05
acquisition_blocker: "Plný text za poplatek na ÚNMZ. Stáhnutí blokováno bez zaplacení."
```

## Why this stub exists

ČSN 73 6222 je **placená norma** (ÚNMZ), nelze ji volně stáhnout. Plný text není v knowledge base.

Místo toho:

1. **Klíčový obsah** (skupiny, stavební stavy, vzorce, schémata) je extrahován z vyučovacích slidů UPa (Univerzita Pardubice, Dopravní fakulta) — viz `B6_research_papers/upa_zatizitelnost_sanace_mostu/`
2. **Komplementárně** TP 200 (Stanovení zatížitelnosti mostů PK) — pravidla výpočtu (rovněž odkazované z UPa)
3. **Cross-reference** Eurocode EN 1991-2 (zatížení mostů) — celý text dostupný (volně publikovaný v sousedních zemích — viz SIST EN 1992-2 v B7)

## Aplikované sekce normy (pokrytí přes UPa slides)

| Sekce ČSN 73 6222 | Pokrytí v UPa slides | Pokrytí v stub | Status |
|---|---|---|---|
| Definice Vn / Vr / Ve | slide 3 | ✅ | adequate |
| Klasifikace skupin | slide 4 | ✅ | adequate |
| Stavební stavy + α | slide 4 | ✅ | adequate |
| Schémata vozidel | slides 5-7 | ✅ visualní | adequate pro context |
| Kombinovaný výpočet | slides 8-9 | ✅ vzorce | adequate pro overview |
| Podrobný statický výpočet | slide 4 (ref) | ❌ jen mention | **gap** — třeba pro V-VII |

**Gap:** podrobný statický výpočet pro stupně V-VII (špatný-havarijní) — pro Žihle není relevantní (jdeme demolice, ne reassessment), ale pro budoucí sanační/posuzovací projekty bude třeba doplnit.

## Applies to STAVAGENT

✅ **Direct usage:**
- Validace ZD požadavků na novou stavbu (skupina 1 → 32/80/180 t)
- Klasifikace stavu existujícího mostu (HPM dává stupeň I-VII → α coef)

⚠️ **Indirect usage:**
- Přepočet zatížitelnosti je responsibility zhotovitele (ZD čl. 4.3.j) — STAVAGENT neprovádí
- STAVAGENT pouze validuje že požadované hodnoty (Vn/Vr/Ve) odpovídají skupině v normě

## Applicable to Žihle 2062-1

| Aspekt | Aplikace |
|---|---|
| ZD §4.4.h požaduje Vn=32 / Vr=80 / Ve=180 | → skupina 1 dle ČSN 73 6222 |
| HPM 24.9.2025: stav NK = VI | → α = 0.4 (velmi špatný) |
| HPM 24.9.2025: stav SS = IV | → α = 0.8 (uspokojivý) |
| Existující Vn=20 / Vr=24 / Ve=29 t | → mezi skupinami 1 a 2, nedosahuje skupiny 1 |

## Cross-references

- `B6_research_papers/upa_zatizitelnost_sanace_mostu/` — primary stand-in source
- `B7_regulations/en_1992_2_concrete_bridges/` — Eurocode 2 mosty (krytí, materiály)
- `B7_regulations/csn_en_1991_2_zatizeni_mostu/` — load model traffic (TODO — také placená)
- `B7_regulations/tp_200/` — TODO — stanovení zatížitelnosti (volně dostupné na rsd.cz/pjpk?)

## Future actions

- [ ] Pokud STAVAGENT zaplatí přístup k ČSN — provést plnou extraction
- [ ] Stáhnout TP 200 z pjpk.rsd.cz (volně dostupné technické podmínky)
- [ ] Zkusit najít skripta z VUT/ČVUT pokrývající podrobný statický výpočet
