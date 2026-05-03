TASK_VykazVymer_Libuse_Dokoncovaci_Prace.md
Мантра
Сначала читаешь весь репо. Потом всю документацию projektu v test-data/. Potом конвертируешь DWG → DXF. Potом извлекаешь данные. Potом старý výkaz výměr.xlsx. Potom задаёшь вопросы. Только потом считаешь.
Не выдумывай. Не галлюцинируй. Не додумывай. Если данных нет — спрашивай. Если есть в DWG — измерь точно. Если есть в чертеже PDF — измерь с tolerance. Если есть в таблице — возьми, но cross-validuj proti DXF. Nikdy nepoužívej propórční odhad když lze měřit přesně. Точка.

Контекст
Реальный проект Bytový soubor Libuše (akce 185-01, klient VELTON REAL ESTATE, generální projektant ABMV world s.r.o., DPS revize 01 z 30/11/2021).
Stav stavby podle slov zákazníka: hrubá stavba HOTOVÁ — všechny stěny, stropy, střecha postaveny. Předmětem zakázky jsou dokončovací práce (vše uvnitř + fasáda + povrchy v 1.PP).
Geometrie:

4 samostatné objekty A, B, C, D + společný suterén 1.PP
Půdorysné rozměry 12,5–13,8 × 22,4–28,1 m
Každý objekt: 1.PP (společný) + 1.NP + 2.NP + podkroví, sedlová střecha 30°-67°
36 bytů, 35 sklepů, 3 obchodní jednotky (v 1.NP objektu A), 44 parkovacích stání
±0,000 = 303,800 m n.m. (Bpv)

Atypicita podlaží:

1.PP — parkování, sklepy, technické prostory (zcela odlišné od NP)
1.NP objektu A — obsahuje 3 obchodní jednotky (atypické vůči B/C/D)
1.NP / 2.NP objektů B/C/D — typové bytové podlaží (vzájemně analogické)
3.NP (Podkroví) — skosné stropy 30-67°, atypické dispozice

Tento úkol je 6. golden test pro STAVAGENT a R&D milestone pro DWG/DXF pipeline.

Strategický přínos pro STAVAGENT
Tento úkol zavádí DWG/DXF jako nový input adapter pro Document → Calculator pipeline:

90%+ českých/slovenských projektantů odevzdává DPS v DWG
DXF parsing eliminuje OCR chyby (±50-100 mm) — geometrie je deterministická
Layer structure DWG je smyslový rozklad nativně klasifikovatelný
Kniha detailů v DWG umožňuje extrakci přesných skladeb v stykových uzlech

Po tomto golden testu STAVAGENT bude mít:

DWG → DXF konverzní wrapper
DXF parser modul (ezdxf based)
Triangulation cross-validation engine
Cross-object geometric validator
Detail extraction pipeline
Detail-aware audit mode


Existující výkaz výměr (starý)
V test-data/libuse/inputs/ existuje starý výkaz výměr Vykaz_vymer_stary.xlsx. Zákazník ho odmítl s odůvodněním že je v něm "mnoho propuštěného / vynechaného".

Объёмy (množství) pravděpodobně správné (extrakce z Revit modelu)
Položky (rozsah prací) pravděpodobně neúplné — zejména stykové detaily

Z manuálního proof-of-concept paralelně provedené analýzy je známo že ve starém VV chybí:

Hydroizolace stěn koupelen pod obklad F06 (ground truth ~1128 m², ve VV pouze 43 m²)
Zábradlí balkónů (LP60-LP65) — úplně chybí
Zábradlí schodišť — úplně chybí
Ocelové stupně schodiště — úplně chybí
Některé klempířské prvky (TP12 oplechování VZT, TP22 výtahová šachta, OP50 prostupová taška)

Tyto known issues jsou explicitně programované do Phase 1.5 a Phase 5.

Filesystem layout
test-data/libuse/
  ├─ inputs/
  │   ├─ pdf/                                 ← PDF documentation (sekundární)
  │   │   ├─ 185-01_DPS_D_SO01_100_0010_*.pdf  # TZ revize 01
  │   │   ├─ 185-01_DPS_D_SO01_100_0020_*.pdf  # Tabulka místností
  │   │   ├─ 185-01_DPS_D_SO01_100_0030_*.pdf  # Tabulka skladeb
  │   │   ├─ 185-01_DPS_D_SO01_140_*.pdf       # Půdorysy/řezy/pohledy
  │   │   └─ 185-01_DPS_*Kniha_detailu*.pdf    # Kniha detailů PDF
  │   ├─ dwg/                                 ← Native CAD source (PRIMÁRNÍ)
  │   │   ├─ 185-01_*pudorys*.dwg
  │   │   ├─ 185-01_*rez*.dwg
  │   │   ├─ 185-01_*pohled*.dwg
  │   │   └─ 185-01_*kniha_detailu*.dwg
  │   ├─ dxf/                                 ← Konvertované DXF (vytvoří agent)
  │   │   └─ (mirror dwg/ struktury)
  │   └─ Vykaz_vymer_stary.xlsx
  └─ outputs/
       ├─ inventory_report.md
       ├─ cad_extraction.json
       ├─ triangulation_report.md
       ├─ cross_object_validation.json         # ← NOVÉ
       ├─ geometric_extraction.json
       ├─ skladba_decomposition.json
       ├─ detail_extraction.json
       ├─ detail_audit_recommendations.md
       ├─ urs_lookup_cache.json
       ├─ audit_report.md
       ├─ extraction_log.md
       └─ Vykaz_vymer_Libuse_dokoncovaci_prace.xlsx
