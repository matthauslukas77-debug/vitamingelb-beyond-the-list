import { useEffect, useMemo, useState } from 'react'
import { TODAY } from '../../../data/types'
import { formatAmount } from '../../../lib/money'
import { formatMonth } from '../../../lib/date'
import { CATEGORY_KEYS } from '../slots'
import { useSession } from '../../../app/session'
import { Icon } from '../../../app/shell/Icon'
import { Sheet } from '../../../app/shell/Sheet'
import {
  deriveForPersona,
  monthProgress,
  monthStart,
  spendByCategory,
  type SlotEvidence,
} from '../derive'
import { categoryHistory, projectedMonth, typicalMonth } from '../history'
import { loadAssignments } from '../assign'
import { loadMarkings, saveMarkings, withMarking, type Marking } from '../markings'
import { BubbleField } from '../ui/BubbleField'
import { HistoryBars } from '../ui/HistoryBars'
import { amountOf, loadBudget, type SavedBudget } from '../storage'
import { categoryDef, fieldLabel, slotKey, type CategoryKey } from '../slots'
import { outliersIn, type Outlier } from '../outliers'
import { ClassifySheet } from '../ui/ClassifySheet'
import { merchantName } from '../merchant'
import { reachableReserve } from '../forecast'
import { formatDate } from '../../../lib/date'
import {
  DEFAULT_ANSWERS,
  benchmarkFor,
  compare,
  type CategoryComparison,
} from '../benchmark'
import '../budget.css'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Die Detailseite einer Budgetkategorie.
 *
 * Die Übersicht beantwortet eine Frage — «wie stehe ich diesen Monat?» — und
 * legt damit sofort die nächste an: **warum?** Bis hierher endete die Anzeige
 * an dieser Stelle. Man konnte eine Kategorie aufklappen und neunzehn Zeilen
 * mit Beträgen lesen, in derselben Liste, in der schon alles andere stand.
 *
 * Diese Seite ist die Antwort auf «warum», und sie besteht aus vier Sätzen:
 *
 *   **Wo stehst du** — dieselbe Blase, gross, mit derselben Zahl darin. Sie
 *   ist bewusst dieselbe Grafik und nicht eine zweite Darstellung derselben
 *   Sache: Wer von der Übersicht hierher tippt, soll wiedererkennen, worauf
 *   er getippt hat.
 *
 *   **Ist das üblich** — zwölf Monate als Balken. Ohne diese Zeile ist jede
 *   Überschreitung eine Behauptung. Ein roter Monat neben elf ruhigen ist ein
 *   Ausrutscher, ein roter neben elf roten ein falsch gesetztes Budget — und
 *   die Handlung daraus ist in beiden Fällen eine andere.
 *
 *   **Was sagen andere** — der Richtwert des PostFinance-Budgetrechners für
 *   einen vergleichbaren Haushalt, hier und nicht auf der Übersicht: Auf der
 *   Übersicht stünde er sechsmal und wäre sechsmal dasselbe Argument.
 *
 *   **Woraus besteht es** — die Detailfelder mit dem Beleg daneben. Das ist
 *   der Inhalt, der bisher im Akkordeon steckte, mit dem Platz, den er
 *   braucht.
 */

function chf(rappen: number, opts?: { sign?: boolean }): string {
  return formatAmount(rappen, { sign: opts?.sign ?? false })
}

/**
 * Ganze Franken — für die Verlaufskarte.
 *
 * Auf einer Achse und in einem Satz über zwölf Monate kosten die Rappen von
 * «1'369.92» drei Zeichen und tragen nichts: Wer wissen will, ob dieser Monat
 * aus der Reihe fällt, braucht keine Rappen. Im Kopf der Seite und in der
 * Feldliste stehen sie weiterhin — dort ist es eine Abrechnung und keine
 * Tendenz.
 */
function chfRound(rappen: number): string {
  return formatAmount(Math.round(rappen / 100) * 100, { sign: false }).replace('.00', '')
}

/** Eine Zeile pro Detailfeld — mit dem, worauf die Zahl beruht. */
function Field({
  evidence,
  months,
  planned,
  edited,
}: {
  evidence: SlotEvidence
  months: number
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
        {planned !== evidence.monthly && (
          <span className="bud-field__was">gemessen {chf(evidence.monthly)}</span>
        )}
      </span>
    </div>
  )
}

