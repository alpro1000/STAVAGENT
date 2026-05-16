# RD Jáchymov Fibichova 733 — STAVAGENT pilot

**Status:** Phase 0a (chat extraction) — 2026-05-16
**Next:** Phase 0b (Claude Code validation) → Phase 1 (generator) → Phase 2 (Excel)
**Pattern:** hk212-style (TZ + výkresy bez tabulek)

## Quick orientation

Tato složka je kanonický STAVAGENT projekt-folder pro nový sideline freelance kontrakt přivezený Karlem Šmídem. Investor Mgr. Jindřich Volný žije v Německu, realizace 2026–2027. Dva stavební objekty: rekonstrukce + nástavba RD a zahradní sklad + parking ve svahu.

## Navigace

```
RD_Jachymov_dum/
├── README.md                       ← tento soubor
│
├── inputs/                         ← zdrojová dokumentace (read-mostly)
│   ├── tz/
│   │   ├── common/                 1 PDF — souhrnná TZ B
│   │   ├── 260219_dum/             3 PDF — ARS + statika + PBŘ pro dům
│   │   └── 260217_sklad/           2 PDF — ARS + statika pro sklad+parking
│   │
│   ├── vykresy_pdf/                ZATÍM PRÁZDNÉ
│   ├── vykresy_dxf/                ZATÍM PRÁZDNÉ
│   ├── situace/                    ZATÍM PRÁZDNÉ
│   │
│   └── meta/                       ← extrakční artefakty
│       ├── project_header.json     280+ řádků, confidence-tagged facts
│       ├── inventory.md            co máme, co chybí
│       ├── stupne_dokumentace.md   DSP only, no DPS planned
│       └── vyjasneni_queue.json    12 ABMV items pro projektanta
│
├── outputs/                        ← generated artefacts
│   └── work_candidates_skeleton.json  caркас rozpočtu po kapitolách
│
├── handoff/                        ← session-to-session continuity
│   └── STAVAGENT_Chat_Handoff_2026-05-16.md
│
└── deliverables/                   ← co jde klientovi
    └── CN_draft_3_varianty_pro_Karela.md
```

## Kdo si přečte co

| Role | Číst v pořadí |
|---|---|
| **Alexander (Karlovi)** | `deliverables/CN_draft_3_varianty_pro_Karela.md` — kopírovat verzi A, upravit dle hlavy, odeslat |
| **Claude Code (Phase 0b)** | `handoff/STAVAGENT_Chat_Handoff_2026-05-16.md` celé → pak `inputs/meta/` všechny soubory → pak `outputs/work_candidates_skeleton.json` |
| **Reviewer (auditor)** | `inputs/meta/project_header.json` — všechna fakta s confidence ladder |

## Klíčová čísla na první pohled

- **Investiční hodnota odhadem:** 6–8,5 mil. Kč bez DPH
- **Dům:** 104,4 m² zast. plochy, 219,3 m² podlah. plochy, 987 m³ obest. prostoru, 13 m výška, 1.PP + 3 NP
- **Sklad+parking:** lichoběžník 6,35×3,34 m, parkovací stání délky 7,0 m
- **Termín realizace:** 2026–2027
- **Sněhová oblast:** VII. (Krušnohoří — nejvyšší v ČR)
- **Geologie:** svor R5-R6 / F4-CS, Rdt 300–350 kPa, XA1, vrtaná archivní (IGP neproveden)
- **Status SU:** sklad podáno 17.02.2026 / dům podáno 23.03.2026 — obě čekají

## Klíčové technologické riziko

**Bílá vana** (ČBS 02) pro úhlovou opěrnou stěnu v zahradě domu — třída A1, vodní sloupec W0, Kon 1, C25/30 XC3+XF1+XA1, výška 2050 mm, smršťovací úsek max 8,0 m. Vyžaduje:
- Bobtnavé pásky bentonit nebo těsnící plech pro pracovní spáry
- Bednící a těsnící křížový plech pro svislé spáry střídaných záběrů
- Separační fólie pod základ
- Trhliny max. 0,20 mm

Toto je první real-world aplikace bílé vany v STAVAGENT korpusu — využít pro corpus rozšíření a kalibrace 7-engine kalkulátoru pro tuto kategorii konstrukce.

## Klíčové scope omezení

PD je v stupni DSP. Architekt SMASH explicitně v emailu uvádí že prováděcí PD na stavařinu ani profese dělat nebude. Z toho:
- Položkový rozpočet ÚRS lze sestavit jen s indikativními výměrami u PSV/TZB
- Plnohodnotný rozpočet z DPS není možný (a investor o něj nestojí)
- Agregovaný rozpočet z DSP je doporučená varianta (i podle samotného architekta)

## Související odkazy do STAVAGENT corpus

- **Playbook:** `STAVAGENT_Drawings_to_VV_Rozpocet_Playbook.md` v1.0 — adaptovaný hk212-style pattern
- **Předchozí pilot:** `hk212_hala` (skladová hala SOLAR DISPOREC) — N=4 reálný projekt
- **Knowledge:** `B5_tech_cards/walls_bila_vana/` — pro normativní hodnoty bílé vany
- **Productivity:** `B4_productivity/rebar_norms/` — pro empirické sazby výztuže
