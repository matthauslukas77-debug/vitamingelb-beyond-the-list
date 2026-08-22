import { useState } from 'react'
import { formatMoney } from '../../lib/money'
import { CATEGORY_LABELS } from '../../data/categories'
import { useSession } from '../session'
import { Icon } from '../shell/Icon'
import { Sheet } from '../shell/Sheet'
import { Card, Row } from '../shell/parts'

/**
 * Die drei Zahlungsflüsse und die Suche. Im Nachbau bewusst flach gehalten:
 * Sie müssen erreichbar sein und richtig aussehen, aber nichts ausführen.
 */

/** Scannen — Kamerabild als Attrappe, mit Sucherrahmen wie in der App. */
export function Scan() {
  const { pop } = useSession()
  return (
    <Sheet title="QR-Rechnung scannen" onBack={pop}>
      <div className="screen__inner">
        <div
          style={{
            position: 'relative',
            aspectRatio: '3 / 4',
            borderRadius: 'var(--CornerRadius-R-20)',
            background: 'linear-gradient(150deg, #0C2A2F, #12454C 60%, #0B2429)',
            display: 'grid',
            placeItems: 'center',
            overflow: 'hidden',
          }}
        >
          <div style={{ width: '62%', aspectRatio: '1', border: '2px solid var(--postfinancegelb)', borderRadius: 12 }} />
          <p style={{ position: 'absolute', bottom: 20, margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', padding: '0 24px' }}>
            Richte die Kamera auf den Swiss QR-Code der Rechnung.
          </p>
        </div>
        <p className="empty">Im Prototyp ist die Kamera nicht aktiv.</p>
      </div>
    </Sheet>
  )
}

/** Zahlen — Formular in der Struktur der echten Maske. */
export function Pay() {
  const { persona, pop } = useSession()
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const account = persona.accounts[0]

  const field: React.CSSProperties = {
    width: '100%',
    padding: '12px 0',
    border: 0,
    borderBottom: '1px solid var(--line)',
    background: 'transparent',
    color: 'var(--text-strong)',
    fontSize: 16,
    outline: 'none',
  }

  return (
    <Sheet title="Zahlen" onBack={pop}>
      <div className="screen__inner">
        <Card>
          <div className="card__body" style={{ display: 'grid', gap: 18 }}>
            <label style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Empfänger</span>
              <input style={field} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Name oder IBAN" />
            </label>
            <label style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Betrag</span>
              <input style={field} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="CHF 0.00" inputMode="decimal" />
            </label>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Belastungskonto</span>
              <div style={{ paddingTop: 8, fontSize: 15, color: 'var(--text-strong)' }}>
                {account.name} · {formatMoney(account.balance, account.currency, { sign: false })}
              </div>
            </div>
          </div>
        </Card>
        <p className="empty">Im Prototyp wird keine Zahlung ausgelöst.</p>
      </div>
    </Sheet>
  )
}

/** Übertragen — Auswahl zweier eigener Konten. */
export function Transfer() {
  const { persona, pop } = useSession()
  const own = persona.accounts.filter((account) => account.source.type === 'postfinance')

  return (
    <Sheet title="Übertragen" onBack={pop}>
      <div className="screen__inner">
        <div className="section-head"><span className="section-head__title">Von</span></div>
        <Card>
          <Row title={own[0]?.name ?? '—'} sub={own[0]?.iban} amount={own[0] && formatMoney(own[0].balance, own[0].currency, { sign: false })} />
        </Card>

        <div style={{ display: 'grid', placeItems: 'center', padding: '14px 0', color: 'var(--petrol5)' }}>
          <Icon name="transfer" size={22} />
        </div>

        <div className="section-head"><span className="section-head__title">Auf</span></div>
        <Card>
          {own.slice(1).map((account) => (
            <Row key={account.id} title={account.name} sub={account.iban} amount={formatMoney(account.balance, account.currency, { sign: false })} chevron />
          ))}
          {own.length < 2 && <p className="empty">Kein zweites eigenes Konto vorhanden.</p>}
        </Card>
        <p className="empty">Im Prototyp wird keine Übertragung ausgeführt.</p>
      </div>
    </Sheet>
  )
}

/** Suche über alle Buchungen — die App zeigt sie als Beta. */
export function Search() {
  const { persona, pop } = useSession()
  const [query, setQuery] = useState('')
  const hits = query.trim().length < 2
    ? []
    : persona.transactions.filter((tx) => tx.text.toLowerCase().includes(query.toLowerCase())).slice(0, 30)

  return (
    <Sheet title="Suchen" onBack={pop}>
      <div className="screen__inner">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buchungen durchsuchen"
          style={{
            width: '100%',
            padding: '14px 18px',
            border: 0,
            borderRadius: 'var(--CornerRadius-R-100)',
            background: 'var(--surface-card)',
            color: 'var(--text-strong)',
            fontSize: 15,
            boxShadow: 'var(--shadow-card)',
            outline: 'none',
          }}
        />
        {hits.length > 0 ? (
          <Card>
            {hits.map((tx) => (
              <Row
                key={tx.id}
                title={tx.text}
                sub={`${CATEGORY_LABELS[tx.category]} · ${tx.date}`}
                amount={formatMoney(tx.amount, tx.currency).replace(`${tx.currency} `, '')}
                credit={tx.amount > 0}
              />
            ))}
          </Card>
        ) : (
          <p className="empty">
            {query.trim().length < 2 ? 'Mindestens zwei Zeichen eingeben.' : 'Keine Treffer.'}
          </p>
        )}
      </div>
    </Sheet>
  )
}
