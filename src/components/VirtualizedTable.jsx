import React, { useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';

const VirtualizedTable = ({
  data = [],
  columns = [],
  rowHeight = 48,
  maxHeight = 600,
  onRowClick,
  emptyMessage = 'Aucune donn\u00e9e',
}) => {
  const Row = useCallback(({ index, style }) => {
    const item = data[index];
    if (!item) return null;

    return (
      <div
        style={style}
        className={`flex items-center border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
          onRowClick ? 'cursor-pointer' : ''
        }`}
        onClick={() => onRowClick?.(item)}
      >
        {columns.map((col, colIdx) => (
          <div
            key={colIdx}
            className="px-4 py-2 text-sm text-gray-300 truncate"
            style={{ width: col.width || 'auto', flex: col.flex || 1 }}
          >
            {col.render ? col.render(item) : item[col.key] || '-'}
          </div>
        ))}
      </div>
    );
  }, [data, columns, onRowClick]);

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const listHeight = Math.min(data.length * rowHeight, maxHeight);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center bg-gray-800/50 border-b border-gray-700 sticky top-0 z-10">
        {columns.map((col, idx) => (
          <div
            key={idx}
            className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider"
            style={{ width: col.width || 'auto', flex: col.flex || 1 }}
          >
            {col.header || col.key}
          </div>
        ))}
      </div>

      {/* Virtualized rows */}
      <List
        height={listHeight}
        itemCount={data.length}
        itemSize={rowHeight}
        width="100%"
      >
        {Row}
      </List>
    </div>
  );
};

export default VirtualizedTable;
