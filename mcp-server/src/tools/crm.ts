import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { safeError } from '../utils/errors.js';

const LEAD_CLIENT_COLUMNS =
  'id, user_id, company_id, company_name, contact_name, email, phone, city, country, created_at, updated_at';

function applyClientSearch(query: any, search?: string) {
  if (!search) return query;
  const safeSearch = search.replace(/[|,().]/g, '\\$&');
  const pattern = `%${safeSearch}%`;
  return query.or(`company_name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern}`);
}

async function fetchAllClientIdsForUser(userId: string, companyId?: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const pageSize = 1000;

  for (let offset = 0; offset <= 20000; offset += pageSize) {
    let query = supabase
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .range(offset, offset + pageSize - 1);

    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query;
    if (error) throw error;

    for (const row of data ?? []) {
      if (row?.id) ids.add(row.id);
    }

    if (!data || data.length < pageSize) break;
  }

  return ids;
}

async function fetchLinkedClientIds(
  table: 'quotes' | 'invoices',
  userId: string,
  companyId?: string
): Promise<Set<string>> {
  const ids = new Set<string>();
  const pageSize = 1000;

  for (let offset = 0; offset <= 20000; offset += pageSize) {
    let query = supabase
      .from(table)
      .select('client_id')
      .eq('user_id', userId)
      .not('client_id', 'is', null)
      .range(offset, offset + pageSize - 1);

    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query;
    if (error) throw error;

    for (const row of data ?? []) {
      if (row?.client_id) ids.add(row.client_id);
    }

    if (!data || data.length < pageSize) break;
  }

  return ids;
}

async function countRows(
  table: 'clients' | 'quotes' | 'invoices' | 'projects' | 'crm_support_tickets',
  userId: string,
  companyId?: string,
  mutate?: (query: any) => any
) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if (companyId) query = query.eq('company_id', companyId);
  if (mutate) query = mutate(query);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export function registerCrmTools(server: McpServer) {
  server.tool(
    'list_crm_leads',
    'List CRM leads for a company. A lead is a client without any quote or invoice.',
    {
      company_id: z.string().optional().describe('Company UUID (optional, defaults to all companies of the user)'),
      search: z.string().optional().describe('Search by company_name, contact_name, or email'),
      limit: z.number().optional().describe('Maximum results to return (default 50)'),
      offset: z.number().optional().describe('Number of results to skip (default 0)'),
    },
    async ({ company_id, search, limit = 50, offset = 0 }) => {
      const userId = getUserId();
      const pageLimit = Math.max(1, Math.min(limit, 200));
      const pageOffset = Math.max(0, offset);
      const fetchWindow = Math.max((pageOffset + pageLimit) * 4, 200);
      const maxRows = Math.min(fetchWindow, 2500);

      let clientQuery = supabase
        .from('clients')
        .select(LEAD_CLIENT_COLUMNS)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(0, maxRows - 1);

      if (company_id) clientQuery = clientQuery.eq('company_id', company_id);
      clientQuery = applyClientSearch(clientQuery, search);

      const [clientsRes, quoteClientIdsRes, invoiceClientIdsRes] = await Promise.all([
        clientQuery,
        fetchLinkedClientIds('quotes', userId, company_id).catch((error) => ({ error })),
        fetchLinkedClientIds('invoices', userId, company_id).catch((error) => ({ error })),
      ]);

      if (clientsRes.error) {
        return { content: [{ type: 'text' as const, text: safeError(clientsRes.error, 'list CRM leads (clients)') }] };
      }
      if ((quoteClientIdsRes as any).error) {
        return {
          content: [
            { type: 'text' as const, text: safeError((quoteClientIdsRes as any).error, 'list CRM leads (quotes)') },
          ],
        };
      }
      if ((invoiceClientIdsRes as any).error) {
        return {
          content: [
            { type: 'text' as const, text: safeError((invoiceClientIdsRes as any).error, 'list CRM leads (invoices)') },
          ],
        };
      }

      const quoteClientIds = quoteClientIdsRes as Set<string>;
      const invoiceClientIds = invoiceClientIdsRes as Set<string>;
      const clientsWithDocuments = new Set<string>([...quoteClientIds, ...invoiceClientIds]);

      const leadRows = (clientsRes.data ?? []).filter((client: any) => !clientsWithDocuments.has(client.id));
      const paginated = leadRows.slice(pageOffset, pageOffset + pageLimit);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                scope: { user_id: userId, company_id: company_id ?? 'all' },
                pagination: {
                  limit: pageLimit,
                  offset: pageOffset,
                  returned: paginated.length,
                  available_in_window: leadRows.length,
                },
                leads: paginated,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    'get_crm_pipeline_summary',
    'Get CRM pipeline summary for leads, clients, projects, tickets, and conversion indicators.',
    {
      company_id: z.string().optional().describe('Company UUID (optional, defaults to all companies of the user)'),
    },
    async ({ company_id }) => {
      const userId = getUserId();
      const today = new Date().toISOString().slice(0, 10);

      try {
        const [
          totalClients,
          totalProjects,
          totalQuotesAccepted,
          totalQuotesOpen,
          totalInvoicesOverdue,
          supportBacklog,
          supportResolved,
        ] = await Promise.all([
          countRows('clients', userId, company_id, (q) => q.is('deleted_at', null)),
          countRows('projects', userId, company_id),
          countRows('quotes', userId, company_id, (q) => q.in('status', ['accepted', 'signed'])),
          countRows('quotes', userId, company_id, (q) => q.in('status', ['draft', 'sent', 'viewed'])),
          countRows('invoices', userId, company_id, (q) => q.neq('payment_status', 'paid').lt('due_date', today)),
          countRows('crm_support_tickets', userId, company_id, (q) =>
            q.in('status', ['open', 'in_progress', 'waiting_customer'])
          ),
          countRows('crm_support_tickets', userId, company_id, (q) => q.in('status', ['resolved', 'closed'])),
        ]);

        const [clientIds, quoteClientIds, invoiceClientIds] = await Promise.all([
          fetchAllClientIdsForUser(userId, company_id),
          fetchLinkedClientIds('quotes', userId, company_id),
          fetchLinkedClientIds('invoices', userId, company_id),
        ]);

        const clientsWithDocuments = new Set<string>([...quoteClientIds, ...invoiceClientIds]);
        let leadsCount = 0;
        for (const clientId of clientIds) {
          if (!clientsWithDocuments.has(clientId)) leadsCount += 1;
        }

        const conversionRate =
          totalClients > 0 ? Math.round(((totalClients - leadsCount) / totalClients) * 10000) / 100 : 0;

        const summary = {
          scope: { user_id: userId, company_id: company_id ?? 'all' },
          clients: {
            total: totalClients,
            leads: leadsCount,
            with_commercial_documents: totalClients - leadsCount,
            conversion_rate_pct: conversionRate,
          },
          projects: {
            total: totalProjects,
          },
          commercial: {
            quotes_open: totalQuotesOpen,
            quotes_accepted: totalQuotesAccepted,
            overdue_invoices: totalInvoicesOverdue,
          },
          support: {
            backlog_open: supportBacklog,
            resolved_or_closed: supportResolved,
          },
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text' as const, text: safeError(error, 'get CRM pipeline summary') }],
        };
      }
    }
  );
}
