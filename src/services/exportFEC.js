/**
 * Export FEC (Fichier des Ecritures Comptables)
 * Format obligatoire pour l'administration fiscale francaise
 * Norme Article A.47 A-1 du Livre des Procedures Fiscales
 */

import { supabase } from '@/lib/supabase';

const FEC_COLUMNS = [
  'JournalCode',    // Code journal
  'JournalLib',     // Libelle journal
  'EcritureNum',    // Numero ecriture
  'EcritureDate',   // Date ecriture (AAAAMMJJ)
  'CompteNum',      // Numero compte
  'CompteLib',      // Libelle compte
  'CompAuxNum',     // Numero compte auxiliaire
  'CompAuxLib',     // Libelle compte auxiliaire
  'PieceRef',       // Reference piece
  'PieceDate',      // Date piece (AAAAMMJJ)
  'EcritureLib',    // Libelle ecriture
  'Debit',          // Montant debit
  'Credit',         // Montant credit
  'EcritureLet',    // Lettrage
  'DateLet',        // Date lettrage
  'ValidDate',      // Date validation
  'Montantdevise',  // Montant devise
  'Idevise'         // Identifiant devise
];

const JOURNAL_CODES_DEFAULT = {
  'sales': { code: 'VE', lib: 'Ventes' },
  'purchases': { code: 'AC', lib: 'Achats' },
  'bank': { code: 'BQ', lib: 'Banque' },
  'cash': { code: 'CA', lib: 'Caisse' },
  'misc': { code: 'OD', lib: 'Operations Diverses' },
  'payroll': { code: 'PA', lib: 'Paie' },
};

/**
 * Fetch journal codes from accounting_journals DB table.
 * Falls back to JOURNAL_CODES_DEFAULT if fetch fails or returns empty.
 */
async function getJournalCodes(userId) {
  try {
    const { data } = await supabase
      .from('accounting_journals')
      .select('code, name, journal_type')
      .eq('user_id', userId);
    if (data && data.length > 0) {
      const map = {};
      data.forEach(j => { map[j.journal_type] = { code: j.code, lib: j.name }; });
      return { ...JOURNAL_CODES_DEFAULT, ...map };
    }
  } catch (err) {
    console.warn('Failed to fetch journal codes from DB, using defaults:', err);
  }
  return JOURNAL_CODES_DEFAULT;
}

// Keep backward-compatible reference
const JOURNAL_CODES = JOURNAL_CODES_DEFAULT;

/**
 * Format une date au format FEC (AAAAMMJJ)
 */
const formatFECDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

/**
 * Format un montant au format FEC (virgule decimale)
 */
const formatFECAmount = (amount) => {
  if (amount === null || amount === undefined || amount === 0) return '';
  return Math.abs(amount).toFixed(2).replace('.', ',');
};

/**
 * Echappe les caracteres speciaux pour CSV
 */
const escapeField = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str.replace(/\|/g, ' ').replace(/[\r\n]/g, ' ').trim();
};

/**
 * Genere le nom de fichier FEC conforme
 * Format: SirenFECAAAAMMJJ.txt
 */
export const generateFECFilename = (siren, endDate) => {
  const dateStr = formatFECDate(endDate);
  return `${siren}FEC${dateStr}.txt`;
};

/**
 * Transforme les ecritures en format FEC
 */
const transformEntryToFEC = (entry, index, journalCodes) => {
  const codes = journalCodes || JOURNAL_CODES_DEFAULT;
  const journal = codes[entry.journal_type] || codes.misc || JOURNAL_CODES_DEFAULT.misc;

  return {
    JournalCode: journal.code,
    JournalLib: journal.lib,
    EcritureNum: entry.entry_number || String(index + 1).padStart(6, '0'),
    EcritureDate: formatFECDate(entry.transaction_date),
    CompteNum: entry.account_code || '',
    CompteLib: escapeField(entry.account_name || ''),
    CompAuxNum: entry.auxiliary_account || '',
    CompAuxLib: escapeField(entry.auxiliary_name || ''),
    PieceRef: escapeField(entry.document_ref || ''),
    PieceDate: formatFECDate(entry.document_date || entry.transaction_date),
    EcritureLib: escapeField(entry.description || ''),
    Debit: entry.debit > 0 ? formatFECAmount(entry.debit) : '',
    Credit: entry.credit > 0 ? formatFECAmount(entry.credit) : '',
    EcritureLet: entry.lettrage || '',
    DateLet: entry.lettrage_date ? formatFECDate(entry.lettrage_date) : '',
    ValidDate: formatFECDate(entry.validated_at || entry.transaction_date),
    Montantdevise: entry.foreign_amount ? formatFECAmount(entry.foreign_amount) : '',
    Idevise: entry.foreign_currency || 'EUR'
  };
};

/**
 * Exporte les ecritures comptables au format FEC
 * @param {Array} entries - Ecritures comptables
 * @param {Object} companyInfo - Informations entreprise (siren, nom)
 * @param {Date} startDate - Date debut exercice
 * @param {Date} endDate - Date fin exercice
 * @param {string} [userId] - User ID for fetching journal codes from DB
 * @returns {Object} { blob, filename, rowCount, period }
 */
export const exportFEC = async (entries, companyInfo, startDate, endDate, userId) => {
  if (!entries || entries.length === 0) {
    throw new Error('Aucune ecriture a exporter');
  }

  if (!companyInfo?.siren) {
    throw new Error('SIREN requis pour l\'export FEC');
  }

  // Fetch journal codes from DB if userId is provided, otherwise use defaults
  const journalCodes = userId ? await getJournalCodes(userId) : JOURNAL_CODES_DEFAULT;

  const sortedEntries = [...entries].sort((a, b) => {
    const dateCompare = new Date(a.transaction_date) - new Date(b.transaction_date);
    if (dateCompare !== 0) return dateCompare;
    return (a.entry_number || 0) - (b.entry_number || 0);
  });

  const fecLines = sortedEntries.map((entry, index) => transformEntryToFEC(entry, index, journalCodes));

  const header = FEC_COLUMNS.join('|');
  const rows = fecLines.map(line =>
    FEC_COLUMNS.map(col => line[col] || '').join('|')
  );

  const csvContent = [header, ...rows].join('\r\n');

  const BOM = '\ufeff';
  const blob = new Blob([BOM + csvContent], {
    type: 'text/plain;charset=utf-8'
  });

  return {
    blob,
    filename: generateFECFilename(companyInfo.siren, endDate),
    rowCount: fecLines.length,
    period: { start: startDate, end: endDate }
  };
};

/**
 * Valide la structure d'une ecriture avant export
 */
export const validateEntry = (entry) => {
  const errors = [];

  if (!entry.transaction_date) {
    errors.push('Date transaction manquante');
  }
  if (!entry.account_code) {
    errors.push('Numero de compte manquant');
  }
  if (entry.debit === undefined && entry.credit === undefined) {
    errors.push('Montant debit ou credit requis');
  }
  if (entry.debit && entry.credit && entry.debit > 0 && entry.credit > 0) {
    errors.push('Une ecriture ne peut pas avoir debit ET credit');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Verifie l'equilibre des ecritures
 */
export const checkBalance = (entries) => {
  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);

  return {
    balanced: diff < 0.01,
    totalDebit,
    totalCredit,
    difference: diff
  };
};

export default {
  exportFEC,
  generateFECFilename,
  validateEntry,
  checkBalance,
  FEC_COLUMNS,
  JOURNAL_CODES
};