ZJIŠTĚNÝ STAV: všechny soubory leží přímo v test-data/. Agent v Phase 0.0 organizuje strukturu.

Nové dependencies
V Phase 0.5:
ezdxf>=1.3.0          # DXF parsing
shapely>=2.0          # Geometric computations
A nainstaluje ODA File Converter (free).
Fallback: LibreCAD headless nebo PDF-only mode.

PRE-IMPLEMENTATION INTERVIEW
Před první výpočetní operací MUSÍŠ položit tyto otázky pomocí AskUserQuestion. Nepřeskakuj.
Q1: Validace inventáře
Agent vypíše seznam všech souborů v test-data/, kategorizováno (PDF docs, DWG, Excel, jiné projekty, neznámé). Uživatel potvrdí.
Q2: Plán reorganizace
Agent navrhne přesun do test-data/libuse/inputs/{pdf,dwg}/. Uživatel potvrdí, agent provede git mv.
Q3: ODA File Converter availability
Agent zkontroluje which ODAFileConverter. Pokud chybí → uživatel volí instalaci, LibreCAD fallback, online API, nebo PDF-only degraded mode.
Q4: Edge cases místností (po Phase 0.5 a 0.7)
Po triangulation cross-validation a cross-object validation agent předloží uživateli kompletní seznam:

Místností v DXF + PDF, ale chybějících v Tabulce (jako D.1.3.01)
Místností v Tabulce, chybějících v DXF
Místností s konfliktem >5% mezi zdroji
Konflikty mezi součtem A+B+C+D a komplexovými hodnotami starého VV

Uživatel potvrdí akci pro každý case.
Q5: Rozsah dokončovacích prací (multi-select)
Vnitřní dokončovací práce:
  ☐ HSV-611/612 omítky vnitřní (sádrové byty F04/F05/F17, vápenocementové 1.PP F19)
  ☐ HSV-631 mazaniny (cementové potěry FF20/21/30/31)
  ☐ PSV-711 hydroizolace (koupelny/WC F18/F22, terasy/balkóny RF12/RF20/RF22)
  ☐ PSV-713 tepelné izolace vnitřní (Isover Top V Final pod stropem 1.PP F15)
  ☐ PSV-763.1 SDK podhledy (CF20 chodby, CF21 koupelny/WC)
  ☐ PSV-763.2 SDK předstěny (WF40/41/50/51)
  ☐ PSV-763.3 SDK podkroví (vnitřní záklop dvojitý + parozábrana)
  ☐ PSV-763.4 SDK na nadezdívce (WF11 schodišťový štít + WF22)
  ☐ PSV-766 truhlářské (vnitřní dveře + obložky, vstupní dveře)
  ☐ PSV-767 zámečnické vnitřní (madla, ocelové sloupky IPE120)
  ☐ PSV-771 podlahy keramické (F01/F02/F18/F21/F22)
  ☐ PSV-776 podlahy povlakové (F03 vinyl Gerflor)
  ☐ PSV-781 obklady keramické (F06)
  ☐ PSV-784 malby vnitřní (F04/F05/F17/F19 + CF20/CF21)
  ☐ Osazení rámů a zárubní (HSV-642/643)

Vnější dokončovací práce:
  ☐ HSV-622.1 fasáda — cihelné pásky Terca (F08)
  ☐ HSV-622.2 fasáda — tenkovrstvá omítka balkóny/atiky (F13)
  ☐ HSV-622.3 fasáda — betonová stěrka exteriérové podhledy (F16)
  ☐ PSV-712 povlakové krytiny — ploché střechy (RF11/RF13/RF14)
  ☐ PSV-712 povlakové krytiny — terasy a balkóny (RF12/RF20/RF22)
  ☐ PSV-713 ETICS — fasádní zateplení (EPS 200 + minerální vata + XPS sokl)
  ☐ PSV-762 tesařské — krov + terasy
  ☐ PSV-764 klempířské (žlaby, svody DN75, oplechování, parapety)
  ☐ PSV-765 pokrývačské — Tondach bobrovka 19×40 vazba šupinová
  ☐ PSV-767 zámečnické vnější (zábradlí balkónů, schodišťové prvky)
  ☐ PSV-783 nátěry vnější (žárové zinkování, anti-graffiti F23)

Suterén / 1.PP:
  ☐ HSV-611 vápenocementové omítky (F19)
  ☐ PSV-783 epoxidové nátěry (F11)
  ☐ PSV-783 polyuretanový systém garáže (F10)
  ☐ PSV-783 vsyp pancéřové podlahy rampy (F00)
  ☐ PSV-783 transparentní bezprašný nátěr ŽB stěn (F14)
  ☐ PSV-713 kontaktní zateplení podhledů 1.PP (F15)
  ☐ PSV-711 hydroizolace proti radonu (FF03)

