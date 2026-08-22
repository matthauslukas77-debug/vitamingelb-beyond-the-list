import { useMemo, useState } from 'react'
import { formatDate } from '../../../lib/date'
import { formatMoney } from '../../../lib/money'
import { filterRecipients, recommendedRecipients, type Recipient } from '../../../domain/payment'
import { useSession } from '../../session'
import { Icon } from '../../shell/Icon'
import { BottomSheet, SheetOption } from './parts'

/**
 * Schritt 1 — Empfänger.
 * Vorlage: IMG_5014 (Liste) und IMG_5015 (Auswahlblatt).
 *
 * Die «Empfohlenen Empfänger» sind keine Erfindung: Es sind die Gegenparteien,
 * die im Adressbuch der Persona stehen, und die eigenen PostFinance-Konten.
 * Ganz unten steht deshalb die Person selbst — in der Vorlage die Zeile mit dem
 * Übertragungssymbol.
 */
export function RecipientStep({
  onPick,
  onCancel,
}: {
  /** `copy` = «Daten der bestehenden Zahlung kopieren». */
  onPick: (recipient: Recipient, copy: boolean) => void
  onCancel: () => void
}) {
  const { persona } = useSession()
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<Recipient | null>(null)

  const all = useMemo(() => recommendedRecipients(persona), [persona])
  const hits = filterRecipients(all, query)

  return (
    <div className="pay">
      <div className="pay-search">
        <input
          className="pay-search__input"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="IBAN, Mobiltelefonnr., Name, Konto"
          aria-label="Empfänger suchen"
        />
        <button className="pay-search__cancel" onClick={onCancel}>Abbrechen</button>
      </div>

      <div className="pay__body">
        <div className="pay-list__head">
          {query.trim() === '' ? 'Empfohlene Empfänger' : `${hits.length} Treffer`}
        </div>

        {hits.length === 0 ? (
          <p className="empty">Kein Empfänger gefunden.</p>
        ) : (
          hits.map((recipient) => (
            <button className="pay-rec" key={recipient.id} onClick={() => setChosen(recipient)}>
              <span className="pay-rec__disc">
                {/* Eigenes Konto: Person mit Übertragungszeichen. Sonst die
                    Note mit dem Pfeil hinaus — wie in der Vorlage. */}
                <Icon name={recipient.own ? 'accountPerson' : 'banknoteOut'} size={26} accent />
              </span>
              <span className="pay-rec__main">
                <span className="pay-rec__name">{recipient.name}</span>
                <span className="pay-rec__iban num">{recipient.iban}</span>
              </span>
            </button>
          ))
        )}
      </div>

      {chosen && (
        <BottomSheet title={chosen.name} onClose={() => setChosen(null)}>
          <SheetOption
            icon="plus"
            label="Neue Zahlung"
            hint="Zahlungsdaten neu erfassen"
            onClick={() => onPick(chosen, false)}
          />
          {/* Nur wo es wirklich eine frühere Zahlung gibt. Bei den beiden
              Zahnarztrechnungen fehlt sie — sie sind noch offen. */}
          {chosen.last && (
            <SheetOption
              icon="copy"
              label="Daten der bestehenden Zahlung kopieren"
              hint={`${formatMoney(chosen.last.amount, 'CHF', { sign: false })} (bezahlt am ${formatDate(chosen.last.date)})`}
              onClick={() => onPick(chosen, true)}
            />
          )}
        </BottomSheet>
      )}
    </div>
  )
}
