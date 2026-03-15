import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { login, logout, isAuthenticated, getUserId } from './supabase.js';
import { registerInvoiceTools } from './tools/invoices.js';
import { registerClientTools } from './tools/clients.js';
import { registerPaymentTools } from './tools/payments.js';
import { registerAccountingTools } from './tools/accounting.js';
import { registerAnalyticsTools } from './tools/analytics.js';
import { registerExportTools } from './tools/exports.js';
import { registerGeneratedCrudTools } from './tools/generated_crud.js';
import { registerSupplierInvoiceTools } from './tools/supplier-invoices.js';
import { registerBankReconciliationTools } from './tools/bank-reconciliation.js';
import { registerReportingTools } from './tools/reporting.js';
import { registerDocumentTools } from './tools/documents.js';
import { registerCompanyFinanceTools } from './tools/company-finance.js';
import { registerFinancialInstrumentTools } from './tools/financial-instruments.js';
import { registerHrCrudTools } from './tools/generated_crud_hr.js';
import { registerProjectCrmCrudTools } from './tools/generated_crud_projects.js';
import { registerCfoTools } from './tools/cfo.js';
import { registerMobileMoneyTools } from './tools/mobile_money.js';
import { registerSycohadaTools } from './tools/syscohada.js';

/**
 * Creates and configures a fully-equipped CashPilot MCP server instance
 * with all auth and business tools registered.
 *
 * This is shared between the stdio (index.ts) and HTTP (http.ts) entry points.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'cashpilot',
    version: '1.0.0',
  });

  // ── Auth tools ──────────────────────────────────────────────

  server.tool(
    'login',
    'Login to CashPilot with email and password. Required before using any other tool.',
    {
      email: z.string().describe('User email'),
      password: z.string().describe('User password'),
    },
    async ({ email, password }) => {
      try {
        const result = await login(email, password);
        return {
          content: [{ type: 'text' as const, text: `Logged in as ${result.email} (user_id: ${result.userId})` }],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `Login failed: ${err.message}` }],
        };
      }
    }
  );

  server.tool('logout', 'Logout from CashPilot', {}, async () => {
    await logout();
    return {
      content: [{ type: 'text' as const, text: 'Logged out.' }],
    };
  });

  server.tool('whoami', 'Check current authentication status', {}, async () => {
    if (!isAuthenticated()) {
      return { content: [{ type: 'text' as const, text: 'Not logged in. Use the "login" tool first.' }] };
    }
    return { content: [{ type: 'text' as const, text: `Logged in. User ID: ${getUserId()}` }] };
  });

  // ── Business tool modules ──────────────────────────────────

  registerInvoiceTools(server);
  registerClientTools(server);
  registerPaymentTools(server);
  registerAccountingTools(server);
  registerAnalyticsTools(server);
  registerExportTools(server);
  registerGeneratedCrudTools(server);
  registerSupplierInvoiceTools(server);
  registerBankReconciliationTools(server);
  registerReportingTools(server);
  registerDocumentTools(server);
  registerCompanyFinanceTools(server);
  registerFinancialInstrumentTools(server);
  registerHrCrudTools(server);
  registerProjectCrmCrudTools(server);
  registerCfoTools(server);
  registerMobileMoneyTools(server);
  registerSycohadaTools(server);

  return server;
}
