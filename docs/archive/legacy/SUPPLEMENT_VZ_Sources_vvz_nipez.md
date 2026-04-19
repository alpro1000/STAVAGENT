# ДОПОЛНЕНИЕ к TASK_VZ_Scraper_WorkPackages_v3

**Дата:** 30.03.2026
**Что:** Третий источник данных — REST API vvz.nipez.cz (Věstník veřejných zakázek)
**Зачем:** CPV-klasifikace work packages + прямой доступ к VZ metadata без оплаты

---

## Третий источник: vvz.nipez.cz REST API

### Что это

Внутренний API сайта Věstníku veřejných zakázek. **Публичный, без авторизации, без rate limit документации.** Это прямой государственный источник — не через Hlídač státu.

### Endpoint

```
GET https://api.vvz.nipez.cz/api/submissions/search
```

### Параметры для строительных VZ

```
formGroup=vz
form=vz
workflowPlace=UVEREJNENO_VVZ
data.cpvVzACasti=45                    ← CPV 45 = stavební práce
data.druhFormulare=16                  ← 16=объявление, 29=результат
page=1&limit=100
order[data.datumUverejneniVvz]=DESC
```

### Пример запроса

```bash
curl "https://api.vvz.nipez.cz/api/submissions/search?formGroup=vz&form=vz&page=1&limit=50&workflowPlace=UVEREJNENO_VVZ&data.cpvVzACasti=45&order%5Bdata.datumUverejneniVvz%5D=DESC"
```

### Что возвращает

```json
{
  "id": "f556e2e4-...",
  "variableId": "F2026-016310",
  "data": {
    "evCisloZakazkyVvz": "Z2026-016310",
    "nazevZakazky": "SŠ stavební Třebíč - Oprava povrchů nádvoří",
    "druhFormulare": "16",
    "zadavatele": [{"ico": "70890749", "nazev": "Kraj Vysočina"}],
    "dodavatele": [{"ico": "28745400", "nazev": "JKNstavby s.r.o."}],
    "datumUverejneniVvz": "2026-03-30T12:30:01+02:00",
    "lhutaNabidkyZadosti": "2026-05-04T10:00:00+02:00"
  }
}
```

### Фильтрация по CPV подкатегориям

```
data.cpvVzACasti=45     → все строительные
data.cpvVzACasti=4521   → pozemní stavby
data.cpvVzACasti=4522   → inženýrské stavby (mosty, silnice)
data.cpvVzACasti=4531   → elektroinstalace
data.cpvVzACasti=4532   → izolační práce (ETICS!)
data.cpvVzACasti=4533   → instalatérské práce (ZTI, VZT, ÚT)
data.cpvVzACasti=4541   → omítkářské práce
data.cpvVzACasti=4542   → truhlářské práce (okna, dveře)
```

---

## Дополнительный источник: ISVZ Open Data ZIP

Годовые и месячные дампы VZ в JSON:

```
https://isvz.nipez.cz/sites/default/files/content/opendata-rvz/VZ-2025_rocni.zip
https://isvz.nipez.cz/sites/default/files/content/opendata-rvz/VZ-01-2026.zip
https://isvz.nipez.cz/sites/default/files/content/opendata-rvz/VZ-02-2026.zip
```

Обновляется 5-го числа каждого месяца. Формат JSON внутри ZIP.

---

## Как три источника работают вместе

```
ИСТОЧНИК 1: vvz.nipez.cz API          ИСТОЧНИК 3: Собственная коллекция
  │ VZ metadata: název, CPV,            │ xlsx — уже распарсенные
  │ zadavatel IČO, dodavatel IČO        │
  └──────────┬──────────────────────────┘
             │
             │  JOIN по IČO zadavatele/dodavatele + název stavby
             ▼
ИСТОЧНИК 2: Hlídač státu — Smlouvy API
  │ Smlouvy o dílo s přílohami
  │ PlainTextContent = ÚRS kódy, MJ, množství, VV
  │
  └──→ Normalizované položky
       + CPV tag z VZ metadata (!)
             │
             ▼
       Co-occurrence → Work Packages
       (s CPV kontextem!)
```

### Ключевой бонус: CPV-tagged Work Packages

Без VZ metadata balíčky nemají kontext — nevíme jestli balíček "betonáž" pochází z bytového domu nebo z mostu. S CPV klasifikací:

```json
{
  "package_id": "WP-BETON-ZAKLADY-001",
  "name": "Betonáž základových konstrukcí",
  "cpv_correlation": ["45262300"],
  "typical_object_types": ["pozemní stavby", "bytové domy"]
}
```

vs

```json
{
  "package_id": "WP-BETON-MOSTY-001", 
  "name": "Betonáž mostních konstrukcí",
  "cpv_correlation": ["45221100"],
  "typical_object_types": ["mosty", "inženýrské stavby"]
}
```

Stejný typ práce (betonáž) ale jiný kontext → jiné companion items (mosty mají ložiska a závěry, budovy ne).

---

## Postup JOIN mezi VZ a Smlouvami

```python
# Pseudo-kód

# 1. Z vvz.nipez.cz: stáhnout VZ s CPV:45, extrahovat IČO + název
vz_list = fetch_vvz("data.cpvVzACasti=45&data.druhFormulare=29")  # výsledky
for vz in vz_list:
    ico_zadavatel = vz["data"]["zadavatele"][0]["ico"]
    ico_dodavatel = vz["data"]["dodavatele"][0]["ico"]  
    nazev = vz["data"]["nazevZakazky"]
    cpv = "45..."  # z parametru nebo z detailu

# 2. Na Hlídači: najít smlouvu mezi zadavatelem a dodavatelem
smlouvy = hlidac_search(f"ico:{ico_zadavatel} ico:{ico_dodavatel}")
# nebo fulltext: hlidac_search(f'"{nazev[:30]}"')

# 3. JOIN: přiřadit CPV kód ke smlouvě → ke všem položkám z přílohy
for smlouva in smlouvy:
    polozky = parse_plaintext(smlouva.prilohy)
    for p in polozky:
        p.cpv_tag = cpv  # z VZ metadata
```

---

## Co přidat do datového modelu

```sql
-- Rozšířit rozpocet_source o CPV
ALTER TABLE rozpocet_source ADD COLUMN cpv_hlavni TEXT;
ALTER TABLE rozpocet_source ADD COLUMN cpv_doplnkove TEXT[];
ALTER TABLE rozpocet_source ADD COLUMN vz_ev_cislo TEXT;      -- Z2026-XXXXXX
ALTER TABLE rozpocet_source ADD COLUMN vz_nazev TEXT;
ALTER TABLE rozpocet_source ADD COLUMN dodavatel_ico TEXT;
ALTER TABLE rozpocet_source ADD COLUMN dodavatel_nazev TEXT;

-- Index pro JOIN
CREATE INDEX idx_rozpocet_source_zadavatel ON rozpocet_source(zadavatel);
CREATE INDEX idx_rozpocet_source_cpv ON rozpocet_source(cpv_hlavni);

-- Work Packages: přidat CPV korelaci
-- (už je v JSONB, ale explicitní sloupec pro filtrování)
ALTER TABLE work_packages ADD COLUMN cpv_correlation TEXT[];
CREATE INDEX idx_wp_cpv ON work_packages USING GIN(cpv_correlation);
```

---

## Etapa integrace (přidat do plánu)

### Kdy: PO Etapě 2 (po sběru smluv), PŘED Etapou 3 (normalizace)

**Etapa 2.5: VZ metadata enrichment**

```
1. Stáhnout VZ s CPV:45 z vvz.nipez.cz (form_type=29, výsledky)
   → evCisloZakazky, nazev, CPV, IČO zadavatele/dodavatele
   
2. Pro každou smlouvu v rozpocet_source:
   → Najít matching VZ (by IČO + název)
   → Přiřadit CPV kód
   
3. Výsledek: rozpocet_source.cpv_hlavni vyplněno u X% záznamů
```

### Acceptance criteria

- **VZ API vrací data bez chyb. Pagrace funguje.**
- **CPV klasifikace přiřazena alespoň u 30% smluv z Hlídače (ne všechny půjdou JOINnout).**
- **Work Packages mají cpv_correlation vyplněnou z dat.**

---

## Rate limiting

- vvz.nipez.cz: **žádný dokumentovaný limit**, ale být slušný — max 5 req/sec
- ISVZ dumps: žádný limit (přímé stažení ZIP)
- Hlídač státu: 1 req / 10 sec (beze změny)
