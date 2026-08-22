import { useEffect, useMemo, useState } from 'react'
import { TODAY } from '../../../data/types'
import { formatAmount } from '../../../lib/money'
import { useSession } from '../../../app/session'
import { Icon } from '../../../app/shell/Icon'
import type { DerivedBudget } from '../derive'
import { CATEGORIES, categoryDef, type CategoryKey } from '../slots'
import { amountOf, totalOf, type SavedBudget } from '../storage'
import { benchmarkFor, compare, type CategoryComparison } from '../benchmark'
import { Display, bottomTip, topTip, TIP_TEXT, updateBudget, type Budget, type TipKey } from '../pf-model'
import { toFrancs } from '../benchmark'
import { CATEGORY_KEYS } from '../slots'
import { explainBudget, localSummary, type Explanation } from '../explain'
import { milestones, monthsUntilEmpty, project, savingsBalance } from '../forecast'
import { ForecastChart, ForecastLegend } from '../ui/ForecastChart'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Schritt 3: der Ausblick — und die Einschränkungen dazu.
 *
 * Zwei Linien über fünf Jahre. Die eine ist das Versprechen des Budgets, die
 * andere das bisherige Sparverhalten. Der Abstand dazwischen ist die Aussage:
 * Ein Überschuss von CHF 1'390 heisst nicht, dass CHF 1'390 gespart werden —
 * bei Reto sind es 1'250, der Rest bleibt liegen.
 *
 * Dazu der Vergleich gegen den Richtwert desselben Haushalts und die
 * Tippboxen des Originals, hier auf **unseren** Zahlen gerechnet. «Keine
 * private Vorsorge erkannt» steht da, weil in den Buchungen wirklich keine
 * 3a-Einzahlung ist — nicht, weil ein Modell das annimmt.
 *
 * Was hier bewusst **nicht** steht: eine Produktempfehlung. Kein «Jetzt 3a
 * eröffnen», kein Sparplan-Angebot. M6 aus der Interviewsynthese ist
 * eindeutig: Das Misstrauen richtet sich gegen Beratung, nicht gegen
 * Werkzeuge.
 */

const HORIZON_MONTHS = 60

/** Das Budget des Nutzers im `Budget`-Format des Originals — für die Tipps. */
function budgetOf(budget: SavedBudget, incomeMonth: number): Budget {
  const record = { display: Display.month } as unknown as Record<string, number | string>
  const income = toFrancs(incomeMonth)
  record.householdIncomeNetMonth = income
  record.householdIncomeNetYear = income * 12

  for (const key of CATEGORY_KEYS) {
    const month = toFrancs(
      CATEGORIES.find((entry) => entry.key === key)!.fields.reduce(
        (total, _field, index) => total + amountOf(budget, `${key}.${index}`),
        0,
      ),
    )
    record[`${key}MonthAmount`] = month
    record[`${key}YearAmount`] = month * 12
  }
  return updateBudget(record as unknown as Budget)
}

