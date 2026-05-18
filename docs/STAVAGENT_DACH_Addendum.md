# STAVAGENT — DACH Competitive Landscape Addendum
**Дополнение к:** `STAVAGENT_Competitive_Landscape_Cemex_CSC.md`
**Цель:** глубокий разбор DACH-специфичных конкурентов и стандартов для подготовки выхода на немецкий рынок (DE → AT → CH)
**Дата:** 2026-05-15

---

## Почему DACH структурно другой рынок

В отличие от CZ/SK (где доминирует пара ÚRS+KROS), DACH-рынок построен на **трёх обязательных слоях, которые невозможно обойти**:

1. **GAEB-Datenaustausch** — стандарт обмена данными между AVA-программами. XML-форматы X81–X86 для фаз тендера (Leistungsverzeichnis → Angebot → Auftrag → Abrechnung). Любой подрядчик и заказчик обязан уметь экспорт/импорт GAEB.
2. **VOB (Vergabe- und Vertragsordnung für Bauleistungen)** — правовой режим тендеров, аналог чешского ZZVZ, но с гораздо более жёсткой стандартизацией текстов.
3. **STLB-Bau** — каталог стандартизированных текстов работ. **С 1998 обязателен для всех федеральных строительных тендеров** (Bundeshochbau). Никакой партизанщины.
4. **DIN 276** — структура групп затрат (Kostengruppen), к которой привязаны все каталоги.

Это значит, что STAVAGENT не может прийти в DACH с собственным частным каталогом. Нужно либо интегрировать STLB-Bau / BKI / SIRADOS, либо экспортировать в их GAEB. Иначе сметчик не сможет ни передать тендер заказчику, ни принять оферту от субподрядчика.

---

## Tier 3 DACH — каталоговые стандарты

### 3.1 BKI — Baukosteninformationszentrum Deutscher Architektenkammern
- **Кто:** GmbH, основан 1996 архитектурными палатами немецких земель. Штаб-квартира Штутгарт.
- **Аудитория:** > 100,000 архитекторов в Германии — это **архитектурный** стандарт, не подрядческий.
- **Данные 2026:** >25,500 актуальных Baupreise по 100 Leistungsbereiche (новостройка + реновация); >1,000,000 статистических Kostenkennwerte по >150 типам зданий; >4,450 reference-объектов с фото; региональные коэффициенты для каждого Stadt-/Landkreis Германии + земель Австрии + стран Европы.
- **Принцип:** "von-mittel-bis" (min-средняя-max) цены, индекс на актуальный год, привязка к DIN 276.
- **Источник данных:** загружают **завершённые проекты** архитекторы-участники (community-driven).
- **Продукты:** BKI Baupreise online (web-app); BKI Kostenplaner (desktop статистика +1M значений + позиции с GAEB-экспортом X80/X82); BKI Energieplaner (для GEG-санирования).
- **Интеграция с STAVAGENT:** обязательна для архитектурной аудитории. GAEB-экспорт — критический интерфейс.
- Источник: <https://bki.de/>, <https://bki.de/bki-baupreise-online>, <https://bki.de/bki-kostenplaner>

### 3.2 STLB-Bau / DBD — Standardleistungsbuch (GAEB + DIN + Dr. Schiller & Partner)
- **Кто:** stack из трёх организаций: **GAEB** (Gemeinsamer Ausschuss Elektronik im Bauwesen, входит в DVA — Deutscher Vergabe- und Vertragsausschuss) пишет тексты при участии ~700 экспертов; **Dr. Schiller & Partner GmbH** (Дрезден) делает техническую реализацию; **DIN** издаёт.
- **Сила:** **верификованный гос-стандарт.** С 1998 STLB-Bau обязателен для федеральных Bundeshochbau-тендеров. С 2023-04 версии прописана новая Ersatzbaustoffverordnung (EBV).
- **Содержимое:** 77 Leistungsbereiche (некоторые источники упоминают до 100 в смежных продуктах); ~1,000,000 готовых текстов работ; "Dynamische BauDaten" — это не статические шаблоны, а **dynamic text generator**, который проверяет внутреннюю консистентность позиции при сборке.
- **Дополнения:** DBD-BauPreise (привязка цен), DBD-KostenAnsätze (Lohn/Material/Gerät breakdown), DBD-BIM Online (IFC + LV linking), STLB-BauZ (для Zeitvertragsarbeiten — рамочных договоров на регулярные работы).
- **Обновление:** 2 раза в год.
- **Vermarktung:** Дистрибуторы — все крупные AVA-вендоры (COSOBA, SIDOUN, NEVARIS, ARRIBA).
- **Интеграция с STAVAGENT:** STLB-Bau позиция приходит к сметчику уже выбранной заказчиком. STAVAGENT должен **уметь читать STLB-Bau XML позиции** (GAEB X81), классифицировать их, и предлагать pricing через свои engines + DBD-BauPreise.
- Источник: <https://www.gaeb.de/de/stlb-bau/>, <https://www.dbd.de/stlb-bau/>, <https://www.stlb-bau-online.de/>

