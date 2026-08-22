import { getSupabase, isSupabaseConfigured } from '../../lib/supabase'
import { categoryDef, CATEGORY_KEYS } from './slots'
import { toFrancs, type CategoryComparison } from './benchmark'
import type { DerivedBudget } from './derive'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Der Satz neben dem Budget — und die Stelle, an der Apertus mitschreibt.
 *
 * Die Arbeitsteilung ist die Antwort auf Jury-Kriterium T3 (souveräner
 * KI-Einsatz) und steht so schon in `WORKSPACE/08_features/03_BUDGET_WIZARD.md`:
 *
 *     Erkennung   → deterministisch im Code, jede Zahl beweisbar
 *     Formulierung → Apertus, aus fertiger Evidenz
 *
 * Der Grund ist gemessen, nicht ideologisch. Der Fähigkeitstest
 * (`WORKSPACE/03_research/16_Tooling_und_Zugaenge/APERTUS_CAPABILITY_TEST.md`)
 * hat beide Apertus-Grössen 14 Zahlen addieren lassen: Der 8B lag bei 1'021
 * statt 3'193, der 70B bei 3'084 — plausibel nah dran, und genau das ist in
 * einer Banking-App der gefährlichste Fehler. Aus fertigem Fakt formulieren
 * beide dagegen sauber und erfinden nichts.
 *
 * Drei Sicherungen, in dieser Reihenfolge:
 *
 *   1. **Der gerechnete Satz entsteht zuerst.** `localSummary()` läuft immer
 *      und ohne Netz. Er ist die Anzeige, nicht der Notnagel.
 *   2. **Apertus ersetzt ihn nur bei Erfolg.** Kein Schlüssel, kein Netz,
 *      Zeitüberschreitung — der gerechnete Satz bleibt stehen.
 *   3. **Die Zahlenwache in der Edge Function** verwirft jede Antwort, die
 *      eine Zahl enthält, die wir nicht geliefert haben.
 *
 * Der Schlüssel liegt als Secret bei der Edge Function. Alles mit
 * `VITE_`-Präfix landet im Browser-Bundle und wäre öffentlich — deshalb geht
 * der Aufruf über `supabase/functions/explain/`, nicht direkt.
 */

export interface Explanation {
  text: string
  /** Woher der Satz kommt — steht sichtbar an der Karte. */
  source: 'apertus' | 'gerechnet'
  /** Nur bei `gerechnet`: warum das Modell nicht zum Zug kam. */
  reason?: string
}

/** CHF-Betrag als «1'650», ohne Rappen — die Schreibweise der App. */
function chf(rappen: number): string {
  return Math.abs(toFrancs(rappen)).toLocaleString('de-CH').replace(/ /g, '’')
}

/**
 * Der Befund: der eine Satz, der die Geschichte trägt.
 *
 * Deterministisch ausgewählt, in dieser Reihenfolge:
 *
 *   1. **Der Posten über dem Vergleich.** Nach unten abweichen ist kein
 *      Befund — wer kein Auto hat, zahlt eben nichts fürs Auto. Nach oben
 *      abweichen ist einer.
 *   2. **Überschuss ist nicht dasselbe wie gespart.** Diese Zahl gibt es
 *      heute nirgends: Was übrig bleibt, minus was wirklich aufs Sparkonto
 *      geht, bleibt jeden Monat unbemerkt liegen.
 *   3. **Es geht nicht auf.** Dann ist das der Befund und sonst nichts.
 *   4. Sonst: kein Posten über dem Vergleich, und das darf auch dastehen.
 *
 * Diese Auswahl trifft der Code, nicht das Modell. Als der 70B im Test selbst
 * wählen durfte, schrieb er bei Bruno, tiefere Konsumausgaben würden «den
 * Überschuss am stärksten reduzieren» — sauberes Deutsch, falscher Inhalt.
 * Derselbe Befund speist danach beide Wege: den gerechneten Satz und den
 * Prompt an Apertus. Beide erzählen dieselbe Geschichte, nur anders formuliert.
 */
