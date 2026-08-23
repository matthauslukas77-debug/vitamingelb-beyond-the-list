# Vitamin Gelb — Beyond the List (PostFinance)
## Technische Informationen für die Jury

> Struktur 1:1 gemäss offizieller Vorlage `BernHackt_Tech Jury Template Documentation.docx`.
> Abschnitte und Reihenfolge nicht ändern — die Jury liest gegen diese Gliederung.
> Vor Hands-off (So 12:00) als PDF/DOCX daneben legen, falls die Jury ein Dokument statt Markdown erwartet.

---

### Aktueller Stand des Sourcecodes

- **GitHub-Repository:** <https://github.com/matthauslukas77-debug/vitamingelb-beyond-the-list>
- **Stand / Branch:** `main`
- **Lauffähig?** Ja. `cd Code && npm install && npm run dev` — ohne Schlüssel, ohne Backend. `npm test` und `npm run build` laufen grün.

### Ausgangslage

**Worauf haben wir uns fokussiert?**

Die Challenge stellt drei Fragen: Was ist regelmässig? Was ist ungewöhnlich? Was verändert sich?
Wir beantworten alle drei, aber das Gewicht liegt auf den beiden hinteren — weil es dafür heute
**gar keine** Antwort gibt. Auf «Wie findest du heraus, ob ein Monat normal war?» antwortete Silvan
in Interview 02 wörtlich: «Gar nicht.»

**Für wen.** Privatpersonen zwischen 19 und 30, belegt aus acht eigenen Interviews. KMU haben wir
bewusst nicht bedient: Wir haben kein einziges KMU-Gespräch geführt, und eine Zielgruppe ohne
Beleg zu bauen hiesse raten. Das steht so auch in unserer Synthese.

**Über welchen Kanal.** Nicht über ein weiteres Dashboard. Der härteste Befund der Interviews ist,
dass die bestehenden Analysen faktisch tot sind — Reto: «ist so ein bisschen versteckt,
untergegangen»; Silvan hat sie in Jahren drei- bis viermal geöffnet; Nino nie. Alle drei öffnen
die App nur für den Saldo. Wer darauf mit einer weiteren Kachel antwortet, baut denselben Fehler
noch einmal. Unsere Funktionen sitzen deshalb dort, wo ohnehin hingeschaut wird: auf Home, im
Suchfeld und in einem Hinweis, der von selbst kommt.

**Was wir weggelassen haben.** Multibanking — PostFinance hat es seit November 2025 live, und
unsere Hypothese dazu ist an der Zielgruppe gescheitert: Für Junge mit zwei Konten ist die
Gesamtsicht kein Gewinn. Und einen Chat-Bildschirm, aus demselben Grund wie oben; von acht
Gesprächspartnern hat genau eine Person unaufgefordert einen Chatbot erwähnt.

**Welche technischen Grundsatzentscheide haben wir gefällt?**

**1 · Nachbau und eigene Schicht getrennt, verbunden über Slots.** `src/app/` ist der Nachbau der
heutigen App und bekommt keine eigenen Ideen; `src/insights/` ist unser Beitrag. Verbunden sind
sie über benannte Slots. Nimmt man unsere Schicht heraus, steht der Ist-Zustand da. Das ist keine
Ordnungsliebe, sondern die Voraussetzung dafür, dass «vorher/nachher» überhaupt zeigbar ist.

**2 · Synthetische Daten, einmal erzeugt, nie zur Laufzeit.** PostFinance stellt weder Datensatz
noch Schnittstelle bereit. Unsere vier Personas entstehen aus einem festen Startwert und liegen
als TypeScript im Repository — 670 bis 1'147 Buchungen über 24 Monate. Jede Demo läuft damit
identisch, und es gibt keine Datenschutzfrage, die man in 40 Stunden nicht sauber beantworten
kann.