Stykové detaily (z Knihy detailů — Phase 1.5):
  ☐ Vnitřní parapety (umělý kámen) per okno
  ☐ Vnější klempířské parapety per okno
  ☐ Ostění oken (komprimační páska + lišta + tmel)
  ☐ Připojovací spáry oken (parotěsná + paropropustná fólie)
  ☐ Sokl ETICS (XPS + soklová lišta + omítka armovaná)
  ☐ Dilatační lišty podlah
  ☐ Rohové lišty obkladů (Schluter)
  ☐ Větrací mřížky soklu
  ☐ Závětrné lišty atik
  ☐ Detaily prostupů střechou (VZT, kanalizace, komíny)

Specifika:
  ☐ Garážová vrata (sekční 5700×2100, elektrický pohon)
  ☐ Protipožární posuvná vrata mezi B/C v suterénu
  ☐ Záchytný systém na střeše
  ☐ Čisticí rohože v zádveřích
  ☐ Revizní dvířka (OP18, OP24, OP26, OP27)
Q6: ÚRS lookup template
You are a Czech construction estimating expert specialized in ÚRS RSPS classifier.

TASK: Find the most relevant ÚRS RSPS code for this construction work item.

ITEM:
- Description: "{popis_polozky}"
- Unit of measurement: {MJ}
- Material reference: {referenční_výrobek}
- Skladba code: {FF/F/CF/RF/WF}
- Layer thickness: {tloušťka_mm} mm (if applicable)

REQUIREMENTS:
1. Return ONLY codes from ÚRS RSPS (Sborník popisů stavebních prací 800-...)
2. Do NOT use OTSKP codes (those are for transport infrastructure)
3. Format response as STRICT JSON (no markdown):
{
  "code": "primary URS code",
  "description": "official ÚRS description in Czech",
  "confidence": 0.0-1.0,
  "alternatives": [{"code": "...", "description": "...", "confidence": 0.0-1.0}],
  "source_url": "URL to ÚRS source if available"
}
4. If no match with confidence ≥ 0.7, return top 3 alternatives with confidence < 0.7
5. NEVER invent codes — if unsure, set confidence ≤ 0.6
Rate limiting: 30 req/min, exponential backoff. Cache v urs_lookup_cache.json.
Q7: Granularita výkazu
Doporučení: jeden celkový list "Souhrnný výkaz" se sloupcem "Místo" (A/B/C/D/spol.suterén).

Architektura — fáze
Phase 0.0: File reorganization

Naskenuj test-data/, vypiš všechny soubory v root
Identifikuj soubory projektu Libuše (prefix 185-01_, Libuse, Vykaz_vymer_stary)
Klasifikuj per kategorie
Acceptance gate Q1+Q2: uživatel potvrdí
Vytvoř strukturu test-data/libuse/inputs/{pdf,dwg,dxf}/ a outputs/
Přesun přes git mv

Output: test-data/libuse/outputs/inventory_report.md
Phase 0.5: DWG → DXF konverze + DXF parsing + triangulation
KROK 1 — ODA Converter setup:

Vytvoř app/services/dwg_to_dxf.py jako wrapper
Pokud ODA není dostupný → fallback dle Q3

KROK 2 — Batch konverze:

Pro každý *.dwg v inputs/dwg/ → konvertuj do inputs/dxf/
Loguj failures

KROK 3 — DXF parsing:
Vytvoř app/services/dxf_parser.py:
pythonimport ezdxf
from shapely.geometry import Polygon
import re

def parse_dxf_drawing(dxf_path):
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    layers = {layer.dxf.name: layer for layer in doc.layers}
    
    # Najdi TEXT/MTEXT s kódy místností
    room_codes = []
    for entity in msp.query('TEXT MTEXT'):
        text = entity.dxf.text if entity.dxftype() == 'TEXT' else entity.text
        if re.match(r'[A-D]\.\d\.\d\.\d{2}', text):
            room_codes.append({
                'code': text,
                'position': (entity.dxf.insert.x, entity.dxf.insert.y)
            })
    
    # Pro každou místnost najdi nejbližší POLYLINE
    for room in room_codes:
        polyline = find_enclosing_polyline(msp, room['position'])
        if polyline:
            polygon = Polygon([(p[0], p[1]) for p in polyline.points()])
            room['plocha_m2'] = polygon.area / 1_000_000
            room['obvod_m'] = polygon.length / 1000
        else:
            room['plocha_m2'] = None
            room['obvod_m'] = None
    
    # Otvory (INSERT bloky oken/dveří)
    otvory = []
    for insert in msp.query('INSERT'):
        block_name = insert.dxf.name
        if re.match(r'(W|D)\d{2}', block_name):
            otvory.append({
                'kód': block_name,
                'position': (insert.dxf.insert.x, insert.dxf.insert.y),
                'attribs': {a.dxf.tag: a.dxf.text for a in insert.attribs}
            })
    
    return {'rooms': room_codes, 'otvory': otvory, 'layers': list(layers.keys())}
