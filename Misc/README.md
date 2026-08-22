# Misc — das Material hinter dem Prototyp

Hier liegt, worauf die Produktentscheide beruhen. Wer wissen will, warum die App aussieht, wie
sie aussieht, findet die Antwort in diesem Ordner und nicht im Code.

```
Misc/
├── Interviews/
│   ├── SYNTHESE.md        Querauswertung aller sechs Gespräche
│   ├── transkripte/       die vollständigen Gespräche, anonymisiert
│   └── auswertungen/      strukturierte Notizen nach eigener Vorlage
└── Design-Thinking/
    ├── Interviewleitfaden.md   womit wir in die Gespräche gegangen sind
    └── Entscheidungen.md       Entscheidlog: was, wann, warum
```

## Die sechs Gespräche

Alle am Freitag, 21.08.2026, geführt — vor der ersten Zeile Produktcode.

| # | Person | Profil | Banken | Transkript | Auswertung |
|---|---|---|---|---|---|
| 01 | Reto | 22, Informatiker | UBS, BKB | [`01`](Interviews/transkripte/01_reto_transkript.txt) | [`01`](Interviews/auswertungen/01_reto.md) |
| 02 | Silvan | Engineer, auch KMU-Sicht | PostFinance | [`02`](Interviews/transkripte/02_silvan_transkript.txt) | [`02`](Interviews/auswertungen/02_silvan.md) |
| 04 | Nino | 19, Mediamatiker | UBS, Capital | [`04`](Interviews/transkripte/04_nino_transkript.txt) | [`04`](Interviews/auswertungen/04_nino.md) |
| 05 | Livia | Lernende bei einer Bank | [Bank], PKW | [`05`](Interviews/transkripte/05_livia_transkript.txt) | — |
| 06 | Selin | 17, Lernende Labor | BKB | [`06`](Interviews/transkripte/06_selin_transkript.txt) | — |
| 07 | Bruno | 59, angestellt, Wohneigentum | PostFinance + 5 weitere | [`07`](Interviews/transkripte/07_bruno_transkript.txt) | — |

Die Nummer 03 fehlt: ein Zählsprung, kein Gespräch.

**Wie weit die Auswertung reicht:** Alle sechs Gespräche sind geführt und vollständig
transkribiert. Strukturiert ausgewertet sind drei (01, 02, 04), und die
[Synthese](Interviews/SYNTHESE.md) ist die Cross-Case-Auswertung genau dieser drei — sie sagt
das in ihrer ersten Zeile selbst. Für 05–07 liegt das Transkript vor; ihre Muster sind in die
Personas eingegangen, aber nicht in das Hypothesen-Scoreboard. Das ist die offene Flanke
unserer Empathize-Phase, und wir schreiben sie lieber hin, als sie zu überdecken.

Vier dieser sechs sind als Persona in die App eingegangen: Reto, Nino, Livia und Bruno.

## Anonymisierung

Dieses Repository ist öffentlich, die Gesprächspartner sind es nicht. Zwei von ihnen sind
minderjährig. Deshalb ist das Material vor der Veröffentlichung durchgelaufen durch eine
Ersetzung, die folgendes maskiert:

| Was | Wie |
|---|---|
| Vor- und Nachnamen | durchgängige Pseudonyme, auch für Dritte im Gespräch |
| Wohn- und Arbeitsorte | `[Ort]`, `[Region]`, `[Kanton]` |
| Arbeitgeber | generische Umschreibung |
| Lehrbetrieb, der zugleich Hausbank ist | `[Bank]` |

Banken als reine Kundenbeziehung (UBS, BKB, PostFinance, Valiant) bleiben stehen — sie sind
Forschungsinhalt und identifizieren niemanden.

Ansonsten sind die Transkripte **unverändert**. Sie stammen aus automatischer Transkription und
enthalten Versprecher, Halbsätze und gelegentlich widersprüchliche Angaben. Wir haben sie
bewusst nicht geglättet: Was hier steht, ist das, was gesagt wurde.

Die Zuordnungstabelle Klarname → Pseudonym ist der Schlüssel zur Re-Identifikation. Sie liegt
ausserhalb dieses Repositorys und wird nicht veröffentlicht.
