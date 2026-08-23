# PostFinance Budgetrechner — vollständige Spezifikation

Rekonstruiert am 2026-08-22 aus
<https://www.postfinance.ch/de/privat/anlegen/tools-rechner/budget-erstellen.html>
(Angular-Webapp `app-budget-calculator`, Webapp-ID **219**, gebündelt in
`https://www.postfinance.ch/pfch/ui/main.js`).

Alles hier ist **verifiziert**: Komponentencode aus dem Bundle extrahiert, Labels über den
i18n-Endpoint geholt, Rechenverhalten gegen die Live-API gemessen.

---

## 1. Aufbau

Zwei-Schritt-Stepper (`ui-stepper`), Schrittleiste ist ausgeblendet (`display=false`):

| Step | `stepId` | Komponente | Label-Key |
|---|---|---|---|
| 1 | `form` | `app-budget-calculator-information` | `StepInformation` |
| 2 | `result` | `app-budget-calculator-budget` | `StepResult` |

Übergang Step 1 → 2 nur über einen erfolgreichen `calculateBudget`-Call. Es gibt kein
Client-Rechenmodell: **jede Zahl kommt vom Backend.**

Analytics: `formId: "219"`, `formName: "Budgetrechner"`, Steps `information: "1"`, `budget: "2"`.

---

## 2. Step 1 — «Weitere Angaben»

### 2.1 Sichtbare Felder

| Reihenfolge | Feld | Control | UI | Pflicht | Bedingung |
|---|---|---|---|---|---|
| 1 | Lebensform | `civilStatus` | `ui-cardoption`, Radio, Icon-Kacheln | ja | immer |
| 2 | Kinder | `children` | `ui-range-slider` 0–5, Step 1 | ja | nach Wahl der Lebensform |
| 3 | Bruttoeinkommen/Jahr | `grossYearIncome` | Betrag, CHF | ja | ″ |
| 4 | Bruttoeinkommen/Jahr Partner:in | `grossYearIncomePartner` | Betrag, CHF | ja | nur wenn Partner:in |
| 5 | Konfession | `denomination` | Select | ja | ″ (immer sichtbar) |
| 6 | Konfession Partner:in | `denominationPartner` | Select | ja | nur wenn Partner:in |
| 7 | Steuerort | `zipCode` + `city` | `ui-autocomplete` (Typ `ZipCodeCityLogicalc`), PLZ klein / Ort gross | ja | immer |

- Die Felder 2–7 erscheinen erst, wenn `civilStatus !== null` (`displaySingle()`).
- Partner-Felder erscheinen wenn `civilStatus ∉ {null, "1"}` (`displayPartner()`).
- Labels wechseln bei Partnerschaft: `GrossYearIncome` → `GrossYearIncomePerson1`,
  `Denomination` → `DenominationPerson1`.
- Maxlängen: `zipCode` 10, `city` 27.
- Der Autocomplete setzt `taxLocationId` aus dem `hiddenField` der gewählten Option.
- Submit-Button: `ButtonNext` = «Berechnen», `type=submit`, `actionType=primary`.

### 2.2 Versteckte Felder mit Defaults

Diese sind im Formmodell, werden aber **nie gerendert** — sie gehen mit ihren Defaults an die API:

| Feld | Default | Wirkung |
|---|---|---|
| `sex` | `"1"` (männlich) | **keine** (gemessen: identisches Resultat für `"1"`/`"2"`) |
| `sexPartner` | `"2"` (weiblich) | keine |
| `year` | `aktuellesJahr − 18` (2026 → **2008**) | gross: steuert BVG-Abzug → Nettoeinkommen |
| `yearPartner` | `aktuellesJahr − 18` | dito für Partner:in |

> **Für unseren Wizard relevant:** PostFinance rechnet immer mit einer 18-jährigen Person,
> also *ohne* BVG-Abzug. Wir kennen das echte Alter und können `year` real setzen — die API
> akzeptiert das (Details in [`MODELL.md`](MODELL.md) §2).

### 2.3 Enums

```
civilStatus   1 Alleinstehend · 2 Verheiratet · 3 Konkubinat · 4 Eingetragene Partnerschaft
denomination  1 Reformiert · 2 Römisch-Katholisch · 3 Christ-Katholisch · 4 Konfessionslos · 9 Andere
sex           1 Männlich · 2 Weiblich
children      0 … 5
display       1 Monatsansicht · 2 Jahresansicht
```

