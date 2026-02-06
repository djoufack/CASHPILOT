/**
 * VAT Declaration Service
 * Generates CA3 (France) and Intervat (Belgium) declarations
 */

import { supabase } from '@/lib/supabase';

/**
 * Calculate VAT breakdown for a period
 */
export const calculateVATBreakdown = async (userId, startDate, endDate) => {
  // Fetch invoices for the period
  const { data: invoices } = await supabase
    .from('invoices')
    .select('total_ht, total_vat, vat_rate, status')
    .eq('user_id', userId)
    .gte('invoice_date', startDate)
    .lte('invoice_date', endDate)
    .eq('status', 'paid');

  // Fetch expenses for the period
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount, vat_amount, vat_rate, category')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate);

  // Calculate output VAT (TVA collectee)
  const outputVAT = {
    total: invoices?.reduce((sum, inv) => sum + (inv.total_vat || 0), 0) || 0,
    byRate: {}
  };

  invoices?.forEach(inv => {
    const rate = inv.vat_rate || 20;
    if (!outputVAT.byRate[rate]) {
      outputVAT.byRate[rate] = { base: 0, vat: 0 };
    }
    outputVAT.byRate[rate].base += inv.total_ht || 0;
    outputVAT.byRate[rate].vat += inv.total_vat || 0;
  });

  // Calculate input VAT (TVA deductible)
  const inputVAT = {
    goods: 0,
    services: 0,
    total: 0
  };

  expenses?.forEach(exp => {
    const vatAmount = exp.vat_amount || 0;
    inputVAT.total += vatAmount;
    if (['equipment', 'supplies', 'inventory'].includes(exp.category)) {
      inputVAT.goods += vatAmount;
    } else {
      inputVAT.services += vatAmount;
    }
  });

  return {
    period: { start: startDate, end: endDate },
    totalRevenue: invoices?.reduce((sum, inv) => sum + (inv.total_ht || 0), 0) || 0,
    outputVAT,
    inputVAT,
    netVAT: outputVAT.total - inputVAT.total
  };
};

/**
 * Generate CA3 declaration (France)
 */
export const generateCA3 = async (userId, period) => {
  const vatData = await calculateVATBreakdown(
    userId,
    period.startDate,
    period.endDate
  );

  return {
    format: 'CA3',
    period: period,
    lines: {
      // Ligne 01 - Chiffre d'affaires HT
      line01_ca_ht: vatData.totalRevenue,
      // Ligne 08 - TVA brute sur operations imposables
      line08_tva_collectee: vatData.outputVAT.total,
      // Ligne 08A - Dont TVA 20%
      line08A_tva_20: vatData.outputVAT.byRate[20]?.vat || 0,
      // Ligne 08B - Dont TVA 10%
      line08B_tva_10: vatData.outputVAT.byRate[10]?.vat || 0,
      // Ligne 09 - Dont TVA 5.5%
      line09_tva_55: vatData.outputVAT.byRate[5.5]?.vat || 0,
      // Ligne 19 - TVA deductible sur biens
      line19_tva_deductible_biens: vatData.inputVAT.goods,
      // Ligne 20 - TVA deductible sur services
      line20_tva_deductible_services: vatData.inputVAT.services,
      // Ligne 23 - Total TVA deductible
      line23_total_deductible: vatData.inputVAT.total,
      // Ligne 28 - TVA nette due ou credit
      line28_tva_nette: vatData.netVAT
    },
    summary: {
      tvaCollectee: vatData.outputVAT.total,
      tvaDeductible: vatData.inputVAT.total,
      tvaNette: vatData.netVAT,
      isCredit: vatData.netVAT < 0
    }
  };
};

/**
 * Generate Intervat declaration (Belgium)
 */
export const generateIntervat = async (userId, period) => {
  const vatData = await calculateVATBreakdown(
    userId,
    period.startDate,
    period.endDate
  );

  return {
    format: 'Intervat',
    period: period,
    grids: {
      // Grid 00 - Chiffre d'affaires
      grid00: vatData.totalRevenue,
      // Grid 54 - TVA due sur operations
      grid54: vatData.outputVAT.total,
      // Grid 59 - TVA deductible
      grid59: vatData.inputVAT.total,
      // Grid 71 - TVA a payer
      grid71: Math.max(0, vatData.netVAT),
      // Grid 72 - Credit TVA
      grid72: Math.max(0, -vatData.netVAT)
    },
    summary: {
      btwVerschuldigd: vatData.outputVAT.total,
      btwAftrekbaar: vatData.inputVAT.total,
      saldo: vatData.netVAT
    }
  };
};

/**
 * Generate VAT declaration for any supported country
 */
export const generateVATDeclaration = async (userId, period, country = 'FR') => {
  switch (country) {
    case 'FR':
      return generateCA3(userId, period);
    case 'BE':
      return generateIntervat(userId, period);
    default:
      throw new Error(`Country ${country} not supported for VAT declaration`);
  }
};

/**
 * Export declaration as JSON file
 */
export const exportDeclarationJSON = (declaration) => {
  const json = JSON.stringify(declaration, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  return {
    blob,
    filename: `declaration-${declaration.format}-${declaration.period.startDate}.json`
  };
};

export default {
  calculateVATBreakdown,
  generateCA3,
  generateIntervat,
  generateVATDeclaration,
  exportDeclarationJSON
};