**3 · Alle Beträge als ganzzahlige Rappen.** Kein Fliesskomma, nirgends. Gerundet wird erst bei
der Anzeige. Die einzige Ausnahme ist das portierte PostFinance-Modell, das in ganzen Franken
rechnet — die Umrechnung liegt an genau einer Stelle (`benchmark.ts`).

**4 · Keine UI- und keine Diagrammbibliothek.** Jede Fläche und jede Kurve ist von Hand
geschrieben. Der Grund ist die Marke: Ein zugekauftes Diagramm bringt seine eigene Palette mit,
und dann stimmt der Ton neben dem Nachbau nicht mehr.

**5 · Erkennung deterministisch im Code, das Modell nur für Sprache und Absicht.** Der wichtigste
Entscheid, und er ist gemessen statt geglaubt — die Begründung steht unten unter «Implementation».

**6 · Alles Wesentliche läuft ohne Schlüssel.** `npm install && npm run dev` genügt. Supabase und
Apertus schalten sich still ab, wenn keine Konfiguration da ist.

### Technischer Aufbau

**Welche Komponenten und Frameworks haben wir verwendet?**

| Komponente | Technologie | Wozu |
|---|---|---|
| Oberfläche | React 19 · TypeScript 5.9 (`strict`) | Beide Schichten sind React-Komponenten: `src/app/` ist der Nachbau der heutigen App, `src/insights/` sind unsere Funktionen |
| Build und Dev-Server | Vite 7 (`@vitejs/plugin-react`) | `npm run dev` für die Entwicklung, `npm run build` macht Typprüfung und Produktionsbundle nach `dist/` |
| Tests | Vitest 3 | 471 Tests in 30 Dateien, alle grün. Geprüft wird die Fachlogik — Erkennung, Zerlegung, Prognose, Budget, Assistent — und seit einem Vorfall auch die Stilvorlagen |
| Gestaltung | reines CSS mit Custom Properties | 290 Tokens aus dem rekonstruierten PostFinance-Design-System in `src/theme/tokens.css`, inklusive Dark Mode. **Keine UI-Bibliothek** |
| Diagramme | von Hand geschriebenes SVG | Verlaufskurve, Donut, Prognose und die Budget-Blasen mit eigenem Circle Packing — kein Diagrammpaket, damit die Farben exakt den Tokens folgen |
| Schrift | `@font-face` | PostFinance Grotesk lokal; fehlen die Dateien, greift Inter. Die Dateien liegen aus Lizenzgründen nicht im Repository |
| Fachlogik | eigenes TypeScript, ohne Abhängigkeit | Abo-Erkennung, Zerlegung des Buchungstexts, Kontostand-Prognose, Budget-Ableitung |
| Daten | feste TypeScript-Datensätze, erzeugt mit einem Python-Generator | `src/data/personas/<id>.data.ts` — 24 Monate und 670–1150 Buchungen je Persona, einmalig generiert und nicht zur Laufzeit, damit jede Demo identisch läuft |
| Lokale Persistenz | `localStorage` | Einstellungen (z. B. Dark Mode) und das erfasste Budget überleben ein Neuladen, ohne Login und ohne Server |
| Backend (optional) | Supabase — Postgres und eine Edge Function (Deno) | Das Schema liegt als Migrationen im Repository; der Client wird erst beim ersten Zugriff nachgeladen |
| Sprachmodell | Apertus (Swiss AI), über zwei Edge Functions | `explain` (70B) formuliert **einen** Satz aus fertig gerechneten Zahlen. `ask` (8B) bildet eine Frage auf eines von sechs Werkzeugen ab und gibt **nur** dessen Namen zurück, nie Text |
| Auslieferung | Vercel · Web-App-Manifest | `vitamingelb.ch` mit SPA-Rewrites; «Zum Home-Bildschirm» startet die Demo im Vollbild wie eine App |

Laufzeitabhängigkeiten sind React, React-DOM und — nur wenn konfiguriert und dann nachgeladen —
der Supabase-Client. Sonst nichts.

**Wozu und wie werden diese eingesetzt?**

