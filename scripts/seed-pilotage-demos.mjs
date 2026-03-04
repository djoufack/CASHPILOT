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

function isoTimestamp(date, hour = 9, minute = 0) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${date}T${hh}:${mm}:00Z`;
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

function buildSecondaryCompanyData(config, companyPatch = {}) {
  const accountingCurrency = config.company.accounting_currency;

  switch (config.country) {
    case 'FR':
      return {
        company_name: 'CashPilot Demo France Portfolio SARL',
        company_type: 'company',
        registration_number: 'RCS-LYON-2026-DEMO-02',
        tax_id: 'FRDEMO2026002',
        address: '18 Quai du Pilotage',
        city: 'Lyon',
        postal_code: '69002',
        country: 'FR',
        accounting_currency: accountingCurrency,
        currency: accountingCurrency,
        email: 'pilotage.fr.portfolio@cashpilot.cloud',
        phone: '+33 4 72 44 20 26',
        website: 'https://cashpilot.tech',
        bank_name: `${companyPatch.bank_name || 'Banque Demo France'} Portfolio`,
        bank_account: 'FR76 1234 5678 9012 3456 7890 456',
        iban: 'FR7612345678901234567890456',
        swift: companyPatch.swift || 'BNPAFRPP',
        peppol_endpoint_id: '0002:cashpilot-fr-demo-portfolio',
        peppol_scheme_id: companyPatch.peppol_scheme_id || '0002',
        peppol_ap_provider: companyPatch.peppol_ap_provider || 'scrada',
      };
    case 'BE':
      return {
        company_name: 'CashPilot Demo Belgium Portfolio BV',
        company_type: 'company',
        registration_number: 'KBO-2026-DEMO-02',
        tax_id: 'BEDEMO2026002',
        address: '21 Frankrijklei',
        city: 'Antwerpen',
        postal_code: '2000',
        country: 'BE',
        accounting_currency: accountingCurrency,
        currency: accountingCurrency,
        email: 'pilotage.be.portfolio@cashpilot.cloud',
        phone: '+32 3 430 20 26',
        website: 'https://cashpilot.tech',
        bank_name: `${companyPatch.bank_name || 'Banque Demo Belgique'} Portfolio`,
        bank_account: 'BE68 5390 0754 7048',
        iban: 'BE68539007547048',
        swift: companyPatch.swift || 'GEBABEBB',
        peppol_endpoint_id: '0208:cashpilot-be-demo-portfolio',
        peppol_scheme_id: companyPatch.peppol_scheme_id || '0208',
        peppol_ap_provider: companyPatch.peppol_ap_provider || 'scrada',
      };
    default:
      return {
        company_name: 'CashPilot Demo Afrique Portfolio SARL',
        company_type: 'company',
        registration_number: 'RCCM-CM-2026-DEMO-02',
        tax_id: 'CMDEMO2026002',
        address: 'Avenue du Numerique, Yaounde',
        city: 'Yaounde',
        postal_code: '0000',
        country: 'CM',
        accounting_currency: accountingCurrency,
        currency: accountingCurrency,
        email: 'pilotage.ohada.portfolio@cashpilot.cloud',
        phone: '+237 6 99 20 20 26',
        website: 'https://cashpilot.tech',
        bank_name: `${companyPatch.bank_name || 'Banque Demo Afrique'} Portfolio`,
        bank_account: 'CM21 1000 2000 3000 4000 5000 7000',
        iban: '',
        swift: companyPatch.swift || 'SGCMCMCX',
        peppol_endpoint_id: '9915:cashpilot-ohada-demo-portfolio',
        peppol_scheme_id: companyPatch.peppol_scheme_id || '9915',
        peppol_ap_provider: companyPatch.peppol_ap_provider || 'scrada',
      };
  }
}

function buildFixedAssetScheduleRows({
  userSeed,
  assetId,
  userId,
  companyId,
  acquisitionDate,
  acquisitionCost,
  residualValue,
  usefulLifeYears,
  postedPeriods = 0,
}) {
  const cost = Number(acquisitionCost || 0);
  const residual = Number(residualValue || 0);
  const depreciableBase = roundAmount(cost - residual);
  const totalMonths = Math.max(1, Number(usefulLifeYears || 1) * 12);
  const monthlyAmount = roundAmount(depreciableBase / totalMonths);
  const rows = [];
  const runningDate = new Date(`${acquisitionDate}T00:00:00Z`);
  let accumulated = 0;

  for (let index = 0; index < totalMonths; index += 1) {
    const periodYear = runningDate.getUTCFullYear();
    const periodMonth = runningDate.getUTCMonth() + 1;
    const remaining = roundAmount(depreciableBase - accumulated);
    const depreciationAmount = index === totalMonths - 1 ? remaining : Math.min(monthlyAmount, remaining);
    accumulated = roundAmount(accumulated + depreciationAmount);
    const periodDate = isoDate(periodYear, periodMonth, 28);
    const entryRef = `AMORT-${assetId.slice(0, 8)}-${periodYear}-${String(periodMonth).padStart(2, '0')}`;

    rows.push({
      id: uuidFromSeed(`${userSeed}:fixed-asset-schedule:${assetId}:${periodYear}:${periodMonth}`),
      user_id: userId,
      asset_id: assetId,
      company_id: companyId,
      period_year: periodYear,
      period_month: periodMonth,
      depreciation_amount: depreciationAmount,
      accumulated_depreciation: accumulated,
      net_book_value: roundAmount(cost - accumulated),
      is_posted: index < postedPeriods,
      entry_ref: index < postedPeriods ? entryRef : null,
      posted_at: index < postedPeriods ? isoTimestamp(periodDate, 18, 15) : null,
      created_at: isoTimestamp(periodDate, 12),
    });

    runningDate.setUTCMonth(runningDate.getUTCMonth() + 1);
  }

  return rows;
}

function withAnalyticalDimensions(entry, primaryCompanyId, secondaryCompanyId, revenueAccountCode) {
  const accountCode = String(entry.account_code || '');

  if (entry.company_id === secondaryCompanyId) {
    return {
      ...entry,
      cost_center: 'PORT',
      department: 'CAB',
      product_line: 'PORTFOLIO',
    };
  }

  if (accountCode === String(revenueAccountCode) || accountCode.startsWith('7')) {
    return {
      ...entry,
      cost_center: 'REV',
      department: 'SALES',
      product_line: 'EXEC',
    };
  }

  if (accountCode.startsWith('2') || accountCode.startsWith('28') || accountCode.startsWith('68')) {
    return {
      ...entry,
      cost_center: 'OPS',
      department: 'FIN',
      product_line: 'ANALYTICS',
    };
  }

  if (accountCode.startsWith('4')) {
    return {
      ...entry,
      cost_center: 'REV',
      department: 'SALES',
      product_line: 'EXEC',
    };
  }

  return {
    ...entry,
    cost_center: primaryCompanyId ? 'OPS' : null,
    department: 'FIN',
    product_line: 'ANALYTICS',
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

function buildEnhancedDataset(config) {
  const base = buildDataset(config);
  const userSeed = `pilotage-demo:${config.country}`;
  const primaryCompanyId = base.companyRow.id;
  const secondaryCompanyId = uuidFromSeed(`${userSeed}:company:secondary`);
  const companyCurrency = config.company.accounting_currency;
  const amountFactor = companyCurrency === 'XAF' ? 650 : 1;
  const amount = (baseValue) => roundAmount(Number(baseValue || 0) * amountFactor);
  const secondaryCompanySeed = buildSecondaryCompanyData(config, base.companyRow);
  const now = new Date().toISOString();

  const companyRows = [
    {
      ...base.companyRow,
      created_at: base.companyRow.created_at || isoTimestamp(isoDate(CURRENT_YEAR, 1, 2), 8),
      updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 27), 8),
    },
    {
      id: secondaryCompanyId,
      user_id: base.userId,
      ...secondaryCompanySeed,
      created_at: isoTimestamp(isoDate(CURRENT_YEAR, 1, 4), 8),
      updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 28), 9),
    },
  ];

  const userCompanyPreferenceRow = {
    user_id: base.userId,
    active_company_id: primaryCompanyId,
    updated_at: now,
  };

  const primaryClientRows = base.clientRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));

  const primaryInvoiceRows = base.invoiceRows.map((row, index) => ({
    ...row,
    company_id: primaryCompanyId,
    currency: row.currency || companyCurrency,
    stripe_payment_link_id: index === 1 ? `plink_${config.country.toLowerCase()}_${CURRENT_YEAR}_001` : null,
    stripe_payment_link_url: index === 1 ? `https://buy.stripe.com/test_cashpilot_${config.country.toLowerCase()}_${CURRENT_YEAR}_001` : null,
    stripe_payment_intent_id: index === 0 && Number(row.amount_paid || 0) > 0 ? `pi_${config.country.toLowerCase()}_${CURRENT_YEAR}_001` : null,
    payment_link_created_at: index === 1 ? isoTimestamp(row.date, 14, 20) : null,
  }));

  const primaryPaymentRows = base.paymentRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));

  const primaryExpenseRows = base.expenseRows.map((row, index) => ({
    ...row,
    company_id: primaryCompanyId,
    amount_ht: row.amount_ht || roundAmount(Number(config.expenses[index]?.baseAmount || row.amount || 0)),
    tax_amount: row.tax_amount || roundAmount((Number(config.expenses[index]?.baseAmount || 0) * config.vatRate) / 100),
    tax_rate: row.tax_rate || roundAmount(config.vatRate / 100),
  }));

  const primaryQuoteRows = base.quoteRows.map((row, index) => ({
    ...row,
    company_id: primaryCompanyId,
    signature_status: index === 0 ? 'signed' : 'pending',
    signature_token: index === 1 ? uuidFromSeed(`${userSeed}:quote-sign-token:${row.id}`).replace(/-/g, '') : null,
    signature_token_expires_at: index === 1 ? isoTimestamp(isoDate(CURRENT_YEAR, 12, 31), 23, 59) : null,
    signed_by: index === 0 ? (primaryClientRows[0]?.contact_name || 'Client demo') : null,
    signer_email: index === 0 ? (primaryClientRows[0]?.email || null) : null,
    signed_at: index === 0 ? isoTimestamp(addDays(row.date, 2), 16, 40) : null,
    signature_url: index === 0 ? `https://cashpilot.tech/demo-signatures/${config.country.toLowerCase()}-quote-001.png` : null,
  }));

  const primaryProjectRows = base.projectRows.map((row, index) => ({
    ...row,
    company_id: primaryCompanyId,
    start_date: row.start_date || isoDate(CURRENT_YEAR, 1 + index, 8),
    end_date: row.end_date || addDays(isoDate(CURRENT_YEAR, 1 + index, 8), index === 0 ? 68 : 54),
  }));

  const primaryTaskRowsBase = base.taskRows.map((row, index) => {
    const projectIndex = index < 2 ? 0 : 1;
    const defaultStart = addDays(primaryProjectRows[projectIndex].start_date, 3 + index * 5);
    const startDate = row.start_date || (row.started_at ? String(row.started_at).slice(0, 10) : defaultStart);
    const endDate = row.end_date || (row.completed_at ? String(row.completed_at).slice(0, 10) : (row.due_date || addDays(startDate, 7)));
    return {
      ...row,
      company_id: primaryCompanyId,
      start_date: startDate,
      end_date: endDate,
      depends_on: [],
    };
  });

  const primaryTaskRows = primaryTaskRowsBase.map((row, index) => {
    if (index === 1) {
      return { ...row, depends_on: [primaryTaskRowsBase[0].id] };
    }

    if (index === 3) {
      return { ...row, depends_on: [primaryTaskRowsBase[2].id] };
    }

    return row;
  });

  const primaryTimesheetRows = base.timesheetRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));

  const primaryProductCategoryRows = base.productCategoryRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primarySupplierRows = base.supplierRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primarySupplierProductCategoryRows = base.supplierProductCategoryRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primarySupplierProductRows = base.supplierProductRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primarySupplierServiceRows = base.supplierServiceRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primaryProductRows = base.productRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primarySupplierOrderRows = base.supplierOrderRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primarySupplierInvoiceRows = base.supplierInvoiceRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primaryStockHistoryRows = base.productStockHistoryRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primaryStockAlertRows = base.stockAlertRows.map((row) => ({ ...row, company_id: primaryCompanyId }));

  const secondaryClientRow = {
    id: uuidFromSeed(`${userSeed}:secondary:client:001`),
    user_id: base.userId,
    company_id: secondaryCompanyId,
    company_name: `${config.label} Portfolio Holdings`,
    contact_name: 'Alex Portfolio',
    email: `portfolio.${config.country.toLowerCase()}@cashpilot.cloud`,
    address: secondaryCompanySeed.address,
    city: secondaryCompanySeed.city,
    postal_code: secondaryCompanySeed.postal_code,
    country: secondaryCompanySeed.country,
    phone: secondaryCompanySeed.phone,
    website: 'https://cashpilot.tech/portfolio',
    preferred_currency: companyCurrency,
    payment_terms: config.country === 'BE' ? '30 dagen' : '30 jours',
    electronic_invoicing_enabled: true,
    peppol_endpoint_id: secondaryCompanySeed.peppol_endpoint_id ? `${secondaryCompanySeed.peppol_endpoint_id}-client` : null,
    peppol_scheme_id: secondaryCompanySeed.peppol_scheme_id || null,
    notes: `${config.label} multi-company client`,
    created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 3), 10),
    updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 3), 10, 5),
  };

  const secondaryQuoteDate = isoDate(CURRENT_YEAR, 2, 7);
  const secondaryQuoteHt = amount(7200);
  const secondaryQuoteRow = {
    id: uuidFromSeed(`${userSeed}:secondary:quote:001`),
    user_id: base.userId,
    company_id: secondaryCompanyId,
    client_id: secondaryClientRow.id,
    quote_number: `QT-${config.country}-${CURRENT_YEAR}-901`,
    date: secondaryQuoteDate,
    status: 'sent',
    tax_rate: config.vatRate,
    total_ht: secondaryQuoteHt,
    total_ttc: roundAmount(secondaryQuoteHt * (1 + config.vatRate / 100)),
    signature_status: 'pending',
    signature_token: uuidFromSeed(`${userSeed}:secondary:quote-sign-token`).replace(/-/g, ''),
    signature_token_expires_at: isoTimestamp(isoDate(CURRENT_YEAR, 12, 31), 23, 59),
    signed_by: null,
    signer_email: secondaryClientRow.email,
    signed_at: null,
    signature_url: null,
    created_at: isoTimestamp(secondaryQuoteDate, 9),
  };

  const secondaryInvoiceDate = isoDate(CURRENT_YEAR, 2, 14);
  const secondaryInvoiceHt = amount(6800);
  const secondaryInvoiceVat = roundAmount(secondaryInvoiceHt * (config.vatRate / 100));
  const secondaryInvoiceTtc = roundAmount(secondaryInvoiceHt + secondaryInvoiceVat);
  const secondaryInvoicePaid = amount(2400);
  const secondaryInvoiceRow = {
    id: uuidFromSeed(`${userSeed}:secondary:invoice:001`),
    user_id: base.userId,
    company_id: secondaryCompanyId,
    client_id: secondaryClientRow.id,
    invoice_number: `${config.country}-PORT-${CURRENT_YEAR}-001`,
    currency: companyCurrency,
    date: secondaryInvoiceDate,
    due_date: addDays(secondaryInvoiceDate, 30),
    status: 'sent',
    payment_status: 'partial',
    amount_paid: secondaryInvoicePaid,
    balance_due: roundAmount(secondaryInvoiceTtc - secondaryInvoicePaid),
    total_ht: secondaryInvoiceHt,
    tax_rate: config.vatRate,
    total_ttc: secondaryInvoiceTtc,
    payment_terms_id: base.paymentTermRows[2]?.id || base.paymentTermRows[0]?.id || null,
    invoice_type: 'product',
    reference: `REF-${config.country}-PORT-001`,
    header_note: `${config.label} portfolio demo invoice`,
    footer_note: 'Generated for CashPilot demo',
    terms_and_conditions: 'Portfolio entity demo. Payment due in 30 days.',
    stripe_payment_link_id: `plink_${config.country.toLowerCase()}_${CURRENT_YEAR}_portfolio_001`,
    stripe_payment_link_url: `https://buy.stripe.com/test_cashpilot_${config.country.toLowerCase()}_portfolio_001`,
    payment_link_created_at: isoTimestamp(secondaryInvoiceDate, 14, 25),
    notes: `${config.label} portfolio invoice`,
    created_at: isoTimestamp(secondaryInvoiceDate, 9),
  };

  const secondaryInvoiceItemRows = [
    {
      id: uuidFromSeed(`${userSeed}:secondary:invoice-item:001`),
      invoice_id: secondaryInvoiceRow.id,
      description: 'Module portefeuille multisociete',
      item_type: 'product',
      product_id: null,
      service_id: null,
      quantity: 4,
      unit_price: amount(950),
      total: amount(3800),
      created_at: isoTimestamp(secondaryInvoiceDate, 9, 10),
    },
    {
      id: uuidFromSeed(`${userSeed}:secondary:invoice-item:002`),
      invoice_id: secondaryInvoiceRow.id,
      description: 'Consolidation des KPIs',
      item_type: 'service',
      product_id: null,
      service_id: null,
      quantity: 12,
      unit_price: amount(250),
      total: amount(3000),
      created_at: isoTimestamp(secondaryInvoiceDate, 9, 20),
    },
  ];

  const secondaryPaymentDate = isoDate(CURRENT_YEAR, 2, 26);
  const secondaryPaymentRow = {
    code: '901',
    month: 2,
    day: 26,
    id: uuidFromSeed(`${userSeed}:secondary:payment:001`),
    user_id: base.userId,
    company_id: secondaryCompanyId,
    invoice_id: secondaryInvoiceRow.id,
    client_id: secondaryClientRow.id,
    amount: secondaryInvoicePaid,
    payment_method: 'bank_transfer',
    payment_date: secondaryPaymentDate,
    reference: `WIRE-${config.country}-${CURRENT_YEAR}-901`,
    notes: `${config.label} portfolio payment`,
    receipt_number: `REC-${config.country}-${CURRENT_YEAR}-901`,
    is_lump_sum: false,
    created_at: isoTimestamp(secondaryPaymentDate, 15),
  };

  const secondaryPaymentAllocationRow = {
    id: uuidFromSeed(`${userSeed}:secondary:payment-allocation:001`),
    payment_id: secondaryPaymentRow.id,
    invoice_id: secondaryInvoiceRow.id,
    amount: secondaryPaymentRow.amount,
    created_at: isoTimestamp(secondaryPaymentDate, 16),
  };

  const secondaryExpenseDate = isoDate(CURRENT_YEAR, 2, 9);
  const secondaryExpenseHt = amount(950);
  const secondaryExpenseVat = roundAmount(secondaryExpenseHt * (config.vatRate / 100));
  const secondaryExpenseRow = {
    id: uuidFromSeed(`${userSeed}:secondary:expense:001`),
    user_id: base.userId,
    company_id: secondaryCompanyId,
    amount: roundAmount(secondaryExpenseHt + secondaryExpenseVat),
    amount_ht: secondaryExpenseHt,
    tax_amount: secondaryExpenseVat,
    tax_rate: roundAmount(config.vatRate / 100),
    category: 'consulting',
    description: `${config.label} portfolio tooling`,
    expense_date: secondaryExpenseDate,
    created_at: isoTimestamp(secondaryExpenseDate, 10),
  };

  const secondaryProductCategoryRow = {
    id: uuidFromSeed(`${userSeed}:secondary:product-category:001`),
    user_id: base.userId,
    company_id: secondaryCompanyId,
    name: `${config.label} Portfolio`,
    description: 'Portfolio specific stock items',
    created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 11),
    updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 11, 5),
  };

  const secondarySupplierProductCategoryRow = {
    id: uuidFromSeed(`${userSeed}:secondary:supplier-product-category:001`),
    user_id: base.userId,
    company_id: secondaryCompanyId,
    name: `${config.label} Modules`,
    description: 'Portfolio supply catalog',
    created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 11, 10),
    updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 11, 15),
  };

  const secondarySupplierRow = {
    id: uuidFromSeed(`${userSeed}:secondary:supplier:001`),
    user_id: base.userId,
    company_id: secondaryCompanyId,
    company_name: `${config.label} Portfolio Supply`,
    contact_person: 'Morgan Supply',
    email: `supply.${config.country.toLowerCase()}@cashpilot.cloud`,
    phone: secondaryCompanySeed.phone,
    address: secondaryCompanySeed.address,
    city: secondaryCompanySeed.city,
    postal_code: secondaryCompanySeed.postal_code,
    country: secondaryCompanySeed.country,
    website: 'https://cashpilot.tech/supply',
    bank_name: secondaryCompanySeed.bank_name,
    iban: secondaryCompanySeed.iban,
    bic_swift: secondaryCompanySeed.swift,
    supplier_type: 'both',
    payment_terms: config.country === 'BE' ? '30 dagen' : '30 jours',
    status: 'active',
    created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 12),
    updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 12, 5),
  };

  const secondarySupplierProductRow = {
    id: uuidFromSeed(`${userSeed}:secondary:supplier-product:001`),
    supplier_id: secondarySupplierRow.id,
    category_id: secondarySupplierProductCategoryRow.id,
    company_id: secondaryCompanyId,
    product_name: `Module portefeuille ${config.label}`,
    description: 'Supply catalog for multi-company demo',
    sku: `${config.country}-SUP-PORT-001`,
    unit_price: amount(390),
    unit: 'piece',
    min_stock_level: 4,
    created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 12, 10),
    updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 12, 15),
  };

  const secondarySupplierServiceRow = {
    id: uuidFromSeed(`${userSeed}:secondary:supplier-service:001`),
    supplier_id: secondarySupplierRow.id,
    company_id: secondaryCompanyId,
    service_name: `Support portefeuille ${config.label}`,
    description: 'Portfolio service support',
    pricing_type: 'fixed',
    fixed_price: amount(850),
    hourly_rate: amount(120),
    unit: 'mission',
    availability: 'available',
    created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 12, 20),
    updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 12, 25),
  };

  const secondaryProductRow = {
    id: uuidFromSeed(`${userSeed}:secondary:product:001`),
    user_id: base.userId,
    company_id: secondaryCompanyId,
    category_id: secondaryProductCategoryRow.id,
    supplier_id: secondarySupplierRow.id,
    product_name: `Module portefeuille ${config.label}`,
    description: 'Inventory item used for multi-company demos',
    sku: `${config.country}-PORT-001`,
    unit_price: amount(690),
    purchase_price: amount(390),
    stock_quantity: 14,
    min_stock_level: 4,
    unit: 'piece',
    is_active: true,
    created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 13),
    updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 13, 5),
  };

  const secondarySupplierOrderDate = isoDate(CURRENT_YEAR, 2, 11);
  const secondarySupplierOrderRow = {
    id: uuidFromSeed(`${userSeed}:secondary:supplier-order:001`),
    user_id: base.userId,
    company_id: secondaryCompanyId,
    supplier_id: secondarySupplierRow.id,
    order_number: `SO-${config.country}-${CURRENT_YEAR}-901`,
    order_date: secondarySupplierOrderDate,
    expected_delivery_date: isoDate(CURRENT_YEAR, 2, 18),
    actual_delivery_date: isoDate(CURRENT_YEAR, 2, 17),
    order_status: 'delivered',
    total_amount: amount(2730),
    notes: 'Commande multisociete de demonstration',
    created_at: isoTimestamp(secondarySupplierOrderDate, 15),
    updated_at: isoTimestamp(secondarySupplierOrderDate, 15, 5),
  };

  const secondarySupplierOrderItemRow = {
    id: uuidFromSeed(`${userSeed}:secondary:supplier-order-item:001`),
    order_id: secondarySupplierOrderRow.id,
    product_id: secondarySupplierProductRow.id,
    service_id: null,
    quantity: 7,
    unit_price: amount(390),
    total_price: amount(2730),
    created_at: isoTimestamp(secondarySupplierOrderDate, 15, 10),
  };

  const secondarySupplierInvoiceDate = isoDate(CURRENT_YEAR, 2, 17);
  const secondarySupplierInvoiceHt = amount(2310);
  const secondarySupplierInvoiceVat = roundAmount(secondarySupplierInvoiceHt * (config.vatRate / 100));
  const secondarySupplierInvoiceRow = {
    id: uuidFromSeed(`${userSeed}:secondary:supplier-invoice:001`),
    supplier_id: secondarySupplierRow.id,
    company_id: secondaryCompanyId,
    invoice_number: `SUP-${config.country}-${CURRENT_YEAR}-901`,
    invoice_date: secondarySupplierInvoiceDate,
    due_date: isoDate(CURRENT_YEAR, 3, 10),
    currency: companyCurrency,
    total_amount: roundAmount(secondarySupplierInvoiceHt + secondarySupplierInvoiceVat),
    total_ht: secondarySupplierInvoiceHt,
    total_ttc: roundAmount(secondarySupplierInvoiceHt + secondarySupplierInvoiceVat),
    vat_rate: config.vatRate,
    vat_amount: secondarySupplierInvoiceVat,
    payment_status: 'pending',
    payment_terms: config.country === 'BE' ? '30 dagen' : '30 jours',
    supplier_name_extracted: secondarySupplierRow.company_name,
    supplier_address_extracted: secondarySupplierRow.address,
    supplier_vat_number: `${config.country}-SUPVAT-901`,
    notes: 'Facture fournisseur multisociete',
    created_at: isoTimestamp(secondarySupplierInvoiceDate, 16),
    updated_at: isoTimestamp(secondarySupplierInvoiceDate, 16, 5),
    ai_extracted: true,
    ai_confidence: 0.95,
    ai_extracted_at: isoTimestamp(secondarySupplierInvoiceDate, 16, 10),
    ai_raw_response: { provider: 'demo', quality: 'high', company: 'secondary' },
    iban: secondarySupplierRow.iban,
    bic: secondarySupplierRow.bic_swift,
  };

  const secondarySupplierInvoiceLineItemRow = {
    id: uuidFromSeed(`${userSeed}:secondary:supplier-invoice-line:001`),
    invoice_id: secondarySupplierInvoiceRow.id,
    description: 'Modules portefeuille',
    quantity: 7,
    unit_price: amount(330),
    total: amount(2310),
    sort_order: 0,
    created_at: isoTimestamp(secondarySupplierInvoiceDate, 16, 15),
  };

  const secondaryProjectRow = {
    id: uuidFromSeed(`${userSeed}:secondary:project:001`),
    user_id: base.userId,
    company_id: secondaryCompanyId,
    client_id: secondaryClientRow.id,
    name: `${config.label} Portfolio Consolidation`,
    description: 'Projet multi-societes de demonstration',
    budget_hours: 96,
    hourly_rate: amount(170),
    status: 'active',
    start_date: isoDate(CURRENT_YEAR, 2, 10),
    end_date: isoDate(CURRENT_YEAR, 4, 10),
    created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 10), 9),
  };

  const secondaryTaskRows = [
    {
      id: uuidFromSeed(`${userSeed}:secondary:task:001`),
      project_id: secondaryProjectRow.id,
      invoice_id: secondaryInvoiceRow.id,
      quote_id: secondaryQuoteRow.id,
      purchase_order_id: null,
      service_id: null,
      company_id: secondaryCompanyId,
      assigned_to: base.teamMemberRows[0]?.name || 'CashPilot Demo Ops',
      name: 'Preparer la consolidation multi-societes',
      title: 'Preparer la consolidation multi-societes',
      description: 'Task demo for company portfolio coverage',
      status: 'in_progress',
      priority: 'high',
      color: '#10b981',
      estimated_hours: 30,
      requires_quote: true,
      started_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 12), 9),
      completed_at: null,
      due_date: isoDate(CURRENT_YEAR, 2, 28),
      start_date: isoDate(CURRENT_YEAR, 2, 12),
      end_date: isoDate(CURRENT_YEAR, 2, 28),
      depends_on: [],
      created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 11), 12),
      updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 18), 12, 5),
    },
    {
      id: uuidFromSeed(`${userSeed}:secondary:task:002`),
      project_id: secondaryProjectRow.id,
      invoice_id: null,
      quote_id: secondaryQuoteRow.id,
      purchase_order_id: null,
      service_id: null,
      company_id: secondaryCompanyId,
      assigned_to: base.teamMemberRows[1]?.name || 'CashPilot Demo Finance',
      name: 'Valider le reporting portefeuille',
      title: 'Valider le reporting portefeuille',
      description: 'Second gantt task for multi-company demo',
      status: 'pending',
      priority: 'medium',
      color: '#14b8a6',
      estimated_hours: 18,
      requires_quote: true,
      started_at: null,
      completed_at: null,
      due_date: isoDate(CURRENT_YEAR, 3, 8),
      start_date: isoDate(CURRENT_YEAR, 3, 1),
      end_date: isoDate(CURRENT_YEAR, 3, 8),
      depends_on: [],
      created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 16), 12),
      updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 16), 12, 5),
    },
  ];
  secondaryTaskRows[1].depends_on = [secondaryTaskRows[0].id];

  const secondarySubtaskRows = [
    {
      id: uuidFromSeed(`${userSeed}:secondary:subtask:001`),
      task_id: secondaryTaskRows[0].id,
      title: 'Collecter les donnees societe B',
      status: 'completed',
      created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 13), 12),
      updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 13), 12, 5),
    },
    {
      id: uuidFromSeed(`${userSeed}:secondary:subtask:002`),
      task_id: secondaryTaskRows[1].id,
      title: 'Diffuser le snapshot partage',
      status: 'pending',
      created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 20), 12),
      updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 20), 12, 5),
    },
  ];

  const secondaryTimesheetRow = {
    id: uuidFromSeed(`${userSeed}:secondary:timesheet:001`),
    user_id: base.userId,
    company_id: secondaryCompanyId,
    client_id: secondaryClientRow.id,
    project_id: secondaryProjectRow.id,
    task_id: secondaryTaskRows[0].id,
    service_id: null,
    invoice_id: secondaryInvoiceRow.id,
    date: isoDate(CURRENT_YEAR, 2, 18),
    start_time: '09:00',
    end_time: '12:30',
    duration_minutes: 210,
    hourly_rate: amount(170),
    description: 'Atelier portefeuille multisociete',
    notes: null,
    billable: true,
    billed_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 19), 18),
    status: 'approved',
    created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 18), 18),
  };

  const secondaryStockHistoryRow = {
    id: uuidFromSeed(`${userSeed}:secondary:stock-history:001`),
    product_id: secondaryProductRow.id,
    user_product_id: secondaryProductRow.id,
    company_id: secondaryCompanyId,
    previous_quantity: 0,
    new_quantity: 14,
    change_quantity: 14,
    reason: 'purchase',
    notes: 'Stock portefeuille multisociete',
    order_id: secondarySupplierOrderRow.id,
    created_by: base.userId,
    created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 17), 10),
  };

  const secondaryStockAlertRow = {
    id: uuidFromSeed(`${userSeed}:secondary:stock-alert:001`),
    product_id: secondaryProductRow.id,
    user_product_id: secondaryProductRow.id,
    company_id: secondaryCompanyId,
    alert_type: 'low_stock',
    is_active: false,
    resolved_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 20), 9),
    created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 17), 10, 5),
  };

  const fixedAssetRows = [
    {
      id: uuidFromSeed(`${userSeed}:fixed-asset:001`),
      user_id: base.userId,
      company_id: primaryCompanyId,
      asset_name: `Cluster BI ${config.label}`,
      asset_code: `FA-${config.country}-001`,
      acquisition_date: isoDate(CURRENT_YEAR, 1, 5),
      acquisition_cost: amount(8400),
      residual_value: amount(600),
      useful_life_years: 4,
      depreciation_method: 'linear',
      asset_type: 'tangible',
      category: 'IT',
      description: 'Infrastructure de pilotage executive',
      status: 'active',
      account_code_asset: config.accounts.fixedAsset,
      account_code_depreciation: config.accounts.accumulatedDepreciation,
      account_code_expense: config.accounts.depreciationExpense,
      created_at: isoTimestamp(isoDate(CURRENT_YEAR, 1, 5), 10),
      updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 28), 10),
    },
    {
      id: uuidFromSeed(`${userSeed}:fixed-asset:002`),
      user_id: base.userId,
      company_id: secondaryCompanyId,
      asset_name: `Studio reporting ${config.label}`,
      asset_code: `FA-${config.country}-002`,
      acquisition_date: isoDate(CURRENT_YEAR, 2, 8),
      acquisition_cost: amount(6200),
      residual_value: amount(400),
      useful_life_years: 3,
      depreciation_method: 'linear',
      asset_type: 'tangible',
      category: 'Workspace',
      description: 'Espace reporting multisociete',
      status: 'active',
      account_code_asset: config.accounts.fixedAsset,
      account_code_depreciation: config.accounts.accumulatedDepreciation,
      account_code_expense: config.accounts.depreciationExpense,
      created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 8), 10),
      updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 28), 10, 5),
    },
  ];

  const depreciationScheduleRows = [
    ...buildFixedAssetScheduleRows({
      userSeed,
      assetId: fixedAssetRows[0].id,
      userId: base.userId,
      companyId: primaryCompanyId,
      acquisitionDate: fixedAssetRows[0].acquisition_date,
      acquisitionCost: fixedAssetRows[0].acquisition_cost,
      residualValue: fixedAssetRows[0].residual_value,
      usefulLifeYears: fixedAssetRows[0].useful_life_years,
      postedPeriods: 2,
    }),
    ...buildFixedAssetScheduleRows({
      userSeed,
      assetId: fixedAssetRows[1].id,
      userId: base.userId,
      companyId: secondaryCompanyId,
      acquisitionDate: fixedAssetRows[1].acquisition_date,
      acquisitionCost: fixedAssetRows[1].acquisition_cost,
      residualValue: fixedAssetRows[1].residual_value,
      usefulLifeYears: fixedAssetRows[1].useful_life_years,
      postedPeriods: 1,
    }),
  ];

  const analyticalAxisRows = [
    ['cost_center', 'REV', 'Revenue Ops', '#f97316'],
    ['cost_center', 'OPS', 'Operations', '#3b82f6'],
    ['cost_center', 'PORT', 'Portfolio', '#10b981'],
    ['department', 'SALES', 'Sales', '#fb7185'],
    ['department', 'FIN', 'Finance', '#8b5cf6'],
    ['department', 'CAB', 'Cabinet', '#14b8a6'],
    ['product_line', 'EXEC', 'Executive', '#f59e0b'],
    ['product_line', 'ANALYTICS', 'Analytics', '#6366f1'],
    ['product_line', 'PORTFOLIO', 'Portfolio', '#22c55e'],
  ].map(([axisType, axisCode, axisName, color], index) => ({
    id: uuidFromSeed(`${userSeed}:analytical-axis:${axisType}:${axisCode}`),
    user_id: base.userId,
    axis_type: axisType,
    axis_code: axisCode,
    axis_name: axisName,
    color,
    is_active: true,
    created_at: isoTimestamp(isoDate(CURRENT_YEAR, 1, 9 + index), 8),
    updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 1, 9 + index), 8, 5),
  }));

  const dashboardSnapshotRows = [
    {
      id: uuidFromSeed(`${userSeed}:dashboard-snapshot:001`),
      user_id: base.userId,
      company_id: primaryCompanyId,
      snapshot_type: 'dashboard',
      title: `${config.label} Executive Dashboard`,
      share_token: uuidFromSeed(`${userSeed}:dashboard-snapshot-token:001`).replace(/-/g, '').slice(0, 24),
      snapshot_data: {
        currency: companyCurrency,
        summaryCards: [
          { label: 'Revenue YTD', value: `${primaryInvoiceRows.reduce((sum, row) => sum + Number(row.total_ttc || 0), 0).toLocaleString('en-US')} ${companyCurrency}`, accentClass: 'text-orange-300' },
          { label: 'Open receivables', value: `${primaryInvoiceRows.reduce((sum, row) => sum + Number(row.balance_due || 0), 0).toLocaleString('en-US')} ${companyCurrency}`, accentClass: 'text-cyan-300' },
          { label: 'Projects', value: String(primaryProjectRows.length), accentClass: 'text-violet-300' },
          { label: 'Quotes pending', value: String(primaryQuoteRows.filter((row) => row.signature_status === 'pending').length), accentClass: 'text-emerald-300' },
        ],
        revenueData: [
          { name: 'Jan', revenue: Number(primaryInvoiceRows[0]?.total_ttc || 0) },
          { name: 'Feb', revenue: Number(primaryInvoiceRows[1]?.total_ttc || 0) },
          { name: 'Mar', revenue: Number(primaryInvoiceRows[2]?.total_ttc || 0) },
        ],
        clientRevenueData: primaryClientRows.slice(0, 3).map((client, index) => ({
          name: client.company_name,
          amount: Number(primaryInvoiceRows[index]?.total_ttc || 0),
        })),
        recentInvoices: primaryInvoiceRows.slice(0, 2).map((invoice) => ({
          id: invoice.id,
          label: invoice.invoice_number,
          subtitle: primaryClientRows.find((client) => client.id === invoice.client_id)?.company_name || 'Demo client',
          amountLabel: `${Number(invoice.total_ttc || 0).toLocaleString('en-US')} ${companyCurrency}`,
          status: invoice.payment_status,
        })),
        recentTimesheets: primaryTimesheetRows.slice(0, 2).map((timesheet) => ({
          id: timesheet.id,
          label: timesheet.description,
          subtitle: primaryProjectRows.find((project) => project.id === timesheet.project_id)?.name || 'Demo project',
          durationLabel: `${timesheet.duration_minutes} min`,
          dateLabel: timesheet.date,
        })),
      },
      is_public: true,
      expires_at: null,
      created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 26), 10),
      updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 26), 10, 5),
    },
    {
      id: uuidFromSeed(`${userSeed}:dashboard-snapshot:002`),
      user_id: base.userId,
      company_id: primaryCompanyId,
      snapshot_type: 'analytics',
      title: `${config.label} Analytics Snapshot`,
      share_token: uuidFromSeed(`${userSeed}:dashboard-snapshot-token:002`).replace(/-/g, '').slice(0, 24),
      snapshot_data: {
        currency: companyCurrency,
        summaryCards: [
          { label: 'Revenue', value: `${primaryInvoiceRows.reduce((sum, row) => sum + Number(row.total_ttc || 0), 0).toLocaleString('en-US')} ${companyCurrency}`, accentClass: 'text-emerald-300' },
          { label: 'Expenses', value: `${primaryExpenseRows.reduce((sum, row) => sum + Number(row.amount || 0), 0).toLocaleString('en-US')} ${companyCurrency}`, accentClass: 'text-red-300' },
          { label: 'Cash collected', value: `${primaryPaymentRows.reduce((sum, row) => sum + Number(row.amount || 0), 0).toLocaleString('en-US')} ${companyCurrency}`, accentClass: 'text-cyan-300' },
          { label: 'Watchlist', value: String(primaryInvoiceRows.filter((row) => Number(row.balance_due || 0) > 0).length), accentClass: 'text-amber-300' },
        ],
        revenueExpensesData: [
          { name: 'Jan', revenue: Number(primaryInvoiceRows[0]?.total_ttc || 0), expenses: Number(primaryExpenseRows[0]?.amount || 0) },
          { name: 'Feb', revenue: Number(primaryInvoiceRows[1]?.total_ttc || 0), expenses: Number(primaryExpenseRows[1]?.amount || 0) },
          { name: 'Mar', revenue: Number(primaryInvoiceRows[2]?.total_ttc || 0), expenses: Number(primaryExpenseRows[2]?.amount || 0) },
        ],
        receivablesAging: [
          { name: '0-30', value: Number(primaryInvoiceRows[1]?.balance_due || 0), tone: '#f59e0b' },
          { name: '31-60', value: Number(primaryInvoiceRows[2]?.balance_due || 0), tone: '#ef4444' },
        ],
        clientConcentration: primaryClientRows.slice(0, 2).map((client, index) => ({
          name: client.company_name,
          share: index === 0 ? 56 : 32,
        })),
        receivablesWatchlist: primaryInvoiceRows.filter((row) => Number(row.balance_due || 0) > 0).map((invoice) => ({
          id: invoice.id,
          clientName: primaryClientRows.find((client) => client.id === invoice.client_id)?.company_name || 'Demo client',
          invoiceNumber: invoice.invoice_number,
          dueDate: invoice.due_date,
          daysOverdue: 4,
          amount: Number(invoice.balance_due || 0),
        })),
      },
      is_public: true,
      expires_at: null,
      created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 27), 11),
      updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 27), 11, 5),
    },
    {
      id: uuidFromSeed(`${userSeed}:dashboard-snapshot:003`),
      user_id: base.userId,
      company_id: secondaryCompanyId,
      snapshot_type: 'dashboard',
      title: `${config.label} Portfolio Dashboard`,
      share_token: uuidFromSeed(`${userSeed}:dashboard-snapshot-token:003`).replace(/-/g, '').slice(0, 24),
      snapshot_data: {
        currency: companyCurrency,
        summaryCards: [
          { label: 'Portfolio revenue', value: `${Number(secondaryInvoiceRow.total_ttc || 0).toLocaleString('en-US')} ${companyCurrency}`, accentClass: 'text-emerald-300' },
          { label: 'Open balance', value: `${Number(secondaryInvoiceRow.balance_due || 0).toLocaleString('en-US')} ${companyCurrency}`, accentClass: 'text-amber-300' },
          { label: 'Projects', value: '1', accentClass: 'text-violet-300' },
          { label: 'Fixed assets', value: '1', accentClass: 'text-cyan-300' },
        ],
        revenueData: [{ name: 'Feb', revenue: Number(secondaryInvoiceRow.total_ttc || 0) }],
        clientRevenueData: [{ name: secondaryClientRow.company_name, amount: Number(secondaryInvoiceRow.total_ttc || 0) }],
        recentInvoices: [{
          id: secondaryInvoiceRow.id,
          label: secondaryInvoiceRow.invoice_number,
          subtitle: secondaryClientRow.company_name,
          amountLabel: `${Number(secondaryInvoiceRow.total_ttc || 0).toLocaleString('en-US')} ${companyCurrency}`,
          status: secondaryInvoiceRow.payment_status,
        }],
        recentTimesheets: [{
          id: secondaryTimesheetRow.id,
          label: secondaryTimesheetRow.description,
          subtitle: secondaryProjectRow.name,
          durationLabel: `${secondaryTimesheetRow.duration_minutes} min`,
          dateLabel: secondaryTimesheetRow.date,
        }],
      },
      is_public: true,
      expires_at: null,
      created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 28), 9),
      updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 28), 9, 5),
    },
  ];

  const secondaryInvoiceSeed = {
    code: '901',
    number: secondaryInvoiceRow.invoice_number,
    totalHt: secondaryInvoiceHt,
    month: 2,
    day: 14,
  };
  const secondaryPaymentSeed = {
    code: '901',
    receiptNumber: secondaryPaymentRow.receipt_number,
    amount: secondaryPaymentRow.amount,
    month: 2,
    day: 26,
  };
  const secondaryExpenseSeed = {
    code: '901',
    baseAmount: secondaryExpenseHt,
    accountCode: config.expenses[0]?.accountCode || config.accounts.interestExpense,
    description: secondaryExpenseRow.description,
    month: 2,
    day: 9,
  };
  const secondaryCapexSeed = {
    code: '901',
    amount: fixedAssetRows[1].acquisition_cost,
    month: 2,
    day: 8,
    description: fixedAssetRows[1].asset_name,
  };

  const secondaryEntryGroups = [
    buildInvoiceEntries(config, secondaryInvoiceSeed),
    buildPaymentEntries(config, secondaryPaymentSeed),
    buildExpenseEntries(config, secondaryExpenseSeed),
    buildCapexEntries(config, secondaryCapexSeed),
  ];
  ensureBalanced(secondaryEntryGroups);

  const secondaryAccountingEntries = secondaryEntryGroups.flatMap((group, groupIndex) =>
    group.lines.map((line, lineIndex) => ({
      id: uuidFromSeed(`${userSeed}:secondary-entry:${group.ref}:${line.accountCode}:${groupIndex}:${lineIndex}`),
      user_id: base.userId,
      company_id: secondaryCompanyId,
      transaction_date: group.date,
      description: line.description,
      account_code: line.accountCode,
      debit: line.debit,
      credit: line.credit,
      source_type: 'manual_demo',
      source_id: uuidFromSeed(`${userSeed}:secondary-source:${group.ref}`),
      journal: 'DEMO',
      entry_ref: group.ref,
      is_auto: false,
      created_at: isoTimestamp(group.date, 12, 10),
    }))
  );

  const assetById = new Map(fixedAssetRows.map((asset) => [asset.id, asset]));
  const fixedAssetEntries = depreciationScheduleRows
    .filter((row) => row.is_posted)
    .flatMap((row, index) => {
      const asset = assetById.get(row.asset_id);
      if (!asset) return [];

      const transactionDate = `${row.period_year}-${String(row.period_month).padStart(2, '0')}-28`;
      const createdAt = isoTimestamp(transactionDate, 18, 20 + index);

      return [
        {
          id: uuidFromSeed(`${userSeed}:fixed-asset-entry:${row.id}:debit`),
          user_id: base.userId,
          company_id: asset.company_id,
          transaction_date: transactionDate,
          description: `Dotation amortissement - ${asset.asset_name}`,
          account_code: asset.account_code_expense,
          debit: row.depreciation_amount,
          credit: 0,
          source_type: 'fixed_asset',
          source_id: asset.id,
          journal: 'OD',
          entry_ref: row.entry_ref,
          is_auto: true,
          created_at: createdAt,
        },
        {
          id: uuidFromSeed(`${userSeed}:fixed-asset-entry:${row.id}:credit`),
          user_id: base.userId,
          company_id: asset.company_id,
          transaction_date: transactionDate,
          description: `Amortissement cumule - ${asset.asset_name}`,
          account_code: asset.account_code_depreciation,
          debit: 0,
          credit: row.depreciation_amount,
          source_type: 'fixed_asset',
          source_id: asset.id,
          journal: 'OD',
          entry_ref: row.entry_ref,
          is_auto: true,
          created_at: createdAt,
        },
      ];
    });

  const accountingEntries = [
    ...base.accountingEntries.map((entry) => ({ ...entry, company_id: primaryCompanyId })),
    ...secondaryAccountingEntries,
    ...fixedAssetEntries,
  ].map((entry) => withAnalyticalDimensions(entry, primaryCompanyId, secondaryCompanyId, config.accounts.revenue));

  return {
    ...base,
    companyRows,
    userCompanyPreferenceRow,
    clientRows: [...primaryClientRows, secondaryClientRow],
    invoiceRows: [...primaryInvoiceRows, secondaryInvoiceRow],
    paymentRows: [...primaryPaymentRows, secondaryPaymentRow],
    expenseRows: [...primaryExpenseRows, secondaryExpenseRow],
    accountingEntries,
    productCategoryRows: [...primaryProductCategoryRows, secondaryProductCategoryRow],
    supplierRows: [...primarySupplierRows, secondarySupplierRow],
    supplierProductCategoryRows: [...primarySupplierProductCategoryRows, secondarySupplierProductCategoryRow],
    supplierProductRows: [...primarySupplierProductRows, secondarySupplierProductRow],
    supplierServiceRows: [...primarySupplierServiceRows, secondarySupplierServiceRow],
    productRows: [...primaryProductRows, secondaryProductRow],
    invoiceItemRows: [...base.invoiceItemRows, ...secondaryInvoiceItemRows],
    paymentAllocationRows: [...base.paymentAllocationRows, secondaryPaymentAllocationRow],
    quoteRows: [...primaryQuoteRows, secondaryQuoteRow],
    supplierOrderRows: [...primarySupplierOrderRows, secondarySupplierOrderRow],
    supplierOrderItemRows: [...base.supplierOrderItemRows, secondarySupplierOrderItemRow],
    supplierInvoiceRows: [...primarySupplierInvoiceRows, secondarySupplierInvoiceRow],
    supplierInvoiceLineItemRows: [...base.supplierInvoiceLineItemRows, secondarySupplierInvoiceLineItemRow],
    projectRows: [...primaryProjectRows, secondaryProjectRow],
    taskRows: [...primaryTaskRows, ...secondaryTaskRows],
    subtaskRows: [...base.subtaskRows, ...secondarySubtaskRows],
    timesheetRows: [...primaryTimesheetRows, secondaryTimesheetRow],
    productStockHistoryRows: [...primaryStockHistoryRows, secondaryStockHistoryRow],
    stockAlertRows: [...primaryStockAlertRows, secondaryStockAlertRow],
    fixedAssetRows,
    depreciationScheduleRows,
    analyticalAxisRows,
    dashboardSnapshotRows,
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
  await deleteRows(client, 'dashboard_snapshots', 'user_id', dataset.userId);
  await deleteRows(client, 'accounting_depreciation_schedule', 'user_id', dataset.userId);
  await deleteRows(client, 'accounting_fixed_assets', 'user_id', dataset.userId);
  await deleteRows(client, 'accounting_analytical_axes', 'user_id', dataset.userId);
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
  await deleteRows(client, 'user_company_preferences', 'user_id', dataset.userId);
  await deleteRows(client, 'company', 'user_id', dataset.userId);
}

