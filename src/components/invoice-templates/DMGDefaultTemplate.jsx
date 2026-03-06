import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { formatCurrency } from '@/utils/calculations';

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const buildCompanyLines = (company) => {
  if (!company) return [];
  const lines = [];
  if (company.address) lines.push(company.address);
  const cityLine = [company.postal_code, company.city, company.country].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (company.tax_id) lines.push(company.tax_id);
  if (company.phone) lines.push(`Tel: ${company.phone}`);
  if (company.email) lines.push(company.email);
  if (company.website) lines.push(company.website);
  return lines;
};

const buildClientLines = (client) => {
  if (!client) return [];
  const lines = [];
  const companyName = client.companyName || client.company_name;
  if (companyName) lines.push(companyName);
  if (client.address) lines.push(client.address);
  const cityLine = [client.postal_code, client.city, client.country].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (client.phone) lines.push(`Tel: ${client.phone}`);
  if (client.email) lines.push(client.email);
  return lines;
};

const normalizeItems = (items = []) => {
  return items.map((item) => {
    const quantity = toNumber(item.quantity ?? item.qty ?? 1);
    const unitPrice = toNumber(item.unit_price ?? item.unitPrice ?? item.rate);
    const providedLineTotal = item.total ?? item.line_total ?? item.amount;
    const lineTotal = providedLineTotal !== undefined && providedLineTotal !== null && providedLineTotal !== ''
      ? toNumber(providedLineTotal)
      : quantity * unitPrice;

    return {
      ...item,
      quantity,
      unitPrice,
      lineTotal,
    };
  });
};