### 3.3 SIRADOS — WEKA MEDIA GmbH
- **Кто:** Бренд WEKA MEDIA (Kissing). 40+ лет на рынке Baupreise.
- **Отличие от STLB-Bau:** SIRADOS — **частный** каталог, не государственный. Существует параллельно. У него **две версии**: Architekten (von-mittel-bis Baupreise) и Handwerker/Bauunternehmer (с разложением Lohn / Material / Gerät / Zeitwerte). Это и есть его киллер-фича — сразу под обе стороны рынка.
- **Объём:** >50,000 позиций. VOB-совместимые тексты, привязка к DIN 276, региональные Ortsfaktoren для городов / Landkreis / Bundesländer.
- **Обновление:** 3 раза в год (полный pool).
- **Покрытие:** Neubau, Altbau, Gebäudetechnik, Nichtwohnungsbau, Planerischer Tiefbau/GaLa, Asbestsanierung, Reinigung/Wartung.
- **Продукты:** SIRADOS 365 (online); SIRADOS Live Desktop; baupreise.de (online-DB через 50K позиций); печатное Baupreishandbuch (Band 1 Neubau / Band 2 Altbau).
- **Интеграция:** GAEB X81–X86 экспорт, drag&drop в основные AVA-программы (SIDOUN, AVA.relax и др.).
- **Интеграция с STAVAGENT:** аналогично STLB-Bau. SIRADOS — это альтернативный каталог, который сметчик может выбрать вместо STLB-Bau. STAVAGENT поддерживает оба через GAEB.
- Источник: <https://www.sirados.de/>, <https://shop.weka.de/bau-immobilien/baudaten-und-baukosten>

### 3.4 Heinze Baupreisinfo / Ausschreibungstext-Manager — Heinze GmbH (Celle)
- **Кто:** Heinze GmbH, 55 лет на рынке, информационные сервисы для строительства.
- **Что:** бесплатный online Ausschreibungstext-Manager с >340,000 Leistungsbeschreibungen, Ausschreibungstexte и Muster-LVs от ведущих производителей строительных продуктов; CAD-детали, продуктовые листы, каталоги производителей.
- **Отличие:** **производитель-bound** (как Rigips/PERI/DOKA, но как platform-aggregator). Это leadgen-канал производителей.
- **Обновление цен:** раз в год по индексу Destatis (не учитывает региональные/краткосрочные колебания).
- **Интеграция:** ассимилируется в SIDOUN Globe и другие AVA.
- Источник: <https://sidoun.de/unternehmen/partner/>

### 3.5 Baupreislexikon — F:data
- **Кто:** F:data, конкурент BKI/SIRADOS.
- **Подход:** dynamic-database, как DBD. Continuously редактируемые цены на основе текущих lohn/material/gerät факторов, а не post-hoc analysis завершённых тендеров (как BKI) или статистических средних (как DataDestatis).
- **Аудитория:** региональные орientation-prices для оферт, тендеров, cost control. Mobile-ready.
- **Note:** меньшая доля рынка против BKI/SIRADOS/STLB, но методологически интересен — динамический подход ближе к тому, что делает STAVAGENT через Perplexity-search для актуальных норм.

### Tier 3 DACH takeaway
> В DACH нет одного KROS-эквивалента. Сметчик выбирает каталог в зависимости от роли (BKI = архитектор; STLB-Bau = госзаказчик; SIRADOS = частный подрядчик; Heinze = поиск конкретного продукта). STAVAGENT должен поддерживать **все четыре через GAEB X81–X86**, не пытаясь заменить ни один. Vendor lock-in выглядит абсурдно после CZ-рынка (один KROS) — но это структурная реальность немецкого рынка.

---

## Tier 3.5 DACH — AVA software (программы, в которые встраиваются каталоги)

Это слой выше каталогов: программы, в которых сметчик собирает LV (Leistungsverzeichnis), вызывая позиции из BKI / STLB-Bau / SIRADOS через GAEB-интерфейс. Прямые аналоги KROS на чешском рынке.

