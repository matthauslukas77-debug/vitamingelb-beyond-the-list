# Beyond the List — Prototyp

Nachbau der PostFinance-App (v6) als Web-App, plus eine klar abgetrennte Schicht für
unsere eigenen Funktionen. Stand: **der Nachbau läuft; aus unserer Schicht sind der
Kontostand-Verlauf mit Prognose (Slot `home.accountRow`), die Abo-Detailseite und das
Cockpit mit dem abgeleiteten Budget aktiv.** Die übrigen Slots sind leer — dort zeigt der
Prototyp weiterhin exakt den Ist-Zustand.

## Starten

```bash
npm install
npm run dev
```

Danach `http://localhost:5173` öffnen. Nötig ist Node 20.19+ (`engines` in `package.json`),
entwickelt auf Node 22.

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm test` | Testlauf |
| `npm run build` | Typprüfung und Produktionsbuild nach `dist/` |
| `npm run preview` | Produktionsbuild lokal ausliefern |

### Auf dem Handy

Der Server hört auf allen Interfaces (`host: true`) — die Netzwerk-URL aus der Konsole lässt
sich direkt auf dem Handy im gleichen WLAN öffnen. Über Tailscale ist zusätzlich
`allowedHosts: ['.ts.net', '.local']` gesetzt, sonst blockt Vite den fremden Host-Header.

Auf schmalen Bildschirmen verschwindet der Telefonrahmen: Die App füllt den Bildschirm
randlos, mit den echten sicheren Bereichen von iOS (Notch, Home-Indikator) statt der
simulierten Statusleiste. Am Schreibtisch bleibt der Rahmen, damit die Proportionen stimmen.

**«Zum Home-Bildschirm» hinzufügen** gibt der App ein eigenes Icon und startet sie im
Vollbild ohne Safari-Leisten — das ist die Ansicht für die Live-Demo. Voraussetzung ist
eine HTTPS-URL (z. B. über `tailscale serve`) oder `localhost`.

## Woher die Buchungen kommen

Die Personas haben keine zur Laufzeit erzeugten Daten mehr. Ihre Buchungen
liegen fertig in `src/data/personas/<id>.data.ts` — **generiert, nicht von Hand
pflegen**. Quelle und Generator:
`WORKSPACE/04_experiments/postfinance_template_data/`.

Je Persona 24 Monate (2024-09-01 bis zum Demo-Stichtag), 670–1150 Buchungen,
Buchungstexte im Format des echten Auszugs, konsistenter Saldo. Daneben liegen
dort dieselben Daten als Monatsauszüge im PostFinance-CSV-Layout.

Neu erzeugen:

```bash
cd ../../WORKSPACE/04_experiments/postfinance_template_data/_generator
python3 generate_synthetic.py && python3 to_app.py
```

Von Hand gepflegt bleibt `src/data/personas/<id>.ts`: Konten, Rolle, Zitat,
Daueraufträge und offene Aufträge — alles, was aus dem Interview kommt.

### Das Adressbuch

Der Zahlungsauftrag braucht Empfänger mit Adresse, Bank und IBAN — Angaben, die im
Buchungstext nicht stehen. Sie liegen in `src/data/personas/<id>.beneficiaries.ts`,
je Persona vier Einträge.

Erfunden ist daran nur, was eine Bank nicht in den Auszug schreibt. **Wen** eine
Persona bezahlt, kommt aus ihren eigenen Buchungen: Nino zahlt Miete an die
«WG Länggasse» und schickt TWINT an Tobias Frei, Bruno zahlt Steuern an den Kanton
Bern. Das Feld `match` ist das Textfragment, über das der Fluss die frühere Zahlung
wiederfindet — daraus entsteht «Daten der bestehenden Zahlung kopieren» mit echtem
Betrag und echtem Datum. Ein Test hält fest, dass jeder Empfänger wirklich in den
Buchungen oder Aufträgen dieser Persona vorkommt.

Die IBANs sind erfunden, aber strukturell gültig: Prüfziffern nach ISO 7064
Mod 97-10, echte Clearing-Nummer der genannten Bank. Auch die Konten der Personas —
sie stehen jetzt in der Zusammenfassung einer Zahlung und wären mit falschen
Prüfziffern ein Fehler, den man sieht.

## Händlerlogos

In der Buchungsliste steht links das echte Logo des Händlers, sobald der Buchungstext
sich auflösen lässt. Zuständig ist [`src/data/brands.ts`](src/data/brands.ts):
eine Musterliste, längster Treffer gewinnt, Vergleich nur an Wortgrenzen. Kein Netz,
kein Modell — ein falsches Logo wäre schlimmer als keines.

* Registry: [`src/data/brands.data.ts`](src/data/brands.data.ts), 400 Marken.
  **Generiert** aus `WORKSPACE/05_assets_scratch/abo_logos/logos.json` — nicht von Hand pflegen.
* Bilddateien: `public/logos/`, auf 128 px verkleinert (4.1 MB gesamt).
* Darstellung: [`src/app/shell/BrandAvatar.tsx`](src/app/shell/BrandAvatar.tsx) —
  Logo, sonst die Farbscheibe der Persona, sonst das Kategoriesymbol.
* Scheibenfarbe: [`src/data/logo-backgrounds.ts`](src/data/logo-backgrounds.ts),
  190 der 400 Logos. **Generiert** von
  `WORKSPACE/05_assets_scratch/abo_logos/_tools/logo_backgrounds.mjs`.

### Warum die Scheibe eine Farbe hat

Ein Logo ist quadratisch, sein Platz in der Liste ist rund. Bei einem breiten Logo
wie TWINT passt die App es oben und unten ein — und auf weissem Grund schaute dort
das Weiss heraus: ein eckiges Logo mit hellen Rändern im runden Feld.

Statt 400 Grafiken zu beschneiden nimmt die Scheibe die Farbe an, die das Logo an
seinem Rand ohnehin hat. Der Kreis wird zur Maske, das Logo liegt darin, der Rest
trägt dieselbe Farbe — die Kante verschwindet. Gemessen wird an den Bilddateien:
der häufigste Randfarbwert, nicht der Mittelwert, denn ein schwarzer Balken mit
farbigem Zeichen ergibt im Mittel ein schmutziges Grau.

Die Farbe wird nicht geglaubt, sondern geprüft. Manche Bildmarken laufen selbst bis
an den Rand — das «n» von Negishi steht mit Stamm und Fuss auf der Kante. Dort ist
die Randfarbe die des *Zeichens*, und die Scheibe darin würde das Logo auslöschen.
Der Erzeuger stellt deshalb jede Scheibe nach, legt das Logo darüber und zählt, was
sich noch abhebt. Über alle 400 Logos ist Negishi der einzige Fall, der dabei auf
null fällt; der nächste liegt bei 0.082. In dieser Lücke steht die Schwelle.

Ohne Farbe bleiben: freigestellte Logos (durchsichtiger Rand), Verläufe ohne eine
Farbe, und alle, deren Rand ohnehin weiss ist — das ist der Standard der Scheibe.

Getroffen werden je nach Persona 81–90 % der Buchungen. Was übrig bleibt, sind
`SIX Payment <Nr>`-Terminals, lokale Betriebe ohne Marke und generische Texte wie
`KRANKENKASSE PRAEMIE` — genau die Fälle, für die es die Rückfrage an den Nutzer braucht.

### Signale

`src/insights/signals/` — Schicht 1 des Anomalie-Systems, erreichbar über den Kreis oben
links auf jedem Reiter. Das Gegenstück zum Cockpit: dort die Instrumente, hier die
Leuchten.

| Signal | woraus |
|---|---|
| **Zusätzlich hereingekommen** | eine Gutschrift im laufenden Monat ausserhalb der bekannten Reihen — Bonus, Rückerstattung |
| **Neuer Arbeitgeber** | eine Lohnreihe endet, eine ähnlich grosse beginnt kurz darauf |
| **Kommt wieder** | eine Sonderzahlung im Jahresabstand — der dreizehnte Monatslohn, mit dem nächsten Termin |
| **Abo teurer geworden** | `priceChange`, das `detectRecurring` ohnehin liefert |
| **Sprengt die Kategorie** | eine Buchung über dem Doppelten ihres Kategorienbudgets |
| **Neu aufgetaucht** | eine Reihe, die es im Vormonat noch nicht gab |
| **Abo-Verdacht** | zwei gleiche Beträge im Monatsabstand — als Frage, nicht als Behauptung |
| **Ausgeblieben** | eine erwartete monatliche Belastung ist nicht gekommen |

Vier Regeln, die für jede Karte gelten:

1. **Kein Signal ohne Beleg** — jede Karte trägt die Buchungen, aus denen sie stammt.
2. **Verdacht heisst Verdacht** — zwei Buchungen sind kein Muster.
3. **Rang statt Reihenfolge** — sortiert nach Betrag × Konfidenz × Aktualität.
4. **Alles lässt sich erledigen** — sonst bedeutet der rote Punkt nach einer Woche nichts.

**«Neu» ohne Datenbank:** Die Reihen werden zweimal erkannt — einmal über den ganzen
Bestand, einmal über den Bestand bis Ende Vormonat. Was nur im ersten Lauf vorkommt, ist
neu. Deterministisch und beim allerersten Start verfügbar; eine gespeicherte Momentaufnahme
wäre eine zweite Wahrheit neben den Buchungen.

Die Aktionen sind der Punkt. «Du hast CHF 800 mehr bekommen» ist eine Feststellung;
**«CHF 500 sparen»** öffnet den fertigen Zahlungsfluss mit Empfänger und Betrag —
`savingsRecipient()` nimmt das eigene PostFinance-Sparkonto, sonst das bei einer anderen
Bank als echte Zahlung auf die eigene IBAN. **«Einordnen»** ist die Markierung von oben.
Damit schliesst sich der Kreis: Das Signal findet den Ausreisser, die Einordnung nimmt ihn
aus der Statistik, und dieselbe Karte kommt nicht wieder.

## Direktlinks

Für Demo und Screenshots lässt sich jeder Einstieg per URL ansteuern:

```
?persona=reto                    Persona direkt öffnen
?persona=bruno&screen=cockpit    zusätzlich einen Bildschirm
?persona=bruno&screen=cockpit&view=analysis   direkt eine Cockpit-Ansicht
?persona=nino&screen=account     Kontodetail (optional &account=<id>)
?persona=bruno&screen=expenses  Ausgaben nach Oberkategorie
?persona=livia&screen=settings   Profil und Einstellungen
                                 (optional &section=notifications)
