# PostFinance Budgetrechner — komplett rekonstruiert

Alles, was man braucht, um den [PostFinance-Budgetrechner](https://www.postfinance.ch/de/privat/anlegen/tools-rechner/budget-erstellen.html)
als Budget-Wizard in unserer App nachzubauen: Struktur, Texte in vier Sprachen, API,
Rechenlogik und die Richtwerte — offline lauffähig.

Gescrapt am **2026-08-22** aus dem Angular-Bundle (`/pfch/ui/main.js`, Webapp 219) plus
2'513 Messpunkten der öffentlichen API.

**Und einen Schritt weiter:** der Wizard füllt sich aus den Buchungen selbst aus. Statt
sieben Eingaben bleiben **zwei Fragen** — alles andere steht im Kontoauszug.
→ [`VERBESSERUNGEN.md`](VERBESSERUNGEN.md)

```bash
node derive.mjs          # Budget aus 12 Monaten Buchungen ableiten (Mia Keller)
node verify.mjs          # lokales Modell gegen 2'513 Live-Samples prüfen
node verify.mjs --live   # zusätzlich ein Live-Call gegen postfinance.ch
```

Node führt die TypeScript-Module direkt aus — keine Build-Schritte, keine Abhängigkeiten.

---

## Was hier liegt

| Datei | Inhalt |
|---|---|
| [`SPEC.md`](SPEC.md) | **Der Wizard.** Zwei Schritte, alle Felder, Enums, Validierung, sechs Kategorien mit 19 Detailfeldern, Tipp-Logik, Formatierung |
| [`MODELL.md`](MODELL.md) | **Die Rechnung.** Nettoeinkommen-Formel (exakt), Einkommensklassen, Kategorienanteile, Steuerraster, Messfehler |
| [`API.md`](API.md) | **Die Endpoints.** `calculateBudget`, `updateBudget`, Steuerort-Suche, i18n — mit curl-Beispielen und Fehlerformat |
| [`VERBESSERUNGEN.md`](VERBESSERUNGEN.md) | **Der Ausbau.** Budget aus Transaktionen statt Formular: Geldfluss-Achse, Belege, Abdeckung, offene Fragen |
| `src/types.ts` | Typen, Feldnamen 1:1 wie die API |
| `src/model.ts` | Nettoeinkommen, `updateBudget`-Arithmetik, Kategorien, Tipps, Formatierung |
| `src/reference.ts` | `estimateBudget()` — lokaler Ersatz für `calculateBudget`, ohne Netzwerk |
| `src/client.ts` | Live-Client gegen postfinance.ch (Referenzpfad) |
| `src/transactions.ts` | Normalisierte Buchung + Geldfluss-Achse (`out · in · moved · settled · lent`) |
| `src/categorize.ts` | Buchung → eines der 19 Detailfelder, regelbasiert + Bankkategorie |
| `src/derive.ts` | `deriveBudget()` — Einkommen, Kategorien, Belege, offene Fragen |
| `derive.mjs` | Lauffähige Demo auf den 2'418 synthetischen Buchungen |
| `verify.mjs` | Lauffähige Validierung, ohne Toolchain |
| `data/labels.{de,en,fr,it}.json` | 161 Original-Labels je Sprache |
| `data/reference.json` | 24 Haushaltsprofile × 5 Einkommensklassen + Steuerraster 26 Kantone |
| `data/taxlocations.json` | Ein Referenz-Steuerort pro Kanton |
| `data/samples.jsonl.gz` | Die 2'513 Rohmessungen |
| `data/scrape*.py`, `data/build_reference.py` | Wie die Daten entstanden sind — reproduzierbar |
| `bundle-source.js` | Der extrahierte Original-Komponentencode (23 KB, minifiziert) |

---

## Der Rechner in einem Absatz

Zwei Schritte. Schritt 1 fragt Lebensform, Kinder (0–5), Bruttojahreslohn, Konfession und
Steuerort — bei Partnerschaft zusätzlich Lohn und Konfession der zweiten Person. Schritt 2
zeigt Nettoeinkommen, Ausgabentotal und Überschuss, dazu sechs Ausgabenkategorien mit
geschätzten Richtwerten, die man aufklappen und pro Detailfeld überschreiben kann.
Umschaltbar zwischen Monats- und Jahresansicht. Kein Client-Rechnen: jede Zahl kommt vom
Backend, das ohne Auth erreichbar ist.

## Die Kategorien

| Kategorie | Detailfelder |
|---|---|
| Steuern | Steuern |
| Wohnen | Miete · Hypothekarzinsen · Neben- und Unterhaltskosten |
| Versicherungen und Vorsorgen | Haftpflicht und Hausrat · Beiträge private Vorsorge · Weitere Versicherungen |
| Gesundheitskosten | Krankenkasse · Medikamente, Franchise · Arzt, Spital, Therapie |
| Mobilität und Kommunikation | Fahrzeug, Leasing · Fahrzeugversicherung · Treibstoff und Unterhalt · Öffentlicher Verkehr · Telefon, TV, Radio, Internet |
| Konsum und Freizeit | Nahrungsmittel · Kleider und Schuhe · Ferien, Hobbies, Kultur · Weitere Ausgaben |

## So genau ist das lokale Modell

Gegen alle 2'513 Live-Samples:

| | Median | p90 | p99 |
|---|---|---|---|
| Nettoeinkommen | exakt | exakt | exakt |
| Ausgabentotal | 0.00 % | 0.01 % | 0.03 % |
| Kategorien | 0.00 % | 0.23 % | 2.4 % |
| Steuern | 0 CHF/Mt | 13 CHF/Mt | 219 CHF/Mt |

Die Steuern sind der einzige Teil, der nicht als Formel rekonstruierbar ist (kommunale
Steuerfüsse eines Drittanbieters) — dafür liegt ein interpoliertes Raster über 26 Kantone
und 9 Einkommensstufen bei.

---

## Verwendung

### A — Budget aus Buchungen (der Normalfall in der App)

```ts
import { deriveBudget } from './src/derive.ts';

const derived = deriveBudget(transactions, {
  months: 12,
  context: { ownName, ownAccounts, cardAccounts },   // trennt Sparen von Ausgaben
  known: { civilStatus: '1', children: '0', year: 1995 }, // was die Bank schon weiss
});

derived.budget            // Ist-Budget im Format des PostFinance-Rechners
derived.benchmark         // derselbe Haushalt als PostFinance-Richtwert
derived.evidence          // pro Detailfeld: Betrag, Buchungen, Händler, Konfidenz
derived.openQuestions     // was die App noch fragen muss — und warum
derived.actualSavingsMonth // was wirklich aufs Sparkonto ging
```

### B — Richtwert ohne Buchungen (Onboarding, Neukunde)

```ts
import { estimateBudget } from './src/reference.ts';
import { updateBudget, withCategoryAmount, topTip, formatAmount } from './src/model.ts';

const budget = estimateBudget({
  civilStatus: '2', children: '2',
  zipCode: '3011', city: 'Bern', taxLocationId: 301100000,
  grossYearIncome: 95000, denomination: '4',
  grossYearIncomePartner: 55000, denominationPartner: '4',
  sex: '1', year: 1988, sexPartner: '2', yearPartner: 1990,
});

formatAmount(budget.savingQuoteMonth, { signed: true });   // "+895 CHF"
topTip(budget);                                            // "scrHintSavingPotential"

// User korrigiert die Wohnkosten:
const edited = updateBudget(withCategoryAmount(budget, 'reside', 2100));
```

Für bitgenaue PostFinance-Zahlen stattdessen `src/client.ts` (Live-API). Browserseitig
braucht der Live-Pfad einen Reverse-Proxy — postfinance.ch schickt keine CORS-Header.

---

## Was der Ausbau bringt (gemessen an Mia Keller, 12 Monate)

| | |
|---|---|
| Eingaben | 7 Felder → **2 Fragen** |
| Detailfelder vorbefüllt | 0 von 19 → **14 von 19** |
| Zuordnung der Ausgabenfranken | **94.9 %** sicher (88.0 % mit unseren Regeln allein) |
| Doppelzählung vermieden | **1'203 CHF/Mt** (Sparen, Kreditkartenrechnung, TWINT-Rückflüsse) |
| Kontrollrechnung Saldo | Differenz **0.00 CHF** über 2'272 Buchungen |

Details und die Deltas gegen den Richtwert: [`VERBESSERUNGEN.md`](VERBESSERUNGEN.md).

## Drei Dinge, die wir am Original besser machen können

1. **Der Stufensprung.** Die Richtwerte sind ein Stufenmodell über fünf Einkommensklassen.
   CHF 1 mehr Lohn kann die «typischen» Ausgaben um CHF 1'159/Monat senken.
   `estimateBudget(form, { interpolate: true })` glättet das.
2. **Das Alter.** Die Live-Webapp setzt den Jahrgang fix auf *aktuelles Jahr − 18* und
   rechnet damit für alle ohne BVG-Abzug — bei einer 40-jährigen Person mit 85'000 Brutto
   sind das CHF 244/Monat zu viel Nettoeinkommen. Wir kennen das echte Alter.
3. **Die leeren Detailfelder.** Der Kategorientotal ist ein Richtwert, die Detailfelder
   starten bei 0. Wer «Miete» eintippt, setzt damit den ganzen Kategorientotal auf diesen
   einen Wert. Wir haben echte Transaktionen — wir können vorbefüllen.

Ausserdem: der Rechner kennt **keine regionalen Lebenshaltungskosten**. Nur die Steuern
sind ortsabhängig, das Ausgabentotal ist in Zug und in Neuchâtel identisch.

---

## Rechtliches

Öffentlich zugänglicher Rechner des Challenge-Owners, ohne Auth, ohne Rate-Limit-Verstoss
gesampelt (4 parallele Requests, 120 ms Pause). Die Daten hier sind **gemessene Ausgaben**
dieses Rechners, keine PostFinance-Datenlieferung. PostFinance selbst schliesst Gewähr für
die zugrundeliegenden Steuer- und Marktdaten aus (Label `LegalNotice`). Im Pitch nennen wir
die Quelle.
