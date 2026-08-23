# PostFinance Budgetrechner — API

Alle Endpoints sind **öffentlich und ohne Authentifizierung** erreichbar (Stand 2026-08-22,
gegen Produktion getestet). Kein Cookie, kein Token, kein CSRF-Header nötig.

Basis: `https://www.postfinance.ch/pfch/rest/api`

---

## 1. Steuerort-Suche (Autocomplete)

```
GET /calculator/logicalc/tax/searchTaxLocation/{searchText}
```

`searchText` ist PLZ **oder** Ortsname (die App entfernt vorher `['^`%|{}[]]`).

```bash
curl -s https://www.postfinance.ch/pfch/rest/api/calculator/logicalc/tax/searchTaxLocation/3011
```
```json
{"result":[{"canton":"BE","city":"Bern","taxLocationID":301100000,"zipCode":"3011"}]}
```

Die App mappt das auf `field1 = zipCode`, `field2 = city`, `hiddenField = taxLocationID`.
`taxLocationID` muss zur PLZ/Ort-Kombination passen, sonst `ErrorTaxlocationCombo`.

> Verwandte Endpoints derselben Familie: `/searchZipCodeCity`, `/searchZipCodeCityExtended`,
> `/searchStreet` — für den Budget-Wizard nicht nötig.

---

## 2. Budget berechnen

```
POST /calculator/logicalc/finance/budget-calculator/calculateBudget
Content-Type: application/json
```

Body = `informationForm.getRawValue()`, also **alle 13 Felder** (auch die versteckten):

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  https://www.postfinance.ch/pfch/rest/api/calculator/logicalc/finance/budget-calculator/calculateBudget \
  -d '{
    "civilStatus": "1", "children": "0",
    "zipCode": "3011", "city": "Bern", "taxLocationId": 301100000,
    "sex": "1", "year": 2008, "grossYearIncome": 85000, "denomination": "4",
    "sexPartner": "2", "yearPartner": 2008,
    "grossYearIncomePartner": null, "denominationPartner": null
  }'
```

```json
{"result":{
  "display":"1",
  "householdIncomeNetMonth":6559,"householdIncomeNetYear":78706,
  "sumExpensesMonth":6518,"sumExpensesYear":78216,
  "savingQuoteMonth":41,"savingQuoteYear":490,
  "taxesMonthAmount":1090,"taxesYearAmount":13081,"taxesUUID":"6570…",
  "resideMonthAmount":1642,"resideYearAmount":19702,"resideUUID":"4557…",
  "insuranceMonthAmount":287,"insuranceYearAmount":3434,"insuranceUUID":"8fa6…",
  "healthMonthAmount":654,"healthYearAmount":7850,"healthUUID":"0c00…",
  "mobilityMonthAmount":790,"mobilityYearAmount":9481,"mobilityUUID":"90ff…",
  "consumptionMonthAmount":2054,"consumptionYearAmount":24647,"consumptionUUID":"2ff6…"
}}
```

Hinweise:

- `display` kommt immer als `"1"` (Monatsansicht) zurück.
- `children` ist ein **String** (`"0"`–`"5"`), `grossYearIncome`/`taxLocationId`/`year` sind Zahlen.
- Bei `civilStatus = "1"` dürfen die Partnerfelder `null` sein; sonst müssen
  `grossYearIncomePartner` und `denominationPartner` gesetzt sein.
- Die `*UUID`-Felder sind Kategorie-Handles des Backends — unverändert an `updateBudget`
  zurückschicken.

### Fehlerantwort (HTTP 422)

```json
{"messages":{"error":[
  {"code":"500","data":{"fieldName":"grossYearIncome","translationKey":"ErrorNotNull","replacments":{}},
   "text":"Invalid input parameters: must not be null"},
  {"code":"500","data":{"fieldName":"year","translationKey":"ErrorBudgetCalculatorAge","replacments":{}},
   "text":"Invalid input parameters: yearInvalid"}
]}}
```

Code `501` = globaler Fehler (Banner), alles andere = Feldfehler.

---

## 3. Budget nachrechnen

```
POST /calculator/logicalc/finance/budget-calculator/updateBudget
```

Body = das **komplette** Budget-Objekt aus `calculateBudget` (inkl. UUIDs), mit den vom
User geänderten Beträgen. Antwort ist dasselbe Objekt, konsistent nachgerechnet.

Gemessenes Verhalten bei `display = "1"` (Monatsansicht):

| Feld | Regel |
|---|---|
| `<key>YearAmount` | `= <key>MonthAmount × 12` (überschreibt gesendete Jahreswerte!) |
| `sumExpensesMonth` | `= Σ der sechs MonthAmounts` |
| `sumExpensesYear` | `= sumExpensesMonth × 12` |
| `savingQuoteMonth` | `= householdIncomeNetMonth − sumExpensesMonth` |
| `savingQuoteYear` | `= householdIncomeNetYear − sumExpensesYear` |
| `householdIncomeNet*` | unverändert durchgereicht |

Bei `display = "2"` gilt spiegelbildlich `MonthAmount = round(YearAmount / 12)`.

Beispiel (Konsum von 1'977 auf 2'500 erhöht):

```
in : consumptionMonthAmount 2500, sumExpensesMonth 6276, savingQuoteMonth   39
out: consumptionYearAmount 30000, sumExpensesMonth 6800, savingQuoteMonth -485
     sumExpensesYear 81600, savingQuoteYear -5817
```

> Der Call ist reiner Arithmetik-Service — wir können ihn 1:1 lokal nachbauen
> (siehe [`src/model.ts`](src/model.ts)) und brauchen ihn nur, wenn wir bitgenau
> PostFinance-konform bleiben wollen.

---

## 4. Labels / i18n

```
GET /pfch/keyvalue-provider/api/i18n/{lang}/{context}
```

Für den Budgetrechner: `context = webapps.calculator.logicalc.finance.budgetcalculator`,
`lang ∈ {de, en, fr, it}`.

```bash
curl -s https://www.postfinance.ch/pfch/keyvalue-provider/api/i18n/de/webapps.calculator.logicalc.finance.budgetcalculator
```

161 Keys: Feldlabels, Kategorienamen, Enums (`civilStatusEnum.1.1` = `"Alleinstehend"` —
Schema `<enum>.<index>.<value>`), plus `scr*`-Keys mit ganzen AEM-HTML-Fragmenten
(Tipp-Boxen, Tooltips). Kopien liegen in [`data/`](data/).

---

## 5. Rate-Limit / Fairness

Kein Limit beobachtet. Beim Sampling für dieses Verzeichnis liefen 4 parallele Requests
mit 120 ms Pause (≈ 1'200 Calls in ~8 min) ohne Drosselung oder Fehler. Trotzdem:
für die Demo aus dem **lokalen Modell** rechnen, nicht live gegen PostFinance.

## 6. Rechtliches

Der Rechner selbst weist darauf hin (`LegalNotice`):

> «Die Berechnung basiert auf Steuer- und Marktdaten die von Drittfirmen geliefert und
> aktualisiert werden. PostFinance übernimmt jedoch keine Gewähr für die Korrektheit,
> Vollständigkeit und Aktualität dieser Grundlagen.»

Die Referenzwerte stammen aus einem öffentlichen Rechner von PostFinance (dem
Challenge-Owner). Für den Hackathon-Prototyp ok; im Pitch benennen wir die Quelle.
Die Daten in `data/samples.jsonl` sind gemessene Ausgaben dieses Rechners, keine
PostFinance-Datenlieferung.
