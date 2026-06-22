# SO 202 D6 OV–Žalmanov — TZ facts: technologie výstavby (verbatim výpis)

> **Provenance:** extracted verbatim from
> `test-data/SO_202_D6_OV_Z/202_01_TechnickaZprava.pdf` (pdftotext),
> 2026-06-12. Page numbers = PDF page order (form-feed count).
> Purpose: quote source for Part B validation-rule fixtures (TEMPORARY
> Žalmanov fixture until the full Part C golden) + target phrases for the
> Part C regex extractor. The PDF itself stays behind the test-data deny
> rules — this md is the always-readable digest.

## Technologie výstavby NK

### §4.1.6 Nosná konstrukce (str. 11)

> „Výstavba nosné konstrukce se předpokládá na pevné skruži ve třech
> etapách. Výstavba je uvažována ve směru od O1 k O4. Postup výstavby
> může budoucí zhotovitel upravit dle svých možností a potřeb."

(Poslední věta je doménově klíčová pro Part B: TZ SÁM říká, že odchylka
zhotovitele je legitimní → validation rule = viditelný flag, nikdy gate.)

### §4.1.6 / předpětí (str. 11)

> „Odskružení daného taktu je možné až po napnutí všech kabelů v daném
> taktu."

### §5.1 Výstavba mostu — bod postupu (str. 15)

> „Betonáž a předepnutí nosné konstrukce budované na pevné skruži
> postupně od opěry O1."

## Strukturované faktum (vstup pro validation rule)

```yaml
construction:
  technology: fixed_scaffolding        # pevná skruž
  pour_stages_count: 3                 # ve třech etapách (směr O1 → O4)
  quote: "Výstavba nosné konstrukce se předpokládá na pevné skruži ve třech etapách."
  anchor: "TZ §4.1.6, str. 11"
  corroborating:
    - quote: "Betonáž a předepnutí nosné konstrukce budované na pevné skruži postupně od opěry O1."
      anchor: "TZ §5.1, str. 15"
```
