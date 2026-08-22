# Interview-Synthese — 3 Gespräche, Fr 21.08.2026

Cross-Case-Auswertung von Interview 01 (Reto), 02 (Silvan), 04 (Nino).
Quellen: `../../02_design_thinking/interviews/`. Leitfaden + Hypothesen: `../../02_design_thinking/EMPATHIZE_Interviewleitfaden.md`.

> Die **erzählende Fassung** dieser Synthese für Weitergabe/Jury liegt als
> `../../02_design_thinking/interviews/Empathize_Synthese.docx`. **Dieses Dokument hier ist die
> Research-Seite:** Hypothesen-Scoreboard, Personas, How-might-we — und die Verbindung zur
> Marktrecherche in `../11_Wettbewerb/` (was von den Wünschen existiert schon, wo ist wirklich Lücke).

> **Kurzfassung in einem Satz:** Alle drei öffnen die App **nur für den Saldo**, keiner
> weiss, ob ein Monat normal war, keiner hat ein funktionierendes Budget, alle drei
> misstrauen der Finanzbranche — und alle drei fragen einer KI dieselben zwei Fragen:
> **«Wofür gebe ich am meisten aus?»** und **«Was davon war unnötig?»**

---

## 1. Wer wir gesprochen haben

| | **01 Reto** | **02 Silvan** | **04 Nino** |
|---|---|---|---|
| Alter / Beruf | 22 · Informatiker | ~20 · Deployed Engineer | 19 · Mediamatiker |
| Wohnort | [Ort] | [Ort] | [Ort] / [Ort] |
| Hauptbank | **UBS** (via Eltern) + BKB (Sparkonto) | **PostFinance** + Alternative Bank Schweiz | **UBS** (Jugendkonto) + Capital (Invest) |
| Bankwahl | geerbt / Zufall | — | «UBS ist doch die erste und bekannteste Lösung» → Zufall |
| Zahlt meist mit | Debitkarte, Twint | PostFinance-Karte (Debit, «gilt wie Kreditkarte, kann nicht ins Minus») | **Apple Pay** |
| Kreditkarte | ja (kaum genutzt) | **nein** | — |
| App-Frequenz | regelmässig | ~täglich («heute») | **~4×/Woche** |
| Analysen/Dashboard genutzt | «versteckt, untergegangen» | **3–4×** insgesamt | **nie** |
| Budget | nein, nie versucht | nein, nie versucht | Excel, **nach ~2 Monaten eingeschlafen** |
| Abos | «tonnenweise», ~CHF 300/Mt | 3–4, «wäre noch geil, wenn ich sehen würde welche» | **7 Stück, ~CHF 280/Mt** (geschätzt) |
| Selbstbild Geld | «komme gut durch» | «keine grossen Einnahmen, keine Fixausgaben» | **«ganz schlecht»**, «öfter im Minus» |
| Grösster Posten (gefühlt) | Gadgets 500–800, Essen ~500 | **Essen** | **Essen** — «keine gute Ausgabe» |
| Finanzberatung | «würde heute nicht hingehen» | «sehr viele Scams … Produkt statt Beratung» | **«Absoluter Müll. Alles nur Provisionen.»** |
| Finanzwissen her | — | **ChatGPT + YouTube** | — |
| 3 Wörter zu Geld | «Autos, Ferien, Fliegen» | **«Sparen, Übersicht, Planbarkeit»** | **«Tempo, mächtig, schwierig»** |

**Sample-Bias — ehrlich benennen (T2/Doku!):** 3× männlich, 19–22, technische Berufe,
Region [Ort], keine Kinder, keine Hypothek, tiefe Fixkosten, **kein einziges echtes
KMU-Interview**. Silvan' Firmen-Antworten sind Startup-Sicht ([Startup]), nicht KMU-Alltag.
Was fehlt: Familien, 40+, Selbständige, Treuhand, PostFinance-intern. → siehe §8.

---

## 2. Die Kernzitate, sortiert nach den drei Challenge-Fragen

Die Challenge fragt: *Was ist regelmässig? Was ist ungewöhnlich? Was verändert sich?*
So sieht die Realität dazu aus:

### «Was ist regelmässig?» — sie wissen es nicht, wollen es aber
- **Silvan:** «Es wäre noch geil, wenn ich sehen würde, welche [Abos] ich genau habe. Das sehe ich nicht so.»
  → Silvan ist **PostFinance-Kunde**, und PostFinance **hat** eine Abo-Übersicht. Er kennt sie nicht.
  Das ist der härteste Befund des Abends: *Das Feature existiert und erreicht den Kunden nicht.*
