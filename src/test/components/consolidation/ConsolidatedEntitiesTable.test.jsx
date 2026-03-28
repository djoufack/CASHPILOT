import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ConsolidatedEntitiesTable from '@/components/consolidation/ConsolidatedEntitiesTable';

describe('ConsolidatedEntitiesTable', () => {
  it('renders entity rows and forwards scope changes', () => {
    const onScopeChange = vi.fn();

    render(
      <ConsolidatedEntitiesTable
        rows={[
          {
            companyId: 'c1',
            companyName: 'Alpha',
            status: 'attention',
            revenue: 1200,
            netIncome: 300,
            cashBalance: 450,
            pendingEliminationCount: 1,
            pendingEliminationAmount: 120,
          },
        ]}
        scope="all"
        summary={{ total: 1, active: 1, attention: 1, inactive: 0 }}
        onScopeChange={onScopeChange}
        currency="EUR"
      />
    );

    expect(
      screen.getByText(/consolidation\.entitiesTitle|Entites consolidees|Consolidated entities/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText(/120\.00|120,00/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /consolidation\.scopeActive|Entites actives|Active entities/i })
    );
    expect(onScopeChange).toHaveBeenCalledWith('active');
  });
});