KROK 4 — Triangulation cross-validation:
Vytvoř app/services/triangulation_engine.py:
pythondef triangulate_room(code, dxf_value, tabulka_value, pdf_value, tolerance_pct=2):
    """
    Compares 3 sources of room area, returns classified result.
    
    Sources:
    - DXF: deterministic CAD geometry (highest reliability)
    - Tabulka místností: official documentation
    - PDF půdorys: OCR fallback
    """
    sources = {'DXF': dxf_value, 'Tabulka': tabulka_value, 'PDF': pdf_value}
    available = {k: v for k, v in sources.items() if v is not None}
    
    if len(available) == 0:
        return {'status': 'NO_DATA', 'value': None, 'confidence': 0.0}
    
    if len(available) == 1:
        only_source, only_value = next(iter(available.items()))
        return {
            'status': f'ONLY_{only_source}',
            'value': only_value,
            'confidence': 0.7 if only_source == 'DXF' else 0.5,
            'flag': f'Pouze {only_source} k dispozici'
        }
    
    def diff_pct(a, b):
        return abs(a - b) / max(a, b) * 100
    
    if len(available) == 3:
        d_t = diff_pct(dxf_value, tabulka_value)
        d_p = diff_pct(dxf_value, pdf_value)
        t_p = diff_pct(tabulka_value, pdf_value)
        
        if d_t <= tolerance_pct and d_p <= tolerance_pct:
            return {'status': 'A_ALL_AGREE', 'value': dxf_value, 'confidence': 1.0}
        elif d_t <= tolerance_pct and d_p > tolerance_pct:
            return {'status': 'B_DXF_TABULKA_AGREE', 'value': dxf_value, 'confidence': 0.95,
                    'flag': f'PDF OCR rozdíl {d_p:.1f}%'}
        elif d_p <= tolerance_pct and d_t > tolerance_pct:
            return {'status': 'C_DXF_PDF_AGREE_TABULKA_WRONG', 'value': dxf_value, 'confidence': 0.85,
                    'flag': f'⚠️ Tabulka místností pravděpodobně chyba: rozdíl {d_t:.1f}%'}
        elif t_p <= tolerance_pct and d_t > tolerance_pct:
            return {'status': 'D_TABULKA_PDF_AGREE_DXF_WRONG', 'value': tabulka_value, 'confidence': 0.80,
                    'flag': f'⚠️ DXF parsing problém: rozdíl {d_t:.1f}%, zkontrolovat polylinii'}
        else:
            return {'status': 'E_ALL_DIFFER', 'value': dxf_value, 'confidence': 0.50,
                    'flag': f'⚠️ Vyžaduje ruční ověření: DXF={dxf_value}, Tabulka={tabulka_value}, PDF={pdf_value}'}
KROK 5 — Output:
outputs/cad_extraction.json — surová DXF data
outputs/triangulation_report.md — narativní report konfliktů napříč objekty A/B/C/D
Pozor na atypicitu podlaží — agent NESMÍ:

Předpokládat že místnosti v 1.PP mají odpovídající v NP
Předpokládat že 1.NP objektu A (obchody) má dispozici jako 1.NP B/C/D
Předpokládat že 3.NP (podkroví) má dispozici jako 1.NP nebo 2.NP

Tyto výjimky jsou explicitně programované v Phase 1.
Phase 0.7: Cross-Object Geometric Validation
CÍL: Pro každý objekt A/B/C/D vypočítat přesné geometrické hodnoty z DXF (NE z proporcí), pak validovat součet proti komplexovým hodnotám ze starého VV.
Princip: propórce 19% / 28% nejsou vstupem výpočtu, ale výstupem validace. Každý objekt se měří přesně, pomery jsou kontrolní cifry.
KROK 1 — Per-objekt extrakce z DXF:
Pro každý objekt A/B/C/D vypočítej z DXF:
json{
  "objekt": "D",
  "půdorys_m2": 348.71,
  "půdorys_rozměry": "28.07 × 12.42 m",
  "fasáda_brutto_per_orientace": {
    "J": 275.09,
    "S": 275.09,
    "V": 143.92,
    "Z": 143.92
  },
  "fasáda_brutto_celkem_m2": 838.01,
  "střecha_per_skat": {
    "skat_31_stupnu": 194.84,
    "skat_67_stupnu": 109.02,
    "ploché_centrální": 139.02
  },
  "střecha_celkem_m2": 442.88,
  "obvod_terén_m": 80.98,
  "obvod_střecha_m": <vypočteno>,
  "atika_celkem_bm": <vypočteno>
}
Stejné pro objekty A, B, C.
KROK 2 — Klasifikace fasádních otvorů per objekt:
Z Tabulky oken (W01-W..) a Tabulky dveří (D01-D..) extrahovat:
pythondef classify_fasadni_otvory(otvory_list, pudorysy_per_objekt):
    """
    Klasifikuj každé okno/dveře:
    - Fasádní otvor: umístěné na obvodové stěně objektu
    - Vnitřní otvor: mezi dvěma vnitřními místnostmi
    """
    fasadni = {'A': [], 'B': [], 'C': [], 'D': []}
    
    for otvor in otvory_list:
        objekt = identify_objekt(otvor.position, pudorysy_per_objekt)
        is_fasadni = is_on_external_wall(otvor.position, pudorysy_per_objekt[objekt])
        if is_fasadni:
            fasadni[objekt].append({
                'kód': otvor['kód'],
                'rozměry': otvor['rozměry'],
                'plocha_m2': otvor['plocha'],
                'orientace': identify_orientation(otvor.position, pudorysy_per_objekt[objekt])
            })
    
    return fasadni