- **Nino:** 7 Abos, ~CHF 280/Mt — geschätzt, nie geprüft.
- **Reto:** «Abos? Tonnenweise.» ~CHF 300/Mt — hat sie «im Griff» durch sofortiges Kündigen (Workaround statt Tool).

### «Was ist ungewöhnlich?» — der Merchant-Name ist der tägliche Mikro-Frust
- **Silvan:** «Manchmal so komische Adressen oder komische Firmennamen, wo nicht dort [steht], wo ich es gekauft habe, da bin ich verwirrt.» → **googelt** den Namen.
- **Nino:** «Dann bin ich draufgegangen und habe geschaut, was der Name vom … Kartenlesegerät [ist].»
- Beide lösen es **manuell und ausserhalb der App**. Zwei von drei — bei nur drei Interviews.

### «Was verändert sich?» — niemand hat einen Massstab
- **Silvan** auf «Wie findest du heraus, ob ein Monat normal war?»: **«Gar nicht.»**
- **Nino:** «Ich weiss ungefähr, wie viel ich im Monat auf die Seite tue, und dann sehe ich, ob ich im Minus bin oder nicht.» → Der einzige Indikator ist **Vorzeichen**, nicht Veränderung.
- **Reto:** Bauchgefühl, Korrektur über Konsum («dann ab und zu weniger Burger»).

**→ Von den drei Challenge-Fragen ist «Was ist ungewöhnlich / was verändert sich»
komplett unbeantwortet, und die Nutzer haben nicht einmal ein Vokabular dafür.**

---

## 3. Was alle drei gleich machen (die belastbaren Muster)

| # | Muster | Belege | Konsequenz fürs Produkt |
|---|---|---|---|
| M1 | **Saldo ist der einzige KPI.** App auf → Zahl lesen → App zu. | Reto «schaut nachher auf den Saldo»; Silvan «Kontostand, ja, ja»; Nino «meistens ist es wirklich nur der Kontostand» | Der Insight muss **dort** sein, wo der Saldo ist — Home, nicht 3 Ebenen tief. Oder ausserhalb der App (Widget/Push). |
| M2 | **Die Analysen/Dashboards sind faktisch tot.** | Reto: «ist so ein bisschen versteckt, untergegangen»; Silvan: 3–4× in Jahren; Nino: nie | Nicht «noch ein Dashboard» bauen. Pull ist gescheitert → **Push**. |
| M3 | **Die Liste ist zu langweilig, um hinzuschauen — nicht zu kompliziert.** | Nino: «Die Ausgaben sind so verdammt stur in einer Liste aufgeführt … nicht mal in so einem Kuchendiagramm»; «es ist wie so eine Dopamin-Schranke» ; Reto: «das Design ist so scheisse bei denen — wenn es übersichtlich wäre und gut aussehen würde, dann würde ich es auch mehr anschauen» | **Ästhetik ist ein Funktionsargument, kein Nice-to-have.** Das ist ein direktes Mandat für unseren PostFinance-Look (PREP/design-tokens). |
| M4 | **Budgets scheitern nicht am Willen, sondern am Unterhalt.** | Nino: Excel «ganz detailliert … nach etwa 2 Monaten eingeschlafen»; Silvan: «wenn ich es super aufstellen würde, klar definieren wieso — dann würde ich es schon umsetzen»; Reto: nie begonnen | **Zero-Maintenance.** Alles, was gepflegt werden muss, stirbt in 8 Wochen. Insight muss **ohne Setup** entstehen. |
| M5 | **Kein Bild der Zukunft — bei keinem, privat wie geschäftlich.** | Silvan zu «Kontostand in 30–90 Tagen, privat und als Unternehmen?»: **«Nein, tatsächlich nicht.»**; Reto hat keine Vorstellung vom Monatsende | Forecast ist echtes Neuland, nicht nur ein Feature. Und Silvan' KMU-Antwort ist das stärkste Business-Signal, das wir haben. |
| M6 | **Tiefes Misstrauen gegen Beratung, aber nicht gegen Tools.** | Nino «absoluter Müll, alles nur Provisionen»; Silvan «Produkte werden verkauft statt beraten»; Reto «würde nicht hingehen» | Der Insight darf **nie** wie ein Verkaufsargument klingen. Kein «Jetzt 3a eröffnen!» am Ende einer Analyse. Sonst verbrennen wir genau die Zielgruppe. |
| M7 | **ChatGPT ist bereits der Finanzberater.** | Silvan: Wissen «Chatti, am meisten» + YouTube; Silvan würde bei Budgetplanung «Chat fragen, was es für Tools gibt» | Die KI-Erwartung ist gesetzt. Die Bank konkurriert nicht mit einem Berater, sondern mit ChatGPT — **und hat als einzige die Daten.** |
| M8 | **Widget = spontan genannt, von zwei Personen unabhängig.** | Reto bringt es **selbst** ein (Ausgaben live aus Twint/Karte); Nino: «Ja, das wäre top. Das wäre wirklich top.»; Silvan: «das würde ich schon [nutzen], mit Gesicht scannen» | Siehe §5 — hier liegt der einzige völlig unbesetzte Kanal. |
| M9 | **Login-Reibung verhindert Blicke.** | Nino: «ich muss immer mit einem Passkey rein … das klingt verdammt dumm, aber es ist wirklich so» | Jede Sekunde Auth kostet einen Blick. Glanceable > interaktiv. |
| M10 | **Datenschutz-Sorge ist geringer als erwartet — aber sozial, nicht institutionell.** | Silvan' Bedenken beim Widget: «mehr wegen Privatdings» (jemand anderes hat mein Handy), nicht wegen der Bank; auf «Gibt es Fragen, die die KI nicht stellen dürfte?» → «Boah, gar nicht» | Face-ID-Gate am Widget löst die real geäusserte Sorge. Die Bank als Datenhalter wird akzeptiert. |

