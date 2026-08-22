import { useMemo, useState } from 'react'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../data/categories'
import { TODAY, type Category, type Transaction } from '../../data/types'
import { addDays, formatMonth } from '../../lib/date'
import { formatMoney } from '../../lib/money'
import { useSession } from '../session'
import { Icon } from '../shell/Icon'
import { Slot } from '../shell/Slot'
import { Sheet } from '../shell/Sheet'
import { Card, CircleRow, Row } from '../shell/parts'

const WINDOW_DAYS = 90

interface Segment {
  category: Category
  total: number
  count: number
}

/** Ausgaben nach Kategorie, grösste zuerst. */
function segmentsOf(transactions: Transaction[]): Segment[] {
  const map = new Map<Category, Segment>()
  for (const tx of transactions) {
    if (tx.amount >= 0) continue
    const entry = map.get(tx.category)
    if (entry) {
      entry.total += -tx.amount
      entry.count += 1
    } else {
      map.set(tx.category, { category: tx.category, total: -tx.amount, count: 1 })
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

/** Donut aus SVG-Bögen — kein Diagrammpaket, damit die Farben exakt den Tokens folgen. */
function Donut({ segments, total }: { segments: Segment[]; total: number }) {
  const size = 210
  const stroke = 26
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Ausgaben nach Kategorie">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke} />
        {segments.map((segment) => {
          const length = total > 0 ? (segment.total / total) * circumference : 0
          const dash = `${Math.max(length - 2, 0)} ${circumference}`
          const element = (
            <circle
              key={segment.category}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={CATEGORY_COLORS[segment.category]}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          )
          offset += length
          return element
        })}
      </g>
    </svg>
  )
}

/**
 * Analysen — heute rein deskriptiv: Kategorien, Summe, Anzahl Buchungen.
 * Vorlage: PREP/03_Screens_and_Assets/playstore_android/postfinance_app/08.png
 *
 * Hinweis: Umbuchungen auf eigene Konten zählen hier bewusst als Ausgabe.
 * Genau so rechnet die App heute — siehe Interview 05.
 */
export function Analysis() {
  const { persona, pop } = useSession()
  const [mode, setMode] = useState<'categories' | 'time'>('categories')

  const from = addDays(TODAY, -WINDOW_DAYS)
  const recent = useMemo(
    () => persona.transactions.filter((tx) => tx.date >= from && tx.date <= TODAY),
    [persona, from],
  )

  const segments = segmentsOf(recent)
  const expenses = segments.reduce((total, segment) => total + segment.total, 0)
  const income = recent.filter((tx) => tx.amount > 0).reduce((total, tx) => total + tx.amount, 0)
  const balance = income - expenses

  return (
    <Sheet title="Bilanz" onBack={pop} action={<Icon name="settings" size={20} />}>
      <div className="screen__inner">
        <div style={{ display: 'flex', gap: 4, padding: 4, margin: '0 auto 20px', width: 'fit-content', background: 'var(--surface-card)', borderRadius: 'var(--CornerRadius-R-100)' }}>
          {(['categories', 'time'] as const).map((option) => (
            <button
              key={option}
              onClick={() => setMode(option)}
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--CornerRadius-R-100)',
                fontSize: 14,
                background: mode === option ? 'var(--petrol8)' : 'transparent',
                color: mode === option ? 'var(--weiss)' : 'var(--text-strong)',
              }}
            >
              {option === 'categories' ? 'Kategorien' : 'Zeitverlauf'}
            </button>
          ))}
        </div>

        <Slot name="analysis.aboveDonut" />

        {mode === 'categories' ? (
          <>
            <div style={{ position: 'relative', display: 'grid', placeItems: 'center', marginBottom: 20 }}>
              <Donut segments={segments} total={expenses} />
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {formatMonth(from)} – {formatMonth(TODAY)}
                </div>
                <div className="num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-strong)' }}>
                  {formatMoney(balance, 'CHF')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{recent.length} Buchungen</div>
              </div>
            </div>

            <CircleRow
              actions={[
                { icon: 'search', label: 'Suche', outline: true },
                { icon: 'co2', label: 'CO₂-Fussabdruck', outline: true },
              ]}
            />

            <Card>
              <Row title="Einnahmen" sub={`${recent.filter((tx) => tx.amount > 0).length} Buchungen`} amount={formatMoney(income, 'CHF', { sign: false })} />
              <Row title="Ausgaben" sub={`${recent.filter((tx) => tx.amount < 0).length} Buchungen`} amount={formatMoney(expenses, 'CHF', { sign: false })} />
            </Card>

            <div className="section-head"><span className="section-head__title">Kategorien</span></div>
            <Card>
              {segments.map((segment) => (
                <Row
                  key={segment.category}
                  title={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: CATEGORY_COLORS[segment.category], flex: 'none' }} />
                      {CATEGORY_LABELS[segment.category]}
                    </span>
                  }
                  sub={`${segment.count} Buchungen`}
                  amount={formatMoney(segment.total, 'CHF', { sign: false })}
                />
              ))}
            </Card>
          </>
        ) : (
          <Card>
            <p className="empty">
              Der Zeitverlauf ist im Nachbau nicht ausgeführt — heute zeigt er dieselben Summen
              als Balken pro Monat.
            </p>
          </Card>
        )}

        <Slot name="analysis.belowLegend" />
      </div>
    </Sheet>
  )
}
