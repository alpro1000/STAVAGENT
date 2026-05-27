# BD Daliborova 266/24 — Půdní vestavba + nová střecha

**Status:** Phase 0a (setup) — 2026-05-27
**Stupeň PD:** DSP (architektonicko-stavební část D.1.1)
**Pattern:** RD-Jachymov-style (rekonstrukce + vestavba, kompletní výměna krovu, vikýře)

## Krátký popis

Bytový dům v ulici **Daliborova č.p. 266/24, Praha 15 — Hostivař**
(parc. č. 669, k.ú. Hostivař 732 052, plocha pozemku 690 m²).
Krajní sekce blokové zástavby z cca **1920**.

Stávající stav: 1.PP + 3.NP, **12 bytových jednotek**, dřevěný trámový strop
nad 1. a 2.NP, šikmá střecha (sklon 36,0°, keramická krytina) směrem do ulice,
pultová střecha s mírným spádem směrem do vnitrobloku (řešena beze změny).

**Předmět stavby:** vestavba **2 nových bytových jednotek 3+kk** do půdního
prostoru směrem do ulice (BYT 34 = 64,48 m² + BYT 35 = 62,55 m²; celkem
nástavba 127,03 m²). Po realizaci **14 bytových jednotek**.

Zachováno: poloha a výška hřebene, sklon střešní pláně, boční štíty, podélná
komínová stěna, světlík, dvorní střecha.

## Rozsah prací (z TZ D.1.1 + ChatGPT předběžný výkaz)

| Skupina | Klíčové položky |
|---|---|
| **Bourací práce** | Snesení uličního krovu, atiková nadezdívka, horní římsa, stávající bobrovka + latě, podlahové vrstvy podkroví, demontáž oplechování 5 komínů + napojení u světlíku |
| **Strop 2.NP** | Zesílení trámů 180/200 á 0,7 m příložkou 100/260 mm, doplnění ocelových profilů pro novou mezibytovou stěnu a nosné prvky krovu |
| **Nový krov** | Dřevěný krokvový systém 100×180 mm á 1,0 m, ocelová střední + vrcholová vaznice, ocelové sloupky, pozednice dřevěná, profily **2× U100 u hřebene** a **2× U120 v zalomení** |
| **Hlavní střecha (uliční)** | Sklon 36,2°, **bobrovka cihlová** na latě + kontralatě 50+40 mm, bednění 20 mm, pojistná hydroizolace, větraný hřeben, **plocha 154 m²**, délka hřebene 25,010 bm |
| **Vikýře (2 ks)** | 6 780 × 3 780 mm, plocha **2× 25,6 = 51,2 m²**, sklon 7°, **Lindab click falc tl. 1 mm**, čelní + boční zdi Porotherm T Profi tl. 440 mm, věnce + překlady, klempířská lemování, sněhové zábrany |
| **Skladba zateplení** | Min. izolace 180 mm mezi krokvemi + 80 mm mezi trámky 60×60, parozábrana, SDK podhled 50 + 12,5 mm + omítka Knauf + bílý nátěr (205,2 m² hl. střecha + vikýře) |
| **Okna** | 2× střešní okno O/002 + 4× velké fasádní okno vikýřů (2 ks v každém vikýři); demontáž 6 stávajících střešních oken |
| **Zařízení staveniště** | Fasádní lešení ~375 m² (pracovní výška ~12,5 m, délka 25 m), **stavební výtah GEDA 300 Z/ZP** (pronájem + doprava + montáž + revize + příslušenství) |
| **Vnitřní stavební úpravy** | Nová mezibytová stěna Porotherm AKU 200/250 mm, příčky Porotherm 20/25 cm, prostupy ve střední nosné zdi, SDK předstěny, suchá podlaha (OSB 20 + Fermacell voština 60 + min. izolace 20 + 2× 12,5 Fermacell 2E35 + 25 mm), dlažba 15 mm / plovoucí podlaha |

## Navigace

```
BD_Daliborova_strecha/
├── README.md                                         ← tento soubor
│
├── inputs/                                            ← zdrojová dokumentace
│   ├── tz/
│   │   └── D.1.1_architektonicko_stavebni_cast.pdf    17 s. — hlavní TZ
│   ├── vykresy_pdf/                                   ZATÍM PRÁZDNÉ (čeká se na PD)
│   ├── vykresy_dxf/                                   ZATÍM PRÁZDNÉ
│   ├── chatgpt_draft/
│   │   └── vykaz_strecha_vikire_prace_materialy_GEDA_vikyr_detail.xlsx
│   │       └── 5 listů: Souhrn / Výkaz prací (74 řád.) / Vikýř detail / Skladby / Poznámky a rizika
│   │       └── PŘEDBĚŽNÝ výkaz, předzpracoval ChatGPT — nutno auditovat proti TZ
│   └── meta/
│       └── project_header.json                        confidence-tagged facts (Phase 0a baseline)
│
├── outputs/                                           ← generated artefacts (zatím prázdné)
├── handoff/                                           ← session continuity (zatím prázdné)
└── deliverables/                                      ← co jde klientovi (zatím prázdné)
```

## Co chybí (před Phase 0a Completeness Audit)

Per CLAUDE.md **Pattern 17** (Phase 0a Completeness Audit MANDATORY před Phase 1
generování položek):

1. **Statika** — TZ se opakovaně odvolává na statika („dle statiky"):
   krokve, profily 2× U100 + 2× U120, kotvení, zesílení trámů 180/200 příložkou.
   Bez statického výkresu **nelze zafixovat** dřevařské + ocelové výkazy.
2. **Výpis výplní otvorů (O/002 + 4 velká okna vikýřů)** — rozměry a materiál
   nejsou z TZ čitelné.
3. **PBŘ (požárně bezpečnostní řešení)** — TZ řeší SDK podhledy + příčky
   „dle PBŘ" bez specifikace typu desek a požární odolnosti.
4. **Výkresy** (D.1.1.2 půdorysy + řezy + pohledy + skladby) — v TZ jsou
   reference na výřezy, ale dodaný PDF obsahuje **pouze textovou TZ + ilustrační
   řez/pohled**. Výkresová část v dodávce chybí.
5. **D.1.4 TZB** (kanalizace, vodovod, vytápění, elektro pro 2 nové byty) —
   předmět ChatGPT výkazu **neobsahuje TZB**, jen stavební + klempířské + okna.
6. **Položka „atiková nadezdívka 25,01 bm"** — TZ říká „atika bude snesena",
   ChatGPT to oceňuje bm; chybí výška/profil.

## Kdo si přečte co

| Role | Číst v pořadí |
|---|---|
| **Alexander** | tento README → `inputs/chatgpt_draft/*.xlsx` (auditovat) → `inputs/tz/D.1.1_*.pdf` |
| **Claude Code (další session)** | tento README → `inputs/meta/project_header.json` → `inputs/tz/D.1.1_*.pdf` (Read po stránkách) → křížová kontrola s ChatGPT draftem |

## Zdroje

- **TZ:** `inputs/tz/D.1.1_architektonicko_stavebni_cast.pdf` (17 stran, 2.4 MB)
- **ChatGPT předběžný výkaz:** `inputs/chatgpt_draft/vykaz_strecha_vikire_prace_materialy_GEDA_vikyr_detail.xlsx`
  (74 řádků výkazu + skladby + rizika; **NEní soupis prací — je to brainstorm**)
