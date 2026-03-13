import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CompanySwitcher from '@/components/CompanySwitcher';
import { ACTIVE_COMPANY_STORAGE_KEY } from '@/utils/activeCompanyStorage';

describe('CompanySwitcher', () => {
  it('places the primary company first and labels it in the dropdown', () => {
    const companies = [
      { id: 'b', company_name: 'Beta Conseil', created_at: '2026-02-03T10:00:00.000Z' },
      { id: 'a', company_name: 'Alpha Studio', created_at: '2026-01-20T10:00:00.000Z' },
      { id: 'c', company_name: 'CashPilot Demo France Portfolio SARL 2', created_at: '2026-03-01T10:00:00.000Z', is_primary: true },
    ];

    render(
      <CompanySwitcher
        companies={companies}
        activeCompany={{ id: 'b', company_name: 'Beta Conseil' }}
      />,
    );

    const triggerButton = screen.getByRole('button', { name: /beta conseil/i });
    fireEvent.click(triggerButton);

    const companyButtons = screen
      .getAllByRole('button')
      .filter((button) => button !== triggerButton)
      .filter((button) => !(button.textContent || '').includes('company.addCompany'))
      .map((button) => button.textContent || '');

    expect(companyButtons[0]).toContain('CashPilot Demo France Portfolio SARL 2');
    expect(screen.getByText('company.primaryShort')).toBeInTheDocument();
  });

  it('shows active marker on selected company even when primary differs', () => {
    const companies = [
      { id: '1', company_name: 'Company Principale', created_at: '2026-01-01T10:00:00.000Z', is_primary: true },
      { id: '2', company_name: 'Company Secondaire', created_at: '2026-01-02T10:00:00.000Z' },
    ];

    render(
      <CompanySwitcher
        companies={companies}
        activeCompany={{ id: 2, company_name: 'Company Secondaire' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /company secondaire/i }));

    const activeMarker = screen.getByText(/company\.activeCompany/i);
    expect(activeMarker.closest('button')?.textContent || '').toContain('Company Secondaire');
  });

  it('uses active company from storage when local active object is stale', () => {
    window.localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, '2');
    const companies = [
      { id: '1', company_name: 'Company Principale', created_at: '2026-01-01T10:00:00.000Z', is_primary: true },
      { id: '2', company_name: 'Company Secondaire', created_at: '2026-01-02T10:00:00.000Z' },
    ];

    render(
      <CompanySwitcher
        companies={companies}
        activeCompany={{ id: '1', company_name: 'Company Principale' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /company secondaire/i }));

    const activeMarker = screen.getByText(/company\.activeCompany/i);
    expect(activeMarker.closest('button')?.textContent || '').toContain('Company Secondaire');
    window.localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
  });

  it('matches active company regardless of id casing', () => {
    window.localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, 'abc-123');
    const companies = [
      { id: 'AAA-000', company_name: 'Company Principale', created_at: '2026-01-01T10:00:00.000Z', is_primary: true },
      { id: 'ABC-123', company_name: 'Company Secondaire', created_at: '2026-01-02T10:00:00.000Z' },
    ];

    render(
      <CompanySwitcher
        companies={companies}
        activeCompany={{ id: 'AAA-000', company_name: 'Company Principale' }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /company secondaire/i }));
    const activeMarker = screen.getByText(/company\.activeCompany/i);
    expect(activeMarker.closest('button')?.textContent || '').toContain('Company Secondaire');
    window.localStorage.removeItem(ACTIVE_COMPANY_STORAGE_KEY);
  });
});
