# Vom Formular zum selbstausfüllenden Wizard

Was am PostFinance-Budgetrechner besser geht — und was davon in diesem Verzeichnis
lauffähig implementiert ist.

```bash
node derive.mjs                 # Mia Keller, 12 Monate, alles aus Buchungen
node derive.mjs --months 24
node derive.mjs --rules-only    # ohne die Kategorie, die die Bank schon kennt
```

---

## 1. Der Kern: die App weiss das alles schon

Der Original-Wizard fragt sieben Dinge und schätzt dann sechs Kategorien aus einer
Haushaltstabelle. Eine Banking-App braucht die Schätzung gar nicht — sie hat 24 Monate
echte Buchungen.

| | PostFinance heute | Unser Wizard |
|---|---|---|
| Eingaben | 7 Felder | **2 Fragen** (Lebensform, Kinder) |
| Kategoriewerte | Richtwert aus Haushaltsklasse | **Ist aus Buchungen** |
| Detailfelder | 19 × leer (Start bei 0) | **14 von 19 vorbefüllt** (Mia hat kein Auto, keine Hypothek, keine 3a) |
| Nettoeinkommen | Modell mit fixem Alter 18 | **echte Lohngutschriften** |
| Steuern | Modell aus Kanton + Konfession | **echte Steuerzahlungen**, um die Rückerstattung bereinigt |
| Sparen | «Überschuss» = Rest der Rechnung | **Überschuss** *und* **was wirklich aufs Sparkonto ging** |
| Richtwert | ist das Ergebnis | ist der **Vergleich** daneben |

Was die App wirklich nicht sehen kann, bleibt eine Frage — und wird als solche begründet:

```
• Lebst du allein oder mit Partner:in?
  Aus Buchungen nicht erkennbar — ein gemeinsames Konto sieht aus wie ein einzelnes.
• Hast du unterstützungspflichtige Kinder?
  Keine Kita-, Schul- oder Kinderzulagen-Buchungen gefunden.
```

Jahrgang und Konfession stehen im Kundenprofil der Bank, der Steuerort steht auf der
Steuerzahlung (`STEUERVERWALTUNG DES KANTONS BERN` → BE, automatisch erkannt). Bleiben
zwei Fragen statt sieben.

---

## 2. Die teuerste Verbesserung: nicht doppelt zählen

Wer alle Belastungen zusammenzählt, bekommt bei Mia Keller **CHF 5'867/Monat**. Richtig
sind **CHF 4'664**. Die Differenz von **CHF 1'203/Monat (26 %)** sind vier Posten, die keine
Ausgaben sind:

| | CHF/Mt | warum keine Ausgabe |
|---|---|---|
| Dauerauftrag aufs eigene Sparkonto | 733 | Geld ist umgezogen, nicht weg |
| Kreditkartenrechnung | 371 | die Käufe stehen bereits einzeln im Auszug |
| TWINT von Privaten zurückerhalten | 91 | ausgelegt und zurückgekommen — nur der Saldo zählt |
| Rückerstattungen auf Kartenkäufe | 8 | mindert die frühere Ausgabe |
| **Summe** | **1'203** | |

Das ist genau Katjas Satz aus Interview 05 — *«dann ist das wie quasi als Ausgabe, obwohl
es eigentlich gar nicht aus ist»* — und es ist keine Ungenauigkeit, sondern eine
Falschaussage über die Vermögenslage.

Implementiert als **Geldfluss-Achse** in [`src/transactions.ts`](src/transactions.ts):
`out · in · moved · settled · lent`. Die Erkennung läuft über das Gegenkonto (härtestes
Signal), den eigenen Namen als Gegenpartei (Sparkonto bei einer anderen Bank) und den
Buchungstext — in dieser Reihenfolge, weil die teuren Fehler zuerst ausgeschlossen gehören.

Als Nebenprodukt fällt eine Zahl heraus, die es heute nirgends gibt:

```
Überschuss                       1'083 CHF/Mt
davon wirklich gespart             733 CHF/Mt   (Dauerauftrag Sparkonto)
```

350 Franken bleiben also jeden Monat unbemerkt auf dem Konto liegen. Das ist ein Insight,
kein Formularfeld.

---

## 3. Jede Zahl hat einen Beleg

Der Original-Rechner sagt «Wohnen: 1'727». Woher, weiss niemand. Unser Wizard liefert zu
jedem der 19 Detailfelder mit, worauf die Zahl beruht:

```
CategoryResideRent            1'650 CHF/Mt    12 Bch · 12/12 Mt · Konf. 0.95  ← Immoverwaltung Bern AG
CategoryHealthInsurance         383 CHF/Mt    12 Bch · 12/12 Mt · Konf. 0.95  ← CSS
CategoryConsumptionOther        835 CHF/Mt   262 Bch · 12/12 Mt · Konf. 0.64  ← Postomat, TWINT (netto)
```

`monthsSeen` verrät dabei die Rhythmen: 12/12 ist eine Fixkost, 3/12 sind die drei
Steuerraten, 1/12 ist die Jahresrechnung der Hausratversicherung. Alle werden auf den
Monat umgelegt — sonst fehlen Jahresrechnungen im Budget komplett.

Die Konfidenz ist nicht kosmetisch. Sie steuert, was der Wizard als gesetzt zeigt und was
er zur Bestätigung vorlegt.

---

## 4. Ehrlich bleiben, wo es unklar ist

Bei Mia bleiben **30 Buchungen / CHF 228 pro Monat** ohne sichere Zuordnung — davon sind
CHF 213 Bargeldbezüge. Für Bargeld gibt es keine Lösung ausser der Rückfrage, und genau so
steht es da:

```
ZUR BESTÄTIGUNG: 30 Buchungen (228 CHF/Mt) ohne sichere Zuordnung
  Bargeldbezug — Verwendung unbekannt     213 CHF/Mt
  kein Regeltreffer                        15 CHF/Mt
```

Das ist das Confidence-Gating aus der Recherche (`03_research/12_Domaene_Technik`), auf
Budgetzeilen angewandt: hohe Konfidenz still übernehmen, tiefe Konfidenz einmal fragen —
und die Antwort merken.

**Abdeckung, gemessen an den Ausgabenfranken:**

| Modus | sicher zugeordnet | Review |
|---|---|---|
| nur unsere Regeln | 88.0 % | 12.0 % |
| Regeln + Kategorie der Bank | **94.9 %** | 5.1 % |

Der zweite Wert ist der realistische: PostFinance kategorisiert seit Jahren automatisch.
Wir bauen das nicht nach, wir nehmen es an (`NormalizedTx.bankCategory`) — genau der
Scope-Entscheid aus der Domänenrecherche. Unsere Regeln liefern das, was die Bankkategorie
*nicht* kann: die Zuordnung auf eines der **19 Detailfelder** des Budgetrechners.

---

## 5. Die drei Modellschwächen, die wir mitreparieren

Aus [`MODELL.md`](MODELL.md), hier praktisch behoben:

**Stufensprung.** Der Richtwert springt an der Klassengrenze um bis zu 20 %.
`estimateBudget(form, { interpolate: true })` glättet ihn. Für das Ist-Budget ist er
ohnehin irrelevant — echte Zahlen kennen keine Klassen.

**Alter fix auf 18.** Der Original-Wizard rechnet für alle ohne BVG-Abzug. Wir kennen den
Jahrgang und rechnen richtig; zusätzlich kehrt [`grossFromNet()`](src/derive.ts) die
Nettoformel um, damit wir den Richtwert aus dem **gemessenen Netto** ziehen können, statt
den Bruttolohn zu erfragen.

**Leere Detailfelder.** Im Original setzt «Miete: 1'650» eintippen den ganzen
Kategorientotal auf 1'650 — die anderen zwei Felder stehen ja auf 0. Bei uns sind alle
Felder gefüllt, bevor jemand etwas anfasst.

---

## 6. Was das Ergebnis erzählt

Mia Keller, 12 Monate, Bern, alleinstehend:

| Kategorie | Ist | PostFinance-Richtwert | Delta |
|---|---|---|---|
| Steuern | 287 | 929 | −642 |
| Wohnen | 1'690 | 1'724 | −34 |
| Versicherungen und Vorsorgen | 24 | 206 | −182 |
| Gesundheitskosten | 425 | 649 | −224 |
| Mobilität und Kommunikation | 208 | 688 | −480 |
| Konsum und Freizeit | 2'030 | 1'851 | **+179** |
| **Total** | **4'664** | **6'048** | |

Die Deltas sind die Geschichte, nicht die Zahlen:
- **Mobilität −480**: Mia hat kein Auto. Der Richtwert unterstellt eines.
- **Versicherungen −182**: keine Säule 3a. Der Original-Rechner feuert hier von selbst den
  Tipp `scrHintProvisionsPotential` — unsere Zahlen lösen ihn korrekt aus.
- **Konsum +179**: der einzige Posten über dem Vergleich. Das ist der Satz, den der Wizard
  sagen sollte — nicht «du hast 4'664 ausgegeben».
- **Steuern −642**: hier ist Vorsicht angebracht. Steuerraten laufen der Steuerperiode
  hinterher, und der synthetische Datensatz zahlt wenig. Bei echten Daten braucht dieser
  Posten eine Glättung über mehr als 12 Monate.

---

## 7. Kontrollrechnung

Die Ableitung ist nur dann etwas wert, wenn keine Buchung verlorengeht:

```
Kontrollrechnung Privatkonto: 6655.00 + 4213.17 = 10868.17 · Auszug 10868.17 · Differenz 0.00
```

Startsaldo plus alle 2'272 Kontobuchungen ergeben den Endsaldo des Auszugs, auf den Rappen.
Läuft bei jedem `node derive.mjs` mit.

---

## 8. Was als Nächstes drankommt

Nicht implementiert, aber vorbereitet:

1. **Gelernte Korrekturen.** Wenn der Nutzer eine Zuordnung ändert, gehört sie in eine
   persönliche Regeltabelle vor `RULES`. Der Hook ist da (`Categorization.matchedBy`),
   die Persistenz fehlt.
2. **Bargeld einmal fragen.** «Deine CHF 213 Bargeld pro Monat — eher Essen, eher
   Freizeit?» Eine Frage pro Nutzer, danach ist die grösste Unschärfe weg.
3. **Prognose statt Rückblick.** Fixkosten und Rhythmen stehen bereits in `SlotEvidence`
   (`monthsSeen`, `largestSingle`) — daraus wird E3 aus der Domänenrecherche, ohne neue
   Daten.
4. **Partnerhaushalt.** Zwei Konten zusammenrechnen und Überträge zwischen ihnen als
   `moved` erkennen. Die Geldfluss-Achse kann das schon, es fehlt nur die Kontoauswahl.
5. **Mehr als ein Steuerort pro Kanton.** `reference.json` hat einen Referenzort je Kanton;
   für den Vergleichswert am Wohnort braucht es den Live-Endpoint oder ein grösseres Raster.
