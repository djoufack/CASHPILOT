
import React from 'react';
import { useResponsive } from '@/hooks/useResponsive';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Renders a table on desktop/tablet and cards on mobile.
 * 
 * @param {Array} data - Array of data objects
 * @param {Array} columns - Array of column definitions { header: string, accessor: string|function, className?: string }
 * @param {Function} renderCard - Function(item, index) returning JSX for mobile card view
 * @param {Function} onRowClick - Optional click handler for rows
 * @param {boolean} loading - Loading state
 */
const ResponsiveTable = ({ 
  data, 
  columns, 
  renderCard, 
  onRowClick,
  loading,
  emptyMessage = "No data available"
}) => {
  const { isMobile } = useResponsive();

  if (loading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="p-8 text-center text-gray-500 bg-gray-900/50 rounded-lg border border-gray-800 border-dashed">{emptyMessage}</div>;
  }

  if (isMobile && renderCard) {
    return (
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index} onClick={() => onRowClick && onRowClick(item)}>
            {renderCard(item, index)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-800 bg-gray-900 overflow-hidden overflow-x-auto">
      <Table>
        <TableHeader className="bg-gray-800">
          <TableRow>
            {columns.map((col, idx) => (
              <TableHead key={idx} className={`text-gray-300 ${col.className || ''}`}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, rowIdx) => (
            <TableRow 
              key={rowIdx} 
              className={`border-gray-800 hover:bg-gray-800/50 ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick && onRowClick(item)}
            >
              {columns.map((col, colIdx) => (
                <TableCell key={colIdx} className={col.className || ''}>
                  {typeof col.accessor === 'function' ? col.accessor(item) : item[col.accessor]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ResponsiveTable;
