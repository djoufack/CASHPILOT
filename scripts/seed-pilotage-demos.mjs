import { createHash, randomBytes } from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { buildFullDemoDataset } from './lib/buildFullDemoDataset.mjs';
import { FinancialSimulationEngine } from '../src/utils/scenarioSimulationEngine.js';

const CURRENT_YEAR = new Date().getFullYear();

function uuidFromSeed(seed) {
  const hash = createHash('sha1').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function roundAmount(value) {
  return Math.round(Number(value) * 100) / 100;
}

function isNonStockDemoOffer(productName) {
  return new Set([
    'Licence CRM Pro',
    'Pack Formation 10h',
    'Module Analytics',
    'Support Premium 6 mois',
    'Passerelle API',
    'Suite Securite',
    'Backup Cloud Annuel',
    'CRM Pro License',
    'Training Pack 10h',
    'Analytics Module',
    'Premium Support 6M',
    'API Gateway',
    'Security Suite',
    'Annual Cloud Backup',
  ]).has(String(productName || '').trim());
}

function inferSeedAccountCategory(accountCode, accountType, accountName = '') {
  const code = String(accountCode || '').trim();
  const name = String(accountName || '').toLowerCase();

  if (!code && !name) return null;
  if (/^5/.test(code) || /(banque|bank|cash|caisse|tresorerie)/.test(name)) return 'cash';
  if (/^41/.test(code) || /(client|receivable|creance)/.test(name)) return 'creances_clients';
  if (/^(40|440)/.test(code) || /(fournisseur|supplier|vendor)/.test(name)) return 'dettes_fournisseurs';
  if (/^(445|451|443|44)/.test(code) || /(tva|vat|tax|impot|fiscal)/.test(name)) return 'dettes_fiscales';
  if (/^(16|17|18|42|43)/.test(code) || /(emprunt|loan|borrow|financement)/.test(name)) return 'dettes_financieres';
  if (/^1/.test(code) || /(capital|reserve)/.test(name)) return 'capital';
  if (/^[23]/.test(code) || /(immobil|materiel|logiciel|software|equipment)/.test(name)) return 'immobilisations';
  if (/^70/.test(code)) return 'ventes';
  if (/^(71|72|73|74|75)/.test(code)) return 'produits';
  if (/^76/.test(code)) return 'produits_financiers';
  if (/^66/.test(code) || /(interet|interest|financ)/.test(name)) return 'charges_financieres';
  if (/^(68|69)/.test(code) || /(amort|dotation|depreci)/.test(name)) return 'dotations';
  if (/^64/.test(code) || /(personnel|salary|salaire|payroll)/.test(name)) return 'charges_personnel';
  if (/^(63|635|646)/.test(code) || /(impot|taxe)/.test(name)) return 'impots_taxes';
  if (/^60/.test(code)) return 'achats';
  if (/^(61|62)/.test(code) || /(loyer|honoraire|telecom|assurance|entretien|service)/.test(name)) return 'services_exterieurs';
  if (/^65/.test(code)) return 'autres_charges';
  if (accountType === 'revenue') return 'produits';
  if (accountType === 'expense') return 'autres_charges';
  return null;
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

function ensureMinimumConfigRecords(config, minimum = 7) {
  const nextConfig = {
    ...config,
    clients: [...config.clients],
    invoices: [...config.invoices],
    expenses: [...config.expenses],
    supplierPayments: [...config.supplierPayments],
    interest: [...config.interest],
    depreciation: [...config.depreciation],
  };

  while (nextConfig.clients.length < minimum) {
    const index = nextConfig.clients.length;
    const template = nextConfig.clients[index % config.clients.length];
    const code = String(index + 1).padStart(3, '0');

    nextConfig.clients.push({
      ...template,
      key: `${template.key}-x${code}`,
      company_name: `${template.company_name} ${CURRENT_YEAR} ${index + 1}`,
      contact_name: `${template.contact_name} ${index + 1}`,
      email: `demo+${config.country.toLowerCase()}-client-${code}@cashpilot.cloud`,
      vat_number: `${config.country}CLIENT${code}`,
    });
  }

  while (nextConfig.invoices.length < minimum) {
    const index = nextConfig.invoices.length;
    const template = nextConfig.invoices[index % config.invoices.length];
    const client = nextConfig.clients[index % nextConfig.clients.length];
    const month = (index % 7) + 1;
    const day = 8 + (index % 14);
    const totalHt = roundAmount(Number(template.totalHt || 0) * (1 + (index + 1) * 0.06));
    const paymentRatio = index % 3 === 0 ? 1 : index % 3 === 1 ? 0.55 : 0;
    const paymentAmount = roundAmount(totalHt * (1 + config.vatRate / 100) * paymentRatio);
    const code = String(index + 1).padStart(3, '0');

    nextConfig.invoices.push({
      ...template,
      code,
      number: `${config.country}-DEMO-${CURRENT_YEAR}-${code}`,
      clientKey: client.key,
      month,
      day,
      totalHt,
      paymentAmount,
      paymentMonth: paymentAmount > 0 ? month : month,
      paymentDay: paymentAmount > 0 ? Math.min(day + 12, 28) : day,
    });
  }

  while (nextConfig.expenses.length < minimum) {
    const index = nextConfig.expenses.length;
    const template = nextConfig.expenses[index % config.expenses.length];
    const code = String(index + 1).padStart(3, '0');

    nextConfig.expenses.push({
      ...template,
      code,
      month: (index % 7) + 1,
      day: 5 + (index % 18),
      baseAmount: roundAmount(Number(template.baseAmount || 0) * (1 + index * 0.04)),
      description: `${template.description} ${index + 1}`,
    });
  }

  while (nextConfig.supplierPayments.length < minimum) {
    const index = nextConfig.supplierPayments.length;
    const template = nextConfig.supplierPayments[index % config.supplierPayments.length];
    const code = String(index + 1).padStart(3, '0');

    nextConfig.supplierPayments.push({
      ...template,
      code,
      month: (index % 7) + 1,
      day: 18 + (index % 9),
      amount: roundAmount(Number(template.amount || 0) * (1 + index * 0.03)),
      description: `${template.description} ${index + 1}`,
    });
  }

  while (nextConfig.interest.length < minimum) {
    const index = nextConfig.interest.length;
    const template = nextConfig.interest[index % config.interest.length];
    const code = String(index + 1).padStart(3, '0');

    nextConfig.interest.push({
      ...template,
      code,
      month: (index % 7) + 1,
      day: 27,
      amount: roundAmount(Number(template.amount || 0) * (1 + index * 0.02)),
      description: `${template.description} ${index + 1}`,
    });
  }

  while (nextConfig.depreciation.length < minimum) {
    const index = nextConfig.depreciation.length;
    const template = nextConfig.depreciation[index % config.depreciation.length];
    const code = String(index + 1).padStart(3, '0');

    nextConfig.depreciation.push({
      ...template,
      code,
      month: (index % 7) + 1,
      day: 27,
      amount: roundAmount(Number(template.amount || 0) * (1 + index * 0.025)),
      description: `${template.description} ${index + 1}`,
    });
  }

  return nextConfig;
}

function sumBy(rows, selector) {
  return (rows || []).reduce((total, row) => total + Number(selector(row) || 0), 0);
}

function buildScenarioResultMetrics(result) {
  return {
    revenue: result.revenue,
    expenses: result.expenses,
    grossMargin: result.grossMargin,
    ebitda: result.ebitda,
    ebitdaMargin: result.ebitdaMargin,
    depreciation: result.depreciation,
    operatingResult: result.operatingResult,
    operatingMargin: result.operatingMargin,
    netIncome: result.netIncome,
    netMargin: result.netMargin,
    caf: result.caf,
    bfrChange: result.bfrChange,
    operatingCashFlow: result.operatingCashFlow,
    cashBalance: result.cashBalance,
    currentAssets: result.currentAssets,
    fixedAssets: result.fixedAssets,
    totalAssets: result.totalAssets,
    currentLiabilities: result.currentLiabilities,
    debt: result.debt,
    totalLiabilities: result.totalLiabilities,
    equity: result.equity,
    bfr: result.bfr,
    currentRatio: result.currentRatio,
    quickRatio: result.quickRatio,
    cashRatio: result.cashRatio,
    debtToEquity: result.debtToEquity,
    roe: result.roe,
    roce: result.roce,
  };
}

function selectCompanyRows(rows, companyId) {
  if (!companyId) return rows || [];
  return (rows || []).filter((row) => row.company_id === companyId);
}

function buildScenarioFinancialState(dataset, companyId = null) {
  const invoiceRows = selectCompanyRows(dataset.invoiceRows, companyId);
  const expenseRows = selectCompanyRows(dataset.expenseRows, companyId);
  const supplierInvoiceRows = selectCompanyRows(dataset.supplierInvoiceRows || [], companyId);
  const receivableRows = selectCompanyRows(dataset.receivableRows || [], companyId);
  const payableRows = selectCompanyRows(dataset.payableRows || [], companyId);
  const productRows = selectCompanyRows(dataset.productRows || [], companyId);
  const fixedAssetRows = selectCompanyRows(dataset.fixedAssetRows || [], companyId);
  const bankConnectionRows = selectCompanyRows(dataset.bankConnectionRows || [], companyId);

  const revenue = sumBy(invoiceRows, (row) => row.total_ttc) * 1.4;
  const operatingExpenses = sumBy(expenseRows, (row) => row.amount) * 1.25;
  const supplierExposure = sumBy(supplierInvoiceRows, (row) => row.total_amount);
  const receivables = sumBy(invoiceRows, (row) => row.balance_due) +
    sumBy(receivableRows, (row) => Number(row.amount || 0) - Number(row.amount_paid || 0));
  const payables = sumBy(payableRows, (row) => Number(row.amount || 0) - Number(row.amount_paid || 0)) +
    sumBy(supplierInvoiceRows, (row) => row.payment_status === 'paid' ? 0 : row.total_amount);
  const inventory = sumBy(productRows, (row) => Number(row.stock_quantity || 0) * Number(row.purchase_price || 0));
  const fixedAssets = sumBy(fixedAssetRows, (row) => row.acquisition_cost);
  const cash = sumBy(bankConnectionRows, (row) => row.status === 'active' ? row.account_balance : 0) || revenue * 0.18;
  const debt = sumBy(payableRows.filter((row) => String(row.category || '').includes('loan')), (row) => Number(row.amount || 0) - Number(row.amount_paid || 0));
  const bfr = receivables + inventory - payables;
  const equity = Math.max(cash + receivables + inventory + fixedAssets - payables - debt, revenue * 0.28);

  return {
    revenue,
    avgPrice: 100,
    volume: revenue / 100 || 0,
    expenses: operatingExpenses,
    fixedExpenses: operatingExpenses * 0.55,
    variableExpenses: operatingExpenses * 0.23,
    salaries: operatingExpenses * 0.22,
    cash,
    receivables,
    payables,
    inventory,
    fixedAssets,
    equity,
    debt: Math.max(debt, supplierExposure * 0.12),
    bfr,
  };
}

async function buildScenarioSeedRows(dataset) {
  const engine = new FinancialSimulationEngine();
  const userSeed = `pilotage-demo:${dataset.config.country}`;
  const amountFactor = dataset.config.company.accounting_currency === 'XAF' ? 650 : 1;
  const scaleAmount = (baseAmount) => roundAmount(baseAmount * amountFactor);
  const scopedCompanies = (dataset.companyRows || [dataset.companyRow]).filter(Boolean);
  const scenarioTemplates = [
    {
      code: '001',
      name: `${dataset.config.label} Acceleration CA`,
      description: 'Scenario de croissance commerciale soutenue',
      assumptions: [
        { name: 'Croissance CA +8%', category: 'revenue', assumption_type: 'growth_rate', parameters: { rate: 8 } },
        { name: 'Prix +3%', category: 'pricing', assumption_type: 'percentage_change', parameters: { rate: 3 } },
      ],
    },
    {
      code: '002',
      name: `${dataset.config.label} Discipline des couts`,
      description: 'Scenario de reduction des charges et optimisation des marges',
      assumptions: [
        { name: 'Reduction charges 6%', category: 'expense_reduction', assumption_type: 'percentage_change', parameters: { rate: 6 } },
        { name: 'Charges sociales +150', category: 'social_charges', assumption_type: 'recurring', parameters: { amount: scaleAmount(150) } },
      ],
    },
    {
      code: '003',
      name: `${dataset.config.label} Plan de recrutement`,
      description: 'Scenario avec renfort de l equipe finance et delivery',
      assumptions: [
        { name: 'Salaires additionnels', category: 'salaries', assumption_type: 'recurring', parameters: { amount: scaleAmount(420) } },
        { name: 'Croissance CA +5%', category: 'revenue', assumption_type: 'growth_rate', parameters: { rate: 5 } },
      ],
    },
    {
      code: '004',
      name: `${dataset.config.label} Stress BFR`,
      description: 'Scenario de tension sur le besoin en fonds de roulement',
      assumptions: [
        { name: 'BFR +1800 / mois', category: 'working_capital', assumption_type: 'recurring', parameters: { amount: scaleAmount(1800) } },
        { name: 'Variation CA -4%', category: 'revenue', assumption_type: 'percentage_change', parameters: { rate: -4 } },
      ],
    },
    {
      code: '005',
      name: `${dataset.config.label} Investissement equipement`,
      description: 'Scenario de refresh equipement et outillage',
      assumptions: [
        { name: 'Leasing equipement', category: 'expense', assumption_type: 'recurring', parameters: { amount: scaleAmount(380) } },
        { name: 'Prix +2%', category: 'pricing', assumption_type: 'percentage_change', parameters: { rate: 2 } },
      ],
    },
    {
      code: '006',
      name: `${dataset.config.label} Expansion commerciale`,
      description: 'Scenario d acceleration revenue avec charges fixes accrues',
      assumptions: [
        { name: 'CA recurrent +1200', category: 'revenue', assumption_type: 'recurring', parameters: { amount: scaleAmount(1200) } },
        { name: 'Charges fixes +240', category: 'expense', assumption_type: 'recurring', parameters: { amount: scaleAmount(240) } },
      ],
    },
    {
      code: '007',
      name: `${dataset.config.label} Scenario prudent`,
      description: 'Scenario prudent avec ralentissement commercial',
      assumptions: [
        { name: 'Variation prix -2%', category: 'pricing', assumption_type: 'percentage_change', parameters: { rate: -2 } },
        { name: 'Charges reduites 4%', category: 'expense_reduction', assumption_type: 'percentage_change', parameters: { rate: 4 } },
      ],
    },
  ];

  const scenarioRows = [];
  const assumptionRows = [];
  const resultRows = [];

  for (let companyIndex = 0; companyIndex < scopedCompanies.length; companyIndex += 1) {
    const company = scopedCompanies[companyIndex];
    const companyId = company?.id || null;
    const companyTag = `C${String(companyIndex + 1).padStart(2, '0')}`;
    const companyName = String(company?.company_name || `${dataset.config.label} ${companyTag}`);
    const companySeed = `${userSeed}:company:${companyTag}`;
    const currentFinancialState = buildScenarioFinancialState(dataset, companyId);

    for (let scenarioIndex = 0; scenarioIndex < scenarioTemplates.length; scenarioIndex += 1) {
      const template = scenarioTemplates[scenarioIndex];
      const scenarioId = uuidFromSeed(`${companySeed}:scenario:${template.code}`);
      const monthOffset = (scenarioIndex + companyIndex) % 3;
      const baseDate = isoDate(CURRENT_YEAR, 1 + monthOffset, 1);
      const endDate = isoDate(CURRENT_YEAR + 1, 1 + monthOffset, 1);
      const createdAt = isoTimestamp(baseDate, 9, (companyIndex * 10 + scenarioIndex) % 60);
      const scenarioRow = {
        id: scenarioId,
        user_id: dataset.userId,
        company_id: companyId,
        name: `${template.name} - ${companyName}`,
        description: `${template.description} (${companyName})`,
        base_date: baseDate,
        end_date: endDate,
        status: 'completed',
        is_baseline: scenarioIndex === 0,
        created_at: createdAt,
        updated_at: createdAt,
      };

      const scenarioAssumptions = template.assumptions.map((assumption, assumptionIndex) => ({
        id: uuidFromSeed(`${companySeed}:scenario-assumption:${template.code}:${String(assumptionIndex + 1).padStart(3, '0')}`),
        scenario_id: scenarioId,
        name: assumption.name,
        description: `${assumption.name} - ${companyTag}`,
        category: assumption.category,
        assumption_type: assumption.assumption_type,
        parameters: assumption.parameters,
        start_date: baseDate,
        end_date: endDate,
        created_at: isoTimestamp(baseDate, 10, (assumptionIndex + scenarioIndex) % 60),
        updated_at: isoTimestamp(baseDate, 10, (assumptionIndex + scenarioIndex) % 60),
      }));

      const results = await engine.simulateScenario(
        scenarioRow,
        scenarioAssumptions,
        currentFinancialState
      );

      scenarioRows.push(scenarioRow);
      assumptionRows.push(...scenarioAssumptions);
      resultRows.push(
        ...results.map((result, resultIndex) => ({
          id: uuidFromSeed(`${companySeed}:scenario-result:${template.code}:${result.date}`),
          scenario_id: scenarioId,
          calculation_date: result.date,
          period_label: result.period_label,
          metrics: buildScenarioResultMetrics(result),
          created_at: isoTimestamp(result.date, 18, resultIndex % 50),
          updated_at: isoTimestamp(result.date, 18, resultIndex % 50),
        }))
      );
    }
  }

  return {
    scenarioRows,
    scenarioAssumptionRows: assumptionRows,
    scenarioResultRows: resultRows,
  };
}

function parseArguments(argv) {
  const options = {
    apply: false,
    dryRun: true,
    resetPasswords: false,
    preserveCompanies: false,
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
    } else if (arg === '--preserve-companies') {
      options.preserveCompanies = true;
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

function withAnalyticalDimensions(entry, primaryCompanyId, portfolioCompanyIds, revenueAccountCode) {
  const accountCode = String(entry.account_code || '');
  const portfolioSet = new Set(
    Array.isArray(portfolioCompanyIds)
      ? portfolioCompanyIds
      : [portfolioCompanyIds].filter(Boolean)
  );

  if (portfolioSet.has(entry.company_id)) {
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

function deepCloneSeedValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function remapSeedIdentifiers(value, idMap) {
  if (Array.isArray(value)) {
    return value.map((item) => remapSeedIdentifiers(item, idMap));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, remapSeedIdentifiers(entry, idMap)])
    );
  }

  if (typeof value === 'string' && idMap.has(value)) {
    return idMap.get(value);
  }

  return value;
}

function appendEmailTag(email, tag) {
  if (!email || !String(email).includes('@')) {
    return email;
  }

  const [localPart, domain] = String(email).split('@');
  return `${localPart}+${tag}@${domain}`;
}

function appendUrlTag(url, tag) {
  if (!url) {
    return url;
  }

  try {
    const parsed = new URL(String(url));
    parsed.searchParams.set('seed_company', tag);
    return parsed.toString();
  } catch {
    const separator = String(url).includes('?') ? '&' : '?';
    return `${url}${separator}seed_company=${tag}`;
  }
}

function uniquifyClonedRow(tableKey, row, sourceRow, companyTag, userSeed) {
  const next = { ...row };
  const suffixedFields = [
    'invoice_number',
    'quote_number',
    'credit_note_number',
    'delivery_note_number',
    'order_number',
    'po_number',
    'reference',
    'receipt_number',
    'sku',
    'asset_code',
    'external_id',
    'requisition_id',
    'agreement_id',
    'account_id',
    'tracking_number',
    'ap_document_id',
    'supplier_vat_number',
    'entry_ref',
  ];

  for (const field of suffixedFields) {
    if (typeof next[field] === 'string' && next[field]) {
      next[field] = `${next[field]}-${companyTag}`;
    }
  }

  if (typeof next.email === 'string' && next.email) {
    next.email = appendEmailTag(next.email, companyTag.toLowerCase());
  }

  if (typeof next.website === 'string' && next.website) {
    next.website = appendUrlTag(next.website, companyTag.toLowerCase());
  }

  if (typeof next.company_name === 'string' && next.company_name && ['clientRows', 'supplierRows'].includes(tableKey)) {
    next.company_name = `${next.company_name} ${companyTag}`;
  }

  if (typeof next.contact_name === 'string' && next.contact_name) {
    next.contact_name = `${next.contact_name} ${companyTag}`;
  }

  if (typeof next.contact_person === 'string' && next.contact_person) {
    next.contact_person = `${next.contact_person} ${companyTag}`;
  }

  if (typeof next.product_name === 'string' && next.product_name) {
    next.product_name = `${next.product_name} ${companyTag}`;
  }

  if (typeof next.service_name === 'string' && next.service_name) {
    next.service_name = `${next.service_name} ${companyTag}`;
  }

  if (typeof next.name === 'string' && ['projectRows'].includes(tableKey)) {
    next.name = `${next.name} ${companyTag}`;
  }

  if (
    typeof next.name === 'string' &&
    ['productCategoryRows', 'serviceCategoryRows', 'supplierProductCategoryRows'].includes(tableKey)
  ) {
    next.name = `${next.name} ${companyTag}`;
  }

  if (typeof next.title === 'string' && ['dashboardSnapshotRows', 'recurringInvoiceRows'].includes(tableKey)) {
    next.title = `${next.title} ${companyTag}`;
  }

  if (typeof next.peppol_endpoint_id === 'string' && next.peppol_endpoint_id) {
    next.peppol_endpoint_id = `${next.peppol_endpoint_id}-${companyTag}`;
  }

  if (typeof next.signature_token === 'string' && next.signature_token) {
    next.signature_token = uuidFromSeed(`${userSeed}:clone:${companyTag}:signature:${sourceRow.id}`).replace(/-/g, '');
  }

  if (typeof next.share_token === 'string' && next.share_token) {
    next.share_token = uuidFromSeed(`${userSeed}:clone:${companyTag}:snapshot:${sourceRow.id}`).replace(/-/g, '').slice(0, 24);
  }

  if (typeof next.stripe_payment_link_id === 'string' && next.stripe_payment_link_id) {
    next.stripe_payment_link_id = `${next.stripe_payment_link_id}_${companyTag.toLowerCase()}`;
  }

  if (typeof next.stripe_payment_intent_id === 'string' && next.stripe_payment_intent_id) {
    next.stripe_payment_intent_id = `${next.stripe_payment_intent_id}_${companyTag.toLowerCase()}`;
  }

  if (typeof next.stripe_payment_link_url === 'string' && next.stripe_payment_link_url) {
    next.stripe_payment_link_url = appendUrlTag(next.stripe_payment_link_url, companyTag.toLowerCase());
  }

  if (tableKey === 'accountingEntries' && typeof next.source_id === 'string' && next.source_id) {
    next.source_id = uuidFromSeed(`${userSeed}:clone:${companyTag}:source:${next.source_id}`);
  }

  return next;
}

function buildCompanyCloneDataset({ primaryCompanyId, sourceTables, companyRow, companyIndex, userSeed }) {
  const companyTag = `C${String(companyIndex + 1).padStart(2, '0')}`;
  const idMap = new Map([[primaryCompanyId, companyRow.id]]);

  for (const [tableKey, rows] of Object.entries(sourceTables)) {
    for (const row of rows || []) {
      if (!row?.id) continue;
      idMap.set(row.id, uuidFromSeed(`${userSeed}:clone:${companyTag}:${tableKey}:${row.id}`));
    }
  }

  return Object.fromEntries(
    Object.entries(sourceTables).map(([tableKey, rows]) => [
      tableKey,
      (rows || []).map((sourceRow) => {
        const clonedRow = remapSeedIdentifiers(deepCloneSeedValue(sourceRow), idMap);

        if (sourceRow?.id && idMap.has(sourceRow.id)) {
          clonedRow.id = idMap.get(sourceRow.id);
        }

        if ('company_id' in clonedRow) {
          clonedRow.company_id = companyRow.id;
        }

        if (Array.isArray(clonedRow.depends_on)) {
          clonedRow.depends_on = clonedRow.depends_on.map((dependencyId) => idMap.get(dependencyId) || dependencyId);
        }

        return uniquifyClonedRow(tableKey, clonedRow, sourceRow, companyTag, userSeed);
      }),
    ])
  );
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
  const configs = {
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

  return Object.fromEntries(
    Object.entries(configs).map(([key, value]) => [key, ensureMinimumConfigRecords(value)])
  );
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
    primaryCompanyId: companyId,
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
    auto_journal_enabled: true,
    updated_at: new Date().toISOString(),
  };

  const userRoleRow = {
    user_id: userId,
    role: 'user',
  };

  const chartRows = config.chart.map(([accountCode, accountName, accountType]) => ({
    id: uuidFromSeed(`${userSeed}:account:${accountCode}`),
    user_id: userId,
    company_id: companyId,
    account_code: accountCode,
    account_name: accountName,
    account_type: accountType,
    account_category: inferSeedAccountCategory(accountCode, accountType, accountName),
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
  const extraCompanyRows = Array.from({ length: 6 }, (_, index) => {
    const code = String(index + 2).padStart(2, '0');
    const companyId = index === 0 ? secondaryCompanyId : uuidFromSeed(`${userSeed}:company:portfolio:${code}`);
    return {
      id: companyId,
      user_id: base.userId,
      ...secondaryCompanySeed,
      company_name: `${secondaryCompanySeed.company_name} ${index + 1}`,
      registration_number: `${secondaryCompanySeed.registration_number}-${code}`,
      tax_id: `${secondaryCompanySeed.tax_id}-${code}`,
      email: secondaryCompanySeed.email.replace('@', `+${code}@`),
      bank_account: secondaryCompanySeed.bank_account ? `${secondaryCompanySeed.bank_account}-${code}` : secondaryCompanySeed.bank_account,
      iban: secondaryCompanySeed.iban ? `${secondaryCompanySeed.iban}${code}` : secondaryCompanySeed.iban,
      peppol_endpoint_id: secondaryCompanySeed.peppol_endpoint_id ? `${secondaryCompanySeed.peppol_endpoint_id}-${code}` : null,
      created_at: isoTimestamp(isoDate(CURRENT_YEAR, 1, 4 + index), 8),
      updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 20 + index), 9),
    };
  });

  const companyRows = [
    {
      ...base.companyRow,
      created_at: base.companyRow.created_at || isoTimestamp(isoDate(CURRENT_YEAR, 1, 2), 8),
      updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 27), 8),
    },
    ...extraCompanyRows,
  ];
  const portfolioCompanyIds = extraCompanyRows.map((row) => row.id);

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
  const primaryPurchaseOrderRows = base.purchaseOrderRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primaryRecurringInvoiceRows = base.recurringInvoiceRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primaryPaymentReminderRuleRows = base.paymentReminderRuleRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primaryPaymentReminderLogRows = base.paymentReminderLogRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primaryCreditNoteRows = base.creditNoteRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primaryDeliveryNoteRows = base.deliveryNoteRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primaryReceivableRows = base.receivableRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primaryPayableRows = base.payableRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primaryDebtPaymentRows = base.debtPaymentRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primaryBankConnectionRows = base.bankConnectionRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primaryBankSyncHistoryRows = base.bankSyncHistoryRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primaryBankTransactionRows = base.bankTransactionRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primaryPeppolLogRows = base.peppolLogRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));

  const primaryProductCategoryRows = base.productCategoryRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primaryServiceCategoryRows = base.serviceCategoryRows.map((row) => ({
    ...row,
    company_id: primaryCompanyId,
  }));
  const primarySupplierRows = base.supplierRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primarySupplierProductCategoryRows = base.supplierProductCategoryRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primarySupplierProductRows = base.supplierProductRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primarySupplierServiceRows = base.supplierServiceRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primaryProductRows = base.productRows.map((row) => {
    const inventoryTrackingEnabled = !isNonStockDemoOffer(row.product_name);
    return {
      ...row,
      company_id: primaryCompanyId,
      inventory_tracking_enabled: inventoryTrackingEnabled,
      stock_quantity: inventoryTrackingEnabled ? row.stock_quantity : 0,
      min_stock_level: inventoryTrackingEnabled ? row.min_stock_level : 0,
    };
  });
  const primaryTrackedProductIds = new Set(
    primaryProductRows.filter((row) => row.inventory_tracking_enabled !== false).map((row) => row.id)
  );
  const primaryServiceRows = base.serviceRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primarySupplierOrderRows = base.supplierOrderRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primarySupplierInvoiceRows = base.supplierInvoiceRows.map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primaryStockHistoryRows = base.productStockHistoryRows
    .filter((row) => primaryTrackedProductIds.has(row.product_id || row.user_product_id))
    .map((row) => ({ ...row, company_id: primaryCompanyId }));
  const primaryStockAlertRows = base.stockAlertRows
    .filter((row) => primaryTrackedProductIds.has(row.product_id || row.user_product_id))
    .map((row) => ({ ...row, company_id: primaryCompanyId }));

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
    inventory_tracking_enabled: true,
    is_active: true,
    created_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 13),
    updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 2, 5), 13, 5),
  };
  // Keep demo sales lines explicitly linked to a stock-tracked product.
  secondaryInvoiceItemRows[0].product_id = secondaryProductRow.id;

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
    order_status: 'received',
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

  let fixedAssetRows = [
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

  fixedAssetRows = [
    ...fixedAssetRows,
    ...Array.from({ length: 6 }, (_, index) => {
      const code = String(index + 3).padStart(3, '0');
      const acquisitionDate = isoDate(CURRENT_YEAR, 2 + (index % 5), 10 + index);
      const acquisitionCost = amount(2400 + index * 950);
      const residualValue = amount(180 + index * 40);
      const usefulLifeYears = 3 + (index % 3);
      const categories = ['IT', 'Workspace', 'Analytics', 'Operations', 'Compliance', 'Security'];
      const assetNames = [
        'Station reporting mobile',
        'Ecran supervision portefeuille',
        'Serveur analytics embarque',
        'Suite materiel delivery',
        'Coffret conformité fiscale',
        'Console controle securite',
      ];

      return {
        id: uuidFromSeed(`${userSeed}:fixed-asset:${code}`),
        user_id: base.userId,
        company_id: primaryCompanyId,
        asset_name: `${assetNames[index]} ${config.label}`,
        asset_code: `FA-${config.country}-${code}`,
        acquisition_date: acquisitionDate,
        acquisition_cost: acquisitionCost,
        residual_value: residualValue,
        useful_life_years: usefulLifeYears,
        depreciation_method: 'linear',
        asset_type: 'tangible',
        category: categories[index],
        description: `Immobilisation demo ${index + 3} pour la societe active`,
        status: 'active',
        account_code_asset: config.accounts.fixedAsset,
        account_code_depreciation: config.accounts.accumulatedDepreciation,
        account_code_expense: config.accounts.depreciationExpense,
        created_at: isoTimestamp(acquisitionDate, 10),
        updated_at: isoTimestamp(addDays(acquisitionDate, 18), 10, 5),
      };
    }),
  ];

  const portfolioCompanyDatasets = extraCompanyRows.slice(1).map((companyRow, index) => {
    const code = String(index + 2).padStart(3, '0');
    const invoiceMonth = 3 + (index % 4);
    const invoiceDay = 11 + index;
    const invoiceDate = isoDate(CURRENT_YEAR, invoiceMonth, invoiceDay);
    const quoteDate = addDays(invoiceDate, -6);
    const paymentDate = addDays(invoiceDate, 12);
    const expenseDate = addDays(invoiceDate, -2);
    const supplierInvoiceDate = addDays(invoiceDate, 3);
    const acquisitionDate = addDays(invoiceDate, -8);
    const quoteHt = amount(5400 + index * 520);
    const invoiceHt = amount(4900 + index * 560);
    const invoiceVat = roundAmount(invoiceHt * (config.vatRate / 100));
    const invoiceTtc = roundAmount(invoiceHt + invoiceVat);
    const paymentAmount = roundAmount(invoiceTtc * (0.38 + (index % 2) * 0.12));
    const expenseHt = amount(720 + index * 85);
    const expenseVat = roundAmount(expenseHt * (config.vatRate / 100));
    const supplierInvoiceHt = amount(1760 + index * 210);
    const supplierInvoiceVat = roundAmount(supplierInvoiceHt * (config.vatRate / 100));
    const fixedAssetCost = amount(2600 + index * 760);
    const fixedAssetResidual = amount(200 + index * 35);

    const clientRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:client`),
      user_id: base.userId,
      company_id: companyRow.id,
      company_name: `${config.label} Portfolio Client ${index + 2}`,
      contact_name: `Responsable Portfolio ${index + 2}`,
      email: `portfolio-client-${config.country.toLowerCase()}-${code}@cashpilot.cloud`,
      address: companyRow.address,
      city: companyRow.city,
      postal_code: companyRow.postal_code,
      country: companyRow.country,
      phone: companyRow.phone,
      website: `https://cashpilot.tech/portfolio/${code}`,
      preferred_currency: companyCurrency,
      payment_terms: config.country === 'BE' ? '30 dagen' : '30 jours',
      electronic_invoicing_enabled: true,
      peppol_endpoint_id: companyRow.peppol_endpoint_id ? `${companyRow.peppol_endpoint_id}-client` : null,
      peppol_scheme_id: companyRow.peppol_scheme_id || null,
      notes: `${config.label} portfolio client ${index + 2}`,
      created_at: isoTimestamp(addDays(quoteDate, -3), 10),
      updated_at: isoTimestamp(addDays(quoteDate, -3), 10, 5),
    };

    const quoteRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:quote`),
      user_id: base.userId,
      company_id: companyRow.id,
      client_id: clientRow.id,
      quote_number: `QT-${config.country}-${CURRENT_YEAR}-P${code}`,
      date: quoteDate,
      status: 'sent',
      tax_rate: config.vatRate,
      total_ht: quoteHt,
      total_ttc: roundAmount(quoteHt * (1 + config.vatRate / 100)),
      signature_status: index % 2 === 0 ? 'pending' : 'signed',
      signature_token: uuidFromSeed(`${userSeed}:portfolio:${code}:quote-token`).replace(/-/g, ''),
      signature_token_expires_at: isoTimestamp(isoDate(CURRENT_YEAR, 12, 31), 23, 59),
      signed_by: index % 2 === 0 ? null : clientRow.contact_name,
      signer_email: clientRow.email,
      signed_at: index % 2 === 0 ? null : isoTimestamp(addDays(quoteDate, 2), 16, 10),
      signature_url: index % 2 === 0 ? null : `https://cashpilot.tech/demo-signatures/${config.country.toLowerCase()}-portfolio-${code}.png`,
      created_at: isoTimestamp(quoteDate, 9),
    };

    const invoiceRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:invoice`),
      user_id: base.userId,
      company_id: companyRow.id,
      client_id: clientRow.id,
      invoice_number: `${config.country}-PORT-${CURRENT_YEAR}-${code}`,
      currency: companyCurrency,
      date: invoiceDate,
      due_date: addDays(invoiceDate, 30),
      status: 'sent',
      payment_status: 'partial',
      amount_paid: paymentAmount,
      balance_due: roundAmount(invoiceTtc - paymentAmount),
      total_ht: invoiceHt,
      tax_rate: config.vatRate,
      total_ttc: invoiceTtc,
      payment_terms_id: base.paymentTermRows[2]?.id || base.paymentTermRows[0]?.id || null,
      invoice_type: 'product',
      reference: `REF-${config.country}-PORT-${code}`,
      header_note: `${config.label} portfolio invoice ${index + 2}`,
      footer_note: 'Generated for CashPilot demo',
      terms_and_conditions: 'Portfolio entity demo. Payment due in 30 days.',
      stripe_payment_link_id: `plink_${config.country.toLowerCase()}_${CURRENT_YEAR}_portfolio_${code}`,
      stripe_payment_link_url: `https://buy.stripe.com/test_cashpilot_${config.country.toLowerCase()}_portfolio_${code}`,
      payment_link_created_at: isoTimestamp(invoiceDate, 14, 20),
      notes: `${config.label} portfolio invoice ${index + 2}`,
      created_at: isoTimestamp(invoiceDate, 9),
    };

    const invoiceItemRows = [
      {
        id: uuidFromSeed(`${userSeed}:portfolio:${code}:invoice-item:001`),
        invoice_id: invoiceRow.id,
        description: `Module portefeuille ${index + 2}`,
        item_type: 'product',
        product_id: null,
        service_id: null,
        quantity: 3 + index,
        unit_price: amount(780),
        total: amount((3 + index) * 780),
        created_at: isoTimestamp(invoiceDate, 9, 10),
      },
      {
        id: uuidFromSeed(`${userSeed}:portfolio:${code}:invoice-item:002`),
        invoice_id: invoiceRow.id,
        description: `Accompagnement consolidation ${index + 2}`,
        item_type: 'service',
        product_id: null,
        service_id: null,
        quantity: 4 + index,
        unit_price: amount(360),
        total: amount((4 + index) * 360),
        created_at: isoTimestamp(invoiceDate, 9, 20),
      },
    ];

    const paymentRow = {
      code: `P${code}`,
      month: invoiceMonth,
      day: Number(paymentDate.slice(8, 10)),
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:payment`),
      user_id: base.userId,
      company_id: companyRow.id,
      invoice_id: invoiceRow.id,
      client_id: clientRow.id,
      amount: paymentAmount,
      payment_method: 'bank_transfer',
      payment_date: paymentDate,
      reference: `WIRE-${config.country}-${CURRENT_YEAR}-P${code}`,
      notes: `${config.label} portfolio payment ${index + 2}`,
      receipt_number: `REC-${config.country}-${CURRENT_YEAR}-P${code}`,
      is_lump_sum: false,
      created_at: isoTimestamp(paymentDate, 15),
    };

    const paymentAllocationRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:payment-allocation`),
      payment_id: paymentRow.id,
      invoice_id: invoiceRow.id,
      amount: paymentAmount,
      created_at: isoTimestamp(paymentDate, 16),
    };

    const expenseRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:expense`),
      user_id: base.userId,
      company_id: companyRow.id,
      amount: roundAmount(expenseHt + expenseVat),
      amount_ht: expenseHt,
      tax_amount: expenseVat,
      tax_rate: roundAmount(config.vatRate / 100),
      category: 'consulting',
      description: `${config.label} portfolio tooling ${index + 2}`,
      expense_date: expenseDate,
      created_at: isoTimestamp(expenseDate, 10),
    };

    const productCategoryRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:product-category`),
      user_id: base.userId,
      company_id: companyRow.id,
      name: `${config.label} Portfolio ${index + 2}`,
      description: `Portfolio stock items ${index + 2}`,
      created_at: isoTimestamp(addDays(expenseDate, -1), 11),
      updated_at: isoTimestamp(addDays(expenseDate, -1), 11, 5),
    };

    const supplierProductCategoryRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:supplier-product-category`),
      user_id: base.userId,
      company_id: companyRow.id,
      name: `${config.label} Modules ${index + 2}`,
      description: `Portfolio supply catalog ${index + 2}`,
      created_at: isoTimestamp(addDays(expenseDate, -1), 11, 10),
      updated_at: isoTimestamp(addDays(expenseDate, -1), 11, 15),
    };

    const supplierRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:supplier`),
      user_id: base.userId,
      company_id: companyRow.id,
      company_name: `${config.label} Portfolio Supply ${index + 2}`,
      contact_person: `Morgan Supply ${index + 2}`,
      email: `portfolio-supply-${config.country.toLowerCase()}-${code}@cashpilot.cloud`,
      phone: companyRow.phone,
      address: companyRow.address,
      city: companyRow.city,
      postal_code: companyRow.postal_code,
      country: companyRow.country,
      website: 'https://cashpilot.tech/supply',
      bank_name: companyRow.bank_name,
      iban: companyRow.iban,
      bic_swift: companyRow.swift,
      supplier_type: 'both',
      payment_terms: config.country === 'BE' ? '30 dagen' : '30 jours',
      status: 'active',
      created_at: isoTimestamp(addDays(expenseDate, -1), 12),
      updated_at: isoTimestamp(addDays(expenseDate, -1), 12, 5),
    };

    const supplierProductRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:supplier-product`),
      supplier_id: supplierRow.id,
      category_id: supplierProductCategoryRow.id,
      company_id: companyRow.id,
      product_name: `Module portefeuille ${config.label} ${index + 2}`,
      description: `Supply catalog for portfolio company ${index + 2}`,
      sku: `${config.country}-SUP-PORT-${code}`,
      unit_price: amount(320 + index * 20),
      unit: 'piece',
      min_stock_level: 3 + index,
      created_at: isoTimestamp(addDays(expenseDate, -1), 12, 10),
      updated_at: isoTimestamp(addDays(expenseDate, -1), 12, 15),
    };

    const supplierServiceRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:supplier-service`),
      supplier_id: supplierRow.id,
      company_id: companyRow.id,
      service_name: `Support portefeuille ${config.label} ${index + 2}`,
      description: `Portfolio service support ${index + 2}`,
      pricing_type: 'fixed',
      fixed_price: amount(760 + index * 70),
      hourly_rate: amount(120 + index * 5),
      unit: 'mission',
      availability: 'available',
      created_at: isoTimestamp(addDays(expenseDate, -1), 12, 20),
      updated_at: isoTimestamp(addDays(expenseDate, -1), 12, 25),
    };

    const productRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:product`),
      user_id: base.userId,
      company_id: companyRow.id,
      category_id: productCategoryRow.id,
      supplier_id: supplierRow.id,
      product_name: `Module portefeuille ${config.label} ${index + 2}`,
      description: `Inventory item used for company ${index + 2}`,
      sku: `${config.country}-PORT-${code}`,
      unit_price: amount(610 + index * 45),
      purchase_price: amount(330 + index * 30),
      stock_quantity: 10 + index * 2,
      min_stock_level: 3 + index,
      unit: 'piece',
      inventory_tracking_enabled: true,
      is_active: true,
      created_at: isoTimestamp(addDays(expenseDate, -1), 13),
      updated_at: isoTimestamp(addDays(expenseDate, -1), 13, 5),
    };
    // Keep demo sales lines explicitly linked to a stock-tracked product.
    invoiceItemRows[0].product_id = productRow.id;

    const supplierOrderRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:supplier-order`),
      user_id: base.userId,
      company_id: companyRow.id,
      supplier_id: supplierRow.id,
      order_number: `SO-${config.country}-${CURRENT_YEAR}-P${code}`,
      order_date: addDays(invoiceDate, -1),
      expected_delivery_date: addDays(invoiceDate, 5),
      actual_delivery_date: addDays(invoiceDate, 4),
      order_status: 'received',
      total_amount: amount(1920 + index * 230),
      notes: `Commande portefeuille ${index + 2}`,
      created_at: isoTimestamp(addDays(invoiceDate, -1), 15),
      updated_at: isoTimestamp(addDays(invoiceDate, -1), 15, 5),
    };

    const supplierOrderItemRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:supplier-order-item`),
      order_id: supplierOrderRow.id,
      product_id: supplierProductRow.id,
      service_id: null,
      quantity: 5 + index,
      unit_price: amount(320 + index * 20),
      total_price: roundAmount((5 + index) * amount(320 + index * 20)),
      created_at: isoTimestamp(addDays(invoiceDate, -1), 15, 10),
    };

    const supplierInvoiceRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:supplier-invoice`),
      supplier_id: supplierRow.id,
      company_id: companyRow.id,
      invoice_number: `SUP-${config.country}-${CURRENT_YEAR}-P${code}`,
      invoice_date: supplierInvoiceDate,
      due_date: addDays(supplierInvoiceDate, 25),
      currency: companyCurrency,
      total_amount: roundAmount(supplierInvoiceHt + supplierInvoiceVat),
      total_ht: supplierInvoiceHt,
      total_ttc: roundAmount(supplierInvoiceHt + supplierInvoiceVat),
      vat_rate: config.vatRate,
      vat_amount: supplierInvoiceVat,
      payment_status: index % 2 === 0 ? 'pending' : 'overdue',
      payment_terms: config.country === 'BE' ? '30 dagen' : '30 jours',
      supplier_name_extracted: supplierRow.company_name,
      supplier_address_extracted: supplierRow.address,
      supplier_vat_number: `${config.country}-SUPVAT-P${code}`,
      notes: `Facture fournisseur portefeuille ${index + 2}`,
      created_at: isoTimestamp(supplierInvoiceDate, 16),
      updated_at: isoTimestamp(supplierInvoiceDate, 16, 5),
      ai_extracted: true,
      ai_confidence: 0.95,
      ai_extracted_at: isoTimestamp(supplierInvoiceDate, 16, 10),
      ai_raw_response: { provider: 'demo', quality: 'high', company: companyRow.id },
      iban: supplierRow.iban,
      bic: supplierRow.bic_swift,
    };

    const supplierInvoiceLineItemRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:supplier-invoice-line`),
      invoice_id: supplierInvoiceRow.id,
      description: `Modules portefeuille ${index + 2}`,
      quantity: 5 + index,
      unit_price: amount(290 + index * 18),
      total: supplierInvoiceHt,
      sort_order: 0,
      created_at: isoTimestamp(supplierInvoiceDate, 16, 15),
    };

    const projectRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:project`),
      user_id: base.userId,
      company_id: companyRow.id,
      client_id: clientRow.id,
      name: `${config.label} Portfolio Consolidation ${index + 2}`,
      description: `Projet multi-societes portfolio ${index + 2}`,
      budget_hours: 72 + index * 8,
      hourly_rate: amount(160 + index * 8),
      status: 'active',
      start_date: addDays(invoiceDate, -3),
      end_date: addDays(invoiceDate, 35),
      created_at: isoTimestamp(addDays(invoiceDate, -3), 9),
    };

    const taskRows = [
      {
        id: uuidFromSeed(`${userSeed}:portfolio:${code}:task:001`),
        project_id: projectRow.id,
        invoice_id: invoiceRow.id,
        quote_id: quoteRow.id,
        purchase_order_id: null,
        service_id: null,
        company_id: companyRow.id,
        assigned_to: base.teamMemberRows[0]?.name || 'CashPilot Demo Ops',
        name: `Préparer la consolidation ${index + 2}`,
        title: `Préparer la consolidation ${index + 2}`,
        description: `Task demo portfolio ${index + 2}`,
        status: 'in_progress',
        priority: 'high',
        color: '#10b981',
        estimated_hours: 24 + index * 2,
        requires_quote: true,
        started_at: isoTimestamp(addDays(invoiceDate, -2), 9),
        completed_at: null,
        due_date: addDays(invoiceDate, 10),
        start_date: addDays(invoiceDate, -2),
        end_date: addDays(invoiceDate, 10),
        depends_on: [],
        created_at: isoTimestamp(addDays(invoiceDate, -3), 12),
        updated_at: isoTimestamp(addDays(invoiceDate, 1), 12, 5),
      },
      {
        id: uuidFromSeed(`${userSeed}:portfolio:${code}:task:002`),
        project_id: projectRow.id,
        invoice_id: null,
        quote_id: quoteRow.id,
        purchase_order_id: null,
        service_id: null,
        company_id: companyRow.id,
        assigned_to: base.teamMemberRows[1]?.name || 'CashPilot Demo Finance',
        name: `Valider le reporting ${index + 2}`,
        title: `Valider le reporting ${index + 2}`,
        description: `Second gantt task portfolio ${index + 2}`,
        status: 'pending',
        priority: 'medium',
        color: '#14b8a6',
        estimated_hours: 12 + index * 2,
        requires_quote: true,
        started_at: null,
        completed_at: null,
        due_date: addDays(invoiceDate, 18),
        start_date: addDays(invoiceDate, 11),
        end_date: addDays(invoiceDate, 18),
        depends_on: [],
        created_at: isoTimestamp(addDays(invoiceDate, 2), 12),
        updated_at: isoTimestamp(addDays(invoiceDate, 2), 12, 5),
      },
    ];
    taskRows[1].depends_on = [taskRows[0].id];

    const subtaskRows = [
      {
        id: uuidFromSeed(`${userSeed}:portfolio:${code}:subtask:001`),
        task_id: taskRows[0].id,
        title: `Collecter les donnees ${index + 2}`,
        status: 'completed',
        created_at: isoTimestamp(addDays(invoiceDate, -1), 12),
        updated_at: isoTimestamp(addDays(invoiceDate, -1), 12, 5),
      },
      {
        id: uuidFromSeed(`${userSeed}:portfolio:${code}:subtask:002`),
        task_id: taskRows[1].id,
        title: `Diffuser le snapshot ${index + 2}`,
        status: 'pending',
        created_at: isoTimestamp(addDays(invoiceDate, 3), 12),
        updated_at: isoTimestamp(addDays(invoiceDate, 3), 12, 5),
      },
    ];

    const timesheetRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:timesheet`),
      user_id: base.userId,
      company_id: companyRow.id,
      client_id: clientRow.id,
      project_id: projectRow.id,
      task_id: taskRows[0].id,
      service_id: null,
      invoice_id: invoiceRow.id,
      date: addDays(invoiceDate, 4),
      start_time: '09:00',
      end_time: '12:00',
      duration_minutes: 180,
      hourly_rate: amount(160 + index * 8),
      description: `Atelier portefeuille ${index + 2}`,
      notes: null,
      billable: true,
      billed_at: isoTimestamp(addDays(invoiceDate, 5), 18),
      status: 'approved',
      created_at: isoTimestamp(addDays(invoiceDate, 4), 18),
    };

    const stockHistoryRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:stock-history`),
      product_id: productRow.id,
      user_product_id: productRow.id,
      company_id: companyRow.id,
      previous_quantity: 0,
      new_quantity: productRow.stock_quantity,
      change_quantity: productRow.stock_quantity,
      reason: 'purchase',
      notes: `Stock portefeuille ${index + 2}`,
      order_id: supplierOrderRow.id,
      created_by: base.userId,
      created_at: isoTimestamp(addDays(invoiceDate, 4), 10),
    };

    const stockAlertRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:stock-alert`),
      product_id: productRow.id,
      user_product_id: productRow.id,
      company_id: companyRow.id,
      alert_type: 'low_stock',
      is_active: false,
      resolved_at: isoTimestamp(addDays(invoiceDate, 8), 9),
      created_at: isoTimestamp(addDays(invoiceDate, 4), 10, 5),
    };

    const fixedAssetRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:fixed-asset`),
      user_id: base.userId,
      company_id: companyRow.id,
      asset_name: `Studio reporting ${config.label} ${index + 2}`,
      asset_code: `FA-${config.country}-P${code}`,
      acquisition_date: acquisitionDate,
      acquisition_cost: fixedAssetCost,
      residual_value: fixedAssetResidual,
      useful_life_years: 3 + (index % 2),
      depreciation_method: 'linear',
      asset_type: 'tangible',
      category: 'Workspace',
      description: `Espace reporting multisociete ${index + 2}`,
      status: 'active',
      account_code_asset: config.accounts.fixedAsset,
      account_code_depreciation: config.accounts.accumulatedDepreciation,
      account_code_expense: config.accounts.depreciationExpense,
      created_at: isoTimestamp(acquisitionDate, 10),
      updated_at: isoTimestamp(addDays(acquisitionDate, 16), 10, 5),
    };

    const snapshotRow = {
      id: uuidFromSeed(`${userSeed}:portfolio:${code}:dashboard-snapshot`),
      user_id: base.userId,
      company_id: companyRow.id,
      snapshot_type: 'dashboard',
      title: `${config.label} Portfolio Dashboard ${index + 2}`,
      share_token: uuidFromSeed(`${userSeed}:portfolio:${code}:snapshot-token`).replace(/-/g, '').slice(0, 24),
      snapshot_data: {
        currency: companyCurrency,
        summaryCards: [
          { label: 'Revenue', value: `${Number(invoiceRow.total_ttc || 0).toLocaleString('en-US')} ${companyCurrency}`, accentClass: 'text-emerald-300' },
          { label: 'Open balance', value: `${Number(invoiceRow.balance_due || 0).toLocaleString('en-US')} ${companyCurrency}`, accentClass: 'text-amber-300' },
          { label: 'Projects', value: '1', accentClass: 'text-violet-300' },
          { label: 'Fixed assets', value: '1', accentClass: 'text-cyan-300' },
        ],
      },
      is_public: true,
      expires_at: null,
      created_at: isoTimestamp(addDays(invoiceDate, 6), 10),
      updated_at: isoTimestamp(addDays(invoiceDate, 6), 10, 5),
    };

    const invoiceSeed = {
      code: `P${code}`,
      number: invoiceRow.invoice_number,
      totalHt: invoiceHt,
      month: invoiceMonth,
      day: invoiceDay,
    };
    const paymentSeed = {
      code: `P${code}`,
      month: Number(paymentDate.slice(5, 7)),
      day: Number(paymentDate.slice(8, 10)),
      amount: paymentAmount,
    };
    const expenseSeed = {
      code: `P${code}`,
      baseAmount: expenseHt,
      accountCode: config.expenses[0]?.accountCode || config.accounts.interestExpense,
      description: expenseRow.description,
      month: Number(expenseDate.slice(5, 7)),
      day: Number(expenseDate.slice(8, 10)),
    };
    const capexSeed = {
      code: `P${code}`,
      amount: fixedAssetRow.acquisition_cost,
      month: Number(acquisitionDate.slice(5, 7)),
      day: Number(acquisitionDate.slice(8, 10)),
      description: fixedAssetRow.asset_name,
    };
    const entryGroups = [
      buildInvoiceEntries(config, invoiceSeed),
      buildPaymentEntries(config, paymentSeed),
      buildExpenseEntries(config, expenseSeed),
      buildCapexEntries(config, capexSeed),
    ];
    ensureBalanced(entryGroups);

    const accountingEntries = entryGroups.flatMap((group, groupIndex) =>
      group.lines.map((line, lineIndex) => ({
        id: uuidFromSeed(`${userSeed}:portfolio:${code}:entry:${group.ref}:${line.accountCode}:${groupIndex}:${lineIndex}`),
        user_id: base.userId,
        company_id: companyRow.id,
        transaction_date: group.date,
        description: line.description,
        account_code: line.accountCode,
        debit: line.debit,
        credit: line.credit,
        source_type: 'manual_demo',
        source_id: uuidFromSeed(`${userSeed}:portfolio:${code}:source:${group.ref}`),
        journal: 'DEMO',
        entry_ref: group.ref,
        is_auto: false,
        created_at: isoTimestamp(group.date, 12, 10 + groupIndex + lineIndex),
      }))
    );

    return {
      clientRow,
      quoteRow,
      invoiceRow,
      invoiceItemRows,
      paymentRow,
      paymentAllocationRow,
      expenseRow,
      productCategoryRow,
      supplierProductCategoryRow,
      supplierRow,
      supplierProductRow,
      supplierServiceRow,
      productRow,
      supplierOrderRow,
      supplierOrderItemRow,
      supplierInvoiceRow,
      supplierInvoiceLineItemRow,
      projectRow,
      taskRows,
      subtaskRows,
      timesheetRow,
      stockHistoryRow,
      stockAlertRow,
      fixedAssetRow,
      snapshotRow,
      accountingEntries,
    };
  });

  fixedAssetRows = [
    ...fixedAssetRows,
    ...portfolioCompanyDatasets.map((dataset) => dataset.fixedAssetRow),
  ];

  const depreciationScheduleRows = fixedAssetRows.flatMap((asset, index) =>
    buildFixedAssetScheduleRows({
      userSeed,
      assetId: asset.id,
      userId: base.userId,
      companyId: asset.company_id,
      acquisitionDate: asset.acquisition_date,
      acquisitionCost: asset.acquisition_cost,
      residualValue: asset.residual_value,
      usefulLifeYears: asset.useful_life_years,
      postedPeriods: index === 0 ? 2 : asset.company_id === primaryCompanyId ? 0 : 1,
    })
  );

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
    company_id: primaryCompanyId,
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

  const primaryFixedAssetRows = fixedAssetRows.filter((asset) => asset.company_id === primaryCompanyId);
  const primaryDepreciationScheduleRows = depreciationScheduleRows.filter((row) => row.company_id === primaryCompanyId);
  const primaryDashboardSnapshotRows = dashboardSnapshotRows.filter((row) => row.company_id === primaryCompanyId);
  const primaryAccountingEntryRows = [
    ...base.accountingEntries.map((entry) => ({ ...entry, company_id: primaryCompanyId })),
    ...fixedAssetEntries.filter((entry) => entry.company_id === primaryCompanyId),
  ];
  const clonedCompanyDatasets = extraCompanyRows.map((companyRow, index) =>
    buildCompanyCloneDataset({
      primaryCompanyId,
      companyRow,
      companyIndex: index + 1,
      userSeed,
      sourceTables: {
        clientRows: primaryClientRows,
        invoiceRows: primaryInvoiceRows,
        paymentRows: primaryPaymentRows,
        expenseRows: primaryExpenseRows,
        productCategoryRows: primaryProductCategoryRows,
        serviceCategoryRows: primaryServiceCategoryRows,
        supplierRows: primarySupplierRows,
        supplierProductCategoryRows: primarySupplierProductCategoryRows,
        supplierProductRows: primarySupplierProductRows,
        supplierServiceRows: primarySupplierServiceRows,
        productRows: primaryProductRows,
        serviceRows: primaryServiceRows,
        invoiceItemRows: base.invoiceItemRows,
        paymentAllocationRows: base.paymentAllocationRows,
        quoteRows: primaryQuoteRows,
        purchaseOrderRows: primaryPurchaseOrderRows,
        recurringInvoiceRows: primaryRecurringInvoiceRows,
        recurringInvoiceLineItemRows: base.recurringInvoiceLineItemRows,
        paymentReminderRuleRows: primaryPaymentReminderRuleRows,
        paymentReminderLogRows: primaryPaymentReminderLogRows,
        supplierOrderRows: primarySupplierOrderRows,
        supplierOrderItemRows: base.supplierOrderItemRows,
        supplierInvoiceRows: primarySupplierInvoiceRows,
        supplierInvoiceLineItemRows: base.supplierInvoiceLineItemRows,
        projectRows: primaryProjectRows,
        taskRows: primaryTaskRows,
        subtaskRows: base.subtaskRows,
        timesheetRows: primaryTimesheetRows,
        creditNoteRows: primaryCreditNoteRows,
        creditNoteItemRows: base.creditNoteItemRows,
        deliveryNoteRows: primaryDeliveryNoteRows,
        deliveryNoteItemRows: base.deliveryNoteItemRows,
        receivableRows: primaryReceivableRows,
        payableRows: primaryPayableRows,
        debtPaymentRows: primaryDebtPaymentRows,
        bankConnectionRows: primaryBankConnectionRows,
        bankSyncHistoryRows: primaryBankSyncHistoryRows,
        bankTransactionRows: primaryBankTransactionRows,
        peppolLogRows: primaryPeppolLogRows,
        productStockHistoryRows: primaryStockHistoryRows,
        stockAlertRows: primaryStockAlertRows,
        fixedAssetRows: primaryFixedAssetRows,
        depreciationScheduleRows: primaryDepreciationScheduleRows,
        dashboardSnapshotRows: primaryDashboardSnapshotRows,
        accountingEntries: primaryAccountingEntryRows,
      },
    })
  );

  const accountingEntries = [
    ...base.accountingEntries.map((entry) => ({ ...entry, company_id: primaryCompanyId })),
    ...secondaryAccountingEntries,
    ...portfolioCompanyDatasets.flatMap((dataset) => dataset.accountingEntries),
    ...clonedCompanyDatasets.flatMap((dataset) => dataset.accountingEntries),
    ...fixedAssetEntries,
  ].map((entry) => withAnalyticalDimensions(entry, primaryCompanyId, portfolioCompanyIds, config.accounts.revenue));

  const allClientRows = [
    ...primaryClientRows,
    secondaryClientRow,
    ...portfolioCompanyDatasets.map((dataset) => dataset.clientRow),
    ...clonedCompanyDatasets.flatMap((dataset) => dataset.clientRows),
  ];
  const allProjectRows = [
    ...primaryProjectRows,
    secondaryProjectRow,
    ...portfolioCompanyDatasets.map((dataset) => dataset.projectRow),
    ...clonedCompanyDatasets.flatMap((dataset) => dataset.projectRows),
  ];

  const crmSupportSlaPolicyRows = companyRows.flatMap((companyRow, companyIndex) => {
    const code = String(companyIndex + 1).padStart(2, '0');
    return [
      {
        id: uuidFromSeed(`${userSeed}:crm-sla:${companyRow.id}:critical`),
        user_id: base.userId,
        company_id: companyRow.id,
        policy_name: `SLA Critical ${config.country}-${code}`,
        priority: 'critical',
        target_first_response_minutes: 15,
        target_resolution_minutes: 240,
        is_default: false,
        is_active: true,
        created_at: isoTimestamp(isoDate(CURRENT_YEAR, 1, 6), 9, 10 + companyIndex),
        updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 1, 6), 9, 10 + companyIndex),
      },
      {
        id: uuidFromSeed(`${userSeed}:crm-sla:${companyRow.id}:high`),
        user_id: base.userId,
        company_id: companyRow.id,
        policy_name: `SLA High ${config.country}-${code}`,
        priority: 'high',
        target_first_response_minutes: 60,
        target_resolution_minutes: 720,
        is_default: false,
        is_active: true,
        created_at: isoTimestamp(isoDate(CURRENT_YEAR, 1, 6), 9, 20 + companyIndex),
        updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 1, 6), 9, 20 + companyIndex),
      },
      {
        id: uuidFromSeed(`${userSeed}:crm-sla:${companyRow.id}:medium`),
        user_id: base.userId,
        company_id: companyRow.id,
        policy_name: `SLA Medium ${config.country}-${code}`,
        priority: 'medium',
        target_first_response_minutes: 120,
        target_resolution_minutes: 1440,
        is_default: true,
        is_active: true,
        created_at: isoTimestamp(isoDate(CURRENT_YEAR, 1, 6), 9, 30 + companyIndex),
        updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 1, 6), 9, 30 + companyIndex),
      },
      {
        id: uuidFromSeed(`${userSeed}:crm-sla:${companyRow.id}:low`),
        user_id: base.userId,
        company_id: companyRow.id,
        policy_name: `SLA Low ${config.country}-${code}`,
        priority: 'low',
        target_first_response_minutes: 240,
        target_resolution_minutes: 4320,
        is_default: false,
        is_active: true,
        created_at: isoTimestamp(isoDate(CURRENT_YEAR, 1, 6), 9, 40 + companyIndex),
        updated_at: isoTimestamp(isoDate(CURRENT_YEAR, 1, 6), 9, 40 + companyIndex),
      },
    ];
  });

  const crmSupportTicketRows = companyRows.flatMap((companyRow, companyIndex) => {
    const companyClients = allClientRows.filter((client) => client.company_id === companyRow.id);
    if (!companyClients.length) {
      return [];
    }
    const companyProjects = allProjectRows.filter((project) => project.company_id === companyRow.id);

    return [0, 1].map((ticketIndex) => {
      const client = companyClients[ticketIndex % companyClients.length];
      const project =
        companyProjects.find((candidate) => candidate.client_id === client.id) ||
        companyProjects[ticketIndex % Math.max(companyProjects.length, 1)] ||
        null;
      const numberCode = String(ticketIndex + 1).padStart(3, '0');
      const companyCode = String(companyIndex + 1).padStart(2, '0');
      const createdDate = isoDate(CURRENT_YEAR, 2 + ticketIndex, 10 + companyIndex);
      const dueDate = addDays(createdDate, 3 + ticketIndex);
      const isFirst = ticketIndex === 0;

      return {
        id: uuidFromSeed(`${userSeed}:crm-ticket:${companyRow.id}:${numberCode}`),
        user_id: base.userId,
        company_id: companyRow.id,
        client_id: client.id,
        project_id: project?.id || null,
        ticket_number: `TCK-${config.country}-${companyCode}-${numberCode}`,
        title: `${config.label} support ticket ${companyCode}-${numberCode}`,
        description: `Seed ticket ${config.label} for company scope validation.`,
        priority: isFirst ? 'high' : 'medium',
        status: isFirst ? 'open' : 'in_progress',
        sla_level: isFirst ? 'critical' : 'premium',
        due_at: isoTimestamp(dueDate, 17, 15),
        first_response_at: isoTimestamp(createdDate, 11, 0),
        resolved_at: null,
        closed_at: null,
        created_at: isoTimestamp(createdDate, 9, 30),
        updated_at: isoTimestamp(createdDate, 10, 45),
      };
    });
  });

  return {
    ...base,
    companyRows,
    userCompanyPreferenceRow,
    clientRows: allClientRows,
    invoiceRows: [...primaryInvoiceRows, secondaryInvoiceRow, ...portfolioCompanyDatasets.map((dataset) => dataset.invoiceRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.invoiceRows)],
    paymentRows: [...primaryPaymentRows, secondaryPaymentRow, ...portfolioCompanyDatasets.map((dataset) => dataset.paymentRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.paymentRows)],
    expenseRows: [...primaryExpenseRows, secondaryExpenseRow, ...portfolioCompanyDatasets.map((dataset) => dataset.expenseRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.expenseRows)],
    accountingEntries,
    productCategoryRows: [...primaryProductCategoryRows, secondaryProductCategoryRow, ...portfolioCompanyDatasets.map((dataset) => dataset.productCategoryRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.productCategoryRows)],
    serviceCategoryRows: [...primaryServiceCategoryRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.serviceCategoryRows)],
    supplierRows: [...primarySupplierRows, secondarySupplierRow, ...portfolioCompanyDatasets.map((dataset) => dataset.supplierRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.supplierRows)],
    supplierProductCategoryRows: [...primarySupplierProductCategoryRows, secondarySupplierProductCategoryRow, ...portfolioCompanyDatasets.map((dataset) => dataset.supplierProductCategoryRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.supplierProductCategoryRows)],
    supplierProductRows: [...primarySupplierProductRows, secondarySupplierProductRow, ...portfolioCompanyDatasets.map((dataset) => dataset.supplierProductRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.supplierProductRows)],
    supplierServiceRows: [...primarySupplierServiceRows, secondarySupplierServiceRow, ...portfolioCompanyDatasets.map((dataset) => dataset.supplierServiceRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.supplierServiceRows)],
    productRows: [...primaryProductRows, secondaryProductRow, ...portfolioCompanyDatasets.map((dataset) => dataset.productRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.productRows)],
    serviceRows: [...primaryServiceRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.serviceRows)],
    invoiceItemRows: [...base.invoiceItemRows, ...secondaryInvoiceItemRows, ...portfolioCompanyDatasets.flatMap((dataset) => dataset.invoiceItemRows), ...clonedCompanyDatasets.flatMap((dataset) => dataset.invoiceItemRows)],
    paymentAllocationRows: [...base.paymentAllocationRows, secondaryPaymentAllocationRow, ...portfolioCompanyDatasets.map((dataset) => dataset.paymentAllocationRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.paymentAllocationRows)],
    quoteRows: [...primaryQuoteRows, secondaryQuoteRow, ...portfolioCompanyDatasets.map((dataset) => dataset.quoteRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.quoteRows)],
    purchaseOrderRows: [...primaryPurchaseOrderRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.purchaseOrderRows)],
    recurringInvoiceRows: [...primaryRecurringInvoiceRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.recurringInvoiceRows)],
    recurringInvoiceLineItemRows: [...base.recurringInvoiceLineItemRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.recurringInvoiceLineItemRows)],
    paymentReminderRuleRows: [...primaryPaymentReminderRuleRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.paymentReminderRuleRows)],
    paymentReminderLogRows: [...primaryPaymentReminderLogRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.paymentReminderLogRows)],
    supplierOrderRows: [...primarySupplierOrderRows, secondarySupplierOrderRow, ...portfolioCompanyDatasets.map((dataset) => dataset.supplierOrderRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.supplierOrderRows)],
    supplierOrderItemRows: [...base.supplierOrderItemRows, secondarySupplierOrderItemRow, ...portfolioCompanyDatasets.map((dataset) => dataset.supplierOrderItemRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.supplierOrderItemRows)],
    supplierInvoiceRows: [...primarySupplierInvoiceRows, secondarySupplierInvoiceRow, ...portfolioCompanyDatasets.map((dataset) => dataset.supplierInvoiceRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.supplierInvoiceRows)],
    supplierInvoiceLineItemRows: [...base.supplierInvoiceLineItemRows, secondarySupplierInvoiceLineItemRow, ...portfolioCompanyDatasets.map((dataset) => dataset.supplierInvoiceLineItemRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.supplierInvoiceLineItemRows)],
    projectRows: allProjectRows,
    taskRows: [...primaryTaskRows, ...secondaryTaskRows, ...portfolioCompanyDatasets.flatMap((dataset) => dataset.taskRows), ...clonedCompanyDatasets.flatMap((dataset) => dataset.taskRows)],
    subtaskRows: [...base.subtaskRows, ...secondarySubtaskRows, ...portfolioCompanyDatasets.flatMap((dataset) => dataset.subtaskRows), ...clonedCompanyDatasets.flatMap((dataset) => dataset.subtaskRows)],
    timesheetRows: [...primaryTimesheetRows, secondaryTimesheetRow, ...portfolioCompanyDatasets.map((dataset) => dataset.timesheetRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.timesheetRows)],
    creditNoteRows: [...primaryCreditNoteRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.creditNoteRows)],
    creditNoteItemRows: [...base.creditNoteItemRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.creditNoteItemRows)],
    deliveryNoteRows: [...primaryDeliveryNoteRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.deliveryNoteRows)],
    deliveryNoteItemRows: [...base.deliveryNoteItemRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.deliveryNoteItemRows)],
    receivableRows: [...primaryReceivableRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.receivableRows)],
    payableRows: [...primaryPayableRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.payableRows)],
    debtPaymentRows: [...primaryDebtPaymentRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.debtPaymentRows)],
    productStockHistoryRows: [...primaryStockHistoryRows, secondaryStockHistoryRow, ...portfolioCompanyDatasets.map((dataset) => dataset.stockHistoryRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.productStockHistoryRows)],
    stockAlertRows: [...primaryStockAlertRows, secondaryStockAlertRow, ...portfolioCompanyDatasets.map((dataset) => dataset.stockAlertRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.stockAlertRows)],
    bankConnectionRows: [...primaryBankConnectionRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.bankConnectionRows)],
    bankSyncHistoryRows: [...primaryBankSyncHistoryRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.bankSyncHistoryRows)],
    bankTransactionRows: [...primaryBankTransactionRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.bankTransactionRows)],
    peppolLogRows: [...primaryPeppolLogRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.peppolLogRows)],
    fixedAssetRows: [...fixedAssetRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.fixedAssetRows)],
    depreciationScheduleRows: [...depreciationScheduleRows, ...clonedCompanyDatasets.flatMap((dataset) => dataset.depreciationScheduleRows)],
    analyticalAxisRows,
    dashboardSnapshotRows: [...dashboardSnapshotRows, ...portfolioCompanyDatasets.map((dataset) => dataset.snapshotRow), ...clonedCompanyDatasets.flatMap((dataset) => dataset.dashboardSnapshotRows)],
    crmSupportSlaPolicyRows,
    crmSupportTicketRows,
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

