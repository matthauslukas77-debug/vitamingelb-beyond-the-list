# Beyond the List — Prototyp

Nachbau der PostFinance-App (v6) als Web-App, plus eine klar abgetrennte Schicht für
unsere eigenen Funktionen. Stand: **der Nachbau läuft, unsere Schicht ist noch leer** —
der Prototyp zeigt bewusst exakt den Ist-Zustand.

## Starten

```bash
npm install
npm run dev
```

Danach `http://localhost:5173` öffnen. Getestet mit Node 22+ (entwickelt auf Node 25).

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
Vollbild ohne Safari-Leisten — das ist die Ansicht für die Videoaufnahme. Voraussetzung ist
eine HTTPS-URL (z. B. über `tailscale serve`) oder `localhost`.

## Händlerlogos

In der Buchungsliste steht links das echte Logo des Händlers, sobald der Buchungstext
sich auflösen lässt. Zuständig ist [`src/data/brands.ts`](src/data/brands.ts):
eine Musterliste, längster Treffer gewinnt, Vergleich nur an Wortgrenzen. Kein Netz,
kein Modell — ein falsches Logo wäre schlimmer als keines.

* Registry: [`src/data/brands.data.ts`](src/data/brands.data.ts), 400 Marken.
  **Generiert** aus `WORKSPACE/05_assets_scratch/abo_logos/logos.json` — nicht von Hand pflegen.
* Bilddateien: `public/logos/`, auf 128 px verkleinert (3.3 MB gesamt).
* Darstellung: [`src/app/shell/BrandAvatar.tsx`](src/app/shell/BrandAvatar.tsx) —
  Logo, sonst die Farbscheibe der Persona, sonst das Kategoriesymbol.

Getroffen werden je nach Persona 61–84 % der Buchungen. Was übrig bleibt, sind
`SIX Payment <Nr>`-Terminals, lokale Betriebe ohne Marke und generische Texte wie
`KRANKENKASSE PRAEMIE` — genau die Fälle, für die es die Rückfrage an den Nutzer braucht.

## Direktlinks

Für Demo, Videoaufnahme und Screenshots lässt sich jeder Einstieg per URL ansteuern:

```
?persona=fritz                    Persona direkt öffnen
?persona=michael&screen=analysis  zusätzlich einen Bildschirm
?persona=janic&screen=account     Kontodetail (optional &account=<id>)
```

Zusätzlich `&tab=payments` für den Startreiter.

Personas: `fritz` · `janic` · `katja` · `michael` · `mia`.
Reiter: `home` · `payments` · `invest` · `offers` · `services`.
Bildschirme: `account` · `analysis` · `scan` · `pay` · `transfer` · `search`.

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
├── data/                 Typen, Personas, deterministischer Datengenerator
├── lib/                  Geld- und Datumsformatierung, Zufallsgenerator
├── app/                  ── DER NACHBAU. Bildet die App von heute ab.
│   ├── shell/            Telefonrahmen, Tab-Leiste, Karten, Zeilen, Slot
│   └── screens/          Home · Zahlungen · Anlegen · Angebote · Services
│                         Kontodetail · Analysen · Scannen/Zahlen/Übertragen/Suche
└── insights/             ── UNSERE SCHICHT. Alles Neue kommt hierhin.
    └── registry.tsx      Wo eine neue Funktion eingehängt wird
```

### Die Trennlinie

`src/app/` ist der Nachbau und enthält **keine** eigenen Ideen. An definierten Stellen
rendern die Bildschirme einen benannten Slot:

```tsx
<Slot name="home.aboveAccounts" />
```

Solange `src/insights/registry.tsx` leer ist, rendern alle Slots nichts — der Prototyp
zeigt PostFinance, wie es heute ist. Eine neue Funktion einhängen:

1. Komponente in `src/insights/cards/` schreiben
2. in `registry.tsx` unter dem passenden Slot eintragen

Damit ist jederzeit nachvollziehbar, was bestehendes Produkt ist und was von uns kommt.
Verfügbare Slots stehen im Typ `SlotName` in `registry.tsx`.

## Daten

Alle Beträge und Buchungen sind erfunden. Sie entstehen aus einem festen Startwert pro
Persona (`mulberry32`), sind also bei jedem Start identisch — wichtig für reproduzierbare
Demos und Tests. Beträge werden durchgehend als **ganzzahlige Rappen** geführt; gerundet
wird erst bei der Ausgabe.

Die vier Personas bilden Personen aus unseren sechs Interviews ab
(`WORKSPACE/02_design_thinking/interviews/`) und tragen je ein Muster aus dem Gespräch:

| Persona | Interview | Muster im Datensatz |
|---|---|---|
| Fritz | 01 | Sieben Abos, davon eines im März still von 71.90 auf 79.90 erhöht |
| Janic | 04 | Knappes Konto, Sollzins, Mahngebühr für eine untergegangene Rechnung |
| Katja | 05 | Dauerauftrag aufs **eigene** Sparkonto — zählt in den Analysen als Ausgabe |
| Michael | 07 | Sechs Bankbeziehungen, Steuerrechnung als grosser Jahresposten |

Diese Muster sind absichtlich enthalten: Sie sind das Material, an dem sich später zeigen
lässt, was eine bessere Auswertung leisten müsste.

## Icon

`public/icon.svg` ist eine **eigene** Marke für den Prototyp — eine Liste, aus der eine Linie
heraussteigt — in der Farbwelt von PostFinance. Bewusst nicht deren Logo oder App-Icon:
Das Repository ist öffentlich. Die PNG-Grössen daneben sind daraus erzeugt.

## Bewusste Vereinfachungen

- Kein Login und keine Sicherheitsebene — die Persona-Auswahl ersetzt beides.
- Scannen, Zahlen und Übertragen sind vollständig gestaltet, lösen aber nichts aus.
- Der Reiter «Zeitverlauf» in den Analysen ist nicht ausgeführt.
- Kategorien sind fest am Datensatz hinterlegt statt automatisch erkannt.
- Keine UI-Bibliothek und kein Diagrammpaket: Der Donut ist SVG, damit die Farben exakt
  den Tokens folgen. Einzige Laufzeitabhängigkeit ist React.

## Schriften

**PostFinance Grotesk wird nicht ausgeliefert** — die Lizenz verbietet es
(siehe `WORKSPACE/03_research/PREP/01_Brand_and_Design_System/FONT_LICENSING.md`).
Der Prototyp nutzt Inter beziehungsweise die Systemschrift.

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

Ergänzend die offiziellen Store-Bilder in `PREP/03_Screens_and_Assets/` — vor allem
`playstore_android/postfinance_app/08.png` für die Analysen, für die es kein echtes Foto gibt.

### Buchungstexte

Die App setzt den Text aus Bausteinen zusammen:
`Apple Pay Kauf/Dienstleistung vom 21.08.2026, kkiosk 355.78`. Der Händlername steht **ganz
hinten** und wird abgeschnitten, wenn der Text zu lang ist. Genau dieses Format erzeugt
`merchantText()` in `src/data/generate.ts` — es ist der Frust, den vier von sechs
Interviewten beschrieben haben, und damit unser Ausgangsmaterial.
