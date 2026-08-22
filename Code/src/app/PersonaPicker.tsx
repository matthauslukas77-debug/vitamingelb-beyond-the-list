import { PERSONAS } from '../data/personas'
import { formatMoney } from '../lib/money'
import type { Persona } from '../data/types'
import './persona-picker.css'

/**
 * Auswahlbildschirm vor der App. Jede Persona bildet eine Person aus unseren
 * Interviews ab — deshalb steht bei jeder das Originalzitat.
 */
export function PersonaPicker({ onChoose }: { onChoose: (persona: Persona) => void }) {
  return (
    <div className="picker">
      <header className="picker__head">
        <p className="picker__eyebrow">BärnHäckt 2026 · PostFinance «Beyond the List»</p>
        <h1 className="picker__title">Wer schaut heute ins Banking?</h1>
        <p className="picker__lead">
          Vier Personas aus unseren sechs Interviews. Jede bringt zwei Jahre
          eigene Konten, Buchungen und Muster mit.
        </p>
      </header>

      <ul className="picker__grid">
        {PERSONAS.map((persona) => {
          const total = persona.accounts
            .filter((account) => !account.furtherProduct)
            .reduce((sum, account) => sum + account.balance, 0)

          return (
            <li key={persona.id}>
              <button className="persona" onClick={() => onChoose(persona)}>
                <span className="persona__top">
                  <span className="persona__avatar" aria-hidden="true">
                    {persona.name.charAt(0)}
                  </span>
                  <span>
                    <span className="persona__name">{persona.name}</span>
                    <span className="persona__role">{persona.role}</span>
                  </span>
                </span>
                <span className="persona__quote">{persona.quote}</span>
                <span className="persona__foot">
                  <span className="persona__source">{persona.source}</span>
                  <span className="persona__total num">{formatMoney(total, 'CHF', { sign: false })}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="picker__note">
        Prototyp. Alle Beträge und Buchungen sind erfunden und aus einem festen Startwert
        erzeugt — bei jedem Start identisch.
      </p>
    </div>
  )
}
