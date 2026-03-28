import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback, params) => {
      const template = typeof fallback === 'string' && fallback.length > 0 ? fallback : key;
      if (!params || typeof template !== 'string') return template;
      return template.replace(/\{\{(\w+)\}\}/g, (_match, token) => {
        const value = params[token];
        return value == null ? '' : String(value);
      });
    },
  }),
}));

import CfoWeeklyBriefingCard from '@/components/cfo/CfoWeeklyBriefingCard';

describe('CfoWeeklyBriefingCard', () => {
  it('renders the weekly briefing, generation timestamp, and cache state', () => {
    render(
      <CfoWeeklyBriefingCard
        briefing={{
          company_name: 'Acme SARL',
          week_start: '2026-03-23',
          generated_at: '2026-03-27T10:00:00.000Z',
          briefing_text: 'Résumé hebdomadaire CFO.',
          briefing_json: {
            summary: { health_score: 71 },
            highlights: ['Client Alpha'],
            recommended_actions: ['Relancer les impayés'],
          },
        }}
        generatedNow={false}
        loading={false}
      />
    );

    expect(screen.getByText(/Briefing hebdomadaire/i)).toBeInTheDocument();
    expect(screen.getByText('Résumé hebdomadaire CFO.')).toBeInTheDocument();
    expect(screen.getByText(/Client Alpha/i)).toBeInTheDocument();
    expect(screen.getByText(/27\/03\/2026/i)).toBeInTheDocument();
    expect(screen.getByText(/cache/i)).toBeInTheDocument();
  });
});
