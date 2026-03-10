import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import IncomeStatement from '@/components/accounting/IncomeStatement';

describe('IncomeStatement', () => {
  it('renders SQL flat income statement rows without crashing', () => {
    render(
      <IncomeStatement
        incomeStatement={{
          revenueItems: [
            { account_code: '706', account_name: 'Prestations de services', category: '70', amount: 1200 },
          ],
          expenseItems: [
            { account_code: '601', account_name: 'Achats', category: '60', amount: 300 },
            { account_code: '603', account_name: 'Variation de stock', category: '60', amount: -75 },
          ],
          totalRevenue: 1200,
          totalExpenses: 225,
          netIncome: 975,
        }}
        period={{ startDate: '2026-01-01', endDate: '2026-12-31' }}
        currency="EUR"
      />,
    );

    expect(screen.getByText('Compte de résultat')).toBeTruthy();
    expect(screen.getByText('Prestations de services')).toBeTruthy();
    expect(screen.getByText('Achats')).toBeTruthy();
    expect(screen.getByText('Total Produits')).toBeTruthy();
    expect(screen.getByText('Total Charges')).toBeTruthy();
  });
});