?persona=nino&screen=pay         Zahlungsauftrag, Schritt 1 (Empfänger)
```

Zusätzlich `&tab=payments` für den Startreiter.

Personas: `reto` · `nino` · `livia` · `bruno`.
Reiter: `home` · `payments` · `invest` · `offers` · `services`.
Bildschirme: `account` · `cockpit` · `budget` · `signals` · `income` · `expenses` ·
`recurring` · `scan` · `pay` · `transfer` · `search` · `settings`.
Ansichten von `cockpit`: `budget` · `analysis` · `recurring`, über `&view=`.
Abschnitte von `settings`: `profile` · `login` · `notifications` · `accounts` · `payments` ·
`invest` · `orders` · `app` · `twint` — ohne `&section` öffnet die Übersicht.
`recurring` hiess früher `subscriptions`, `cockpit` hiess `analysis` — alte Demo-Links
funktionieren weiter. `?screen=analysis` öffnet das Cockpit direkt auf der Analyse-Ansicht,
also genau dem Bildschirm, der früher dort stand.
`search` findet Einstellungen und Funktionen so gut wie Buchungen: «twint», «dark mode»,
«face id» führen an den Ort, nicht auf eine Liste von Belegen.
`income` und `expenses` sind die beiden Detailseiten hinter der Legende der Analysen.
`pay` startet den Zahlungsauftrag beim Empfänger — die weiteren drei Schritte hat der Fluss
selbst in der Hand, damit der Zurück-Pfeil sich wie in der App verhält.

## Konfiguration

Der Prototyp läuft **ohne jeden Schlüssel** — Personas und Buchungen entstehen lokal.
`npm install && npm run dev` genügt. Supabase ist vorbereitet, aber optional.

```bash
cp .env.example .env.local   # nur nötig, sobald wir Supabase wirklich brauchen
```

| Variable | Zweck |
|---|---|
| `VITE_SUPABASE_URL` | Projekt-URL, z. B. `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon/publishable key |