### 3.5.1 SIDOUN Globe — SIDOUN International GmbH (Freiburg)
- **Что:** AVA-программа с фокусом на интеграцию каталогов. Поддерживает прямой импорт из SIRADOS, STLB-Bau, BKI, Heinze.
- **Сила:** позволяет автоматизированно обновлять цены в Stamm-LV через SIRADOS-каталог.
- **Аудитория:** архитекторы, проектировщики, средние GC.
- Источник: <https://sidoun.de/unternehmen/partner/>

### 3.5.2 AVA.relax — COSOBA GmbH (Darmstadt)
- **Что:** AVA-программа со встроенным интерфейсом к STLB-Bau и SIRADOS (через "STLB-Bau Online от DBD-Online" и SIRADOS прямые ссылки).
- **Сила:** GAEB-совместимость "из коробки".
- Источник: <https://www.cosoba.de/produkte/ausschreibungstexte/stlb-bau>, <https://www.cosoba.de/produkte/ausschreibungstexte/weka-sirados>

### 3.5.3 NEVARIS Bausoftware — NEVARIS Bausoftware GmbH (Bremen/Salzburg)
- **Что:** AVA, Kalkulation, Baufinanzcontrolling. Покрывает и DE, и AT.
- **Бренды в стеке:** NEVARIS Build (AVA+Kalkulation), NEVARIS Finance, NEVARIS BIM.
- **Note:** немецкий конкурент RIB iTWO в среднем сегменте.

### 3.5.4 ARRIBA / RIB iTWO 4.0 / iTWO costX
- Уже описаны в основном документе как Tier 4 (5D BIM enterprise). В DACH-контексте они также покрывают AVA-слой; ARRIBA — это исторический бренд RIB до ребрендинга в iTWO.

### 3.5.5 Прочие
- **California.pro** — другая немецкая AVA, упоминается реже.
- **Orca AVA** — отдельная нишевая программа.

---

## Австрия (AT)

### ÖNORM B 2061 — стандартизированный Leistungsbeschreibungen
- Австрийский аналог STLB-Bau, но с другим подходом — основан на ÖNORM-системе, не на DIN.
- Влияет на тендеры публичного сектора Австрии.
- NEVARIS активно работает в AT (Salzburg-офис) с этим стандартом.

### Auer Bausoftware
- Австрийская AVA-программа.

---

## Швейцария (CH)

### NPK CRB — Normpositionen-Katalog
- **Кто:** Schweizerische Zentralstelle für Baurationalisierung (CRB).
- **Что:** швейцарский аналог STLB-Bau, обязателен для большинства тендеров.
- **Особенность:** многоязычный (DE/FR/IT), что отражает швейцарскую специфику.
- **Note:** маленький рынок, но высокая платежеспособность и регуляторная дисциплина.

### Messerli BauWin / BauWin AVA
- Швейцарский AVA-software, интегрированный с NPK.

---

## Что это значит для STAVAGENT DACH entry

### Технические следствия
1. **GAEB X81–X86 экспорт — обязательный feature до выхода в DACH.** Не "nice to have", а вход в рынок. Без GAEB-экспорта STAVAGENT не сможет передать оферту немецкому заказчику.
2. **STLB-Bau intake** — STAVAGENT должен принимать STLB-Bau XML LV на входе (gov-issued тендер) и классифицировать позиции по 22→23 типам элементов. Это адаптация существующего OTSKP/ÚRS pipeline, но для другого XML-формата.
3. **DIN 276 mapping** — все cost groups STAVAGENT должны мапиться на DIN 276 (как сейчас мапятся на ZZVZ-структуру). Это **отдельная схема классификации**, параллельная чешской.
4. **DIN 18218** — у нас уже есть в Calculator (давление бетона на опалубку). Это уже DIN-стандарт, преимущество.
5. **DBD-BauPreise / SIRADOS pricing pipeline** — нужна интеграция как минимум одного, желательно двух (DBD как gov-default + SIRADOS как market-default).

### Стратегические следствия
1. **DACH — это не "scale CZ to bigger market".** Это другой стек, другой regulatory regime, другие vendors. Реалистично потратить 6–12 месяцев на GAEB/STLB/DIN-адаптацию **прежде** чем приходить с первым клиентом.
2. **AT-вход легче, чем DE.** Австрия меньше, NEVARIS обслуживает оба рынка, ÖNORM похожа на DIN, и культурно ближе к CZ через историческую общность Austro-Hungarian construction tradition (та же терминология: pilíř/Pfeiler, opěra/Widerlager, dřík/Schaft).
3. **CH — отдельный кейс.** Маленький рынок, высокая дисциплина, NPK обязателен. Заходить туда стоит после стабилизации DE/AT.
4. **Cemex DACH-следствие:** Cemex Deutschland — крупный игрок в немецком ready-mix-рынке. Pitch для Cemex CSC может включать DACH expansion roadmap как "после CZ доказательства мы готовы локализоваться под GAEB/STLB и продавать в страны, где Cemex уже крупный поставщик бетона".

