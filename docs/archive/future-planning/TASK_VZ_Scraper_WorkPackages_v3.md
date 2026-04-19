# ЗАДАНИЕ: Сбор смет + Автоматические Work Packages из 1000+ rozpočtů

**Версия:** 3.0 (s PoC výsledky)
**Приоритет:** высокий (data foundation для TZ→Soupis pipeline)
**Тип:** data engineering + ML clustering
**Обновлено:** Hlídač státu API + собственная коллекция смет вместо ручного scraping profilů

---

## 0. Обязательное правило для агента

> Сначала читаешь весь репо целиком. Naming по конвенциям в репо. Не создавай параллельные структуры.

Особое внимание:
- Существующие парсеры xlsx_komplet и xlsx_rtsrozp — использовать для разбора файлов
- Текущая структура project.json и DocumentSummary
- Как Core Engine обрабатывает Excel файлы

---

## 1. Зачем это нужно

### Проблема
Чтобы система могла из TZ (текстовое описание) предложить полный набор ÚRS положек, ей нужна **база знаний**: какие положки обычно идут вместе. Ручное описание каждого "балíčка" не масштабируется — есть сотни типов работ.

### Решение
Собрать тысячи реальных смет из **двух источников**, распарсить, и через co-occurrence анализ выявить устойчивые группы положек.

### Два источника данных

```
ИСТОЧНИК 1: Собственная коллекция       ИСТОЧНИК 2: Hlídač státu API
  │ xlsx в локальной базе                 │ VZ с CPV 45* (stavebnictví)
  │ знакомые форматы                      │ → metadata + URL dokumentů
  │ известный контекст                    │ → скачать xlsx přílohy
  │ HIGH QUALITY seed data                │ → VOLUME (тысячи zakázek)
  └──────────┬────────────────────────────┘
             ▼
      Единый Parser (xlsx_komplet / xlsx_rtsrozp)
             │
             ▼
      Normalizer (kód → systém + hierarchie + typ práce)
             │
             ▼
      Co-occurrence матрица → Clustering → Work Packages
             │
             ▼
      WorkPackage DB → API для TZ→Soupis pipeline
```

---

## 2. Источник 1: Собственная коллекция смет (SEED DATA)

### Что есть
У нас уже накоплена коллекция реальных смет разных типов. Это **самый ценный** источник потому что:
- Форматы известны и парсеры уже работают
- Контекст каждой сметы понятен (тип объекта, профессия)
- Можно вручную верифицировать результаты clustering

### Процесс
1. Инвентаризация всех xlsx в локальном хранилище
2. Классификация по типу: Export Komplet / #RTSROZP# / другой
3. Парсинг каждого файла существующими парсерами
4. Тегирование: тип объекта (bytový dům / hala / sanace / most), typ prací, rok
5. Загрузка нормализованных положек в единую БД

### Ожидаемый объём
Десятки-сотни файлов. Малый объём, но **высокое качество** — каждый файл проверен.

---

## 3. Источник 2: Hlídač státu API

### Почему Hlídač státu а не ручной scraping profilů

| Критерий | Ручной scraping profilů | Hlídač státu API |
|----------|------------------------|-----------------|
| Доступ к VZ метаданным | Нужно парсить десятки разных порталов | Единое API, всё агрегировано |
| Поиск по CPV | Невозможен напрямую | `cpv:45` → все строительные VZ |
| Ссылки на документы | Разный HTML на каждом портálu | Структурированные данные |
| Лицензия | Серая зона (публичные данные, но scraping) | CC BY 3.0 — явно разрешено |
| Rate limiting | Неизвестен, рискуем бан | Документирован (10 мин интервал) |
| Dumps | Невозможно | Еженедельные полные дампы |
| Регистрация | Не нужна / нужна на каждом портале | Одна бесплатная регистрация |

### API детали

**Swagger:** `https://api.hlidacstatu.cz/swagger/index.html`
**Auth:** Token в header `Authorization: Token {api_key}`
**Token:** уже получен и протестирован (PoC 30.03.2026)

