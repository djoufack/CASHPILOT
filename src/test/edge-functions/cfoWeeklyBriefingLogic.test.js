import { describe, expect, it } from 'vitest';
import { buildWeeklyBriefing, getUtcWeekStart } from '../../../supabase/functions/cfo-weekly-briefing/briefing.ts';

describe('cfo-weekly-briefing logic', () => {
  it('floors any timestamp to the current UTC week start', () => {
    expect(getUtcWeekStart(new Date('2026-03-27T10:00:00.000Z')).toISOString()).toBe('2026-03-23T00:00:00.000Z');
    expect(getUtcWeekStart(new Date('2026-03-23T00:00:00.000Z')).toISOString()).toBe('2026-03-23T00:00:00.000Z');
  });

  it('builds a weekly briefing from CFO context and exposes the generated timestamp', () => {
    const briefing = buildWeeklyBriefing(
      {
        companyId: 'company-1',
        companyName: 'Acme SARL',
        summary: {
          totalRevenue: 10000,
          totalExpenses: 2500,
          netResult: 7500,
          totalPaid: 8000,
          unpaidTotal: 2000,
          overdueCount: 2,
          clientCount: 5,
          invoiceCount: 12,
        },
        workingCapitalKpis: {
          dso: 48.2,
          dpo: 26.9,
          dio: 64.1,
          ccc: 85.4,
        },
        topClientsByRevenue: [
          { client_name: 'Client Alpha', revenue_ttc: 5000, unpaid_ttc: 500 },
          { client_name: 'Client Beta', revenue_ttc: 3000, unpaid_ttc: 0 },
        ],
        overdueInvoices: [{ invoice_number: 'INV-001', balance_due: 150 }],
      },
      new Date('2026-03-27T10:00:00.000Z')
    );

    expect(briefing).toEqual(
      expect.objectContaining({
        company_id: 'company-1',
        company_name: 'Acme SARL',
        week_start: '2026-03-23',
        generated_at: '2026-03-27T10:00:00.000Z',
        briefing_text: expect.stringContaining('Acme SARL'),
      })
    );
    expect(briefing.briefing_text).toContain('DSO: 48.2 j');
    expect(briefing.briefing_text).toContain('DPO: 26.9 j');
    expect(briefing.briefing_text).toContain('DIO: 64.1 j');
    expect(briefing.briefing_text).toContain('CCC: 85.4 j');

    expect(briefing.briefing_json).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          health_score: expect.any(Number),
          dso: 48.2,
          dpo: 26.9,
          dio: 64.1,
          ccc: 85.4,
        }),
        highlights: expect.arrayContaining([expect.stringContaining('Client Alpha')]),
        recommended_actions: expect.arrayContaining([expect.any(String)]),
      })
    );
  });
});