Nur Variablen mit dem Präfix `VITE_` landen im Browser-Bundle und sind damit **öffentlich**.
Der `service_role`-Key gehört niemals dorthin. `.env.local` ist in `.gitignore`.

`src/lib/supabase.ts` lädt die Bibliothek erst beim ersten Zugriff nach — ohne Konfiguration
ist `isSupabaseConfigured()` schlicht `false`, die App läuft normal weiter.

### Apertus — die Edge Function `explain`

Der Satz neben dem Budget wird von **Apertus v1.5 70B** formuliert, dem Schweizer Modell.
Gerechnet wird er nicht: Die Funktion bekommt fertige Zahlen und einen im Code
ausgewählten Befund und gibt zwei Sätze zurück.

```bash
set -a; source ../../WORKSPACE/.secrets/apertus.env; set +a
npx supabase secrets set APERTUS_URL="$APERTUS_URL" APERTUS_KEY="$APERTUS_KEY" \
                         APERTUS_MODEL="$APERTUS_MODEL"
npx supabase functions deploy explain --use-api
```

Warum überhaupt eine Function und nicht ein `fetch` aus dem Browser: Alles mit
`VITE_`-Präfix landet im Bundle und wäre öffentlich, der Prompt liesse sich austauschen,
und der LLM-Endpunkt schickt keine CORS-Header. Der Schlüssel liegt als Function-Secret
und verlässt den Server nie.

Drei Sicherungen, weil die Zahlen in einer Banking-App stimmen müssen:

1. **Der gerechnete Satz entsteht zuerst** (`explain.ts`, `localSummary`) und braucht kein
   Netz. Apertus ersetzt ihn nur bei Erfolg — ohne Schlüssel, ohne Netz oder nach 20
   Sekunden bleibt er stehen. An der Karte steht sichtbar, welcher von beiden es ist.
2. **Die Funktion nimmt keinen Prompt entgegen**, nur eine typisierte Nutzlast. Wer sie
   aufruft, bestimmt *worüber* geschrieben wird, nicht *was*.
3. **Die Zahlenwache** (`supabase/functions/explain/guard.ts`) verwirft jede Antwort, die
   eine Zahl enthält, die nicht im Prompt stand. Sie hat beim ersten Lauf sofort etwas
   gefunden: Das Modell schrieb «fast CHF 400», wo die Differenz 349 war. Sprachlich eine
   Näherung, in einem Budget eine falsche Zahl. Getestet in
   `src/insights/budget/__tests__/guard.test.ts`.

