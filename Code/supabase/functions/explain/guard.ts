/**
 * ── Die Zahlenwache ────────────────────────────────────────────────────────
 * Jede Zahl im Antworttext muss eine Zahl sein, die im Prompt stand.
 *
 * Der Fähigkeitstest hat gezeigt: Aus fertigen Fakten erfindet das Modell
 * keine Beträge. «Zeigt keine Fehler» ist aber kein Beweis, und in einer
 * Banking-App ist ein plausibel falscher Betrag der teuerste Fehler
 * überhaupt. Also wird geprüft — und die Prüfung hat beim ersten Lauf sofort
 * etwas gefunden: Der 70B schrieb «fast CHF 400», wo die Differenz 349 war.
 * Sprachlich eine Näherung, in einem Budget eine falsche Zahl.
 *
 * Die Erlaubnisliste wird aus dem Prompt selbst gelesen statt von Hand
 * gepflegt. Damit gilt genau die Regel, die gelten soll: **was wir geschickt
 * haben, darf zurückkommen — sonst nichts.** Dazu die Zahlen bis 12 für
 * Monate und Aufzählungen im Fliesstext.
 */
export function allowedNumbers(prompt: string): Set<number> {
  const allowed = new Set<number>(numbersIn(prompt))
  for (let i = 0; i <= 12; i++) allowed.add(i)
  return allowed
}

/** Zahlen aus einem Text ziehen — mit Apostroph, Punkt oder Leerzeichen gruppiert. */
export function numbersIn(text: string): number[] {
  const found = text.match(/\d[\d\u2019'.\s]*/g) ?? []
  return found
    .map((raw) => Number(raw.replace(/[\u2019'\s]/g, '').replace(/\.$/, '')))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.abs(Math.round(value)))
}

export function hasOnlyKnownNumbers(text: string, allowed: Set<number>): boolean {
  return numbersIn(text).every((value) => allowed.has(value))
}

