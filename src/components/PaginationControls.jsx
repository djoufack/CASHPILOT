import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

const PaginationControls = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  onGoToPage,
  onChangePageSize,
}) => {
  const { t } = useTranslation();

  if (totalCount === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <nav
      role="navigation"
      aria-label={t('pagination.navigation', 'Pagination')}
      className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 px-3 sm:px-4 bg-[#0a0e1a]/60 backdrop-blur-sm border-t border-gray-800/50 rounded-b-lg"
    >
      {/* Item count display */}
      <div className="text-xs sm:text-sm text-gray-400 order-2 sm:order-1">
        <span aria-live="polite">
          {t('pagination.showing', 'Affichage')} {startItem}-{endItem} {t('pagination.of', 'sur')} {totalCount} {t('pagination.items', 'elements')}
        </span>
      </div>

      {/* Page navigation buttons */}
      <div className="flex items-center gap-1 order-1 sm:order-2" role="group" aria-label={t('pagination.pageNavigation', 'Page navigation')}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onGoToPage(1)}
          disabled={!hasPrevPage}
          className="text-gray-400 hover:text-white hover:bg-gray-800 h-8 w-8 p-0"
          aria-label={t('pagination.first', 'Premier')}
          title={t('pagination.first', 'Premier')}
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrevPage}
          disabled={!hasPrevPage}
          className="text-gray-400 hover:text-white hover:bg-gray-800 h-8 w-8 p-0"
          aria-label={t('pagination.previous', 'Precedent')}
          title={t('pagination.previous', 'Precedent')}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {/* Page number buttons - hidden on very small screens */}
        <div className="hidden xs:flex items-center gap-1">
          {getPageNumbers().map((page) => (
            <Button
              key={page}
              variant="ghost"
              size="sm"
              onClick={() => onGoToPage(page)}
              className={`h-8 w-8 p-0 text-sm ${
                page === currentPage
                  ? 'bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              aria-label={`${t('pagination.page', 'Page')} ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </Button>
          ))}
        </div>

        {/* Compact page indicator for very small screens */}
        <span className="xs:hidden text-sm text-gray-400 px-2">
          {currentPage}/{totalPages}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNextPage}
          disabled={!hasNextPage}
          className="text-gray-400 hover:text-white hover:bg-gray-800 h-8 w-8 p-0"
          aria-label={t('pagination.next', 'Suivant')}
          title={t('pagination.next', 'Suivant')}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onGoToPage(totalPages)}
          disabled={!hasNextPage}
          className="text-gray-400 hover:text-white hover:bg-gray-800 h-8 w-8 p-0"
          aria-label={t('pagination.last', 'Dernier')}
          title={t('pagination.last', 'Dernier')}
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Page size selector */}
      <div className="flex items-center gap-2 order-3">
        <label htmlFor="page-size-select" className="sr-only">
          {t('pagination.perPage', 'Par page')}
        </label>
        <select
          id="page-size-select"
          value={pageSize}
          onChange={(e) => onChangePageSize(Number(e.target.value))}
          className="bg-[#0f1528] border border-gray-700 text-gray-300 text-xs sm:text-sm rounded-md px-2 py-1.5 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50 cursor-pointer"
          aria-label={t('pagination.perPage', 'Par page')}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} / {t('pagination.page', 'page')}
            </option>
          ))}
        </select>
      </div>
    </nav>
  );
};

export default PaginationControls;