Pro každý objekt vypočti:

Σ plocha fasádních otvorů (per orientace J/S/V/Z + celkem)
Netto fasáda = brutto - otvory

KROK 3 — Validace proti starému VV:
Pro 3-5 ground truth položek ze starého VV které mají komplexovou hodnotu, ověř součet z DXF:
pythondef validate_against_old_vv(old_vv_items, dxf_extracted):
    """
    Pro každou klíčovou komplexovou položku ze starého VV:
    - Najdi ekvivalent v DXF datech (např. krytina sklon 31°)
    - Sečti hodnoty per A+B+C+D
    - Porovnej s komplexovou hodnotou ve starém VV
    """
    validations = []
    
    # Příklad: krytina 31°
    soucet_dxf = sum(obj['střecha_per_skat']['skat_31_stupnu'] 
                     for obj in dxf_extracted.values())
    komplex_vv = old_vv_items['krytina_31_stupnu']  # např. 1590 m²
    rozdil_pct = abs(soucet_dxf - komplex_vv) / komplex_vv * 100
    
    validations.append({
        'položka_VV': 'krytina sklon 31°',
        'komplex_VV': komplex_vv,
        'součet_z_DXF': soucet_dxf,
        'rozdíl_pct': rozdil_pct,
        'status': 'OK' if rozdil_pct <= 3 else 'FLAG'
    })
    
    # Stejně pro: soklová lišta TP26, ETICS celkem, atd.
    
    return validations
KROK 4 — Output:
outputs/cross_object_validation.json:
json{
  "objekty": {
    "A": { /* per-objekt data */ },
    "B": { /* per-objekt data */ },
    "C": { /* per-objekt data */ },
    "D": { /* per-objekt data */ }
  },
  "fasadni_otvory_per_objekt": { /* W01-W.. + D01-D.. klasifikace */ },
  "validations": [
    {
      "položka_VV": "krytina sklon 31°",
      "komplex_VV": 1590.0,
      "součet_z_DXF": 1587.3,
      "rozdíl_pct": 0.17,
      "status": "OK"
    }
  ],
  "kontrolní_pomery": {
    "D / komplex (fasáda netto)": 0.193,
    "D / komplex (střecha)": 0.191,
    "D / komplex (sokl)": 0.193,
    "D / komplex (vnitřní podlahy bytů)": 0.276
  }
}
DŮLEŽITÉ:

Pomery jsou výstupem validace, NE vstupem výpočtu
Pokud výsledný pomer výrazně rozdílný od očekávaného (z manuálního proof-of-concept: ~19% pro vnější, ~28% pro vnitřní), FLAG pro uživatele — možný problém v DXF extraction
Pokud validace selže pro >2 položky → STOP, vyžadovat ruční review před pokračováním

Phase 1: Geometric Extraction (DXF-first, kontextově citlivá analogie)
Pro každou místnost A/B/C/D + společný suterén použij triangulation result z Phase 0.5.
FASÁDNÍ OTVORY vs MÍSTNOSTNÍ OTVORY:
Otvory v projektu mají dva různé účely:

Místnostní otvory — pro výpočet plochy stěn místnosti (interiér)
Fasádní otvory — pro výpočet netto plochy fasády (exteriér)

Klasifikace otvoru:

Pokud okno/dveře jsou na obvodové stěně objektu (zjištěno z půdorysu) → fasádní otvor + místnostní otvor (oba)
Pokud dveře jsou mezi dvěma vnitřními místnostmi → pouze místnostní otvor
Vnitřní dveře nejsou fasádní otvory.

