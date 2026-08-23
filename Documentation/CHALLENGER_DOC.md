# Vitamin Gelb — Beyond the List
## Dokumentation für den Challenger (PostFinance)

> "What if banking not only showed what happened, but explained what it means?"

### Das Problem, wie wir es verstehen

_TODO — in eigenen Worten, nicht der Challenge-Text zurückgespiegelt._

### Was wir gebaut haben

_TODO — eine Aussage, dann drei Sätze._

### Für wen

_TODO — Persona, und warum diese (Beleg aus unseren Interviews)._

### Warum das über den heutigen Stand hinausgeht

_TODO — PostFinance hat heute "Analysen" (Auto-Kategorisierung, Labels, Budgets mit
Schwellen-Push, Abo-Erkennung, CO₂-Rechner, Charts, Zeitvergleich). Das ist deskriptiv,
pull-basiert und pro Konto. Hier begründen, was unsere Lösung zusätzlich leistet._

### Die Widgets

Was wir bauen, ist auch dann etwas wert, wenn man die App gar nicht öffnet. Darum gibt es
unsere Ansichten als iOS-Widgets — in mehreren Grössen und mit verschiedenem Inhalt, damit
sich jede und jeder auf den Home-Screen holt, was gerade zählt: den Verlauf mit Prognose,
oder das Budget des laufenden Monats.

#### Widget «Verlauf und Prognose»

| Gross | Mittel |
|---|---|
| ![Grosses Widget auf dem Home-Screen](bilder/widget-gross.png) | ![Mittleres Widget auf dem Home-Screen](bilder/widget-mittel.png) |

Beide Aufnahmen zeigen unten rechts zusätzlich das kleine Widget.

- **Gross** — der ganze Verlauf mit dem Zeitraumwähler (1M bis Max) und den zwei Kacheln
  «Tiefster Stand» und «Nächster Eingang», also die Kontoansicht des Prototyps eins zu eins.
- **Mittel** — Kontoname, IBAN, Saldo und der nächste Eingang links, der Verlauf rechts.
- **Klein** — Saldo, Verlauf und der nächste Eingang als eine Zeile.

Die durchgezogene Linie ist der gebuchte Verlauf, die gestrichelte die Prognose; die
gepunktete rote Linie ist die Null. Der nächste Eingang steht in Blau, weil er das ist,
worauf man wartet.

#### Widget «Budget als Blasen»

![Budget-Widget auf dem Home-Screen](bilder/widget-budget.png)

Eine Blase je Kategorie, und in jeder stecken drei Angaben:

- **Der Ring** ist das Budget. Sein Durchmesser folgt der Wurzel des Betrags, damit die
  *Fläche* proportional ist — bei proportionalem Radius sähe ein doppeltes Budget viermal
  so gross aus.
- **Die Füllung** ist, was davon weg ist — ebenfalls nach Fläche.
- **Der feine Strichring** ist der Monatsfortschritt. Ohne ihn lügt jede Verbrauchsanzeige
  in der Monatsmitte: Am 8. sind 25 % eines Budgets kein Rückstand, sondern Vorsprung.

Die Farbe läuft die Petrol-Rampe der Marke hinauf statt einer eigenen Ampel — je voller,
desto dunkler, und erst wo es eng wird, wechselt die Achse auf Orange und Gelb mit rotem
Bogen. Auf der Aufnahme sieht man die ganze Spanne: vier Kategorien im Plan (0 % bis 57 %),
eine knapp darüber (103 %, gelb mit kurzem rotem Bogen) und eine weit darüber (924 %,
voller roter Ring). Die Kopfzeile nennt den Monatsfortschritt, die Fusszeile das Ganze
in Zahlen.

**Stand beider Widgets:** Entwurf. Der Prototyp rendert Verlauf, Prognose und Blasen
bereits; die Widget-Fassung ist gestaltet, aber nicht als iOS-Extension gebaut.

> Die Symbole im Blasen-Entwurf stammen noch aus dem Gestaltungsvorschlag und decken sich
> nicht überall mit den sechs Kategorien im Code (`insights/budget/slots.ts`): Dort trägt
> «Mobilität und Kommunikation» ein Tram und «Gesundheitskosten» ein Herz mit Pulslinie,
> im Entwurf sind es ein Auto und ein schlichtes Herz. Vor der Abgabe entweder das Bild
> neu aufnehmen oder die Abweichung so stehen lassen — sie ist gestalterisch, nicht
> inhaltlich.

### Nutzen & Machbarkeit

_TODO — Nutzen für Kund:in, Aufwand zur Integration, was es an Daten/Systemen bräuchte._

### Grenzen und Annahmen

- Alle gezeigten Finanzdaten sind **synthetisch**; es wurden keine echten Kundendaten verwendet.
- _TODO weitere Annahmen_

### Offene Fragen an PostFinance

- _TODO — siehe `WORKSPACE/00_challenge/QUESTIONS_for_PostFinance.md`_