**PoC результаты:**
- `/api/v2/smlouvy/hledat` → 200 OK — **основной источник**
- `/api/v2/smlouvy/{id}` → 200 OK — Přílohy s PlainTextContent
- `/api/v2/dumps` → 200 OK — full dump smluv 69MB
- `/api/v2/verejnezakazky/hledat` → **403 Forbidden** — НЕ ИСПОЛЬЗОВАТЬ

**Объёмы данных:** 48K smluv s "KRYCÍ LIST SOUPISU", 32K s "CS ÚRS", 1K s "Export Komplet"
**Klíčový objev:** PlainTextContent příloh už obsahuje strukturovaná data (kódy, MJ, množství, VV)

**Ключевые endpoints:**

```
# Поиск VZ по CPV (строительство)
GET /api/v2/verejnezakazky/hledat?dotaz=cpv:45&strana=1

# Detail конкретной VZ (включая URL документů)
GET /api/v2/verejnezakazky/{id}

# Smlouvy (Registr smluv) — содержат přílohy (xlsx soupisy prací)
GET /api/v2/smlouvy/hledat?dotaz=stavební+práce&strana=1

# Detail smlouvy (включая Prilohy[] с URL на документy)
GET /api/v2/smlouvy/{id}

# Data dumps — полные дампы (týdenní)
GET /api/v2/dumps
GET /api/v2/dumpZip/{datatype}/{date}
```

**Поиск VZ — примеры запросов:**

```
cpv:45          → все stavební práce
cpv:4532        → izolační práce (ETICS, hydroizolace)
cpv:4521        → pozemní stavby
cpv:4522        → inženýrské stavby
cpv:4531        → elektroinstalace
cpv:4533        → instalatérské práce (ZTI, VZT, ÚT)
cpv:4541        → omítkářské práce
oblast:Stav     → stavebnictví (Hlídačův vlastní filtr)
```

**Registr smluv — přílohy:**
Smlouvy o dílo na stavební práce často obsahují jako přílohu soupis prací (xlsx). Endpoint vrací pole `Prilohy[]` s URL na stažení a `PlainTextContent` (extrahovaný text).

### Postup získání xlsx

```
Krok 1: Vyhledat VZ
  GET /api/v2/verejnezakazky/hledat?dotaz=cpv:45&strana=1
  → seznam VZ s id, názvem, CPV, hodnotou, zadavatelem
  → paginate přes strana=1,2,3...

Krok 2: Detail VZ → dokumenty
  GET /api/v2/verejnezakazky/{id}
  → pole dokumentURL[] s odkazy na zadávací dokumentaci
  → odkaz typicky vede na profil zadavatele

Krok 3: Stáhnout xlsx z dokumentURL
  → filtrovat pouze .xlsx/.xls soubory
  → stáhnout do GCS / lokálního storage
  
ALTERNATIVA: Registr smluv
  GET /api/v2/smlouvy/hledat?dotaz=stavební+práce+soupis
  → smlouvy s přílohami (Prilohy[].odkaz → xlsx URL)
  → přímé stažení xlsx
```

### Rate limiting a etika
- Nestahovat častěji než 1 request / 10 sekund
- Data pod CC BY 3.0 — uvádět "Zdroj: Hlídač státu (hlidacstatu.cz)"
- NESTAHOVAT ceny z oceněných rozpočtů
- Pro velké objemy kontaktovat api@hlidacstatu.cz

---

## 4. Pipeline — 5 kroků

### Krok 1: Inventarizace + Index

**Lokální smetы:**
```
1. Sken adresáře/storage s existujícími xlsx
2. Pro každý soubor: detekce formátu (Komplet/RTSROZP/jiný)
3. Metadata: název, datum, odhadnutý typ objektu
4. Uložit do tabulky `rozpocet_source`
```

**Hlídač státu:**
```
1. Search: cpv:45, paginate všechny stránky
2. Pro každou VZ: id, název, CPV, hodnota_czk, zadavatel
3. Detail VZ → hledat URL na xlsx v dokumentech
4. Alternativně: search Registr smluv → Prilohy s xlsx
5. Uložit do tabulky `rozpocet_source`
```

### Krok 2: Download

```
Pro každý záznam v rozpocet_source kde stav="pending":
1. Stáhnout xlsx (lokální soubory jen zkopírovat)
2. Uložit do GCS bucket / lokální adresář
3. Aktualizovat stav: "downloaded" / "failed"
4. Rate limiting pro Hlídač státu zdroje
```

