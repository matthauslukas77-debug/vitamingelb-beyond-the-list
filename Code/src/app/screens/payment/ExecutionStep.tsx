import { useState } from 'react'
import { TODAY } from '../../../data/types'
import { formatMoney } from '../../../lib/money'
import { formatWeekdayDate } from '../../../lib/date'
import {
  INTERVAL_LABELS,
  bankingDays,
  isBankingDay,
  type Interval,
  type PaymentDraft,
} from '../../../domain/payment'
import { Icon } from '../../shell/Icon'
import { BottomSheet, Field, SheetOption, StepHead, Switch } from './parts'

/**
 * Schritt 3 — Ausführung.
 * Vorlage: IMG_5018.
 *
 * «Sofortige Ausführung» ist dort ausgegraut mit dem Hinweis
 * «Annahmeschlusszeiten überschritten» — und genau das gilt auch hier: Der
 * Demo-Tag ist Samstag, der 22.08.2026. Der Schalter ist also nicht dekorativ
 * abgeschaltet, sondern weil der Tag keiner ist, an dem eine Bank bucht.
 */
export function ExecutionStep({
  draft,
  onChange,
  onNext,
  onBack,
  onClose,
}: {
  draft: PaymentDraft
  onChange: (next: PaymentDraft) => void
  onNext: () => void
  onBack: () => void
  onClose: () => void
}) {
  const [sheet, setSheet] = useState<'date' | 'interval' | null>(null)
  const immediatePossible = isBankingDay(TODAY)
  const standing = draft.kind === 'standing'

  return (
    <div className="pay">
      {/* In IMG_5018 liegen Umschalter und Betragszeile noch auf der getönten
          Kopffläche — die Kante zum Rumpf verläuft erst darunter. */}
      <StepHead
        step={3}
        title="Ausführung"
        onBack={onBack}
        onClose={onClose}
        below={
          <>
            <div className="pay-seg" role="tablist" aria-label="Auftragsart">
              {([['single', 'Einzelauftrag'], ['standing', 'Dauerauftrag']] as const).map(([kind, label]) => (
                <button
                  key={kind}
                  className="pay-seg__option"
                  role="tab"
                  aria-selected={draft.kind === kind}
                  onClick={() => onChange({ ...draft, kind })}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="pay__sub" style={{ marginTop: 0 }}>
              <strong>{formatMoney(draft.amount, draft.currency, { sign: false })}</strong>{' '}
              an <strong>{draft.recipient.name}</strong>
            </p>
          </>
        }
      />

      <div className="pay__body">
        <Field
          label={standing ? 'Erste Ausführung' : 'Ausführungsdatum'}
          sub={<strong style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{formatWeekdayDate(draft.execution)}</strong>}
          right={<span className="pay-field__chevron pay-field__chevron--icon"><Icon name="calendar" size={24} /></span>}
          onClick={() => setSheet('date')}
        />

        {/* Nur beim Dauerauftrag: ohne Intervall wäre der Auftrag nicht
            beschrieben. Die Vorlage zeigt den Reiter, aber nicht seinen Inhalt. */}
        {standing && (
          <Field
            label="Intervall"
            sub={<strong style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{INTERVAL_LABELS[draft.interval]}</strong>}
            chevron="down"
            onClick={() => setSheet('interval')}
          />
        )}

        {!standing && (
          <Field
            label="Sofortige Ausführung"
            sub={immediatePossible ? 'Gutschrift innerhalb von Sekunden' : 'Annahmeschlusszeiten überschritten'}
            muted={!immediatePossible}
            right={
              <Switch
                label="Sofortige Ausführung"
                checked={immediatePossible && draft.execution === TODAY}
                disabled={!immediatePossible}
                onChange={(next) =>
                  onChange({ ...draft, execution: next ? TODAY : bankingDays(TODAY, 1)[0] })
                }
              />
            }
          />
        )}

        <Field
          label="Zahlungsbestätigung"
          sub="Keine zusätzlichen Gebühren"
          right={
            <Switch
              label="Zahlungsbestätigung"
              checked={draft.confirmation}
              onChange={(next) => onChange({ ...draft, confirmation: next })}
            />
          }
        />

        <input
          className="pay-input"
          value={draft.message}
          onChange={(event) => onChange({ ...draft, message: event.target.value })}
          placeholder="Mitteilung an Empfänger (optional)"
          maxLength={140}
        />
        <input
          className="pay-input"
          value={draft.bookingText}
          onChange={(event) => onChange({ ...draft, bookingText: event.target.value })}
          placeholder="Buchungstext für Sie (optional)"
          maxLength={70}
        />
      </div>

      <div className="pay__foot">
        <button className="pay-cta" onClick={onNext}>Weiter</button>
      </div>

      {sheet === 'date' && (
        <BottomSheet title="Ausführungsdatum" onClose={() => setSheet(null)}>
          {/* Nur Bankwerktage — an einem Samstag geht keine Zahlung raus. */}
          {bankingDays(TODAY, 8).map((day) => (
            <SheetOption
              key={day}
              label={formatWeekdayDate(day)}
              selected={day === draft.execution}
              onClick={() => {
                onChange({ ...draft, execution: day })
                setSheet(null)
              }}
            />
          ))}
        </BottomSheet>
      )}

      {sheet === 'interval' && (
        <BottomSheet title="Intervall" onClose={() => setSheet(null)}>
          {(Object.keys(INTERVAL_LABELS) as Interval[]).map((interval) => (
            <SheetOption
              key={interval}
              label={INTERVAL_LABELS[interval]}
              selected={interval === draft.interval}
              onClick={() => {
                onChange({ ...draft, interval })
                setSheet(null)
              }}
            />
          ))}
        </BottomSheet>
      )}
    </div>
  )
}
