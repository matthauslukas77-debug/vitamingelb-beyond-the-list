/**
 * Normalisierte Buchung + Geldfluss-Achse.
 *
 * Die Geldfluss-Achse ist die Voraussetzung für ein ehrliches Budget: ein
 * Dauerauftrag aufs eigene Sparkonto ist **keine Ausgabe**, und die
 * Kreditkartenrechnung ist **keine zweite** Ausgabe neben den Kartenkäufen.
 * Wer beides mitzählt, überschätzt Mia Kellers Ausgaben um CHF 1'033/Monat.
 *
 * Siehe WORKSPACE/07_konzept_geldfluss/README.md
 */

export type TxType =
  | 'card_pos'
  | 'card_online'
  | 'card_refund'
  | 'twint_send'
  | 'twint_receive'
  | 'direct_debit'
  | 'standing_order'
  | 'credit_transfer_in'
  | 'credit_transfer_out'
  | 'cash_withdrawal'
  | 'bank_fee'
  | 'interest';

/** Eine Buchung, quellenunabhängig. Beträge in CHF, Belastung negativ. */
export interface NormalizedTx {
  id: string;
  /** ISO-Datum YYYY-MM-DD (Buchungsdatum). */
  date: string;
  amount: number;
  /** Vollständiger Buchungstext, so wie ihn die Bank zeigt. */
  text: string;
  merchant?: string;
  counterparty?: string;
  counterpartyAccount?: string;
  message?: string;
  txType?: TxType;
  paymentMethod?: string;
  /** `card` = Buchung ab Kreditkarte, `account` = Buchung ab Konto. */
  source: 'account' | 'card';
  account: string;
  /**
   * Kategorie, die die Bank der Buchung schon gegeben hat.
   *
   * PostFinance kategorisiert seit Jahren automatisch (Contovista, ~98 %). Wenn
   * dieses Feld gefüllt ist, benutzen wir es — wir bauen E0 nicht nach, wir
   * nehmen es an. Siehe WORKSPACE/03_research/12_Domaene_Technik/01_TRANSAKTIONS_INTELLIGENZ.md
   */
  bankCategory?: string;
}

/** Was die App über die Person weiss — hebt die Trefferquote der Geldfluss-Achse. */
export interface HouseholdContext {
  /** Name der Kontoinhaberin, für die Erkennung eigener Überträge. */
  ownName?: string;
  /** Alle eigenen Konten/IBANs (inkl. Sparkonto, auch bei anderen Banken). */
  ownAccounts?: string[];
  /** Kartenkonten, deren Monatsrechnung vom Hauptkonto abgebucht wird. */
  cardAccounts?: string[];
}

/**
 * Wo ist das Geld jetzt?
 *
 * `out`     — echte Ausgabe, zählt ins Budget
 * `in`      — Einnahme
 * `moved`   — auf ein eigenes Konto umgezogen (Sparen), **keine** Ausgabe
 * `settled` — Ausgleich einer bereits gezählten Ausgabe (Kreditkartenrechnung)
 * `lent`    — an eine Privatperson ausgelegt, kommt evtl. zurück (TWINT P2P)
 */
export type MoneyFlow = 'out' | 'in' | 'moved' | 'settled' | 'lent';

export interface MoneyFlowResult {
  flow: MoneyFlow;
  confidence: number;
  /** Warum — für die «kennst du das?»-Rückfrage und die Doku. */
  reason: string;
}

const CARD_SETTLEMENT = /KREDITKARTE|CREDIT[- ]?CARD|KARTENRECHNUNG/i;
const OWN_TRANSFER_HINT = /EIGEN(E|ER)?\s*(KONTO|ÜBERTRAG)|SPARKONTO|UMBUCHUNG|VERGÜTUNG AUF EIGENES/i;
const PILLAR_3A = /S[ÄA]ULE\s*3A|3\.?\s*S[ÄA]ULE|VORSORGESTIFTUNG|FREIZ[ÜU]GIGKEIT/i;