### Krok 3: Parse

```
Pro každý stažený xlsx:
1. Detekce formátu:
   - Cell A1 == "Export Komplet" → xlsx_komplet parser
   - Cell A1 == "#RTSROZP#" → xlsx_rtsrozp parser  
   - Heuristika: sloupce Kód/Popis/MJ → generic parser
   - Jinak → skip + log
   
2. Parsování → pole položek:
   - kod_raw (string, jak je v souboru)
   - popis (string)
   - popis_detail (string, PP řádky)
   - mj (string)
   - mnozstvi (float | null pro slepé rozpočty)
   - typ_zaznamu (K, PP, VV, D, M...)
   - dil_nazev (text nadřazeného dílu)
   - cenova_soustava (CS ÚRS 20XX XX)
   - vv_formule[] (VV řádky — formule výkazu výměr)

3. Uložit do tabulky `rozpocet_polozky`
```

### Krok 4: Normalize

```
Pro každou položku:
1. Normalizace kódu:
   - Odstranit mezery, pomlčky
   - Oddělit prefix (D/M/P/R) od číslic
   - Klasifikace systému:
     * otskp.db lookup → OTSKP (conf=1.0)
     * 9 číslic bez prefix → ÚRS (conf=0.95)
     * suffix R/R00 → R-položka (vlastní)
     * krátký (4-5 číslic) → možná RTS (conf=0.70)

2. Hierarchie z kódu:
   - ÚRS: dil_3 = první 3 číslice (HSV/PSV díl)
   - ÚRS: dil_6 = prvních 6 číslic (pododdíl)
   
3. Klasifikace typu práce (regex po popisu):
   "beton|betonáž"          → BETON
   "výztuž|armatur"         → VYZTUŽ
   "bedněn"                 → BEDNĚNÍ
   "zatepl|etics|kzs"       → ZATEPLENÍ
   "omít"                   → OMÍTKY
   "izolac|hydroizolac"     → IZOLACE
   "bourán|demontáž"        → BOURÁNÍ
   "lešen"                  → LEŠENÍ
   "přesun hmot"            → PŘESUNY
   "výkop|hlouben|zemní"    → ZEMNÍ_PRÁCE
   "pilot|mikropilot"       → PILOTY
   "základy|základov"       → ZÁKLADY
   "zdivo|zdění|příčk"      → ZDĚNÍ
   "sádrokart|suché výstav" → SDK
   "obklad|dlažb"           → OBKLADY
   "malb|nátěr"             → MALBY_NÁTĚRY
   "klempíř|oplech|žlab"    → KLEMPÍŘSKÉ
   "zámečn|ocel.*konstr"    → ZÁMEČNICKÉ
   "truhlář|okn|dveř"       → TRUHLÁŘSKÉ
   "elektro|kabel|rozvad"   → ELEKTRO
   "vodovod|kanalizac|zti"  → ZTI
   "vzduchotech|vzt"        → VZT
   "vytápěn|kotel|radiát"   → ÚT
   "odvoz|skládkovné|suť"   → LIKVIDACE
   ...30+ kategorií
   
4. Uložit do `rozpocet_polozky_norm`
```

### Krok 5: Work Package Builder (klíčový!)