Die Arbeitsteilung ist gemessen, nicht ideologisch: Der Fähigkeitstest in
`WORKSPACE/03_research/16_Tooling_und_Zugaenge/APERTUS_CAPABILITY_TEST.md` hat beide
Apertus-Grössen 14 Zahlen addieren lassen — der 8B kam auf 1'021 statt 3'193, der 70B auf
3'084. Plausibel nah dran, und genau das ist der gefährlichste Fehlertyp. Aus fertigem
Fakt formulieren sie dagegen sauber.

Ohne Konfiguration läuft die App normal weiter und zeigt den gerechneten Satz.

### Datenbank-Schema

Das Schema lebt als Migrationen in `supabase/migrations/` und wird **nie von Hand im
Dashboard geklickt**. Jede Änderung ist eine Datei im Repository und damit nachvollziehbar.

```bash
set -a; source ../../WORKSPACE/.secrets/supabase.env; set +a   # Zugangsdaten laden
npm run db:link      # einmalig: Projekt verknüpfen
npm run db:push      # Migrationen anwenden
npm run db:diff neue_tabelle   # Änderung als neue Migration festhalten
npm run db:types     # TypeScript-Typen aus dem Schema erzeugen
```

Die Zugangsdaten für die Kommandozeile (Access Token, Datenbank-Passwort) liegen in
`WORKSPACE/.secrets/` — ausserhalb dieses Repositories, weil es öffentlich ist.

## Deployment (Vercel)

Beim Verbinden eines neuen Vercel-Projekts mit diesem Repository:

| Einstellung | Wert |
|---|---|
| **Root Directory** | `Code` ← **wichtig**, das Repo enthält auch `Documentation/` und `Presentation/` |
| Framework Preset | Vite (wird erkannt) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | 22.x |

Alles Weitere steht in `vercel.json`: SPA-Rewrite (damit Direktlinks auch nach einem Reload
funktionieren), unveränderliche Caching-Header für `assets/` und zwei Sicherheits-Header.

Falls Supabase genutzt wird, dieselben `VITE_`-Variablen unter
**Settings → Environment Variables** für Production, Preview und Development eintragen.

Domain: `vitamingelb.ch` unter Settings → Domains verbinden.

## Aufbau

```
src/
├── theme/tokens.css      Die 188 PostFinance-Tokens, unverändert aus der Recherche
├── theme/base.css        Wie wir diese Werte einsetzen (inkl. Dark Mode)
├── theme/fonts.css       PostFinance Grotesk (Dateien nicht im Repository)
├── data/                 Typen, Personas mit fertigen Buchungen, Markenregister
│                         logo-backgrounds.ts — Scheibenfarbe je Logo (generiert)
├── domain/               Fachlogik des Nachbaus, ohne UI:
│                         recurring.ts (Abo-Erkennung) · booking.ts (Buchungstext)
│                         breakdown.ts (Einnahmen/Ausgaben nach Oberkategorie)
│                         payment.ts (Zahlungsauftrag: Empfänger, Bankwerktage,
│                         Betragseingabe, Auftrag aus dem Entwurf)
├── lib/                  Geld- und Datumsformatierung, Supabase-Anbindung
├── app/                  ── DER NACHBAU. Bildet die App von heute ab.
│   ├── shell/            Telefonrahmen, Tab-Leiste, Karten, Zeilen, Slot
│   │                     controls.tsx — Schalter, Auswahl, Eingabefeld
│   ├── screens/          Home · Zahlungen · Anlegen · Angebote · Services
│   │                     Kontodetail · Bewegungsdetails · Analysen · Meine Abos
│   │                     Einnahmen/Ausgaben · Scannen/Übertragen
│   │                     Profil und Einstellungen mit neun Unterseiten
│   │   └── payment/      Zahlungsauftrag in vier Schritten: Empfänger, Betrag,
│   │                     Ausführung, Zusammenfassung mit Wischgeste
│   ├── search/           Die Suchleiste. catalog.ts — Einstellungen und
│   │                     Funktionen als durchsuchbare Einträge, mit den
│   │                     Wörtern, unter denen man sie sucht («dark mode»)
│   │                     match.ts — Umlautfaltung und Gewichtung
│   └── settings.ts       Was die Nutzerin selbst setzt, im localStorage
└── insights/             ── UNSERE SCHICHT. Alles Neue kommt hierhin.
    ├── registry.tsx      Wo eine neue Funktion eingehängt wird
    ├── engine/           balance.ts (Verlauf und Prognose) · tenure.ts (Abo-Dauer)
    ├── cards/            AccountBalanceCard — die Kontokarte auf Home
    ├── charts/           BalanceChart, Glättung
    ├── screens/          Cockpit · Signale · SeriesDetail
    ├── signals/          Was sich verändert hat — siehe unten
    └── budget/           Das Budget aus den Buchungen — siehe unten
```

### Das Budget

