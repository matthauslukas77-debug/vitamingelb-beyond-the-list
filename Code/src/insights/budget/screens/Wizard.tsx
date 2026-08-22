import { useMemo, useState } from 'react'
import { TODAY } from '../../../data/types'
import { formatAmount } from '../../../lib/money'
import { useSession } from '../../../app/session'
import { Icon } from '../../../app/shell/Icon'
import { Sheet } from '../../../app/shell/Sheet'
import { deriveForPersona } from '../derive'
import { DEFAULT_ANSWERS, type Answers } from '../benchmark'
import { CivilStatus, Denomination } from '../pf-model'
import { budgetFromDerivation, loadBudget, refreshed, saveBudget, type SavedBudget } from '../storage'
import { WizardSliders } from './WizardSliders'
import { WizardForecast } from './WizardForecast'
import '../budget.css'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Der Budget-Wizard. Zwei Fragen statt sieben Feldern.
 *
 * Der öffentliche PostFinance-Budgetrechner fragt: Lebensform, Kinderzahl,
 * Bruttojahreslohn, Konfession, Steuerort — bei Partnerschaft zusätzlich Lohn
 * und Konfession der zweiten Person. Sieben Eingaben, danach schätzt er die
 * Ausgaben aus einer Haushaltstabelle.
 *
 * Eine Banking-App muss das meiste davon nicht fragen. Der Jahrgang steht im
 * Kundenstamm, das Einkommen in den Lohngutschriften, der Steuerkanton auf der
 * Steuerzahlung. Übrig bleiben zwei Dinge, die wirklich in keiner Buchung
 * stehen: **mit wem** jemand lebt und **wie viele Kinder** zu versorgen sind.
 * Ein gemeinsames Konto sieht aus wie ein einzelnes.
 *
 * Was wir ableiten, versteckt der Wizard trotzdem nicht — es steht unter «Das
 * wissen wir schon», jede Zeile mit ihrem Beleg und jede Zeile korrigierbar.
 * Eine App, die still etwas annimmt, hat recht oder unrecht; eine, die es
 * hinschreibt, kann korrigiert werden.
 *
 * Drei Schritte:
 *   1. die zwei Fragen (hier)
 *   2. das ausgefüllte Budget mit Reglern      → `WizardSliders`
 *   3. der Ausblick und das Speichern          → `WizardForecast`
 */

type Step = 1 | 2 | 3

const LIFE_FORMS: { value: CivilStatus; label: string }[] = [
  { value: CivilStatus.alleinstehend, label: 'Allein' },
  { value: CivilStatus.konkubinat, label: 'Mit Partner:in' },
  { value: CivilStatus.verheiratet, label: 'Verheiratet' },
]

const DENOMINATIONS: { value: Denomination; label: string }[] = [
  { value: Denomination.konfessionslos, label: 'keine' },
  { value: Denomination.reformiert, label: 'reformiert' },
  { value: Denomination.roemischKatholisch, label: 'römisch-katholisch' },
  { value: Denomination.christKatholisch, label: 'christkatholisch' },
]

/** Die Kantone des Steuerrasters. Ein Referenzort je Kanton. */
const CANTONS = [
  'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE',
  'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
]

