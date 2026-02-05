import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

const PaginationControls = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2">
      <div className="text-sm text-gray-400">
        {startItem}-{endItem} / {totalCount}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onGoToPage(1)}
          disabled={!hasPrevPage}
          className="text-gray-400 hover:text-white hover:bg-gray-800 h-8 w-8 p-0"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrevPage}
          disabled={!hasPrevPage}
          className="text-gray-400 hover:text-white hover:bg-gray-800 h-8 w-8 p-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {getPageNumbers().map((page) => (
          <Button
            key={page}
            variant="ghost"
            size="sm"
            onClick={() => onGoToPage(page)}
            className={`h-8 w-8 p-0 ${
              page === currentPage
                ? 'bg-orange-500/20 text-orange-400 font-bold'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {page}
          </Button>
        ))}

        <Button
          variant="ghost"
          size="sm"
          onClick={onNextPage}
          disabled={!hasNextPage}
          className="text-gray-400 hover:text-white hover:bg-gray-800 h-8 w-8 p-0"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onGoToPage(totalPages)}
          disabled={!hasNextPage}
          className="text-gray-400 hover:text-white hover:bg-gray-800 h-8 w-8 p-0"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onChangePageSize(Number(e.target.value))}
          className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-md px-2 py-1 focus:border-orange-500 focus:outline-none"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default PaginationControls;
