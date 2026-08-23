# Vitamin Gelb — Beyond the List

> «What if banking not only showed what happened, but explained what it means?»

Ein Prototyp für die PostFinance-Challenge am BärnHäckt 2026. Wir haben die PostFinance-App
nachgebaut und darüber eine zweite, klar getrennte Schicht gelegt — damit man in derselben App
sieht, was Banking heute zeigt und was es zeigen könnte.

| | |
|---|---|
| **Live ausprobieren** | **<https://www.vitamingelb.ch>** — läuft im Browser, am besten auf dem Handy oder in der schmalen Fenstergrösse |
| **Direkt zu den neuen Funktionen** | [Signale](https://www.vitamingelb.ch/?persona=bruno&screen=signals) · [Zuordnen](https://www.vitamingelb.ch/?persona=bruno&screen=assign) · [Budget](https://www.vitamingelb.ch/?persona=bruno&screen=cockpit&view=budget) · [Budget-Wizard](https://www.vitamingelb.ch/?persona=reto&screen=budget) · [Frag deine Zahlen](https://www.vitamingelb.ch/?persona=bruno&screen=search) |
| **Selbst starten** | `cd Code && npm install && npm run dev` → <http://localhost:5173> — ohne Schlüssel, ohne Backend |
| **Code** | [`Code/`](Code/) — die lauffähige Lösung, [eigenes README](Code/README.md) mit Details |
| **Material** | [`Misc/`](Misc/) — alle sieben Interviews, Synthese, die Vermessung des PF-Budgetrechners, der Apertus-Test |
| **Dokumentation** | [Tech-Jury (PDF)](Documentation/Tech-Jury-Dokumentation.pdf) · [Challenger-Doc](Documentation/CHALLENGER_DOC.md) |
| **Pitch** | [`Presentation/pitch.html`](Presentation/pitch.html) — 15 Folien in einer Datei |

---

## Die Challenge

PostFinance stellt eine einzige Beobachtung an den Anfang: Eine Transaktionsliste zeigt, **was
passiert ist**, aber nie, **was es bedeutet**. Daraus werden im Challenge-Video drei Fragen:

1. **Was ist regelmässig?**
2. **Was ist ungewöhnlich?**
3. **Was verändert sich?**

Es gab weder einen Datensatz noch eine API noch eine Liste geforderter Funktionen. Den Rahmen
mussten wir selbst setzen. Unsere Entscheidung: **nicht raten, was Leute brauchen könnten,
sondern zuerst fragen.** Deshalb steht am Anfang dieses Projekts kein Code, sondern sechs
Gespräche.

## Was wir gebaut haben

**Erst der Ist-Zustand, dann der Vorschlag.** Wir haben die PostFinance-App (v6) als Web-App
nachgebaut — Home, Zahlungen, Anlegen, Angebote, Services, Kontodetail, Analysen. Nach den
offiziellen Screenshots, mit dem rekonstruierten Design-System aus 188 Tokens, inklusive Dark
Mode. Dieser Nachbau enthält bewusst **keine** eigenen Ideen.

Darüber liegt unsere Schicht. Sie beantwortet die drei Fragen der Challenge auf den Daten, die
eine Bank tatsächlich hat:

| Was | Wo | Was es beantwortet |
|---|---|---|
| **Erkennung wiederkehrender Zahlungen** | [`Code/src/domain/recurring.ts`](Code/src/domain/recurring.ts) | Was ist regelmässig? |
| **Zerlegung des Buchungstexts** | [`Code/src/domain/booking.ts`](Code/src/domain/booking.ts) | Was steht da überhaupt? |
| **Kontostand-Verlauf mit Prognose** | [`Code/src/insights/engine/balance.ts`](Code/src/insights/engine/balance.ts) | Was verändert sich? |
| **Kontokarte statt Kontozeile** | [`Code/src/insights/cards/`](Code/src/insights/cards/) | Wo es sichtbar wird |

Der Buchungstext ist der Kern der Challenge. «APPLE PAY KAUF/DIENSTLEISTUNG VOM 03.09.2024
KARTEN NR. XXXX7731 COOP BERN BAHNHOF (CH)» enthält alles — Zahlungsart, Kaufdatum, Karte,
Händler, Land — aber in der Liste ist nur der Anfang sichtbar, und der Händler fällt hinten weg.
Unklare Buchungen kamen in vier der sechs Gespräche zur Sprache — am deutlichsten bei Silvan:
«manchmal so komische Adressen oder komische Firmennamen». Dieselben Daten, anders gelesen, ergeben
die Detailansicht ([`TransactionDetail.tsx`](Code/src/app/screens/TransactionDetail.tsx)) und die
Abo-Übersicht ([`Recurring.tsx`](Code/src/app/screens/Recurring.tsx)).

Drei Entscheide, auf die wir Wert legen:

- Die Abo-Erkennung liest **nicht** die `seriesId` aus unseren Mock-Daten. Die gibt es in echten
  Kontodaten nicht. Erkannt wird aus Buchungstext, Betrag und Abstand — aus dem, was eine Bank
  wirklich sieht. Die `seriesId` dient nur in den Tests als Referenz.
- Die Prognose rechnet **nur** mit dem, was feststeht: erkannte Zahlungsreihen und pendente
  Aufträge. Keine Hochrechnung von Gewohnheiten. Bruno hat im Interview gesagt: «Einfach
  plausibel müsste es sein.» Eine Kurve, die rät, verliert genau dieses Vertrauen.
- Abo-Erkennung und Textzerlegung liegen in [`Code/src/domain/`](Code/src/domain/), nicht in
  unserer Insights-Schicht. PostFinance hat «Meine Abos» und eine Detailansicht bereits — das
  gehört in den Nachbau. Wir beanspruchen nur, was wirklich von uns ist.

### Die Trennlinie

[`Code/src/app/`](Code/src/app/) ist der Nachbau, [`Code/src/insights/`](Code/src/insights/) ist
unsere Schicht. Die Nachbau-Screens rendern an definierten Stellen einen benannten Slot:

```tsx
<Slot name="home.accountRow" fallback={<Row … />} />
```

Ist in [`registry.tsx`](Code/src/insights/registry.tsx) nichts registriert, rendert der Nachbau
seinen eigenen Baustein — die App zeigt dann exakt den Ist-Zustand. Damit lässt sich jede
einzelne Funktion an- und abschalten, und es ist jederzeit nachvollziehbar, was bestehendes
Produkt ist und was von uns kommt.

## Starten

```bash
cd Code
npm install
npm run dev
```

Dann <http://localhost:5173> öffnen. Node 20.19+ genügt. **Es braucht keine Schlüssel und kein
Backend** — alle Daten entstehen lokal. Supabase ist optional angebunden und schaltet sich still
ab, wenn keine Konfiguration da ist.

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm test` | Tests |
| `npm run build` | Typprüfung und Produktionsbuild |

Für Demo und Screenshots lässt sich jeder Einstieg direkt ansteuern, z. B.
`?persona=reto&screen=analysis`. Alle Varianten stehen im [`Code/README.md`](Code/README.md).

## Wo man zu lesen anfängt

Wer den Code verstehen will, in dieser Reihenfolge:

| # | Datei | Warum |
|---|---|---|
| 1 | [`Code/src/insights/registry.tsx`](Code/src/insights/registry.tsx) | Die Trennlinie. Hier steht, was von uns kommt. |
| 2 | [`Code/src/data/types.ts`](Code/src/data/types.ts) | Das Datenmodell — Konto, Buchung, Persona. |
| 3 | [`Code/src/domain/recurring.ts`](Code/src/domain/recurring.ts) | Die Erkennungslogik, ohne UI. |
| 4 | [`Code/src/insights/engine/balance.ts`](Code/src/insights/engine/balance.ts) | Verlauf und Prognose. |
| 5 | [`Code/src/app/AppShell.tsx`](Code/src/app/AppShell.tsx) | Wie die App zusammengesetzt ist. |

## Design Thinking — warum die App so aussieht

Wir haben am Freitagabend **sechs Gespräche** geführt und vollständig transkribiert, bevor die
erste Zeile Produktcode entstand. Das ganze Material liegt anonymisiert in
[`Misc/Interviews/`](Misc/Interviews/): Leitfaden, Transkripte, Auswertungen, Synthese.
Strukturiert ausgewertet sind drei davon — die restlichen drei sind in die Personas
eingegangen, aber nicht ins Hypothesen-Scoreboard. Das ist die offene Flanke unserer
Empathize-Phase, und sie steht im [`Misc/README.md`](Misc/README.md) so drin.

Was dabei herauskam, hat den Scope bestimmt:

- Der Schmerz ist selten «ich verstehe diese Buchung nicht». Er ist **«es gibt keinen Grund
  hinzuschauen»**. Die Auswertung ist versteckt, unattraktiv und verlangt Pflege.
- Fast alle prüfen nur den Kontostand — mehrmals täglich, sekundenschnell, ohne Kontext.
- Niemand führt ein Budget, das er gepflegt hat. Wer es versucht hat, hat aufgehört.
- Vertrauen bricht sofort, wenn eine Zahl «geschätzt» wirkt.

Diese Erkenntnisse stecken direkt im Produkt: Der Einstieg ist der Kontostand — nur eben mit
Verlauf und dem, was noch kommt. Nichts muss gepflegt werden. Und prognostiziert wird nur, was
feststeht.

Die vier Personas in der App sind keine Erfindung, sondern die vier Gesprächspartner mit ihrem
jeweiligen Muster:

| Persona | Muster aus dem Gespräch |
|---|---|
| **Reto Bühler** · 22, Informatiker | Sechs Abos, eines still von 71.90 auf 79.90 erhöht |
| **Nino Roth** · 19, Mediamatiker | Knappes Konto, Sollzins, Mahngebühr für eine vergessene Rechnung |
| **Livia Berger** · Lernende bei einer Bank | Dauerauftrag aufs **eigene** Sparkonto — zählt heute als Ausgabe |
| **Bruno Aebischer** · 59, angestellt | Fünf Produkte bei zwei Instituten, Steuerrechnung als Jahresposten |

## Daten und Anonymisierung

**Alle Konten, Buchungen und Beträge in der App sind erfunden** und enthalten keine echten
Kundendaten. Sie liegen als feste Datensätze im Repository — einmalig erzeugt, nicht zur
Laufzeit — und sind deshalb bei jedem Start identisch. Je Persona sind es 24 Monate und
670–1150 Buchungen im Textformat des echten Kontoauszugs. Beträge werden durchgehend als
ganzzahlige Rappen geführt, gerundet wird erst bei der Ausgabe.

Das Interviewmaterial in `Misc/` ist anonymisiert: Namen sind durch Pseudonyme ersetzt,
Wohn- und Arbeitsorte, Arbeitgeber und der Lehrbetrieb sind maskiert (`[Ort]`, `[Bank]`).
Die Transkripte sind ansonsten unverändert — inklusive Versprechern und Widersprüchen der
automatischen Transkription. Die Zuordnungstabelle bleibt ausserhalb dieses Repositorys.

## Wie wir gearbeitet haben

Zwei Personen, ein Wochenende, dazu mehrere parallele KI-Sessions, die je an einem eigenen
Bereich gearbeitet haben (Nachbau, Insights-Schicht, Daten, Dokumentation).

Wir arbeiten in **zwei Ordnern**:

```
BERNHACKT/
├── WORKSPACE/     unsere Werkstatt — Recherche, Rohtranskripte, Experimente, Sackgassen
└── SUBMISSION/    dieses Repository — nur, was bewusst hierher befördert wurde
```

Das ist bewusst so: Recherche in einem Repository, das öffentlich ist, wäre entweder unvollständig
oder unverantwortlich. Rohmaterial mit Klarnamen bleibt in `WORKSPACE/` und wird nie gepusht.
Was hierher kommt, hat vorher jemand angeschaut.

Im Repository selbst: `main`, kleine Commits, jeder Commit eine Sache. Der Nachbau und unsere
Schicht sind physisch getrennte Ordner, damit parallele Arbeit sich nicht ins Gehege kommt.
`main` muss jederzeit laufen — `npm test` und `npm run build` sind die Bedingung dafür.