export function WizardForecast({
  derived,
  budget,
  onSave,
}: {
  derived: DerivedBudget
  budget: SavedBudget
  onSave: () => void
}) {
  const { persona } = useSession()
  const [rows, setRows] = useState<CategoryComparison[] | null>(null)
  const [explanation, setExplanation] = useState<Explanation | null>(null)

  const planned = totalOf(budget)
  const surplus = derived.incomeMonth - planned

  const start = useMemo(() => savingsBalance(persona.accounts), [persona])
  const plan = useMemo(
    () => project(start, surplus, { months: HORIZON_MONTHS, today: TODAY }),
    [start, surplus],
  )
  /* Die zweite Linie ist kein zweites Budget, sondern das gemessene Verhalten:
     was in den letzten zwölf Monaten wirklich auf ein eigenes Konto ging. */
  const actual = useMemo(
    () => project(start, derived.actualSavedMonth, { months: HORIZON_MONTHS, today: TODAY }),
    [start, derived.actualSavedMonth],
  )
  const empty = monthsUntilEmpty(plan)
  const marks = milestones(plan, actual)

  const pfBudget = budgetOf(budget, derived.incomeMonth)
  const tips = [topTip(pfBudget), bottomTip(pfBudget)].filter((tip): tip is TipKey => tip !== null)

  useEffect(() => {
    let current = true
    benchmarkFor(persona, derived, budget.answers, Number(TODAY.slice(0, 4)))
      .then(async (benchmark) => {
        if (!current) return
        const compared = compare(derived, benchmark)
        setRows(compared)
        setExplanation({ text: localSummary(derived, compared), source: 'gerechnet' })
        const spoken = await explainBudget(derived, compared)
        if (current) setExplanation(spoken)
      })
      .catch(() => {
        /* Ohne Richtwert bleibt der Ausblick stehen — er braucht ihn nicht. */
      })
    return () => {
      current = false
    }
  }, [persona, derived, budget.answers])

  /* Nur was über dem Vergleich liegt, ist ein Befund. Wer kein Auto hat,
     zahlt eben nichts fürs Auto — das braucht keinen Hinweis. */
  const above = (rows ?? [])
    .filter((row) => row.delta > 5_000)
    .sort((a, b) => b.delta - a.delta)

  return (
    <div className="screen__inner wz-forecast">
      <h2 className="wz-title">Wenn du das hältst</h2>

      <section className="card wz-card">
        <ForecastChart plan={plan} actual={actual} months={HORIZON_MONTHS} />
        <ForecastLegend plan={plan} actual={actual} months={HORIZON_MONTHS} />
        <p className="wz-fine">
          Ohne Zins gerechnet, mit dem Guthaben deiner Spar- und Vorsorgekonten als Start
          ({formatAmount(start, { sign: false })}). Eine angenommene Rendite würde nach fünf
          Jahren mehr ausmachen als das Sparverhalten selbst — deshalb steht hier keine.
        </p>
      </section>

      <div className="wz-marks">
        {marks.map((mark) => (
          <div className="wz-mark" key={mark.months}>
            <span className="wz-mark__label">{mark.label}</span>
            <span className="wz-mark__plan num">{formatAmount(mark.plan, { sign: false })}</span>
            <span className="wz-mark__actual num">
              bisher: {formatAmount(mark.actual, { sign: false })}
            </span>
          </div>
        ))}
      </div>

      {empty !== null && (
        <div className="wz-warn">
          <Icon name="support" size={18} />
          <span>
            So geht das Guthaben in <strong>{empty} Monaten</strong> auf null. Das Budget gibt
            pro Monat {formatAmount(surplus, { sign: false })} mehr aus, als hereinkommt.
          </span>
        </div>
      )}

      {explanation && (
        <section className="card bud-say">
          <p className="bud-say__text">{explanation.text}</p>
          <span className={'bud-say__badge' + (explanation.source === 'apertus' ? ' is-model' : '')}>
            {explanation.source === 'apertus' ? 'formuliert von Apertus' : 'gerechnet'}
          </span>
        </section>
      )}

      {above.length > 0 && (
        <>
          <div className="section-head">
            <span className="section-head__title">Wo Spielraum wäre</span>
          </div>
          <section className="card wz-card">
            <p className="wz-lead" style={{ marginTop: 0 }}>
              Gegenüber einem vergleichbaren Haushalt liegen diese Posten höher. Das ist kein
              Urteil — nur der Ort, an dem sich eine Änderung am meisten auswirkt.
            </p>
            {above.map((row) => (
              <div className="wz-over" key={row.key}>
                <span>{categoryDef(row.key as CategoryKey).title}</span>
                <span className="num">
                  {formatAmount(row.actual, { sign: false })} statt{' '}
                  {formatAmount(row.benchmark, { sign: false })}
                </span>
              </div>
            ))}
          </section>
        </>
      )}

      {tips.map((tip) => (
        <div className="bud-tip" key={tip}>
          <span className="bud-tip__icon"><Icon name="support" size={18} /></span>
          <span>
            <span className="bud-tip__title">{TIP_TEXT[tip].title}</span>
            <span className="bud-tip__body">{TIP_TEXT[tip].body}</span>
          </span>
        </div>
      ))}

      <button className="wz-next wz-next--save" onClick={onSave}>
        <Icon name="check" size={18} />
        Budget speichern
      </button>
    </div>
  )
}
