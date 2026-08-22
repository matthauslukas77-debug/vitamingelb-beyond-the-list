import { formatAmount } from '../../../lib/money'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Geht es auf? — die Zeile, die beim Schieben mitläuft.
 *
 * Sie klebt am unteren Rand und rechnet bei jeder Reglerbewegung neu. Das ist
 * der ganze Unterschied zum Formular: Man sieht nicht am Ende, ob das Budget
 * aufgeht, sondern **während** man es baut. Wer die Miete hochschiebt, sieht
 * den Balken wandern und den Überschuss kippen, bevor der Daumen oben ist.
 *
 * Der Balken zeigt die Ausgaben im Verhältnis zu den Einnahmen. Bei über
 * 100 % läuft er in Rot weiter und die Zahl daneben wird zum Fehlbetrag.
 */

export function BalanceBar({
  income,
  expenses,
  yearView,
}: {
  /** Rappen pro Monat. */
  income: number
  /** Rappen pro Monat. */
  expenses: number
  yearView: boolean
}) {
  const factor = yearView ? 12 : 1
  const surplus = income - expenses
  const negative = surplus < 0
  const share = income > 0 ? expenses / income : 1

  return (
    <div className={'balbar' + (negative ? ' balbar--negative' : '')}>
      <div className="balbar__track" aria-hidden>
        <div className="balbar__fill" style={{ width: `${Math.min(100, share * 100)}%` }} />
      </div>
      <div className="balbar__line">
        <span className="balbar__label">
          {negative ? 'Es geht nicht auf' : 'Bleibt übrig'}
          <span className="balbar__sub">
            {formatAmount(income * factor, { sign: false })} rein ·{' '}
            {formatAmount(expenses * factor, { sign: false })} raus
          </span>
        </span>
        <span className="balbar__amount num">
          <span className="balbar__cur">CHF</span> {formatAmount(surplus * factor, { sign: true })}
        </span>
      </div>
    </div>
  )
}
