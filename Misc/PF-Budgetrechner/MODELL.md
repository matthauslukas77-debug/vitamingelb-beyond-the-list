# Wie der PostFinance-Budgetrechner rechnet

Der Rechner schickt alles ans Backend — im Client steckt keine Formel. Diese Datei
rekonstruiert die Backend-Logik aus **2'513 Messpunkten** der öffentlichen API
(`data/samples.jsonl.gz`, Sampling-Skripte in `data/scrape*.py`).

Ergebnis: die Kette ist vollständig reproduzierbar.

```
Brutto + Alter  ──(1)──►  Nettoeinkommen  ──(2)──►  Ausgabentotal
                                                        │
Steuerort + Konfession ──(3)──► Steuern ────────────────┤
                                                        ▼
                            (4) Rest × feste Anteile = 5 Kategorien
```

---

## 1. Nettoeinkommen — exakt rekonstruiert

Pro Person, auf dem Bruttojahreslohn:

| Komponente | Satz | Basis |
|---|---|---|
| Sozialabzüge Basis | 7.4 % | ganzer Bruttolohn |
| Zusatzband | + 3.5 % | Teil zwischen 90'720 und 148'200 |
| Spitzenband | + 1.4 % | Teil über 148'200 |
| BVG (Arbeitnehmeranteil) | halber Alterssatz | koordinierter Lohn |

BVG-Parameter (2026er Werte): Eintrittsschwelle **22'680**, Koordinationsabzug **26'460**,
koordinierter Lohn min. **3'780** / max. **64'260**.
Alterssatz: `<25 → 0 %`, `25–34 → 7 %`, `35–44 → 10 %`, `45–54 → 15 %`, `ab 55 → 18 %`
(halbiert, weil nur Arbeitnehmeranteil).

Haushaltsnetto = Summe beider Personen.

> **Verifikation:** gegen alle 2'513 Samples maximal **1 CHF Abweichung pro Jahr**
> (reine Rundung). Implementation: [`src/model.ts`](src/model.ts) → `netIncomeYear()`.

Die beiden Bänder ab 90'720 (= BVG-Maximallohn) und 148'200 (= UVG/ALV-Höchstlohn) sind
die Grenzen, an denen die Sätze im Modell springen — die genaue Zusammensetzung
(ALV-Solidaritätsprozent, NBU, Kadervorsorge) lässt sich aus den Daten nicht auftrennen,
für die Nachrechnung ist das egal.

**Merke:** die Live-Webapp setzt `year` immer auf *aktuelles Jahr − 18* — sie rechnet also
für alle mit einer 18-Jährigen und damit **ohne BVG-Abzug**. Für eine 40-jährige Person mit
85'000 Brutto ist das Nettoeinkommen im Original um **CHF 244/Monat zu hoch** (6'559 statt 6'315).
Unsere Implementation nimmt das echte Alter (die API akzeptiert es).

---

## 2. Ausgabentotal — Stufenmodell nach Einkommensklasse

```
sumExpensesMonth = ratio(Lebensform, Kinder, Einkommensklasse) × NettoeinkommenMonat
```

Es gibt **fünf Einkommensklassen** je Haushaltstyp (4 Lebensformen × 0–5 Kinder = 24
Profile). Innerhalb einer Klasse ist das Verhältnis konstant — die Ausgaben skalieren also
linear mit dem Einkommen. Beispiel *alleinstehend, keine Kinder*:

| Nettoeinkommen/Mt | Ausgaben / Netto |
|---|---|
| bis 4'205 | 1.329 |
| 4'205 – 6'057 | 1.052 |
| 6'057 – 8'172 | 0.994 |
| 8'172 – 11'142 | 0.916 |
| ab 11'142 | 0.820 |

In den untersten Klassen liegt das Verhältnis über 1 — das Modell sagt also einen
strukturellen Ausgabenüberschuss voraus, keinen Rechenfehler.

### Der Stufensprung ist real