Icon je Lebensform (`getCivilStatusIcon`): `1` → `person`, `2|3|4` → `people2`.
Der erste Enum-Eintrag («Bitte wählen») wird bei `civilStatus` per `shift()` entfernt.

### 2.4 Validierung

Die Angular-Controls haben **keine** Validatoren — validiert wird ausschliesslich serverseitig.
Bei Fehlern liefert die API HTTP **422** mit `messages.error[]`; jeder Eintrag mappt über
`data.fieldName` auf das Control und über `data.translationKey` auf den Fehlertext.

| translationKey | Bedeutung |
|---|---|
| `ErrorNotEmpty` | Pflichtfeld leer (`civilStatus`, `zipCode`, `city`, `denomination`) |
| `ErrorNotNull` | Pflichtfeld null (`grossYearIncome`) |
| `ErrorTaxlocationCombo` | `taxLocationId` passt nicht zu PLZ/Ort |
| `ErrorBudgetCalculatorAge` | `year` ergibt Alter < 18 |

Codes `501` gelten als globale Fehler, alles andere als Feldfehler.

---

## 3. Step 2 — «Ergebnis»

### 3.1 Kopfbereich

Tab-Umschalter `display` (Monats-/Jahresansicht), darunter eine Tabelle mit drei Zeilen:

| Zeile | Wert | Element-ID |
|---|---|---|
| Nettoeinkommen Haushalt (+ Tooltip) | `householdIncomeNet{Month,Year}` | `householdIncomeNet` |
| Ausgaben | `sumExpenses{Month,Year}` | `sumExpenses` |
| Einkommens-/Ausgabenüberschuss | `savingQuote{Month,Year}` | `savingQuote` |

Der Label-Key der dritten Zeile ist dynamisch: `savingQuote < 0` → `Overspending`
(«Ausgabenüberschuss»), sonst `IncomeSurplus` («Einkommensüberschuss»).

Formatierung: `toLocaleString("de-CH", {maximumFractionDigits: 0, useGrouping: true})`,
beim Überschuss zusätzlich `signDisplay: "exceptZero"`, Suffix `" CHF"`.

### 3.2 Die sechs Ausgabenkategorien

Reihenfolge, Icon und Detailfelder sind fix im Code:

| # | key | Titel | Icon | Detailfelder |
|---|---|---|---|---|
| 1 | `taxes` | Steuern | `calculator_moneyBag` | Steuern |
| 2 | `reside` | Wohnen | `houseWindows` | Miete · Hypothekarzinsen · Neben- und Unterhaltskosten |
| 3 | `insurance` | Versicherungen und Vorsorgen | `handshake` | Haftpflicht und Hausrat · Beiträge private Vorsorge · Weitere Versicherungen |
| 4 | `health` | Gesundheitskosten | `personMedal` | Krankenkasse · Medikamente, Franchise · Arzt, Spital, Therapie |
| 5 | `mobility` | Mobilität und Kommunikation | `train` | Fahrzeug, Leasing · Fahrzeugversicherung · Treibstoff und Unterhalt · Öffentlicher Verkehr · Telefon, TV, Radio, Internet |
| 6 | `consumption` | Konsum und Freizeit | `shoppingBasketGroceries` | Nahrungsmittel · Kleider und Schuhe · Ferien, Hobbies, Kultur · Weitere Ausgaben |

Jede Kategorie hat im Formmodell drei Felder: `<key>UUID`, `<key>MonthAmount`, `<key>YearAmount`.

### 3.3 Bearbeiten-Logik (`ui-input-card`)

- Toggle «Ausgaben bearbeiten» (`expensesEditable`) schaltet die Detailfelder frei.
- Detailfelder starten immer bei **0**, `min = 0`, `max = 5'000'000` (Monat) bzw.
  `60'000'000` (Jahr).
- Solange **kein** Detailfeld `dirty` ist, bleibt der Kategorientotal der Backend-Wert.
  Sobald eines angefasst wurde, gilt: `Total = Σ Detailfelder`.
