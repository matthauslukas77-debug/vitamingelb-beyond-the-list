import { resolveBrand } from '../../data/brands'
import type { Transaction } from '../../data/types'
import { Icon, type IconName } from './Icon'

/**
 * Der runde Platz links in der Buchungszeile.
 *
 * Drei Stufen, in dieser Reihenfolge:
 *  1. echtes Händlerlogo, wenn `resolveBrand` den Text auflösen kann
 *  2. die von Hand gesetzte Farbscheibe der Persona (`tx.brand`)
 *  3. das Kategoriesymbol — der Zustand von heute
 *
 * Stufe 3 bleibt bewusst erhalten: sie zeigt im Vergleich, was die App heute
 * anzeigt, wenn niemand den Händler kennt.
 */
export function BrandAvatar({ tx, fallbackIcon }: { tx: Transaction; fallbackIcon: IconName }) {
  const match = resolveBrand(tx.text)

  if (match) {
    // App-Icons sind quadratisch und dürfen den Kreis füllen. Wortmarken (SVG,
    // meist von Commons) sind breit und brauchen Luft, sonst stossen sie an.
    const wordmark = match.logo.endsWith('.svg')
    return (
      <span className={'tx__brand tx__brand--logo' + (wordmark ? ' tx__brand--wordmark' : '')} title={match.brand.name}>
        <img src={match.logo} alt="" loading="lazy" width={44} height={44} />
      </span>
    )
  }

  if (tx.brand) {
    return (
      <span className="tx__brand" style={{ background: tx.brand.bg, color: tx.brand.fg }}>
        {tx.brand.short}
      </span>
    )
  }

  return (
    <span className="tx-icon">
      <Icon name={fallbackIcon} size={22} />
    </span>
  )
}