```python
# Pseudo-kód

# 1. Co-occurrence matice
# Pro každou ZAKÁZKU (ne soubor — jedna zakázka může mít více souborů):
for zakazka in zakazky:
    kody = get_unique_kody_3(zakazka.id)  # první 3 číslice = díl-level
    for k1, k2 in combinations(kody, 2):
        cooccurrence_dil[k1][k2] += 1

    kody_6 = get_unique_kody_6(zakazka.id)  # prvních 6 číslic
    for k1, k2 in combinations(kody_6, 2):
        cooccurrence_detail[k1][k2] += 1

# 2. Normalizace: frequency = count / min(total_k1, total_k2)
# frequency = "jak často se k2 vyskytuje KDYŽ je k1"

# 3. Hierarchické clustering:
# Level 1: dil_3 skupiny (hrubé balíčky: "fasádní práce", "zemní práce")
# Level 2: dil_6 skupiny (detailní: "zateplení EPS", "zateplení MW")  
# Level 3: plné kódy (konkrétní položky v balíčku)

# 4. Identifikace rolí:
# "anchor" = položka s nejvyšší frekvencí v klasteru (90%+ zakázek)
# "companion" = vždy když je anchor (>70%)
# "conditional" = někdy (40-70%)
# "rare" = specifická varianta (<40%)

# 5. Detekce companion packages:
# Pokud cluster A a cluster B se vyskytují společně v >80% zakázek
# → A je companion B (nebo naopak)
# Příklad: ETICS cluster + LEŠENÍ cluster → companion

# 6. AI naming:
# Gemini Flash: "Pojmenuj tento cluster položek: [top 5 popisů]"
# Fallback: nejčastější slovo z popisů anchor položek

# 7. Detekce alternativních variant:
# Pokud v některých zakázkách místo 10 detailních ÚRS kódů
# je 1 R-položka s "kompletní systém" → alternativní varianta
```

**Příklad výstupu Work Package:**

```json
{
  "package_id": "WP-ETICS-001",
  "name": "Zateplení kontaktním systémem ETICS",
  "source_stats": {
    "total_zakazky_analyzed": 2847,
    "detected_in": 891,
    "from_local_collection": 12,
    "from_hlidac_statu": 879
  },
  "confidence": 0.92,
  
  "trigger_keywords": ["zateplení", "etics", "kzs", "kontaktní", "tepelná izolace fasády"],
  
  "items": {
    "anchor": [
      {"dil_pattern": "62221*", "role": "montáž_izolantu", "frequency": 0.97,
       "typical_popis": "Montáž kontaktního zateplení vnějších stěn lepením a kotvením"}
    ],
    "companion": [
      {"dil_pattern": "62213*", "role": "penetrace", "frequency": 0.94},
      {"dil_pattern": "6225*",  "role": "omítka_tenkovrstvá", "frequency": 0.91},
      {"dil_pattern": "62225*", "role": "příplatek_zápustná", "frequency": 0.78},
      {"dil_pattern": "62215*", "role": "penetrace_pod_omítku", "frequency": 0.85}
    ],
    "conditional": [
      {"dil_pattern": "622511*", "role": "mozaiková_omítka_sokl", "frequency": 0.45,
       "condition_hint": "soklová část"},
      {"dil_pattern": "62222*", "role": "minerální_vlna", "frequency": 0.35,
       "condition_hint": "požární pásы, MW místo EPS"}
    ]
  },
  
  "companion_packages": [
    {"package_id": "WP-LESENI-001", "frequency": 0.96},
    {"package_id": "WP-PRESUNY-PSV-001", "frequency": 0.88}
  ],
  
  "alternative_variant": {
    "description": "Souhrnná D+M položka (R-kód) místo detailního rozkladu",
    "detected_in": 312,
    "frequency_vs_detailed": 0.35,
    "marker": "R-položka s 'kompletní systém' v popisu"
  },
  
  "typical_mj": "m2",
  "typical_dily": ["62", "713"],
  "cpv_correlation": ["45320000", "45443000"]
}
```

---

## 5. Datový model