function isMissingTableError(message, table) {
  if (!message) return false;
  return message.includes(`Could not find the table 'public.${table}'`) || message.includes(`relation "public.${table}" does not exist`);
}

async function deleteRows(client, table, filterColumn, value, options = {}) {
  const { allowMissingColumn = false, allowMissingTable = false } = options;
  const { error } = await client.from(table).delete().eq(filterColumn, value);
  if (error) {
    const message = String(error.message || '');
    if (allowMissingColumn && isMissingColumnError(message, filterColumn)) {
      return;
    }
    if (allowMissingTable && isMissingTableError(message, table)) {
      return;
    }
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

function toUniqueIds(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function chunkValues(values, size = 500) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function isMissingColumnError(message, column) {
  if (!message) return false;
  return message.includes(`Could not find the '${column}' column`) || message.includes(`column "${column}" does not exist`);
}

async function listIdsByFilter(client, table, filterColumn, value, options = {}) {
  if (!value) return [];
  const { allowMissingColumn = false } = options;
  const { data, error } = await client.from(table).select('id').eq(filterColumn, value);
  if (error) {
    if (allowMissingColumn && isMissingColumnError(String(error.message || ''), filterColumn)) {
      return [];
    }
    throw new Error(`Failed to list ${table} by ${filterColumn}: ${error.message}`);
  }
  return toUniqueIds((data || []).map((row) => row.id));
}

async function listIdsByValues(client, table, filterColumn, values, options = {}) {
  const scopedValues = toUniqueIds(values);
  if (!scopedValues.length) return [];
  const { allowMissingColumn = false } = options;
  const ids = [];

  for (const batch of chunkValues(scopedValues)) {
    const { data, error } = await client.from(table).select('id').in(filterColumn, batch);
    if (error) {
      if (allowMissingColumn && isMissingColumnError(String(error.message || ''), filterColumn)) {
        return [];
      }
      throw new Error(`Failed to list ${table} by ${filterColumn}: ${error.message}`);
    }
    ids.push(...(data || []).map((row) => row.id));
  }

  return toUniqueIds(ids);
}

async function deleteRowsByValues(client, table, filterColumn, values, options = {}) {
  const scopedValues = toUniqueIds(values);
  if (!scopedValues.length) return;
  const { allowMissingColumn = false } = options;

  for (const batch of chunkValues(scopedValues)) {
    const { error } = await client.from(table).delete().in(filterColumn, batch);
    if (error) {
      if (allowMissingColumn && isMissingColumnError(String(error.message || ''), filterColumn)) {
        return;
      }
      throw new Error(`Failed to cleanup ${table}: ${error.message}`);
    }
  }
}

async function cleanupScenarioRows(client, userId) {
  const { data, error } = await client
    .from('financial_scenarios')
    .select('id')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to list financial_scenarios: ${error.message}`);
  }

  const scenarioIds = (data || []).map((row) => row.id).filter(Boolean);
  if (!scenarioIds.length) {
    return;
  }

  const { error: resultsError } = await client.from('scenario_results').delete().in('scenario_id', scenarioIds);
  if (resultsError) {
    throw new Error(`Failed to cleanup scenario_results: ${resultsError.message}`);
  }

  const { error: assumptionsError } = await client.from('scenario_assumptions').delete().in('scenario_id', scenarioIds);
  if (assumptionsError) {
    throw new Error(`Failed to cleanup scenario_assumptions: ${assumptionsError.message}`);
  }

  const { error: comparisonsError } = await client.from('scenario_comparisons').delete().eq('user_id', userId);
  if (comparisonsError && !String(comparisonsError.message || '').includes('does not exist')) {
    throw new Error(`Failed to cleanup scenario_comparisons: ${comparisonsError.message}`);
  }

  const { error: scenariosError } = await client.from('financial_scenarios').delete().eq('user_id', userId);
  if (scenariosError) {
    throw new Error(`Failed to cleanup financial_scenarios: ${scenariosError.message}`);
  }
}

async function cleanupDemoDataset(client, dataset) {
  const seedCompanyIds = toUniqueIds(((dataset.companyRows || [dataset.companyRow]) || []).map((row) => row?.id));
  const existingCompanyIds = await listIdsByFilter(client, 'company', 'user_id', dataset.userId);
  const companyIds = toUniqueIds([...seedCompanyIds, ...existingCompanyIds]);

  const invoiceIds = toUniqueIds([
    ...(await listIdsByFilter(client, 'invoices', 'user_id', dataset.userId)),
    ...(await listIdsByValues(client, 'invoices', 'company_id', companyIds, { allowMissingColumn: true })),
  ]);
  const paymentIds = toUniqueIds([
    ...(await listIdsByFilter(client, 'payments', 'user_id', dataset.userId)),
    ...(await listIdsByValues(client, 'payments', 'company_id', companyIds, { allowMissingColumn: true })),
  ]);
  const recurringInvoiceIds = toUniqueIds([
    ...(await listIdsByFilter(client, 'recurring_invoices', 'user_id', dataset.userId)),
    ...(await listIdsByValues(client, 'recurring_invoices', 'company_id', companyIds, { allowMissingColumn: true })),
  ]);
  const projectIds = toUniqueIds([
    ...(await listIdsByFilter(client, 'projects', 'user_id', dataset.userId)),
    ...(await listIdsByValues(client, 'projects', 'company_id', companyIds, { allowMissingColumn: true })),
  ]);
  const quoteIds = toUniqueIds([
    ...(await listIdsByFilter(client, 'quotes', 'user_id', dataset.userId)),
    ...(await listIdsByValues(client, 'quotes', 'company_id', companyIds, { allowMissingColumn: true })),
  ]);
  const purchaseOrderIds = toUniqueIds([
    ...(await listIdsByFilter(client, 'purchase_orders', 'user_id', dataset.userId)),
    ...(await listIdsByValues(client, 'purchase_orders', 'company_id', companyIds, { allowMissingColumn: true })),
  ]);
  const taskIds = toUniqueIds([
    ...(await listIdsByValues(client, 'tasks', 'project_id', projectIds)),
    ...(await listIdsByValues(client, 'tasks', 'invoice_id', invoiceIds, { allowMissingColumn: true })),
    ...(await listIdsByValues(client, 'tasks', 'quote_id', quoteIds, { allowMissingColumn: true })),
    ...(await listIdsByValues(client, 'tasks', 'purchase_order_id', purchaseOrderIds, { allowMissingColumn: true })),
  ]);
  const productIds = toUniqueIds([
    ...(await listIdsByFilter(client, 'products', 'user_id', dataset.userId)),
    ...(await listIdsByValues(client, 'products', 'company_id', companyIds, { allowMissingColumn: true })),
  ]);
  const supplierIds = toUniqueIds([
    ...(await listIdsByFilter(client, 'suppliers', 'user_id', dataset.userId)),
    ...(await listIdsByValues(client, 'suppliers', 'company_id', companyIds, { allowMissingColumn: true })),
  ]);
  const supplierInvoiceIds = toUniqueIds([
    ...(await listIdsByFilter(client, 'supplier_invoices', 'user_id', dataset.userId, { allowMissingColumn: true })),
    ...(await listIdsByValues(client, 'supplier_invoices', 'supplier_id', supplierIds)),
    ...(await listIdsByValues(client, 'supplier_invoices', 'company_id', companyIds, { allowMissingColumn: true })),
  ]);
  const supplierOrderIds = toUniqueIds([
    ...(await listIdsByFilter(client, 'supplier_orders', 'user_id', dataset.userId, { allowMissingColumn: true })),
    ...(await listIdsByValues(client, 'supplier_orders', 'supplier_id', supplierIds)),
    ...(await listIdsByValues(client, 'supplier_orders', 'company_id', companyIds, { allowMissingColumn: true })),
  ]);
  const deliveryNoteIds = toUniqueIds([
    ...(await listIdsByFilter(client, 'delivery_notes', 'user_id', dataset.userId)),
    ...(await listIdsByValues(client, 'delivery_notes', 'company_id', companyIds, { allowMissingColumn: true })),
  ]);
  const creditNoteIds = toUniqueIds([
    ...(await listIdsByFilter(client, 'credit_notes', 'user_id', dataset.userId)),
    ...(await listIdsByValues(client, 'credit_notes', 'company_id', companyIds, { allowMissingColumn: true })),
  ]);

  await cleanupScenarioRows(client, dataset.userId);
  await deleteRows(client, 'dashboard_snapshots', 'user_id', dataset.userId);
  await deleteRows(client, 'accounting_depreciation_schedule', 'user_id', dataset.userId);
  await deleteRows(client, 'accounting_fixed_assets', 'user_id', dataset.userId);
  await deleteRows(client, 'accounting_analytical_axes', 'user_id', dataset.userId);
  await deleteRowsByIds(client, 'webhook_deliveries', dataset.webhookDeliveryRows.map((row) => row.id));
  await deleteRowsByIds(client, 'bank_transactions', dataset.bankTransactionRows.map((row) => row.id));
  await deleteRowsByIds(client, 'bank_sync_history', dataset.bankSyncHistoryRows.map((row) => row.id));
  await deleteRowsByValues(client, 'delivery_note_items', 'delivery_note_id', deliveryNoteIds);
  await deleteRowsByValues(client, 'credit_note_items', 'credit_note_id', creditNoteIds);
  await deleteRowsByValues(client, 'recurring_invoice_line_items', 'recurring_invoice_id', recurringInvoiceIds);
  await deleteRowsByValues(client, 'supplier_invoice_line_items', 'invoice_id', supplierInvoiceIds);
  await deleteRowsByValues(client, 'supplier_order_items', 'order_id', supplierOrderIds);
  await deleteRowsByValues(client, 'payment_allocations', 'payment_id', paymentIds);
  await deleteRowsByValues(client, 'payment_allocations', 'invoice_id', invoiceIds);
  await deleteRowsByValues(client, 'invoice_items', 'invoice_id', invoiceIds);
  await deleteRowsByValues(client, 'subtasks', 'task_id', taskIds);
  await deleteRows(client, 'payments', 'user_id', dataset.userId);
  await deleteRows(client, 'timesheets', 'user_id', dataset.userId);
  await deleteRowsByValues(client, 'tasks', 'id', taskIds);
  await deleteRows(client, 'projects', 'user_id', dataset.userId);
  await deleteRows(client, 'purchase_orders', 'user_id', dataset.userId);
  await deleteRows(client, 'quotes', 'user_id', dataset.userId);
  await deleteRows(client, 'recurring_invoices', 'user_id', dataset.userId);
  await deleteRows(client, 'payment_reminder_logs', 'user_id', dataset.userId);
  await deleteRows(client, 'payment_reminder_rules', 'user_id', dataset.userId);
  await deleteRows(client, 'credit_notes', 'user_id', dataset.userId);
  await deleteRows(client, 'delivery_notes', 'user_id', dataset.userId);
  await deleteRowsByValues(client, 'supplier_invoices', 'id', supplierInvoiceIds);
  await deleteRowsByValues(client, 'supplier_orders', 'id', supplierOrderIds);
  await deleteRowsByValues(client, 'supplier_services', 'supplier_id', supplierIds);
  await deleteRowsByValues(client, 'supplier_products', 'supplier_id', supplierIds);
  await deleteRows(client, 'supplier_product_categories', 'user_id', dataset.userId);
  await deleteRows(client, 'suppliers', 'user_id', dataset.userId);
  await deleteRows(client, 'peppol_transmission_log', 'user_id', dataset.userId);
  await deleteRows(client, 'webhook_endpoints', 'user_id', dataset.userId);
  await deleteRows(client, 'bank_connections', 'user_id', dataset.userId);
  await deleteRowsByValues(client, 'stock_alerts', 'user_product_id', productIds);
  await deleteRowsByValues(client, 'product_stock_history', 'user_product_id', productIds);
  await deleteRowsByValues(client, 'stock_alerts', 'company_id', companyIds, { allowMissingColumn: true });
  await deleteRowsByValues(client, 'product_stock_history', 'company_id', companyIds, { allowMissingColumn: true });
  await deleteRows(client, 'products', 'user_id', dataset.userId);
  await deleteRows(client, 'services', 'user_id', dataset.userId);
  await deleteRows(client, 'product_categories', 'user_id', dataset.userId);
  await deleteRows(client, 'service_categories', 'user_id', dataset.userId);
  await deleteRows(client, 'receivables', 'user_id', dataset.userId);
  await deleteRows(client, 'payables', 'user_id', dataset.userId);
  await deleteRows(client, 'debt_payments', 'user_id', dataset.userId);
  await deleteRows(client, 'crm_activities', 'user_id', dataset.userId, { allowMissingTable: true });
  await deleteRows(client, 'crm_support_tickets', 'user_id', dataset.userId, { allowMissingTable: true });
  await deleteRows(client, 'crm_support_sla_policies', 'user_id', dataset.userId, { allowMissingTable: true });
  await deleteRows(client, 'crm_opportunities', 'user_id', dataset.userId, { allowMissingTable: true });
  await deleteRows(client, 'crm_contacts', 'user_id', dataset.userId, { allowMissingTable: true });
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

  const companyScopedResidualTables = [
    'product_stock_history',
    'stock_alerts',
    'supplier_services',
    'supplier_products',
    'supplier_invoices',
    'supplier_orders',
    'supplier_locations',
    'supplier_reports_cache',
    'supplier_product_categories',
    'suppliers',
    'products',
    'product_categories',
    'services',
    'service_categories',
    'payments',
    'timesheets',
    'expenses',
    'invoices',
    'quotes',
    'projects',
    'clients',
    'recurring_invoices',
    'payment_reminder_logs',
    'payment_reminder_rules',
    'credit_notes',
    'delivery_notes',
    'purchase_orders',
    'receivables',
    'payables',
    'debt_payments',
    'bank_transactions',
    'bank_sync_history',
    'bank_connections',
    'peppol_transmission_log',
    'accounting_depreciation_schedule',
    'accounting_fixed_assets',
    'accounting_entries',
    'dashboard_snapshots',
    'financial_scenarios',
    'scenario_comparisons',
  ];

  for (const table of companyScopedResidualTables) {
    await deleteRowsByValues(client, table, 'company_id', companyIds, { allowMissingColumn: true });
  }

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

async function filterExistingAccountingEntries(client, userId, entries) {
  if (!entries.length) {
    return entries;
  }

  const { data, error } = await client
    .from('accounting_entries')
    .select('company_id,transaction_date,account_code,entry_ref')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to read accounting_entries for deduplication: ${error.message}`);
  }

  const buildKey = (row) =>
    [
      String(row.transaction_date || '').slice(0, 10),
      row.account_code || '',
      row.entry_ref || '',
    ].join('|');

  const seenKeys = new Set((data || []).map((row) => buildKey(row)));
  const filteredEntries = [];

  for (const row of entries) {
    const key = buildKey(row);
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    filteredEntries.push(row);
  }

  return filteredEntries;
}

async function listCompanyRowsForUser(client, userId) {
  const { data, error } = await client
    .from('company')
    .select('id,company_name,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list company rows for ${userId}: ${error.message}`);
  }

  return data || [];
}

function remapCompanyScopedRow(row, companyIdMap) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return row;
  }

  const nextRow = { ...row };

  if (nextRow.company_id && companyIdMap.has(nextRow.company_id)) {
    nextRow.company_id = companyIdMap.get(nextRow.company_id);
  }

  if (nextRow.active_company_id && companyIdMap.has(nextRow.active_company_id)) {
    nextRow.active_company_id = companyIdMap.get(nextRow.active_company_id);
  }

  return nextRow;
}

