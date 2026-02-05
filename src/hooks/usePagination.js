import { useState, useCallback, useMemo } from 'react';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Generic cursor-based pagination hook for Supabase queries.
 * Usage: const pagination = usePagination({ pageSize: 20 });
 * Then in your query: query.range(pagination.from, pagination.to)
 * After query: pagination.setTotalCount(count);
 */
export const usePagination = (options = {}) => {
  const { pageSize: initialPageSize = DEFAULT_PAGE_SIZE } = options;

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize]
  );

  const from = useMemo(() => (currentPage - 1) * pageSize, [currentPage, pageSize]);
  const to = useMemo(() => from + pageSize - 1, [from, pageSize]);

  const goToPage = useCallback((page) => {
    const target = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(target);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) setCurrentPage(p => p + 1);
  }, [currentPage, totalPages]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) setCurrentPage(p => p - 1);
  }, [currentPage]);

  const changePageSize = useCallback((newSize) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page
  }, []);

  const reset = useCallback(() => {
    setCurrentPage(1);
    setTotalCount(0);
  }, []);

  return {
    currentPage,
    pageSize,
    totalCount,
    totalPages,
    from,
    to,
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
    setTotalCount,
    reset,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    // Helper for Supabase: add to select() options
    rangeArgs: { from, to },
  };
};

export default usePagination;
