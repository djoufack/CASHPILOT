import { createHash, randomBytes } from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { buildFullDemoDataset } from './lib/buildFullDemoDataset.mjs';

const CURRENT_YEAR = new Date().getFullYear();

function uuidFromSeed(seed) {
  const hash = createHash('sha1').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function roundAmount(value) {
  return Math.round(Number(value) * 100) / 100;
}

function isoDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const value = new Date(`${dateString}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function parseArguments(argv) {
  const options = {
    apply: false,
    dryRun: true,
    resetPasswords: false,
    countries: ['FR', 'BE', 'OHADA'],
  };

  for (const arg of argv) {
    if (arg === '--apply') {
      options.apply = true;
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
      options.apply = false;
    } else if (arg === '--reset-passwords') {
      options.resetPasswords = true;
    } else if (arg.startsWith('--countries=')) {
      options.countries = arg
        .split('=', 2)[1]
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
    }
  }

  return options;
}

function randomPassword() {
  return `CashPilot#${randomBytes(12).toString('base64url')}`;
}

function createLines(...rows) {
  return rows.map((row) => ({
    accountCode: row.accountCode,
    debit: roundAmount(row.debit || 0),
    credit: roundAmount(row.credit || 0),
    description: row.description || '',
  }));
}

function buildInvoiceEntries(config, invoice) {
  const taxAmount = roundAmount(invoice.totalHt * (config.vatRate / 100));
  const totalTtc = roundAmount(invoice.totalHt + taxAmount);

  return {
    ref: `INV-${config.country}-${CURRENT_YEAR}-${invoice.code}`,
    date: isoDate(CURRENT_YEAR, invoice.month, invoice.day),
    lines: createLines(
      {
        accountCode: config.accounts.receivable,
        debit: totalTtc,
        description: `Facture ${invoice.number}`,
      },
      {
        accountCode: config.accounts.revenue,
        credit: invoice.totalHt,
        description: `Facture ${invoice.number}`,
      },
      {
        accountCode: config.accounts.outputVat,
        credit: taxAmount,
        description: `TVA ${invoice.number}`,
      }
    ),
  };
}

function buildPaymentEntries(config, payment) {
  return {
    ref: `PAY-${config.country}-${CURRENT_YEAR}-${payment.code}`,
    date: isoDate(CURRENT_YEAR, payment.month, payment.day),
    lines: createLines(
      {
        accountCode: config.accounts.bank,
        debit: payment.amount,
        description: `Encaissement ${payment.receiptNumber}`,
      },
      {
        accountCode: config.accounts.receivable,
        credit: payment.amount,
        description: `Encaissement ${payment.receiptNumber}`,
      }
    ),
  };
}

function buildExpenseEntries(config, expense) {
  const taxAmount = roundAmount(expense.baseAmount * (config.vatRate / 100));
  const totalTtc = roundAmount(expense.baseAmount + taxAmount);

  return {
    ref: `EXP-${config.country}-${CURRENT_YEAR}-${expense.code}`,
    date: isoDate(CURRENT_YEAR, expense.month, expense.day),
    lines: createLines(
      {
        accountCode: expense.accountCode,
        debit: expense.baseAmount,
        description: expense.description,
      },
      {
        accountCode: config.accounts.inputVat,
        debit: taxAmount,
        description: `TVA ${expense.description}`,
      },
      {
        accountCode: config.accounts.payable,
        credit: totalTtc,
        description: expense.description,
      }
    ),
  };
}

function buildSupplierPaymentEntries(config, supplierPayment) {
  return {
    ref: `SUPPAY-${config.country}-${CURRENT_YEAR}-${supplierPayment.code}`,
    date: isoDate(CURRENT_YEAR, supplierPayment.month, supplierPayment.day),
    lines: createLines(
      {
        accountCode: config.accounts.payable,
        debit: supplierPayment.amount,
        description: supplierPayment.description,
      },
      {
        accountCode: config.accounts.bank,
        credit: supplierPayment.amount,
        description: supplierPayment.description,
      }
    ),
  };
}

function buildCapexEntries(config, capex) {
  return {
    ref: `CAPEX-${config.country}-${CURRENT_YEAR}-${capex.code}`,
    date: isoDate(CURRENT_YEAR, capex.month, capex.day),
    lines: createLines(
      {
        accountCode: config.accounts.fixedAsset,
        debit: capex.amount,
        description: capex.description,
      },
      {
        accountCode: config.accounts.payable,
        credit: capex.amount,
        description: capex.description,
      }
    ),
  };
}

function buildInterestEntries(config, interest) {
  return {
    ref: `INT-${config.country}-${CURRENT_YEAR}-${interest.code}`,
    date: isoDate(CURRENT_YEAR, interest.month, interest.day),
    lines: createLines(
      {
        accountCode: config.accounts.interestExpense,
        debit: interest.amount,
        description: interest.description,
      },
      {
        accountCode: config.accounts.bank,
        credit: interest.amount,
        description: interest.description,
      }
    ),
  };
}

function buildDepreciationEntries(config, depreciation) {
  return {
    ref: `DEP-${config.country}-${CURRENT_YEAR}-${depreciation.code}`,
    date: isoDate(CURRENT_YEAR, depreciation.month, depreciation.day),
    lines: createLines(
      {
        accountCode: config.accounts.depreciationExpense,
        debit: depreciation.amount,
        description: depreciation.description,
      },
      {
        accountCode: config.accounts.accumulatedDepreciation,
        credit: depreciation.amount,
        description: depreciation.description,
      }
    ),
  };
}

function buildOpeningEntries(config) {
  return {
    ref: `OPEN-${config.country}-${CURRENT_YEAR}`,
    date: isoDate(CURRENT_YEAR, 1, 1),
    lines: createLines(...config.openingLines),
  };
}

function ensureBalanced(entryGroups) {
  for (const group of entryGroups) {
    const debit = roundAmount(group.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0));
    const credit = roundAmount(group.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0));

    if (Math.abs(debit - credit) >= 0.01) {
      throw new Error(`Entry group ${group.ref} is not balanced (${debit} vs ${credit}).`);
    }
  }
}