Am Anfang steht ein fester Datensatz pro Persona: Konten, Buchungen im Textformat des echten
Kontoauszugs, Daueraufträge und pendente Aufträge — alle Beträge als ganzzahlige Rappen, gerundet
wird erst bei der Ausgabe. Daraus rechnet reines TypeScript ohne UI: `domain/recurring.ts` erkennt
Zahlungsreihen aus Buchungstext, Betrag und Abstand — nicht aus einer ID im Datensatz, die es in
echten Kontodaten nicht gibt; `domain/booking.ts` zerlegt den Buchungstext in Zahlungsart,
Kaufdatum, Karte, Händler und Land; `insights/engine/balance.ts` baut den Kontostandverlauf und
rechnet ihn mit den erkannten Reihen und den pendenten Aufträgen in die Zukunft weiter.

Sichtbar wird das über Slots. Die Nachbau-Screens rendern an definierten Stellen
`<Slot name="home.accountRow" fallback={…} />`; ist in `insights/registry.tsx` eine Komponente
dafür eingetragen, ersetzt sie den Baustein des Nachbaus — sonst zeigt die App exakt den
Ist-Zustand. Damit lässt sich jede Funktion einzeln an- und abschalten, und die Grenze zwischen
bestehendem Produkt und eigenem Beitrag bleibt im Code sichtbar.

Erst am Ende, nachdem alles gerechnet ist, kommt das Sprachmodell dazu. Der Client wählt den
Befund deterministisch aus, schickt nur fertige Zahlen an die Edge Function `explain` — dort
entsteht der Prompt, dort liegt der Schlüssel — und eine Zahlenwache verwirft jede Antwort, die
eine Zahl enthält, die wir nicht geliefert haben. Der gerechnete Satz steht ohnehin schon da;
Apertus ersetzt ihn nur bei Erfolg.

Deshalb läuft alles Wesentliche ohne Netz und ohne Schlüssel: `npm install && npm run dev`
genügt. Supabase und Apertus schalten sich still ab, wenn keine Konfiguration vorhanden ist.

### Implementation

**Gibt es etwas Spezielles zur Implementation?**

**Der PostFinance-Budgetrechner ist nicht nachgebaut, sondern vermessen.** Aus dem Angular-Bundle
des öffentlichen Rechners haben wir Struktur und Beschriftungen rekonstruiert — sechs Kategorien,
neunzehn Detailfelder, Texte wörtlich — und die Rechenlogik gegen **2'513 Messpunkte seiner
eigenen API** geprüft: maximal 1 CHF Abweichung pro Jahr, die Klassenzuordnung in 100 % der Fälle
korrekt. Damit ist «du zahlst mehr fürs Wohnen als ein vergleichbarer Haushalt» eine Aussage im
selben Massstab und keine Behauptung.

**Sparen ist keine Ausgabe.** Jede Buchung bekommt eine Achse: `out · in · moved · settled · lent`.
Eine Umbuchung aufs eigene Sparkonto ist `moved`, die Kartenabrechnung `settled` — sonst zählt man
sie doppelt. Der Anlass kam aus zwei unabhängigen Interviews mit fast demselben Satz. Livia, in einer
Banklehre: «Ich tue 500 Franken auf das Sparkonto, dann ist das wie quasi als Ausgabe.
Obwohl es eigentlich gar nicht weg ist.» Und der Finanzberater aus Interview 08, ein anderes
Institut, ein anderes Leben: «Es müsste auch noch Sparen gefiltert werden — weil die ist halt
nachher nicht weg, oder?»

**Eine Antwort pro Quelle, nicht pro Buchung.** Beim Korrigieren einer Kategorie speichern wir am
Händlerschlüssel, nicht an der Buchung. Bruno hat 20 LANDI-Einkäufe in zwölf Monaten; heute wären
das zwanzig Dropdowns, bei uns ist es ein Zug — rückwirkend und für künftige Buchungen. Die
Zuordnung ändert dabei **keine** Buchung: `tx.category` bleibt, was die Bank geliefert hat, damit
der Vergleich mit dem Ist-Zustand möglich bleibt.

