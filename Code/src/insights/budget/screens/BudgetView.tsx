import { useEffect, useMemo, useState } from 'react'
import { TODAY } from '../../../data/types'
import { formatAmount } from '../../../lib/money'
import { formatDate } from '../../../lib/date'
import { useSession } from '../../../app/session'
import { Icon } from '../../../app/shell/Icon'
import { deriveForPersona, type SlotEvidence } from '../derive'
import { amountOf, loadBudget, totalOf, type SavedBudget } from '../storage'
import { slotKey as keyOf } from '../slots'
import {
  DEFAULT_ANSWERS,
  benchmarkFor,
  budgetFromDerived,
  compare,
  type Benchmark,
  type CategoryComparison,
} from '../benchmark'
import { bottomTip, topTip, TIP_TEXT, type TipKey } from '../pf-model'
import { explainBudget, localSummary, type Explanation } from '../explain'
import { CATEGORIES, fieldLabel, slotKey, type CategoryKey } from '../slots'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Das Budget, wie es aus den Buchungen fällt.
 *
 * Im Nachbau steht an dieser Stelle «Keine aktiven Budgets — Budgets erfassen,
 * um Ausgaben in Bezug auf Kategorien oder Labels nachzuverfolgen». Das ist
 * ein Formular, das darauf wartet, dass jemand Zahlen abtippt, die die Bank
 * längst hat.
 *
 * Hier steht stattdessen das fertige Budget. Sechs Kategorien, neunzehn
 * Detailfelder, jede Zahl mit dem Beleg daneben — und daneben der Richtwert
 * des PostFinance-Budgetrechners für denselben Haushalt.
 *
 * Zwei Zustände, und der Unterschied ist wichtig:
 *
 *   **Noch kein Budget gesetzt** — dann steht hier der *Vorschlag* aus den
 *   Buchungen, klar als solcher gekennzeichnet, mit dem Einstieg in den
 *   Wizard.
 *   **Budget gesetzt** — dann steht hier *dein* Budget, und die abgeleiteten
 *   Zahlen daneben zeigen, wie nah du drankommst.
 *
 * Der Nachbau zeigt an dieser Stelle «Keine aktiven Budgets — Budgets
 * erfassen, um Ausgaben in Bezug auf Kategorien oder Labels nachzuverfolgen»:
 * ein Formular, das darauf wartet, dass jemand Zahlen abtippt, die die Bank
 * längst hat.
 */

/** Der Richtwert braucht die 56 KB Messdaten — deshalb kommt er nachgeladen. */
type Loaded = { benchmark: Benchmark; rows: CategoryComparison[] }

function chf(rappen: number, opts?: { sign?: boolean }): string {
  return formatAmount(rappen, { sign: opts?.sign ?? false })
}

/**
 * Der Balken einer Kategorie: dein Betrag als Füllung, der Richtwert als
 * Marke. Beide auf derselben Skala über alle Kategorien — sonst sieht der
 * kleinste Posten so breit aus wie der grösste.
 */
function CategoryBar({ actual, benchmark, scale }: { actual: number; benchmark: number; scale: number }) {
  const width = Math.min(100, (actual / scale) * 100)
  const mark = Math.min(100, (benchmark / scale) * 100)
  const over = actual > benchmark

  return (
    <div className="bud-bar" aria-hidden>
      <div
        className={'bud-bar__fill' + (over ? ' bud-bar__fill--over' : '')}
        style={{ width: `${width}%` }}
      />
      {benchmark > 0 && <span className="bud-bar__mark" style={{ left: `${mark}%` }} />}
    </div>
  )
}

/** Eine Zeile pro Detailfeld — mit dem, worauf die Zahl beruht. */
function FieldRow({
  evidence,
  months,
  planned,
  edited,
}: {
  evidence: SlotEvidence
  months: number
  /** Was budgetiert ist. Ohne gesetztes Budget derselbe Wert wie abgeleitet. */
  planned: number
  edited: boolean
}) {
  return (
    <div className="bud-field">
      <span className="bud-field__main">
        <span className="bud-field__label">{fieldLabel(evidence.slot)}</span>
        <span className="bud-field__why">
          {evidence.count > 0 && `${evidence.count} ${evidence.count === 1 ? 'Buchung' : 'Buchungen'} · `}
          {evidence.smoothedOver
            ? `über ${evidence.smoothedOver} Monate gemittelt`
            : `${evidence.monthsSeen}/${months} Monate`}
          {evidence.recurring && ' · Fixkosten'}
          {evidence.sources.length > 0 && ` · ${evidence.sources.join(', ')}`}
        </span>
        {edited && <span className="bud-field__set">von dir gesetzt</span>}
        {!edited && evidence.reviewReason && (
          <span className="bud-field__review">
            <Icon name="support" size={13} />
            {evidence.reviewReason} — bitte bestätigen
          </span>
        )}
      </span>
      <span className="bud-field__amount num">
        {chf(planned)}
        {/* Weicht das Budget vom Gemessenen ab, steht beides da. */}
        {planned !== evidence.monthly && (
          <span className="bud-field__was">gemessen {chf(evidence.monthly)}</span>
        )}
      </span>
    </div>
  )
}

