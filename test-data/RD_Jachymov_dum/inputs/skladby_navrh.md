# Skladby konstrukcí — NÁVRH (canonical reference)

> **Status:** canonical source of truth pro skladby RD Jáchymov (dům 260219).
> **Origin:** projektant návrh, dodáno uživatelem 2026-06-01 (vision-first čteno z výkresu — Pattern 39).
> **Použití:** položky v `items_rd_jachymov_complete.json` se na tyto skladby vážou přes pole `realizuje_skladbu` + `_source="skladba S0X"` (Pattern 29). Při změně tloušťky/λ zde → re-audit položek (Pattern 41 montáž/materiál split per vrstva).
> Cross-check stav: viz `outputs/skladby_audit.md`.

Pořadí vrstev: zvenku → dovnitř (resp. shora → dolů u vodorovných).

---

## S01 — obvodová stěna (uliční/dvorní, hlavní objem)
- povrch dle tabulky místností (výmalba, obklad)
- vnitřní omítka 10–15 mm
- zdivo (dle legendy materiálů) — smíšené zdivo, cihla plná (keramická) **450 mm**
- omítka — břizolit 10–15 mm *(původní vnější)*
- **kontaktní zateplovací systém ETICS:**
  - penetrační nátěr
  - lepící hmota cca 10 mm
  - EPS grey (λ=0,032 W/mK), mechanicky kotvené **160 mm**
  - lepící stěrka s výztuží cca 5 mm
  - penetrační nátěr
  - tenkovrstvá probarvená **silikonová** omítka 2 mm

## S02 — obvodová stěna, společná stěna řadového domu
- výmalba
- vnitřní omítka 10–15 mm
- zdivo (dle legendy) — smíšené zdivo, cihla plná (keramická) **300 mm**
- vnitřní omítka 10–15 mm

## S03 — suterénní stěna
- vnitřní omítka 10–15 mm
- zdivo (dle legendy) — smíšené zdivo, cihla plná (keramická) **600 mm**
- **sanační zateplení soklu:**
  - lepící tmel (př. Lepstyr plus)
  - sanační izolační deska (př. Styrcon 200)
  - armovací vrstva, tkanina, penetrace
- **S03a = pod úrovní terénu:** drenážní vrstva — nopová folie 20 mm
- **S03b = nad úrovní terénu:** provětrávaná mezera s kotevním roštem 40 mm + keramický obklad 20 mm

## S04 — podlaha na terénu (v suterénu)
- epoxidová stěrka
- penetrace podkladu
- beton **100 mm**
- štěrkopískový podsyp 50 mm
- rostlý terén / zemina

## S05 — podlaha na terénu (v přízemí, 1.NP)
- nášlapná vrstva podlahy dle tabulky místností 15 mm
- samonivelační stěrka cca 5 mm
- betonový potěr, vyztužený kari sítí 150/150/6 — **50 mm**
- tepelná izolace podlahový EPS 150 (λ=0,035 W/mK) — **120 mm**
- hydroizolační pás z modif. asfaltu 4 mm
- asfaltová penetrace
- betonová deska, vyztužená — **120 mm**
- zhutněné štěrkové lože (včetně odvětrání radonu) 150 mm
- zhutněný terén

## S06 — strop, klemba mezi suterénem a přízemím (1.PP/1.NP)
- nášlapná vrstva 20 mm
- hustá perlitbetonová plastická hmota TB2 — 50 mm
- zásyp perlitbetonovou směsí TB1 (λ=0,040 W/mK) — 80–180 mm
- ocelové nosníky + klemba z cihel plných — 150 mm
- vnitřní omítka 10–15 mm
- výmalba

## S07 — strop, trámový strop mezi patry (1.NP/2.NP)
- nášlapná vrstva 20 mm
- roznášecí vrstva — sádrovláknité podlahové dílce (př. Fermacell 2E22) 25 mm
- desky kročejové izolace (př. Isover T-P) **30 mm**
- vyrovnávací a zátěžová vrstva — suchý podsyp keramzit / liapor zásyp 50 mm
- separační geotextilie
- prkenný záklop na trámech 20 mm
- stropní trámy 180 mm
- vložená izolace z minerální vaty 100–180 mm
- SDK požární podhled s odolností min. RE 30 DP2 — 80 mm
- výmalba

## S08 — strop, klemba mezi patry
- nášlapná vrstva 20 mm
- roznášecí vrstva — sádrovláknité podlahové dílce (př. Fermacell 2E22) 25 mm
- desky kročejové izolace (př. Isover T-P) 30 mm
- vyrovnávací a zátěžová vrstva — suchý podsyp keramzit / liapor zásyp + dřevěný rošt 50 mm
- separační vrstva
- cihelná klemba **150 mm**
- výmalba

## S09 — strop, mezi patrem a podkrovím (2.NP/3.NP, ocelobeton)
- nivelace + nášlapná vrstva 40 mm
- betonová mazanina s kari sítí 60 mm
- kročejová izolace EPS **40 mm**
- zmonolitnění košického plechu 60 mm
- košický plech s trny 40 mm
- ocelové nosníky / stropnice (dle statiky) 180/200 mm
- prostor vyplněný tep. izol. minerální vatou 180/200 mm
- SDK požární podhled s odolností min. RE 30 DP2 — 60 mm
- výmalba

## S10 — šikmá střecha
- hliníková falcovaná krytina, pásy cca 500 mm
- pojistná hydroizolační folie pod hliníkovou krytinu
- celoplošné bednění — prkna 25 mm
- distanční kontralať (60×40 mm) + vzduch. mezera 40 mm
- doplňková hydroizolační vrstva 2 mm (př. Topdek cover pro)
- tepelná izolace PIR **160 mm** — PIR izolace s hliník. vložkou (λ=0,022 W/mK)
- parotěsnící vrstva (př. Topdek AL barrier) 2 mm
- obkladová palubka 20 mm
- krokve 180 mm

## S11 — lehký strop vloženého mezipatra
- dřevěná biodeska osazená pružně na kleštiny

## S12 — obvodová stěna, podkroví
- povrch dle tabulky místností (výmalba, obklad)
- vnitřní omítka sádrová stříkaná 10–15 mm
- zdivo (dle legendy) — keramická děrovaná broušená cihla **300 mm**

### S12a — fasáda omítka (ETICS)
- penetrační nátěr
- lepící hmota cca 10 mm
- EPS grey (λ=0,032 W/mK), mechanicky kotvené **160 mm**
- lepící stěrka s výztuží cca 5 mm
- penetrační nátěr
- tenkovrstvá probarvená silikonová omítka 2 mm

### S12b — fasáda falcovaný plech (provětrávaná)
- fasádní minerální izolace (λ=0,035 W/mK) + kotvy fasády **180 mm**
- paropropustná fasádní folie s UV odolností
- svislý nosný rastr 40×60 mm, ochranný nátěr (+ provětrávaná vzduch. mezera) 40 mm
- celoplošné bednění — prkna 25 mm
- *(+ falcovaný hliníkový plech — krycí vrstva)*