```sql
-- Zdroje rozpočtů (oba zdroje v jedné tabulce)
rozpocet_source (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,        -- "local" | "hlidac_vz" | "hlidac_smlouva"
  
  -- Lokální
  local_path TEXT,                  -- cesta k xlsx
  
  -- Hlídač státu
  hlidac_id TEXT,                   -- ID zakázky/smlouvy v Hlídači
  hlidac_url TEXT,                  -- URL na Hlídači
  document_url TEXT,                -- přímý URL xlsx
  
  -- Metadata (společné)
  nazev TEXT,
  cpv TEXT,
  typ_objektu TEXT,                 -- "bytovy_dum" | "hala" | "most" | "sanace"
  typ_prace_hlavni TEXT,            -- "novostavba" | "rekonstrukce" | "zatepleni"
  hodnota_czk NUMERIC,
  rok INTEGER,
  zadavatel TEXT,
  
  -- Stav zpracování
  format TEXT,                      -- "xlsx_komplet" | "xlsx_rtsrozp" | "unknown"
  gcs_path TEXT,
  download_status TEXT DEFAULT 'pending',
  parse_status TEXT DEFAULT 'pending',
  polozek_count INTEGER,
  parse_error TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  parsed_at TIMESTAMP
)

-- Normalizované položky
rozpocet_polozky (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES rozpocet_source(id),
  
  -- Surová data
  kod_raw TEXT,
  popis TEXT,
  popis_detail TEXT,
  mj TEXT,
  mnozstvi NUMERIC,
  
  -- Normalizovaná
  kod_norm TEXT,                    -- číselná část
  kod_prefix TEXT,                  -- D/M/P/R/NULL
  kod_system TEXT,                  -- "urs" | "otskp" | "rts" | "vlastni"
  kod_system_conf FLOAT,
  
  dil_3 TEXT,                       -- HSV/PSV díl (3 číslice)
  dil_6 TEXT,                       -- pododdíl (6 číslic)
  typ_prace TEXT,                   -- regex-classified
  
  poradi INTEGER,
  nadrazeny_dil TEXT
)

-- Co-occurrence matice
cooccurrence (
  kod_a TEXT,                       -- dil_3 nebo dil_6
  kod_b TEXT,
  level TEXT,                       -- "dil_3" | "dil_6" | "full"
  count INTEGER,
  frequency FLOAT,
  PRIMARY KEY (kod_a, kod_b, level)
)

-- Work Packages
work_packages (
  id SERIAL PRIMARY KEY,
  package_id TEXT UNIQUE,
  name TEXT,
  description TEXT,
  
  source_stats JSONB,               -- {total, detected_in, from_local, from_hlidac}
  confidence FLOAT,
  
  trigger_keywords TEXT[],
  items JSONB,                      -- {anchor[], companion[], conditional[]}
  companion_packages TEXT[],
  alternative_variant JSONB,
  
  typical_mj TEXT,
  typical_dily TEXT[],
  cpv_correlation TEXT[],
  
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
)
```

---

## 6. Technické rozhodnutí

### Kde to běží

| Komponenta | Kde | Proč |
|-----------|-----|------|
| Lokální inventarizace | Jednorázový script | Seed data |
| Hlídač API client | Core Engine / Cloud Run Job | Rate-limited batch |
| xlsx parser | Core Engine | Existující parsery |
| Normalizer | Core Engine | Přístup k otskp.db |
| WP Builder | Standalone Python batch | Analytika |
| WP DB | PostgreSQL (Cloud SQL) | Sdílená s Core |

### Rate limiting pro Hlídač státu
- Max 1 request / 10 sekund (dle dokumentace)
- Batch stahování přes Cloud Run Job (scheduled 1x/týden)
- Pro velké objemy: kontaktovat api@hlidacstatu.cz

### Inkrementální aktualizace
- Lokální smetы: jednorázový import + manuální doplňování
- Hlídač státu: týdenní batch (nové VZ od posledního data)
- WP Builder: přeběhne po každém batchi → confidence roste

---

## 7. Pre-implementation interview (povinné!)

1. **Hlídač státu registrace:** Máš už API token? Pokud ne — registrace je potřeba před implementací.

2. **Lokální smetы — kde leží?** V jednom adresáři? V cloudu? Kolik jich je přibližně?

3. **Hlídač VZ detail:** Endpoint `/api/v2/verejnezakazky/{id}` — obsahuje přímé URL na xlsx přílohy? Nebo jen odkaz na profil kde xlsx leží? (Potřeba ověřit na reálném záznamu.)

4. **Registr smluv vs VZ:** Které API je lepší zdroj xlsx? Smlouvy mají `Prilohy[]` s přímým URL. VZ mají `dokumentUrl` který může být HTML stránka. Otestovat obojí.

5. **Objem:** Kolik stavebních VZ vrací `cpv:45`? Stovky? Tisíce? Od toho závisí doba stahování.

6. **Co-occurrence threshold:** Minimální počet zakázek pro statisticky významný balíček — 20? 50?

7. **Existující parsery:** Zvládnou starší verze KROS exportů (2020-2023)? Nebo jen aktuální formát?

---

## 8. Acceptance Criteria

### 8.1 Lokální smetы