`src/insights/budget/` leitet ein vollständiges Budget aus den Buchungen ab und stellt es
dem Richtwert des öffentlichen [PostFinance-Budgetrechners](https://www.postfinance.ch/de/privat/anlegen/tools-rechner/budget-erstellen.html)
gegenüber. Grundlage ist der Spike `WORKSPACE/04_experiments/pf-budget-wizard/`: Struktur,
Texte und Rechenlogik des Rechners, rekonstruiert aus seinem Angular-Bundle und gegen
**2'513 Live-Messpunkte** seiner API geprüft.

| Datei | Inhalt |
|---|---|
| `slots.ts` | Die sechs Kategorien und neunzehn Detailfelder des Rechners, Beschriftung wörtlich |
| `flow.ts` | Geldfluss-Achse `out · in · moved · settled · lent` — trennt Ausgabe von Umbuchung |
| `mapping.ts` | Buchung → Detailfeld: Regelwerk plus die Kategorie, die die Bank schon vergeben hat |
| `derive.ts` | `deriveBudget()` — Beträge, Belege, Abdeckung, offene Fragen |
| `pf-model.ts` | **Portiert**, nicht nachgebaut: Nettolohn-Formel, `updateBudget`, Tippboxen. Rechnet in ganzen Franken |
| `pf-reference.ts` | Der Richtwert für denselben Haushalt, aus `data/reference.json` (56 KB, nachgeladen) |
| `benchmark.ts` | Die **einzige** Stelle, an der Rappen und Franken aufeinandertreffen |
| `storage.ts` | Gespeichertes Budget je Persona, mit «von dir gesetzt»-Merkern |
| `forecast.ts` | Zwei Geraden über fünf Jahre: was der Plan verspricht, was bisher wirklich gespart wurde |
| `pack.ts` | Circle Packing nach Wang et al. — ausgeschrieben, weil die App ohne Diagrammpaket auskommt |
| `markings.ts` | «Gehört das ins Monatsbudget?» — normal, einmalig oder auf N Monate verteilt |
| `ui/BubbleField.tsx` | Die Blasen: Ring = Budget, Füllung = verbraucht, Strichring = Monatsfortschritt |
| `explain.ts` | Der Satz daneben — gerechnet, und wenn erreichbar von Apertus formuliert |
| `screens/Wizard.tsx` | Der Wizard in drei Schritten: zwei Fragen → Regler → Ausblick |
| `ui/Slider.tsx` | Betrag schieben oder tippen, mit der abgeleiteten Zahl als Marke |

Zwei Dinge, die dabei nicht schiefgehen dürfen und deshalb Tests haben:

* **Der Dauerauftrag aufs eigene Sparkonto ist keine Ausgabe.** Die heutige Auswertung
  zählt ihn mit — bei Livia sind das CHF 479 im Monat, bei Bruno CHF 1'792. Livia im
  Interview 05: «500 Franken aufs Sparkonto — dann ist das wie quasi als Ausgabe.»
* **Jahresrechnungen werden auf den Monat umgelegt**, Steuern über die volle Historie
  geglättet. Steuerraten folgen der Steuerperiode, nicht dem Kalender: Brunos
  Schlussrechnung ergäbe im Zwölfmonatsfenster CHF 1'883 pro Monat, im Fenster daneben
  CHF 0.

Gemessen an den vier Personas: **87 – 97 %** der Ausgabenfranken sind sicher zugeordnet,
**7 bis 13** der neunzehn Felder füllen sich von selbst. Der Rest ist zu vier Fünfteln
Bargeld — und dafür gibt es keine Lösung ausser der Rückfrage. Sie steht als solche im
Bildschirm.

#### Ausserordentliche Ausgaben

Brunos Anzahlung Heizung: CHF 12'000 am 11. August, bei einem Wohnbudget von CHF 1'463.
Ohne Einordnung steht seine Wohnblase den ganzen Monat auf 920 %. Drei Antworten, weil es
drei Fälle sind:

| | Wirkung |
|---|---|
| **Gehört so dazu** | zählt im Monat der Buchung — die Vorgabe |
| **War einmalig** | zählt nicht gegen das Budget, steht aber als ausserordentliche Ausgabe weiterhin da |
| **Auf 12 Monate verteilen** | Jahresrechnung: ein Zwölftel in jedem der zwölf Monate |

Der Unterschied zwischen den letzten beiden ist der Punkt. Die Anzahlung Heizung ist
einmalig. Brunos Generalabonnement über CHF 3'950 ist es **nicht** — das ist die Mobilität
eines ganzen Jahres, einmal bezahlt. Wer es ausklammert, versteckt eine echte Ausgabe.

**Die Regel, die die Statistik schützt:** Nichts verschwindet. Über die volle Reichweite
gilt immer

```
budget + ausserordentlich + carry  ==  alle Belastungen
```

`carry` ist der Teil verteilter Buchungen ausserhalb des betrachteten Fensters; über den
ganzen Zeitraum ist er null. Geld wird verschoben, nie entfernt — und das ist keine
Absichtserklärung, sondern
[`__tests__/markings.test.ts`](src/insights/budget/__tests__/markings.test.ts). Der Nachbau
bleibt unberührt: Kontostand, Analysen und die Ein-/Ausgaben-Detailseiten rechnen weiter
mit allen Buchungen.

#### Die Blasen

Oben in der Budget-Ansicht steht der laufende Monat als Blasenhaufen — dort, wo der
Nachbau den Doppelring über das ganze Jahr zeigt. Eine Blase je Kategorie, drei Angaben
in jeder:

* **Der Ring** ist das Budget. Der Durchmesser folgt der **Wurzel** des Betrags, damit
  die Fläche proportional ist. Bei proportionalem Radius sähe ein doppeltes Budget
  viermal so gross aus — der häufigste Fehler in Blasendiagrammen.
* **Die Füllung** ist, was davon weg ist, ebenfalls flächentreu. Ihre Farbe läuft die
  **Petrol-Rampe der Marke** hinauf — je voller, desto dunkler: petrol4 · petrol6 ·
  petrol8. Erst kurz vor dem Limit wechselt die Achse auf Orange, darüber auf Gelb mit
  einem roten Bogen auf dem Ring. Kein Grün: Die Marke kennt keines, und ein zu zwei
  Dritteln verbrauchtes Budget ist kein Warnzustand.

  Die Farbe **gleitet**, sie springt nicht: `fillRamp()` liefert zwei Tokennamen und ein
  Mischverhältnis, gemischt wird in CSS mit `color-mix(in oklab, …)`. Damit bleiben die
  Farbwerte in `theme/tokens.css` und ein geändertes Token wirkt durch. Bei 44 % und 46 %
  ist gleich viel weg — zwei merklich verschiedene Farben dafür wären eine Behauptung.
  Auch der Schein schwillt stetig an, von 85 % bis 100 %.
* **Der rote Bogen** misst die Überschreitung, nicht den Verbrauch — 135 % ergeben gut
  ein Drittel des Rings, ab 200 % ist er voll. Die Blase selbst bleibt so gross wie ihr
  Budget.
* **Der feine Strichring** ist der Monatsfortschritt. Ohne ihn lügt jede
  Verbrauchsanzeige in der Monatsmitte: Am 8. sind 25 % eines Budgets kein Rückstand,
  sondern Vorsprung.

Die Skala richtet sich **nur** nach den Budgets, nie nach dem Verbrauch. Bruno zahlt im
August CHF 13'463 fürs Wohnen bei CHF 1'463 Budget; nähme die Blase diese Zahl, wäre sie
neunmal so gross wie alle anderen zusammen und der Ring bedeutete zweierlei.

Vorlage für Farben und Zustände ist `circles_vorschlag bubbles screens/states_sheet.png`.

Gepackt wird mit dem Verfahren aus Wang et al., «Visualization of Large Hierarchical Data
by Circle Packing» — dasselbe, das `d3-hierarchy` benutzt, hier ausgeschrieben in
[`pack.ts`](src/insights/budget/pack.ts). Deterministisch statt zufällig gemischt: Eine
Demo, die zweimal anders aussieht, kostet mehr als die letzten Prozent Packungsdichte
bringen. Achtzehn Tests halten fest, dass sich unter keiner Grössenverteilung zwei Kreise
überlappen.

#### Der Wizard

Drei Schritte, erreichbar über das Cockpit oder `?screen=budget`:

1. **Zwei Fragen** — Lebensform und Kinderzahl. Der öffentliche Rechner fragt sieben
   Dinge; fünf davon stehen in den Buchungen oder im Profil. Was wir ableiten, steht
   trotzdem da: unter «Das wissen wir schon», jede Zeile mit ihrem Beleg und jede Zeile
   korrigierbar.
2. **Das Budget** — sechs Kategorien, neunzehn Regler, alle schon gefüllt. Unten klebt
   die Rechnung und läuft beim Schieben mit. Der Originalrechner braucht dafür einen
   Server-Aufruf mit 300 ms Verzögerung (`SPEC.md`, 3.3); hier rechnet dieselbe Formel
   lokal.
3. **Der Ausblick** — zwei Geraden über fünf Jahre, ohne Zins. Die eine ist das
   Versprechen des Budgets, die andere das gemessene Sparverhalten. Der Abstand
   dazwischen ist die Aussage: Ein Überschuss von CHF 1'390 heisst nicht, dass 1'390
   gespart werden.

Eine von Hand gesetzte Zahl bleibt gesetzt. `refreshed()` liest im nächsten Monat die
Ableitung neu ein und lässt genau die Felder stehen, die jemand angefasst hat — ein
Budget, das die eigene Eingabe überschreibt, wird einmal benutzt und nie wieder.

### Die Trennlinie

`src/app/` ist der Nachbau und enthält **keine** eigenen Ideen. An definierten Stellen
rendern die Bildschirme einen benannten Slot:

```tsx
<Slot name="home.accountRow" account={account} fallback={<Row … />} />
```

Ein Slot bekommt mit `fallback` mitgeliefert, was der Nachbau an dieser Stelle selbst
rendern würde. Ist in `src/insights/registry.tsx` für diesen Slot nichts registriert — oder
gibt die eingehängte Komponente den `fallback` zurück, weil es nichts zu zeigen gibt —
erscheint genau der Ist-Zustand. Aktuell belegt ist nur `home.accountRow`.
Eine neue Funktion einhängen:

1. Komponente in `src/insights/cards/` schreiben
2. in `registry.tsx` unter dem passenden Slot eintragen

Damit ist jederzeit nachvollziehbar, was bestehendes Produkt ist und was von uns kommt.
Verfügbare Slots stehen im Typ `SlotName` in `registry.tsx`.

## Daten

Alle Beträge und Buchungen sind erfunden. Sie liegen als feste Datensätze in
`src/data/personas/<id>.data.ts` und sind damit bei jedem Start identisch — wichtig für
reproduzierbare Demos und Tests. Erzeugt wurden sie einmalig vom Generator in
`WORKSPACE/04_experiments/postfinance_template_data/`, nicht zur Laufzeit. Beträge werden
durchgehend als **ganzzahlige Rappen** geführt; gerundet wird erst bei der Ausgabe.

Die vier Personas bilden Personen aus unseren sechs Interviews ab
(`WORKSPACE/02_design_thinking/interviews/`) und tragen je ein Muster aus dem Gespräch:

| Persona | Interview | Muster im Datensatz |
|---|---|---|
| Reto | 01 | Sechs Abos, davon eines im März still von 71.90 auf 79.90 erhöht |
| Nino | 04 | Knappes Konto, Sollzins, Mahngebühr für eine untergegangene Rechnung |
| Livia | 05 | Dauerauftrag aufs **eigene** Sparkonto — zählt in den Analysen als Ausgabe |
| Bruno | 07 | Fünf Produkte bei zwei Instituten, Steuerrechnung als grosser Jahresposten |

Diese Muster sind absichtlich enthalten: Sie sind das Material, an dem sich später zeigen
lässt, was eine bessere Auswertung leisten müsste.

Dazu kommen in `src/data/personas/<id>.ts` — der von Hand gepflegten Datei — **Ereignisse**,
die Signale auslösen. Die generierten Buchungen bilden den Alltag ab und sind bewusst
gleichmässig: Jede Persona bekam über 23 Monate exakt denselben Lohnbetrag. Das
Unerwartete ist aber der Gegenstand des Signale-Bildschirms.

| Persona | Ereignis | Signal |
|---|---|---|
| Reto | Jobwechsel per Februar 2026 (+ CHF 420), Bonus CHF 800 im August | Neuer Arbeitgeber · Zusätzlich hereingekommen |
| Nino | Jobwechsel per Mai 2026 (+ CHF 260), eingeschlichenes Abo seit Juli | Neuer Arbeitgeber · Abo-Verdacht |
| Livia | Notebook für die Lehre, CHF 1'290 im August | Sprengt die Kategorie |
| Bruno | 13. Monatslohn, Dezember 2024 und 2025 | Kommt wieder — in 4 Monaten |

Ein Jobwechsel ist eine **Ersetzung**, keine Ergänzung: `withJobChange()` in
[`events.ts`](src/data/personas/events.ts) tauscht die Lohnbuchungen ab dem Stichtag aus,
denn wer den Arbeitgeber wechselt, bekommt nicht zwei Löhne. Der heutige Kontostand bleibt
der Anker; was sich ändert, ist die Vergangenheit — mit dem höheren Lohn stand vorher
weniger auf dem Konto. Jedes Ereignis trägt im Code den Kommentar, welches Muster es
belegen soll.

## Icon

`public/icon.svg` ist eine **eigene** Marke für den Prototyp — eine Liste, aus der eine Linie
heraussteigt — in der Farbwelt von PostFinance. Bewusst nicht deren Logo oder App-Icon:
Das Repository ist öffentlich. Die PNG-Grössen daneben sind daraus erzeugt.

## Bewusste Vereinfachungen

- Kein Login und keine Sicherheitsebene — die Persona-Auswahl ersetzt beides.
- Scannen, Zahlen und Übertragen sind vollständig gestaltet, lösen aber nichts aus.
- Der Ausblick rechnet ohne Zins und ohne Teuerung. Eine angenommene Rendite würde nach
  fünf Jahren mehr ausmachen als das Sparverhalten selbst.
- Das Budget lebt im Browser (`localStorage`), nicht in der Datenbank. Für die Demo
  genügt das; ein Gerätewechsel nimmt es nicht mit.
- Kategorien sind fest am Datensatz hinterlegt statt automatisch erkannt.
- Keine UI-Bibliothek und kein Diagrammpaket: Donut und Verlaufskurve sind von Hand
  gezeichnetes SVG, damit die Farben exakt den Tokens folgen. Laufzeitabhängigkeiten sind
  React und — nur wenn konfiguriert und dann nachgeladen — der Supabase-Client.

## Schriften

Die App ist auf **PostFinance Grotesk** umgestellt, die echte Hausschrift. Lokal und im
lokalen Build ist sie aktiv — sie liegt in `public/fonts/`, eingebunden über
`src/theme/fonts.css`.

**Die Schriftdateien sind bewusst NICHT im Repository.** `public/fonts/` steht in
`.gitignore`. Die Lizenz verbietet die Weitergabe ausdrücklich (siehe
`WORKSPACE/03_research/PREP/01_Brand_and_Design_System/FONT_LICENSING.md`,
Konventionalstrafe im fünfstelligen Bereich) — und ein öffentliches Repository ist
Weitergabe. Verwenden ist das eine, verteilen das andere.

Damit gilt:

| | Schrift |
|---|---|
| Lokal (`npm run dev`, `npm run preview`) | PostFinance Grotesk |
| Live-Demo und Jury-Walkthrough | PostFinance Grotesk |
| vitamingelb.ch (öffentlich) | Inter als Fallback |

Das Team hat sich entschieden, die Schrift für BärnHäckt 2026 einzusetzen, obwohl die
Lizenz es nicht erlaubt — der Prototyp entsteht für PostFinance selbst, läuft nur dieses
Wochenende und wird nicht kommerziell genutzt. Eingeschränkt bleibt lediglich die
Weitergabe, weil sie das eigentliche Risiko trägt und für keinen der Anwendungsfälle
oben nötig ist.

**Wer die Schrift trotzdem ausliefern will:**

```bash
git add -f public/fonts && git commit -m "chore: Schriftdateien ausliefern"
```

**Rückbau nach dem Hackathon** — zwei Schritte, keine Codeänderung:

```bash
rm -rf public/fonts                    # Dateien entfernen
# in src/theme/base.css: --font auf 'Inter', … zurücksetzen
```

Inter steht in der Schriftkette hinter PostFinance Grotesk. Fehlen die Dateien, sieht die
App unverändert richtig aus — nur eben in Inter. Genau das passiert auf vitamingelb.ch.

## Herkunft der Vorlagen

Massgeblich sind die **echten Bildschirmfotos** aus `PREP/07_screenshots/` — sie zeigen die
laufende App und schlagen im Zweifel jedes Marketingbild:

| Datei | Bildschirm | Was wir daraus übernommen haben |
|---|---|---|
| `IMG_1674` | Home | «Konten und Depots», Kontosymbol, «Produkt hinzufügen», kein Kundenbeziehungs-Filter |
| `IMG_1675` | Kontodetail | Buchungstext-Format, Händlerscheiben, Liste ohne Karten, Kreisreihe Zahlungen·Suchen·Details |
| `IMG_1676` | Zahlungen | eBill-Karte, Kartenradien und Abstände |
| `IMG_1677` | Anlegen | Titel «Anlegen und Vorsorgen», Leerzustand mit gelbem Knopf |
| `IMG_1678` | Angebote | Fette Kachelbeschriftung, Punkte-Navigation, Gutscheinkarte |
| `IMG_1679` | Services | Schlichte Liste ohne Kreise und ohne Pfeile |
| `IMG_5013` | Profil und Einstellungen | Neun Einträge mit Stichworten, Liste ohne Karte |
| `IMG_5014`–`5015` | Zahlung: Empfänger | Suchfeld mit «Abbrechen», «Empfohlene Empfänger», Auswahlblatt mit «Neue Zahlung» und «Daten kopieren» |
| `IMG_5016`–`5017` | Zahlung: Betrag | Vier Fortschrittsstriche, Betrag rechts und Währung links, gelbe Linie am aktiven Feld, Kontoauswahl von unten |
| `IMG_5018` | Zahlung: Ausführung | Einzelauftrag/Dauerauftrag auf der getönten Fläche, Wochentag im Datum, «Annahmeschlusszeiten überschritten» |
| `IMG_5019`–`5020` | Zahlung: Zusammenfassung | Drei Blöcke mit Stift, Wischgeste «Ausführen» statt Knopf |

Ergänzend die offiziellen Store-Bilder in `PREP/03_Screens_and_Assets/` — vor allem
`playstore_android/postfinance_app/08.png` für die Analysen, für die es kein echtes Foto gibt.

### Buchungstexte

Die Bank setzt den Text aus Bausteinen zusammen:
`APPLE PAY KAUF/DIENSTLEISTUNG VOM 03.09.2024 KARTEN NR. XXXX7731 COOP BERN BAHNHOF (CH)`.
Der Händlername steht **ganz hinten** und wird abgeschnitten, wenn der Text zu lang ist.
Genau in diesem Format liegen die Buchungen der Personas; zerlegt wird der Text in
[`src/domain/booking.ts`](src/domain/booking.ts), gelesen in der Bewegungsdetail-Ansicht.
Unklare Buchungen kamen in vier der sechs Gespräche zur Sprache — damit ist dieser Text unser
Ausgangsmaterial.