---

## Обновлённая позиционная матрица DACH

| Capability | BKI | STLB-Bau | SIRADOS | Heinze | SIDOUN | AVA.relax | NEVARIS | RIB iTWO | **STAVAGENT (план DACH)** |
|---|---|---|---|---|---|---|---|---|---|
| Каталог позиций | архитектурные ref | gov-mandated тексты | private von-mittel-bis | производитель-bound | (использует каталоги) | (использует каталоги) | own | own | **читает все 4 через GAEB** |
| GAEB X81–X86 экспорт | X82 | native | native | через AVA | ✅ | ✅ | ✅ | ✅ | **ROADMAP** |
| DIN 276 mapping | native | через DBD | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **ROADMAP** |
| AI-классификация LV-позиций | — | — | — | — | — | — | — | partial | ✅ |
| DIN 18218 давление бетона | — | — | — | — | — | — | — | — | ✅ |
| Crew sizing (with §116 ZP equivalent) | — | — | — | — | — | — | — | — | ✅ |
| Monte Carlo, RCPSP | — | — | — | — | — | — | — | partial | ✅ |
| Multi-vendor formwork engineering | — | — | — | — | — | — | — | — | ✅ |

---

## Дополнительные источники

- BKI основной сайт: <https://bki.de/>
- BKI Baupreise online: <https://bki.de/bki-baupreise-online>
- BKI Kostenplaner: <https://bki.de/bki-kostenplaner>
- BKI Baupreisindex: <https://bki.de/baupreisindex>
- BKI Bayerische Architektenkammer описание: <https://www.byak.de/planen-und-bauen/architektur-technik/baukosteninformationszentrum-bki.html>
- GAEB STLB-Bau официально: <https://www.gaeb.de/de/stlb-bau/>
- STLB-Bau Online: <https://www.stlb-bau-online.de/>
- DBD STLB-Bau (Dr. Schiller & Partner): <https://www.dbd.de/stlb-bau/>
- DBD STLB-BauZ (Zeitvertragsarbeiten): <https://www.dbd.de/stlb-bauz/>
- STLB-Bau описание в gaeb-tools: <https://gaeb-tools.de/das-standardleistungsbuch-im-bauwesen-stlb/>
- SIRADOS основной: <https://www.sirados.de/>
- SIRADOS Architektur Premium: <https://shop.weka.de/sirados-architektur-premium>
- SIRADOS Bauunternehmer Premium: <https://shop.weka.de/sirados-bauunternehmer-premium>
- SIRADOS Neubau тексты: <https://shop.weka.de/sirados-ausschreibungstexte-neubau>
- SIRADOS Kalkulation Ausbau: <https://shop.weka.de/sirados-kalkulationsdaten-ausbau>
- SIRADOS через COSOBA AVA.relax: <https://www.cosoba.de/produkte/ausschreibungstexte/weka-sirados>
- STLB-Bau через COSOBA AVA.relax: <https://www.cosoba.de/produkte/ausschreibungstexte/stlb-bau>
- SIDOUN партнёры (включая BKI, SIRADOS, DBD, Heinze): <https://sidoun.de/unternehmen/partner/>
- Сравнение Baupreis-Datenbanken (Magazin Quartier): <https://www.magazin-quartier.de/article/baupreis-datenbanken-komfortabel-und-sicher-ermittelt/>
- STLB-Bau новости (Vergabe24): <https://www.vergabe24.de/service/news/stlb-bau-in-neuer-version/>

---

## Открытые вопросы для DACH-стратегии

1. **GAEB-первый или AT-первый?** Тратить ли первые 6 месяцев на GAEB-адаптацию для DE, или сразу искать AT-партнёра (NEVARIS?) и заходить через Salzburg.
2. **STLB-Bau intake vs. emit?** Можно начать только с **чтения** STLB-Bau XML (для классификации тендеров) — это меньшая работа, чем экспорт в GAEB. Сметчик берёт STAVAGENT для предтендерного анализа, потом перебивает результат в свой AVA.
3. **OEM-стратегия?** Не выходить под брендом stavagent.cz в DACH, а партнёриться с SIDOUN / COSOBA / NEVARIS как white-label AI-слой над их AVA-программами. Это решение про бренд и go-to-market, не про технологию.
4. **Цемексовский след в DACH:** Cemex Deutschland имеет ready-mix-сеть в баварии/баден-вюртемберге. Может быть прямой канал в эти регионы через Cemex CSC-партнёрство.