async function upsertRows(client, table, rows, onConflict) {
  if (!rows.length) return;
  let pendingRows = rows;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { error } = await client.from(table).upsert(pendingRows, { onConflict });
    if (!error) {
      return;
    }

    const missingColumn = String(error.message || '').match(/Could not find the '([^']+)' column/i)?.[1];
    if (!missingColumn) {
      throw new Error(`Failed to upsert ${table}: ${error.message}`);
    }

    pendingRows = pendingRows.map((row) => {
      if (!(missingColumn in row)) {
        return row;
      }

      const { [missingColumn]: ignored, ...sanitizedRow } = row;
      return sanitizedRow;
    });
  }

  throw new Error(`Failed to upsert ${table}: schema mismatch could not be resolved automatically.`);
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
  await upsertRows(client, 'company', dataset.companyRows || [dataset.companyRow], 'id');
  await upsertRows(client, 'user_company_preferences', [dataset.userCompanyPreferenceRow], 'user_id');
  await upsertRows(client, 'user_roles', [dataset.userRoleRow], 'user_id');
  await upsertRows(client, 'user_accounting_settings', [dataset.settingsRow], 'user_id');
  await upsertRows(client, 'dashboard_snapshots', dataset.dashboardSnapshotRows || [], 'id');
  await upsertRows(client, 'payment_terms', dataset.paymentTermRows, 'id');
  await upsertRows(client, 'accounting_chart_of_accounts', dataset.chartRows, 'user_id,account_code');
  await upsertRows(client, 'accounting_mappings', dataset.mappingRows, 'user_id,source_type,source_category');
  await upsertRows(client, 'accounting_tax_rates', dataset.taxRateRows, 'id');
  await upsertRows(client, 'accounting_analytical_axes', dataset.analyticalAxisRows || [], 'id');
  await upsertRows(client, 'accounting_fixed_assets', dataset.fixedAssetRows || [], 'id');
  await upsertRows(client, 'accounting_depreciation_schedule', dataset.depreciationScheduleRows || [], 'id');
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
    companies: (dataset.companyRows || [dataset.companyRow]).length,
    fixedAssets: (dataset.fixedAssetRows || []).length,
    analyticalAxes: (dataset.analyticalAxisRows || []).length,
    sharedSnapshots: (dataset.dashboardSnapshotRows || []).length,
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
    companies: (dataset.companyRows || [dataset.companyRow]).length,
    fixedAssets: (dataset.fixedAssetRows || []).length,
    analyticalAxes: (dataset.analyticalAxisRows || []).length,
    sharedSnapshots: (dataset.dashboardSnapshotRows || []).length,
  }));
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const configs = buildDemoConfigs();
  const selectedDatasets = options.countries
    .map((country) => configs[country])
    .filter(Boolean)
    .map((config) => buildEnhancedDataset(config));

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
        companies: result.companies,
        fixedAssets: result.fixedAssets,
        analyticalAxes: result.analyticalAxes,
        sharedSnapshots: result.sharedSnapshots,
      },
    });
  }

  console.log(JSON.stringify({ mode: 'apply', year: CURRENT_YEAR, datasets: applied }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