/**
 * Eine auffällige Buchung — mit der Frage daran.
 *
 * Der Betrag steht gross, weil er der Grund ist, warum die Blase darüber
 * aussieht, wie sie aussieht. Solange die Frage offen ist, ist die Zeile ein
 * Knopf mit der Frage im Klartext; ist sie beantwortet, steht die Antwort da
 * und lässt sich antippen, um sie zu ändern. Eine Einordnung, die man nicht
 * wiederfindet, ist eine Falltür.
 */
function OutlierRow({ entry, onAsk }: { entry: Outlier; onAsk: () => void }) {
  const answered = entry.marking.kind !== 'normal'
  const answer =
    entry.marking.kind === 'extraordinary'
      ? 'einmalig — zählt nicht gegen das Budget'
      : entry.marking.kind === 'spread'
        ? `auf ${entry.marking.months ?? 12} Monate verteilt`
        : ''

  return (
    <button className={'bud-out' + (answered ? ' bud-out--answered' : '')} onClick={onAsk}>
      <span className="bud-out__main">
        <span className="bud-out__who">{merchantName(entry.tx)}</span>
        <span className="bud-out__when">{formatDate(entry.tx.date)}</span>
        <span className="bud-out__q">
          {answered ? (
            <>
              <Icon name="check" size={13} />
              {answer}
            </>
          ) : (
            <>
              <Icon name="support" size={13} />
              Regelmässig oder eine Ausnahme?
            </>
          )}
        </span>
      </span>
      <span className="bud-out__amount num">{chf(entry.amount)}</span>
      <span className="bud-out__go">
        <Icon name="chevronRight" size={16} />
      </span>
    </button>
  )
}

