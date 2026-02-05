/**
 * SAF-T (Standard Audit File for Tax) Export Service
 * Generates XML files conforming to OECD SAF-T schema
 *
 * SAF-T is an international standard for electronic exchange of accounting data
 * from organizations to tax authorities or external auditors.
 */

// ========== UTILITY FUNCTIONS ==========

/**
 * Escape special XML characters to prevent malformed XML
 * @param {string} str - String to escape
 * @returns {string} - Escaped string safe for XML
 */
const escapeXml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Format date to ISO 8601 format (YYYY-MM-DD)
 * @param {Date|string} date - Date to format
 * @returns {string} - ISO formatted date string
 */
const formatDateISO = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

/**
 * Format datetime to ISO 8601 format (YYYY-MM-DDTHH:mm:ss)
 * @param {Date|string} date - Date to format
 * @returns {string} - ISO formatted datetime string
 */
const formatDateTimeISO = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().replace(/\.\d{3}Z$/, '');
};

/**
 * Format amount to 2 decimal places
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted amount string
 */
const formatAmount = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
  return Number(amount).toFixed(2);
};

/**
 * Generate unique ID for SAF-T elements
 * @returns {string} - Unique identifier
 */
const generateSAFTId = () => {
  return `SAFT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ========== XML GENERATION FUNCTIONS ==========

/**
 * Generate the Header section of the SAF-T file
 * Contains company information, fiscal period, and file metadata
 *
 * @param {Object} companyInfo - Company information
 * @param {Object} period - Fiscal period (startDate, endDate)
 * @returns {string} - XML Header section
 */
const generateHeader = (companyInfo = {}, period = {}) => {
  const now = new Date();
  const auditFileId = generateSAFTId();

  return `
    <Header>
      <AuditFileVersion>2.0</AuditFileVersion>
      <AuditFileCountry>${escapeXml(companyInfo.country || 'FR')}</AuditFileCountry>
      <AuditFileDateCreated>${formatDateISO(now)}</AuditFileDateCreated>
      <SoftwareCompanyName>CashPilot</SoftwareCompanyName>
      <SoftwareID>CASHPILOT-ACCOUNTING</SoftwareID>
      <SoftwareVersion>1.0.0</SoftwareVersion>
      <Company>
        <RegistrationNumber>${escapeXml(companyInfo.registrationNumber || companyInfo.siret || '')}</RegistrationNumber>
        <Name>${escapeXml(companyInfo.name || companyInfo.companyName || 'Unknown Company')}</Name>
        <Address>
          <StreetName>${escapeXml(companyInfo.streetName || companyInfo.address || '')}</StreetName>
          <City>${escapeXml(companyInfo.city || '')}</City>
          <PostalCode>${escapeXml(companyInfo.postalCode || companyInfo.zipCode || '')}</PostalCode>
          <Country>${escapeXml(companyInfo.country || 'FR')}</Country>
        </Address>
        ${companyInfo.vatNumber ? `<TaxRegistration>
          <TaxRegistrationNumber>${escapeXml(companyInfo.vatNumber)}</TaxRegistrationNumber>
          <TaxType>TVA</TaxType>
        </TaxRegistration>` : ''}
        ${companyInfo.email ? `<Contact>
          <ContactPerson>
            <FirstName>${escapeXml(companyInfo.contactFirstName || '')}</FirstName>
            <LastName>${escapeXml(companyInfo.contactLastName || companyInfo.name || '')}</LastName>
          </ContactPerson>
          <Email>${escapeXml(companyInfo.email)}</Email>
          ${companyInfo.phone ? `<Telephone>${escapeXml(companyInfo.phone)}</Telephone>` : ''}
        </Contact>` : ''}
      </Company>
      <DefaultCurrencyCode>${escapeXml(companyInfo.currency || 'EUR')}</DefaultCurrencyCode>
      <SelectionCriteria>
        <SelectionStartDate>${formatDateISO(period.startDate || new Date(now.getFullYear(), 0, 1))}</SelectionStartDate>
        <SelectionEndDate>${formatDateISO(period.endDate || now)}</SelectionEndDate>
      </SelectionCriteria>
      <TaxAccountingBasis>Invoice</TaxAccountingBasis>
      <AuditFileID>${escapeXml(auditFileId)}</AuditFileID>
    </Header>`;
};

/**
 * Generate the GeneralLedgerAccounts section (Chart of Accounts)
 * Contains all accounting accounts used in the system
 *
 * @param {Array} accounts - Array of account objects
 * @returns {string} - XML GeneralLedgerAccounts section
 */
const generateAccounts = (accounts = []) => {
  if (!accounts || accounts.length === 0) {
    return '';
  }

  const accountsXml = accounts.map(account => {
    const accountType = determineAccountType(account.code || account.accountCode || '');
    const openingBalance = formatAmount(account.openingBalance || account.opening_balance || 0);
    const closingBalance = formatAmount(account.closingBalance || account.closing_balance || account.balance || 0);

    return `
      <Account>
        <AccountID>${escapeXml(account.id || account.accountId || '')}</AccountID>
        <AccountDescription>${escapeXml(account.name || account.description || account.accountName || '')}</AccountDescription>
        <StandardAccountID>${escapeXml(account.code || account.accountCode || '')}</StandardAccountID>
        <AccountType>${escapeXml(accountType)}</AccountType>
        <OpeningDebitBalance>${account.debitBalance ? openingBalance : '0.00'}</OpeningDebitBalance>
        <OpeningCreditBalance>${account.creditBalance ? openingBalance : '0.00'}</OpeningCreditBalance>
        <ClosingDebitBalance>${parseFloat(closingBalance) >= 0 ? closingBalance : '0.00'}</ClosingDebitBalance>
        <ClosingCreditBalance>${parseFloat(closingBalance) < 0 ? formatAmount(Math.abs(closingBalance)) : '0.00'}</ClosingCreditBalance>
      </Account>`;
  }).join('');

  return `
    <GeneralLedgerAccounts>
      ${accountsXml}
    </GeneralLedgerAccounts>`;
};

/**
 * Determine the account type based on the account code
 * Following French PCG (Plan Comptable General) structure
 *
 * @param {string} code - Account code
 * @returns {string} - Account type (Assets, Liabilities, Equity, Income, Expense)
 */
const determineAccountType = (code) => {
  if (!code) return 'GL';
  const firstChar = String(code).charAt(0);

  switch (firstChar) {
    case '1': return 'Equity'; // Capitaux
    case '2': return 'Assets'; // Immobilisations
    case '3': return 'Assets'; // Stocks
    case '4': return 'Liabilities'; // Tiers (clients/fournisseurs)
    case '5': return 'Assets'; // Financier
    case '6': return 'Expense'; // Charges
    case '7': return 'Income'; // Produits
    default: return 'GL';
  }
};

/**
 * Generate the Customers section
 * Contains all customer/client master data
 *
 * @param {Array} customers - Array of customer objects
 * @returns {string} - XML Customers section
 */
const generateCustomers = (customers = []) => {
  if (!customers || customers.length === 0) {
    return '';
  }

  const customersXml = customers.map(customer => {
    return `
      <Customer>
        <CustomerID>${escapeXml(customer.id || customer.customerId || '')}</CustomerID>
        <AccountID>${escapeXml(customer.accountId || customer.account_id || '411000')}</AccountID>
        <CustomerTaxID>${escapeXml(customer.vatNumber || customer.vat_number || customer.taxId || '')}</CustomerTaxID>
        <CompanyName>${escapeXml(customer.companyName || customer.company_name || customer.name || '')}</CompanyName>
        ${customer.contactName || customer.contact_name ? `<Contact>${escapeXml(customer.contactName || customer.contact_name)}</Contact>` : ''}
        <BillingAddress>
          <StreetName>${escapeXml(customer.address || customer.streetName || customer.street || '')}</StreetName>
          <City>${escapeXml(customer.city || '')}</City>
          <PostalCode>${escapeXml(customer.postalCode || customer.postal_code || customer.zipCode || '')}</PostalCode>
          <Country>${escapeXml(customer.country || 'FR')}</Country>
        </BillingAddress>
        ${customer.email ? `<Email>${escapeXml(customer.email)}</Email>` : ''}
        ${customer.phone ? `<Telephone>${escapeXml(customer.phone)}</Telephone>` : ''}
        <OpenItemsDebit>${formatAmount(customer.debitBalance || customer.debit_balance || 0)}</OpenItemsDebit>
        <OpenItemsCredit>${formatAmount(customer.creditBalance || customer.credit_balance || 0)}</OpenItemsCredit>
      </Customer>`;
  }).join('');

  return `
    <Customers>
      ${customersXml}
    </Customers>`;
};

/**
 * Generate the Suppliers section
 * Contains all supplier/vendor master data
 *
 * @param {Array} suppliers - Array of supplier objects
 * @returns {string} - XML Suppliers section
 */
const generateSuppliers = (suppliers = []) => {
  if (!suppliers || suppliers.length === 0) {
    return '';
  }

  const suppliersXml = suppliers.map(supplier => {
    return `
      <Supplier>
        <SupplierID>${escapeXml(supplier.id || supplier.supplierId || '')}</SupplierID>
        <AccountID>${escapeXml(supplier.accountId || supplier.account_id || '401000')}</AccountID>
        <SupplierTaxID>${escapeXml(supplier.vatNumber || supplier.vat_number || supplier.taxId || '')}</SupplierTaxID>
        <CompanyName>${escapeXml(supplier.companyName || supplier.company_name || supplier.name || '')}</CompanyName>
        ${supplier.contactName || supplier.contact_name ? `<Contact>${escapeXml(supplier.contactName || supplier.contact_name)}</Contact>` : ''}
        <BillingAddress>
          <StreetName>${escapeXml(supplier.address || supplier.streetName || supplier.street || '')}</StreetName>
          <City>${escapeXml(supplier.city || '')}</City>
          <PostalCode>${escapeXml(supplier.postalCode || supplier.postal_code || supplier.zipCode || '')}</PostalCode>
          <Country>${escapeXml(supplier.country || 'FR')}</Country>
        </BillingAddress>
        ${supplier.email ? `<Email>${escapeXml(supplier.email)}</Email>` : ''}
        ${supplier.phone ? `<Telephone>${escapeXml(supplier.phone)}</Telephone>` : ''}
        <OpenItemsDebit>${formatAmount(supplier.debitBalance || supplier.debit_balance || 0)}</OpenItemsDebit>
        <OpenItemsCredit>${formatAmount(supplier.creditBalance || supplier.credit_balance || 0)}</OpenItemsCredit>
      </Supplier>`;
  }).join('');

  return `
    <Suppliers>
      ${suppliersXml}
    </Suppliers>`;
};

/**
 * Generate a single transaction (journal entry line)
 *
 * @param {Object} line - Transaction line object
 * @param {number} lineNumber - Line number within the transaction
 * @returns {string} - XML TransactionLine element
 */
const generateTransactionLine = (line, lineNumber) => {
  const debit = formatAmount(line.debit || line.debitAmount || 0);
  const credit = formatAmount(line.credit || line.creditAmount || 0);

  return `
        <TransactionLine>
          <RecordID>${escapeXml(line.id || line.lineId || `LINE-${lineNumber}`)}</RecordID>
          <AccountID>${escapeXml(line.accountId || line.account_id || '')}</AccountID>
          <SourceDocumentID>${escapeXml(line.documentId || line.document_id || line.reference || '')}</SourceDocumentID>
          <SystemEntryDate>${formatDateISO(line.systemDate || line.created_at || new Date())}</SystemEntryDate>
          <Description>${escapeXml(line.description || line.label || '')}</Description>
          ${parseFloat(debit) > 0 ? `<DebitAmount>
            <Amount>${debit}</Amount>
          </DebitAmount>` : ''}
          ${parseFloat(credit) > 0 ? `<CreditAmount>
            <Amount>${credit}</Amount>
          </CreditAmount>` : ''}
          ${line.customerId || line.customer_id ? `<CustomerID>${escapeXml(line.customerId || line.customer_id)}</CustomerID>` : ''}
          ${line.supplierId || line.supplier_id ? `<SupplierID>${escapeXml(line.supplierId || line.supplier_id)}</SupplierID>` : ''}
        </TransactionLine>`;
};

/**
 * Generate a single transaction (journal entry)
 *
 * @param {Object} entry - Journal entry object
 * @returns {string} - XML Transaction element
 */
const generateTransaction = (entry) => {
  const lines = entry.lines || entry.items || entry.transactions || [];
  const linesXml = lines.map((line, index) => generateTransactionLine(line, index + 1)).join('');

  return `
      <Transaction>
        <TransactionID>${escapeXml(entry.id || entry.entryId || entry.transactionId || '')}</TransactionID>
        <Period>${entry.period || new Date(entry.date || entry.entryDate).getMonth() + 1}</Period>
        <PeriodYear>${entry.periodYear || new Date(entry.date || entry.entryDate).getFullYear()}</PeriodYear>
        <TransactionDate>${formatDateISO(entry.date || entry.entryDate || entry.transactionDate)}</TransactionDate>
        <SourceID>${escapeXml(entry.sourceId || entry.source_id || entry.userId || 'SYSTEM')}</SourceID>
        <Description>${escapeXml(entry.description || entry.label || entry.reference || '')}</Description>
        <SystemEntryDate>${formatDateTimeISO(entry.systemDate || entry.created_at || new Date())}</SystemEntryDate>
        <GLPostingDate>${formatDateISO(entry.postingDate || entry.posting_date || entry.date)}</GLPostingDate>
        ${linesXml}
      </Transaction>`;
};

/**
 * Generate a single journal section
 *
 * @param {Object} journal - Journal object containing entries
 * @param {Array} entries - Journal entries for this journal
 * @returns {string} - XML Journal element
 */
const generateJournal = (journal, entries = []) => {
  const journalEntries = entries.filter(e =>
    (e.journalId || e.journal_id || e.journal) === (journal.id || journal.journalId || journal.code)
  );

  if (journalEntries.length === 0 && entries.length > 0 && !journal.id) {
    // If no specific journal matching, use all entries for default journal
    journalEntries.push(...entries);
  }

  const totalDebit = journalEntries.reduce((sum, entry) => {
    const lines = entry.lines || entry.items || entry.transactions || [];
    return sum + lines.reduce((lineSum, line) =>
      lineSum + parseFloat(line.debit || line.debitAmount || 0), 0);
  }, 0);

  const totalCredit = journalEntries.reduce((sum, entry) => {
    const lines = entry.lines || entry.items || entry.transactions || [];
    return sum + lines.reduce((lineSum, line) =>
      lineSum + parseFloat(line.credit || line.creditAmount || 0), 0);
  }, 0);

  const transactionsXml = journalEntries.map(entry => generateTransaction(entry)).join('');

  return `
    <Journal>
      <JournalID>${escapeXml(journal.id || journal.journalId || journal.code || 'GEN')}</JournalID>
      <Description>${escapeXml(journal.name || journal.description || journal.label || 'General Journal')}</Description>
      <Type>${escapeXml(journal.type || determineJournalType(journal.code || journal.id || ''))}</Type>
      ${transactionsXml}
    </Journal>`;
};

/**
 * Determine the journal type based on the journal code
 *
 * @param {string} code - Journal code
 * @returns {string} - Journal type
 */
const determineJournalType = (code) => {
  const codeUpper = String(code).toUpperCase();

  if (codeUpper.includes('VENTE') || codeUpper.includes('VT') || codeUpper.includes('SALE')) {
    return 'Sales';
  }
  if (codeUpper.includes('ACHAT') || codeUpper.includes('AC') || codeUpper.includes('PURCHASE')) {
    return 'Purchase';
  }
  if (codeUpper.includes('BANQUE') || codeUpper.includes('BQ') || codeUpper.includes('BANK')) {
    return 'Bank';
  }
  if (codeUpper.includes('CAISSE') || codeUpper.includes('CA') || codeUpper.includes('CASH')) {
    return 'Cash';
  }
  if (codeUpper.includes('OD') || codeUpper.includes('DIVERS')) {
    return 'Other';
  }

  return 'General';
};

/**
 * Generate the GeneralLedgerEntries section
 * Contains all accounting entries/transactions organized by journal
 *
 * @param {Array} entries - Array of journal entry objects
 * @param {Array} journals - Array of journal objects (optional)
 * @returns {string} - XML GeneralLedgerEntries section
 */
const generateEntries = (entries = [], journals = []) => {
  if (!entries || entries.length === 0) {
    return `
    <GeneralLedgerEntries>
      <NumberOfEntries>0</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>0.00</TotalCredit>
    </GeneralLedgerEntries>`;
  }

  // Calculate totals
  let totalDebit = 0;
  let totalCredit = 0;

  entries.forEach(entry => {
    const lines = entry.lines || entry.items || entry.transactions || [];
    lines.forEach(line => {
      totalDebit += parseFloat(line.debit || line.debitAmount || 0);
      totalCredit += parseFloat(line.credit || line.creditAmount || 0);
    });
  });

  // Group entries by journal
  const journalGroups = new Map();

  entries.forEach(entry => {
    const journalKey = entry.journalId || entry.journal_id || entry.journal || 'GEN';
    if (!journalGroups.has(journalKey)) {
      journalGroups.set(journalKey, []);
    }
    journalGroups.get(journalKey).push(entry);
  });

  // Use provided journals or create default ones based on entry data
  let journalsToUse = journals && journals.length > 0 ? journals : [];

  if (journalsToUse.length === 0) {
    // Create journals from grouped entries
    journalGroups.forEach((groupEntries, journalKey) => {
      journalsToUse.push({
        id: journalKey,
        code: journalKey,
        name: `Journal ${journalKey}`,
        type: determineJournalType(journalKey)
      });
    });
  }

  // If still no journals, create a default general journal
  if (journalsToUse.length === 0) {
    journalsToUse.push({
      id: 'GEN',
      code: 'GEN',
      name: 'General Journal',
      type: 'General'
    });
  }

  const journalsXml = journalsToUse.map(journal => {
    const journalKey = journal.id || journal.journalId || journal.code;
    const journalEntries = journalGroups.get(journalKey) || [];

    // If this is a default journal and there are ungrouped entries, include them
    if (journalEntries.length === 0 && journalsToUse.length === 1) {
      return generateJournal(journal, entries);
    }

    return generateJournal(journal, journalEntries);
  }).join('');

  return `
    <GeneralLedgerEntries>
      <NumberOfEntries>${entries.length}</NumberOfEntries>
      <TotalDebit>${formatAmount(totalDebit)}</TotalDebit>
      <TotalCredit>${formatAmount(totalCredit)}</TotalCredit>
      ${journalsXml}
    </GeneralLedgerEntries>`;
};

// ========== MAIN EXPORT FUNCTIONS ==========

/**
 * Generate the complete SAF-T XML file
 * Main export function that assembles all sections
 *
 * @param {Object} data - Complete accounting data
 * @param {Array} data.accounts - Chart of accounts
 * @param {Array} data.customers - Customer master data
 * @param {Array} data.suppliers - Supplier master data
 * @param {Array} data.entries - Journal entries
 * @param {Array} data.journals - Journals (optional)
 * @param {Object} companyInfo - Company information
 * @param {Object} period - Fiscal period (startDate, endDate)
 * @returns {string} - Complete SAF-T XML document
 */
export const exportSAFT = (data = {}, companyInfo = {}, period = {}) => {
  const {
    accounts = [],
    customers = [],
    suppliers = [],
    entries = [],
    journals = []
  } = data;

  const header = generateHeader(companyInfo, period);
  const accountsXml = generateAccounts(accounts);
  const customersXml = generateCustomers(customers);
  const suppliersXml = generateSuppliers(suppliers);
  const entriesXml = generateEntries(entries, journals);

  // Build MasterFiles section (only if there's content)
  const hasMasterFiles = accountsXml || customersXml || suppliersXml;
  const masterFilesXml = hasMasterFiles ? `
    <MasterFiles>
      ${accountsXml}
      ${customersXml}
      ${suppliersXml}
    </MasterFiles>` : '';

  // Assemble complete SAF-T document
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  ${header}
  ${masterFilesXml}
  ${entriesXml}
</AuditFile>`;

  return xmlContent;
};