**Die Blasen sind echtes Circle Packing.** Der Front-Chain-Algorithmus (Wang et al., CHI 2006) von
Hand ausgeschrieben, deterministisch sortiert statt zufällig, Fläche proportional zum Betrag. Die
Farbe läuft über `color-mix` durch die Marken-Rampe, damit auch der Verlauf aus den Tokens kommt.

**Tests, die auch das Aussehen prüfen.** Ein Fehler hat es bis auf die Live-Seite geschafft: Beim
Umbau der Blasen blieb die halbe CSS-Datei doppelt stehen, und die alte Kopie überschrieb als
spätere Regel die neue — alle Blasen rot. Weder Typprüfung noch Tests konnten das sehen, weil CSS
für beide unsichtbar war. Seither liest eine Testdatei die Stilvorlagen als Text und prüft, was
sonst niemand prüft: dass jeder Abschnitt genau einmal vorkommt, dass keine Farbe ausserhalb der
Tokens steht, dass jedes `flex: 1` ein `min-width` hat — die häufigste Ursache für seitliches
Scrollen —, und dass keine feste dunkle Rampenstufe als Fläche dient, weil die im dunklen Modus
exakt die Seitenfarbe ist. Jede dieser Regeln steht dort, weil sie einmal verletzt wurde.

**Und Tests gegen zwei Wahrheiten.** Dieselbe Zahl darf nicht an zwei Orten verschieden heissen.
Einmal wich der Assistent um CHF 729 vom Cockpit ab, weil er über einen anderen Weg rechnete;
einmal fehlten CHF 76 im Monat, weil ein TWINT-Saldo in einer von zwei Funktionen fehlte. Beide
Fälle sind heute durch einen Test gebunden, der die beiden Wege gegeneinander rechnet.

**Was ist aus technischer Sicht besonders cool an unserer Lösung?**

Dass wir Apertus einsetzen, ist nicht das Interessante. Interessant ist, **wo wir es nicht tun** —
und dass diese Grenze aus eigenen Messungen stammt.

**Was wir gemessen haben, bevor wir gebaut haben.** Wir haben beide Apertus-Grössen (8B und 70B)
gegen 90 Testtransaktionen mit drei eingebauten Signalen laufen lassen:

- Beide addieren vierzehn Beträge **falsch**, jedes Mal. Der 70B liegt dabei plausibel nah dran —
  in einer Banking-App der teuerste Fehlertyp, weil er niemandem auffällt.
- Auf «Was ist ungewöhnlich?» nennen **beide den Lohn**. Das Regelmässigste, was es auf einem
  Konto gibt.
- Mit einem **vorberechneten** Fakt formulieren sie sauber und erfinden keine Zahl.

Daraus folgt die Architektur, nicht aus einer Haltung: **Erkennen im Code, Sprache im Modell.**

**Drei Stellen, drei verschiedene Rollen.**

| Stelle | Modell | Aufgabe | Was das Modell **nicht** darf |
|---|---|---|---|
| Erkennung | keines | Reihen, Abweichungen, Budget, Prognose | — |
| `explain` | Apertus 70B | einen Satz aus fertigen Zahlen formulieren | rechnen, runden, folgern, empfehlen |
| `ask` | Apertus 8B | die Frage auf ein Werkzeug abbilden | antworten |

Der 8B ist der Router, weil er als Einziger saubere Tool-Calls liefert und in 0.3 s antwortet; der
70B schreibt das bessere Deutsch. Beide Zuordnungen sind gemessen, nicht geraten.

**Die Wachen — jede steht wegen eines echten Vorfalls da.**

- **Zahlenwache.** Jede Zahl in einer formulierten Antwort muss im Prompt gestanden haben. Sie hat
  beim ersten Lauf sofort etwas gefunden: Der 70B schrieb «fast CHF 400», wo die Differenz 349
  war. Sprachlich eine Näherung, in einem Budget eine falsche Zahl.
