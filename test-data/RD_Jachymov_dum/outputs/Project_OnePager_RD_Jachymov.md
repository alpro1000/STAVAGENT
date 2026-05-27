# RD Jáchymov Fibichova 733 — One-Pager

**Datum:** 2026-05-19  •  **Stupeň:** DSP  •  **Pro:** Karel Šmíd (zhotovitel CN) + Mgr. Jindřich Volný (investor)

---

## Investiční záměr

Přestavba řadového rodinného domu č.p. 733 v ulici Fibichova, Jáchymov (parc. st. 1022 + 1094/16). **Rekonstrukce + nástavba 3.NP + nový vstup do 1.PP ze zahrady + celodomovní zateplení ETICS + nový krov a krytina**. Architektura: SMASH architekti (Ing. arch. Smolka). Statika: TeAnau (Ing. Tvardík). PBŘ: TUSPO (Ing. Kirschbaum).

## Co se staví — 2 stavební objekty

**SO 260219 — Dům** (180 active položek): 1.PP sklep + 1.NP byt rodiče + 2.NP pokoje dětí + 3.NP nový byt v nástavbě. Obestavěný prostor 987 m³, podlahová plocha 219,3 m², výška 13 m. 25 místností, 16 oken, 3 koupelny, 3 bytové jednotky. Stávající přípojky (voda/kanal/elektro) ZACHOVÁNY, plyn zaslepen, nový zdroj tepla = tepelné čerpadlo + krb + sporáková kamna.

**SO 260217 — Sklad + parking + přístup. schodiště** (27 položek): zahradní sklad lichoběžník 6,35×3,34 m (21,2 m²) ze ZB tvarovek s prefa Herkul opěrnou zdí, parking délky 7 m krytý 7 ks IPE180 zastřešení, ocelové venkovní schodiště UPE200 ze zahrady.

## Hlavní cenové bloky (211 položek total (207 active, 4 deprecated audit-trail))

- **HSV (100):** Zemní 14 · Základy/ŽB 19 · Svislé 10 · Vodorovné 20 · Krov+střecha 16 · Bourání 15 · ETICS fasáda 6
- **PSV (84):** Izolace 5 · ZTI voda+sanit 16 · Vytápění 8 · Okna+dveře+klempíř 23 · Podlahy 8 · Omítky+výmalba+obklady 15 · Elektro M-21 7 · Detekce PSV-95 2
- **VRN (19):** Zařízení staveniště 4 · Doprava+odpad 5 · Geodet 2 · Průzkumy 2 · BOZP+pojištění+revize 5 · Společné 1

## Stav rozpočtu

✅ **Položky:** 211 (207 active, 4 deprecated audit-trail) — vše s explicit DXF nebo TZ source + audit trail.
✅ **Audit chain:** Phase 0a + 0b + Path C + audit v2 (10 sekcí) + quality pass (5 dim) — **0 critical + 0 important gaps**.
✅ **KROS-format Excel:** 301 derived items (URS_MATCHER 15 batches) ready pro Karla import.
⚠ **URS kódy:** 49 clear (16 %) · 130 review needed (43 %) · 122 manual lookup (41 %).
⚠ **Pricing:** J.cena empty — Karel vyplní v KROS systému. Cena celkem auto-formula `=qty × J.cena`.

## Co se musí ještě vyřešit (top 5)

1. 🟥 **Investor (Q1) — vybrat variantu rozpočtu:** agregovaný (A) / hybrid (C) / položkový (B). **Bez výběru nelze finalizovat CN.**
2. 🟥 **Investor (Q6) — vytápění detail:** konkrétní výrobce/kapacity TČ, sporáková kamna, krb, elektrokotel.
3. 🟥 **Investor (Q7) — elektro počty:** zásuvek, svítidel, příprava FVE. Bez toho elektro = paušál.
4. 🟧 **Statik (Q8) — výztuž bilance kg/m³** per ŽB prvek (bílá vana, věnec, deska, pasy).
5. 🟧 **Investor + zhotovitel (Q20) — URS verification:** 84 % položek potřebuje manual review v KROS catalog. Doporučeno: ~3-4 tis. Kč URS_MATCHER full service NEBO 5-8 % rezerva v ceně.

## Klíčové numerické fakty

| Údaj | Hodnota |
|---|--:|
| Místností (DXF tabulka) | 25 |
| Vnější obvod domu | 38,70 m |
| Oken (plast trojsklem) | 16 ks |
| Vnitřních dveří | ~15 ks |
| ETICS plocha | 277 m² |
| Klempířina celkem | 173,8 m |
| Demolice celkem | viz HSV-6 (15 položek) |
| Otevřené otázky | 17 ze 20 (3 resolved) |

## Deliverables (vše na branch `claude/rd-jachymov-phase-0b-foundation`)

- 📊 `Vykaz_vymer_RD_Jachymov_VSE_VARIANTY_2026-05-19.xlsx` — 9 sheets multi-view (investor + zhotovitel + projektant + statik)
- 📋 `Vykaz_vymer_RD_Jachymov_KROS_format_2026-05-19.xlsx` — 5 sheets KROS-style ready pro Karla
- 📝 `Otazky_pro_Karla_a_projektanty_2026-05-18.docx` — 20 otázek prioritized
- 🗂 `items_rd_jachymov_complete.json` — single source of truth (211 items)

**Stav:** Rozpočet je v stavu **ready for tender preparation** po vyřešení 3 P0 otázek (Q1 + Q6 + Q7) + URS verification (Q20).
