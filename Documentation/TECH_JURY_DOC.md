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

_TODO — Die Challenge stellt drei Fragen: Was ist regelmässig? Was ist ungewöhnlich? Was verändert
sich? Hier begründen, welche davon wir bearbeiten, für welche Persona (privat vs. KMU) und über
welchen Kanal — und was wir bewusst weglassen._

**Welche technischen Grundsatzentscheide haben wir gefällt?**

_TODO — Stack, Datenquelle (synthetisch, da PostFinance weder Datensatz noch API bereitstellt),
Architektur, warum genau so._

### Technischer Aufbau

**Welche Komponenten und Frameworks haben wir verwendet?**

| Komponente | Technologie | Wozu |
|---|---|---|
| Oberfläche | React 19 · TypeScript 5.9 (`strict`) | Beide Schichten sind React-Komponenten: `src/app/` ist der Nachbau der heutigen App, `src/insights/` sind unsere Funktionen |
| Build und Dev-Server | Vite 7 (`@vitejs/plugin-react`) | `npm run dev` für die Entwicklung, `npm run build` macht Typprüfung und Produktionsbundle nach `dist/` |
| Tests | Vitest 3 | 212 Tests in 15 Dateien, alle grün. Geprüft wird die Fachlogik — Erkennung, Zerlegung, Prognose, Budget —, nicht das Aussehen |
| Gestaltung | reines CSS mit Custom Properties | 290 Tokens aus dem rekonstruierten PostFinance-Design-System in `src/theme/tokens.css`, inklusive Dark Mode. **Keine UI-Bibliothek** |
| Diagramme | von Hand geschriebenes SVG | Verlaufskurve und Donut in `src/insights/charts/` — kein Diagrammpaket, damit die Farben exakt den Tokens folgen |
| Schrift | `@font-face` | PostFinance Grotesk lokal; fehlen die Dateien, greift Inter. Die Dateien liegen aus Lizenzgründen nicht im Repository |
| Fachlogik | eigenes TypeScript, ohne Abhängigkeit | Abo-Erkennung, Zerlegung des Buchungstexts, Kontostand-Prognose, Budget-Ableitung |
| Daten | feste TypeScript-Datensätze, erzeugt mit einem Python-Generator | `src/data/personas/<id>.data.ts` — 24 Monate und 670–1150 Buchungen je Persona, einmalig generiert und nicht zur Laufzeit, damit jede Demo identisch läuft |
| Lokale Persistenz | `localStorage` | Einstellungen (z. B. Dark Mode) und das erfasste Budget überleben ein Neuladen, ohne Login und ohne Server |
| Backend (optional) | Supabase — Postgres und eine Edge Function (Deno) | Das Schema liegt als Migrationen im Repository; der Client wird erst beim ersten Zugriff nachgeladen |
| Sprachmodell | Apertus (Swiss AI), aufgerufen über die Edge Function | Formuliert **einen** Satz zum Budget — aus Zahlen, die vorher im Code gerechnet wurden |
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

_TODO_

**Was ist aus technischer Sicht besonders cool an unserer Lösung?**

_TODO — hier gehört der KI-Teil hin (Kriterium T3, "Souveräner KI-Einsatz"): Welches Modell,
an welcher Stelle, warum dort, was passiert deterministisch statt im Modell, wie prüfen wir
den Output? Die Jury bewertet, ob wir den Einsatz **verstehen**, nicht ob wir KI verwenden._

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
  für Buchungen. Heute lesen 22 Stellen in 17 Dateien die Persona-Daten direkt; sie in der
  verbleibenden Zeit umzuschreiben hätte zwei Wahrheiten riskiert. Eine ehrliche Attrappe ist uns
  lieber als eine halb echte Rechnung.

- **Erledigte Hinweise liegen im Browser, nicht an einer Person.** Ohne Login gibt es keine
  Person, an der etwas hängen könnte. Besuchergenerierte Daten hängen im Schema deshalb an einer
  `session_id` und nicht an `auth.uid()` — mit Login treten dort Regeln auf `auth.uid()` an ihre
  Stelle, ohne dass die Tabellen wandern müssen.

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
