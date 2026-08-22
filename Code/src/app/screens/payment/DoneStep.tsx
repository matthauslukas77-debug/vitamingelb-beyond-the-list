import { formatDate } from '../../../lib/date'
import { formatMoney } from '../../../lib/money'
import { type PaymentDraft } from '../../../domain/payment'
import { Icon } from '../../shell/Icon'

/**
 * Der Abschluss. Nicht in den Vorlagen — die enden bei der Wischgeste
 * (IMG_5020). Ohne ihn hätte der Fluss keine Antwort, und der erfasste Auftrag
 * bliebe unsichtbar. Deshalb hier eine Bestätigung, die auf die Liste zeigt, in
 * der der Auftrag jetzt wirklich steht.
 */
export function DoneStep({ draft, onFinish }: { draft: PaymentDraft; onFinish: () => void }) {
  const standing = draft.kind === 'standing'
  return (
    <div className="pay">
      <div className="pay-done">
        <span className="pay-done__mark"><Icon name="check" size={40} strokeWidth={2.2} /></span>
        <h1 className="pay-done__title">
          {standing ? 'Dauerauftrag erfasst' : 'Auftrag erfasst'}
        </h1>
        <p className="pay-done__text">
          <strong>{formatMoney(draft.amount, draft.currency, { sign: false })}</strong> an{' '}
          <strong>{draft.recipient.name}</strong>
        </p>
        <p className="pay-done__text">
          {standing ? 'Erste Ausführung am ' : 'Ausführung am '}
          <strong>{formatDate(draft.execution)}</strong>.<br />
          Der Auftrag steht ab jetzt unter{' '}
          <strong>{standing ? 'Daueraufträge' : 'Pendente Aufträge'}</strong>.
        </p>
      </div>

      <div className="pay__foot">
        <button className="pay-cta" onClick={onFinish}>Fertig</button>
      </div>
    </div>
  )
}
