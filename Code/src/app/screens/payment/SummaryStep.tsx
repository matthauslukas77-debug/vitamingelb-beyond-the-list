import { formatDate } from '../../../lib/date'
import { formatMoney } from '../../../lib/money'
import { INTERVAL_LABELS, debitAccounts, type PaymentDraft } from '../../../domain/payment'
import { useSession } from '../../session'
import { Icon } from '../../shell/Icon'
import { SlideToConfirm, StepHead } from './parts'

/**
 * Schritt 4 — Zusammenfassung.
 * Vorlage: IMG_5019 und IMG_5020.
 *
 * Drei Blöcke, jeder mit einem Stift zurück zum passenden Schritt. Unten keine
 * Schaltfläche, sondern die Wischgeste: In der Vorlage wird der weisse Knauf
 * nach rechts gezogen, und erst am Anschlag geht die Zahlung raus.
 */

function Block({
  label,
  onEdit,
  children,
}: {
  label: string
  onEdit?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="pay-block">
      <div className="pay-block__label">{label}</div>
      <div className="pay-block__body">
        <span className="pay-block__lines">{children}</span>
        {onEdit && (
          <button className="pay-block__edit" onClick={onEdit} aria-label={`${label} bearbeiten`}>
            <Icon name="pencil" size={22} />
          </button>
        )}
      </div>
    </div>
  )
}

export function SummaryStep({
  draft,
  onEdit,
  onConfirm,
  onBack,
  onClose,
}: {
  draft: PaymentDraft
  /** Zurück auf Schritt 1, 2 oder 3 — die drei Stifte der Vorlage. */
  onEdit: (step: 1 | 2 | 3) => void
  onConfirm: () => void
  onBack: () => void
  onClose: () => void
}) {
  const { persona, accountName } = useSession()
  const debit =
    debitAccounts(persona).find((account) => account.id === draft.debitAccountId) ??
    debitAccounts(persona)[0]
  const { recipient } = draft

  return (
    <div className="pay">
      <StepHead
        step={4}
        title="Zusammenfassung"
        sub={
          <>
            <strong>{formatMoney(draft.amount, draft.currency, { sign: false })}</strong> an{' '}
            <strong>{recipient.name}</strong>
          </>
        }
        onBack={onBack}
        onClose={onClose}
      />

      <div className="pay__body">
        <Block label="Empfänger" onEdit={() => onEdit(1)}>
          <span className="is-strong">{recipient.name}</span>
          <span>{recipient.address.street}</span>
          <span>{recipient.address.place}</span>
          <span>{recipient.address.country}</span>
          <span className="num">{recipient.iban}</span>
          <span>{recipient.bank.name}</span>
          {recipient.bank.place && <span>{recipient.bank.place}</span>}
          <span>{recipient.bank.country}</span>
        </Block>

        <Block label="Betrag" onEdit={() => onEdit(2)}>
          <span className="pay-block__total num">
            {formatMoney(draft.amount, draft.currency, { sign: false })}
          </span>
          <span>
            Belastung <span className="is-strong" style={{ display: 'inline' }}>{accountName(debit)}</span>{' '}
            ({formatMoney(debit.balance, debit.currency)})
          </span>
          <span className="is-muted num">{debit.iban}</span>
        </Block>

        <Block label="Ausführung" onEdit={() => onEdit(3)}>
          <span>
            {draft.kind === 'standing' ? 'Erste Ausführung ' : 'Ausführungsdatum '}
            <span className="is-strong" style={{ display: 'inline' }}>{formatDate(draft.execution)}</span>
          </span>
          {draft.kind === 'standing' && (
            <span>
              Intervall{' '}
              <span className="is-strong" style={{ display: 'inline' }}>
                {INTERVAL_LABELS[draft.interval]}
              </span>
            </span>
          )}
          {draft.message.trim() !== '' && <span className="is-muted">{draft.message}</span>}
        </Block>
      </div>

      <div className="pay__foot">
        <SlideToConfirm label="Ausführen" onConfirm={onConfirm} />
      </div>
    </div>
  )
}