---

## 4. Was die KI gefragt wird — wörtlich, aus drei Gesprächen

Das ist unsere **Feature-Liste, von Nutzern geschrieben**:

| Frage | Reto | Silvan | Nino |
|---|---|---|---|
| «Wofür / wo gebe ich am meisten aus?» | ✔ | ✔ | ✔ (**3/3**) |
| «Was ist das Unnötigste / wo kann ich unnötige Kosten sparen?» | ✔ («Was ist das Dümmste, was ich gekauft habe?») | | ✔ (**2/3**) |
| «Zu welcher Uhrzeit / an welchem Wochentag / in welcher Jahreszeit gebe ich am meisten aus?» | | ✔ | |
| «Verlauf über längere Zeit, pro Firma, wo ich immer wieder Geld ausgebe» | | ✔ | |
| Persönlichkeitsanalyse («was für ein Typ bist du») | ✘ «Für mich eigentlich gar nicht» | | |

**Lesart:** Die Leute wollen **Rangliste + Urteil**, nicht Charakterisierung.
«Am meisten» ist die Einstiegsfrage, «unnötig» die eigentliche.
Reto' Zusatz ist die beste Idee des Abends: *Käufe nachträglich als «dumm» markieren,
damit die KI lernt* — ein Feedback-Loop, den kein bestehendes Produkt hat (vgl. `../11_Wettbewerb/`).

---

## 5. Das Widget — der stärkste unbesetzte Kanal

Drei unabhängige Bestätigungen, davon **eine unaufgefordert**:

- **Reto (selbst eingebracht, ohne Frage):** Home-Screen-Widget mit Live-Ausgaben aus Twint/Karte. Er nutzt bereits Strom-Widgets.
- **Nino:** «Ja, das wäre top. Das wäre wirklich top.» — Begründung: Passkey-Login ist die Hürde. Auf die Rückfrage, ob Face-ID am Handy als Schutz reicht: «Das wäre okay.»
- **Silvan:** Sorge nur wegen «Privatdings» (Handy in fremder Hand) → mit Face-ID-Gate: ja.

**Marktcheck (siehe `../11_Wettbewerb/01_SCHWEIZ_APPS.md`):** PostFinance hat heute ein
**QR-Scanner-Widget**, aber kein Insight-/Saldo-Widget. UBS und neon haben *In-App*-Widgets
(anordbare Kacheln auf dem App-Home) — das ist etwas anderes als ein iOS-Home-Screen-Widget.
→ **Ein Home-Screen-Insight-Widget ist in der Schweiz weitgehend freies Feld** und
adressiert M1, M2 und M9 gleichzeitig.

⚠️ Hackathon-Realität: Ein echtes iOS-Widget ist in 40 h nicht demofähig. **Fake it richtig:**
Widget-Mockup im Video / im Prototyp als iPhone-Home-Screen-Frame zeigen, Logik ist echt.

---

## 6. Hypothesen-Scoreboard (nach 3 Interviews)