export function headlineOf(derived: DerivedBudget, rows: CategoryComparison[]): string {
  const above = rows.filter((row) => row.delta > 0).sort((a, b) => b.delta - a.delta)[0]
  if (above && above.delta >= 5_000) {
    return (
      `«${categoryDef(above.key).title}» ist der Posten am weitesten über dem Vergleich: ` +
      `CHF ${chf(above.actual)} statt CHF ${chf(above.benchmark)}, also CHF ${chf(above.delta)} mehr.`
    )
  }

  if (derived.surplusMonth > 0 && derived.surplusMonth - derived.actualSavedMonth >= 10_000) {
    const liegen = derived.surplusMonth - derived.actualSavedMonth
    return (
      `Vom Überschuss von CHF ${chf(derived.surplusMonth)} gehen CHF ${chf(derived.actualSavedMonth)} ` +
      `wirklich aufs Sparkonto. CHF ${chf(liegen)} bleiben jeden Monat unbemerkt auf dem Konto liegen.`
    )
  }

  if (derived.surplusMonth < 0) {
    return `Die Ausgaben liegen CHF ${chf(derived.surplusMonth)} über den Einnahmen.`
  }

  const below = [...rows].sort((a, b) => a.delta - b.delta)[0]
  return (
    `Kein Posten liegt über dem Vergleich. Am weitesten darunter liegt ` +
    `«${categoryDef(below.key).title}» mit CHF ${chf(below.actual)} statt CHF ${chf(below.benchmark)}.`
  )
}

/**
 * Der gerechnete Satz — die Anzeige, solange kein Modell geantwortet hat.
 *
 * Er ist bewusst derselbe Befund, nicht eine dürftigere Variante davon: Wenn
 * Apertus nicht erreichbar ist, fehlt der App nichts als eine geschmeidigere
 * Formulierung.
 */
export function localSummary(derived: DerivedBudget, rows: CategoryComparison[]): string {
  return headlineOf(derived, rows)
}

/**
 * Was die Edge Function bekommt: fertige Zahlen in ganzen Franken und den
 * ausgewählten Befund. Keine Buchungen, kein Prompt, keine freien Texte.
 */
function factsFrom(derived: DerivedBudget, rows: CategoryComparison[]) {
  return {
    incomeMonth: toFrancs(derived.incomeMonth),
    expensesMonth: toFrancs(derived.expensesMonth),
    surplusMonth: toFrancs(derived.surplusMonth),
    actualSavedMonth: toFrancs(derived.actualSavedMonth),
    unassignedMonth: toFrancs(derived.coverage.review),
    avoidedDoubleCount: toFrancs(Math.round(derived.flow.avoidedDoubleCount / derived.months)),
    headline: headlineOf(derived, rows),
    categories: CATEGORY_KEYS.map((key) => {
      const row = rows.find((entry) => entry.key === key)
      return {
        label: categoryDef(key).title,
        actual: toFrancs(row?.actual ?? 0),
        benchmark: toFrancs(row?.benchmark ?? 0),
      }
    }),
  }
}

/**
 * Holt den Satz. Gibt immer etwas zurück — nie einen Fehler.
 *
 * Der gerechnete Satz steht sofort; wer auf das Modell warten will, wartet auf
 * das Versprechen. Im UI heisst das: Die Karte zeigt zuerst `localSummary()`
 * und tauscht den Text aus, wenn Apertus antwortet. Klemmt der Endpunkt am
 * Sonntag, merkt es niemand.
 */
export async function explainBudget(
  derived: DerivedBudget,
  rows: CategoryComparison[],
): Promise<Explanation> {
  const fallback: Explanation = {
    text: localSummary(derived, rows),
    source: 'gerechnet',
  }

  if (!isSupabaseConfigured()) return { ...fallback, reason: 'not-configured' }

  try {
    const supabase = await getSupabase()
    const { data, error } = await supabase.functions.invoke<{ text: string | null; reason?: string }>(
      'explain',
      { body: { kind: 'budget-summary', facts: factsFrom(derived, rows) } },
    )
    if (error || !data?.text) return { ...fallback, reason: data?.reason ?? 'unavailable' }
    return { text: data.text, source: 'apertus' }
  } catch {
    /* Netz weg, Funktion nicht deployed, Rechte falsch — alles derselbe Fall:
       Der gerechnete Satz steht ohnehin schon da. */
    return { ...fallback, reason: 'unavailable' }
  }
}