function normalizeName(value: string | undefined): string {
  return (value ?? '')
    .toUpperCase()
    .replace(/[^A-ZÄÖÜ ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/**
 * Bestimmt, wo das Geld gelandet ist.
 *
 * Reihenfolge ist Absicht: die teuren Fehler (Sparen als Ausgabe zählen,
 * Kreditkarte doppelt zählen) werden zuerst ausgeschlossen.
 */
export function moneyFlow(tx: NormalizedTx, ctx: HouseholdContext = {}): MoneyFlowResult {
  const target = tx.counterpartyAccount ?? '';
  const ownAccounts = (ctx.ownAccounts ?? []).map((a) => a.replace(/\s/g, '').toUpperCase());
  const cardAccounts = (ctx.cardAccounts ?? []).map((a) => a.replace(/\s/g, '').toUpperCase());

  // 1. Übertrag auf ein bekanntes eigenes Konto — härtestes Signal.
  if (target && ownAccounts.includes(target.replace(/\s/g, '').toUpperCase())) {
    return { flow: 'moved', confidence: 1, reason: 'Gegenkonto ist ein eigenes Konto' };
  }

  // 2. Gegenpartei trägt den eigenen Namen (Sparkonto bei einer anderen Bank).
  if (ctx.ownName && tx.amount < 0) {
    const own = normalizeName(ctx.ownName);
    const cp = normalizeName(tx.counterparty ?? tx.merchant);
    if (own && cp && own === cp) {
      return { flow: 'moved', confidence: 0.95, reason: 'Gegenpartei trägt den eigenen Namen' };
    }
  }

  // 3. Ausdrücklicher Hinweis im Buchungstext.
  if (tx.amount < 0 && OWN_TRANSFER_HINT.test(tx.text)) {
    return { flow: 'moved', confidence: 0.8, reason: 'Buchungstext deutet auf eigenen Übertrag' };
  }

  // 4. Säule 3a — eigenes Geld, aber gebunden. Fürs Budget zählt es als Ausgabe
  //    (PostFinance führt «Beiträge private Vorsorge» als Ausgabenposition).
  if (tx.amount < 0 && PILLAR_3A.test(tx.text)) {
    return { flow: 'out', confidence: 0.9, reason: 'Einzahlung Säule 3a — im Budget als Vorsorgebeitrag' };
  }

  // 5. Rückerstattung einer Kartenzahlung — mindert die frühere Ausgabe.
  if (tx.txType === 'card_refund') {
    return { flow: 'settled', confidence: 0.9, reason: 'Rückerstattung einer Kartenzahlung' };
  }

  // 6. Kreditkartenrechnung: die Käufe sind bereits einzeln erfasst.
  if (
    tx.amount < 0 &&
    tx.source === 'account' &&
    (CARD_SETTLEMENT.test(tx.counterparty ?? '') || CARD_SETTLEMENT.test(tx.text)) &&
    cardAccounts.length > 0
  ) {
    return { flow: 'settled', confidence: 0.95, reason: 'Ausgleich der Kreditkartenrechnung' };
  }

  // 7. TWINT an Privatpersonen — ausgelegt, nicht zwingend ausgegeben.
  if (tx.txType === 'twint_send') {
    return { flow: 'lent', confidence: 0.7, reason: 'TWINT an Privatperson' };
  }
  if (tx.txType === 'twint_receive') {
    return { flow: 'lent', confidence: 0.7, reason: 'TWINT von Privatperson' };
  }

  return tx.amount >= 0
    ? { flow: 'in', confidence: 0.6, reason: 'Gutschrift' }
    : { flow: 'out', confidence: 0.9, reason: 'Belastung an Dritte' };
}

/** Buchungen, die ins Ausgabenbudget zählen. */
export function isBudgetExpense(flow: MoneyFlow): boolean {
  return flow === 'out';
}

export const YYYY_MM = (isoDate: string): string => isoDate.slice(0, 7);