function remapCompanyScopedDataset(dataset, companyIdMap, companyRows, activeCompanyId) {
  const nextDataset = { ...dataset };

  for (const [key, value] of Object.entries(nextDataset)) {
    if (key === 'config') {
      continue;
    }

    if (Array.isArray(value)) {
      nextDataset[key] = value.map((item) => remapCompanyScopedRow(item, companyIdMap));
      continue;
    }

    if (value && typeof value === 'object') {
      nextDataset[key] = remapCompanyScopedRow(value, companyIdMap);
    }
  }

  nextDataset.companyRows = companyRows.map((companyRow) => ({
    ...companyRow,
    user_id: dataset.userId,
    updated_at: new Date().toISOString(),
  }));

  const resolvedActiveCompanyId = activeCompanyId || companyRows[0]?.id || dataset.companyRow?.id || null;
  const mappedCompanyRow =
    nextDataset.companyRows.find((row) => row.id === resolvedActiveCompanyId) ||
    nextDataset.companyRows[0] ||
    remapCompanyScopedRow(dataset.companyRow, companyIdMap);

  nextDataset.companyRow = mappedCompanyRow;

  if (nextDataset.userCompanyPreferenceRow) {
    nextDataset.userCompanyPreferenceRow = {
      ...nextDataset.userCompanyPreferenceRow,
      active_company_id: resolvedActiveCompanyId,
    };
  }

  return nextDataset;
}

