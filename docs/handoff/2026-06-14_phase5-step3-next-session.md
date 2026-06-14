# Handoff — Fáze 5 Step 3 (NOVÁ SESSION, čerstvá hlava)

**Datum handoffu:** 2026-06-14
**Stav:** Step 1 + Step 2 smergovány do main. Step 3 čeká na novou session.
**Proč nová session:** Step 3 je NEJrizikovější krok Fáze 5 — maže pole z boevého
výpočtu + rozhoduje o léčbě degradace. Cena chyby mazání > additive kroků. Po dlouhém
maratonu (Fáze 1 + Step 1–2) si zaslouží čerstvý start.

---

## Jak začít Step 3 (postup)

1. **Mantra:** přečti steering docs + `docs/soul.md §9` (poslední 3 entries) +
   recon-mapu `docs/audits/calculator_field_map/2026-06-13_recon.md` (to je základ Step 3).
2. **Effort high/max**, adaptive thinking OFF.
3. **PRE-IMPLEMENTATION INTERVIEW (povinné, před kódem)** — viz otázky níže.
4. Implementace → STOP gate report → PR → **merge = Alexander** (calc/boevý PR).
5. **NEzačínat Step 3, dokud není potvrzeno, že Step 2 (#1357) je v main** — JE (06:35:57Z).

## Step 3 — scope (z master-plánu + recon-mapy)

Legacy/dead-field cleanup, problémy 3/4/5 recon-mapy:
- **Legacy tact pole polu-zapojená:** `tact_mode` (čte advisor), `num_tacts_override`
  (píše WizardHints, buildInput ignoruje → tichá ztráta), `has_dilatacni_spary`,
  `spara_spacing_m`, `tact_volume_m3_override`. → přivést k jednomu pathu nebo smazat.
- **Tři nekompatibilní mechanismy množnosti:** `num_identical_elements` ⊥
  `num_dilatation_sections` (mutex) + `manual_zabery` (schlapuje na count+max) →
  sjednotit přes „list elementů" ze Step 1.
- **Mrtvá/neodesílaná pole:** `price_crane_czk_shift`, `price_pump_czk_h` (sbírají se,
  nejdou do buildInput); `include_kridla`/`kridla_height_m` (display-only);
  `rebar_norm_kg_m3` (jen UI-derive); duplicitní length pole (geom length vs
  total_length_m — Step 2 je sjednotil POVEDENĚ, fyzické smazání duplu patří SEM).
- **Každé smazání = grep-důkaz mrtvosti + test na absenci tiché ztráty.**

## Step 3 — interview otázky (návrh, upřesní Alexander)

1. **Mazat fyzicky, nebo jen sjednotit chování?** Recon ukázal pole čtená jinde
   (advisor čte tact_mode). Mazat = riziko; varianta: deprecate + přesměrovat čtenáře.
2. **Degradace (konsolidovaný backlog item) — do Step 3 nebo samostatný Step 3.5?**
   Tři symptomy soft-degradace (podkladni rebar=0, mostovka bez height → MULTIFLEX,
   non-prismatic volume=0 crash). Léčit jako třídu: chybí povinný vstup ⇒ NEPOČÍTÁNO
   + přeskočit v agregaci (planProject už umí elements_uncalculated), ne spadnout.
3. **Pořadí mazání** — po jednom poli/PR (bezpečnější review/revert) nebo dávkou?

## Sквозní pravidla Fáze 5 (každý krok)

- production grep na latentní pády před merge; hermetic testy (bez AI/network);
- **goldeny KV+Žalmanov+normy drží** (regression guard); **parita one-element**
  (planProject ≡); MCP↔frontend parity (§4 mapy); verbatim CI na finálním HEAD;
- **security-review diffu** (krok maže/mění boevý vstup → review povinný);
- soul.md §9 post-merge; **ŽIVÁ kontrola na kalkulator.stavagent.cz po deploy** —
  netvrdit hotové, dokud neproběhne na webu.

## Exclusions (celá Fáze 5)

- NEimplementovat Patterns 51–55 (samostatný batch).
- NEsahat na labor-norms hodnoty, seam-projekce, scheduler-overlap dluh (220.5/307.8) —
  pokud krok narazí, STOP a dotaz.
- NEměnit katalog-routing (OTSKP/ÚRS).

## Otevřené hvosty napříč (mimo Step 3, ale živé)

- **LIVE check po deploy:** #1351 tz_facts flag ve Varování + Step 2 geometrie→objem/takty
  na kalkulator.stavagent.cz. PENDING — netvrdit hotové bez prohlídky na webu.
- Step 4 (TZ persistence v project.json) + Step 5 (studio) — po Step 3.
