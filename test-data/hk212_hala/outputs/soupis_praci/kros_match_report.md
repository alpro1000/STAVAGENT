# HK212 Soupis prací — KROS Match Report

**Phase B output** · 2026-05-24

## Summary
- **Total items:** 128
- **Tier 1 (KROS match conf ≥ 0.70):** 79 (61.7 %)
- **Tier 2 (custom položka):** 49 (38.3 %)

**Acceptance §8 gate:** target ≥ 60 % Tier 1 → ✅ MET (61.7 %)

## Per kapitola breakdown
| Kapitola | Tier 1 | Tier 2 | Total | Tier 1 % |
|---|---:|---:|---:|---:|
| HSV-1 | 21 | 7 | 28 | 75.0 |
| HSV-2 | 18 | 0 | 18 | 100.0 |
| HSV-3 | 6 | 8 | 14 | 42.9 |
| HSV-9 | 0 | 4 | 4 | 0.0 |
| PSV-71x | 4 | 0 | 4 | 100.0 |
| PSV-76x | 11 | 1 | 12 | 91.7 |
| PSV-77x | 6 | 0 | 6 | 100.0 |
| PSV-78x | 6 | 6 | 12 | 50.0 |
| PSV-OPL | 5 | 3 | 8 | 62.5 |
| VRN | 2 | 20 | 22 | 9.1 |

## Method distribution
| Method | Count |
|---|---:|
| fts_bm25_strong_mj_trida | 51 |
| fts_bm25_strong_no_mj | 36 |
| fts_bm25_medium_mj | 25 |
| fts_bm25_below_threshold | 11 |
| fts_bm25_medium_mj_trida | 3 |
| no_fts_hits | 2 |