function Tip({ tip }: { tip: TipKey }) {
  const { title, body } = TIP_TEXT[tip]
  return (
    <div className="bud-tip">
      <span className="bud-tip__icon"><Icon name="support" size={18} /></span>
      <span>
        <span className="bud-tip__title">{title}</span>
        <span className="bud-tip__body">{body}</span>
      </span>
    </div>
  )
}

export function BudgetView() {
  const { persona, push, stack } = useSession()
  const [yearView, setYearView] = useState(false)
  const [open, setOpen] = useState<CategoryKey | null>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [explanation, setExplanation] = useState<Explanation | null>(null)

  const derived = useMemo(
    () => deriveForPersona(persona, { today: TODAY, months: 12 }),
    [persona],
  )

  /* Neu lesen, sobald der Wizard zugeht: `stack` schrumpft dabei, und genau
     das ist das Signal, dass gespeichert worden sein könnte. */
  const [saved, setSaved] = useState<SavedBudget | null>(() => loadBudget(persona.id))
  useEffect(() => setSaved(loadBudget(persona.id)), [persona.id, stack.length])

  /* Wo ein Budget gesetzt ist, gilt es. Sonst der Vorschlag aus den Buchungen. */
  const plannedOf = (key: string) =>
    saved ? amountOf(saved, key) : (derived.slots.find((entry) => keyOf(entry.slot) === key)?.monthly ?? 0)
  const plannedCategory = (category: CategoryKey) =>
    derived.slots
      .filter((entry) => entry.slot.category === category)
      .reduce((total, entry) => total + plannedOf(keyOf(entry.slot)), 0)
  const plannedTotal = saved ? totalOf(saved) : derived.expensesMonth
  const plannedSurplus = derived.incomeMonth - plannedTotal

  /* Richtwert und Satz kommen beide nach. Bis dahin steht das Ist schon da —
     es braucht weder Netz noch Nachladen. */
  useEffect(() => {
    let current = true
    benchmarkFor(persona, derived, DEFAULT_ANSWERS, Number(TODAY.slice(0, 4)))
      .then(async (benchmark) => {
        if (!current) return
        const rows = compare(derived, benchmark)
        setLoaded({ benchmark, rows })
        /* Zuerst der gerechnete Satz, dann — wenn Apertus antwortet — seiner. */
        setExplanation({ text: localSummary(derived, rows), source: 'gerechnet' })
        const spoken = await explainBudget(derived, rows)
        if (current) setExplanation(spoken)
      })
      .catch(() => {
        /* Ohne Richtwert bleibt das Ist stehen. Das ist die wichtigere Hälfte. */
      })
    return () => {
      current = false
    }
  }, [persona, derived])

  const factor = yearView ? 12 : 1
  const rows = loaded?.rows
  const scale = Math.max(
    ...CATEGORIES.map((category) =>
      Math.max(
        derived.categoryTotals[category.key],
        rows?.find((row) => row.key === category.key)?.benchmark ?? 0,
      ),
    ),
    1,
  )

  const budget = budgetFromDerived(derived)
  const tips = [topTip(budget), bottomTip(budget)].filter((tip): tip is TipKey => tip !== null)

  return (
    <div className="screen__inner bud">
      {/* Monat oder Jahr — im Original zwei getrennte Kartensätze, hier eine
          Ansicht und ein Faktor. Die Zahlen bleiben dieselben. */}
      <div className="bud-toggle" role="group" aria-label="Zeitraum">
        <button aria-pressed={!yearView} onClick={() => setYearView(false)}>pro Monat</button>
        <button aria-pressed={yearView} onClick={() => setYearView(true)}>pro Jahr</button>
      </div>

      <section className="card bud-head">
        <div className="bud-head__line">
          <span>Einnahmen</span>
          <span className="num">{chf(derived.incomeMonth * factor)}</span>
        </div>
        <div className="bud-head__line">
          <span>{saved ? 'Budgetiert' : 'Ausgaben'}</span>
          <span className="num">{chf(plannedTotal * factor)}</span>
        </div>
        {/* Wo ein Budget gesetzt ist, steht das Ist daneben: Der Vergleich mit
            sich selbst ist der, der zählt. */}
        {saved && plannedTotal !== derived.expensesMonth && (
          <div className="bud-head__line bud-head__line--faint">
            <span>tatsächlich ausgegeben</span>
            <span className="num">{chf(derived.expensesMonth * factor)}</span>
          </div>
        )}
        <div className={'bud-head__line bud-head__line--total' + (plannedSurplus < 0 ? ' is-negative' : '')}>
          <span>{plannedSurplus < 0 ? 'Ausgabenüberschuss' : 'Einkommensüberschuss'}</span>
          <span className="num">{chf(plannedSurplus * factor, { sign: true })}</span>
        </div>

        {/* Die Zahl, die es heute nirgends gibt: Überschuss ist nicht dasselbe
            wie gespart. Der Rest bleibt unbemerkt auf dem Konto liegen. */}
        {derived.actualSavedMonth > 0 && (
          <div className="bud-head__note">
            davon wirklich aufs Sparkonto: <strong className="num">{chf(derived.actualSavedMonth * factor)}</strong>
          </div>
        )}
      </section>

      {/* Der Einstieg in den Wizard. Ohne gesetztes Budget ist er die Aussage
          des Bildschirms, mit gesetztem eine ruhige Zeile am Rand. */}
      <button
        className={'bud-cta' + (saved ? ' bud-cta--quiet' : '')}
        onClick={() => push({ name: 'budgetWizard' })}
      >
        <span className="bud-cta__main">
          <span className="bud-cta__title">
            {saved ? 'Budget anpassen' : 'Budget übernehmen und anpassen'}
          </span>
          <span className="bud-cta__sub">
            {saved
              ? `zuletzt geändert am ${formatDate(saved.savedAt)}${saved.edited.length > 0 ? ` · ${saved.edited.length} ${saved.edited.length === 1 ? 'Feld' : 'Felder'} von dir gesetzt` : ''}`
              : `Zwei Fragen, dann stehen ${derived.filledSlots} von 19 Feldern schon drin`}
          </span>
        </span>
        <Icon name="chevronRight" size={18} />
      </button>

      {explanation && (
        <section className="card bud-say">
          <p className="bud-say__text">{explanation.text}</p>
          <span className={'bud-say__badge' + (explanation.source === 'apertus' ? ' is-model' : '')}>
            {explanation.source === 'apertus' ? 'formuliert von Apertus' : 'gerechnet'}
          </span>
        </section>
      )}

      <div className="section-head">
        <span className="section-head__title">
          {rows ? 'Dein Ist gegen einen vergleichbaren Haushalt' : 'Deine Ausgaben'}
        </span>
        <span className="section-head__value">{derived.filledSlots}/19 Felder</span>
      </div>

      <section className="card">
        {CATEGORIES.map((category) => {
          const actual = plannedCategory(category.key)
          const row = rows?.find((entry) => entry.key === category.key)
          const fields = derived.slots.filter((entry) => entry.slot.category === category.key)
          const isOpen = open === category.key

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
                  <CategoryBar actual={actual} benchmark={row?.benchmark ?? 0} scale={scale} />
                  {row && (
                    <span className="bud-cat__delta">
                      Richtwert {chf(row.benchmark * factor)} ·{' '}
                      <strong className={row.delta > 0 ? 'is-over' : 'is-under'}>
                        {chf(row.delta * factor, { sign: true })}
                      </strong>
                    </span>
                  )}
                </span>
                <span className="bud-cat__amount num">{chf(actual * factor)}</span>
                <span className={'bud-cat__chevron' + (isOpen ? ' is-open' : '')}>
                  <Icon name="chevronDown" size={16} />
                </span>
              </button>

              {isOpen && (
                <div className="bud-cat__fields">
                  {fields.map((evidence) => (
                    <FieldRow
                      key={slotKey(evidence.slot)}
                      evidence={evidence}
                      months={derived.months}
                      planned={plannedOf(slotKey(evidence.slot))}
                      edited={saved?.edited.includes(slotKey(evidence.slot)) ?? false}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </section>

      {tips.map((tip) => <Tip key={tip} tip={tip} />)}

      {/* Was wir nicht wissen, steht da — statt still geraten zu werden. */}
      <div className="section-head">
        <span className="section-head__title">Woher diese Zahlen kommen</span>
      </div>
      <section className="card bud-src">
        <p>
          {derived.months} Monate Buchungen, {derived.from.slice(0, 7)} bis {derived.to.slice(0, 7)}.{' '}
          <strong>{Math.round(derived.coverage.share * 100)} %</strong> der Ausgabenfranken sind
          sicher zugeordnet, {chf(derived.coverage.review)} pro Monat brauchen eine Bestätigung.
        </p>
        {derived.flow.avoidedDoubleCount > 0 && (
          <p>
            <strong className="num">{chf(Math.round(derived.flow.avoidedDoubleCount / derived.months))}</strong>{' '}
            pro Monat sind bewusst <em>nicht</em> als Ausgabe gezählt: Überträge auf eigene Konten,
            Kartenabrechnungen und zurückerhaltenes TWINT-Geld. Die heutige Auswertung zählt sie mit.
          </p>
        )}
        {derived.detectedCanton && (
          <p>
            Steuerort <strong>{derived.detectedCanton.canton}</strong> — erkannt aus «
            {derived.detectedCanton.evidence}».
          </p>
        )}
        {derived.openQuestions.map((question) => (
          <p key={question.key} className="bud-src__q">
            <strong>{question.question}</strong>
            <span>{question.why}</span>
          </p>
        ))}
      </section>
    </div>
  )
}