function ensureSeedProductsLinkedToSuppliers(dataset) {
  const supplierRows = Array.isArray(dataset?.supplierRows) ? dataset.supplierRows : [];
  const productRows = Array.isArray(dataset?.productRows) ? dataset.productRows : [];

  if (!supplierRows.length || !productRows.length) {
    return dataset;
  }

  const supplierIdsByCompany = new Map();
  const allSupplierIds = [];

  for (const supplier of supplierRows) {
    if (!supplier?.id) {
      continue;
    }

    allSupplierIds.push(supplier.id);
    const companyKey = supplier.company_id || '__no_company__';
    const companySupplierIds = supplierIdsByCompany.get(companyKey) || [];
    companySupplierIds.push(supplier.id);
    supplierIdsByCompany.set(companyKey, companySupplierIds);
  }

  if (!allSupplierIds.length) {
    return dataset;
  }

  const normalizedProductRows = productRows.map((product) => {
    if (!product || typeof product !== 'object') {
      return product;
    }

    const companyKey = product.company_id || '__no_company__';
    const companySupplierIds = supplierIdsByCompany.get(companyKey) || [];
    const currentSupplierId = product.supplier_id || null;
    const currentSupplierIsValid = currentSupplierId
      && (
        (companySupplierIds.length > 0 && companySupplierIds.includes(currentSupplierId))
        || (companySupplierIds.length === 0 && allSupplierIds.includes(currentSupplierId))
      );

    if (currentSupplierIsValid) {
      return product;
    }

    const fallbackSupplierId = companySupplierIds[0] || allSupplierIds[0] || null;
    if (!fallbackSupplierId) {
      return product;
    }

    return {
      ...product,
      supplier_id: fallbackSupplierId,
    };
  });

  return {
    ...dataset,
    productRows: normalizedProductRows,
  };
}