- **Argumentwache.** Dieselbe Regel für Zeichenketten. Auf «Kannst du mir diesen Namen auflösen?»
  antwortete der 8B mit `{"name":"UBS"}`, im nächsten Lauf mit `{"name":"Amazon"}` — beide stehen
  nirgends in der Frage. Ein ausdrückliches Verbot im Systemtext half nicht; die Prüfung schon.
- **Themenzaun.** Anlagen, Vorsorge, Hypotheken und Urteile über die Person werden abgelehnt, mit
  Begründung. Er läuft **serverseitig**, weil der Endpunkt auch ohne unseren Browser erreichbar
  ist. Michaels Frage aus Interview 07 — «Ich brauche in anderthalb Jahren 40'000 Franken, wo
  bekomme ich die am schlausten her?» — ist die konkreteste des ganzen Samples und die einzige,
  die wir bewusst nicht beantworten.
- **Der Katalog ist die Grenze.** `ask` gibt **niemals Text zurück, den das Modell geschrieben
  hat** — heraus kommt ein Werkzeugname aus einem Katalog von sechs oder nichts. Den Satz baut
  danach der Browser aus dem geprüften Motor. Ein halluzinierter Betrag kann diesen Weg nicht
  nehmen, weil auf ihm keine Beträge fliessen.

**Der nachsichtige Leser — unser liebster Befund.** Der 8B wählt fast immer richtig und verpackt
fast nie richtig: Von sechzehn korrekten Werkzeugwahlen kamen nur **sieben** als sauberes
`tool_calls` zurück. Neun standen als blosser Text im Antwortfeld, einer davon als
`extraordinary<|tools_prefix|>[{"extraordinary": }]` — ein Vorlagen-Token des Chat-Templates war
durchgesickert. Wer nur `tool_calls` liest, wirft mehr als die Hälfte der richtigen Antworten weg.
Unser Leser nimmt beide Formen und prüft dafür streng gegen den Katalog: **20 von 21 statt 11 von
21**, bei unverändertem Modell.

**Und das Modell ist verzichtbar.** Die Absichtserkennung läuft zuerst im Code. Gegen 149
Formulierungen aus unseren eigenen Interviews trägt sie **62 %** — sofort, ohne Netz, ohne
Schlüssel. Der Router kommt nur dort zum Zug, wo Muster ehrlich versagen; bei der Händlerfrage
sind das 20 von 25 Fällen, weil «Wer ist eigentlich dieser SumUp auf meiner Abrechnung?» kein
Muster trifft, das man von Hand schreiben würde. Fällt Apertus aus, verliert die App
Formulierungsvielfalt — keine Funktion.

### Abgrenzung / Offene Punkte

**Welche Abgrenzungen haben wir bewusst vorgenommen und damit nicht implementiert? Weshalb?**

- **Kein Schreibpfad in die Datenbank — die Anwendung rechnet lokal.** Supabase ist angebunden:
  Das Schema liegt als Migration im Repository, der Client ist gegen die generierten Typen
  gebunden. Genutzt wird davon aber nur die Edge Function `explain`; keine Tabelle wird gelesen
  oder geschrieben. Der Grund ist eine Zusage an diese Jury: `npm install && npm run dev` läuft
  ohne einen einzigen Schlüssel. Ein Schreibpfad hätte daraus eine Anwendung gemacht, die ohne
  Projekt, Schlüssel und Seed nichts zeigt. Der Preis ist bewusst gewählt und benannt: Was man in
  der Demo anlegt, überlebt kein Neuladen.

  Vorgesehen ist es trotzdem, und das ist im Entwurf nachweisbar statt behauptet: `transactions`
  führt `counter_account_id` für Umbuchungen auf ein eigenes Konto und ein `pending`-Flag;
  `session.tsx` legt mit `ownPending`/`ownStanding` bereits eine eigene Schicht über die
  Stammdaten; `isSupabaseConfigured()` lässt jeden Backend-Pfad still auf das lokale Verhalten
  zurückfallen. Es fehlt der letzte Schritt, nicht die Vorbereitung.