## Detailed match per item
| ID | Kapitola | items.json popis (60 chars) | MJ | mn. | KROS code | KROS popis (50 chars) | Conf | Tier | Method |
|---|---|---|---|---:|---|---|---:|---:|---|
| HSV-1-001 | HSV-1 | Hloubení figury pod základovou desku + sejmutí navážek aktiv | m³ | 210.0 | 127401401 | Hloubení rýh pod vodou  v hloubce do 5 m pod proje | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-002 | HSV-1 | Hloubení dohloubek pro patky rámové, hor. tř. 3, do 1 m hlou | m³ | 31.5 | 127401401 | Hloubení rýh pod vodou  v hloubce do 5 m pod proje | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-003 | HSV-1 | Hloubení dohloubek pro patky štítové, hor. tř. 3, do 0.5 m h | m³ | 1.28 | 127401401 | Hloubení rýh pod vodou  v hloubce do 5 m pod proje | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-004 | HSV-1 | Hloubení atypického základu — varianta jako pilota Ø800 / L= | m³ | 12.0 | 153191111 | Zřízení atypického pažení výkopu svařovaným ocelov | 0.60 | 2 | fts_bm25_strong_no_mj |
| HSV-1-005 | HSV-1 | Hloubení rýh pro krátké pasy mezi patkami, hor. tř. 3, do 0. | m³ | 7.2 | 132201192 | Hloubení zapažených i nezapažených rýh šířky do 60 | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-006 | HSV-1 | Ruční výkop v ochranných pásmech stávajících sítí DN300, hor | m³ | 30.0 | 132101401 | Hloubená vykopávka pod základy ručně  s přehozením | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-007 | HSV-1 | Příplatek za stížené podmínky — ruční výkop u stávajících sí | m³ | 30.0 | 132101401 | Hloubená vykopávka pod základy ručně  s přehozením | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-008 | HSV-1 | Pažení výkopů hloubky nad 1.3 m — atypický základ | m² | 20.0 | 151721111 | Pažení do ocelových zápor  bez ohledu na druh paži | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-009 | HSV-1 | Obetonování stávajícího potrubí splaškové kanalizace DN300 b | m³ | 5.0 | 765125202 | Montáž střešních doplňků krytiny betonové  nástavc | 0.50 | 2 | fts_bm25_below_threshold |
| HSV-1-010 | HSV-1 | Obetonování stávajícího potrubí dešťové kanalizace DN300 bet | m³ | 5.0 | 721173315.OSM | Potrubí kanalizační plastové dešťové systém KG DN  | 0.50 | 2 | fts_bm25_below_threshold |
| HSV-1-011 | HSV-1 | Pomocné výkopy pro novou přípojku vodovod DN150 LT | m³ | 8.0 | 119003131 | Pomocné konstrukce při zabezpečení výkopu svislé v | 0.60 | 2 | fts_bm25_strong_no_mj |
| HSV-1-012 | HSV-1 | Pomocné výkopy pro novou areálovou kanalizaci DN200 | m³ | 49.2 | 119003131 | Pomocné konstrukce při zabezpečení výkopu svislé v | 0.60 | 2 | fts_bm25_strong_no_mj |
| HSV-1-013 | HSV-1 | Štěrkové lože pod základovou deskou, tl. 250 mm, frakce 0/63 | m³ | 123.75 | 212312111 | Lože pro trativody  z betonu prostého | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-1-014 | HSV-1 | Zhutnění podloží Edef,2 ≥ 45 MPa, Edef2/Ede < 1.75 | m² | 495.0 | 181951101 | Úprava pláně vyrovnáním výškových rozdílů  v horni | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-015 | HSV-1 | Zásyp výkopů kolem patek + okolo obetonovaných sítí, zhutněn | m³ | 30.0 | 174101101 | Zásyp sypaninou z jakékoliv horniny  s uložením vý | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-016 | HSV-1 | Nakládání zeminy hor. tř. 1-4 na dopravní prostředek | m³ | 350.0 | 139711101 | Vykopávka v uzavřených prostorách  s naložením výk | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-017 | HSV-1 | Vodorovné přemístění zeminy do 5000 m, sklon do 5 % | m³ | 350.0 | 162303111 | Vodorovné přemístění výkopku z rýh podzemních stěn | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-018 | HSV-1 | Odvoz výkopu na deponii / skládku — kontejnerová doprava | m³ | 350.0 | 119001211 | Zemina promísená s vápnem na deponii za účelem zle | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-019 | HSV-1 | Skládkovné — uložení vytěžené zeminy na řízené skládce | t | 630.0 | 171201211 | Poplatek za uložení stavebního odpadu na skládce ( | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-020 | HSV-1 | Kácení vzrostlých stromů Ø < 80 cm — bříza, dub červený | ks | 2.0 | 112101101 | Odstranění stromů s odřezáním kmene a s odvětvením | 0.80 | 1 | fts_bm25_medium_mj_trida |
| HSV-1-021 | HSV-1 | Kácení drobných dřevin a semenáčků — javor klen, dub letní | ks | 5.0 | 381124111 | Montáž drobných prefabrikovaných dílců s nesvařova | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-1-022 | HSV-1 | Frézování pařezů po kácení dřevin | ks | 7.0 | 162201421 | Vodorovné přemístění větví, kmenů nebo pařezů  s n | 0.80 | 1 | fts_bm25_medium_mj_trida |
| HSV-1-023 | HSV-1 | Odvoz dřevní hmoty po kácení a likvidace | m³ | 6.0 | 966011191 | Demontáž mobilních buněk odvoz se složením, na vzd | 0.50 | 2 | fts_bm25_below_threshold |
| HSV-1-024 | HSV-1 | Náhradní výsadba dřevin per rozhodnutí orgánu životního pros | ks | 2.0 | 766422221 | Montáž obložení podhledů  jednoduchých panely obkl | 0.50 | 2 | fts_bm25_below_threshold |
| HSV-1-025 | HSV-1 | Odstranění stávající asfaltové vrstvy + podkladu, tl. do 250 | m² | 540.0 | 113107112 | Odstranění podkladů nebo krytů ručně s přemístěním | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-1-026 | HSV-1 | Nakládání stavební suti na dopravní prostředek | t | 80.0 | 997002611 | Nakládání suti a vybouraných hmot na dopravní pros | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-1-027 | HSV-1 | Odvoz stavební suti k recyklaci — vč. skládkovného | t | 80.0 | 997013501 | Odvoz suti a vybouraných hmot na skládku nebo mezi | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-1-028 | HSV-1 | Výměna aktivní zóny pláně — odstranění navážek GT1 + nahraze | m³ | 265.61 | 171101111 | Uložení sypaniny do násypů  s rozprostřením sypani | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-2-001 | HSV-2 | Beton patek rámových C16/20 XC0 prostý, dvoustupňové | m³ | 22.875 | 311311971 | Nadzákladové zdi z betonu prostého nosné do ztrace | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-2-002 | HSV-2 | Bednění patek rámových dvoustupňových — zřízení | m² | 66.0 | 275351121 | Bednění základů patek zřízení | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-2-003 | HSV-2 | Bednění patek rámových dvoustupňových — odstranění | m² | 66.0 | 275351122 | Bednění základů patek odstranění | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-2-004 | HSV-2 | Beton patek štítových C16/20 XC0 prostý, dvoustupňové | m³ | 6.144 | 311311971 | Nadzákladové zdi z betonu prostého nosné do ztrace | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-2-005 | HSV-2 | Bednění patek štítových — zřízení | m² | 30.72 | 315351311 | Bednění nadzákladových zdí půdních, štítových rovn | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-2-006 | HSV-2 | Bednění patek štítových — odstranění | m² | 30.72 | 315351312 | Bednění nadzákladových zdí půdních, štítových rovn | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-2-007 | HSV-2 | Beton krátkých pasů v rozích a propojení mezi patkami C16/20 | m³ | 7.2 | 311311971 | Nadzákladové zdi z betonu prostého nosné do ztrace | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-2-008 | HSV-2 | Bednění pasů — zřízení | m² | 36.0 | 274351121 | Bednění základů pasů rovné zřízení | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-2-009 | HSV-2 | Výztuž patek a pasů ze svařovaných sítí + vázaná B500B | kg | 600.0 | 275362021 | Výztuž základů patek ze svařovaných sítí z drátů t | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-2-010 | HSV-2 | VARIANTA — pilota Ø800 / L=8 m C25/30 XC4 vrtná | ks | 1.0 | 765115352 | Montáž střešních doplňků krytiny keramické  stoupa | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-2-011 | HSV-2 | VARIANTA — vrtání piloty Ø800 do hor. tř. 3-4 | bm | 8.0 | 764212419 | Oplechování střešních prvků z pozinkovaného plechu | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-2-012 | HSV-2 | VARIANTA — výztuž piloty 8× R25 podélná + třmínky Ø10 á 200  | kg | 380.0 | 153272111 | Výztuž stříkaného betonu příčná a podélná  skalníc | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-2-013 | HSV-2 | Beton podlahové desky C25/30 XC4, tl. 200 mm — strojně rovna | m³ | 106.24 | 311311971 | Nadzákladové zdi z betonu prostého nosné do ztrace | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-2-014 | HSV-2 | Bednění obvodové desky — zřízení | bm | 95.0 | 763131713 | Podhled ze sádrokartonových desek  ostatní práce a | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-2-015 | HSV-2 | Výztuž desky KARI síť Ø8 oka 100×100 mm B500B — horní vrstva | kg | 2098.3 | 272362021 | Výztuž základů kleneb ze svařovaných sítí z drátů  | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-2-016 | HSV-2 | Výztuž desky KARI síť Ø8 oka 100×100 mm B500B — dolní vrstva | kg | 2098.3 | 272362021 | Výztuž základů kleneb ze svařovaných sítí z drátů  | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-2-017 | HSV-2 | Distanční podložky výztuže desky — plast / beton, krytí 30 m | ks | 2475.0 | 341941011 | Nosné tupé svary betonářské oceli do ocelové podlo | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-2-018 | HSV-2 | Hydroizolace plošná pod podlahovou desku — 1× SBS modifikova | m² | 495.0 | 451571111 | Lože pod dlažby ze štěrkopísků, tl. vrstvy do 100  | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-3-001 | HSV-3 | Specifikace + dodávka sloupy IPE 400 S235 jakost J0, EXC2 dl | kg | 10263.24 | 767649R01 | D+M Generální klíč - specifikace dle PD | 0.60 | 2 | fts_bm25_strong_no_mj |
| HSV-3-002 | HSV-3 | Specifikace + dodávka sloupy HEA 200 S235 jakost J0, štítové | kg | 1455.12 | 767649R01 | D+M Generální klíč - specifikace dle PD | 0.60 | 2 | fts_bm25_strong_no_mj |
| HSV-3-003 | HSV-3 | Specifikace + dodávka příčlí IPE 450 S235 s náběhem (sklon 5 | kg | 9474.96 | 767649R01 | D+M Generální klíč - specifikace dle PD | 0.60 | 2 | fts_bm25_strong_no_mj |
| HSV-3-004 | HSV-3 | Specifikace + dodávka vaznice IPE 160 S235 jakost J0 | kg | 5195.04 | 767649R01 | D+M Generální klíč - specifikace dle PD | 0.60 | 2 | fts_bm25_strong_no_mj |
| HSV-3-005 | HSV-3 | Specifikace + dodávka vaznice krajní UPE 160 S235 jakost J0 | kg | 1030.24 | 767649R01 | D+M Generální klíč - specifikace dle PD | 0.60 | 2 | fts_bm25_strong_no_mj |
| HSV-3-006 | HSV-3 | Specifikace + dodávka ztužidla stěnová L 70/70/6 S235 | kg | 327.68 | 767649R01 | D+M Generální klíč - specifikace dle PD | 0.60 | 2 | fts_bm25_strong_no_mj |
| HSV-3-007 | HSV-3 | Specifikace + dodávka ztužidla střešní z kruhových tyčí Ø20  | kg | 237.12 | 232211111 | Úprava ocelových jehel, pilot nebo zápor pro zaraž | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-3-008 | HSV-3 | Styčníkové plechy + spojovací materiál šroubový grade 8.8 —  | kg | 1450.0 | 411171121 | Montáž ocelové konstrukce podlah a plošin pokrytou | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-3-009 | HSV-3 | Kotvení sloupů ke patkám — chemická kotva M20 nebo zalité šr | ks | 176.0 | 331125001 | Montáž sloupů ze železobetonu do dutiny patky s vy | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-3-010 | HSV-3 | Montáž ocelové konstrukce — kompletní rámová hala, dle ČSN E | t | 28.0 | 411171121 | Montáž ocelové konstrukce podlah a plošin pokrytou | 0.75 | 1 | fts_bm25_medium_mj |
| HSV-3-011 | HSV-3 | Doprava ocelové konstrukce na stavbu (default 50 km) | t·km | 1400 | 997013113 | Vnitrostaveništní doprava suti a vybouraných hmot  | 0.50 | 2 | fts_bm25_below_threshold |
| HSV-3-012 | HSV-3 | Antikorozní nátěr 2-vrstvý dle ISO 12944, korozní katego­rie | m² | 850.0 | 783314201 | Základní antikorozní nátěr zámečnických konstrukcí | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-3-013 | HSV-3 | Protipožární nátěr — interiérové prvky R 15 DP1 | m² | 850.0 | 762361332R01 | Konstrukční vrstva pod klempířské prvky pro oplech | 0.85 | 1 | fts_bm25_strong_mj_trida |
| HSV-3-014 | HSV-3 | Revize ocelové konstrukce + protokol o předání, EXC2 ČSN EN  | paušál | 1.0 | 411171121 | Montáž ocelové konstrukce podlah a plošin pokrytou | 0.50 | 2 | fts_bm25_below_threshold |
| HSV-9-001 | HSV-9 | Přesun hmot HSV vodorovně — beton, výztuž, ocel, klempířina | t·km | 200.0 | 998006011 | Přesun hmot  pro vrty samostatné | 0.60 | 2 | fts_bm25_strong_no_mj |
| HSV-9-002 | HSV-9 | Pomocné lešení pro montáž ocelové konstrukce, výška do 6 m | m³ | 200.0 | 119003217 | Pomocné konstrukce při zabezpečení výkopu svislé o | 0.50 | 2 | fts_bm25_below_threshold |
| HSV-9-003 | HSV-9 | Demontáž pomocného lešení po dokončení montáže | m³ | 200.0 | 944511811 | Síť ochranná zavěšená na konstrukci lešení z texti | 0.60 | 2 | fts_bm25_strong_no_mj |
| HSV-9-004 | HSV-9 | Pomocné lešení pro montáž opláštění (Kingspan) a klempířiny  | m³ | 120.0 | 119002411 | Pomocné konstrukce při zabezpečení výkopu vodorovn | 0.50 | 2 | fts_bm25_below_threshold |
| PSV-71x-001 | PSV-71x | Penetrace soklu — penetrační nátěr pod hydroizolaci | m² | 28.5 | 622151031 | Penetrační nátěr vnějších pastovitých tenkovrstvýc | 0.75 | 1 | fts_bm25_medium_mj |
| PSV-71x-002 | PSV-71x | Hydroizolace svislá soklu — SBS modifikovaný asfaltový pás,  | m² | 28.5 | 711331383 | Provedení izolace mostovek pásy na sucho samolepíc | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-71x-003 | PSV-71x | Hydroizolační lišty rohové + napojení svislé na vodorovnou p | bm | 95.0 | 711491876 | Demontáž lišty pro přichycení izolace ukončovací | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-71x-004 | PSV-71x | Ochranná vrstva hydroizolace — nopová folie HDPE, š. 0.5 m | m² | 47.5 | 711161112 | Izolace proti zemní vlhkosti a beztlakové vodě nop | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-76x-001 | PSV-76x | Dodávka okno plastové 1000 × 1000 mm, izol. dvojsklo Ug ≤ 1. | ks | 21.0 | 766660201 | Montáž dveřních křídel dřevěných nebo plastových   | 0.80 | 1 | fts_bm25_medium_mj_trida |
| PSV-76x-002 | PSV-76x | Montáž okna plastového do osazovacího otvoru, vč. kotvení a  | ks | 21.0 | OV04 | Nerezový zvonek vč. kamery, čipového systému | 0.75 | 1 | fts_bm25_medium_mj |
| PSV-76x-003 | PSV-76x | Vnější parapet pozinkovaný plech, š. 200 mm, s krytkami | bm | 22.05 | 764011611.LND | Podkladní plech LINDAB FOP/PLX - plastizol rš 150  | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-76x-004 | PSV-76x | Vnější okenní lemy plastové — rohové + nadokenní | bm | 63.0 | 721173315.OSM | Potrubí kanalizační plastové dešťové systém KG DN  | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-76x-005 | PSV-76x | Dodávka sekční vrata 3500 × 4000 mm (š × v) s tepelněizolačn | ks | 4.0 | 763761201 | Montáž otvorových výplní  dvířek, poklopů, štítový | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-76x-006 | PSV-76x | Elektrický pohon vrat sekčních s dálkovým ovládáním + nouzov | ks | 4.0 | 767651113 | Montáž vrat garážových nebo průmyslových sekčních  | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-76x-007 | PSV-76x | Nouzové ruční odblokování vrat sekčních — pro výpadek el. | ks | 4.0 | 767651113 | Montáž vrat garážových nebo průmyslových sekčních  | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-76x-008 | PSV-76x | Montáž sekčních vrat — osazení do otvoru, ukotvení, nastaven | ks | 4.0 | 767651113 | Montáž vrat garážových nebo průmyslových sekčních  | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-76x-009 | PSV-76x | Dodávka vnější dvoukřídlé dveře 1050 × 2100 mm, izol. plnost | ks | 2.0 | 766681114 | Montáž zárubní dřevěných, plastových nebo z lamina | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-76x-010 | PSV-76x | Montáž vnějších 2-křídlých dveří — osazení, kotvení, pěna | ks | 2.0 | 761661011 | Osazení sklepních světlíků (anglických dvorků) vče | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-76x-011 | PSV-76x | Kompletní zámkový systém + klika pro vnější 2-křídlé dveře | kpl | 2.0 | 314235402 | Dvousložkový komínový systém jednoprůduchový cihel | 0.75 | 1 | fts_bm25_medium_mj |
| PSV-76x-012 | PSV-76x | Práh + lemování ostění vnějších dveří — pozink plech | kpl | 2.0 | OV07 | Plynová skříň HUP volně stojící, mat. pozink.plech | 0.50 | 2 | fts_bm25_below_threshold |
| PSV-77x-001 | PSV-77x | Penetrace + primer pod průmyslovou stěrku podlahy | m² | 495.0 | 771591207 | Izolace podlahy pod dlažbu montáž izolace nátěrem  | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-77x-002 | PSV-77x | Průmyslová epoxidová / PU stěrka podlahy tl. 4-5 mm, zatížen | m² | 495.0 | 763158122 | Podlaha ze sádrokartonových desek  ostatní práce a | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-77x-003 | PSV-77x | Lokální zesílení podlahy v anchorage zónách strojů — vyšší t | m² | 30.0 | 763151812 | Demontáž podlahy ze sádrokartonových desek  desek  | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-77x-004 | PSV-77x | Dilatační lišty podlahy — kovové, řezané spáry á 6 m | bm | 60.0 | 764001121 | Montáž dilatační lišty připojovací, rozvinuté šířk | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-77x-005 | PSV-77x | Lemovací úhelníky podlahy — pozink po obvodu stěrky | bm | 95.0 | 763111721 | Příčka ze sádrokartonových desek  ostatní konstruk | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-77x-006 | PSV-77x | Protiskluzový posyp křemičitým pískem — pro PU variantu | m² | 495.0 | 985121101 | Tryskání degradovaného betonu stěn, rubu kleneb a  | 0.75 | 1 | fts_bm25_medium_mj |
| PSV-78x-001 | PSV-78x | Dodávka Lindab Round Downpipe 150/100 Antique White, vč. kol | ks | 4.0 | 764011611.LND | Podkladní plech LINDAB FOP/PLX - plastizol rš 150  | 0.60 | 2 | fts_bm25_strong_no_mj |
| PSV-78x-002 | PSV-78x | Montáž svodů Lindab — příchytky, kotvení do fasády | kpl | 4.0 | 764508101 | Montáž svodu hranatého svodu | 0.60 | 2 | fts_bm25_strong_no_mj |
| PSV-78x-003 | PSV-78x | Wavin Tegra střešní vpust Round Iron Cover + Concrete Ring D | ks | 3.0 | 764203139 | Montáž oplechování střešních prvků střešní dilatac | 0.60 | 2 | fts_bm25_strong_no_mj |
| PSV-78x-004 | PSV-78x | Montáž střešních vpustí Wavin Tegra — osazení, napojení na s | ks | 3.0 | 761661011 | Osazení sklepních světlíků (anglických dvorků) vče | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-78x-005 | PSV-78x | MEA Mearin Plus 3000 NW300 liniový žlab — podél JZ a SZ fasá | bm | 30.0 | 713134111.CUR | Tepelná foukaná izolace celulózová vlákna CLIMATIZ | 0.60 | 2 | fts_bm25_strong_no_mj |
| PSV-78x-006 | PSV-78x | Mřížka MEA Mearin Plus 3000 + osazovací rám — pochozí proved | bm | 30.0 | 761614111 | Okna ze skleněných tvárnic  zděné rozměr 190 x 190 | 0.60 | 2 | fts_bm25_strong_no_mj |
| PSV-78x-007 | PSV-78x | Atikové oplechování titanzinek tl. 0.7 mm, rš 500 mm — po ob | bm | 95.0 | 713490812 | Odstranění tepelné izolace potrubí a ohybů – doplň | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-78x-008 | PSV-78x | Lemování úžlabí střechy titanzinek — diagonální linie | bm | 15.0 | 765191063 | Montáž pojistné hydroizolační fólie  úžlabí, střec | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-78x-009 | PSV-78x | Lemování nároží titanzinek — vertikální rohy fasády | bm | 25.2 | 765141142 | Montáž krytiny sklolaminátové  nároží nebo hřebene | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-78x-010 | PSV-78x | Krytí spár klempířských konstrukcí — silikonový tmel | bm | 120.0 | 764004861 | Demontáž klempířských konstrukcí svodu do suti | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-78x-011 | PSV-78x | Ostatní oplechování — parapety střešních vpustí, lemy prostu | bm | 25.0 | 764202105 | Montáž oplechování střešních prvků štítu závětrnou | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-78x-012 | PSV-78x | Doprava klempířiny + materiálu na stavbu — paušál | paušál | 1.0 | 997013113 | Vnitrostaveništní doprava suti a vybouraných hmot  | 0.50 | 2 | fts_bm25_below_threshold |
| VRN-001 | VRN | Zařízení staveniště — buňka kancelář stavbyvedoucího + techn | měsíc | 4 | 030001000 | Zařízení staveniště | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-002 | VRN | Zařízení staveniště — buňka sociální / šatna / WC | měsíc | 4 | 030001000 | Zařízení staveniště | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-003 | VRN | Zařízení staveniště — buňka sklad materiálu + nářadí | měsíc | 4 | 030001000 | Zařízení staveniště | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-004 | VRN | Oplocení staveniště — provizorní, výška 2 m, vstupní brána | bm | 150.0 | 119003217 | Pomocné konstrukce při zabezpečení výkopu svislé o | 0.85 | 1 | fts_bm25_strong_mj_trida |
| VRN-005 | VRN | Vodovodní přípojka pro stavbu — vytvoření + měření spotřeby | paušál | 1.0 | 765131611 | Montáž vláknocementové krytiny vlnité  sklonu přes | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-006 | VRN | Elektrická přípojka pro stavbu — staveništní rozvaděč + měře | paušál | 1.0 | — | — | 0.00 | 2 | no_fts_hits |
| VRN-007 | VRN | WC mobilní pro pracovníky — 2 ks | měsíc | 8 | 119003217 | Pomocné konstrukce při zabezpečení výkopu svislé o | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-008 | VRN | BOZP koordinace na stavbě — koordinátor BOZP průběžně | měsíc | 4 | 713392816 | Montáž izolace tepelné těles - doplňky a konstrukč | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-009 | VRN | Plán BOZP + dokumentace bezpečnosti práce | paušál | 1.0 | 013294000 | Ostatní dokumentace stavby | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-010 | VRN | Pojištění stavby + odpovědnostní pojistka | paušál | 1.0 | 013294000 | Ostatní dokumentace stavby | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-011 | VRN | Likvidace odpadů kategorie O (běžný) — kontejner + odvoz + s | m³ | 30.0 | 171201211 | Poplatek za uložení stavebního odpadu na skládce ( | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-012 | VRN | Likvidace odpadů kategorie N (nebezpečné — barvy, oleje, tme | m³ | 2.0 | 171201211 | Poplatek za uložení stavebního odpadu na skládce ( | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-013 | VRN | Doprava materiálu na stavbu vodorovně — paušál pro veškerou  | t·km | 1500.0 | 997013113 | Vnitrostaveništní doprava suti a vybouraných hmot  | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-014 | VRN | Geodetické zaměření před zahájením stavby — vytýčení | paušál | 1.0 | 783301401 | Příprava podkladu zámečnických konstrukcí před pro | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-015 | VRN | Geodetické zaměření skutečného provedení (DSPS) — po dokonče | paušál | 1.0 | 013254000 | Dokumentace skutečného provedení stavby | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-016 | VRN | Vyjádření správců sítí — komplet pro 8-12 sítí (RWE/CETIN/ČE | kpl | 1.0 | 272362021 | Výztuž základů kleneb ze svařovaných sítí z drátů  | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-017 | VRN | Vytýčení stávajících sítí na povrchu před zahájením výkopů | bm | 200.0 | 771161023 | Příprava podkladu před provedením dlažby montáž pr | 0.85 | 1 | fts_bm25_strong_mj_trida |
| VRN-018 | VRN | Předávací protokoly + dokumentace skutečného provedení (DSPS | paušál | 1.0 | 013254000 | Dokumentace skutečného provedení stavby | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-019 | VRN | Kolaudační řízení — příprava + účast na jednání + revize dok | paušál | 1.0 | 783301401 | Příprava podkladu zámečnických konstrukcí před pro | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-020 | VRN | Revize elektroinstalace + protokol | paušál | 1.0 | — | — | 0.00 | 2 | no_fts_hits |
| VRN-021 | VRN | Revize hydrantového systému + tlaková zkouška | paušál | 1.0 | 155213511 | Trny z oceli prováděné horolezeckou technikou s ok | 0.60 | 2 | fts_bm25_strong_no_mj |
| VRN-022 | VRN | Revize hromosvodu / LPS — měření ekvipotenciality, zemniče,  | paušál | 1.0 | 765115252 | Montáž střešních doplňků krytiny keramické  držáku | 0.60 | 2 | fts_bm25_strong_no_mj |
| PSV-OPL-001 | PSV-OPL | Kingspan KS NF 200 mm, jádro minerální vata (MW) per TZ ARS  | m² | 528.5 | 711193121.SMB | Izolace proti zemní vlhkosti na vodorovné ploše tě | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-OPL-002 | PSV-OPL | Montáž obvodového opláštění Kingspan KS NF 200 mm — kotvení  | m² | 528.5 | 155132111 | Zřízení protierozního zpevnění svahů geobuňkami vč | 0.75 | 1 | fts_bm25_medium_mj |
| PSV-OPL-003 | PSV-OPL | Kingspan KS FF-ROC tl. 200 mm, jádro ROC (Rockwool — minerál | m² | 558.8 | 763251123 | Podlaha ze sádrovláknitých desek na pero a drážku  | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-OPL-004 | PSV-OPL | Montáž střešního opláštění Kingspan KS FF-ROC 200 mm — kotve | m² | 558.8 | 342191211 | Montáž opláštění stěn ocelové konstrukce z polyest | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-OPL-005 | PSV-OPL | Klempířské lemy + přechody střecha–fasáda, pozinkovaný plech | bm | 207.0 | 764011611.LND | Podkladní plech LINDAB FOP/PLX - plastizol rš 150  | 0.85 | 1 | fts_bm25_strong_mj_trida |
| PSV-OPL-006 | PSV-OPL | Spojovací materiál + těsnění + EPDM podložky Kingspan systém | kpl | 1.0 | 721111104 | Potrubí z kameninových trub hrdlových s integrovan | 0.60 | 2 | fts_bm25_strong_no_mj |
| PSV-OPL-007 | PSV-OPL | Doprava sendvičových panelů Kingspan na stavbu — paušál | paušál | 1.0 | 985221101R01 | Stavební úpravy atikových sendvičových panelů dle  | 0.50 | 2 | fts_bm25_below_threshold |
| PSV-OPL-008 | PSV-OPL | Statické posouzení uchycení Kingspan k ocelové konstrukci +  | paušál | 1.0 | 713300842 | Odstranění tepelné izolace těles  povrchové úpravy | 0.60 | 2 | fts_bm25_strong_no_mj |

## Top-3 candidates per Tier 2 item (for review)

### HSV-1-004 — Hloubení atypického základu — varianta jako pilota Ø800 / L=8 m
_items.json mj=m³, mnozstvi=12.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 153191111 | Zřízení atypického pažení výkopu svařovaným ocelovým ohlubňovým rámem  | m2 | -11.48 | ✗ | ✓ |
| 2 | 153191112 | Zřízení atypického pažení výkopu svařovaným ocelovým ohlubňovým rámem  | m2 | -11.48 | ✗ | ✓ |
| 3 | 153191221 | Odstranění atypického pažení výkopu svařovaným ocelovým ohlubňovým rám | m2 | -11.48 | ✗ | ✓ |

### HSV-1-009 — Obetonování stávajícího potrubí splaškové kanalizace DN300 betonem C16/20
_items.json mj=m³, mnozstvi=5.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 765125202 | Montáž střešních doplňků krytiny betonové  nástavce pro odvětrání kana | kus | -14.31 | ✗ | ✗ |
| 2 | 115201501 | Montáž a demontáž odpadního potrubí s tvarovkami pro všechny druhy pot | m | -6.50 | ✗ | ✓ |
| 3 | 115201502 | Montáž a demontáž odpadního potrubí s tvarovkami pro všechny druhy pot | m | -6.50 | ✗ | ✓ |

### HSV-1-010 — Obetonování stávajícího potrubí dešťové kanalizace DN300 betonem C16/20
_items.json mj=m³, mnozstvi=5.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 721173315.OSM | Potrubí kanalizační plastové dešťové systém KG DN 110 | m | -20.48 | ✗ | ✗ |
| 2 | 765125202 | Montáž střešních doplňků krytiny betonové  nástavce pro odvětrání kana | kus | -14.31 | ✗ | ✗ |
| 3 | 115201501 | Montáž a demontáž odpadního potrubí s tvarovkami pro všechny druhy pot | m | -6.50 | ✗ | ✓ |

### HSV-1-011 — Pomocné výkopy pro novou přípojku vodovod DN150 LT
_items.json mj=m³, mnozstvi=8.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 119003131 | Pomocné konstrukce při zabezpečení výkopu svislé výstražná páska zříze | m | -9.47 | ✗ | ✓ |
| 2 | 119003132 | Pomocné konstrukce při zabezpečení výkopu svislé výstražná páska odstr | m | -9.47 | ✗ | ✓ |
| 3 | 119003141 | Pomocné konstrukce při zabezpečení výkopu svislé plastový plot zřízení | m | -9.47 | ✗ | ✓ |

### HSV-1-012 — Pomocné výkopy pro novou areálovou kanalizaci DN200
_items.json mj=m³, mnozstvi=49.2, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 119003131 | Pomocné konstrukce při zabezpečení výkopu svislé výstražná páska zříze | m | -9.47 | ✗ | ✓ |
| 2 | 119003132 | Pomocné konstrukce při zabezpečení výkopu svislé výstražná páska odstr | m | -9.47 | ✗ | ✓ |
| 3 | 119003141 | Pomocné konstrukce při zabezpečení výkopu svislé plastový plot zřízení | m | -9.47 | ✗ | ✓ |

### HSV-1-023 — Odvoz dřevní hmoty po kácení a likvidace
_items.json mj=m³, mnozstvi=6.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 966011191 | Demontáž mobilních buněk odvoz se složením, na vzdálenost 1 km | kus | -11.73 | ✗ | ✗ |
| 2 | 993111111 | Dovoz a odvoz lešení včetně naložení a složení řadového, na vzdálenost | m2 | -11.07 | ✗ | ✗ |
| 3 | 997013501 | Odvoz suti a vybouraných hmot na skládku nebo meziskládku se složením, | t | -10.77 | ✗ | ✗ |

### HSV-1-024 — Náhradní výsadba dřevin per rozhodnutí orgánu životního prostředí
_items.json mj=ks, mnozstvi=2.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 766422221 | Montáž obložení podhledů  jednoduchých panely obkladovými modřínovými  | m2 | -10.56 | ✗ | ✗ |
| 2 | 766422223 | Montáž obložení podhledů  jednoduchých panely obkladovými modřínovými  | m2 | -10.56 | ✗ | ✗ |
| 3 | 766423222 | Montáž obložení podhledů  členitých panely obkladovými modřínovými, a  | m2 | -10.15 | ✗ | ✗ |

### HSV-3-001 — Specifikace + dodávka sloupy IPE 400 S235 jakost J0, EXC2 dle ČSN EN 1090-2
_items.json mj=kg, mnozstvi=10263.24, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 767649R01 | D+M Generální klíč - specifikace dle PD | kus | -13.89 | ✗ | ✓ |
| 2 | 767649R02 | D+M Čtečky karet - specifikace dle PD | kus | -13.89 | ✗ | ✓ |
| 3 | 763712212 | Montáž svislé konstrukce  do 10 m výšky římsy plnostěnné sloupy (mimo  | m | -11.14 | ✗ | ✓ |

### HSV-3-002 — Specifikace + dodávka sloupy HEA 200 S235 jakost J0, štítové, EXC2
_items.json mj=kg, mnozstvi=1455.12, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 767649R01 | D+M Generální klíč - specifikace dle PD | kus | -13.89 | ✗ | ✓ |
| 2 | 767649R02 | D+M Čtečky karet - specifikace dle PD | kus | -13.89 | ✗ | ✓ |
| 3 | 763712212 | Montáž svislé konstrukce  do 10 m výšky římsy plnostěnné sloupy (mimo  | m | -11.14 | ✗ | ✓ |

### HSV-3-003 — Specifikace + dodávka příčlí IPE 450 S235 s náběhem (sklon 5.25°)
_items.json mj=kg, mnozstvi=9474.96, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 767649R01 | D+M Generální klíč - specifikace dle PD | kus | -13.89 | ✗ | ✓ |
| 2 | 767649R02 | D+M Čtečky karet - specifikace dle PD | kus | -13.89 | ✗ | ✓ |
| 3 | 762822830 | Demontáž stropních trámů  z hraněného řeziva, průřezové plochy přes 28 | m | -5.77 | ✗ | ✓ |

### HSV-3-004 — Specifikace + dodávka vaznice IPE 160 S235 jakost J0
_items.json mj=kg, mnozstvi=5195.04, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 767649R01 | D+M Generální klíč - specifikace dle PD | kus | -13.89 | ✗ | ✓ |
| 2 | 767649R02 | D+M Čtečky karet - specifikace dle PD | kus | -13.89 | ✗ | ✓ |
| 3 | 141720007 | Neřízený zemní protlak  v hornině tř. 1 a 2 vnějšího průměru protlaku  | m | -8.74 | ✗ | ✓ |

### HSV-3-005 — Specifikace + dodávka vaznice krajní UPE 160 S235 jakost J0
_items.json mj=kg, mnozstvi=1030.24, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 767649R01 | D+M Generální klíč - specifikace dle PD | kus | -13.89 | ✗ | ✓ |
| 2 | 767649R02 | D+M Čtečky karet - specifikace dle PD | kus | -13.89 | ✗ | ✓ |
| 3 | 141720007 | Neřízený zemní protlak  v hornině tř. 1 a 2 vnějšího průměru protlaku  | m | -8.74 | ✗ | ✓ |

### HSV-3-006 — Specifikace + dodávka ztužidla stěnová L 70/70/6 S235
_items.json mj=kg, mnozstvi=327.68, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 767649R01 | D+M Generální klíč - specifikace dle PD | kus | -13.89 | ✗ | ✓ |
| 2 | 767649R02 | D+M Čtečky karet - specifikace dle PD | kus | -13.89 | ✗ | ✓ |

### HSV-3-011 — Doprava ocelové konstrukce na stavbu (default 50 km)
_items.json mj=t·km, mnozstvi=1400, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 997013113 | Vnitrostaveništní doprava suti a vybouraných hmot vodorovně do 50 m s  | t | -11.83 | ✗ | ✗ |
| 2 | 411171121 | Montáž ocelové konstrukce podlah a plošin pokrytou plechy hmotnosti ko | t | -10.56 | ✗ | ✗ |
| 3 | 411171125 | Montáž ocelové konstrukce podlah a plošin pokrytou plechy hmotnosti ko | t | -10.56 | ✗ | ✗ |

### HSV-3-014 — Revize ocelové konstrukce + protokol o předání, EXC2 ČSN EN 1090-2
_items.json mj=paušál, mnozstvi=1.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 411171121 | Montáž ocelové konstrukce podlah a plošin pokrytou plechy hmotnosti ko | t | -10.56 | ✗ | ✗ |
| 2 | 411171125 | Montáž ocelové konstrukce podlah a plošin pokrytou plechy hmotnosti ko | t | -10.56 | ✗ | ✗ |
| 3 | 411171131 | Montáž ocelové konstrukce podlah a plošin pokrytou rošty hmotnosti kon | t | -10.56 | ✗ | ✗ |

### HSV-9-001 — Přesun hmot HSV vodorovně — beton, výztuž, ocel, klempířina
_items.json mj=t·km, mnozstvi=200.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 998006011 | Přesun hmot  pro vrty samostatné | t | -14.20 | ✗ | ✓ |
| 2 | 998004011 | Přesun hmot  pro injektování, mikropiloty nebo kotvy | t | -13.76 | ✗ | ✓ |
| 3 | 998001012 | Přesun hmot  pro piloty nebo podzemní stěny prefabrikované | t | -13.55 | ✗ | ✓ |

### HSV-9-002 — Pomocné lešení pro montáž ocelové konstrukce, výška do 6 m
_items.json mj=m³, mnozstvi=200.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 119003217 | Pomocné konstrukce při zabezpečení výkopu svislé ocelové mobilní oploc | m | -17.77 | ✗ | ✗ |
| 2 | 119003218 | Pomocné konstrukce při zabezpečení výkopu svislé ocelové mobilní oploc | m | -17.77 | ✗ | ✗ |
| 3 | 119003227 | Pomocné konstrukce při zabezpečení výkopu svislé ocelové mobilní oploc | m | -17.77 | ✗ | ✗ |

### HSV-9-003 — Demontáž pomocného lešení po dokončení montáže
_items.json mj=m³, mnozstvi=200.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 944511811 | Síť ochranná zavěšená na konstrukci lešení z textilie z umělých vláken | m2 | -16.62 | ✗ | ✓ |
| 2 | 941121811 | Lešení řadové trubkové těžké pracovní s podlahami z fošen nebo dílců m | m2 | -11.99 | ✗ | ✓ |
| 3 | 944511111 | Síť ochranná zavěšená na konstrukci lešení z textilie z umělých vláken | m2 | -10.79 | ✗ | ✓ |

### HSV-9-004 — Pomocné lešení pro montáž opláštění (Kingspan) a klempířiny — pojízdné
_items.json mj=m³, mnozstvi=120.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 119002411 | Pomocné konstrukce při zabezpečení výkopu vodorovné pojízdné z tlustéh | m2 | -19.33 | ✗ | ✗ |
| 2 | 119002412 | Pomocné konstrukce při zabezpečení výkopu vodorovné pojízdné z tlustéh | m2 | -19.33 | ✗ | ✗ |
| 3 | 944511111 | Síť ochranná zavěšená na konstrukci lešení z textilie z umělých vláken | m2 | -10.79 | ✗ | ✓ |

### PSV-76x-012 — Práh + lemování ostění vnějších dveří — pozink plech
_items.json mj=kpl, mnozstvi=2.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | OV07 | Plynová skříň HUP volně stojící, mat. pozink.plech, barva šedá | kus | -14.10 | ✗ | ✗ |
| 2 | 766492100 | Ostatní práce  montáž dřevěného obložení ostění | m2 | -11.08 | ✗ | ✓ |
| 3 | 763182313 | Výplně otvorů konstrukcí ze sádrokartonových desek  ostění oken z dese | m | -9.71 | ✗ | ✓ |

### PSV-78x-001 — Dodávka Lindab Round Downpipe 150/100 Antique White, vč. kolen a spojek
_items.json mj=ks, mnozstvi=4.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 764011611.LND | Podkladní plech LINDAB FOP/PLX - plastizol rš 150 mm | m | -17.34 | ✗ | ✓ |
| 2 | 764011621.LND | Dilatační připojovací lišta LINDAB FOP/PLX - plastizol včetně tmelení  | m | -13.97 | ✗ | ✓ |
| 3 | 764111671.LND | Krytina železobetonových desek LINDAB SEAMLINE Premium | m2 | -10.99 | ✗ | ✓ |

### PSV-78x-002 — Montáž svodů Lindab — příchytky, kotvení do fasády
_items.json mj=kpl, mnozstvi=4.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 764508101 | Montáž svodu hranatého svodu | m | -13.12 | ✗ | ✓ |
| 2 | 764508131 | Montáž svodu kruhového, průměru svodu | m | -13.00 | ✗ | ✓ |
| 3 | 764508103 | Montáž svodu hranatého odboček | kus | -11.85 | ✗ | ✓ |

### PSV-78x-003 — Wavin Tegra střešní vpust Round Iron Cover + Concrete Ring DN300
_items.json mj=ks, mnozstvi=3.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 764203139 | Montáž oplechování střešních prvků střešní dilatace vícedílná | m | -8.60 | ✗ | ✓ |
| 2 | 764213414 | Oplechování střešních prvků z pozinkovaného plechu střešní dilatace je | m | -7.99 | ✗ | ✓ |
| 3 | 764213415 | Oplechování střešních prvků z pozinkovaného plechu střešní dilatace je | m | -7.99 | ✗ | ✓ |

### PSV-78x-005 — MEA Mearin Plus 3000 NW300 liniový žlab — podél JZ a SZ fasády
_items.json mj=bm, mnozstvi=30.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 713134111.CUR | Tepelná foukaná izolace celulózová vlákna CLIMATIZER PLUS stěn tl do 1 | m3 | -8.57 | ✗ | ✓ |
| 2 | 713134115.CUR | Tepelná foukaná izolace celulózová vlákna CLIMATIZER PLUS stěn tl do 3 | m3 | -8.57 | ✗ | ✓ |
| 3 | 713114112.CUR | Tepelná foukaná izolace celulózová vlákna CLIMATIZER PLUS vodorovná vo | m3 | -8.45 | ✗ | ✓ |

### PSV-78x-006 — Mřížka MEA Mearin Plus 3000 + osazovací rám — pochozí provedení
_items.json mj=bm, mnozstvi=30.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 761614111 | Okna ze skleněných tvárnic  zděné rozměr 190 x 190 x 100 mm bezbarvé l | m2 | -11.32 | ✗ | ✓ |
| 2 | 761114111 | Stěny a příčky ze skleněných tvárnic  zděné rozměr 190 x 190 x 100 mm  | m2 | -11.02 | ✗ | ✓ |
| 3 | OV01 | Fasádní protidešťová hliníková větrací mřížka se sítí proti hmyzu, hra | kus | -11.80 | ✗ | ✗ |

### PSV-78x-012 — Doprava klempířiny + materiálu na stavbu — paušál
_items.json mj=paušál, mnozstvi=1.0, conf=0.85_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 997013113 | Vnitrostaveništní doprava suti a vybouraných hmot vodorovně do 50 m s  | t | -11.83 | ✗ | ✗ |
| 2 | 713392612 | Montáž izolace tepelné těles - doplňky a konstrukční součásti vyplnění | m3 | -6.05 | ✗ | ✓ |
| 3 | 212682111 | Lože pro trativody  z prohozeného výkopového materiálu | m3 | -6.79 | ✗ | ✗ |

### VRN-001 — Zařízení staveniště — buňka kancelář stavbyvedoucího + technika
_items.json mj=měsíc, mnozstvi=4, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 030001000 | Zařízení staveniště | kus | -26.44 | ✗ | ✓ |
| 2 | 763173131 | Instalační technika pro konstrukce ze sádrokartonových desek  montáž n | kus | -10.10 | ✗ | ✓ |
| 3 | 763173133 | Instalační technika pro konstrukce ze sádrokartonových desek  montáž n | kus | -10.10 | ✗ | ✓ |

### VRN-002 — Zařízení staveniště — buňka sociální / šatna / WC
_items.json mj=měsíc, mnozstvi=4, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 030001000 | Zařízení staveniště | kus | -26.44 | ✗ | ✓ |
| 2 | 715291901 | Oprava a údržba izolací doplňkových technologických zařízení vyrovnání | m2 | -8.47 | ✗ | ✓ |
| 3 | 115201301 | Montáž a demontáž zařízení čerpací a odsávací stanice včetně potrubí m | kus | -6.89 | ✗ | ✓ |

### VRN-003 — Zařízení staveniště — buňka sklad materiálu + nářadí
_items.json mj=měsíc, mnozstvi=4, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 030001000 | Zařízení staveniště | kus | -26.44 | ✗ | ✓ |
| 2 | 155211311 | Odtěžení nestabilních hornin ze skalních stěn horolezecku technikou s  | m3 | -11.55 | ✗ | ✓ |
| 3 | 715291901 | Oprava a údržba izolací doplňkových technologických zařízení vyrovnání | m2 | -8.47 | ✗ | ✓ |

### VRN-005 — Vodovodní přípojka pro stavbu — vytvoření + měření spotřeby
_items.json mj=paušál, mnozstvi=1.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 765131611 | Montáž vláknocementové krytiny vlnité  sklonu přes 20° do 30°, spotřeb | m2 | -10.49 | ✗ | ✓ |
| 2 | 765131618 | Montáž vláknocementové krytiny vlnité  sklonu přes 20° do 30°, spotřeb | m2 | -10.49 | ✗ | ✓ |
| 3 | 765131601 | Montáž vláknocementové krytiny vlnité  sklonu do 20° s vloženou těsníc | m2 | -10.22 | ✗ | ✓ |

### VRN-007 — WC mobilní pro pracovníky — 2 ks
_items.json mj=měsíc, mnozstvi=8, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 119003217 | Pomocné konstrukce při zabezpečení výkopu svislé ocelové mobilní oploc | m | -9.54 | ✗ | ✓ |
| 2 | 119003218 | Pomocné konstrukce při zabezpečení výkopu svislé ocelové mobilní oploc | m | -9.54 | ✗ | ✓ |
| 3 | 119003227 | Pomocné konstrukce při zabezpečení výkopu svislé ocelové mobilní oploc | m | -9.54 | ✗ | ✓ |

### VRN-008 — BOZP koordinace na stavbě — koordinátor BOZP průběžně
_items.json mj=měsíc, mnozstvi=4, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 713392816 | Montáž izolace tepelné těles - doplňky a konstrukční součásti úchytná  | kus | -13.31 | ✗ | ✓ |

### VRN-009 — Plán BOZP + dokumentace bezpečnosti práce
_items.json mj=paušál, mnozstvi=1.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 013294000 | Ostatní dokumentace stavby | kus | -14.80 | ✗ | ✓ |
| 2 | 013254000 | Dokumentace skutečného provedení stavby | kus | -14.56 | ✗ | ✓ |
| 3 | 012002000 | Zeměměřičské práce | kus | -9.32 | ✗ | ✓ |

### VRN-010 — Pojištění stavby + odpovědnostní pojistka
_items.json mj=paušál, mnozstvi=1.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 013294000 | Ostatní dokumentace stavby | kus | -11.29 | ✗ | ✓ |
| 2 | 013254000 | Dokumentace skutečného provedení stavby | kus | -11.10 | ✗ | ✓ |
| 3 | 711494001 | Provedení dvojitého hydroizolačního systému pro izolaci spodní stavby  | kus | -9.06 | ✗ | ✓ |

### VRN-011 — Likvidace odpadů kategorie O (běžný) — kontejner + odvoz + skládkovné
_items.json mj=m³, mnozstvi=30.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 171201211 | Poplatek za uložení stavebního odpadu na skládce (skládkovné) zeminy a | t | -14.21 | ✗ | ✓ |
| 2 | 997013631R01 | Poplatek za uložení na skládce (skládkovné) stavebního odpadu dle plat | t | -13.08 | ✗ | ✓ |
| 3 | 966011191 | Demontáž mobilních buněk odvoz se složením, na vzdálenost 1 km | kus | -11.73 | ✗ | ✓ |

### VRN-012 — Likvidace odpadů kategorie N (nebezpečné — barvy, oleje, tmely)
_items.json mj=m³, mnozstvi=2.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 171201211 | Poplatek za uložení stavebního odpadu na skládce (skládkovné) zeminy a | t | -14.21 | ✗ | ✓ |
| 2 | 997013631R01 | Poplatek za uložení na skládce (skládkovné) stavebního odpadu dle plat | t | -13.08 | ✗ | ✓ |

### VRN-013 — Doprava materiálu na stavbu vodorovně — paušál pro veškerou montáž
_items.json mj=t·km, mnozstvi=1500.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 997013113 | Vnitrostaveništní doprava suti a vybouraných hmot vodorovně do 50 m s  | t | -16.11 | ✗ | ✓ |
| 2 | 212682111 | Lože pro trativody  z prohozeného výkopového materiálu | m3 | -6.79 | ✗ | ✓ |
| 3 | 713392612 | Montáž izolace tepelné těles - doplňky a konstrukční součásti vyplnění | m3 | -6.05 | ✗ | ✓ |

### VRN-014 — Geodetické zaměření před zahájením stavby — vytýčení
_items.json mj=paušál, mnozstvi=1.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 783301401 | Příprava podkladu zámečnických konstrukcí před provedením nátěru omete | m2 | -12.70 | ✗ | ✓ |
| 2 | 771121011 | Příprava podkladu před provedením dlažby nátěr penetrační na podlahu | m2 | -12.51 | ✗ | ✓ |
| 3 | 783301303 | Příprava podkladu zámečnických konstrukcí před provedením nátěru odrez | m2 | -12.32 | ✗ | ✓ |

### VRN-015 — Geodetické zaměření skutečného provedení (DSPS) — po dokončení stavby
_items.json mj=paušál, mnozstvi=1.0, conf=0.75_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 013254000 | Dokumentace skutečného provedení stavby | kus | -21.18 | ✗ | ✓ |
| 2 | 712391171R01 | Provedení povlakové krytiny střech plochých do 10° -ostatní práce prov | m2 | -5.86 | ✗ | ✓ |
| 3 | 153811194 | Osazení kotev tyčových  bez provedení vrtu, zainjektování a napnutí ko | m | -5.72 | ✗ | ✓ |

### VRN-016 — Vyjádření správců sítí — komplet pro 8-12 sítí (RWE/CETIN/ČEZ/Opatovice/Pošta/at
_items.json mj=kpl, mnozstvi=1.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 272362021 | Výztuž základů kleneb ze svařovaných sítí z drátů typu KARI | t | -8.57 | ✗ | ✓ |
| 2 | 273362021 | Výztuž základů desek ze svařovaných sítí z drátů typu KARI | t | -8.57 | ✗ | ✓ |
| 3 | 274362021 | Výztuž základů pasů ze svařovaných sítí z drátů typu KARI | t | -8.57 | ✗ | ✓ |

### VRN-018 — Předávací protokoly + dokumentace skutečného provedení (DSPS)
_items.json mj=paušál, mnozstvi=1.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 013254000 | Dokumentace skutečného provedení stavby | kus | -35.74 | ✗ | ✓ |
| 2 | 013294000 | Ostatní dokumentace stavby | kus | -14.80 | ✗ | ✓ |
| 3 | 712391171R01 | Provedení povlakové krytiny střech plochých do 10° -ostatní práce prov | m2 | -5.86 | ✗ | ✓ |

### VRN-019 — Kolaudační řízení — příprava + účast na jednání + revize dokumentace
_items.json mj=paušál, mnozstvi=1.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 783301401 | Příprava podkladu zámečnických konstrukcí před provedením nátěru omete | m2 | -12.70 | ✗ | ✓ |
| 2 | 771121011 | Příprava podkladu před provedením dlažby nátěr penetrační na podlahu | m2 | -12.51 | ✗ | ✓ |
| 3 | 783301303 | Příprava podkladu zámečnických konstrukcí před provedením nátěru odrez | m2 | -12.32 | ✗ | ✓ |

### VRN-021 — Revize hydrantového systému + tlaková zkouška
_items.json mj=paušál, mnozstvi=1.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 155213511 | Trny z oceli prováděné horolezeckou technikou s okem z betonářské ocel | kus | -11.55 | ✗ | ✓ |
| 2 | OV04 | Nerezový zvonek vč. kamery, čipového systému | kus | -9.35 | ✗ | ✓ |
| 3 | 713143922 | Oprava střešního tepelně-hydroizolačního systému PUR obnova UV vrsty n | m2 | -8.55 | ✗ | ✓ |

### VRN-022 — Revize hromosvodu / LPS — měření ekvipotenciality, zemniče, svody
_items.json mj=paušál, mnozstvi=1.0, conf=0.5_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 765115252 | Montáž střešních doplňků krytiny keramické  držáku hromosvodu na hřebe | kus | -13.47 | ✗ | ✓ |
| 2 | 765125251 | Montáž střešních doplňků krytiny betonové  držáku hromosvodu na hřeben | kus | -13.47 | ✗ | ✓ |

### PSV-OPL-006 — Spojovací materiál + těsnění + EPDM podložky Kingspan systém — paušál pro celý o
_items.json mj=kpl, mnozstvi=1.0, conf=0.85_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 721111104 | Potrubí z kameninových trub hrdlových s integrovaným spojem svodné pry | m | -18.23 | ✗ | ✓ |
| 2 | 721111105 | Potrubí z kameninových trub hrdlových s integrovaným spojem svodné pol | m | -18.23 | ✗ | ✓ |
| 3 | 713151211 | Montáž tepelné izolace střech šikmých rohožemi, pásy, deskami (izolačn | m2 | -12.66 | ✗ | ✓ |

### PSV-OPL-007 — Doprava sendvičových panelů Kingspan na stavbu — paušál
_items.json mj=paušál, mnozstvi=1.0, conf=0.85_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 985221101R01 | Stavební úpravy atikových sendvičových panelů dle PZ/01 | m | -16.66 | ✗ | ✗ |
| 2 | 342151111 | Montáž opláštění stěn ocelové konstrukce ze sendvičových panelů šroubo | m2 | -15.27 | ✗ | ✓ |
| 3 | 342151121 | Montáž opláštění stěn ocelové konstrukce ze sendvičových panelů nýtova | m2 | -15.27 | ✗ | ✓ |

### PSV-OPL-008 — Statické posouzení uchycení Kingspan k ocelové konstrukci + revizní zpráva — pau
_items.json mj=paušál, mnozstvi=1.0, conf=0.85_

| Cand | KROS code | KROS popis (70) | MJ | rank | MJ ok | Třída ok |
|---|---|---|---|---:|---|---|
| 1 | 713300842 | Odstranění tepelné izolace těles  povrchové úpravy pevné izolace jakék | m2 | -8.18 | ✗ | ✓ |
| 2 | 155214211 | Síťování skalních stěn prováděné horolezeckou technikou montáž ocelové | m | -8.99 | ✗ | ✗ |
| 3 | 155214212 | Síťování skalních stěn prováděné horolezeckou technikou montáž ocelové | m | -8.99 | ✗ | ✗ |