async function adaptDatasetForExistingCompanies(client, dataset) {
  const existingCompanyRows = await listCompanyRowsForUser(client, dataset.userId);
  if (!existingCompanyRows.length) {
    return dataset;
  }

  const generatedCompanyRows = (dataset.companyRows || [dataset.companyRow]).filter(Boolean);
  if (!generatedCompanyRows.length) {
    return dataset;
  }

  const generatedPrimaryCompanyId = dataset.companyRow?.id || generatedCompanyRows[0]?.id || null;
  const generatedSecondaryCompanyId =
    generatedCompanyRows.find((row) => row?.id && row.id !== generatedPrimaryCompanyId)?.id || null;

  const existingPrimaryCompany =
    existingCompanyRows.find((row) => row.id === generatedPrimaryCompanyId) ||
    existingCompanyRows[existingCompanyRows.length - 1] ||
    existingCompanyRows[0];

  const usedCompanyIds = new Set();
  const companyIdMap = new Map();

  if (generatedPrimaryCompanyId && existingPrimaryCompany?.id) {
    companyIdMap.set(generatedPrimaryCompanyId, existingPrimaryCompany.id);
    usedCompanyIds.add(existingPrimaryCompany.id);
  }

  if (generatedSecondaryCompanyId) {
    const existingSecondaryCompany =
      existingCompanyRows.find((row) => row.id === generatedSecondaryCompanyId && !usedCompanyIds.has(row.id)) ||
      existingCompanyRows.find((row) => !usedCompanyIds.has(row.id));

    if (existingSecondaryCompany?.id) {
      companyIdMap.set(generatedSecondaryCompanyId, existingSecondaryCompany.id);
      usedCompanyIds.add(existingSecondaryCompany.id);
    }
  }

  const remainingGeneratedCompanyIds = generatedCompanyRows
    .map((row) => row.id)
    .filter((id) => id && !companyIdMap.has(id));
  const remainingExistingCompanies = existingCompanyRows.filter((row) => !usedCompanyIds.has(row.id));

  for (let index = 0; index < remainingGeneratedCompanyIds.length; index += 1) {
    const generatedCompanyId = remainingGeneratedCompanyIds[index];
    const fallbackExistingCompany =
      remainingExistingCompanies[index] ||
      existingCompanyRows[index % existingCompanyRows.length] ||
      existingPrimaryCompany;

    if (fallbackExistingCompany?.id) {
      companyIdMap.set(generatedCompanyId, fallbackExistingCompany.id);
    }
  }

  const activeCompanyId =
    companyIdMap.get(dataset.userCompanyPreferenceRow?.active_company_id) ||
    existingPrimaryCompany?.id ||
    existingCompanyRows[0]?.id ||
    null;

  return remapCompanyScopedDataset(dataset, companyIdMap, existingCompanyRows, activeCompanyId);
}