function buildDemoConfigs() {
  return {
    FR: {
      country: 'FR',
      label: 'France',
      email: 'pilotage.fr.demo@cashpilot.cloud',
      passwordEnvVar: 'PILOTAGE_DEMO_PASSWORD_FR',
      fullName: 'Pilotage Demo France',
      region: 'france',
      sector: 'b2b_services',
      vatRate: 20,
      company: {
        company_name: 'CashPilot Demo France SAS',
        company_type: 'company',
        registration_number: 'RCS-PARIS-2026-DEMO',
        tax_id: 'FRDEMO2026001',
        address: '24 Rue de la Performance',
        city: 'Paris',
        postal_code: '75002',
        country: 'FR',
        accounting_currency: 'EUR',
        email: 'pilotage.fr.demo@cashpilot.cloud',
        phone: '+33 1 83 64 20 26',
        website: 'https://cashpilot.tech',
        iban: 'FR7612345678901234567890123',
      },
      accounts: {
        capital: '101',
        reserves: '1068',
        loan: '164',
        fixedAsset: '2183',
        accumulatedDepreciation: '28183',
        receivable: '411',
        payable: '401',
        outputVat: '44571',
        inputVat: '44566',
        bank: '512',
        rentExpense: '6132',
        consultingExpense: '6226',
        telecomExpense: '626',
        interestExpense: '6611',
        depreciationExpense: '6811',
        revenue: '706',
      },
      chart: [
        ['101', 'Capital social', 'equity'],
        ['1068', 'Autres réserves', 'equity'],
        ['164', 'Emprunts bancaires', 'liability'],
        ['2183', 'Matériel de bureau et informatique', 'asset'],
        ['28183', 'Amortissements du matériel informatique', 'asset'],
        ['411', 'Clients', 'asset'],
        ['401', 'Fournisseurs', 'liability'],
        ['44571', 'TVA collectée', 'liability'],
        ['44566', 'TVA déductible', 'asset'],
        ['512', 'Banques', 'asset'],
        ['6132', 'Locations immobilières', 'expense'],
        ['6226', 'Honoraires', 'expense'],
        ['626', 'Télécom et internet', 'expense'],
        ['6611', 'Intérêts des emprunts', 'expense'],
        ['6811', 'Dotations aux amortissements', 'expense'],
        ['706', 'Prestations de services', 'revenue'],
      ],
      mappings: [
        ['invoice', 'service', '411', '706', 'Prestations de services'],
        ['payment', 'bank_transfer', '512', '411', 'Encaissement client'],
        ['expense', 'rent', '6132', '512', 'Loyer'],
        ['expense', 'consulting', '6226', '512', 'Honoraires'],
        ['expense', 'telecom', '626', '512', 'Télécom'],
      ],
      taxRates: [
        ['TVA 20%', 0.2, 'output', '44571', true],
        ['TVA 10%', 0.1, 'output', '44571', false],
        ['TVA déductible 20%', 0.2, 'input', '44566', true],
      ],
      openingLines: [
        { accountCode: '512', debit: 45000, description: 'Ouverture banque' },
        { accountCode: '411', debit: 9000, description: 'Ouverture créances clients' },
        { accountCode: '2183', debit: 14000, description: 'Ouverture immobilisations' },
        { accountCode: '401', credit: 7000, description: 'Ouverture dettes fournisseurs' },
        { accountCode: '164', credit: 16000, description: 'Ouverture emprunts' },
        { accountCode: '101', credit: 25000, description: 'Ouverture capital' },
        { accountCode: '1068', credit: 20000, description: 'Ouverture réserves' },
      ],
      clients: [
        { key: 'retail', company_name: 'Luxe Retail Paris', contact_name: 'Claire Martin', email: 'achats@luxe-retail.demo', address: '8 Avenue de l Opera, Paris', vat_number: 'FRRETDEMO001' },
        { key: 'tech', company_name: 'Nordic Tech France', contact_name: 'Hugo Bernard', email: 'finance@nordic-tech.demo', address: '17 Rue des Startups, Lille', vat_number: 'FRTECHDEMO002' },
        { key: 'industry', company_name: 'Atelier Industrie Ouest', contact_name: 'Sonia Petit', email: 'daf@atelier-ouest.demo', address: '42 Quai des Chantiers, Nantes', vat_number: 'FRINDDEMO003' },
      ],
      invoices: [
        { code: '001', number: `FR-DEMO-${CURRENT_YEAR}-001`, clientKey: 'retail', month: 1, day: 10, totalHt: 12000, paymentAmount: 14400, paymentMonth: 1, paymentDay: 24 },
        { code: '002', number: `FR-DEMO-${CURRENT_YEAR}-002`, clientKey: 'tech', month: 2, day: 12, totalHt: 14500, paymentAmount: 8000, paymentMonth: 2, paymentDay: 25 },
        { code: '003', number: `FR-DEMO-${CURRENT_YEAR}-003`, clientKey: 'industry', month: 3, day: 1, totalHt: 10500, paymentAmount: 0, paymentMonth: 3, paymentDay: 1 },
      ],
      expenses: [
        { code: '001', month: 1, day: 8, baseAmount: 2500, accountCode: '6132', category: 'rent', description: 'Loyer du siège' },
        { code: '002', month: 1, day: 20, baseAmount: 1400, accountCode: '6226', category: 'consulting', description: 'Mission de conseil CFO' },
        { code: '003', month: 2, day: 8, baseAmount: 2500, accountCode: '6132', category: 'rent', description: 'Loyer du siège' },
        { code: '004', month: 2, day: 18, baseAmount: 450, accountCode: '626', category: 'telecom', description: 'Télécom et cloud' },
        { code: '005', month: 3, day: 1, baseAmount: 600, accountCode: '626', category: 'telecom', description: 'Télécom et cloud' },
      ],
      supplierPayments: [
        { code: '001', month: 1, day: 31, amount: 2800, description: 'Règlement fournisseurs janvier' },
        { code: '002', month: 2, day: 28, amount: 3500, description: 'Règlement fournisseurs février' },
      ],
      capex: [
        { code: '001', month: 2, day: 5, amount: 4000, description: 'Achat matériel informatique' },
      ],
      interest: [
        { code: '001', month: 1, day: 31, amount: 320, description: 'Intérêts emprunt bancaire' },
        { code: '002', month: 2, day: 28, amount: 330, description: 'Intérêts emprunt bancaire' },
        { code: '003', month: 3, day: 1, amount: 335, description: 'Intérêts emprunt bancaire' },
      ],
      depreciation: [
        { code: '001', month: 1, day: 31, amount: 250, description: 'Amortissement matériel informatique' },
        { code: '002', month: 2, day: 28, amount: 300, description: 'Amortissement matériel informatique' },
        { code: '003', month: 3, day: 1, amount: 320, description: 'Amortissement matériel informatique' },
      ],
    },
    BE: {
      country: 'BE',
      label: 'Belgique',
      email: 'pilotage.be.demo@cashpilot.cloud',
      passwordEnvVar: 'PILOTAGE_DEMO_PASSWORD_BE',
      fullName: 'Pilotage Demo Belgique',
      region: 'belgium',
      sector: 'b2b_services',
      vatRate: 21,
      company: {
        company_name: 'CashPilot Demo Belgium SRL',
        company_type: 'company',
        registration_number: 'BE-0765.432.109',
        tax_id: 'BE0765432109',
        address: '18 Avenue du Pilotage',
        city: 'Bruxelles',
        postal_code: '1000',
        country: 'BE',
        accounting_currency: 'EUR',
        email: 'pilotage.be.demo@cashpilot.cloud',
        phone: '+32 2 430 20 26',
        website: 'https://cashpilot.tech',
        iban: 'BE68539007547034',
      },
      accounts: {
        capital: '101',
        reserves: '130',
        loan: '174',
        fixedAsset: '240',
        accumulatedDepreciation: '2818',
        receivable: '400',
        payable: '440',
        outputVat: '451',
        inputVat: '411',
        bank: '550',
        rentExpense: '6132',
        consultingExpense: '610',
        telecomExpense: '610',
        interestExpense: '650',
        depreciationExpense: '6302',
        revenue: '7061',
      },
      chart: [
        ['101', 'Capital souscrit', 'equity'],
        ['130', 'Réserves', 'equity'],
        ['174', 'Emprunts à plus d un an', 'liability'],
        ['240', 'Mobilier et matériel', 'asset'],
        ['2818', 'Amortissements sur immobilisations corporelles', 'asset'],
        ['400', 'Créances commerciales - Clients', 'asset'],
        ['440', 'Dettes commerciales - Fournisseurs', 'liability'],
        ['451', 'TVA à payer', 'liability'],
        ['411', 'TVA à récupérer', 'asset'],
        ['550', 'Banque', 'asset'],
        ['610', 'Services et biens divers', 'expense'],
        ['6132', 'Loyers', 'expense'],
        ['650', 'Charges d intérêts', 'expense'],
        ['6302', 'Dotations aux amortissements', 'expense'],
        ['7061', 'Prestations de services', 'revenue'],
      ],
      mappings: [
        ['invoice', 'service', '400', '7061', 'Prestations de services'],
        ['payment', 'bank_transfer', '550', '400', 'Encaissement client'],
        ['expense', 'rent', '6132', '550', 'Loyer'],
        ['expense', 'consulting', '610', '550', 'Services externes'],
        ['expense', 'telecom', '610', '550', 'Frais télécom'],
      ],
      taxRates: [
        ['TVA 21%', 0.21, 'output', '451', true],
        ['TVA 12%', 0.12, 'output', '451', false],
        ['TVA déductible 21%', 0.21, 'input', '411', true],
      ],
      openingLines: [
        { accountCode: '550', debit: 52000, description: 'Ouverture banque' },
        { accountCode: '400', debit: 8000, description: 'Ouverture créances clients' },
        { accountCode: '240', debit: 18000, description: 'Ouverture immobilisations' },
        { accountCode: '440', credit: 6000, description: 'Ouverture dettes fournisseurs' },
        { accountCode: '174', credit: 12000, description: 'Ouverture emprunts' },
        { accountCode: '101', credit: 35000, description: 'Ouverture capital' },
        { accountCode: '130', credit: 25000, description: 'Ouverture réserves' },
      ],
      clients: [
        { key: 'brussels', company_name: 'Brussels Growth Studio', contact_name: 'Julie Vermeulen', email: 'finance@growth-studio.demo', address: '45 Rue du Marche aux Herbes, Bruxelles', vat_number: 'BECLIENT001' },
        { key: 'antwerp', company_name: 'Antwerp Service Partners', contact_name: 'Tom Jacobs', email: 'ap@antwerp-service.demo', address: '9 Meir, Antwerpen', vat_number: 'BECLIENT002' },
        { key: 'ghent', company_name: 'Gent Digital Operations', contact_name: 'Lies De Smet', email: 'finance@gent-digital.demo', address: '12 Korenmarkt, Gent', vat_number: 'BECLIENT003' },
      ],
      invoices: [
        { code: '001', number: `BE-DEMO-${CURRENT_YEAR}-001`, clientKey: 'brussels', month: 1, day: 14, totalHt: 15000, paymentAmount: 11500, paymentMonth: 1, paymentDay: 30 },
        { code: '002', number: `BE-DEMO-${CURRENT_YEAR}-002`, clientKey: 'antwerp', month: 2, day: 15, totalHt: 13200, paymentAmount: 10000, paymentMonth: 2, paymentDay: 26 },
        { code: '003', number: `BE-DEMO-${CURRENT_YEAR}-003`, clientKey: 'ghent', month: 3, day: 1, totalHt: 9800, paymentAmount: 0, paymentMonth: 3, paymentDay: 1 },
      ],
      expenses: [
        { code: '001', month: 1, day: 10, baseAmount: 2800, accountCode: '610', category: 'consulting', description: 'Sous-traitance projet analytique' },
        { code: '002', month: 2, day: 11, baseAmount: 2100, accountCode: '6132', category: 'rent', description: 'Loyer et charges bureau' },
        { code: '003', month: 3, day: 1, baseAmount: 900, accountCode: '610', category: 'telecom', description: 'Connectivité et outils SaaS' },
      ],
      supplierPayments: [
        { code: '001', month: 1, day: 31, amount: 2500, description: 'Règlement fournisseurs janvier' },
        { code: '002', month: 2, day: 28, amount: 3000, description: 'Règlement fournisseurs février' },
      ],
      capex: [
        { code: '001', month: 2, day: 7, amount: 3500, description: 'Renouvellement matériel bureau' },
      ],
      interest: [
        { code: '001', month: 1, day: 31, amount: 260, description: 'Charges d intérêts' },
        { code: '002', month: 2, day: 28, amount: 270, description: 'Charges d intérêts' },
        { code: '003', month: 3, day: 1, amount: 275, description: 'Charges d intérêts' },
      ],
      depreciation: [
        { code: '001', month: 1, day: 31, amount: 220, description: 'Dotation aux amortissements' },
        { code: '002', month: 2, day: 28, amount: 240, description: 'Dotation aux amortissements' },
        { code: '003', month: 3, day: 1, amount: 250, description: 'Dotation aux amortissements' },
      ],
    },
    OHADA: {
      country: 'OHADA',
      label: 'OHADA',
      email: 'pilotage.ohada.demo@cashpilot.cloud',
      passwordEnvVar: 'PILOTAGE_DEMO_PASSWORD_OHADA',
      fullName: 'Pilotage Demo OHADA',
      region: 'ohada',
      sector: 'b2b_services',
      vatRate: 18,
      company: {
        company_name: 'CashPilot Demo Afrique SARL',
        company_type: 'company',
        registration_number: 'RCCM-CM-2026-DEMO',
        tax_id: 'CMOHADA2026001',
        address: 'Boulevard de la Croissance, Akwa',
        city: 'Douala',
        postal_code: '0000',
        country: 'CM',
        accounting_currency: 'XAF',
        email: 'pilotage.ohada.demo@cashpilot.cloud',
        phone: '+237 6 75 43 21 09',
        website: 'https://cashpilot.tech',
        iban: '',
      },
      accounts: {
        capital: '101',
        reserves: '106',
        loan: '162',
        fixedAsset: '244',
        accumulatedDepreciation: '2844',
        receivable: '411',
        payable: '401',
        outputVat: '4431',
        inputVat: '4452',
        bank: '521',
        rentExpense: '6222',
        consultingExpense: '6324',
        telecomExpense: '628',
        interestExpense: '6713',
        depreciationExpense: '6811',
        revenue: '706',
      },
      chart: [
        ['101', 'Capital social', 'equity'],
        ['106', 'Réserves', 'equity'],
        ['162', 'Emprunts et dettes financières', 'liability'],
        ['244', 'Matériel et mobilier de bureau', 'asset'],
        ['2844', 'Amortissements du matériel de bureau', 'asset'],
        ['411', 'Clients', 'asset'],
        ['401', 'Fournisseurs', 'liability'],
        ['4431', 'TVA facturée sur ventes', 'liability'],
        ['4452', 'TVA récupérable sur achats', 'asset'],
        ['521', 'Banques locales', 'asset'],
        ['6222', 'Locations de bâtiments', 'expense'],
        ['6324', 'Honoraires', 'expense'],
        ['628', 'Télécommunications', 'expense'],
        ['6713', 'Intérêts sur emprunts', 'expense'],
        ['6811', 'Dotations aux amortissements', 'expense'],
        ['706', 'Services vendus', 'revenue'],
      ],
      mappings: [
        ['invoice', 'service', '411', '706', 'Services vendus'],
        ['payment', 'bank_transfer', '521', '411', 'Encaissement client'],
        ['expense', 'rent', '6222', '521', 'Loyer'],
        ['expense', 'consulting', '6324', '521', 'Honoraires'],
        ['expense', 'telecom', '628', '521', 'Télécommunications'],
      ],
      taxRates: [
        ['TVA 18%', 0.18, 'output', '4431', true],
        ['TVA récupérable 18%', 0.18, 'input', '4452', true],
      ],
      openingLines: [
        { accountCode: '521', debit: 30000000, description: 'Ouverture banque' },
        { accountCode: '411', debit: 7000000, description: 'Ouverture créances clients' },
        { accountCode: '244', debit: 12000000, description: 'Ouverture immobilisations' },
        { accountCode: '401', credit: 5000000, description: 'Ouverture dettes fournisseurs' },
        { accountCode: '162', credit: 10000000, description: 'Ouverture emprunts' },
        { accountCode: '101', credit: 20000000, description: 'Ouverture capital' },
        { accountCode: '106', credit: 14000000, description: 'Ouverture réserves' },
      ],
      clients: [
        { key: 'douala', company_name: 'Douala Distribution SAS', contact_name: 'Arnaud Mbarga', email: 'finance@douala-distribution.demo', address: 'Bonanjo, Douala', vat_number: 'CMCLIENT001' },
        { key: 'abidjan', company_name: 'Abidjan Services Conseil', contact_name: 'Awa Traore', email: 'daf@abidjan-services.demo', address: 'Plateau, Abidjan', vat_number: 'CICLIENT002' },
        { key: 'libreville', company_name: 'Libreville Retail Network', contact_name: 'Joel Ndzi', email: 'finance@libreville-retail.demo', address: 'Glass, Libreville', vat_number: 'GACLIENT003' },
      ],
      invoices: [
        { code: '001', number: `OHADA-DEMO-${CURRENT_YEAR}-001`, clientKey: 'douala', month: 1, day: 11, totalHt: 8500000, paymentAmount: 7200000, paymentMonth: 1, paymentDay: 27 },
        { code: '002', number: `OHADA-DEMO-${CURRENT_YEAR}-002`, clientKey: 'abidjan', month: 2, day: 13, totalHt: 9600000, paymentAmount: 6000000, paymentMonth: 2, paymentDay: 24 },
        { code: '003', number: `OHADA-DEMO-${CURRENT_YEAR}-003`, clientKey: 'libreville', month: 3, day: 1, totalHt: 7200000, paymentAmount: 0, paymentMonth: 3, paymentDay: 1 },
      ],
      expenses: [
        { code: '001', month: 1, day: 9, baseAmount: 1800000, accountCode: '6222', category: 'rent', description: 'Loyer siège Douala' },
        { code: '002', month: 2, day: 16, baseAmount: 1250000, accountCode: '6324', category: 'consulting', description: 'Honoraires conformité OHADA' },
        { code: '003', month: 3, day: 1, baseAmount: 420000, accountCode: '628', category: 'telecom', description: 'Télécommunications et data' },
      ],
      supplierPayments: [
        { code: '001', month: 1, day: 31, amount: 1500000, description: 'Règlement fournisseurs janvier' },
        { code: '002', month: 2, day: 28, amount: 1800000, description: 'Règlement fournisseurs février' },
      ],
      capex: [
        { code: '001', month: 2, day: 6, amount: 3200000, description: 'Achat matériel de production' },
      ],
      interest: [
        { code: '001', month: 1, day: 31, amount: 180000, description: 'Intérêts emprunt bancaire' },
        { code: '002', month: 2, day: 28, amount: 195000, description: 'Intérêts emprunt bancaire' },
        { code: '003', month: 3, day: 1, amount: 200000, description: 'Intérêts emprunt bancaire' },
      ],
      depreciation: [
        { code: '001', month: 1, day: 31, amount: 220000, description: 'Dotation amortissements' },
        { code: '002', month: 2, day: 28, amount: 240000, description: 'Dotation amortissements' },
        { code: '003', month: 3, day: 1, amount: 260000, description: 'Dotation amortissements' },
      ],
    },
  };
}

