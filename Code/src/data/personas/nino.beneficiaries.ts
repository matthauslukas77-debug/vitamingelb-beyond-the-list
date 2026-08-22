import type { Beneficiary } from '../types'

/** Adressbuch von Nino Roth. Herkunft und IBAN-Aufbau wie in `reto.beneficiaries.ts`. */
export const ninoBeneficiaries: Beneficiary[] = [
  {
    id: 'j-be-wg',
    name: 'WG Länggasse',
    iban: 'CH43 0900 0000 0312 0446 6',
    address: { street: 'Länggassstrasse 63', place: '3012 Bern', country: 'Schweiz' },
    bank: { name: 'PostFinance AG', place: 'Bern', country: 'Schweiz' },
    // «MIETE ZIMMER / WG Länggasse», monatlich.
    match: 'WG Länggasse',
  },
  {
    id: 'j-be-lehmann',
    name: 'Zahnarztpraxis Lehmann',
    iban: 'CH27 0079 0016 7209 1533 4',
    address: { street: 'Waisenhausplatz 25', place: '3011 Bern', country: 'Schweiz' },
    bank: { name: 'Berner Kantonalbank AG', place: 'Bern', country: 'Schweiz' },
    // Bisher nur eine Mahngebühr verbucht — die offene Rechnung steht als
    // pendenter Auftrag.
    match: 'Zahnarztpraxis Lehmann',
  },
  {
    id: 'j-be-mma',
    name: 'MMA Gym Bern GmbH',
    iban: 'CH64 0630 0016 1558 0302 7',
    address: { street: 'Güterstrasse 8', place: '3008 Bern', country: 'Schweiz' },
    bank: { name: 'Valiant Bank AG', place: 'Bern', country: 'Schweiz' },
    match: 'MMA GYM BERN',
  },
  {
    id: 'j-be-frei',
    name: 'Tobias Frei',
    iban: 'CH88 0840 1033 9008 7124 0',
    address: { street: 'Mittelstrasse 27', place: '3012 Bern', country: 'Schweiz' },
    bank: { name: 'Migros Bank AG', place: 'Zürich', country: 'Schweiz' },
    match: 'TOBIAS FREI',
  },
]
