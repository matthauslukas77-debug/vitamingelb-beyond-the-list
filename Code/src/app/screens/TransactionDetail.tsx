import { resolveBrand } from '../../data/brands'
import { CATEGORY_GROUP, CATEGORY_LABELS } from '../../data/categories'
import { parseBooking, prettyName } from '../../domain/booking'
import { formatDate } from '../../lib/date'
import { formatAmount } from '../../lib/money'
import { useSession } from '../session'
import { Icon, type IconName } from '../shell/Icon'
import { Sheet } from '../shell/Sheet'

/**
 * Bewegungsdetails — was hinter einer Zeile der Buchungsliste steckt.
 * Vorlage: examples2/IMG_1691–1693 (echte Bildschirmfotos).
 *
 * Der Aufbau folgt der App: oben Händler, Betrag und Kontobezug auf getönter
 * Fläche, darunter Kategorie, Händler, Datum und zuletzt der rohe
 * Buchungstext. Genau dieser Rohtext ist der Ausgangspunkt der Challenge —
 * hier steht er ungefiltert, so wie ihn die Bank liefert.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="detail__section">
      <div className="detail__label">{title}</div>
      {children}
    </div>
  )
}

function DetailRow({ icon, title, sub, chevron }: {
  icon: IconName
  title: React.ReactNode
  sub?: React.ReactNode
  chevron?: 'right' | 'down'
}) {
  return (
    <div className="detail__row">
      <span className="detail__icon"><Icon name={icon} size={22} accent /></span>
      <span className="detail__main">{title}{sub && <span className="detail__sub">{sub}</span>}</span>
      {chevron && (
        <span className="detail__chevron">
          <Icon name={chevron === 'down' ? 'chevronDown' : 'chevronRight'} size={20} />
        </span>
      )}
    </div>
  )
}

export function TransactionDetail({ transactionId }: { transactionId: string }) {
  const { persona, accountName, pop } = useSession()
  const tx = persona.transactions.find((entry) => entry.id === transactionId)
  if (!tx) return null

  const account = persona.accounts.find((entry) => entry.id === tx.accountId)
  const booking = parseBooking(tx)
  // Dasselbe Logo wie in der Buchungsliste — aufgelöst aus dem Rohtext.
  const match = resolveBrand(tx.text)
  const merchant = match?.brand.name ?? (booking.counterparty ? prettyName(booking.counterparty) : undefined)
  const paidBefore = booking.paidOn && booking.paidOn !== tx.date

  return (
    <Sheet title="Bewegungsdetails" onBack={pop}>
      <div className="detail__hero">
        <span
          className={'detail__logo' + (match ? ' detail__logo--brand' : '')}
          style={
            match?.bg
              ? { background: match.bg }
              : !match && tx.brand
                ? { background: tx.brand.bg, color: tx.brand.fg }
                : undefined
          }
        >
          {match ? (
            <img src={match.logo} alt="" width={72} height={72} />
          ) : (
            tx.brand?.short || (merchant ?? '?').charAt(0)
          )}
          {tx.pending && (
            <span className="detail__pending-badge"><Icon name="clock" size={14} /></span>
          )}
        </span>

        <span className="detail__amount num">
          <span className="detail__cur">{tx.currency}</span> {formatAmount(tx.amount)}
        </span>

        {tx.pending ? (
          <>
            <span className="detail__meta">Ausstehender Betrag</span>
            <span className="detail__meta">auf <strong>{account && accountName(account)}</strong></span>
          </>
        ) : (
          <>
            {paidBefore && (
              <span className="detail__meta">
                Am <strong>{formatDate(booking.paidOn!)}</strong> bezahlt
              </span>
            )}
            <span className="detail__meta">
              Am <strong>{formatDate(tx.date)}</strong> belastet von <strong>{account && accountName(account)}</strong>
            </span>
          </>
        )}
      </div>

      <div className="detail__body">
        {tx.pending && (
          <div className="detail__notice">
            <span className="detail__notice-icon"><Icon name="clock" size={18} /></span>
            <span>
              Diese Zahlung wurde reserviert und wird abgebucht, sobald der Empfänger
              diese definitiv anfordert.
            </span>
          </div>
        )}

        <Section title="Kategorie">
          <DetailRow
            icon="payments"
            title={<span className="detail__group">{CATEGORY_GROUP[tx.category]}</span>}
            sub={<strong className="detail__strong">{CATEGORY_LABELS[tx.category]}</strong>}
            chevron="down"
          />
          <button className="detail__add">
            <Icon name="plus" size={22} />
            Label hinzufügen
          </button>
        </Section>

        {merchant && booking.card && (
          <Section title="Händler">
            <DetailRow
              icon="support"
              title={<strong className="detail__strong">{merchant}</strong>}
              sub={booking.country ? `Land ${booking.country}` : undefined}
              chevron="right"
            />
          </Section>
        )}

        {booking.foreign && (
          <Section title="Fremdwährung">
            <DetailRow
              icon="globe"
              title={
                <strong className="detail__strong">
                  {booking.foreign.currency} {booking.foreign.amount}
                </strong>
              }
              sub={
                `Kurs ${booking.foreign.rate}` +
                (booking.foreign.fee ? ` · ${booking.foreign.fee}% Bearbeitungszuschlag` : '')
              }
            />
          </Section>
        )}

        <Section title="Transaktionsdatum">
          <DetailRow
            icon="calendar"
            title={<strong className="detail__strong">{formatDate(booking.paidOn ?? tx.date)}</strong>}
            sub="Datum an dem die Transaktion stattfand"
          />
        </Section>

        <Section title="Buchungsdetails">
          <div className="detail__row">
            <span className="detail__icon"><Icon name="document" size={22} accent /></span>
            <span className="detail__raw">
              {booking.lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          </div>
        </Section>
      </div>
    </Sheet>
  )
}
