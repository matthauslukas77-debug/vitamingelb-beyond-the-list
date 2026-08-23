# Apertus v1.5 — Fähigkeitstest

_Getestet: Sa 22.08.2026, ~00:30. Beide Endpunkte live. Alle Tests mit **synthetischen** Daten._
_Die Prüfskripte und die Zugangsdaten liegen intern und nicht im Repository._

## TL;DR — die vier Sätze, die zählen

1. **Beide APIs laufen**, sind schnell und haben kein spürbares Rate-Limit.
2. **Das Modell darf nicht rechnen.** Beide Modelle addieren 14 Zahlen falsch — jedes Mal.
3. **Das Modell erkennt Muster schlecht, erklärt sie aber sehr gut.** Aus Rohdaten hat es
   unsere eingebauten Signale grösstenteils verpasst; mit vorberechnetem Fakt formuliert es
   sauber und ohne erfundene Zahlen.
4. → **Architektur: Erkennung deterministisch im Code, Formulierung im Modell.**
   Das ist gleichzeitig unsere Antwort auf Jury-Kriterium **T3 (souveräner KI-Einsatz)**.

---

## 1. Verfügbarkeit

| | 8B (Stoney Cloud) | 70B (onprem.ai) |
|---|---|---|
| Auth | ✅ | ✅ |
| Kontextfenster | **131 072** (ausgewiesen + hart) | **> 167 000** (gemessen) |
| Latenz "Hallo" | **0.3 s** | 0.8 s |
| Durchsatz | ~80 tok/s | ~29 tok/s |
| 90 Transaktionen analysieren | **2.5 s** | 12.0 s |
| 6 parallele Requests | 6/6 in 0.3 s | 6/6 in 0.6 s |
| Rate-Limit beobachtet | keins | keins |
| 42 000 Token Kontext, Needle-Suche | ✅ 3.5 s | ✅ 15.1 s |
| 167 677 Token Kontext, Needle-Suche | ❌ HTTP 400, Limit erreicht | ✅ 63.3 s, gefunden |

Der 8B lehnt zu lange Prompts mit einem klaren HTTP 400 ab statt still zu kürzen — gut, das
können wir im Code abfangen. Der 70B hat **167 677 Token** verarbeitet und die Nadel gefunden,
also ein deutlich grösseres Fenster als der 8B.

**42k Token entsprechen grob 1 500 Transaktionszeilen** — mehr als ein Jahr Kontohistorie
einer Privatperson. Kontextlänge ist für uns also kein Problem. *Sinnvoll* ist es trotzdem
nicht, rohe Historie ins Modell zu kippen (siehe Abschnitt 3): Das Modell **findet** eine
gesuchte Zeile zuverlässig, **erkennt** aber Muster darin schlecht. Suchen ≠ Verstehen.

> **Nebenbefund:** Der 8B-Key öffnet ein ganzes Gateway, nicht nur Apertus — `/v1/models`
> listet u.a. Qwen3-Coder-Next, Nemotron-120B, MiniMax-M2.5 und OCR-Modelle.
> **Wir bleiben trotzdem bei Apertus** — die Story "Schweizer Modell für Schweizer Bank"
> ist mehr wert als ein paar Punkte Benchmark. Für Nicht-Produkt-Aufgaben (z.B. OCR von
> Belegen) wäre das Gateway aber legitim.

## 2. API-Fähigkeiten — hier unterscheiden sich die beiden stark

| Feature | 8B | 70B |
|---|---|---|
| `response_format: json_object` | ✅ **5/5** parsebar | ❌ **0/5** parsebar |
| `response_format: json_schema` (strict) | ✅ hält sich dran | ❌ ignoriert es |
| JSON **ohne** `response_format` (nur Prompt) | ✅ | ✅ **5/5** parsebar |
| Native Tool-/Function-Calls | ✅ sauberes `tool_calls` | ❌ antwortet nur Prosa |

### ⚠️ Der 70B-Bug, den man kennen muss

Mit `response_format` liefert der 70B-Gateway **kaputtes JSON** — eine doppelte öffnende
Klammer, reproduzierbar in 5 von 5 Läufen:

```
{"{"kategorie": "MIGROS BERN", "betrag": -87.40}      ← kaputt
{\n{\n  "kategorie": ...                              ← kaputt
```

Ohne `response_format` ist derselbe Prompt **5/5 sauber**. Der Gateway prefillt offenbar
selbst ein `{`.
**Regel: An den 70B niemals `response_format` senden. JSON nur über den Prompt verlangen.**

## 3. Inhaltliche Qualität

### Kategorisierung (15 Transaktionen)
- **8B:** JSON formal korrekt, aber inhaltliche Fehler — "Adobe Creative Cloud" als
  *Elektronik* statt *Abo*; Miete, Krankenkasse und Lohn **nicht** als wiederkehrend erkannt.
