# ABMV e-mail draft — Hala HK (akce 212)

**STATUS:** připraveno k odeslání **po Phase 1 cross-check** (nemusí přibyt další nesoulady)

**Adresáti:**
- To: volkajakub@basepoint.cz (Ing. arch. Jakub Volka)
- Cc: TBD — Ing. Jiří Plachý (statika); Bc. Martin Doležal (+420 606 287 393)

**Předmět:** Hala Hradec Králové (akce 212) — žádost o vyjasnění před zpracováním výkazu výměr a rozpočtu

---

## Verze A — formální (12 bodů, plný rozsah)

Vážený pane inženýre arch. Volko,
vážený pane inženýre Plachý,

při přípravě výkazu výměr a rozpočtu pro stavbu „Hala Hradec Králové" (akce 212, par. č. 1939/1, k.ú. Slezské předměstí) jsme při křížové analýze dokumentace narazili na několik míst, která vyžadují vaše potvrzení či upřesnění. Žádáme vás laskavě o vyjádření k následujícím bodům:

── KRITICKÉ (ovlivňují dimenzování instalací) ──

**1) ENERGETICKÁ BILANCE VS. TECHNOLOGIE**
TZ B (§3.1 Elektroinstalace) uvádí P_inst = 83 kW, výpočtový příkon 60,5 kW, hlavní jistič 3×100 A, přívodní kabel CYKY-J 5×35 mm². Výkres A106 (Půdorys 1NP — stroje) však ukazuje pracoviště s technologií (DRIFT_E1, DEFRAME, filtrační jednotka) s údajem „příkon stroje cca 80 kW" na jeden stroj. Pokud jsou obě technologie provozovány současně, předpokládaný výpočtový příkon objektu přesahuje 140 kW a navržený jistič 3×100 A i přívodní kabel jsou nedostatečné.
→ Prosíme o potvrzení režimu provozu technologií (současný / střídavý) a, popřípadě, o aktualizaci energetické bilance v TZ B.

**2) TECHNOLOGICKÁ SPECIFIKACE STROJŮ**
Výkresy A106 a A107 zobrazují pracoviště DRIFT_E1 a DEFRAME vč. kotvících bodů, technická zpráva je však nepopisuje. Pro správný návrh položek (kotvení v podlaze, lokální výztuž desky, přívody médií, bezpečnostní oplocení) potřebujeme:
- výrobce a typ strojů (DRIFT, DEFRAME, filtrační jednotka),
- hmotnost a požadované kotvy (M16 / M20 / chemkotva atd.),
- spotřebu médií (stlačený vzduch, voda, odtažený vzduch),
- zda dodávku strojů zajišťuje investor (vynětí z rozpočtu stavby).

V DXF výkresu A104 jsme nalezli externí referenci na dokument „2966-1 návrh dispozice strojů HK". Pokud by bylo možné tento dokument poskytnout, vyřešilo by se mnoho otevřených bodů najednou.

**3) BEZPEČNOSTNÍ OPLOCENÍ**
Výkres A106 uvádí „BEZPEČNOSTNÍ OPLOCENÍ — BUDE UPŘESNĚNO". Pro zavedení do rozpočtu potřebujeme typ (rozebíratelné pletivo, systémové ploty Troax / Axelent / Brück), výšku, délku a umístění.

── ROZDÍLY MEZI ČÁSTMI DOKUMENTACE ──

**4) STUPEŇ DOKUMENTACE**
Titulky TZ A a TZ B (architektura, Basepoint) uvádějí „DPS", výkresová část ARS a TZ D.1.1 uvádějí „DPZ", TZ statiky (D.1.2, Plachý — značka 6/2025) uvádí „DSP". Předpokládáme, že jde o překlep v hlavičkách TZ A/B (reálne ARS = DPZ, statika = DSP). Prosíme o potvrzení sjednocení.

**5) TŘÍDA BETONU ZÁKLADOVÉ DESKY**
Legenda výkresu A101 uvádí pro základovou desku C30/37-XC2. TZ B (statický posudek) i TZ D.1.2 statiky uvádějí C25/30 XC4. Předpokládáme, že platí varianta statika — C25/30 XC4 — a legenda A101 obsahuje chybu. Prosíme o potvrzení.

