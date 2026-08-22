import { useState } from 'react'
import { formatAmount, formatMoney } from '../../../lib/money'
import { centsToRaw, debitAccounts, pressKey, rawToCents, type PaymentDraft } from '../../../domain/payment'
import { useSession } from '../../session'
import { Icon } from '../../shell/Icon'
import { BottomSheet, Field, Keypad, SheetOption, StepHead } from './parts'

/**
 * Schritt 2 — Betrag.
 * Vorlage: IMG_5016 (Eingabe) und IMG_5017 (Kontoauswahl).
 *
 * Zwei Felder, eines davon aktiv: Solange der Ziffernblock offen ist, trägt die
 * Betragszeile die gelbe Linie; bei offener Kontoauswahl wandert sie zur
 * Kontozeile und der Pfeil dreht sich. Genau so unterscheiden sich die beiden
 * Vorlagen.
 */
export function AmountStep({
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
  const { persona, accountName } = useSession()
  /* Die rohe Eingabe steht neben dem Betrag im Entwurf: «20» soll «20» bleiben
     und erst als «20.00» erscheinen, wenn der Block zu ist. */
  const [raw, setRaw] = useState(() => (draft.amount > 0 ? centsToRaw(draft.amount) : ''))
  const [picking, setPicking] = useState(false)

  const accounts = debitAccounts(persona)
  const debit = accounts.find((account) => account.id === draft.debitAccountId) ?? accounts[0]

  const press = (key: string) => {
    const next = pressKey(raw, key)
    setRaw(next)
    onChange({ ...draft, amount: rawToCents(next) })
  }

  return (
    <div className="pay">
      <StepHead
        step={2}
        title="Betrag"
        sub={<>an <strong>{draft.recipient.name}</strong></>}
        onBack={onBack}
        onClose={onClose}
      />

      <div className="pay__body">
        <div className={'pay-amount pay-field' + (picking ? '' : ' pay-field--accent')} style={{ display: 'block' }}>
          <div className="pay-amount__row">
            <span className="pay-amount__cur">
              {draft.currency}
              <Icon name="chevronDown" size={18} />
            </span>
            <span className={'pay-amount__value num' + (raw === '' ? ' pay-amount__value--empty' : '')}>
              {picking || raw === '' ? formatAmount(draft.amount, { sign: false }) : raw}
            </span>
          </div>
        </div>

        <Field
          label={<>Belastung <strong>{accountName(debit)}</strong></>}
          sub={formatMoney(debit.balance, debit.currency)}
          chevron={picking ? 'up' : 'down'}
          accent={picking}
          onClick={() => setPicking(true)}
        />

        {/* In der Vorlage ein gelber Verweis ohne eigene Seite — der
            Zahlungspflichtige ist bei einer Zahlung auf eigene Rechnung leer. */}
        <button className="pay-optional">Zahlungspflichtigen erfassen (optional)</button>

        {/* In IMG_5016 steht der Knopf direkt unter dem Verweis, nicht am
            unteren Rand — darunter beginnt schon die Tastatur. */}
        <div className="pay__cta-inline">
          <button className="pay-cta" disabled={draft.amount <= 0} onClick={onNext}>Weiter</button>
        </div>
      </div>

      <Keypad onKey={press} />

      {picking && (
        <BottomSheet onClose={() => setPicking(false)} label="Belastungskonto">
          {accounts.map((account) => (
            <SheetOption
              key={account.id}
              label={accountName(account)}
              hint={<span className="num">{account.iban}</span>}
              amount={formatMoney(account.balance, account.currency)}
              selected={account.id === debit.id}
              onClick={() => {
                onChange({ ...draft, debitAccountId: account.id })
                setPicking(false)
              }}
            />
          ))}
        </BottomSheet>
      )}
    </div>
  )
}