| # | Hypothese | Reto | Silvan | Nino | Stand |
|---|---|---|---|---|---|
| H1 | App primär für «Saldo & ist die Zahlung durch» | ✔ | ✔ | ✔ | **bestätigt (3/3)** |
| H2 | Unverständliche Händlernamen = häufigster Mikro-Frust | ? | ✔ | ✔ | **bestätigt (2/3)**, Reto nicht gefragt |
| H3 | Analysen ungenutzt, weil sie Daten zeigen statt Bedeutung | ✔ | ✔ | ✔ | **bestätigt (3/3)** — bei Nino sogar «zu langweilig» |
| H4 | Schleichende Veränderungen werden nicht bemerkt | ? | ✔ («ist mir passiert, dass ich etwas nicht mehr wollte und es später erst gemerkt habe») | ✔ (unbezahlte Rechnungen fallen erst bei der Mahnung auf) | **bestätigt (2/3)** |
| H5 | Zukunftsfrage unbeantwortet, v. a. KMU | ✔ | ✔✔ (privat **und** Firma: «tatsächlich nicht») | ✔ | **bestätigt (3/3)** |
| H6 | Gesamtsicht existiert nur im Kopf oder gar nicht | ✘ (Setup zu simpel, 2 Konten) | ? | ✘ (UBS + Capital, getrennt gedacht) | **schwach / bei Jungen irrelevant** → Multibanking ist *kein* Wow für diese Persona |
| H7 | Proaktive Hinweise willkommen, wenn konkret & nicht belehrend | ✔ | ✔ | ✔ | **bestätigt**, mit klarer Grenze (M6) |
| H8 | Business-Nutzer haben den schärferen Schmerz | – | ✔ (indirekt, Startup) | – | **offen — kein KMU-Interview** |
| H9 | Kein Budget, «komme gut durch», latenter Schmerz | ✔ | ✔ | **✘** — Nino: «ganz schlecht», «öfter im Minus» | **differenziert: zwei Typen!** siehe §7 |
| H10 | Übersicht ungenutzt wegen versteckt/unschön, nicht uninteressant | ✔ | ✔ | ✔ | **bestätigt (3/3)** |
| H11 | Ziel mit Bild + Fortschritt > Kategorien-Kuchen | ✔ («Boah, das wäre geil») | ? (kein konkretes Ziel) | ✔ (hat Ziele, Rentenziel auf Capital) | **bestätigt (2/3)** |
| H12 | Finanzwissen gering, investieren unbewusst via 3a | ✔ | ✘ (erklärt Fonds korrekt) | ✘ (investiert bewusst, wählte Capital wegen Spreads) | **widerlegt für Tech-affine Junge** |
| H13 | KI-Fragen: «wofür am meisten?», «was unnötig?» — Persönlichkeit nein | ✔ | ✔ | ✔ | **bestätigt (3/3)** |

**Die zwei wichtigsten Bewegungen gegenüber dem Stand nach Interview 01:**
- **H6 kippt.** Multibanking/Gesamtsicht ist der Teil der Challenge, den unsere Persona
  *nicht* braucht. Wenn wir darauf bauen, bauen wir an ihr vorbei. (Für KMU gilt das Gegenteil — ungeprüft.)
- **H12 kippt.** Tech-affine 19–22-Jährige kennen Fonds und investieren. Kein Erklärbär bauen.

---

## 7. Zwei Personas, nicht eine

Der Unterschied Nino ↔ Reto/Silvan ist der schärfste Befund und entscheidet über den Ton des Produkts.

### Persona A — «Kommt gut durch» (Reto, Silvan)
- Einkommen > Ausgaben, kein Leidensdruck, **kein Grund hinzuschauen**.
- Frage, die zieht: *«Wofür eigentlich?»* + *«Was könnte ich damit erreichen?»*
- Motivation = **Neugier und Ziel**, nicht Kontrolle. Reto: «Boah, das wäre geil.»
- Risiko: Warnungen wirken übergriffig, weil objektiv nichts brennt.

### Persona B — «Ganz schlecht mit Geld» (Nino)
- Regelmässig im Minus, Mahnungen auf dem Tisch, Excel gescheitert, **weiss es und schämt sich nicht dafür** («Das Problem ist einfach, ich habe wirklich viel ins Minus gehabt»).
- Frage, die zieht: *«Reicht es? Was kommt noch?»* — Ninos letzter App-Blick galt einer offenen Rechnung.
- Motivation = **Vermeiden eines konkreten Schmerzes** (Mahnung, Minus).
- Risiko: Moralisierung. Er hat schon einen inneren Kritiker; die App darf nicht der zweite sein.