**6) POŽÁRNÍ ODOLNOST OBVODOVÉHO PLÁŠTĚ**
TZ B (str. 4) uvádí „EW 15 DP3", leg. A101 uvádí „EW 15 DP1", PBŘ (č. 2025/60-034) potvrzuje DP1. Předpokládáme platnost DP1 dle PBŘ. Prosíme o potvrzení.

**7) ŠÍŘKA VRAT**
TZ B (§B.3.5) a TZ D.1.1 uvádějí 4× sekční vrata 3500×4000 mm. DXF výkresu A101 však obsahuje bloky „M_Vrata_výsuvná_sekční — 3000×4000 mm" (šířka 3000, ne 3500). Prosíme o určení platného rozměru.

**13) MATERIÁL KINGSPAN PANELŮ**
Výkres A102 uvádí dvě alternativy: „KS FR/FF K-roc 150 mm" (s minerální vatou, DP1) a „IPN KS NF/RW 120/160 mm" (s PIR pěnou, DP3). PBŘ však vyžaduje DP1. Předpokládáme tedy platnost varianty K-roc. Prosíme o potvrzení.

── TECHNICKO-EKONOMICKÉ ATRIBUTY ──

**8) NEKONZISTENTNÍ PLOCHY A KUBATURA**
Mezi dokumenty se rozcházejí plošné údaje:
- zastavěná plocha: A = 540,10 m² ; B = 520 m² ; D.1.1 = 541 m²,
- podlahová plocha: A = 495 m² ; B = 507 m² ; D.1.1 = 495 m²,
- obestavěný prostor: A = 3 694,62 m³ ; B = 2 833 m³ ; D.1.1 = 3 404 m³.

Prosíme o jednu finální verzi TEA pro rozpočet.

── UPŘESNĚNÍ MATERIÁLU A SKLADEB ──

**9) TYP PODLAHY**
TZ B i tabulka místností A101 uvádějí „stěrka". S ohledem na zatížení ≥ 1600 kg/m² a technologii v hale předpokládáme epoxidovou nebo polyuretanovou stěrku, nikoliv pouze finalizační cementovou. Prosíme o specifikaci systému (název produktu, tloušťka, povrchová úprava — protiskluz, anti-static, chemická odolnost).

**10) UMYVADLO V HALE — ZTI VNITŘNÍ**
Výkres A101 obsahuje blok „Umyvadlo 50×40 cm". TZ B však v §B.3.1 uvádí, že zázemí (soc. zařízení) je v sousední hale. Bude v této hale instalováno umyvadlo s přívodem studené vody a napojením na splaškovou kanalizaci? Pokud ano, prosíme o doplnění výkresů ZTI.

── CHYBĚJÍCÍ PODKLADY ──

**11) INŽENÝRSKO-GEOLOGICKÝ PRŮZKUM (IGP)**
TZ D.1.1 a TZ D.1.2 uvazují s eventuální výměnou atypického základu za pilotu Ø 800 / délka 8,0 m podle výsledků IGP. Kdy lze očekávat závěrečnou zprávu IGP?

**12) DOKUMENTACE TZB (VZT, ÚT, EL, ZTI)**
Profesní TZB části jsou popsány pouze v TZ B koncepčně. Budou samostatné části D.1.4 vč. výkresů a tabulek? Pokud ano, kdy budou dodány?

── DROBNÉ ──

**14) POČET SVODŮ DEŠŤOVÉ VODY**
TZ B uvádí 4 svody DN100. Výkresy A101 + A105 zobrazují 3 svody Lindab Round Downpipe 150/100 + 3 Wavin Tegra střešní vpusti.

**15) KRAJNÍ VAZNICE**
TZ B uvádí profil UPE 160. DXF A104 zobrazuje C150×19,3.

────────────────────

Pro hladké pokračování prací na rozpočtu bychom uvítali vaše vyjádření do 5 pracovních dnů. Body 1–3, 7 a 13 považujeme za kritické, ostatní za důležité, ale ne blokující.

Děkujeme za součinnost a jsme k dispozici pro případné osobní nebo telefonické konzultace.

S pozdravem,
[Jméno]
STAVAGENT — příprava rozpočtů
[telefon] | [e-mail]

---

## Verze B — stručná (3 kritické + zbytek krátce)

[Stručná verze viz drift bodů 1-3 + krátký seznam zbytek — viz výše v Verzi A]