export function CategoryDetail({ category }: { category: CategoryKey }) {
  const { persona, pop, push, stack } = useSession()
  const definition = categoryDef(category)
  const [row, setRow] = useState<CategoryComparison | null>(null)
  /** Für welche Buchung das Einordnungsblatt offen ist. */
  const [asking, setAsking] = useState<string | null>(null)

  /* Wie in der Übersicht neu lesen, sobald ein darübergelegter Bildschirm
     zugeht — sonst stünde nach dem Wizard hier noch das alte Budget. */
  const [saved, setSaved] = useState<SavedBudget | null>(() => loadBudget(persona.id))
  const [assignments, setAssignments] = useState(() => loadAssignments(persona.id))
  /* Die Einordnungen. Sie werden hier nicht nur gelesen, sondern auch gesetzt —
     diese Seite ist der Ort, an dem die Frage gestellt wird. */
  const [markings, setMarkings] = useState(() => loadMarkings(persona.id))
  useEffect(() => {
    setSaved(loadBudget(persona.id))
    setAssignments(loadAssignments(persona.id))
    setMarkings(loadMarkings(persona.id))
  }, [persona.id, stack.length])

  function classify(transactionId: string, marking: Marking) {
    const next = withMarking(markings, transactionId, marking)
    setMarkings(next)
    saveMarkings(persona.id, next)
    setAsking(null)
  }

  const derived = useMemo(
    () => deriveForPersona(persona, { today: TODAY, months: 12, assignments, markings }),
    [persona, assignments, markings],
  )

  const fields = derived.slots.filter((entry) => entry.slot.category === category)
  const plannedOf = (key: string) =>
    saved ? amountOf(saved, key) : (derived.slots.find((entry) => slotKey(entry.slot) === key)?.monthly ?? 0)
  const budget = fields.reduce((total, entry) => total + plannedOf(slotKey(entry.slot)), 0)

  const spent = useMemo(
    () =>
      spendByCategory(persona.transactions, persona.accounts, {
        from: monthStart(TODAY),
        to: TODAY,
        ownName: persona.name,
        assignments,
        markings,
      })[category],
    [persona, assignments, markings, category],
  )

  const history = useMemo(
    () => categoryHistory(persona, category, { today: TODAY, assignments, markings }),
    [persona, category, assignments, markings],
  )
  const typical = typicalMonth(history)

  const progress = monthProgress(TODAY)
  const projected = projectedMonth(spent, progress)
  const rest = budget - spent

  /* Die auffälligen Buchungen dieses Monats in dieser Kategorie.
     Die Schwelle braucht ein Budget je Kategorie — hier das geplante, damit
     die Frage an derselben Zahl hängt, die oben in der Blase steht. */
  const budgetPerCategory = useMemo(() => {
    const totals = Object.fromEntries(CATEGORY_KEYS.map((key) => [key, 0])) as Record<CategoryKey, number>
    for (const entry of derived.slots) {
      totals[entry.slot.category] += plannedOf(slotKey(entry.slot))
    }
    return totals
  }, [derived, saved])

  const outliers = useMemo(
    () =>
      outliersIn(persona.transactions, persona.accounts, {
        from: monthStart(TODAY),
        to: TODAY,
        ownName: persona.name,
        markings,
        assignments,
        budget: budgetPerCategory,
        category,
      }),
    [persona, markings, assignments, budgetPerCategory, category],
  )

  const open = outliers.filter((entry) => entry.marking.kind === 'normal')
  const settled = outliers.filter((entry) => entry.marking.kind !== 'normal')
  /* Was in diesem Monat als ausserordentlich eingeordnet ist — es zählt nicht
     gegen das Budget, aber es ist bezahlt worden. Bezahlt aus der Reserve. */
  const fromReserve = settled
    .filter((entry) => entry.marking.kind === 'extraordinary')
    .reduce((total, entry) => total + entry.amount, 0)
  const reserve = reachableReserve(persona.accounts)

  const asked = asking ? outliers.find((entry) => entry.tx.id === asking) : undefined

  /* Was bis heute in einem üblichen Monat weg wäre.
     Ohne diese Zeile vergleicht die Karte einen angefangenen Monat mit elf
     ganzen und findet ihn regelmässig unterdurchschnittlich — am 8. ist jeder
     Monat ein guter Monat. Dieselbe Überlegung wie der Strichring in der
     Blase, nur als Satz. */
  const expected = Math.round(typical * progress)
  const aheadOf = spent - expected

  /* Der Richtwert kommt nachgeladen — er braucht die 56 KB Messdaten. Bis
     dahin steht alles andere schon da. */
  useEffect(() => {
    let current = true
    benchmarkFor(persona, derived, DEFAULT_ANSWERS, Number(TODAY.slice(0, 4)))
      .then((benchmark) => {
        if (!current) return
        setRow(compare(derived, benchmark).find((entry) => entry.key === category) ?? null)
      })
      .catch(() => {
        /* Ohne Richtwert bleibt der Rest der Seite stehen. */
      })
    return () => {
      current = false
    }
  }, [persona, derived, category])

  return (
    <Sheet title={definition.title} onBack={pop}>
      <div className="screen__inner bud bud-detail">
        <section className="bud-detail__hero">
          <BubbleField bubbles={[{ key: category, budget, spent }]} progress={progress} />
          <div className="bud-detail__figures">
            <span className="bud-detail__spent num">{chf(spent)}</span>
            <span className="bud-detail__of">
              {budget > 0 ? `von ${chf(budget)} budgetiert` : 'kein Budget gesetzt'}
            </span>
            {budget > 0 && (
              <span className={'bud-detail__rest' + (rest < 0 ? ' is-over' : '')}>
                {rest >= 0 ? `noch ${chf(rest)} bis Monatsende` : `${chf(-rest)} über dem Budget`}
              </span>
            )}
          </div>
        </section>

        {/* Die Hochrechnung — die Zahl, die es heute nirgends gibt. Nur wo sie
            etwas heisst: Bei Fixkosten, die am 1. bezahlt sind, wäre «bei
            diesem Tempo» eine Rechnung auf eine Wiederholung, die nicht kommt.
            Deshalb steht sie erst ab der Monatsmitte und nur, solange nicht
            ohnehin schon alles ausgegeben ist. */}
        {budget > 0 && progress > 0.4 && progress < 1 && spent < budget && (
          <p className="bud-detail__pace">
            Bei diesem Tempo landest du Ende {formatMonth(TODAY).split(' ')[0]} bei{' '}
            <strong className="num">{chf(projected)}</strong>
            {projected > budget
              ? ` — ${chf(projected - budget)} über dem Budget.`
              : ` — ${chf(budget - projected)} darunter.`}
          </p>
        )}

        {/* Die Frage, ohne die das Budget nichts wert ist.
            Brunos Wohnblase steht auf 920 %, weil eine einzige Buchung über
            CHF 12'000 darin liegt. Eine Anzeige, die 920 % zeigt, ist kein
            Überblick — man sieht sie weg. Die Frage steht deshalb hier, direkt
            unter der Zahl, die sie aufwirft, und nicht nur auf dem
            Signale-Bildschirm. */}
        {open.length > 0 && (
          <>
            <div className="section-head">
              <span className="section-head__title">
                {open.length === 1 ? 'Eine Buchung sprengt den Monat' : `${open.length} Buchungen sprengen den Monat`}
              </span>
            </div>
            <section className="card bud-outs">
              {open.map((entry) => (
                <OutlierRow key={entry.tx.id} entry={entry} onAsk={() => setAsking(entry.tx.id)} />
              ))}
            </section>
          </>
        )}

        {settled.length > 0 && (
          <>
            <div className="section-head">
              <span className="section-head__title">Von dir eingeordnet</span>
            </div>
            <section className="card bud-outs">
              {settled.map((entry) => (
                <OutlierRow key={entry.tx.id} entry={entry} onAsk={() => setAsking(entry.tx.id)} />
              ))}
            </section>

            {/* Wo das Geld stattdessen herkam. Das ist der Punkt, an dem die
                Einordnung ehrlich bleibt: Die CHF 12'000 verschwinden nicht,
                sie stehen nur nicht mehr im Monatsbudget — bezahlt sind sie
                aus der Reserve, und die ist dadurch kleiner. Ein Budget, das
                das verschweigt, hätte die Zahl bloss versteckt. */}
            {fromReserve > 0 && (
              <p className="bud-detail__reserve">
                <strong className="num">{chf(fromReserve)}</strong> sind als einmalig eingeordnet und
                zählen nicht gegen das Monatsbudget — bezahlt wurden sie trotzdem.{' '}
                {reserve > 0 ? (
                  <>
                    Gedeckt aus der Reserve: Auf deinen Sparkonten liegen{' '}
                    <strong className="num">{chf(reserve)}</strong>.
                  </>
                ) : (
                  <>Eine Reserve, aus der das gedeckt wäre, ist auf keinem deiner Konten.</>
                )}
              </p>
            )}
          </>
        )}

        <div className="section-head">
          <span className="section-head__title">Die letzten zwölf Monate</span>
        </div>
        <section className="card bud-detail__history">
          <HistoryBars points={history} typical={typical} format={chfRound} />
          {typical > 0 && (
            <p className="bud-detail__note">
              Nach {Math.round(progress * 100)} % des Monats wären in einem üblichen Monat{' '}
              <strong className="num">{chfRound(expected)}</strong> weg.{' '}
              {Math.abs(aheadOf) <= expected * 0.15 ? (
                <>Du liegst genau auf diesem Tempo.</>
              ) : aheadOf > 0 ? (
                <>
                  Du bist <strong className="num">{chfRound(aheadOf)}</strong> darüber.
                </>
              ) : (
                <>
                  Du bist <strong className="num">{chfRound(-aheadOf)}</strong> darunter.
                </>
              )}
            </p>
          )}
        </section>

        {row && (
          <>
            <div className="section-head">
              <span className="section-head__title">Ein vergleichbarer Haushalt</span>
            </div>
            <section className="card bud-detail__bench">
              <div className="bud-head__line">
                <span>Dein Budget</span>
                <span className="num">{chf(row.actual)}</span>
              </div>
              <div className="bud-head__line">
                <span>Richtwert PostFinance</span>
                <span className="num">{chf(row.benchmark)}</span>
              </div>
              <div className="bud-head__line bud-head__line--total">
                <span>{row.delta > 0 ? 'Du zahlst mehr' : 'Du zahlst weniger'}</span>
                <span className="num">{chf(Math.abs(row.delta))}</span>
              </div>
            </section>
          </>
        )}

        <div className="section-head">
          <span className="section-head__title">Woraus sich das zusammensetzt</span>
          <span className="section-head__value">
            {fields.filter((entry) => entry.monthly > 0).length}/{fields.length} Felder
          </span>
        </div>
        <section className="card bud-detail__fields">
          {fields.map((evidence) => (
            <Field
              key={slotKey(evidence.slot)}
              evidence={evidence}
              months={derived.months}
              planned={plannedOf(slotKey(evidence.slot))}
              edited={saved?.edited.includes(slotKey(evidence.slot)) ?? false}
            />
          ))}
        </section>

        <button className="bud-cta bud-cta--quiet" onClick={() => push({ name: 'budgetWizard' })}>
          <span className="bud-cta__main">
            <span className="bud-cta__title">Budget anpassen</span>
            <span className="bud-cta__sub">
              {definition.fields.length === 1
                ? 'Das Feld dieser Kategorie im Wizard ändern'
                : `Die ${definition.fields.length} Felder dieser Kategorie im Wizard ändern`}
            </span>
          </span>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>

      {asked && (
        <ClassifySheet
          amount={asked.amount}
          date={asked.tx.date}
          current={asked.marking}
          onChoose={(marking) => classify(asked.tx.id, marking)}
          onClose={() => setAsking(null)}
        />
      )}
    </Sheet>
  )
}
