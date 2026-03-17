/**
 * Centralized status mappings for CashPilot modules.
 *
 * These objects define the visual representation (labels, Tailwind classes,
 * chart colors) for each status value. They are the single source of truth
 * consumed by page components and can later be replaced by DB lookups
 * (ENF-1 compliance).
 */

// ---------------------------------------------------------------------------
// Payroll period statuses
// ---------------------------------------------------------------------------
export const PAYROLL_STATUSES = {
  draft: {
    label: 'Brouillon',
    bg: 'bg-gray-500/20',
    text: 'text-gray-300',
    border: 'border-gray-500/30',
    dot: 'bg-gray-400',
    chartFill: 'rgba(156,163,175,0.5)',
  },
  calculated: {
    label: 'Calcule',
    bg: 'bg-blue-500/20',
    text: 'text-blue-300',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
    chartFill: 'rgba(96,165,250,0.6)',
  },
  validated: {
    label: 'Valide',
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
    chartFill: 'rgba(52,211,153,0.6)',
  },
  exported: {
    label: 'Exporte',
    bg: 'bg-purple-500/20',
    text: 'text-purple-300',
    border: 'border-purple-500/30',
    dot: 'bg-purple-400',
    chartFill: 'rgba(168,85,247,0.6)',
  },
};

// ---------------------------------------------------------------------------
// Absence / leave-request statuses
// ---------------------------------------------------------------------------
export const ABSENCE_STATUSES = {
  draft: {
    label: 'Brouillon',
    dot: 'bg-gray-400',
    text: 'text-gray-300',
    bg: 'bg-gray-400/10 border-gray-400/30',
  },
  submitted: {
    label: 'Soumis',
    dot: 'bg-yellow-400',
    text: 'text-yellow-300',
    bg: 'bg-yellow-400/10 border-yellow-400/30',
  },
  pending: {
    label: 'En attente',
    dot: 'bg-yellow-400',
    text: 'text-yellow-300',
    bg: 'bg-yellow-400/10 border-yellow-400/30',
  },
  approved: {
    label: 'Approuvé',
    dot: 'bg-green-400',
    text: 'text-green-300',
    bg: 'bg-green-400/10 border-green-400/30',
  },
  rejected: {
    label: 'Refusé',
    dot: 'bg-red-400',
    text: 'text-red-300',
    bg: 'bg-red-400/10 border-red-400/30',
  },
  cancelled: {
    label: 'Annulé',
    dot: 'bg-gray-400',
    text: 'text-gray-300',
    bg: 'bg-gray-400/10 border-gray-400/30',
  },
};
