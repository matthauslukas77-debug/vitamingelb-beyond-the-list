import { useMemo, useState, type ReactNode } from 'react'
import { resolveBrand } from '../../data/brands'
import { CATEGORY_LABELS } from '../../data/categories'
import { TODAY, type Account } from '../../data/types'
import { detectRecurring, type RecurringSeries } from '../../domain/recurring'
import { formatAmount, formatMoney } from '../../lib/money'
import { formatDate } from '../../lib/date'
import { useSession } from '../session'
import { Icon } from '../shell/Icon'
import { Sheet } from '../shell/Sheet'
import { Card, Row } from '../shell/parts'
import { CADENCE_LABEL, kindLabel, KIND_ICON, pretty } from '../screens/Recurring'
import { CATALOG, SUGGESTIONS, type CatalogEntry, type Target } from './catalog'
import { MIN_QUERY, matchesText, searchList, tokenize } from './match'

/**
 * Die Suche, die beide Hälften kennt.
 *
 * Bisher durchsucht `screens/Flows.tsx` nur die Buchungen. Die echte App findet
 * über dasselbe Feld auch Einstellungen und Funktionen — «twint», «dark mode»,
 * «scannen» führen dort direkt an den Ort, nicht auf eine Liste von Buchungen,
 * in denen das Wort zufällig vorkommt.
 *
 * Dieser Bildschirm ist der Ersatz. Er liegt bewusst neben dem alten und nicht
 * an seiner Stelle: `AppShell.tsx` zeigt weiter `Flows.tsx`, bis wir den
 * Umschalter bewusst setzen. Ein Bildschirm, der über die Kopfzeile jedes
 * Reiters erreichbar ist, tauscht man nicht nebenbei aus.
 *
 * Fünf Gruppen, in dieser Reihenfolge:
 *
 *   Einstellungen · Funktionen · Konten · Wiederkehrend · Buchungen
 *
 * Nicht alphabetisch und nicht nach Trefferzahl, sondern nach Absicht. Wer in
 * einer Banking-App etwas eintippt, sucht meistens einen Ort und nicht einen
 * Beleg — die Buchungen stehen deshalb zuletzt, dafür ohne Deckel bei der
 * Anzahl.
 */

/* Wie viele Zeilen eine Gruppe höchstens zeigt. Die Buchungen bleiben bei den
   30 des alten Bildschirms; die übrigen Gruppen sind Wegweiser, und ein
   Wegweiser mit zwölf Pfeilen hilft niemandem. */
const LIMIT = { setting: 6, function: 5, account: 4, series: 5, transaction: 30 }

function EntryRow({ entry, onOpen }: { entry: CatalogEntry; onOpen: () => void }) {
  return (
    <button className="set-row" onClick={onOpen}>
      <span style={{ flex: 'none', display: 'grid', placeItems: 'center', width: 26, color: 'var(--petrol5)' }}>
        <Icon name={entry.icon} size={22} />
      </span>
      <span className="set-row__main">
        <span className="set-row__title">{entry.title}</span>
        <span className="set-row__sub">{entry.path}</span>
      </span>
      <span className="set-row__chevron">
        <Icon name="chevronRight" size={16} />
      </span>
    </button>
  )
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div>
      <div className="section-head">
        <span className="section-head__title">{title}</span>
        <span className="section-head__value">{count}</span>
      </div>
      <Card>{children}</Card>
    </div>
  )
}

/** Der Name, unter dem eine wiederkehrende Reihe gesucht und angezeigt wird. */
function seriesTitle(series: RecurringSeries): string {
  const match = resolveBrand(series.label)
  return match ? match.brand.name : pretty(series.label)
}