- **Zahlungen laufen durch, buchen aber nicht.** Der Zahlungsfluss ist vollständig bedienbar und
  legt Aufträge an, erzeugt aber keine Buchung. Sobald eine Buchung echt wäre, ändert sie jede
  abgeleitete Zahl — Kontostand, Prognose, Budget, Signale. Sauber heisst dafür: **eine** Quelle
  für Buchungen. Heute lesen 30 Stellen in 23 Dateien die Persona-Daten direkt; sie in der
  verbleibenden Zeit umzuschreiben hätte zwei Wahrheiten riskiert. Eine ehrliche Attrappe ist uns
  lieber als eine halb echte Rechnung.

- **Erledigte Hinweise liegen im Browser, nicht an einer Person.** Ohne Login gibt es keine
  Person, an der etwas hängen könnte. Besuchergenerierte Daten hängen im Schema deshalb an einer
  `session_id` und nicht an `auth.uid()` — mit Login treten dort Regeln auf `auth.uid()` an ihre
  Stelle, ohne dass die Tabellen wandern müssen.

- **Kein Chat-Fenster, obwohl wir einen Assistenten haben.** Er sitzt im Suchfeld: eine Frage,
  eine Antwort, kein Verlauf und kein Gedächtnis über Runden. Der Grund ist derselbe wie oben —
  ein Chat-Bildschirm wäre wieder ein Ort, den man aufsuchen muss, und genau daran sind die
  bestehenden Analysen gescheitert. Dazu kommt der Befund aus den Interviews: Gefragt wurde nach
  *Antworten*, nicht nach einem Dialogfenster; eine einzige von acht Personen hat einen Chatbot
  überhaupt erwähnt. Der Preis ist benannt: «Wer ist Hornbach?» wird beantwortet, «und letztes
  Jahr?» nicht.

- **Kein Rate-Limit auf der Edge Function.** Der Endpunkt ist mit dem öffentlichen anon-Key
  erreichbar; begrenzt sind heute nur Länge (300 Zeichen), Antwortlänge und Zeit. Für einen
  Prototyp mit erfundenen Daten tragbar, für den Betrieb nicht — es fehlt eine Zählung pro
  Absender.

- **Alle Daten sind erfunden.** Vier Personas mit je 24 Monaten Buchungen, erzeugt aus einem
  festen Startwert. Kein Bankanschluss, keine echten Kontodaten — und damit auch keine
  Datenschutzfrage, die wir in einem Hackathon nicht sauber beantworten könnten.

**Offene Punkte / was als Nächstes käme**

- **Eine Quelle für Buchungen.** `session.transactions` als Summe aus Stammdaten und eigenen
  Buchungen, die 22 direkten Zugriffe darauf umgestellt. Absicherung zuerst: Mit leerer eigener
  Schicht muss jede abgeleitete Zahl identisch zu heute bleiben — erst dann die Verhaltensänderung.
- **Danach bucht die Zahlung wirklich**, und ein Spar-Hinweis schliesst sich aus den Daten statt
  auf Knopfdruck: Die Erkennung sieht die Umbuchung aufs Sparkonto und der Hinweis verschwindet.
- **Dann Persistenz.** Eigene Buchungen gehören in eine eigene Tabelle an der `session_id` — nicht
  als `insert` auf `transactions`. Diese Tabelle ist öffentlich lesbare Demo-Grundlage; ein offener
  Schreibzugriff darauf liesse jeden Besucher die Demo für alle anderen verändern.
- **Härtung der Leseregeln.** Die Policies für `conversations`, `messages`, `goals` und `plans`
  stehen auf `using (true)`, also für alle lesbar. Solange dort nur erfundene Demodaten liegen ist
  das tragbar; sobald jemand eigene Texte eingibt, gehört die Regel an die Sitzung gebunden.
