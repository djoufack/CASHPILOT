import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import {
  computeSupplierGlobalScore,
  getSupplierScoreBand,
  normalizeSupplierScore,
} from '@/services/supplierPerformanceScore';

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const UNKNOWN_SUPPLIER_LABEL = 'Supplier';

const createEmptyReportData = () => ({
  spending: [],
  orders: [],
  delivery: [],
  products: [],
  supplierScores: [],
  ordersCount: 0,
  totalSpent: 0,
  onTimeRate: 0,
});

const toDateOnly = (value) => {
  if (!value) return null;

  const rawDate = value.includes('T') ? value.split('T')[0] : value;
  const parsed = new Date(`${rawDate}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toRoundedScore = (value) => Math.round(normalizeSupplierScore(value) * 100) / 100;

const getSupplierName = (supplier = {}) =>
  String(
    supplier.company_name ||
      supplier.contact_person ||
      supplier.email ||
      supplier.supplier_name_extracted ||
      UNKNOWN_SUPPLIER_LABEL
  ).trim();

const createSupplierAccumulator = (supplierId, supplierName) => ({
  supplierId,
  supplierName: supplierName || UNKNOWN_SUPPLIER_LABEL,
  totalOrdersCount: 0,
  deliveredOrdersCount: 0,
  onTimeDeliveriesCount: 0,
  matchedInvoicesCount: 0,
  qualityMatchSum: 0,
  qualityMatchCount: 0,
  qualityFallbackSum: 0,
  qualityFallbackCount: 0,
  costSum: 0,
  costCount: 0,
  latestEvaluationDate: null,
});

const ensureSupplierAccumulator = (targetMap, supplierId, supplierName) => {
  if (!supplierId) return null;

  if (!targetMap.has(supplierId)) {
    targetMap.set(supplierId, createSupplierAccumulator(supplierId, supplierName));
  }

  const value = targetMap.get(supplierId);
  if (supplierName && value.supplierName === UNKNOWN_SUPPLIER_LABEL) {
    value.supplierName = supplierName;
  }

  return value;
};

const getMostRecentTimestamp = (...values) => {
  const candidates = values
    .map((value) => {
      if (!value) return null;
      const timestamp = Date.parse(value);
      return Number.isNaN(timestamp) ? null : timestamp;
    })
    .filter((value) => value !== null);

  if (candidates.length === 0) {
    return null;
  }

  return new Date(Math.max(...candidates)).toISOString();
};

const deriveFallbackSupplierScores = ({ suppliers, orders, invoices, threeWayMatches, supplierFilterId }) => {
  const supplierMap = new Map();
  const invoiceById = new Map();

  for (const supplier of suppliers) {
    ensureSupplierAccumulator(supplierMap, supplier.id, getSupplierName(supplier));
  }

  for (const order of orders) {
    const supplierId = order?.supplier_id;
    if (!supplierId) continue;

    const supplierEntry = ensureSupplierAccumulator(supplierMap, supplierId);
    if (!supplierEntry) continue;

    supplierEntry.totalOrdersCount += 1;
    const expected = toDateOnly(order.expected_delivery_date);
    const actual = toDateOnly(order.actual_delivery_date);

    if (expected && actual) {
      supplierEntry.deliveredOrdersCount += 1;
      if (actual.getTime() <= expected.getTime()) {
        supplierEntry.onTimeDeliveriesCount += 1;
      }
    }
  }

  for (const invoice of invoices) {
    if (!invoice?.id || !invoice?.supplier_id) continue;

    invoiceById.set(invoice.id, invoice);
    const supplierEntry = ensureSupplierAccumulator(supplierMap, invoice.supplier_id);
    if (!supplierEntry) continue;

    const fallbackQualityScore = Number(invoice.three_way_match_score);
    if (Number.isFinite(fallbackQualityScore) && fallbackQualityScore >= 0) {
      supplierEntry.qualityFallbackSum += normalizeSupplierScore(fallbackQualityScore);
      supplierEntry.qualityFallbackCount += 1;
    }
  }

  for (const match of threeWayMatches) {
    const supplierInvoice = invoiceById.get(match?.supplier_invoice_id);
    const supplierId = supplierInvoice?.supplier_id;
    if (!supplierId) continue;

    const supplierEntry = ensureSupplierAccumulator(supplierMap, supplierId);
    if (!supplierEntry) continue;

    const matchScore = Number(match.match_score);
    if (Number.isFinite(matchScore) && matchScore >= 0) {
      supplierEntry.qualityMatchSum += normalizeSupplierScore(matchScore);
      supplierEntry.qualityMatchCount += 1;
      supplierEntry.matchedInvoicesCount += 1;
    }

    const orderedAmount = Math.abs(Number(match.ordered_total_amount || 0));
    const invoicedAmount = Math.abs(Number(match.invoiced_total_amount || 0));
    const amountVariance = Math.abs(Number(match.amount_variance || 0));
    const varianceBase = Math.max(orderedAmount, invoicedAmount, 1);
    const varianceRatio = amountVariance / varianceBase;
    const costScore = normalizeSupplierScore(100 - varianceRatio * 100);

    supplierEntry.costSum += costScore;
    supplierEntry.costCount += 1;
    supplierEntry.latestEvaluationDate = getMostRecentTimestamp(
      supplierEntry.latestEvaluationDate,
      match.updated_at,
      match.matched_at
    );
  }

  return [...supplierMap.values()]
    .filter((entry) => (!supplierFilterId ? true : entry.supplierId === supplierFilterId))
    .map((entry) => {
      const deliveryScore =
        entry.deliveredOrdersCount > 0
          ? toRoundedScore((entry.onTimeDeliveriesCount / entry.deliveredOrdersCount) * 100)
          : 100;

      const qualityScore =
        entry.qualityMatchCount > 0
          ? toRoundedScore(entry.qualityMatchSum / entry.qualityMatchCount)
          : entry.qualityFallbackCount > 0
            ? toRoundedScore(entry.qualityFallbackSum / entry.qualityFallbackCount)
            : 100;

      const costScore =
        entry.costCount > 0 ? toRoundedScore(entry.costSum / entry.costCount) : toRoundedScore(qualityScore);

      const globalScore = toRoundedScore(
        computeSupplierGlobalScore({
          qualityScore,
          deliveryScore,
          costScore,
        })
      );

      return {
        supplierId: entry.supplierId,
        supplierName: entry.supplierName || UNKNOWN_SUPPLIER_LABEL,
        qualityScore,
        deliveryScore,
        costScore,
        globalScore,
        scoreBand: getSupplierScoreBand(globalScore),
        totalOrdersCount: entry.totalOrdersCount,
        deliveredOrdersCount: entry.deliveredOrdersCount,
        matchedInvoicesCount: entry.matchedInvoicesCount,
        evaluatedAt: entry.latestEvaluationDate,
        source: 'fallback',
      };
    })
    .sort((a, b) => b.globalScore - a.globalScore || a.supplierName.localeCompare(b.supplierName));
};

const normalizePersistedBand = (value, globalScore) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (['A', 'B', 'C', 'D', 'E'].includes(normalized)) return normalized;
  return getSupplierScoreBand(globalScore);
};

export const useSupplierReports = () => {
  const { user } = useAuth();
  const { applyCompanyScope } = useCompanyScope();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(createEmptyReportData());

  const generateReports = useCallback(
    async (_period = 'month', supplierId = null) => {
      if (!user) {
        setReportData(createEmptyReportData());
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let ordersQuery = supabase
          .from('supplier_orders')
          .select(
            'id, supplier_id, order_number, order_date, expected_delivery_date, actual_delivery_date, order_status, total_amount, created_at'
          );

        let invoicesQuery = supabase
          .from('supplier_invoices')
          .select(
            'id, supplier_id, invoice_number, invoice_date, total_amount, total_ttc, three_way_match_status, three_way_match_score, created_at'
          );
        let suppliersQuery = supabase.from('suppliers').select('id, company_name, contact_person, email');
        let threeWayMatchesQuery = supabase
          .from('supplier_invoice_three_way_matches')
          .select(
            'supplier_invoice_id, match_score, amount_variance, ordered_total_amount, invoiced_total_amount, matched_at, updated_at'
          );
        let supplierScoresQuery = supabase
          .from('supplier_performance_scores')
          .select(
            'supplier_id, quality_score, delivery_score, cost_score, global_score, score_band, total_orders_count, delivered_orders_count, matched_invoices_count, evaluated_at, updated_at'
          );

        ordersQuery = applyCompanyScope(ordersQuery);
        invoicesQuery = applyCompanyScope(invoicesQuery);
        suppliersQuery = applyCompanyScope(suppliersQuery);
        threeWayMatchesQuery = applyCompanyScope(threeWayMatchesQuery);
        supplierScoresQuery = applyCompanyScope(supplierScoresQuery);

        if (supplierId) {
          ordersQuery = ordersQuery.eq('supplier_id', supplierId);
          invoicesQuery = invoicesQuery.eq('supplier_id', supplierId);
          suppliersQuery = suppliersQuery.eq('id', supplierId);
          supplierScoresQuery = supplierScoresQuery.eq('supplier_id', supplierId);
        }

        const _results = await Promise.allSettled([
          ordersQuery,
          invoicesQuery,
          suppliersQuery,
          threeWayMatchesQuery,
          supplierScoresQuery,
        ]);

        _results.forEach((r, i) => {
          if (r.status === 'rejected') console.error(`SupplierReports fetch ${i} failed:`, r.reason);
        });

        const ordersRes = _results[0].status === 'fulfilled' ? _results[0].value : { data: null, error: null };
        const invoicesRes = _results[1].status === 'fulfilled' ? _results[1].value : { data: null, error: null };
        const suppliersRes = _results[2].status === 'fulfilled' ? _results[2].value : { data: null, error: null };
        const matchesRes = _results[3].status === 'fulfilled' ? _results[3].value : { data: null, error: null };
        const supplierScoresRes = _results[4].status === 'fulfilled' ? _results[4].value : { data: null, error: null };

        const { data: orders, error: ordersError } = ordersRes;
        const { data: invoices, error: invoicesError } = invoicesRes;
        const { data: suppliers, error: suppliersError } = suppliersRes;
        const { data: threeWayMatches, error: threeWayMatchesError } = matchesRes;
        const { data: supplierScores, error: supplierScoresError } = supplierScoresRes;

        if (ordersError) {
          console.warn('Supplier orders unavailable for reports:', ordersError.message);
        }

        if (invoicesError) {
          console.warn('Supplier invoices unavailable for reports:', invoicesError.message);
        }

        if (suppliersError) {
          console.warn('Suppliers unavailable for reports:', suppliersError.message);
        }

        if (threeWayMatchesError) {
          console.warn('3-way match details unavailable for reports:', threeWayMatchesError.message);
        }

        if (supplierScoresError) {
          console.warn('Supplier performance scores unavailable for reports:', supplierScoresError.message);
        }

        if (ordersError && invoicesError && suppliersError) {
          throw ordersError;
        }

        const safeOrders = orders || [];
        const safeInvoices = invoices || [];
        const safeSuppliers = suppliers || [];
        const safeThreeWayMatches = threeWayMatches || [];
        const safePersistedScores = supplierScores || [];
        const spendingSource = safeInvoices.length > 0 ? safeInvoices : safeOrders;

        // 1. Spending over time
        const spendingMap = {};
        spendingSource.forEach((entry) => {
          const date =
            entry.invoice_date?.split('T')[0] || entry.order_date?.split('T')[0] || entry.created_at?.split('T')[0];

          if (!date) return;

          const month = date.substring(0, 7); // YYYY-MM
          const amount = Number(entry.total_amount || entry.total_ttc || 0);
          spendingMap[month] = (spendingMap[month] || 0) + amount;
        });

        const spending = Object.entries(spendingMap)
          .map(([date, amount]) => ({ date, amount }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // 2. Orders count
        const ordersCount = safeOrders.length;

        // 3. Delivery Performance
        let onTimeCount = 0;
        const delivery = safeOrders
          .filter((order) => order.actual_delivery_date && order.expected_delivery_date)
          .map((order) => {
            const expected = toDateOnly(order.expected_delivery_date);
            const actual = toDateOnly(order.actual_delivery_date);

            if (!expected || !actual) {
              return null;
            }

            const varianceDays = Math.round((actual.getTime() - expected.getTime()) / DAY_IN_MS);
            let timing = 'onTime';

            if (varianceDays < 0) {
              timing = 'early';
            } else if (varianceDays > 0) {
              timing = 'late';
            } else {
              onTimeCount += 1;
            }

            return {
              order: order.order_number,
              varianceDays,
              timing,
            };
          })
          .filter(Boolean);

        const onTimeRate = delivery.length > 0 ? Math.round((onTimeCount / delivery.length) * 100) : 0;

        const fallbackSupplierScores = deriveFallbackSupplierScores({
          suppliers: safeSuppliers,
          orders: safeOrders,
          invoices: safeInvoices,
          threeWayMatches: safeThreeWayMatches,
          supplierFilterId: supplierId,
        });

        const fallbackMap = new Map(fallbackSupplierScores.map((entry) => [entry.supplierId, entry]));
        const supplierScoresData =
          safePersistedScores.length > 0
            ? safePersistedScores
                .map((entry) => {
                  const supplierIdKey = entry?.supplier_id;
                  const fallback = fallbackMap.get(supplierIdKey);
                  const supplierName =
                    fallback?.supplierName ||
                    safeSuppliers.find((supplier) => supplier.id === supplierIdKey)?.company_name ||
                    UNKNOWN_SUPPLIER_LABEL;

                  const qualityScore = toRoundedScore(entry.quality_score);
                  const deliveryScore = toRoundedScore(entry.delivery_score);
                  const costScore = toRoundedScore(entry.cost_score);
                  const computedGlobalScore = toRoundedScore(
                    computeSupplierGlobalScore({
                      qualityScore,
                      deliveryScore,
                      costScore,
                    })
                  );
                  const globalScore = toRoundedScore(entry.global_score || computedGlobalScore);

                  return {
                    supplierId: supplierIdKey,
                    supplierName,
                    qualityScore,
                    deliveryScore,
                    costScore,
                    globalScore,
                    scoreBand: normalizePersistedBand(entry.score_band, globalScore),
                    totalOrdersCount: Number(entry.total_orders_count || fallback?.totalOrdersCount || 0),
                    deliveredOrdersCount: Number(entry.delivered_orders_count || fallback?.deliveredOrdersCount || 0),
                    matchedInvoicesCount: Number(entry.matched_invoices_count || fallback?.matchedInvoicesCount || 0),
                    evaluatedAt: entry.evaluated_at || entry.updated_at || fallback?.evaluatedAt || null,
                    source: 'db',
                  };
                })
                .filter((entry) => entry.supplierId)
                .sort((a, b) => b.globalScore - a.globalScore || a.supplierName.localeCompare(b.supplierName))
            : fallbackSupplierScores;

        setReportData({
          spending,
          ordersCount,
          totalSpent: spendingSource.reduce(
            (sum, entry) => sum + Number(entry.total_amount || entry.total_ttc || 0),
            0
          ),
          orders: safeOrders,
          delivery,
          onTimeRate,
          products: [],
          supplierScores: supplierScoresData,
        });
      } catch (err) {
        console.error('Report generation failed:', err);
        setError(err.message || 'Failed to generate reports');
        setReportData(createEmptyReportData());
      } finally {
        setLoading(false);
      }
    },
    [applyCompanyScope, user]
  );

  return {
    loading,
    error,
    reportData,
    generateReports,
  };
};
