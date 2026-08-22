import { useState } from 'react'
import { TODAY } from '../../../data/types'
import { formatAmount } from '../../../lib/money'
import { Icon } from '../../../app/shell/Icon'
import type { DerivedBudget, SlotEvidence } from '../derive'
import { CATEGORIES, slotKey, fieldLabel, type CategoryKey } from '../slots'
import { amountOf, resetAmount, withAmount, type SavedBudget } from '../storage'
import { Slider, sliderMax } from '../ui/Slider'
import { BalanceBar } from '../ui/BalanceBar'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Schritt 2: das ausgefüllte Budget.
 *
 * Der Unterschied zum Original in einem Satz: Dort starten alle neunzehn
 * Detailfelder bei 0, und wer «Miete: 1'650» eintippt, setzt damit den ganzen
 * Kategorientotal auf diesen einen Wert — die anderen zwei Felder stehen ja
 * noch auf null. Hier ist alles gefüllt, bevor jemand etwas anfasst, und der
 * Kategorientotal ist immer die Summe seiner Felder.
 *
 * Unten klebt die Rechnung und läuft beim Schieben mit. Das ist die Antwort
 * auf «geht es auf?», bevor man fertig ist — nicht danach.
 */

/** Der Beleg unter der Beschriftung eines Reglers. */
function hintFor(evidence: SlotEvidence, months: number): string | undefined {
  if (evidence.monthly === 0 && evidence.count === 0) return undefined
  const parts: string[] = []
  if (evidence.count > 0) {
    parts.push(`${evidence.count} ${evidence.count === 1 ? 'Buchung' : 'Buchungen'}`)
  }
  parts.push(
    evidence.smoothedOver ? `über ${evidence.smoothedOver} Mt gemittelt` : `${evidence.monthsSeen}/${months} Mt`,
  )
  if (evidence.recurring) parts.push('Fixkosten')
  if (evidence.sources.length > 0) parts.push(evidence.sources.slice(0, 2).join(', '))
  return parts.join(' · ')
}

export function WizardSliders({
  derived,
  budget,
  onChange,
  onNext,
}: {
  derived: DerivedBudget
  budget: SavedBudget
  onChange: (next: SavedBudget) => void
  onNext: () => void
}) {
  const [yearView, setYearView] = useState(false)
  const [open, setOpen] = useState<CategoryKey | null>(null)

  const categoryTotal = (category: CategoryKey) =>
    derived.slots
      .filter((entry) => entry.slot.category === category)
      .reduce((total, entry) => total + amountOf(budget, slotKey(entry.slot)), 0)

  const expenses = CATEGORIES.reduce((total, category) => total + categoryTotal(category.key), 0)
  const factor = yearView ? 12 : 1
  const editedCount = budget.edited.length

  return (
    <>
      <div className="screen__inner wz-sliders">
        <h2 className="wz-title">Dein Budget — schon ausgefüllt</h2>
        <p className="wz-lead">
          {derived.filledSlots} der 19 Felder kommen aus deinen Buchungen. Jede Zahl ist ein
          Vorschlag: antippen, schieben, überschreiben. Was du änderst, bleibt geändert.
        </p>

        <div className="bud-toggle" role="group" aria-label="Zeitraum">
          <button aria-pressed={!yearView} onClick={() => setYearView(false)}>pro Monat</button>
          <button aria-pressed={yearView} onClick={() => setYearView(true)}>pro Jahr</button>
        </div>

        <section className="card">
          {CATEGORIES.map((category) => {
            const total = categoryTotal(category.key)
            const isOpen = open === category.key
            const fields = derived.slots.filter((entry) => entry.slot.category === category.key)

            return (
              <div className="bud-cat" key={category.key}>
                <button
                  className="bud-cat__head"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : category.key)}
                >
                  <span className="bud-cat__icon"><Icon name={category.icon} size={22} accent /></span>
                  <span className="bud-cat__main">
                    <span className="bud-cat__title">{category.title}</span>
                    <span className="bud-cat__delta">
                      {fields.filter((entry) => amountOf(budget, slotKey(entry.slot)) > 0).length} von{' '}
                      {fields.length} Feldern gefüllt
                    </span>
                  </span>
                  <span className="bud-cat__amount num">
                    {formatAmount(total * factor, { sign: false })}
                  </span>
                  <span className={'bud-cat__chevron' + (isOpen ? ' is-open' : '')}>
                    <Icon name="chevronDown" size={16} />
                  </span>
                </button>

                {isOpen && (
                  <div className="wz-fields">
                    {fields.map((evidence) => {
                      const key = slotKey(evidence.slot)
                      return (
                        <Slider
                          key={key}
                          label={fieldLabel(evidence.slot)}
                          hint={hintFor(evidence, derived.months)}
                          value={amountOf(budget, key)}
                          max={sliderMax(evidence.monthly, derived.incomeMonth)}
                          suggestion={evidence.monthly}
                          edited={budget.edited.includes(key)}
                          onChange={(rappen) => onChange(withAmount(budget, key, rappen, TODAY))}
                          onReset={() => onChange(resetAmount(budget, key, derived, TODAY))}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </section>

        {editedCount > 0 && (
          <p className="wz-note">
            <Icon name="pencil" size={13} />
            {editedCount} {editedCount === 1 ? 'Feld' : 'Felder'} von dir gesetzt. Beim nächsten
            Monat rechnen wir sie nicht wieder weg.
          </p>
        )}

        <button className="wz-next" onClick={onNext}>
          Weiter zum Ausblick
          <Icon name="chevronRight" size={18} />
        </button>
      </div>

      {/* Klebt unten und rechnet bei jeder Reglerbewegung neu. */}
      <BalanceBar income={derived.incomeMonth} expenses={expenses} yearView={yearView} />
    </>
  )
}
