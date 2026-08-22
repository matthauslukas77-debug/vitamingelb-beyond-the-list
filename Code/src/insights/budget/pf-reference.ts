import { CATEGORY_KEYS, type CategoryKey } from './slots'
import {
  Display,
  hasPartner,
  householdNetIncomeYear,
  type Budget,
  type CivilStatus,
  type Denomination,
  type InformationForm,
} from './pf-model'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Der Richtwert: was ein vergleichbarer Haushalt laut PostFinance ausgibt.
 *
 * Lokaler Ersatz für den `calculateBudget`-Endpoint — dieselben Zahlen, ohne
 * Netz. Grundlage ist `data/reference.json`: 24 Haushaltsprofile × 5
 * Einkommensklassen plus ein Steuerraster über 26 Kantone, gesampelt aus
 * **2'513 Live-Antworten** des öffentlichen Rechners am 22.08.2026.
 *
 * Genauigkeit gegen alle 2'513 Samples (gemessen, nicht behauptet):
 *
 *   Nettoeinkommen   exakt (±1 CHF/Jahr Rundung)
 *   Ausgabentotal    Median 0.00 %, p90 0.01 %, p99 0.03 %
 *   Kategorien       Median 0.00 %, p90 0.23 %, p99 2.4 %
 *   Steuern          Median 0 CHF/Mt, p90 13 CHF/Mt, p99 219 CHF/Mt
 *
 * Die Steuern sind der einzige Teil, der sich nicht als Formel rekonstruieren
 * liess — dahinter stehen kommunale Steuerfüsse eines Drittanbieters. Was hier
 * liegt, ist ein interpoliertes Raster, und der Fehler steht oben. Wir weisen
 * ihn aus, statt ihn zu verschweigen.
 *
 * Einheit: **ganze Franken**, wie im Original. Siehe Kopf von `pf-model.ts`.
 *
 * Rechtliches: Der Rechner ist öffentlich, ohne Auth erreichbar und wurde
 * schonend gesampelt (4 parallele Anfragen, 120 ms Pause). Was hier liegt,
 * sind **gemessene Ausgaben dieses Rechners**, keine Datenlieferung von
 * PostFinance. Im Pitch nennen wir die Quelle.
 */

interface ExpenseClass {
  netLowerBound: number
  netUpperBound: number | null
  expenseRatio: number
  shares: Record<Exclude<CategoryKey, 'taxes'>, number>
  n: number
}

export interface TaxLocation {
  canton: string
  city: string
  taxLocationID: number
  zipCode: string
}

interface Reference {
  expenseClasses: Record<string, ExpenseClass[]>
  /** `${taxLocationId}` → `${civilStatus}|${children}|${earners}` → [[hhBrutto, Steuer/Jahr], …] */
  taxByLocation: Record<string, Record<string, [number, number][]>>
  denominationFactor: Record<string, Record<string, number>>
  taxLocations: Record<string, TaxLocation>
}

/**
 * 56 KB Messdaten, die nur der Richtwert braucht. Dynamisch geladen, damit sie
 * nicht im Haupt-Bundle landen: Wer die App öffnet und nie ein Budget anlegt,
 * lädt sie nie.
 */
let loaded: Promise<Reference> | null = null

export function loadReference(): Promise<Reference> {
  loaded ??= import('./data/reference.json').then(
    (module) => (module.default ?? module) as unknown as Reference,
  )
  return loaded
}

const NON_TAX = CATEGORY_KEYS.filter((key): key is Exclude<CategoryKey, 'taxes'> => key !== 'taxes')

/**
 * Einkommensklasse des Haushalts.
 *
 * Eigenheit des Originals: Das sind **Stufen**, kein stetiger Verlauf. An
 * einer Klassengrenze springt das Ausgabentotal um bis zu 20 % — CHF 1 mehr
 * Einkommen können die «typischen» Ausgaben um CHF 1'159 im Monat senken. Wer
 * das nicht will, setzt `interpolate: true`.
 */
export function expenseClass(
  reference: Reference,
  civilStatus: CivilStatus,
  children: number,
  netIncomeMonth: number,
): ExpenseClass {
  const classes = reference.expenseClasses[`${civilStatus}|${children}`]
  if (!classes) throw new Error(`Kein Referenzprofil für ${civilStatus}|${children}`)
  return (
    classes.find(
      (entry) =>
        netIncomeMonth >= entry.netLowerBound &&
        (entry.netUpperBound === null || netIncomeMonth < entry.netUpperBound),
    ) ?? classes[classes.length - 1]
  )
}

/** Stetige Variante: linear zwischen den Klassenmitten statt Stufensprung. */
function interpolatedRatio(
  reference: Reference,
  civilStatus: CivilStatus,
  children: number,
  netMonth: number,
): number {
  const classes = reference.expenseClasses[`${civilStatus}|${children}`]
  const centers = classes.map((entry) => ({
    x: entry.netUpperBound === null ? entry.netLowerBound * 1.4 : (entry.netLowerBound + entry.netUpperBound) / 2,
    y: entry.expenseRatio,
  }))
  if (netMonth <= centers[0].x) return centers[0].y
  const last = centers[centers.length - 1]
  if (netMonth >= last.x) return last.y
  for (let i = 0; i < centers.length - 1; i++) {
    const a = centers[i]
    const b = centers[i + 1]
    if (netMonth >= a.x && netMonth <= b.x) return a.y + ((b.y - a.y) * (netMonth - a.x)) / (b.x - a.x)
  }
  return last.y
}