- Monats- und Jahresansicht haben **je eigene** Kartensätze und Detailwerte.
- Jede Änderung an einem der zwölf `<key>{Month,Year}Amount`-Felder löst nach **300 ms
  Debounce** einen `updateBudget`-Call aus; die Antwort wird per
  `setValue(..., {emitEvent: false})` zurückgeschrieben.

### 3.4 Tipp-Boxen

`diff = Nettoeinkommen − Ausgaben` (in der aktuell gewählten Ansicht).

**Oben** (`getTopTip`)
| Bedingung | Key | Inhalt |
|---|---|---|
| `diff > 100` | `scrHintSavingPotential` | «Sparpotenzial nutzen» — Sparplan ab CHF 20.–/Monat |
| `diff > 0` | `scrHintLeeway` | «Mehr Spielraum schaffen» — einzelne Ausgaben prüfen |
| sonst | – | keine Box |

**Unten** (`getBottomTip`) — `ins` = Versicherungsbetrag, `res` = Wohnbetrag (gleiche Ansicht)
| Bedingung | Key | Inhalt |
|---|---|---|
| `diff > 0` und `0 < ins < 605` | `scrHintProvisionsPotential` | Spielraum bei privater Vorsorge |
| `diff > 0` und `ins == 0` | `scrHintProvisionsStart` | «Kleine Beiträge, grosse Wirkung» |
| `diff ≤ 0` und `res > 0` und `Netto / res < 3` | `scrHintLivingExpensesHigh` | Wohnkosten > 33 % des Einkommens |
| sonst | – | keine Box |

Die Magic Numbers im Bundle: `100` (Sparpotenzial-Schwelle), `605` (3a-Bezug, ≈ 7'258/12),
`3` (Kehrwert der 33-%-Wohnkostenregel), `300` (Debounce ms).

### 3.5 Aktionen

`Print` (`window.print()`, mit eigenem Print-Stylesheet), `ButtonNewCalculation`
(Formular zurücksetzen + zurück zu Step 1), `ButtonBack` (zurück, Eingaben behalten).

---

## 4. Formmodelle (1:1 aus dem Bundle)

```ts
// Step 1
informationForm = {
  civilStatus: null, children: "0", zipCode: null, city: null, taxLocationId: null,
  sex: "1", year: CURRENT_YEAR - 18, grossYearIncome: null, denomination: null,
  sexPartner: "2", yearPartner: CURRENT_YEAR - 18,
  grossYearIncomePartner: null, denominationPartner: null,
}

// Step 2 (wird komplett von calculateBudget befüllt)
budgetForm = {
  display: null,
  householdIncomeNetYear: null, householdIncomeNetMonth: null,
  sumExpensesYear: null, sumExpensesMonth: null,
  savingQuoteYear: null, savingQuoteMonth: null,
  taxesUUID: null,       taxesYearAmount: null,       taxesMonthAmount: null,
  resideUUID: null,      resideYearAmount: null,      resideMonthAmount: null,
  insuranceUUID: null,   insuranceYearAmount: null,   insuranceMonthAmount: null,
  healthUUID: null,      healthYearAmount: null,      healthMonthAmount: null,
  mobilityUUID: null,    mobilityYearAmount: null,    mobilityMonthAmount: null,
  consumptionUUID: null, consumptionYearAmount: null, consumptionMonthAmount: null,
}
```

---

## 5. Was der Rechner *nicht* kann

Relevant für unsere Abgrenzung:

- Keine Persistenz — Reload = alles weg, kein Konto-/Transaktionsbezug.
- Detailfelder starten bei 0 und werden nie vorbefüllt, obwohl der Kategorientotal ein
  Richtwert ist. Wer «Miete» eintippt, zerschiesst den Total der ganzen Kategorie.
- Einnahmen sind eine einzige Bruttozahl — keine Nebeneinkünfte, keine Unregelmässigkeit.
- Kein Sparziel, keine Fortschreibung, kein Soll-/Ist-Vergleich.
- Alter wird stillschweigend auf 18 gesetzt (§2.2) — die Nettoeinkommen sind für alle
  Erwerbstätigen ab ~25 systematisch zu hoch, weil der BVG-Abzug fehlt.

Siehe [`API.md`](API.md) für die Endpoints und [`MODELL.md`](MODELL.md) für die
nachgerechnete Rechenlogik.