Die Klassengrenzen wurden per Bisektion auf den Franken genau bestimmt
(alleinstehend/0 Kinder: netto/Mt **4'191 · 6'041 · 8'179 · 11'140**). An der Grenze
springt das Ausgabentotal:

```
Brutto 54'307 → «typische» Ausgaben 5'569 CHF/Mt
Brutto 54'308 → «typische» Ausgaben 4'410 CHF/Mt     (CHF 1 mehr Lohn, CHF 1'159 weniger Ausgaben)
```

Für unseren Wizard ist das ein Argument, entweder zu interpolieren
(`estimateBudget(form, { interpolate: true })`) oder die Klasse offen auszuweisen
(«Vergleichsgruppe: Haushalte mit 6'000–8'000 CHF Nettoeinkommen»).

Die in `data/reference.json` abgelegten Grenzen sind geometrische Mittel zwischen den
Sampling-Punkten; bei *alleinstehend/0 Kinder* weichen sie von den bisektierten
Werten um ≤ 0.3 % ab. Über alle 2'513 Samples ist die Klassenzuordnung **100 % korrekt**.

---

## 3. Steuern — Nachschlagewerk, nicht Formel

Die Steuern hängen ab von: Steuerort (Gemeinde, nicht nur Kanton), Konfession,
Haushaltsbruttoeinkommen, Lebensform, Kinderzahl und davon, ob **eine oder zwei** Personen
verdienen (Zweiverdienerabzug — bei gleichem Haushaltseinkommen zahlt ein
Einverdiener-Paar bis zu 16 % mehr).

Nicht als Formel rekonstruierbar (dahinter stehen kommunale Steuerfüsse eines
Drittanbieters). `data/reference.json` enthält deshalb ein **gesampeltes Raster**:
je ein Referenzort pro Kanton (26), 9 Einkommensstufen von 30k bis 250k,
4 Haushaltsvarianten, plus einen Konfessionsfaktor pro Ort. Dazwischen wird linear
interpoliert.

Spannweite bei 85'000 Brutto, alleinstehend, konfessionslos:

| Ort | Steuern/Mt | | Ort | Steuern/Mt |
|---|---|---|---|---|
| Zug | 329 | | Bern | 1'090 |
| Schwyz | 519 | | Fribourg | 1'100 |
| Appenzell | 678 | | Liestal | 1'102 |
| Zürich | 749 | | Lausanne | 1'125 |
| Luzern | 772 | | Neuchâtel | 1'212 |

Konfession: reformiert/katholisch/christkatholisch kosten je nach Ort **0–11 % mehr** als
konfessionslos (Tessin 0 %, Bern +4 %, Basel +7 %, Aarau +11 %). «Andere» wird wie
konfessionslos behandelt.

**Genauigkeit:** Median 0 CHF/Mt, p90 13 CHF/Mt, p99 219 CHF/Mt. Die Ausreisser liegen
bei sehr tiefen Einkommen (Progressionsknick unter 30k) und weit ausserhalb des Rasters.
Wenn es genau sein muss: Live-API (`src/client.ts`) — oder, besser für unsere App, die
**tatsächlichen Steuerzahlungen aus den Transaktionen** nehmen.

---

## 4. Kategorien — feste Anteile am Rest

Die fünf Nicht-Steuer-Kategorien teilen sich den Rest exakt auf:

```
Rest = sumExpenses − Steuern
Kategorie_i = Anteil_i(Lebensform, Kinder, Einkommensklasse) × Rest
```

Über 2'513 Samples geprüft: die fünf Kategorien summieren sich **immer** auf den Rest
(0 Abweichungen > 3 CHF). Die Anteile hängen nur vom Haushaltsprofil ab, **nicht** vom
Steuerort — deshalb wirkt ein tieferer Steuerfuss im Rechner wie mehr Geld für alles andere:

> Bern → Zürich (alleinstehend, 85'000 brutto): Steuern −341 CHF/Mt, dafür Wohnen +103,
> Gesundheit +41, Mobilität +49, Konsum +129, Versicherung +18 …
> Das Ausgabentotal bleibt auf den Franken gleich. Es sind **keine** regionalen
> Lebenshaltungskosten im Modell — nur die Steuern sind ortsabhängig.

Anteile *alleinstehend, 0 Kinder*:

| Einkommensklasse | Wohnen | Versicherung | Gesundheit | Mobilität | Konsum |
|---|---|---|---|---|---|
| bis 4'205 | 38.8 % | 3.1 % | 14.3 % | 11.6 % | 32.3 % |
| 4'205 – 6'057 | 33.7 % | 4.0 % | 12.7 % | 13.4 % | 36.2 % |
| 6'057 – 8'172 | 30.3 % | 5.3 % | 12.1 % | 14.6 % | 37.9 % |
| 8'172 – 11'142 | 28.2 % | 6.8 % | 11.0 % | 15.6 % | 38.4 % |
| ab 11'142 | 24.4 % | 7.9 % | 8.9 % | 14.8 % | 43.9 % |

Klassisches Engel'sches Muster: Wohn- und Gesundheitsanteil sinken mit dem Einkommen,
Vorsorge und Konsum steigen. Alle 24 Profile stehen in `data/reference.json`.

---

## 5. Nachrechnen nach User-Eingabe (`updateBudget`)

Reine Arithmetik, 1:1 nachgebaut in `src/model.ts` → `updateBudget()`:
die aktive Ansicht ist führend, die Gegenansicht wird mit ×12 bzw. ÷12 abgeleitet,
Summe und Überschuss werden neu gebildet. Kein Netzwerk nötig.

---

## 6. Gesamtgenauigkeit des lokalen Modells

`node verify.mjs` gegen alle 2'513 Samples:

```
Nettoeinkommen/Mt : max. Abweichung 0 CHF
Steuern/Mt        : Median 0 CHF · p90 13 CHF · p99 219 CHF
sumExpenses       : Median 0.00 % · p90 0.01 % · p99 0.03 %
reside            : Median 0.00 % · p90 0.19 % · p99 2.39 %
insurance         : Median 0.00 % · p90 0.23 % · p99 2.36 %
health            : Median 0.00 % · p90 0.16 % · p99 2.34 %
mobility          : Median 0.00 % · p90 0.23 % · p99 2.36 %
consumption       : Median 0.00 % · p90 0.19 % · p99 2.42 %
```

Gegenprobe mit einem Profil, das **nicht** gesampelt wurde
(`node verify.mjs --live`, Ehepaar 95k + 55k, 2 Kinder, Bern):

| Position | PostFinance | lokal | Delta |
|---|---|---|---|
| Nettoeinkommen/Mt | 11'563 | 11'563 | 0 |
| Ausgaben/Mt | 9'560 | 9'560 | 0 |
| Steuern/Mt | 1'497 | 1'444 | −53 |
| Wohnen/Mt | 1'575 | 1'585 | +10 |
| Konsum/Mt | 3'692 | 3'717 | +25 |

---

## 7. Was wir daraus für unsere App mitnehmen

1. **Die Richtwerte sind geschenkt.** Wir können jedem Haushalt sofort sagen, was
   «ähnliche Haushalte» pro Kategorie ausgeben — offline, ohne Datenlieferung.
2. **Die Kategorien sind kompatibel.** Sechs Kategorien mit 19 Detailfeldern, dieselbe
   Sprache wie im PostFinance-Ökosystem — ideal, um unsere Transaktionskategorien
   dagegenzulegen (Soll aus dem Rechner, Ist aus den Kontodaten).
3. **Drei Schwächen sind unsere Chance:** der Stufensprung an der Klassengrenze, das
   fest auf 18 Jahre gesetzte Alter, und die Detailfelder, die bei 0 starten statt mit
   Richtwerten. Alle drei können wir besser machen, ohne vom Modell abzuweichen.
4. **Nichts ist ortsabhängig ausser den Steuern.** Wer in Zürich wohnt, bekommt denselben
   Wohn-Richtwert wie jemand im Jura. Wenn wir echte Transaktionen haben, ist unser
   Richtwert schlicht besser.