async function ensureCompanyThresholdRows(client, dataset, minimum = 7) {
  const userId = dataset.userId;
  const companies = (dataset.companyRows || [dataset.companyRow]).filter((row) => row?.id);

  for (const company of companies) {
    const companyId = company.id;

    const { data: paymentRows, error: paymentError } = await client
      .from('payments')
      .select('id, invoice_id, client_id, amount, payment_method, payment_date, notes, is_lump_sum, created_at')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .order('payment_date', { ascending: true });
    if (paymentError) {
      throw new Error(`Failed to read payments for threshold top-up: ${paymentError.message}`);
    }

    const existingPayments = paymentRows || [];
    let paymentTemplate = existingPayments[0] || null;
    if (!paymentTemplate) {
      const { data: invoiceTemplateRows, error: invoiceTemplateError } = await client
        .from('invoices')
        .select('id, client_id, date')
        .eq('user_id', userId)
        .eq('company_id', companyId)
        .limit(1);
      if (invoiceTemplateError) {
        throw new Error(`Failed to read invoice template for payment top-up: ${invoiceTemplateError.message}`);
      }

      const invoiceTemplate = invoiceTemplateRows?.[0] || null;
      paymentTemplate = {
        invoice_id: invoiceTemplate?.id || null,
        client_id: invoiceTemplate?.client_id || null,
        amount: 0,
        payment_method: 'bank_transfer',
        payment_date: invoiceTemplate?.date || isoDate(CURRENT_YEAR, 1, 15),
        notes: 'Seed threshold top-up',
        is_lump_sum: false,
        created_at: `${invoiceTemplate?.date || isoDate(CURRENT_YEAR, 1, 15)}T15:30:00Z`,
      };
    }

    if (existingPayments.length < minimum) {
      const topUpPayments = [];
      for (let index = existingPayments.length; index < minimum; index += 1) {
        const month = (index % 7) + 1;
        const day = 14 + (index % 10);
        const paymentDate = isoDate(CURRENT_YEAR, month, Math.min(day, 28));
        const code = String(index + 1).padStart(3, '0');

        topUpPayments.push({
          id: uuidFromSeed(`${dataset.userSeed}:threshold:payment:${companyId}:${code}`),
          user_id: userId,
          company_id: companyId,
          invoice_id: paymentTemplate.invoice_id || null,
          client_id: paymentTemplate.client_id || null,
          amount: Number(paymentTemplate.amount || 0),
          payment_method: paymentTemplate.payment_method || 'bank_transfer',
          payment_date: paymentDate,
          reference: `TOPUP-${companyId.slice(0, 8)}-${code}`,
          receipt_number: `TOPUP-REC-${companyId.slice(0, 6)}-${code}`,
          notes: 'Seed threshold top-up',
          is_lump_sum: Boolean(paymentTemplate.is_lump_sum),
          created_at: `${paymentDate}T15:30:00Z`,
        });
      }

      await upsertRows(client, 'payments', topUpPayments, 'id');
    }

    const { data: snapshotRows, error: snapshotError } = await client
      .from('dashboard_snapshots')
      .select('id, snapshot_type, title, snapshot_data, share_token')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });
    if (snapshotError) {
      throw new Error(`Failed to read dashboard_snapshots for threshold top-up: ${snapshotError.message}`);
    }

    const existingSnapshots = snapshotRows || [];
    const snapshotTemplate = existingSnapshots[0] || {
      snapshot_type: 'dashboard',
      title: `${company.company_name || 'CashPilot'} Dashboard`,
      snapshot_data: { source: 'seed-threshold-top-up' },
      share_token: null,
    };

    if (existingSnapshots.length < minimum) {
      const topUpSnapshots = [];
      for (let index = existingSnapshots.length; index < minimum; index += 1) {
        const code = String(index + 1).padStart(3, '0');
        const month = (index % 7) + 1;
        const day = 8 + (index % 12);
        const createdAt = `${isoDate(CURRENT_YEAR, month, Math.min(day, 28))}T09:10:00Z`;

        topUpSnapshots.push({
          id: uuidFromSeed(`${dataset.userSeed}:threshold:snapshot:${companyId}:${code}`),
          user_id: userId,
          company_id: companyId,
          snapshot_type: snapshotTemplate.snapshot_type || 'dashboard',
          title: `${snapshotTemplate.title || 'Dashboard Snapshot'} ${code}`,
          snapshot_data: snapshotTemplate.snapshot_data || { source: 'seed-threshold-top-up' },
          share_token: uuidFromSeed(`${dataset.userSeed}:threshold:share:${companyId}:${code}`).replace(/-/g, '').slice(0, 24),
          created_at: createdAt,
          expires_at: null,
          is_active: true,
        });
      }

      await upsertRows(client, 'dashboard_snapshots', topUpSnapshots, 'id');
    }
  }
}