function buildDataset(config) {
  const userSeed = `pilotage-demo:${config.country}`;
  const userId = uuidFromSeed(`${userSeed}:user`);
  const profileId = uuidFromSeed(`${userSeed}:profile`);
  const companyId = uuidFromSeed(`${userSeed}:company`);

  const clientRows = config.clients.map((client) => ({
    id: uuidFromSeed(`${userSeed}:client:${client.key}`),
    user_id: userId,
    company_name: client.company_name,
    contact_name: client.contact_name,
    email: client.email,
    address: client.address,
    vat_number: client.vat_number,
    preferred_currency: config.company.accounting_currency,
    created_at: new Date().toISOString(),
  }));

  const clientIdByKey = new Map(clientRows.map((client, index) => [config.clients[index].key, client.id]));

  const invoiceRows = config.invoices.map((invoice) => {
    const totalVat = roundAmount(invoice.totalHt * (config.vatRate / 100));
    const totalTtc = roundAmount(invoice.totalHt + totalVat);
    const amountPaid = roundAmount(invoice.paymentAmount || 0);
    const balanceDue = roundAmount(totalTtc - amountPaid);
    const paymentStatus = amountPaid <= 0 ? 'unpaid' : amountPaid < totalTtc ? 'partial' : 'paid';
    const status = paymentStatus === 'paid' ? 'paid' : 'sent';
    const date = isoDate(CURRENT_YEAR, invoice.month, invoice.day);

    return {
      id: uuidFromSeed(`${userSeed}:invoice:${invoice.code}`),
      user_id: userId,
      client_id: clientIdByKey.get(invoice.clientKey),
      invoice_number: invoice.number,
      date,
      due_date: addDays(date, 21),
      status,
      payment_status: paymentStatus,
      amount_paid: amountPaid,
      balance_due: balanceDue,
      total_ht: roundAmount(invoice.totalHt),
      tax_rate: config.vatRate,
      total_ttc: totalTtc,
      notes: `${config.label} demo invoice`,
      created_at: `${date}T09:00:00Z`,
    };
  });

  const paymentRows = config.invoices
    .filter((invoice) => Number(invoice.paymentAmount) > 0)
    .map((invoice) => ({
      code: invoice.code,
      month: invoice.paymentMonth,
      day: invoice.paymentDay,
      id: uuidFromSeed(`${userSeed}:payment:${invoice.code}`),
      user_id: userId,
      invoice_id: uuidFromSeed(`${userSeed}:invoice:${invoice.code}`),
      client_id: clientIdByKey.get(invoice.clientKey),
      amount: roundAmount(invoice.paymentAmount),
      payment_method: 'bank_transfer',
      payment_date: isoDate(CURRENT_YEAR, invoice.paymentMonth, invoice.paymentDay),
      reference: `WIRE-${config.country}-${CURRENT_YEAR}-${invoice.code}`,
      notes: `${config.label} demo payment`,
      receipt_number: `REC-${config.country}-${CURRENT_YEAR}-${invoice.code}`,
      is_lump_sum: false,
      created_at: `${isoDate(CURRENT_YEAR, invoice.paymentMonth, invoice.paymentDay)}T15:00:00Z`,
    }));

  const expenseRows = config.expenses.map((expense) => {
    const amount = roundAmount(expense.baseAmount * (1 + config.vatRate / 100));
    const expenseDate = isoDate(CURRENT_YEAR, expense.month, expense.day);
    return {
      id: uuidFromSeed(`${userSeed}:expense:${expense.code}`),
      user_id: userId,
      amount,
      category: expense.category,
      description: expense.description,
      expense_date: expenseDate,
      created_at: `${expenseDate}T10:00:00Z`,
    };
  });

  const extendedDataset = buildFullDemoDataset({
    CURRENT_YEAR,
    config,
    userSeed,
    userId,
    clientRows,
    invoiceRows,
    paymentRows,
    uuidFromSeed,
    roundAmount,
    isoDate,
    addDays,
  });

  const profileRow = {
    id: profileId,
    user_id: userId,
    full_name: config.fullName,
    company_name: config.company.company_name,
    role: 'user',
    onboarding_completed: true,
    onboarding_step: 6,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const companyRow = {
    id: companyId,
    user_id: userId,
    ...config.company,
    ...extendedDataset.companyPatch,
    currency: config.company.accounting_currency,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const settingsRow = {
    user_id: userId,
    country: config.country,
    is_initialized: true,
    auto_journal_enabled: false,
    updated_at: new Date().toISOString(),
  };

  const userRoleRow = {
    user_id: userId,
    role: 'user',
  };

  const chartRows = config.chart.map(([accountCode, accountName, accountType]) => ({
    id: uuidFromSeed(`${userSeed}:account:${accountCode}`),
    user_id: userId,
    account_code: accountCode,
    account_name: accountName,
    account_type: accountType,
    is_active: true,
  }));

  const mappingRows = config.mappings.map(([sourceType, sourceCategory, debitAccountCode, creditAccountCode, description]) => ({
    id: uuidFromSeed(`${userSeed}:mapping:${sourceType}:${sourceCategory}`),
    user_id: userId,
    source_type: sourceType,
    source_category: sourceCategory,
    debit_account_code: debitAccountCode,
    credit_account_code: creditAccountCode,
    description,
  }));

  const taxRateRows = config.taxRates.map(([name, rate, taxType, accountCode, isDefault]) => ({
    id: uuidFromSeed(`${userSeed}:tax:${name}`),
    user_id: userId,
    name,
    rate,
    tax_type: taxType,
    account_code: accountCode,
    is_default: isDefault,
  }));

  const entryGroups = [
    buildOpeningEntries(config),
    ...config.invoices.map((invoice) => buildInvoiceEntries(config, invoice)),
    ...paymentRows.map((payment) => buildPaymentEntries(config, payment)),
    ...config.expenses.map((expense) => buildExpenseEntries(config, expense)),
    ...config.supplierPayments.map((supplierPayment) => buildSupplierPaymentEntries(config, supplierPayment)),
    ...config.capex.map((capex) => buildCapexEntries(config, capex)),
    ...config.interest.map((interest) => buildInterestEntries(config, interest)),
    ...config.depreciation.map((depreciation) => buildDepreciationEntries(config, depreciation)),
  ];

  ensureBalanced(entryGroups);

  const accountingEntries = entryGroups.flatMap((group, groupIndex) =>
    group.lines.map((line, lineIndex) => ({
      id: uuidFromSeed(`${userSeed}:entry:${group.ref}:${line.accountCode}:${groupIndex}:${lineIndex}`),
      user_id: userId,
      transaction_date: group.date,
      description: line.description,
      account_code: line.accountCode,
      debit: line.debit,
      credit: line.credit,
      source_type: 'manual_demo',
      source_id: uuidFromSeed(`${userSeed}:source:${group.ref}`),
      journal: 'DEMO',
      entry_ref: group.ref,
      is_auto: false,
      created_at: `${group.date}T12:00:00Z`,
    }))
  );

  return {
    config,
    userId,
    profileRow,
    companyRow,
    settingsRow,
    userRoleRow,
    chartRows,
    mappingRows,
    taxRateRows,
    clientRows: extendedDataset.clientRows,
    invoiceRows: extendedDataset.invoiceRows,
    paymentRows: extendedDataset.paymentRows,
    expenseRows,
    accountingEntries,
    paymentTermRows: extendedDataset.paymentTermRows,
    productCategoryRows: extendedDataset.productCategoryRows,
    serviceCategoryRows: extendedDataset.serviceCategoryRows,
    supplierRows: extendedDataset.supplierRows,
    supplierProductCategoryRows: extendedDataset.supplierProductCategoryRows,
    supplierProductRows: extendedDataset.supplierProductRows,
    supplierServiceRows: extendedDataset.supplierServiceRows,
    productRows: extendedDataset.productRows,
    serviceRows: extendedDataset.serviceRows,
    invoiceItemRows: extendedDataset.invoiceItemRows,
    paymentAllocationRows: extendedDataset.paymentAllocationRows,
    quoteRows: extendedDataset.quoteRows,
    purchaseOrderRows: extendedDataset.purchaseOrderRows,
    recurringInvoiceRows: extendedDataset.recurringInvoiceRows,
    recurringInvoiceLineItemRows: extendedDataset.recurringInvoiceLineItemRows,
    paymentReminderRuleRows: extendedDataset.paymentReminderRuleRows,
    paymentReminderLogRows: extendedDataset.paymentReminderLogRows,
    supplierOrderRows: extendedDataset.supplierOrderRows,
    supplierOrderItemRows: extendedDataset.supplierOrderItemRows,
    supplierInvoiceRows: extendedDataset.supplierInvoiceRows,
    supplierInvoiceLineItemRows: extendedDataset.supplierInvoiceLineItemRows,
    projectRows: extendedDataset.projectRows,
    taskRows: extendedDataset.taskRows,
    subtaskRows: extendedDataset.subtaskRows,
    timesheetRows: extendedDataset.timesheetRows,
    creditNoteRows: extendedDataset.creditNoteRows,
    creditNoteItemRows: extendedDataset.creditNoteItemRows,
    deliveryNoteRows: extendedDataset.deliveryNoteRows,
    deliveryNoteItemRows: extendedDataset.deliveryNoteItemRows,
    receivableRows: extendedDataset.receivableRows,
    payableRows: extendedDataset.payableRows,
    debtPaymentRows: extendedDataset.debtPaymentRows,
    productStockHistoryRows: extendedDataset.productStockHistoryRows,
    stockAlertRows: extendedDataset.stockAlertRows,
    teamMemberRows: extendedDataset.teamMemberRows,
    notificationPreferencesRow: extendedDataset.notificationPreferencesRow,
    notificationRows: extendedDataset.notificationRows,
    webhookRows: extendedDataset.webhookRows,
    webhookDeliveryRows: extendedDataset.webhookDeliveryRows,
    bankConnectionRows: extendedDataset.bankConnectionRows,
    bankSyncHistoryRows: extendedDataset.bankSyncHistoryRows,
    bankTransactionRows: extendedDataset.bankTransactionRows,
    peppolLogRows: extendedDataset.peppolLogRows,
    billingInfoRow: extendedDataset.billingInfoRow,
    invoiceSettingsRow: extendedDataset.invoiceSettingsRow,
  };
}

async function ensureAuthUser(adminClient, dataset, options) {
  const passwordFromEnv = process.env[dataset.config.passwordEnvVar];
  const generatedPassword = passwordFromEnv || randomPassword();

  let existingUser = null;
  let page = 1;
  const perPage = 200;

  while (!existingUser) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Unable to list auth users: ${error.message}`);
    }

    const users = data?.users || [];
    existingUser = users.find((user) => String(user.email || '').toLowerCase() === dataset.config.email.toLowerCase()) || null;
    if (users.length < perPage || existingUser) break;
    page += 1;
  }

  const shouldSetPassword = !existingUser || options.resetPasswords || Boolean(passwordFromEnv);

  if (!existingUser) {
    const { data, error } = await adminClient.auth.admin.createUser({
      id: dataset.userId,
      email: dataset.config.email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: dataset.config.fullName,
      },
    });

    if (error) {
      throw new Error(`Unable to create auth user ${dataset.config.email}: ${error.message}`);
    }

    return {
      userId: data.user.id,
      password: generatedPassword,
      passwordChanged: true,
      created: true,
    };
  }

  if (existingUser.id !== dataset.userId) {
    throw new Error(`Existing auth user for ${dataset.config.email} has unexpected id ${existingUser.id}.`);
  }

  if (shouldSetPassword) {
    const { error } = await adminClient.auth.admin.updateUserById(existingUser.id, {
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: dataset.config.fullName,
      },
    });

    if (error) {
      throw new Error(`Unable to update password for ${dataset.config.email}: ${error.message}`);
    }
  }

  return {
    userId: existingUser.id,
    password: shouldSetPassword ? generatedPassword : null,
    passwordChanged: shouldSetPassword,
    created: false,
  };
}

async function deleteRows(client, table, filterColumn, value) {
  const { error } = await client.from(table).delete().eq(filterColumn, value);
  if (error) {
    throw new Error(`Failed to cleanup ${table}: ${error.message}`);
  }
}

async function deleteRowsByIds(client, table, ids) {
  if (!ids.length) return;
  const { error } = await client.from(table).delete().in('id', ids);
  if (error) {
    throw new Error(`Failed to cleanup ${table}: ${error.message}`);
  }
}

async function cleanupDemoDataset(client, dataset) {
  await deleteRowsByIds(client, 'webhook_deliveries', dataset.webhookDeliveryRows.map((row) => row.id));
  await deleteRowsByIds(client, 'bank_transactions', dataset.bankTransactionRows.map((row) => row.id));
  await deleteRowsByIds(client, 'bank_sync_history', dataset.bankSyncHistoryRows.map((row) => row.id));
  await deleteRowsByIds(client, 'delivery_note_items', dataset.deliveryNoteItemRows.map((row) => row.id));
  await deleteRowsByIds(client, 'credit_note_items', dataset.creditNoteItemRows.map((row) => row.id));
  await deleteRowsByIds(client, 'recurring_invoice_line_items', dataset.recurringInvoiceLineItemRows.map((row) => row.id));
  await deleteRowsByIds(client, 'supplier_invoice_line_items', dataset.supplierInvoiceLineItemRows.map((row) => row.id));
  await deleteRowsByIds(client, 'supplier_order_items', dataset.supplierOrderItemRows.map((row) => row.id));
  await deleteRowsByIds(client, 'payment_allocations', dataset.paymentAllocationRows.map((row) => row.id));
  await deleteRowsByIds(client, 'invoice_items', dataset.invoiceItemRows.map((row) => row.id));
  await deleteRowsByIds(client, 'subtasks', dataset.subtaskRows.map((row) => row.id));
  await deleteRows(client, 'payments', 'user_id', dataset.userId);
  await deleteRows(client, 'timesheets', 'user_id', dataset.userId);
  await deleteRowsByIds(client, 'tasks', dataset.taskRows.map((row) => row.id));
  await deleteRows(client, 'projects', 'user_id', dataset.userId);
  await deleteRows(client, 'purchase_orders', 'user_id', dataset.userId);
  await deleteRows(client, 'quotes', 'user_id', dataset.userId);
  await deleteRows(client, 'recurring_invoices', 'user_id', dataset.userId);
  await deleteRows(client, 'payment_reminder_logs', 'user_id', dataset.userId);
  await deleteRows(client, 'payment_reminder_rules', 'user_id', dataset.userId);
  await deleteRows(client, 'credit_notes', 'user_id', dataset.userId);
  await deleteRows(client, 'delivery_notes', 'user_id', dataset.userId);
  await deleteRowsByIds(client, 'supplier_invoices', dataset.supplierInvoiceRows.map((row) => row.id));
  await deleteRowsByIds(client, 'supplier_orders', dataset.supplierOrderRows.map((row) => row.id));
  await deleteRowsByIds(client, 'suppliers', dataset.supplierRows.map((row) => row.id));
  await deleteRowsByIds(client, 'supplier_services', dataset.supplierServiceRows.map((row) => row.id));
  await deleteRowsByIds(client, 'supplier_products', dataset.supplierProductRows.map((row) => row.id));
  await deleteRowsByIds(client, 'supplier_product_categories', dataset.supplierProductCategoryRows.map((row) => row.id));
  await deleteRows(client, 'peppol_transmission_log', 'user_id', dataset.userId);
  await deleteRows(client, 'webhook_endpoints', 'user_id', dataset.userId);
  await deleteRows(client, 'bank_connections', 'user_id', dataset.userId);
  await deleteRowsByIds(client, 'stock_alerts', dataset.stockAlertRows.map((row) => row.id));
  await deleteRowsByIds(client, 'product_stock_history', dataset.productStockHistoryRows.map((row) => row.id));
  await deleteRows(client, 'products', 'user_id', dataset.userId);
  await deleteRows(client, 'services', 'user_id', dataset.userId);
  await deleteRows(client, 'product_categories', 'user_id', dataset.userId);
  await deleteRows(client, 'service_categories', 'user_id', dataset.userId);
  await deleteRows(client, 'receivables', 'user_id', dataset.userId);
  await deleteRows(client, 'payables', 'user_id', dataset.userId);
  await deleteRows(client, 'debt_payments', 'user_id', dataset.userId);
  await deleteRows(client, 'team_members', 'user_id', dataset.userId);
  await deleteRows(client, 'notification_preferences', 'user_id', dataset.userId);
  await deleteRows(client, 'billing_info', 'user_id', dataset.userId);
  await deleteRows(client, 'invoice_settings', 'user_id', dataset.userId);
  await deleteRows(client, 'expenses', 'user_id', dataset.userId);
  await deleteRows(client, 'invoices', 'user_id', dataset.userId);
  await deleteRows(client, 'clients', 'user_id', dataset.userId);
  await deleteRows(client, 'accounting_entries', 'user_id', dataset.userId);
  await deleteRows(client, 'accounting_chart_of_accounts', 'user_id', dataset.userId);
  await deleteRows(client, 'accounting_mappings', 'user_id', dataset.userId);
  await deleteRows(client, 'accounting_tax_rates', 'user_id', dataset.userId);
  await deleteRows(client, 'notifications', 'user_id', dataset.userId);
  await deleteRows(client, 'audit_log', 'user_id', dataset.userId);
  await deleteRows(client, 'user_accounting_settings', 'user_id', dataset.userId);
  await deleteRows(client, 'payment_terms', 'user_id', dataset.userId);
}

async function upsertRows(client, table, rows, onConflict) {
  if (!rows.length) return;
  const { error } = await client.from(table).upsert(rows, { onConflict });
  if (error) {
    throw new Error(`Failed to upsert ${table}: ${error.message}`);
  }
}

async function insertRows(client, table, rows) {
  if (!rows.length) return;
  const { error } = await client.from(table).insert(rows);
  if (error) {
    throw new Error(`Failed to insert ${table}: ${error.message}`);
  }
}

async function applyDataset(client, dataset, options) {
  const authSummary = await ensureAuthUser(client, dataset, options);
  await cleanupDemoDataset(client, dataset);

  await upsertRows(client, 'profiles', [dataset.profileRow], 'user_id');
  await upsertRows(client, 'company', [dataset.companyRow], 'user_id');
  await upsertRows(client, 'user_roles', [dataset.userRoleRow], 'user_id');
  await upsertRows(client, 'user_accounting_settings', [dataset.settingsRow], 'user_id');
  await upsertRows(client, 'payment_terms', dataset.paymentTermRows, 'id');
  await upsertRows(client, 'accounting_chart_of_accounts', dataset.chartRows, 'user_id,account_code');
  await upsertRows(client, 'accounting_mappings', dataset.mappingRows, 'user_id,source_type,source_category');
  await upsertRows(client, 'accounting_tax_rates', dataset.taxRateRows, 'id');
  await upsertRows(client, 'product_categories', dataset.productCategoryRows, 'id');
  await upsertRows(client, 'service_categories', dataset.serviceCategoryRows, 'id');
  await upsertRows(client, 'supplier_product_categories', dataset.supplierProductCategoryRows, 'id');
  await upsertRows(client, 'suppliers', dataset.supplierRows, 'id');
  await upsertRows(client, 'supplier_products', dataset.supplierProductRows, 'id');
  await upsertRows(client, 'supplier_services', dataset.supplierServiceRows, 'id');
  await upsertRows(client, 'products', dataset.productRows, 'id');
  await upsertRows(client, 'services', dataset.serviceRows, 'id');
  await upsertRows(client, 'clients', dataset.clientRows, 'id');
  await upsertRows(client, 'quotes', dataset.quoteRows, 'id');
  await upsertRows(client, 'purchase_orders', dataset.purchaseOrderRows, 'id');
  await upsertRows(client, 'projects', dataset.projectRows, 'id');
  await upsertRows(client, 'team_members', dataset.teamMemberRows, 'id');
  await upsertRows(client, 'invoices', dataset.invoiceRows, 'id');
  await upsertRows(client, 'invoice_items', dataset.invoiceItemRows, 'id');
  await upsertRows(
    client,
    'payments',
    dataset.paymentRows.map(({ code, month, day, ...row }) => row),
    'id'
  );
  await upsertRows(client, 'payment_allocations', dataset.paymentAllocationRows, 'id');
  await upsertRows(client, 'recurring_invoices', dataset.recurringInvoiceRows, 'id');
  await upsertRows(client, 'recurring_invoice_line_items', dataset.recurringInvoiceLineItemRows, 'id');
  await upsertRows(client, 'payment_reminder_rules', dataset.paymentReminderRuleRows, 'id');
  await upsertRows(client, 'payment_reminder_logs', dataset.paymentReminderLogRows, 'id');
  await upsertRows(client, 'supplier_orders', dataset.supplierOrderRows, 'id');
  await upsertRows(client, 'supplier_order_items', dataset.supplierOrderItemRows, 'id');
  await upsertRows(client, 'supplier_invoices', dataset.supplierInvoiceRows, 'id');
  await upsertRows(client, 'supplier_invoice_line_items', dataset.supplierInvoiceLineItemRows, 'id');
  await upsertRows(client, 'tasks', dataset.taskRows, 'id');
  await upsertRows(client, 'subtasks', dataset.subtaskRows, 'id');
  await upsertRows(client, 'timesheets', dataset.timesheetRows, 'id');
  await upsertRows(client, 'credit_notes', dataset.creditNoteRows, 'id');
  await upsertRows(client, 'credit_note_items', dataset.creditNoteItemRows, 'id');
  await upsertRows(client, 'delivery_notes', dataset.deliveryNoteRows, 'id');
  await upsertRows(client, 'delivery_note_items', dataset.deliveryNoteItemRows, 'id');
  await upsertRows(client, 'receivables', dataset.receivableRows, 'id');
  await upsertRows(client, 'payables', dataset.payableRows, 'id');
  await upsertRows(client, 'debt_payments', dataset.debtPaymentRows, 'id');
  await upsertRows(client, 'product_stock_history', dataset.productStockHistoryRows, 'id');
  await upsertRows(client, 'stock_alerts', dataset.stockAlertRows, 'id');
  await upsertRows(client, 'notification_preferences', [dataset.notificationPreferencesRow], 'id');
  await upsertRows(client, 'notifications', dataset.notificationRows, 'id');
  await upsertRows(client, 'webhook_endpoints', dataset.webhookRows, 'id');
  await upsertRows(client, 'webhook_deliveries', dataset.webhookDeliveryRows, 'id');
  await upsertRows(client, 'bank_connections', dataset.bankConnectionRows, 'id');
  await upsertRows(client, 'bank_sync_history', dataset.bankSyncHistoryRows, 'id');
  await upsertRows(client, 'bank_transactions', dataset.bankTransactionRows, 'id');
  await upsertRows(client, 'peppol_transmission_log', dataset.peppolLogRows, 'id');
  await upsertRows(client, 'billing_info', [dataset.billingInfoRow], 'id');
  await upsertRows(client, 'invoice_settings', [dataset.invoiceSettingsRow], 'id');
  await upsertRows(client, 'expenses', dataset.expenseRows, 'id');
  await upsertRows(client, 'accounting_entries', dataset.accountingEntries, 'id');

  return {
    ...authSummary,
    clients: dataset.clientRows.length,
    invoices: dataset.invoiceRows.length,
    payments: dataset.paymentRows.length,
    expenses: dataset.expenseRows.length,
    accounts: dataset.chartRows.length,
    entries: dataset.accountingEntries.length,
    products: dataset.productRows.length,
    services: dataset.serviceRows.length,
    suppliers: dataset.supplierRows.length,
    quotes: dataset.quoteRows.length,
    recurringInvoices: dataset.recurringInvoiceRows.length,
    projects: dataset.projectRows.length,
  };
}

function buildSummary(datasets) {
  return datasets.map((dataset) => ({
    country: dataset.config.country,
    email: dataset.config.email,
    company: dataset.config.company.company_name,
    accountingCurrency: dataset.config.company.accounting_currency,
    clients: dataset.clientRows.length,
    invoices: dataset.invoiceRows.length,
    payments: dataset.paymentRows.length,
    expenses: dataset.expenseRows.length,
    entries: dataset.accountingEntries.length,
    products: dataset.productRows.length,
    services: dataset.serviceRows.length,
    suppliers: dataset.supplierRows.length,
    quotes: dataset.quoteRows.length,
    recurringInvoices: dataset.recurringInvoiceRows.length,
    projects: dataset.projectRows.length,
  }));
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const configs = buildDemoConfigs();
  const selectedDatasets = options.countries
    .map((country) => configs[country])
    .filter(Boolean)
    .map((config) => buildDataset(config));

  if (!selectedDatasets.length) {
    throw new Error('No valid country selected. Use FR, BE, OHADA.');
  }

  if (options.dryRun) {
    console.log(JSON.stringify({ mode: 'dry-run', year: CURRENT_YEAR, datasets: buildSummary(selectedDatasets) }, null, 2));
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply.');
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const applied = [];

  for (const dataset of selectedDatasets) {
    const result = await applyDataset(client, dataset, options);
    applied.push({
      country: dataset.config.country,
      email: dataset.config.email,
      company: dataset.config.company.company_name,
      password: result.password,
      passwordChanged: result.passwordChanged,
      created: result.created,
      counts: {
        clients: result.clients,
        invoices: result.invoices,
        payments: result.payments,
        expenses: result.expenses,
        accounts: result.accounts,
        entries: result.entries,
        products: result.products,
        services: result.services,
        suppliers: result.suppliers,
        quotes: result.quotes,
        recurringInvoices: result.recurringInvoices,
        projects: result.projects,
      },
    });
  }

  console.log(JSON.stringify({ mode: 'apply', year: CURRENT_YEAR, datasets: applied }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