/** Eine Reihe Auswahlknöpfe — die Antwort auf eine Frage. */
function Choice<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (next: T) => void
  label: string
}) {
  return (
    <div className="wz-choice" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Eine Zeile im Block «Das wissen wir schon»: Wert, Beleg, Herkunft. */
function Known({
  label,
  value,
  why,
  children,
}: {
  label: string
  value?: string
  why: string
  children?: React.ReactNode
}) {
  return (
    <div className="wz-known">
      <span className="wz-known__label">{label}</span>
      {value !== undefined ? <span className="wz-known__value num">{value}</span> : children}
      <span className="wz-known__why">{why}</span>
    </div>
  )
}

export function BudgetWizard() {
  const { persona, pop } = useSession()
  const [step, setStep] = useState<Step>(1)

  const derived = useMemo(
    () => deriveForPersona(persona, { today: TODAY, months: 12 }),
    [persona],
  )

  /* Ein bereits gespeichertes Budget wird weitergeführt, nicht überschrieben:
     Von Hand gesetzte Felder überstehen den zweiten Lauf (`refreshed`). */
  const [budget, setBudget] = useState<SavedBudget>(() => {
    const stored = loadBudget(persona.id)
    const fresh = budgetFromDerivation(
      derived,
      { ...DEFAULT_ANSWERS, canton: derived.detectedCanton?.canton ?? DEFAULT_ANSWERS.canton },
      TODAY,
    )
    return stored ? refreshed({ ...stored }, derived, TODAY) : fresh
  })

  const answers = budget.answers
  const setAnswers = (next: Partial<Answers>) =>
    setBudget((current) => ({ ...current, answers: { ...current.answers, ...next } }))

  const hasPartner = answers.civilStatus !== CivilStatus.alleinstehend
  const salary = derived.incomeSources[0]

  function save() {
    saveBudget(persona.id, { ...budget, savedAt: TODAY })
    pop()
  }

  return (
    <Sheet title="Budget" onBack={step === 1 ? pop : () => setStep((step - 1) as Step)}>
      <div className="wz">
        {/* Drei Striche wie im Zahlungsfluss — Vorlage IMG_5016. */}
        <div className="wz-steps" aria-hidden>
          {[1, 2, 3].map((entry) => (
            <span key={entry} className={'wz-steps__bar' + (entry <= step ? ' is-done' : '')} />
          ))}
        </div>

        {step === 1 && (
          <div className="screen__inner">
            <h2 className="wz-title">Zwei Fragen. Den Rest wissen wir.</h2>
            <p className="wz-lead">
              Der Budgetrechner auf der Website fragt sieben Dinge. Fünf davon stehen in
              deinen Buchungen oder in deinem Profil — die beiden hier nicht.
            </p>

            <section className="card wz-card">
              <span className="wz-q">Lebst du allein oder mit Partner:in?</span>
              <span className="wz-why">
                Aus Buchungen nicht erkennbar — ein gemeinsames Konto sieht aus wie ein einzelnes.
              </span>
              <Choice
                label="Lebensform"
                options={LIFE_FORMS}
                value={answers.civilStatus}
                onChange={(civilStatus) => setAnswers({ civilStatus })}
              />

              {hasPartner && (
                <label className="wz-field">
                  <span>Bruttojahreslohn der zweiten Person</span>
                  <input
                    inputMode="numeric"
                    placeholder="z. B. 55 000"
                    value={answers.partnerGrossYear ?? ''}
                    onChange={(event) =>
                      setAnswers({
                        partnerGrossYear: Number(event.target.value.replace(/[^\d]/g, '')) || undefined,
                      })
                    }
                  />
                  <span className="wz-field__why">
                    Wir sehen nur dein Konto. Ohne Angabe rechnet der Vergleich mit einem Einkommen.
                  </span>
                </label>
              )}
            </section>

            <section className="card wz-card">
              <span className="wz-q">Hast du unterstützungspflichtige Kinder?</span>
              <span className="wz-why">
                {derived.openQuestions.some((question) => question.key === 'children')
                  ? 'Keine Kita-, Schul- oder Kinderzulagen-Buchungen gefunden.'
                  : 'In deinen Buchungen gibt es Hinweise auf Kinder — bitte bestätigen.'}
              </span>
              <Choice
                label="Kinder"
                options={['0', '1', '2', '3', '4', '5'].map((value) => ({ value, label: value }))}
                value={answers.children}
                onChange={(children) => setAnswers({ children })}
              />
            </section>

            <div className="section-head">
              <span className="section-head__title">Das wissen wir schon</span>
            </div>
            <section className="card wz-card">
              <Known
                label="Jahrgang"
                value={String(persona.birthYear)}
                why={`aus deinem Profil · ${Number(TODAY.slice(0, 4)) - persona.birthYear} Jahre. Der Rechner auf der Website nimmt für alle 18 an und rechnet deshalb ohne BVG-Abzug.`}
              />
              <Known
                label="Nettoeinkommen"
                value={`${formatAmount(derived.incomeMonth, { sign: false })} / Mt`}
                why={
                  salary
                    ? `gemessen an ${derived.incomeSources.reduce((total, entry) => total + entry.count, 0)} Gutschriften · grösste Quelle: ${salary.label}`
                    : 'aus deinen Gutschriften der letzten 12 Monate'
                }
              />
              <Known
                label="Steuerort"
                why={
                  derived.detectedCanton
                    ? `erkannt aus «${derived.detectedCanton.evidence}»`
                    : 'keine Steuerzahlung in den letzten 12 Monaten — bitte wählen'
                }
              >
                <select
                  className="wz-select"
                  aria-label="Steuerkanton"
                  value={answers.canton}
                  onChange={(event) => setAnswers({ canton: event.target.value })}
                >
                  {CANTONS.map((canton) => (
                    <option key={canton} value={canton}>{canton}</option>
                  ))}
                </select>
              </Known>
              <Known
                label="Konfession"
                why="steht nicht in den Buchungen. Ohne Angabe rechnen wir ohne Kirchensteuer."
              >
                <select
                  className="wz-select"
                  aria-label="Konfession"
                  value={answers.denomination}
                  onChange={(event) => setAnswers({ denomination: event.target.value as Denomination })}
                >
                  {DENOMINATIONS.map((entry) => (
                    <option key={entry.value} value={entry.value}>{entry.label}</option>
                  ))}
                </select>
              </Known>
            </section>

            <button className="wz-next" onClick={() => setStep(2)}>
              Budget ansehen
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
        )}

        {step === 2 && (
          <WizardSliders
            derived={derived}
            budget={budget}
            onChange={setBudget}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <WizardForecast derived={derived} budget={budget} onSave={save} />
        )}
      </div>
    </Sheet>
  )
}