const DMGDefaultTemplate = ({ invoice, client, items, company, settings }) => {
  const { t } = useTranslation();
  const currency = client?.preferredCurrency || client?.preferred_currency || 'EUR';
  const issueDate = invoice?.date || invoice?.issueDate;
  const invoiceNumber = invoice?.invoice_number || invoice?.invoiceNumber || '-';

  const normalizedItems = normalizeItems(items || []);
  const computedSubtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const invoiceSubtotal = toNumber(invoice?.total_ht ?? invoice?.subtotal);
  const subtotal = invoiceSubtotal > 0 ? invoiceSubtotal : computedSubtotal;

  const taxRate = toNumber(invoice?.tax_rate ?? invoice?.taxRate);
  const invoiceTotal = toNumber(invoice?.total_ttc ?? invoice?.total);
  const taxAmountFromInvoice = toNumber(invoice?.tax_amount);
  const taxAmount = taxAmountFromInvoice > 0
    ? taxAmountFromInvoice
    : (invoiceTotal > 0 ? Math.max(0, invoiceTotal - subtotal) : subtotal * (taxRate / 100));
  const total = invoiceTotal > 0 ? invoiceTotal : subtotal + taxAmount;

  const companyName = company?.company_name || t('app.name');
  const companyLines = buildCompanyLines(company);
  const clientLines = buildClientLines(client);

  const noteText = invoice?.notes || 'Tous nos produits et services sont garantis 12 mois, à compter de la date de réception du paiement de la facture.';
  const showBankDetails = Boolean(settings?.show_bank_details) && Boolean(company?.iban || company?.bank_name || company?.swift);

  return (
    <div
      className="bg-[#f4f6f8] text-[#1f2937] p-6 md:p-8"
      style={{ fontFamily: settings?.font_family || 'Inter' }}
    >
      <div className="space-y-4">
        <section className="bg-white rounded-md border-2 border-[#21d4c8] px-5 py-4">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="w-20 h-20 rounded-md bg-[#e9f2ff] border border-[#d2e6ff] flex items-center justify-center overflow-hidden">
              {settings?.show_logo && company?.logo_url ? (
                <img src={company.logo_url} alt="Logo" className="w-full h-full object-contain" loading="lazy" />
              ) : (
                <span className="font-black text-xl tracking-wide text-[#0f274f]">
                  {(companyName || 'CP').slice(0, 3).toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-right text-sm leading-5 w-full sm:w-auto">
              <p className="font-extrabold uppercase text-[#0f172a]">{companyName}</p>
              {companyLines.map((line, index) => (
                <p key={`company-line-${index}`}>{line}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-md border-2 border-[#21d4c8] px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h2 className="text-4xl font-black text-[#0b1324] leading-none mb-4">FACTURE</h2>
              <p className="text-sm mb-1">
                <span className="font-semibold">N° :</span> {invoiceNumber}
              </p>
              <p className="text-sm">
                <span className="font-semibold">{t('invoices.issueDate', 'Date')} :</span>{' '}
                {issueDate ? format(new Date(issueDate), 'dd/MM/yyyy') : '-'}
              </p>
            </div>
            <div className="text-sm leading-5">
              <p className="font-bold uppercase text-[#0f172a] mb-2">Facturé à</p>
              {clientLines.length > 0 ? (
                clientLines.map((line, index) => (
                  <p key={`client-line-${index}`}>{line}</p>
                ))
              ) : (
                <p>{t('invoices.clientInfo', 'Client')}</p>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-md border border-[#d9e1ea] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#2f4b88] text-white">
                <th className="text-left px-4 py-2 font-semibold">Description</th>
                <th className="text-right px-4 py-2 font-semibold">Taux</th>
                <th className="text-right px-4 py-2 font-semibold">Montant</th>
              </tr>
            </thead>
            <tbody>
              {normalizedItems.length === 0 ? (
                <tr className="border-t border-[#d9e1ea]">
                  <td className="px-4 py-3 text-[#6b7280]" colSpan={3}>
                    {t('invoices.noItems', 'Aucune ligne')}
                  </td>
                </tr>
              ) : (
                normalizedItems.map((item, index) => (
                  <tr
                    key={index}
                    className={`${index % 2 === 0 ? 'bg-[#f8fafc]' : 'bg-white'} border-t border-[#e5e7eb]`}
                  >
                    <td className="px-4 py-2 align-top">
                      <p>{item.description || '-'}</p>
                    </td>
                    <td className="px-4 py-2 text-right align-top whitespace-nowrap">
                      {formatCurrency(item.unitPrice, currency)}
                    </td>
                    <td className="px-4 py-2 text-right align-top whitespace-nowrap font-semibold">
                      {formatCurrency(item.lineTotal, currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="flex justify-end">
          <div className="w-full sm:w-[360px] rounded-md overflow-hidden border border-[#00132b]">
            <div className="bg-[#00132b] text-[#e5ecf5]">
              <div className="px-4 py-3 border-b border-[#0e2b4d] flex justify-between items-center">
                <span className="font-semibold">Sous-total</span>
                <span className="font-semibold">{formatCurrency(subtotal, currency)} HT</span>
              </div>
              <div className="px-4 py-3 border-b border-[#0e2b4d] flex justify-between items-center">
                <span className="font-semibold">TVA {taxRate > 0 ? `${taxRate}%` : ''}</span>
                <span className="font-semibold">{formatCurrency(taxAmount, currency)}</span>
              </div>
              <div className="px-4 py-4 flex justify-between items-center text-white">
                <span className="text-lg font-black">TOTAL TTC</span>
                <span className="text-2xl font-black">{formatCurrency(total, currency)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-md border-2 border-[#21d4c8] px-5 py-4">
          <p className="font-bold mb-2">Veuillez noter :</p>
          <p className="text-sm text-[#374151] leading-6">{noteText}</p>

          {showBankDetails && (
            <div className="mt-4 text-sm leading-6">
              <p className="font-bold">Informations Bancaires</p>
              {company?.bank_name && (
                <p>
                  <span className="font-semibold">Bénéficiaire :</span> {company.bank_name}
                </p>
              )}
              {company?.iban && (
                <p>
                  <span className="font-semibold">IBAN :</span> {company.iban}
                </p>
              )}
              <p>
                <span className="font-semibold">Communication :</span> {invoiceNumber}
              </p>
              {company?.swift && (
                <p>
                  <span className="font-semibold">BIC/SWIFT :</span> {company.swift}
                </p>
              )}
            </div>
          )}

          <div className="mt-5 text-[11px] text-[#6b7280] text-center">
            {companyName}
            {company?.tax_id ? ` - TVA ${company.tax_id}` : ''}
            {company?.registration_number ? ` - ${company.registration_number}` : ''}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DMGDefaultTemplate;