- **70B:** alles korrekt, inkl. Miete/Krankenkasse/Lohn als wiederkehrend.
→ Beim Verstehen ist der Abstand deutlich.

### Rechnen — ❌ beide fallen durch
Summe aus 14 Beträgen, korrekt wäre **3 193.70**:

| | Lauf 1 | Lauf 2 | Lauf 3 |
|---|---|---|---|
| 8B | 1 021.65 | 1 421.75 | 1 021.65 |
| 70B | 3 084.70 | 3 084.70 | 3 047.70 |

Der 70B liegt plausibel nah dran — **das ist das Gefährliche**: eine falsche Zahl, die
richtig aussieht. In einer Banking-App ist das der schlimmste Fehlertyp.
**Jede Zahl, die wir anzeigen, wird im Code gerechnet. Ausnahmslos.**

### Halluzination — ✅ beide bestehen
Auf "Wie viel gab der Kunde bei Coop aus?" (Coop kommt in den Daten nicht vor) sagen
**beide** korrekt, dass die Daten das nicht hergeben, und erfinden nichts.

### Schweizerdeutsch — ✅ beide bestehen
Mundart-Interviewpassage ("chündige", "churzfristig", "wenn's knapp wird") wird von beiden
korrekt ins Hochdeutsche zusammengefasst. → Unsere Interviewtranskripte sind maschinell
verarbeitbar.

### Die drei Challenge-Fragen auf 90 Transaktionen — ⚠️ hier wird es unbequem
Wir haben drei Signale in die Testdaten eingebaut:

| Eingebautes Signal | 8B | 70B |
|---|---|---|
| Adobe 59.90 → 89.90 ab Juni | ❌ als "regelmässig" abgelegt | ⚠️ erkannt, **Monat falsch** ("ab Mai") |
| Essen auswärts 3× → 9× pro Monat | ❌ "variiert von Tag zu Tag" | ⚠️ halb — argumentiert über Beträge statt Häufigkeit |
| Frage "Was ist ungewöhnlich?" | ❌ **nennt den Lohn** | ❌ **nennt den Lohn** |

Beide Modelle halten die monatliche Lohnzahlung für das Ungewöhnlichste am Konto. Das ist
per Definition das Regelmässigste, was es gibt. Teilweise ist das ein Prompt-Fehler
("ungewöhnlich" ohne Definition lädt zu "grösste Zahl" ein) — aber es zeigt:
**auf Mustererkennung aus Rohdaten können wir nicht bauen.**

### Gegenprobe: Fakt vorberechnet, Modell formuliert nur — ✅ genau so soll es sein
Mit einem im Code erkannten Signal (alt/neu/Differenz/%/Jahreswirkung) als Input:

> **70B:** "Abo-Preis-Erhöhung Adobe Creative Cloud — Ihr Adobe Creative Cloud-Abo wird ab
> dem 15. Juni 2026 von bisher CHF 59.90 auf neu CHF 89.90 erhöht. Dies entspricht einer
> Erhöhung von CHF 30.00 bzw. 50.1 %. Pro Jahr ergibt sich daraus eine zusätzliche Belastung
> von CHF 360.00."

Alle Zahlen korrekt übernommen, keine erfunden, Ton passt. Der 8B schafft das auch, lässt
aber Prozent und Jahreswirkung weg und endet in einem generischen "kontaktieren Sie den
Kundenservice".

## 4. Empfehlung für den Bau

```
Transaktionen
   ↓
[ Code ]   Kategorisierung, Wiederkehr-Erkennung, Statistik, Abweichung, Forecast
   ↓       → deterministisch, testbar, jede Zahl beweisbar
erkanntes Signal (strukturiert)
   ↓
[ Apertus ] formuliert die Erklärung + Handlungsoption
   ↓       → nur Sprache, keine Rechnung, keine Entscheidung
Karte in der App
```

**Modellwahl:**
- **8B** für alles Strukturierte und alles Interaktive — JSON-Modus funktioniert,
  Tool-Calls funktionieren, 0.3 s Latenz ist demo-tauglich. Erste Wahl für den Live-Chat.
- **70B** für die finalen Formulierungen, die im Video/Demo sichtbar sind — merklich besser
  im Deutsch und im Verstehen. Ohne `response_format`, JSON per Prompt, defensiv parsen.
- Beides ist derselbe OpenAI-Client mit anderer `base_url` → Umschalten kostet eine Zeile.

**Nicht verhandelbar:**
1. Keine vom Modell gerechnete Zahl in der UI.
2. `response_format` nie an den 70B.
3. Fallback bereitlegen (vorberechnete Texte), falls der Endpoint am Sonntag klemmt.
4. Keys nur aus `.env` — nie im Screenshot, nie im Video.