/**
 * Generate a standardized filename for the SAF-T export
 *
 * @param {Object} companyInfo - Company information
 * @param {Object} period - Fiscal period
 * @returns {string} - Generated filename
 */
export const generateSAFTFilename = (companyInfo = {}, period = {}) => {
  const companyName = (companyInfo.name || companyInfo.companyName || 'Company')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 20);

  const siret = (companyInfo.siret || companyInfo.registrationNumber || '')
    .replace(/\s/g, '')
    .substring(0, 14);

  const startDate = period.startDate
    ? formatDateISO(period.startDate).replace(/-/g, '')
    : new Date().getFullYear() + '0101';

  const endDate = period.endDate
    ? formatDateISO(period.endDate).replace(/-/g, '')
    : formatDateISO(new Date()).replace(/-/g, '');

  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);

  return `SAFT_${companyName}${siret ? '_' + siret : ''}_${startDate}_${endDate}_${timestamp}.xml`;
};

/**
 * Download the SAF-T file in the browser
 *
 * @param {Object} data - Complete accounting data
 * @param {Object} companyInfo - Company information
 * @param {Object} period - Fiscal period
 */
export const downloadSAFT = (data = {}, companyInfo = {}, period = {}) => {
  const xmlContent = exportSAFT(data, companyInfo, period);
  const filename = generateSAFTFilename(companyInfo, period);

  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { filename, success: true };
};