Pro Phase 0.7 a Phase 3 (ETICS, cihelné pásky) používat POUZE fasádní otvory.
Pro Phase 1 a Phase 3 (vnitřní omítky, malby) používat OBA druhy.
Struktura per místnost:
json{
  "kód": "D.1.4.02",
  "objekt": "D",
  "podlaží": "1.NP",
  "název": "OBÝVACÍ POKOJ + KK",
  "plocha_podlahy_m2": 27.231,
  "plocha_zdroj": "DXF",
  "plocha_status": "A_ALL_AGREE",
  "plocha_confidence": 1.0,
  "světlá_výška_mm": 2800,
  "obvod_m": 21.3,
  "FF": "FF21",
  "F_povrch_podlahy": "F03",
  "F_povrch_stěn": "F05",
  "CF": "CF20",
  "F_povrch_podhledu": "F05",
  "otvory_místnostní": [
    {"typ": "okno", "kód": "W01", "kusů": 1, "rozměry_mm": "1500×1500", "plocha_m2": 2.25, "fasádní": true},
    {"typ": "dveře_vnitřní", "kód": "D21", "kusů": 1, "rozměry_mm": "900×2100", "plocha_m2": 1.89, "fasádní": false}
  ],
  "plocha_stěn_m2": 56.39,
  "poznámka": ""
}
Edge case handling — kontextově citlivá analogie:
pythondef find_analogie(missing_room_code):
    """
    Find analogue room in different floor — CONTEXT-AWARE.
    
    Valid pairs:
      - 1.NP ↔ 2.NP pro objekty B/C/D (typové bytové podlaží)
    
    Invalid (NEPOUŽÍVAT):
      - Cokoli ↔ 3.NP (podkroví): skosné stropy, atypická dispozice
      - 1.NP objektu A ↔ cokoli: obchodní jednotky
      - 1.PP ↔ cokoli: parkování, sklepy
    """
    match = re.match(r'([A-D])\.(\d)\.(\d)\.(\d{2})', missing_room_code)
    if not match:
        return None
    objekt, podlazi, byt, mistnost = match.groups()
    podlazi = int(podlazi)
    
    if podlazi == 3:
        return None  # Podkroví — bez analogie
    if podlazi == 1 and objekt == 'A':
        return None  # 1.NP objektu A — obchody
    if podlazi == 0:
        return None  # 1.PP
    
    if podlazi == 1:
        return f"{objekt}.2.{byt}.{mistnost}"
    if podlazi == 2:
        return f"{objekt}.1.{byt}.{mistnost}"
    
    return None
Algoritmus pro chybějící místnost:

Pokud DXF má geometrii → použij DXF, confidence dle triangulation
Pokud DXF nemá → zkus PDF measurement, confidence 0.85
Najdi analogii dle pravidel výše
Pokud analogie existuje + DXF souhlasí ±3% → confidence 0.95
Pokud rozdíl 3-10% → confidence 0.80, poznámka
Pokud rozdíl > 10% → confidence 0.60, FLAG ručního ověření
Pokud analogie neexistuje (podkroví, obchody, suterén) → pouze DXF/PDF, bez analogie validace

Aplikace na potvrzený case D.1.3.01:

Podlaží = 1, objekt = D → analogie OK
D.2.3.01 = 6,36 m² je validní reference
DXF measure D.1.3.01 → cross-check proti 6,36 m²

Loggování do extraction_log.md pro každý edge case.
Output: outputs/geometric_extraction.json
Acceptance gate: uživatel reviewuje 5-10 vzorků (mix podlaží a objektů, vč. D.1.3.01).
Phase 1.5: Detail layer composition extraction
CÍL: Extrahovat z Knihy detailů přesné skladby v stykových uzlech.
KROK 1 — Inventář detailů:

Načti inputs/pdf/*Kniha_detailu*.pdf a inputs/dxf/*kniha_detailu*.dxf
Vypiš všechny detaily, kategorizuj per typ

KROK 2 — Per-detail extrakce (DXF + PDF kombinovaně):
json{
  "detail_kód": "D14_okenni_parapet_vnitřní",
  "kategorie": "okno",
  "MJ": "bm",
  "vrstvy": [
    {
      "pořadí": 1,
      "název": "Vnitřní parapet",
      "materiál": "umělý kámen Technistone",
      "rozměry_mm": "30 × šířka_parapetu",
      "kotvení": "lepený PUR pěnou + silikonem"
    }
  ],
  "vázáno_na": "okenní otvor (W01-W11)",
  "počet_kusů_v_projektu": "<dohledat z Tabulky oken>"
}
KROK 3 — Identifikace pravděpodobně vynechaných položek:
HIGH PRIORITY KNOWN MISSING (z manuálního proof-of-concept ground truth):
☐ Hydroizolace stěn koupelen pod obklad F06
  - V starém VV: 43 m²
  - Ground truth: ~1128 m² (dle počtu koupelen × průměrná plocha stěn × výška obkladů)
  - FLAG: starý VV obsahuje pouze ~4% reálné plochy
  - Akce: vypočítat přesně z geometric_extraction.json
    (Σ koupelen × Σ plocha stěn s F06 × výška podhledu)

☐ Zábradlí balkónů (LP60-LP65 z Tabulky zámečnických prvků)
  - V starém VV: NENÍ
  - Ground truth: ~50 bm pro D, ~200 bm komplex
  - FLAG: úplně chybí ve starém VV
  - Akce: spočítat z půdorysů 1.NP/2.NP/3.NP per objekt
    (obvod balkónu = bm zábradlí, mínus stěna domu)

☐ Zábradlí schodišť
  - V starém VV: NENÍ
  - Ground truth: ~30 bm pro D
  - FLAG: úplně chybí ve starém VV
  - Akce: spočítat z řezů (počet ramen × délka × 2 strany)

☐ Ocelové stupně schodiště
  - V starém VV: NENÍ
  - Ground truth: ~50 ks pro D
  - FLAG: úplně chybí ve starém VV
  - Akce: počet stupňů × počet pater per objekt

☐ Klempířské prvky (TP12, TP22, OP50)
  - TP12 oplechování VZT: ~82 ks komplex (přibližně 1 per byt + společný)
  - TP22 výtahová šachta: 1 ks per objekt
  - OP50 prostupová taška Tondach bobrovka: ~19 ks komplex
  - Akce: dohledat z Tabulky klempířských prvků
STANDARD CANDIDATES (general detail audit):

Vnitřní parapety (umělý kámen) — bm × Σ oken
Vnější klempířské parapety — bm × Σ oken
Ostění oken — bm × Σ oken
Připojovací spáry oken — bm × Σ oken
Sokl ETICS — bm fasády na úrovni terénu
Dilatační lišty podlah
Rohové lišty obkladů (Schluter)
Větrací mřížky soklu
Závětrné lišty atik
Žárové zinkování ocelových prvků
Anti-graffiti nátěr (F23)

KROK 4 — Output:

outputs/detail_extraction.json
outputs/detail_audit_recommendations.md

Phase 2: Skladba Decomposition
Pro každý kód skladby použitý v Phase 1 (FF01, FF03, FF20, FF21, FF30, FF31, RF10-30, WF01-90, CF10/20/21) načti z Tabulky skladeb:
json{
  "skladba": "FF20",
  "celková_tloušťka_mm": 130,
  "vrstvy": [
    {"pořadí": 1, "název": "Povrchová úprava", "tloušťka_mm": 15, "specifikace": "viz Tabulka povrchů", "MJ_per_m2": 1},
    {"pořadí": 2, "název": "Roznášecí vrstva", "tloušťka_mm": 50, "materiál": "Cementový potěr F5", "referenční_výrobek": "Cemix 020", "MJ_per_m2": "0.05 m³"}
  ]
}
Output: outputs/skladba_decomposition.json
Phase 3: Generování položek per kapitola
Pro každou kapitolu z Q5 generuj položky kombinací:

Skladby (Phase 2) × Místnosti s touto skladbou (Phase 1)
Detaily (Phase 1.5) × Počet otvorů/uzlů
Per-objekt fasáda netto (Phase 0.7) × ETICS skladby

Příklad PSV-771 Podlahy keramické:

Pro každou místnost s F01/F02/F18/F21/F22:

Lepidlo flexibilní × plocha
Penetrace × plocha
Kladení dlažby × plocha
Spárovací hmota × plocha
Sokl 80 mm × (obvod − šířka dveřních otvorů)
V koupelnách: hydroizolační stěrka × (plocha + 0,3 m × obvod stěny + ve sprchovém koutu 2,0 m × šířka)



Příklad PSV-784 Malby:

Pro každou místnost s F04/F05/F17/F19:

Penetrace × plocha stěn (po odečtu otvorů)
Disperzní malba 2× × plocha stěn
Pro CF20/CF21: penetrace + malba 2× × plocha podhledu



Příklad HSV-622.1 fasáda — cihelné pásky Terca:

Pro každý objekt A/B/C/D:

Plocha fasády netto (z Phase 0.7 — fasáda brutto - fasádní otvory)
Cihelné pásky Terca × netto plocha
Lepidlo Terca × netto plocha
Spárovací hmota Polyblend S × netto plocha



Phase 4: ÚRS Lookup přes Perplexity
Pro každou unikátní položku → Perplexity API s template z Q6, cache v urs_lookup_cache.json.
Confidence:

Match přesný → 0.95
Match podobný → 0.7
Nejistý → ≤ 0.6, status "vyžaduje manuální ověření"

Phase 5: Audit & Diff against Old výkaz
Fuzzy match každé nové položky proti starému výkazu (popis + MJ + objem ±5%).
Statusy:

SHODA_SE_STARYM — položka existuje, objem v toleranci
OPRAVENO_OBJEM (rozdíl > 5%)
OPRAVENO_POPIS
NOVE
VYNECHANE_DETAIL — z Phase 1.5 (stykové detaily)
VYNECHANE_KRITICKE — z Phase 1.5 high-priority known missing (hydroizolace koupelen, zábradlí, ocelové stupně)
VYNECHANE_ZE_STAREHO — pol. starého bez matche v novém

Output: outputs/audit_report.md se sekcí "Critical missing items" pro known issues.
Phase 6: Excel export
Soubor: outputs/Vykaz_vymer_Libuse_dokoncovaci_prace.xlsx
List 1 — Souhrnný výkaz:
| ÚRS kód | Popis | MJ | Množství | Místo | Skladba/povrch | Confidence | Status | Poznámka |
List 2 — Audit starého výkazu:
| Pol. starého | Popis | MJ | Množství staré | Status | Pol. nového | Množství nové | Rozdíl % | Poznámka |
List 3 — Místnosti:
| Kód | Objekt | Podlaží | Název | Plocha m² (DXF) | Plocha m² (Tabulka) | Plocha m² (PDF) | Triangulation status | Použitá hodnota | Confidence | Světlá výška mm | Obvod m | Plocha stěn m² | FF | F stěny | CF | F podhled |
List 4 — Skladby:
| Kód | Vrstva | Materiál | Tloušťka mm | Referenční výrobek | MJ per m² |
List 5 — Detaily:
| Kód detailu | Kategorie | MJ | Vrstvy (JSON) | Vázáno na | Počet v projektu |
List 6 — Cross-Object validace:
| Objekt | Půdorys m² | Fasáda brutto m² | Fasáda netto m² | Střecha m² | Sokl bm | Atika bm |

sekce "Validace proti starému VV" + sekce "Kontrolní pomery"

List 7 — Klempíř + Zámeč specifikace:
| Kód prvku | Popis | MJ | Množství per A/B/C/D | Komplex | Status |
(speciálně pro TP12/TP22/TP26/LP60-65/atd.)
List 8 — ÚRS lookup log:
| Položka | Query | Response code | Description | Confidence | Source URL | Cached |
List 9 — Triangulation konflikty:
| Místnost | DXF | Tabulka | PDF | Status | Použitá hodnota | Flag |
List 10 — DWG/DXF konverze log:
| DWG soubor | DXF soubor | Status | Duration | Errors |

Acceptance Criteria

Phase 0.0: soubory reorganizovány, uživatel potvrdil
Phase 0.5: všechny DWG konvertovány nebo flagované; triangulation report hotový
Phase 0.7: všechny 4 objekty mají per-objekt geometrii, validace proti starému VV prošla, kontrolní pomery vypočteny
Phase 1: všechny místnosti extrahovány s triangulation status, edge cases identifikovány, fasádní vs místnostní otvory rozlišeny, 5-10 vzorků reviewed
Phase 1.5: Kniha detailů zkatalogizovaná, high-priority known missing items spočítány
Phase 2: všechny použité skladby dekomponovány
Phase 3: každá vybraná kapitola má položky pro relevantní místnosti/objekty
Phase 4: ÚRS lookup hotový, low-confidence listed
Phase 5: každá položka starého výkazu má status, critical missing flagované
Phase 6: Excel s 10 listy, vzorky cross-checkované


Co NE входит

HSV díly 1-5 (zemní/základy/svislé/vodorovné nosné) — hrubá stavba je hotová
Technické instalace ZTI/VZT/ÚT/elektro/MaR/EPS/SHZ — samostatné profese
Výtah — vlastní subdodávka
Interiér (kuchyně, vestavné, sanita zařizovací)
Sadové úpravy, komunikace, oplocení (SO10)
Generování cen — pouze položky a objemy
Změny architektury/statiky/PBŘ — projekt je v DPS revizi 01


Pravidlo naming
Naming a strukturu souborů určuj podle existujících konvencí v repu (CLAUDE.md). Nové moduly:

app/services/dwg_to_dxf.py
app/services/dxf_parser.py
app/services/triangulation_engine.py
app/services/cross_object_validator.py ← NOVÉ
app/services/detail_extractor.py
app/services/audit_engine.py

Vše ostatní do test-data/libuse/outputs/.

Recovery patterns

Excel timeout: rozdělit per objekt + master soubor s pivot
Perplexity rate limit: cache + exponential backoff
DWG conversion fail: flagovat, fallback na PDF, confidence 0.7
DXF parsing fail: fallback na PDF + Tabulka, confidence 0.7
Cross-object validation fail (>2 položky neprošly): STOP, vyžadovat ruční review
Velký kontext: rozdělit fáze do samostatných session, JSON cache mezi fázemi


Doporučená session strategie
Vzhledem k velikosti (4 objekty, ~200 místností, ~500-1000 položek + DWG pipeline R&D):

Session 1: Phase 0.0 + Phase 0.5 (file org + DWG konverze + DXF parsing + triangulation). Velmi tvrdá session — zavádí novou capability.
Session 2: Phase 0.7 + Phase 1 + Phase 1.5 (cross-object validation + geometrie + Kniha detailů). Po session uživatel review.
Session 3: Phase 2 + Phase 3 (skladby + položky). Možná split per kapitola.
Session 4: Phase 4 (ÚRS lookup batch).
Session 5: Phase 5 + Phase 6 (audit + Excel).

Každá session končí next-session.md v repo root.

End-of-session deliverables
V test-data/libuse/outputs/:

Vykaz_vymer_Libuse_dokoncovaci_prace.xlsx
cad_extraction.json
triangulation_report.md
cross_object_validation.json
geometric_extraction.json
skladba_decomposition.json
detail_extraction.json
detail_audit_recommendations.md
urs_lookup_cache.json
audit_report.md
inventory_report.md
extraction_log.md

Nové services v app/services/:

dwg_to_dxf.py
dxf_parser.py
triangulation_engine.py
cross_object_validator.py
detail_extractor.py
audit_engine.py

Updated requirements.txt s ezdxf, shapely.
next-session.md v repo root.