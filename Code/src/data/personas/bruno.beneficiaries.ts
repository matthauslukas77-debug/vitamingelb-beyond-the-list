import type { Beneficiary } from '../types'

/** Adressbuch von Bruno Aebischer. Herkunft und IBAN-Aufbau wie in `reto.beneficiaries.ts`. */
export const brunoBeneficiaries: Beneficiary[] = [
  {
    id: 'm-be-steuer',
    name: 'Steuerverwaltung des Kantons Bern',
    iban: 'CH90 0900 0000 0300 0111 1',
    address: { street: 'Brünnenstrasse 66', place: '3018 Bern', country: 'Schweiz' },
    bank: { name: 'PostFinance AG', place: 'Bern', country: 'Schweiz' },
    // Akontorechnungen und die Schlussrechnung 2025.
    match: 'STEUERVERWALTUNG',
  },
  {
    id: 'm-be-heizung',
    name: 'IG Heizung Nachbarschaft',
    iban: 'CH33 0630 0016 2771 0451 0',
    address: { street: 'Alexander-Schöni-Strasse 14', place: '2503 Biel/Bienne', country: 'Schweiz' },
    bank: { name: 'Valiant Bank AG', place: 'Biel/Bienne', country: 'Schweiz' },
    // «ANZAHLUNG HEIZUNG / IG Nachbarschaft» — die zweite Rate steht als
    // pendenter Auftrag auf den 01.09.2026.
    match: 'IG Nachbarschaft',
  },
  {
    id: 'm-be-reber',
    name: 'Zahnarzt Dr. med. dent. Reber',
    iban: 'CH14 0079 0016 4552 7088 3',
    address: { street: 'Zentralstrasse 51', place: '2502 Biel/Bienne', country: 'Schweiz' },
    bank: { name: 'Berner Kantonalbank AG', place: 'Biel/Bienne', country: 'Schweiz' },
    match: 'Zahnarzt Dr. med. dent. Reber',
  },
  {
    id: 'm-be-lanz',
    name: 'Peter Lanz',
    iban: 'CH81 0808 0004 8913 3021 6',
    address: { street: 'Hauptstrasse 22', place: '2560 Nidau', country: 'Schweiz' },
    bank: { name: 'Raiffeisenbank Biel/Bienne', place: 'Biel/Bienne', country: 'Schweiz' },
    match: 'PETER LANZ',
  },
]
