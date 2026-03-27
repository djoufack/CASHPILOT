import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockUseCfoGuidedActions } = vi.hoisted(() => ({
  mockUseCfoGuidedActions: vi.fn(),
}));

vi.mock('@/hooks/useCfoGuidedActions', () => ({
  useCfoGuidedActions: mockUseCfoGuidedActions,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

import CfoGuidedActionsPanel from '@/components/cfo/CfoGuidedActionsPanel';

describe('CfoGuidedActionsPanel', () => {
  it('renders the three guided actions with their CTA buttons', () => {
    mockUseCfoGuidedActions.mockReturnValue({
      guidedActions: [
        {
          key: 'relance',
          title: 'Relance',
          description: 'Relancer la facture la plus en retard',
          cta: 'Lancer la relance',
          state: 'idle',
          message: null,
          run: vi.fn(),
        },
        {
          key: 'scenario',
          title: 'Scenario',
          description: 'Créer un scénario brouillon',
          cta: 'Créer le scénario',
          state: 'loading',
          message: null,
          run: vi.fn(),
        },
        {
          key: 'audit',
          title: 'Audit',
          description: 'Ouvrir l’audit avec autorun',
          cta: 'Ouvrir l’audit',
          state: 'success',
          message: 'Audit prêt',
          run: vi.fn(),
        },
      ],
    });

    render(<CfoGuidedActionsPanel />);

    expect(screen.getByText('Relance')).toBeInTheDocument();
    expect(screen.getByText('Scenario')).toBeInTheDocument();
    expect(screen.getByText('Audit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lancer la relance' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Traitement...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ouvrir l’audit' })).toBeEnabled();
    expect(screen.getByText('Audit prêt')).toBeInTheDocument();
  });
});
