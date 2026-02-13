import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Generic cursor-based pagination hook for Supabase queries.
 * Uses Supabase .range() with exact count for efficient server-side pagination.
 *
 * @param {Object} options
 * @param {string} options.table - Supabase table name
 * @param {number} [options.pageSize=25] - Items per page
 * @param {string} [options.orderBy='created_at'] - Column to order by
 * @param {boolean} [options.orderAsc=false] - Ascending order
 * @param {Object} [options.filters={}] - Filters as { column: value }
 * @param {string} [options.select='*'] - Columns to select (can include relations)
 * @param {string|null} [options.userId=null] - Filter by user_id if provided
 * @param {boolean} [options.enabled=true] - Whether to fetch automatically
 */
export const useCursorPagination = ({
  table,
  pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
  orderBy = 'created_at',
  orderAsc = false,
  filters = {},
  select = '*',
  userId = null,
  enabled = true,
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalCount, setTotalCount] = useState(0);

  // Use ref to track latest filters to avoid stale closures
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize]
  );

  const hasMore = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  const from = useMemo(() => (currentPage - 1) * pageSize, [currentPage, pageSize]);
  const to = useMemo(() => from + pageSize - 1, [from, pageSize]);

  const fetchPage = useCallback(async (page = currentPage) => {
    if (!supabase || !table) return;

    setLoading(true);
    setError(null);

    try {
      const rangeFrom = (page - 1) * pageSize;
      const rangeTo = rangeFrom + pageSize - 1;

      let query = supabase
        .from(table)
        .select(select, { count: 'exact' })
        .order(orderBy, { ascending: orderAsc })
        .range(rangeFrom, rangeTo);

      // Apply user_id filter if provided
      if (userId) {
        query = query.eq('user_id', userId);
      }

      // Apply additional filters
      const currentFilters = filtersRef.current;
      Object.entries(currentFilters).forEach(([column, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          query = query.eq(column, value);
        }
      });

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      setItems(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      // Handle RLS recursion (42P17) or permission (42501) errors gracefully
      if (err.code === '42P17' || err.code === '42501') {
        console.warn(`RLS policy error fetching ${table}:`, err.message);
        setItems([]);
        setTotalCount(0);
        return;
      }
      setError(err.message);
      console.error(`Error fetching paginated ${table}:`, err);
    } finally {
      setLoading(false);
    }
  }, [table, pageSize, orderBy, orderAsc, select, userId, currentPage]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(p => p + 1);
    }
  }, [currentPage, totalPages]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(p => p - 1);
    }
  }, [currentPage]);

  const goToPage = useCallback((page) => {
    const target = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(target);
  }, [totalPages]);

  const changePageSize = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  const refresh = useCallback(() => {
    fetchPage(currentPage);
  }, [fetchPage, currentPage]);

  // Auto-fetch on page change
  useEffect(() => {
    if (enabled) {
      fetchPage(currentPage);
    }
  }, [currentPage, pageSize, enabled]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (enabled) {
      setCurrentPage(1);
      fetchPage(1);
    }
  }, [JSON.stringify(filters), userId, enabled]);

  return {
    items,
    loading,
    error,
    hasMore,
    hasPrev,
    currentPage,
    totalPages,
    totalCount,
    nextPage,
    prevPage,
    goToPage,
    refresh,
    pageSize,
    setPageSize: changePageSize,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    // Helpers for compatibility with PaginationControls
    hasNextPage: hasMore,
    hasPrevPage: hasPrev,
    changePageSize,
    from,
    to,
  };
};

export default useCursorPagination;