async function applyDataset(client, dataset, options) {
  const authSummary = await ensureAuthUser(client, dataset, options);
  const companyScopedDataset = options.preserveCompanies
    ? await adaptDatasetForExistingCompanies(client, dataset)
    : dataset;
  const effectiveDataset = ensureSeedProductsLinkedToSuppliers(companyScopedDataset);
  const scenarioSeed = await buildScenarioSeedRows(effectiveDataset);

  if (!options.preserveCompanies) {
    await cleanupDemoDataset(client, effectiveDataset);
  }

  await upsertRows(client, 'profiles', [effectiveDataset.profileRow], 'user_id');
  if (!options.preserveCompanies) {
    await upsertRows(client, 'company', effectiveDataset.companyRows || [effectiveDataset.companyRow], 'id');
  }
  await upsertRows(client, 'user_company_preferences', [effectiveDataset.userCompanyPreferenceRow], 'user_id');
  await upsertRows(client, 'user_roles', [effectiveDataset.userRoleRow], 'user_id');
  await upsertRows(client, 'user_accounting_settings', [effectiveDataset.settingsRow], 'user_id');
  await upsertRows(client, 'dashboard_snapshots', effectiveDataset.dashboardSnapshotRows || [], 'id');
  await upsertRows(client, 'payment_terms', effectiveDataset.paymentTermRows, 'id');
  await upsertRows(client, 'accounting_chart_of_accounts', effectiveDataset.chartRows, 'company_id,account_code');
  await upsertRows(client, 'accounting_mappings', effectiveDataset.mappingRows, 'user_id,source_type,source_category');
  await upsertRows(client, 'accounting_tax_rates', effectiveDataset.taxRateRows, 'id');
  await upsertRows(client, 'accounting_analytical_axes', effectiveDataset.analyticalAxisRows || [], 'id');
  await upsertRows(client, 'accounting_fixed_assets', effectiveDataset.fixedAssetRows || [], 'id');
  await upsertRows(client, 'accounting_depreciation_schedule', effectiveDataset.depreciationScheduleRows || [], 'id');
  await upsertRows(client, 'product_categories', effectiveDataset.productCategoryRows, 'id');
  await upsertRows(client, 'service_categories', effectiveDataset.serviceCategoryRows, 'id');
  await upsertRows(client, 'supplier_product_categories', effectiveDataset.supplierProductCategoryRows, 'id');
  await upsertRows(client, 'suppliers', effectiveDataset.supplierRows, 'id');
  await upsertRows(client, 'supplier_products', effectiveDataset.supplierProductRows, 'id');
  await upsertRows(client, 'supplier_services', effectiveDataset.supplierServiceRows, 'id');
  await upsertRows(client, 'products', effectiveDataset.productRows, 'id');
  await upsertRows(client, 'services', effectiveDataset.serviceRows, 'id');
  await upsertRows(client, 'clients', effectiveDataset.clientRows, 'id');
  await upsertRows(client, 'quotes', effectiveDataset.quoteRows, 'id');
  await upsertRows(client, 'purchase_orders', effectiveDataset.purchaseOrderRows, 'id');
  await upsertRows(client, 'projects', effectiveDataset.projectRows, 'id');
  await upsertRows(client, 'crm_support_sla_policies', effectiveDataset.crmSupportSlaPolicyRows || [], 'id');
  await upsertRows(client, 'crm_support_tickets', effectiveDataset.crmSupportTicketRows || [], 'id');
  const fallbackTeamCompanyId = effectiveDataset.userCompanyPreferenceRow?.active_company_id || effectiveDataset.companyRow?.id || null;
  const normalizedTeamMemberRows = (effectiveDataset.teamMemberRows || []).map((row) => ({
    ...row,
    company_id: row.company_id || fallbackTeamCompanyId,
  }));
  await upsertRows(client, 'team_members', normalizedTeamMemberRows, 'id');
  await upsertRows(client, 'invoices', effectiveDataset.invoiceRows, 'id');
  await upsertRows(client, 'invoice_items', effectiveDataset.invoiceItemRows, 'id');
  await upsertRows(
    client,
    'payments',
    effectiveDataset.paymentRows.map(({ code, month, day, ...row }) => row),
    'id'
  );
  await upsertRows(client, 'payment_allocations', effectiveDataset.paymentAllocationRows, 'id');
  await upsertRows(client, 'recurring_invoices', effectiveDataset.recurringInvoiceRows, 'id');
  await upsertRows(client, 'recurring_invoice_line_items', effectiveDataset.recurringInvoiceLineItemRows, 'id');
  await upsertRows(client, 'payment_reminder_rules', effectiveDataset.paymentReminderRuleRows, 'id');
  await upsertRows(client, 'payment_reminder_logs', effectiveDataset.paymentReminderLogRows, 'id');
  await upsertRows(client, 'supplier_orders', effectiveDataset.supplierOrderRows, 'id');
  await upsertRows(client, 'supplier_order_items', effectiveDataset.supplierOrderItemRows, 'id');
  await upsertRows(client, 'supplier_invoices', effectiveDataset.supplierInvoiceRows, 'id');
  await upsertRows(client, 'supplier_invoice_line_items', effectiveDataset.supplierInvoiceLineItemRows, 'id');
  await upsertRows(client, 'tasks', effectiveDataset.taskRows, 'id');
  await upsertRows(client, 'subtasks', effectiveDataset.subtaskRows, 'id');
  await upsertRows(client, 'timesheets', effectiveDataset.timesheetRows, 'id');
  await upsertRows(client, 'credit_notes', effectiveDataset.creditNoteRows, 'id');
  await upsertRows(client, 'credit_note_items', effectiveDataset.creditNoteItemRows, 'id');
  await upsertRows(client, 'delivery_notes', effectiveDataset.deliveryNoteRows, 'id');
  await upsertRows(client, 'delivery_note_items', effectiveDataset.deliveryNoteItemRows, 'id');
  await upsertRows(client, 'receivables', effectiveDataset.receivableRows, 'id');
  await upsertRows(client, 'payables', effectiveDataset.payableRows, 'id');
  const normalizedDebtPaymentRows = (effectiveDataset.debtPaymentRows || []).map((row) => {
    const normalized = { ...row };

    if (!normalized.receivable_id && !normalized.payable_id) {
      if (normalized.record_type === 'receivable') {
        normalized.receivable_id = normalized.record_id;
      } else if (normalized.record_type === 'payable') {
        normalized.payable_id = normalized.record_id;
      }
    }

    if (normalized.receivable_id) {
      normalized.payable_id = null;
    }
    if (normalized.payable_id) {
      normalized.receivable_id = null;
    }

    return normalized;
  });
  await upsertRows(client, 'debt_payments', normalizedDebtPaymentRows, 'id');
  await upsertRows(client, 'product_stock_history', effectiveDataset.productStockHistoryRows, 'id');
  await upsertRows(client, 'stock_alerts', effectiveDataset.stockAlertRows, 'id');
  await upsertRows(client, 'notification_preferences', [effectiveDataset.notificationPreferencesRow], 'id');
  await upsertRows(client, 'notifications', effectiveDataset.notificationRows, 'id');
  await upsertRows(client, 'webhook_endpoints', effectiveDataset.webhookRows, 'id');
  await upsertRows(client, 'webhook_deliveries', effectiveDataset.webhookDeliveryRows, 'id');
  await upsertRows(client, 'bank_connections', effectiveDataset.bankConnectionRows, 'id');
  await upsertRows(client, 'bank_sync_history', effectiveDataset.bankSyncHistoryRows, 'id');
  await upsertRows(client, 'bank_transactions', effectiveDataset.bankTransactionRows, 'id');
  await upsertRows(client, 'peppol_transmission_log', effectiveDataset.peppolLogRows, 'id');
  await upsertRows(client, 'billing_info', [effectiveDataset.billingInfoRow], 'id');
  await upsertRows(client, 'invoice_settings', [effectiveDataset.invoiceSettingsRow], 'id');
  await upsertRows(client, 'expenses', effectiveDataset.expenseRows, 'id');
  if (!options.preserveCompanies) {
    const accountingEntriesToUpsert = await filterExistingAccountingEntries(
      client,
      effectiveDataset.userId,
      effectiveDataset.accountingEntries
    );
    await upsertRows(client, 'accounting_entries', accountingEntriesToUpsert, 'id');
  }
  await upsertRows(client, 'financial_scenarios', scenarioSeed.scenarioRows, 'id');
  await upsertRows(client, 'scenario_assumptions', scenarioSeed.scenarioAssumptionRows, 'id');
  await upsertRows(client, 'scenario_results', scenarioSeed.scenarioResultRows, 'scenario_id,calculation_date');
  await ensureCompanyThresholdRows(client, effectiveDataset, 7);

  const preferencePayload = {
    user_id: effectiveDataset.userId,
    active_company_id: effectiveDataset.userCompanyPreferenceRow.active_company_id,
    updated_at: new Date().toISOString(),
  };
  const { data: updatedPreferences, error: preferenceUpdateError } = await client
    .from('user_company_preferences')
    .update(preferencePayload)
    .eq('user_id', effectiveDataset.userId)
    .select('user_id');
  if (preferenceUpdateError) {
    throw new Error(`Failed to enforce user_company_preferences: ${preferenceUpdateError.message}`);
  }
  if (!updatedPreferences || updatedPreferences.length === 0) {
    const { error: preferenceInsertError } = await client
      .from('user_company_preferences')
      .insert(preferencePayload);
    if (preferenceInsertError) {
      throw new Error(`Failed to insert user_company_preferences: ${preferenceInsertError.message}`);
    }
  }

  return {
    ...authSummary,
    clients: effectiveDataset.clientRows.length,
    invoices: effectiveDataset.invoiceRows.length,
    payments: effectiveDataset.paymentRows.length,
    expenses: effectiveDataset.expenseRows.length,
    accounts: effectiveDataset.chartRows.length,
    entries: effectiveDataset.accountingEntries.length,
    products: effectiveDataset.productRows.length,
    services: effectiveDataset.serviceRows.length,
    suppliers: effectiveDataset.supplierRows.length,
    quotes: effectiveDataset.quoteRows.length,
    recurringInvoices: effectiveDataset.recurringInvoiceRows.length,
    projects: effectiveDataset.projectRows.length,
    scenarios: scenarioSeed.scenarioRows.length,
    companies: (effectiveDataset.companyRows || [effectiveDataset.companyRow]).length,
    fixedAssets: (effectiveDataset.fixedAssetRows || []).length,
    analyticalAxes: (effectiveDataset.analyticalAxisRows || []).length,
    sharedSnapshots: (effectiveDataset.dashboardSnapshotRows || []).length,
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
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});

