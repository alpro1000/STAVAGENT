# Skladby konstrukcí — NÁVRH + STÁVAJÍCÍ + BOURÁNÍ (canonical reference)

> **Status:** canonical source of truth pro skladby RD Jáchymov (dům 260219).
> **Origin:** projektant, dodáno uživatelem 2026-06-01. NÁVRH = čistý text (vision-first z výkresu, P39). STÁVAJÍCÍ + BOURÁNÍ = z OCR výkresů (diakritika normalizována na čitelnou češtinu — obsah/tloušťky zachovány doslovně, OCR diakritický šum opraven).
> **Princip (KLÍČOVÝ):** jedna skladba = **DVĚ skupiny prací, nemíchat**:
> - **STÁVAJÍCÍ vrstvy → BOURÁNÍ položky** (HSV-6 demolice: sejmutí / demontáž / otlučení)
> - **NÁVRH vrstvy → KONSTRUKČNÍ položky** (HSV/PSV nové)
> Položky se váží přes `realizuje_skladbu` + `_source="skladba S0X stávající|návrh"` (P29). Cross-check: `outputs/skladby_audit.md`.

Pořadí vrstev: zvenku → dovnitř (resp. shora → dolů).

---

# A) STÁVAJÍCÍ STAV (před rekonstrukcí) → podklad pro BOURÁNÍ

> Co je v domě teď. Vrstvy, které se odstraňují, generují **bourání** položku.

- **S01** obvodová stěna — vnitřní omítka 10–15 mm · zdivo smíšené cihla plná 450 mm · omítka břizolit 10–15 mm *(vnější)*
- **S02** společná stěna řadovky — vnitřní omítka 10–15 mm · zdivo cihla plná 300 mm · vnitřní omítka 10–15 mm
- **S03** suterénní stěna — vnitřní omítka 10–15 mm · zdivo cihla plná 600 mm · vnější keramický obklad 20 mm
- **S04** podlaha na terénu (suterén) — beton 100 mm · štěrkopískový podsyp 50 mm · rostlý terén
- **S05** podlaha na terénu (přízemí) — nášlapná vrstva (dlažba/koberec) 20 mm · betonový potěr 80 mm · rostlý terén
- **S06** strop klemba suterén/přízemí — nášlapná vrstva 20 mm · vyztužená betonová deska 50 mm · škvárový zásyp 80–180 mm · ocelové nosníky + klemba z cihel plných 150 mm · vnitřní omítka 10–15 mm
- **S07** strop trámový mezi patry — nášlapná vrstva 20 mm · prkenný záklop 20 mm · škvárový zásyp 85 mm · prkenný záklop na trámech 20 mm · stropní trámy 180 mm · prkenný záklop s rákosem a omítkou 35 mm · výmalba
- **S08** strop klemba mezi patry — nášlapná vrstva 20 mm · prkenný záklop 20 mm · škvárový zásyp 55 mm · cihelná klemba 150–250 mm · podhled z dřevěných palubek 15 mm
- **S09** strop mezi patrem a podkrovím — nosné trámy krovu (ve vzduchu s podporou) 20 mm · prkenný záklop 20 mm · škvárový zásyp 45 mm · prkenný záklop na trámech 20 mm · stropní trámy 180 mm · prkenný záklop s rákosem a omítkou 35 mm · výmalba
- **S10** šikmá střecha — plechová krytina · prkenný záklop 20 mm · krokve 160×100 mm · volná nezateplená půda

---

# B) BOURÁNÍ (odstranění stávajících vrstev)

> Co se demoluje. Téměř shodné s A) — odstraňované vrstvy.

- **S01** — výmalba · vnitřní omítka 10–15 mm · zdivo cihla 450 mm · omítka břizolit 10–15 mm
- **S02** — výmalba · vnitřní omítka 10–15 mm · zdivo cihla 300 mm · vnitřní omítka 10–15 mm
- **S03** — vnitřní omítka 10–15 mm · zdivo cihla 600 mm · vnější keramický obklad 20 mm
- **S04** — beton 100 mm · štěrkopískový podsyp 50 mm · rostlý terén
- **S05** — nášlapná vrstva (dlažba/koberec) 20 mm · betonový potěr 80 mm · rostlý terén
- **S06** — nášlapná vrstva 20 mm · vyztužená betonová deska 50 mm · škvárový zásyp 80–180 mm · ocelové nosníky + klemba 150 mm · vnitřní omítka 10–15 mm
- **S07** — nášlapná vrstva 20 mm · prkenný záklop 20 mm · škvárový zásyp 85 mm · prkenný záklop na trámech 20 mm · stropní trámy 180 mm · prkenný záklop s rákosem a omítkou 35 mm · výmalba
- **S08** — nášlapná vrstva 20 mm · prkenný záklop 20 mm · škvárový zásyp 55 mm · cihelná klemba 150–250 mm · podhled z dřevěných palubek 15 mm
- **S09** — nosné trámy krovu 20 mm · prkenný záklop 20 mm · škvárový zásyp 45 mm · prkenný záklop na trámech 20 mm · stropní trámy 180 mm · prkenný záklop s rákosem a omítkou 35 mm · výmalba
- **S10** — plechová krytina · prkenný záklop 20 mm · krokve 160×100 mm

---

# C) NÁVRH (nové práce) → KONSTRUKČNÍ položky

## S01 — obvodová stěna + ETICS
- povrch dle tabulky místností (výmalba, obklad)
- vnitřní omítka 10–15 mm
- zdivo smíšené, cihla plná (keramická) **450 mm** *(stávající)*
- omítka — břizolit 10–15 mm *(stávající vnější)*
- **ETICS:** penetrační nátěr · lepící hmota ~10 mm · EPS grey (λ=0,032) mech. kotvené **160 mm** · lepící stěrka s výztuží ~5 mm · penetrační nátěr · tenkovrstvá probarvená silikonová omítka 2 mm