export function SearchScreen() {
  const { persona, accountName, push, pop, setTab } = useSession()
  const [query, setQuery] = useState('')

  const tokens = useMemo(() => tokenize(query), [query])
  const ready = tokens.length > 0 && query.trim().length >= MIN_QUERY

  /* Die Erkennung wiederkehrender Buchungen läuft über alle Transaktionen und
     hängt nicht am Suchbegriff — deshalb einmal pro Persona, nicht pro
     Tastendruck. */
  const series = useMemo(
    () => detectRecurring(persona.transactions, { today: TODAY }),
    [persona],
  )

  const catalogHits = useMemo(() => (ready ? searchList(CATALOG, query) : []), [ready, query])
  const settings = catalogHits.filter((entry) => entry.kind === 'setting').slice(0, LIMIT.setting)
  const functions = catalogHits.filter((entry) => entry.kind === 'function').slice(0, LIMIT.function)

  const accounts = useMemo<Account[]>(() => {
    if (!ready) return []
    return persona.accounts
      .filter((account) =>
        matchesText(`${accountName(account)} ${account.name} ${account.iban}`, tokens),
      )
      .slice(0, LIMIT.account)
  }, [ready, persona, accountName, tokens])

  const recurring = useMemo(() => {
    if (!ready) return []
    return series
      .filter((entry) => matchesText(`${seriesTitle(entry)} ${entry.label} ${kindLabel(entry)}`, tokens))
      .slice(0, LIMIT.series)
  }, [ready, series, tokens])

  const transactions = useMemo(() => {
    if (!ready) return []
    return persona.transactions
      .filter((tx) => matchesText(`${tx.text} ${CATEGORY_LABELS[tx.category]}`, tokens))
      .slice(0, LIMIT.transaction)
  }, [ready, persona, tokens])

  const total = settings.length + functions.length + accounts.length + recurring.length + transactions.length

  const open = (target: Target) => {
    /* Ein Reiterwechsel räumt den Stapel ohnehin ab, die Suche schliesst sich
       also von selbst. Bei einem Bildschirm bleibt sie darunter stehen —
       «Zurück» führt zurück auf die Trefferliste mit dem getippten Begriff,
       und das ist genau das, was man nach einem Fehlgriff will. */
    if (target.type === 'tab') setTab(target.tab)
    else push(target.screen)
  }

  return (
    <Sheet title="Suchen" onBack={pop}>
      <div className="screen__inner">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Einstellungen, Funktionen, Buchungen"
          aria-label="Suchbegriff"
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

        {!ready && (
          <>
            <div className="section-head">
              <span className="section-head__title">Häufig gesucht</span>
            </div>
            <Card>
              {SUGGESTIONS.map((entry) => (
                <EntryRow key={entry.id} entry={entry} onOpen={() => open(entry.target)} />
              ))}
            </Card>
            <p className="empty" style={{ fontSize: 12 }}>
              Die Suche kennt Einstellungen und Funktionen so gut wie Buchungen.
            </p>
          </>
        )}

        {ready && total === 0 && <p className="empty">Keine Treffer für «{query.trim()}».</p>}

        {settings.length > 0 && (
          <Group title="Einstellungen" count={settings.length}>
            {settings.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onOpen={() => open(entry.target)} />
            ))}
          </Group>
        )}

        {functions.length > 0 && (
          <Group title="Funktionen" count={functions.length}>
            {functions.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onOpen={() => open(entry.target)} />
            ))}
          </Group>
        )}

        {accounts.length > 0 && (
          <Group title="Konten" count={accounts.length}>
            {accounts.map((account) => (
              <Row
                key={account.id}
                icon="accounts"
                title={accountName(account)}
                sub={account.iban}
                amount={formatMoney(account.balance, account.currency, { sign: false })}
                chevron
                onClick={() => push({ name: 'account', accountId: account.id })}
              />
            ))}
          </Group>
        )}

        {recurring.length > 0 && (
          <Group title="Wiederkehrend" count={recurring.length}>
            {recurring.map((entry) => (
              <Row
                key={entry.key}
                icon={KIND_ICON[entry.kind]}
                title={seriesTitle(entry)}
                sub={`${kindLabel(entry)} · ${CADENCE_LABEL[entry.cadence]}`}
                amount={formatAmount(entry.amount)}
                credit={entry.amount > 0}
                chevron
                onClick={() => push({ name: 'series', seriesKey: entry.key })}
              />
            ))}
          </Group>
        )}

        {transactions.length > 0 && (
          <Group title="Buchungen" count={transactions.length}>
            {transactions.map((tx) => (
              <Row
                key={tx.id}
                title={tx.text}
                sub={`${CATEGORY_LABELS[tx.category]} · ${formatDate(tx.date)}`}
                amount={formatAmount(tx.amount)}
                credit={tx.amount > 0}
                chevron
                onClick={() => push({ name: 'transaction', transactionId: tx.id })}
              />
            ))}
          </Group>
        )}
      </div>
    </Sheet>
  )
}