**Gemeinsamer Nenner beider:** *«Was ist gerade normal, was nicht — sag es mir, ohne dass ich suche.»*
Das ist die Produktdefinition, die aus den Interviews fällt.

---

## 8. Was wir NICHT wissen (offene Lücken → nächste Interviews)

1. **KMU/Selbständige: null.** H8 ist unbelegt, obwohl die Challenge Unternehmen explizit nennt.
   → eine Finanzberaterin (Finanzberater), Papa, ein Bekannter priorisieren. Leitfaden §3 nutzen.
2. **PostFinance-intern: null.** Fragen stehen in `../../00_challenge/QUESTIONS_for_PostFinance.md`.
   Die wichtigste: *Warum kennt ein aktiver PF-Kunde die Abo-Übersicht nicht?*
3. **Ältere / Familien / Hypothek:** komplett fehlend. Fixkostenquote dort ist ein anderes Spiel.
4. **Beobachtung «Zeig mir deine App»:** in keinem der drei Gespräche durchgeführt.
   Leitfaden §5 ist billig (3 min) und liefert die härtesten Zahlen fürs Video
   («X Klicks bis zur Antwort auf *Wie viel für Essen letzten Monat?*»). **Sofort nachholen.**
5. **Frauen: null.** Bei einem Produkt zu Geld ist das eine echte Schwäche im Doku-Kapitel.

---

## 9. How-might-we (Ideate-Input)

- **HMW1** … einem Menschen, der nur den Saldo anschaut, in **einem Blick** sagen, ob dieser Monat normal ist? *(M1, M3, M5)*
- **HMW2** … eine unverständliche Buchung erklären, **bevor** jemand sie googelt? *(H2 — der einzige Schmerz, der wirklich täglich auftritt)*
- **HMW3** … Abos sichtbar machen für jemanden, der die bestehende Abo-Übersicht **nicht kennt**? *(Silvan)*
- **HMW4** … «Was war unnötig?» beantworten, **ohne zu urteilen** — und die Antwort vom Nutzer korrigieren lassen? *(Reto' Lern-Loop, M6)*
- **HMW5** … die Frage «reicht es bis Ende Monat?» beantworten, ohne dass jemand ein Budget pflegt? *(M4, M5)*
- **HMW6** … einen Insight so verpacken, dass er **ausserhalb** der App ankommt (Widget/Push/Wochenbrief)? *(M2, M8, M9)*
- **HMW7** … Zahlen so zeigen, dass sie eine **Dopamin-Schranke** überwinden — Ninos Wort? *(M3)*

---

## 10. Direkte Konsequenzen für Scope & Video

1. **Nicht Multibanking.** H6 ist bei unserer Persona schwach; PostFinance hat es seit Nov 2025 ohnehin live. Wir würden gegen ein Live-Feature antreten und die Persona nicht treffen.
2. **Nicht «noch ein Dashboard».** M2 ist eindeutig. Der Kanal ist der Beitrag, nicht die Kachel.
3. **Der 60-Sekunden-Wow ist «Was ist ungewöhnlich?»** — weil es die einzige der drei Challenge-Fragen ist, für die es heute **gar keine** Antwort gibt (M5, H4), und weil sie sich in einem Satz zeigen lässt.
4. **Die Buchungserklärung (H2) ist der Vertrauens-Anker** — kleiner Wow, aber 2/3 haben ihn spontan erzählt und er beweist, dass wir die Daten wirklich verstehen.
5. **Ton:** erklärend, nie mahnend, nie verkaufend (M6). Jeder Insight braucht ein sichtbares «weil …».
6. **Look:** PostFinance-Tokens aus `../PREP/01_Brand_and_Design_System/` konsequent — M3 sagt, dass Ästhetik hier Funktion ist.

---

## Anhang — Einzelauswertungen

| Nr | Person | Auswertung | Transkript |
|---|---|---|---|
| 01 | Reto | `auswertungen/01_reto.md` | `transkripte/01_reto_transkript.txt` |
| 02 | Silvan | `auswertungen/02_silvan.md` | `transkripte/02_silvan_transkript.txt` |
| 04 | Nino | `auswertungen/04_nino.md` | `transkripte/04_nino_transkript.txt` |
| 05 | Livia | — | `transkripte/05_livia_transkript.txt` |
| 06 | Selin | — | `transkripte/06_selin_transkript.txt` |
| 07 | Bruno | — | `transkripte/07_bruno_transkript.txt` |

Die Namen sind Pseudonyme. Die Gespräche wurden für diesen Hackathon geführt,
nicht zur Veröffentlichung — Klarnamen und Wohnorte sind ersetzt.
