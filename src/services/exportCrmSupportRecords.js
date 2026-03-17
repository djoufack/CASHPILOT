import { saveElementAsPdf } from '@/services/pdfExportRuntime';
import { formatDateInput } from '@/utils/dateFormatting';
import { buildStandaloneTemplateHtml, resolveInvoiceExportSettings } from '@/services/invoiceTemplateExport';
import { getTheme } from '@/config/invoiceThemes';
import { escapeHTML as escapeHtml, setSafeHtml } from '@/utils/sanitize';

const toLabel = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'in_progress') return 'En cours';
  if (normalized === 'waiting_customer') return 'Attente client';
  if (normalized === 'resolved') return 'Résolu';
  if (normalized === 'closed') return 'Clôturé';
  return 'Ouvert';
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('fr-FR');
};

const downloadHtmlFile = (html, filename) => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const exportTicketAsPdf = async ({ filename, content }) => {
  const tempDiv = document.createElement('div');
  setSafeHtml(tempDiv, content);
  document.body.appendChild(tempDiv);

  try {
    await saveElementAsPdf(tempDiv, {
      margin: 10,
      filename: `${filename}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    });
  } finally {
    document.body.removeChild(tempDiv);
  }
};

const ticketContent = (ticket, company, settings, theme) => {
  const companyName = escapeHtml(company?.company_name || company?.name || 'CashPilot');
  const fontFamily = escapeHtml(settings?.font_family || 'Inter');
  const title = escapeHtml(ticket?.title || 'Ticket support');
  const ticketNumber = escapeHtml(ticket?.ticket_number || '-');
  const clientName = escapeHtml(ticket?.client?.company_name || '-');
  const projectName = escapeHtml(ticket?.project?.name || '-');
  const priority = escapeHtml(String(ticket?.priority || 'medium'));
  const sla = escapeHtml(String(ticket?.sla_level || 'standard'));
  const status = escapeHtml(toLabel(ticket?.status));
  const dueAt = escapeHtml(formatDateTime(ticket?.due_at));
  const createdAt = escapeHtml(formatDateTime(ticket?.created_at));
  const updatedAt = escapeHtml(formatDateTime(ticket?.updated_at));
  const description = escapeHtml(ticket?.description || 'Aucune description');

  return `
    <div style="font-family:${fontFamily};max-width:860px;margin:0 auto;padding:20px;background:#f4f6f8;color:${theme.text};">
      <section style="background:#ffffff;border:2px solid ${theme.accent};border-radius:8px;padding:16px 18px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;">
          <div>
            <h1 style="margin:0 0 8px 0;font-size:40px;line-height:1;font-weight:900;color:${theme.primary};">TICKET SUPPORT</h1>
            <p style="margin:0;font-size:14px;color:${theme.textLight};">${companyName}</p>
          </div>
          <div style="text-align:right;font-size:12px;color:${theme.textLight};">
            <p style="margin:0 0 4px 0;"><strong style="color:${theme.text};">Date export:</strong> ${formatDateTime(new Date().toISOString())}</p>
            <p style="margin:0;"><strong style="color:${theme.text};">Ticket:</strong> ${ticketNumber}</p>
          </div>
        </div>
      </section>
      <section style="background:#ffffff;border:1px solid ${theme.border};border-radius:8px;padding:16px 18px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Titre</p>
            <p style="margin:0 0 12px 0;font-size:30px;line-height:1.1;font-weight:800;color:${theme.primary};">${title}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Client</p>
            <p style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:${theme.text};">${clientName}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Projet</p>
            <p style="margin:0 0 12px 0;font-size:18px;font-weight:700;color:${theme.text};">${projectName}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Description</p>
            <p style="margin:0;font-size:15px;line-height:1.5;color:${theme.text};">${description}</p>
          </div>
          <div>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Statut</p>
            <p style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:${theme.text};">${status}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Priorité</p>
            <p style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:${theme.text};">${priority}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">SLA</p>
            <p style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:${theme.text};">${sla}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Échéance SLA</p>
            <p style="margin:0 0 12px 0;font-size:18px;font-weight:700;color:${theme.text};">${dueAt}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Créé le</p>
            <p style="margin:0 0 8px 0;font-size:18px;font-weight:700;color:${theme.text};">${createdAt}</p>
            <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${theme.textLight};">Mis à jour</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:${theme.text};">${updatedAt}</p>
          </div>
        </div>
      </section>
    </div>
  `;
};

const resolveSupportTheme = async (settingsOverride = null) => {
  const settings = await resolveInvoiceExportSettings(null, settingsOverride);
  const theme = getTheme(settings.color_theme);
  return { settings, theme };
};

export const exportCrmSupportTicketPDF = async (ticket, company, invoiceSettings = null) => {
  const { settings, theme } = await resolveSupportTheme(invoiceSettings);
  const filename = `CRM_Ticket_${ticket?.ticket_number || 'ticket'}_${formatDateInput()}`;
  await exportTicketAsPdf({
    filename,
    content: ticketContent(ticket, company, settings, theme),
  });
};

export const exportCrmSupportTicketHTML = async (ticket, company, invoiceSettings = null) => {
  const { settings, theme } = await resolveSupportTheme(invoiceSettings);
  const filename = `CRM_Ticket_${ticket?.ticket_number || 'ticket'}_${formatDateInput()}`;
  const html = buildStandaloneTemplateHtml('Ticket support CRM', ticketContent(ticket, company, settings, theme));
  downloadHtmlFile(html, filename);
};
