import type { Beneficiary } from '../types'

/** Adressbuch von Livia Berger. Herkunft und IBAN-Aufbau wie in `reto.beneficiaries.ts`. */
export const liviaBeneficiaries: Beneficiary[] = [
  {
    id: 'k-be-zbinden',
    name: 'Jana Zbinden',
    iban: 'CH74 0851 8004 0131 3572 3',
    address: { street: 'Dorfstrasse 9', place: '3150 Schwarzenburg', country: 'Schweiz' },
    bank: { name: 'Bank Gantrisch Genossenschaft', place: 'Schwarzenburg', country: 'Schweiz' },
    match: 'JANA ZBINDEN',
  },
  {
    id: 'k-be-rufer',
    name: 'Selina Rufer',
    iban: 'CH61 0900 0000 0167 7209 4',
    address: { street: 'Effingerstrasse 55', place: '3008 Bern', country: 'Schweiz' },
    bank: { name: 'PostFinance AG', place: 'Bern', country: 'Schweiz' },
    match: 'SELINA RUFER',
  },
  {
    id: 'k-be-kern',
    name: 'Michelle Kern',
    iban: 'CH52 0079 0016 8803 4156 2',
    address: { street: 'Sternenweg 4', place: '3098 Köniz', country: 'Schweiz' },
    bank: { name: 'Berner Kantonalbank AG', place: 'Bern', country: 'Schweiz' },
    match: 'MICHELLE KERN',
  },
  {
    id: 'k-be-fitnesspark',
    name: 'Fitnesspark Migros Bern',
    iban: 'CH27 0840 1033 5012 9907 4',
    address: { street: 'Papiermühlestrasse 71', place: '3014 Bern', country: 'Schweiz' },
    bank: { name: 'Migros Bank AG', place: 'Zürich', country: 'Schweiz' },
    match: 'MIGROS FITNESSPARK',
  },
]
