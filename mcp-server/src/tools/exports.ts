import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { escapeXml, formatDateFacturX, formatAmount } from '../utils/sanitize.js';

export function registerExportTools(server: McpServer) {

  server.tool(
    'export_fec',
    'Generate FEC (Fichier des Ecritures Comptables) for French tax compliance',
    {
      start_date: z.string().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().describe('End date (YYYY-MM-DD)')
    },
    async ({ start_date, end_date }) => {
      const { data: entries, error } = await supabase
        .from('accounting_entries')
        .select('*')
        .eq('user_id', getUserId())
        .gte('transaction_date', start_date)
        .lte('transaction_date', end_date)
        .order('transaction_date', { ascending: true });

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      if (!entries?.length) return { content: [{ type: 'text' as const, text: 'No entries found for the given period.' }] };

      // FEC header
      const header = 'JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise';

      const rows = entries.map((e, i) => {
        const date = (e.transaction_date || '').replace(/-/g, '');
        return [
          e.journal_code || 'VE',
          e.journal_name || 'Ventes',
          String(i + 1),
          date,
          e.account_code || '',
          e.account_name || '',
          '', // CompAuxNum
          '', // CompAuxLib
          e.reference || '',
          date,
          e.description || '',
          formatAmount(e.debit),
          formatAmount(e.credit),
          '', // EcritureLet
          '', // DateLet
          date,
          '', // Montantdevise
          ''  // Idevise
        ].join('|');
      });

      const fecContent = '\uFEFF' + [header, ...rows].join('\n');

      return {
        content: [{ type: 'text' as const, text: `FEC generated: ${entries.length} entries, period ${start_date} to ${end_date}.\n\n${fecContent}` }]
      };
    }
  );

  server.tool(
    'export_saft',
    'Generate SAF-T XML (Standard Audit File for Tax)',
    {
      start_date: z.string().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().describe('End date (YYYY-MM-DD)')
    },
    async ({ start_date, end_date }) => {
      const [companyRes, accountsRes, entriesRes, clientsRes] = await Promise.all([
        supabase.from('companies').select('*').eq('user_id', getUserId()).single(),
        supabase.from('accounting_chart_of_accounts').select('*').eq('user_id', getUserId()),
        supabase.from('accounting_entries').select('*').eq('user_id', getUserId())
          .gte('transaction_date', start_date).lte('transaction_date', end_date)
          .order('transaction_date', { ascending: true }),
        supabase.from('clients').select('*').eq('user_id', getUserId())
      ]);

      const company = companyRes.data || { company_name: 'Unknown', tax_id: '' };
      const accounts = accountsRes.data ?? [];
      const entries = entriesRes.data ?? [];
      const clients = clientsRes.data ?? [];

      const now = new Date().toISOString();
      const accountsXml = accounts.map(a =>
        `    <Account><AccountID>${escapeXml(a.account_code)}</AccountID><AccountDescription>${escapeXml(a.account_name)}</AccountDescription></Account>`
      ).join('\n');

      const customersXml = clients.map(c =>
        `    <Customer><CustomerID>${escapeXml(c.id)}</CustomerID><Name>${escapeXml(c.company_name)}</Name></Customer>`
      ).join('\n');

      const entriesXml = entries.map(e =>
        `    <Transaction><TransactionDate>${e.transaction_date}</TransactionDate><Description>${escapeXml(e.description)}</Description><DebitAmount>${formatAmount(e.debit)}</DebitAmount><CreditAmount>${formatAmount(e.credit)}</CreditAmount><AccountID>${escapeXml(e.account_code)}</AccountID></Transaction>`
      ).join('\n');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:2.00">
  <Header>
    <AuditFileVersion>2.00</AuditFileVersion>
    <CompanyID>${escapeXml(company.tax_id || '')}</CompanyID>
    <CompanyName>${escapeXml(company.company_name)}</CompanyName>
    <DateCreated>${now.split('T')[0]}</DateCreated>
    <StartDate>${start_date}</StartDate>
    <EndDate>${end_date}</EndDate>
    <CurrencyCode>EUR</CurrencyCode>
  </Header>
  <MasterFiles>
    <GeneralLedgerAccounts>
${accountsXml}
    </GeneralLedgerAccounts>
    <Customers>
${customersXml}
    </Customers>
  </MasterFiles>
  <GeneralLedgerEntries>
${entriesXml}
  </GeneralLedgerEntries>
</AuditFile>`;

      return {
        content: [{ type: 'text' as const, text: `SAF-T generated: ${entries.length} entries, ${accounts.length} accounts.\n\n${xml}` }]
      };
    }
  );

  server.tool(
    'export_facturx',
    'Generate Factur-X (CII) XML for an invoice',
    {
      invoice_id: z.string().describe('Invoice UUID'),
      profile: z.string().optional().describe('Factur-X profile: MINIMUM, BASIC, EN16931 (default BASIC)')
    },
    async ({ invoice_id, profile }) => {
      const profileId = profile ?? 'BASIC';
      const profiles: Record<string, string> = {
        MINIMUM: 'urn:factur-x.eu:1p0:minimum',
        BASIC: 'urn:factur-x.eu:1p0:basic',
        EN16931: 'urn:cen.eu:en16931:2017'
      };

      const [invoiceRes, companyRes] = await Promise.all([
        supabase.from('invoices').select('*, client:clients(*)').eq('id', invoice_id).eq('user_id', getUserId()).single(),
        supabase.from('companies').select('*').eq('user_id', getUserId()).single()
      ]);

      if (invoiceRes.error) return { content: [{ type: 'text' as const, text: `Error: ${invoiceRes.error.message}` }] };

      const inv = invoiceRes.data;
      const seller = companyRes.data || {};
      const buyer = inv.client || {};

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${profiles[profileId] || profiles.BASIC}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(inv.invoice_number)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatDateFacturX(inv.date)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(seller.company_name || '')}</ram:Name>
        ${seller.tax_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(seller.tax_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(buyer.company_name || '')}</ram:Name>
        ${buyer.vat_number ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(buyer.vat_number)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${formatDateFacturX(inv.date)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      ${seller.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${escapeXml(seller.iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>` : ''}
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${formatAmount((parseFloat(inv.total_ttc || '0') - parseFloat(inv.total_ht || '0')))}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${formatAmount(inv.total_ht)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${inv.tax_rate || 20}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${formatDateFacturX(inv.due_date)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${formatAmount(inv.total_ht)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${formatAmount(inv.total_ht)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${formatAmount((parseFloat(inv.total_ttc || '0') - parseFloat(inv.total_ht || '0')))}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${formatAmount(inv.total_ttc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${formatAmount(inv.total_ttc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

      return {
        content: [{ type: 'text' as const, text: `Factur-X XML (${profileId}) for invoice ${inv.invoice_number}.\n\n${xml}` }]
      };
    }
  );

  server.tool(
    'backup_all_data',
    'Export all user data as JSON backup',
    {},
    async () => {
      const tables = ['clients', 'invoices', 'invoice_items', 'payments', 'expenses', 'suppliers',
        'accounting_chart_of_accounts', 'accounting_entries', 'accounting_mappings',
        'accounting_tax_rates', 'projects', 'timesheets', 'quotes', 'credit_notes',
        'recurring_invoices', 'receivables', 'payables'];

      const backup: Record<string, unknown[]> = {};

      for (const table of tables) {
        const { data } = await supabase.from(table).select('*').eq('user_id', getUserId());
        backup[table] = data ?? [];
      }

      const stats = Object.entries(backup).map(([t, d]) => `${t}: ${d.length} rows`).join('\n');

      return {
        content: [{ type: 'text' as const, text: `Backup complete.\n${stats}\n\n${JSON.stringify(backup, null, 2)}` }]
      };
    }
  );
}