/**
 * Validate SAF-T data before export
 * Returns validation errors if any
 *
 * @param {Object} data - Data to validate
 * @param {Object} companyInfo - Company information
 * @returns {Object} - Validation result { valid: boolean, errors: string[] }
 */
export const validateSAFTData = (data = {}, companyInfo = {}) => {
  const errors = [];

  // Company info validation
  if (!companyInfo.name && !companyInfo.companyName) {
    errors.push('Company name is required');
  }

  // Validate entries have balanced debits and credits
  const entries = data.entries || [];
  entries.forEach((entry, index) => {
    const lines = entry.lines || entry.items || entry.transactions || [];
    const totalDebit = lines.reduce((sum, l) => sum + parseFloat(l.debit || l.debitAmount || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + parseFloat(l.credit || l.creditAmount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      errors.push(`Entry ${index + 1} (${entry.id || entry.reference || 'unknown'}): Debits (${totalDebit.toFixed(2)}) do not equal credits (${totalCredit.toFixed(2)})`);
    }
  });

  // Validate accounts have codes
  const accounts = data.accounts || [];
  accounts.forEach((account, index) => {
    if (!account.code && !account.accountCode) {
      errors.push(`Account ${index + 1} (${account.name || 'unknown'}): Missing account code`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};

export default {
  exportSAFT,
  generateSAFTFilename,
  downloadSAFT,
  validateSAFTData
};