- **Všechny xlsx z lokální kolekce zpracovány. Parse success rate ≥ 80%.**
- **Každý soubor otagován: formát, typ objektu, rok.**

### 8.2 Hlídač státu

- **API client stáhne seznam VZ s CPV 45*. Minimálně 1000 záznamů.**
- **Z VZ detailů se podaří extrahovat URL na xlsx alespoň u 30% zakázek.**
- **Stažené xlsx se parsují existujícími parsery. Success rate ≥ 60% (neznámé formáty se logují).**

### 8.3 Normalizer

- **9-ciferný kód nalezený v otskp.db → OTSKP, confidence=1.0.**
- **R-kódy (suffix R/R00) → "vlastní", neklasfifikovat jako ÚRS.**
- **Regex klasifikace typu práce pokrývá ≥ 80% položek.**

### 8.4 Work Package Builder

- **Z 500+ rozpočtů minimálně 20 distinktních work packages s confidence > 0.7.**
- **"ETICS" balíček: penetrace + lepení + kotvení + armování + omítka — v tomto pořadí dle frekvence.**
- **"Lešení" detekován jako companion k fasádním balíčkům s frekvencí > 0.9.**
- **Alternativní varianta (souhrnná R-položka vs detailní ÚRS) detekována.**

### 8.5 Integrace

- **Work Packages dostupné přes Core API endpoint.**
- **Endpoint: `GET /api/v1/work-packages?keyword=zateplení` → matching packages.**
- **Unit testy s mock daty.**

---

## 9. Etapy realizace

### Etapa 1: PoC (1-2 dny)
- [ ] Registrace na hlidacstatu.cz, získat API token
- [ ] Otestovat `cpv:45` search — kolik VZ, jaká struktura
- [ ] Otestovat detail VZ — jsou tam URL na xlsx?
- [ ] Otestovat Registr smluv — jsou tam xlsx přílohy?
- [ ] Zparsovat 10 lokálních smět existujícími parsery
- [ ] **Go/No-Go rozhodnutí** na základě dostupnosti dat

### Etapa 2: Data Collection (3-5 dní)
- [ ] Import lokální kolekce → `rozpocet_source`
- [ ] Hlídač API client s paginací a rate limiting
- [ ] Downloader pro xlsx z obou zdrojů
- [ ] Batch parsování → `rozpocet_polozky`
- [ ] Cíl: 500+ úspěšně zparsovaných rozpočtů

### Etapa 3: Normalize + Analyze (3-5 dní)
- [ ] Normalizer: kódy, hierarchie, typ práce
- [ ] Co-occurrence matice (3 úrovně: dil_3, dil_6, full)
- [ ] Clustering → kandidáti na Work Packages
- [ ] AI naming (Gemini Flash)
- [ ] Export do PostgreSQL

### Etapa 4: API + Integrace (2-3 dny)
- [ ] Endpoint pro query Work Packages
- [ ] Propojení s TASK_TZ_to_Soupis_Pipeline
- [ ] End-to-end test: TZ → WP → soupis prací
- [ ] Dokumentace

---

## 10. Co NENÍ součástí

- Stahování a zpracování cen (pouze struktura: kódy, popisy, MJ)
- Real-time monitoring nových zakázek (v1 = batch)
- Stahování TZ a výkresů (PDF) — jiný pipeline
- Machine learning na predikci cen
- Vlastní profil scraper (nahrazeno Hlídačem státu)

---

## 11. Atribuce dat

Dle licence CC BY 3.0 CZ:
- Data z Hlídače státu: vždy uvádět "Zdroj: Hlídač státu (hlidacstatu.cz)"
- V API response i v UI kde se zobrazují Work Packages
- V exportech a reportech

---

## 12. Finální připomínka

**Data-driven přístup.** Nepisuj balíčky ručně. Co-occurrence z 1000+ reálných smět je objektivnější než expert judgment.

**Dva zdroje > jeden.** Lokální smetы = kvalita (verified, known context). Hlídač státu = kvantita (tisíce VZ). Kombinace dává nejlepší výsledek.

**Determinismus před AI.** CSV/xlsx parsing = deterministic. Co-occurrence = deterministic. AI jen pro naming klastrů.

Naming a strukturu souborů určuj podle existujících konvencí v repozitáři.
