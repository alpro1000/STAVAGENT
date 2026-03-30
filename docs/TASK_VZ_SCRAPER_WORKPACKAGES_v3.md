# TASK: VZ Scraper + Work Packages DB v3.0

**Status:** PLANNED
**Priority:** HIGH (data foundation for TZ→Soupis pipeline)
**Branch:** TBD (claude/vz-scraper-workpackages-XXXXX)

## Key Facts (from PoC 30.03.2026)

- `/api/v2/verejnezakazky/hledat` → **403 Forbidden** — DO NOT USE
- `/api/v2/smlouvy/hledat` → **200 OK** — PRIMARY SOURCE
- `/api/v2/smlouvy/{id}` → **200 OK** — Přílohy with PlainTextContent
- `/api/v2/dumps` → **200 OK** — full dump smluv 69MB
- **48K smluv** with "KRYCÍ LIST SOUPISU"
- **32K** with "CS ÚRS"
- **1K** with "Export Komplet"
- PlainTextContent of přílohy already contains structured data (codes, MJ, quantities, VV)
- API Token: `a2053f381a87460f826f67e7654534e1`
- License: CC BY 3.0 CZ — must attribute "Zdroj: Hlídač státu (hlidacstatu.cz)"
- Rate limit: 1 request / 10 seconds

## Stages

### Stage 1: PoC (GATE)
- Test Smlouvy API pagination
- Parse PlainTextContent from přílohy (extract URS codes, MJ, descriptions)
- Inventory existing parsers (xlsx_komplet, xlsx_rtsrozp)
- Parse 5-10 real přílohy
- **GO/NO-GO decision**

### Stage 2: Data Collection (GATE)
- Smlouvy API client with pagination + rate limiting
- PlainTextContent parser (extract codes/MJ/descriptions from text)
- Batch: 1000+ smluv → rozpocet_source + rozpocet_polozky
- Stats report

### Stage 3: Normalize + WP Builder (GATE)
- Normalizer (ÚRS 9-digit / OTSKP / R-položky / RTS)
- Regex work type classification (30+ categories)
- Co-occurrence matrix (dil_3, dil_6, full)
- Clustering → Work Packages
- AI naming (Gemini Flash)

### Stage 4: WP API (GATE)
- GET /api/v1/work-packages?keyword=...
- PostgreSQL tables (rozpocet_source, polozky, cooccurrence, work_packages)
- Unit tests with mock data

## SQL Schema

```sql
rozpocet_source (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,        -- "local" | "hlidac_smlouva"
  hlidac_id TEXT,
  document_url TEXT,
  nazev TEXT,
  cpv TEXT,
  typ_objektu TEXT,
  typ_prace_hlavni TEXT,
  hodnota_czk NUMERIC,
  rok INTEGER,
  zadavatel TEXT,
  format TEXT,
  download_status TEXT DEFAULT 'pending',
  parse_status TEXT DEFAULT 'pending',
  polozek_count INTEGER,
  parse_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  parsed_at TIMESTAMP
)

rozpocet_polozky (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES rozpocet_source(id),
  kod_raw TEXT,
  popis TEXT,
  popis_detail TEXT,
  mj TEXT,
  mnozstvi NUMERIC,
  kod_norm TEXT,
  kod_prefix TEXT,
  kod_system TEXT,
  kod_system_conf FLOAT,
  dil_3 TEXT,
  dil_6 TEXT,
  typ_prace TEXT,
  poradi INTEGER,
  nadrazeny_dil TEXT
)

cooccurrence (
  kod_a TEXT,
  kod_b TEXT,
  level TEXT,
  count INTEGER,
  frequency FLOAT,
  PRIMARY KEY (kod_a, kod_b, level)
)

work_packages (
  id SERIAL PRIMARY KEY,
  package_id TEXT UNIQUE,
  name TEXT,
  description TEXT,
  source_stats JSONB,
  confidence FLOAT,
  trigger_keywords TEXT[],
  items JSONB,
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

## Work Type Regex Categories (30+)

```
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
```

## Acceptance Criteria

1. Parse success rate ≥ 80% for local xlsx
2. 1000+ smluv from Hlídač státu API processed
3. 9-digit code in otskp.db → OTSKP conf=1.0
4. R-codes → "vlastní", not classified as ÚRS
5. 20+ distinct work packages with confidence > 0.7
6. "ETICS" package: penetrace + lepení + kotvení + armování + omítka
7. "Lešení" detected as companion to facade packages freq > 0.9
8. Work Packages accessible via Core API endpoint