/** Steuern pro Jahr, linear interpoliert auf dem gesampelten Raster. */
export function estimateTaxYear(
  reference: Reference,
  args: {
    taxLocationId: number
    civilStatus: CivilStatus
    children: number
    householdGrossYear: number
    denomination: Denomination
    earners: 1 | 2
  },
): number {
  const perLocation = reference.taxByLocation[String(args.taxLocationId)]
  if (!perLocation) throw new Error(`Kein Steuerraster für Steuerort ${args.taxLocationId}`)

  const points =
    perLocation[`${args.civilStatus}|${args.children}|${args.earners}`] ??
    perLocation[`${args.civilStatus}|${args.children}|${args.earners === 1 ? 2 : 1}`]
  if (!points) throw new Error(`Kein Steuerraster für ${args.civilStatus}|${args.children}`)

  const gross = args.householdGrossYear
  const [firstX, firstY] = points[0]
  const [lastX, lastY] = points[points.length - 1]
  let value: number

  if (gross <= firstX) {
    value = firstX > 0 ? (firstY * gross) / firstX : 0
  } else if (gross >= lastX) {
    const [prevX, prevY] = points[points.length - 2]
    value = lastY + ((lastY - prevY) / (lastX - prevX)) * (gross - lastX)
  } else {
    value = 0
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i]
      const [x1, y1] = points[i + 1]
      if (gross >= x0 && gross <= x1) {
        value = y0 + ((y1 - y0) * (gross - x0)) / (x1 - x0)
        break
      }
    }
  }

  const factor = reference.denominationFactor[String(args.taxLocationId)]?.[args.denomination] ?? 1
  return Math.max(0, value * factor)
}

export interface EstimateOptions {
  /** Bezugsjahr für das Alter. */
  currentYear: number
  /** Zwischen den Einkommensklassen interpolieren statt zu springen. */
  interpolate?: boolean
}

/**
 * Der Richtwert für diesen Haushalt — das lokale Gegenstück zu
 * `calculateBudget`. Beträge in ganzen Franken.
 */
export function estimateBudget(
  reference: Reference,
  form: InformationForm,
  options: EstimateOptions,
): Budget {
  if (form.civilStatus === null) throw new Error('civilStatus fehlt')
  if (form.grossYearIncome === null) throw new Error('grossYearIncome fehlt')
  if (form.denomination === null) throw new Error('denomination fehlt')
  if (form.taxLocationId === null) throw new Error('taxLocationId fehlt')

  const children = Number(form.children)
  const netYear = householdNetIncomeYear(form, options.currentYear)
  const netMonth = Math.round(netYear / 12)

  const partnerGross = hasPartner(form.civilStatus) ? (form.grossYearIncomePartner ?? 0) : 0
  const householdGross = form.grossYearIncome + partnerGross
  const earners: 1 | 2 = partnerGross > 0 ? 2 : 1

  const cls = expenseClass(reference, form.civilStatus, children, netMonth)
  const ratio = options.interpolate
    ? interpolatedRatio(reference, form.civilStatus, children, netMonth)
    : cls.expenseRatio

  const sumExpensesMonth = Math.round(ratio * netMonth)
  const taxesMonth = Math.round(
    estimateTaxYear(reference, {
      taxLocationId: form.taxLocationId,
      civilStatus: form.civilStatus,
      children,
      householdGrossYear: householdGross,
      denomination: form.denomination,
      earners,
    }) / 12,
  )

  /* Die Steuern werden vom Total abgezogen, der Rest nach festen Anteilen
     verteilt — so rechnet das Original. */
  const rest = Math.max(0, sumExpensesMonth - taxesMonth)
  const amounts: Record<CategoryKey, number> = {
    taxes: taxesMonth,
    reside: 0,
    insurance: 0,
    health: 0,
    mobility: 0,
    consumption: 0,
  }
  for (const key of NON_TAX) amounts[key] = Math.round(cls.shares[key] * rest)

  const budget = {
    display: Display.month,
    householdIncomeNetMonth: netMonth,
    householdIncomeNetYear: Math.round(netYear),
    sumExpensesMonth,
    sumExpensesYear: sumExpensesMonth * 12,
    savingQuoteMonth: netMonth - sumExpensesMonth,
    savingQuoteYear: Math.round(netYear) - sumExpensesMonth * 12,
  } as Budget

  for (const key of CATEGORY_KEYS) {
    const record = budget as unknown as Record<string, number>
    record[`${key}MonthAmount`] = amounts[key]
    record[`${key}YearAmount`] = amounts[key] * 12
  }
  return budget
}

/** Ein Referenz-Steuerort je Kanton — für die Ortswahl im Wizard. */
export function taxLocations(reference: Reference): TaxLocation[] {
  return Object.values(reference.taxLocations).sort((a, b) => a.canton.localeCompare(b.canton))
}

export function taxLocationOf(reference: Reference, canton: string): TaxLocation | undefined {
  return reference.taxLocations[canton]
}

export type { Reference }
