import type { Beneficiary } from '../types'

/**
 * Adressbuch von Reto Bühler.
 *
 * Jeder Eintrag steht für eine Gegenpartei, die in `reto.data.ts` wirklich
 * vorkommt — `match` ist das Fragment, über das der Zahlungsfluss die frühere
 * Zahlung findet. Die IBAN ist erfunden, aber strukturell gültig: CH,
 * Prüfziffern nach ISO 7064 Mod 97-10, echte Clearing-Nummer der genannten Bank.
 */
export const retoBeneficiaries: Beneficiary[] = [
  {
    id: 'f-be-iseli',
    name: 'Verwaltung Iseli AG',
    iban: 'CH04 0079 0016 3044 1200 7',
    address: { street: 'Marktgasse 34', place: '3011 Bern', country: 'Schweiz' },
    bank: { name: 'Berner Kantonalbank AG', place: 'Bern', country: 'Schweiz' },
    // «MIETZINS / Verwaltung Iseli», monatlich seit September 2024.
    match: 'Verwaltung Iseli',
  },
  {
    id: 'f-be-vogt',
    name: 'Zahnarztpraxis Dr. med. dent. Vogt',
    iban: 'CH95 0630 0016 9004 1288 1',
    address: { street: 'Zeughausgasse 18', place: '3011 Bern', country: 'Schweiz' },
    bank: { name: 'Valiant Bank AG', place: 'Bern', country: 'Schweiz' },
    // Steht als pendenter Auftrag, aber noch nie bezahlt — im Fluss fehlt
    // deshalb die Zeile «Daten der bestehenden Zahlung kopieren».
    match: 'Zahnarztpraxis Dr. Vogt',
  },
  {
    id: 'f-be-gerber',
    name: 'Nora Gerber',
    iban: 'CH17 0900 0000 0218 4530 7',
    address: { street: 'Weissensteinstrasse 42', place: '3007 Bern', country: 'Schweiz' },
    bank: { name: 'PostFinance AG', place: 'Bern', country: 'Schweiz' },
    match: 'NORA GERBER',
  },
  {
    id: 'f-be-baur',
    name: 'Timo Baur',
    iban: 'CH53 0808 0004 4661 0299 3',
    address: { street: 'Bernstrasse 12', place: '3072 Ostermundigen', country: 'Schweiz' },
    bank: { name: 'Raiffeisenbank Bern', place: 'Bern', country: 'Schweiz' },
    match: 'TIMO BAUR',
  },
]