## S02 — společná stěna řadovky
- výmalba · vnitřní omítka 10–15 mm · zdivo cihla plná **300 mm** *(stávající)* · vnitřní omítka 10–15 mm

## S03 — suterénní stěna + sanační zateplení
- vnitřní omítka 10–15 mm · zdivo cihla plná **600 mm** *(stávající)*
- **sanační zateplení soklu:** lepící tmel (Lepstyr plus) · sanační izolační deska (Styrcon 200) · armovací vrstva + tkanina + penetrace
- **S03a** = pod úrovní terénu: drenážní vrstva — nopová folie 20 mm
- **S03b** = nad úrovní terénu: provětrávaná mezera s kotevním roštem 40 mm + keramický obklad 20 mm

## S04 — podlaha na terénu (suterén)
- epoxidová stěrka · penetrace podkladu · beton **100 mm** · štěrkopískový podsyp 50 mm · rostlý terén

## S05 — podlaha na terénu (přízemí)
- nášlapná vrstva dle tabulky 15 mm · samonivelační stěrka ~5 mm · betonový potěr vyztužený kari 150/150/6 **50 mm** · tep. izolace podlahový EPS 150 (λ=0,035) **120 mm** · hydroizolační pás z modif. asfaltu 4 mm · asfaltová penetrace · betonová deska vyztužená **120 mm** · zhutněné štěrkové lože (vč. odvětrání radonu) 150 mm · zhutněný terén

## S06 — strop klemba suterén/přízemí
- nášlapná vrstva 20 mm · hustá perlitbetonová plastická hmota TB2 50 mm · zásyp perlitbeton TB1 (λ=0,040) 80–180 mm · ocelové nosníky + klemba z cihel plných **150 mm** *(stávající)* · vnitřní omítka 10–15 mm · výmalba

## S07 — strop trámový mezi patry (1.NP/2.NP)
- nášlapná vrstva 20 mm · roznášecí sádrovláknité dílce (Fermacell 2E22) 25 mm · desky kročejové izolace (Isover T-P) **30 mm** · vyrovnávací suchý podsyp keramzit/liapor 50 mm · separační geotextilie · prkenný záklop na trámech 20 mm *(stávající)* · stropní trámy **180 mm** *(stávající)* · vložená izolace minerální vata 100–180 mm · SDK požární podhled RE 30 DP2 80 mm · výmalba

## S08 — strop klemba mezi patry  ⚠️ (VERIFY — viz audit)
- nášlapná vrstva 20 mm · roznášecí sádrovláknité dílce (Fermacell 2E22) 25 mm · desky kročejové izolace (Isover T-P) 30 mm · vyrovnávací suchý podsyp keramzit/liapor + dřevěný rošt 50 mm · separační vrstva · cihelná klemba **150 mm** *(stávající)* · výmalba

## S09 — strop mezi patrem a podkrovím (2.NP/3.NP, ocelobeton)
- nivelace + nášlapná vrstva 40 mm · betonová mazanina s kari sítí 60 mm · kročejová izolace EPS **40 mm** · zmonolitnění košického plechu 60 mm · košický plech s trny 40 mm · ocelové nosníky/stropnice (dle statiky) 180/200 mm · prostor vyplněný tep. izol. minerální vatou 180/200 mm · SDK požární podhled RE 30 DP2 60 mm · výmalba

## S10 — šikmá střecha
- hliníková falcovaná krytina pásy ~500 mm · pojistná hydroizolační folie pod krytinu · celoplošné bednění prkna 25 mm · distanční kontralať 60×40 mm + vzduch. mezera 40 mm · doplňková hydroizolace 2 mm (Topdek cover pro) · tep. izolace PIR **160 mm** s hliník. vložkou (λ=0,022) · parotěsnící vrstva 2 mm (Topdek AL barrier) · obkladová palubka 20 mm · krokve **180 mm**

## S11 — lehký strop vloženého mezipatra
- dřevěná biodeska osazená pružně na kleštiny

## S12 — obvodová stěna podkroví
- povrch dle tabulky (výmalba, obklad) · vnitřní omítka sádrová stříkaná 10–15 mm · zdivo keramická děrovaná broušená cihla **300 mm**

### S12a — fasáda omítka (ETICS)
- penetrační nátěr · lepící hmota ~10 mm · EPS grey (λ=0,032) mech. kotvené **160 mm** · lepící stěrka s výztuží ~5 mm · penetrační nátěr · tenkovrstvá probarvená silikonová omítka 2 mm

### S12b — fasáda falcovaný plech (provětrávaná)
- fasádní minerální izolace (λ=0,035) + kotvy fasády **180 mm** · paropropustná fasádní folie s UV odolností · svislý nosný rastr 40×60 mm + ochranný nátěr + provětrávaná vzduch. mezera 40 mm · celoplošné bednění prkna 25 mm · *(+ falcovaný hliníkový plech)*

---

## Poznámky 2.01–2.05 (z výkresů — nové práce / průzkumy)
- **2.01** nový vstup do domu přes mezipodestu schodiště — lehká ocelová konstrukce přisazená k domu
- **2.02** opěrná stěna z betonu jako bílá vana, za stěnou drenáž a odvod vody
- **2.03** posílení stropu/podlahy osazením nové stropnice — viz statika
- **2.04** ŽB ztužující věnec — viz statika
- **2.05** stávající trámové stropy — před zahájením akce a po rozkrytí konstrukcí proveden stavební mykologický průzkum + průzkum výskytu dřevokazného hmyzu (vyloučení narušení dřevěných konstrukcí)
