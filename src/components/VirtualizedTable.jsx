import { memo, useCallback, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';

/**
 * VirtualizedTable — renders rows via react-window when item count exceeds a threshold.
 * Falls back to normal rendering for small lists (no overhead).
 *
 * Two modes:
 *   A) Column-based: pass `columns` array, rows rendered as flex divs
 *   B) Custom row: pass `renderRow(item, index, style)` for full control
 *
 * Props (common):
 *  - data: array of objects
 *  - rowHeight: pixel height per row (default 56)
 *  - maxHeight: max container height in px (default 700)
 *  - threshold: skip virtualization below this count (default 30)
 *  - emptyMessage: shown when data is empty
 *  - className: wrapper className
 *
 * Props (column mode):
 *  - columns: [{ key, header, width?, flex?, render? }]
 *  - onRowClick: (item) => void
 *
 * Props (custom mode):
 *  - renderRow: (item, index, style) => ReactNode
 *  - header: ReactNode (e.g. <thead>...</thead> wrapped in a <table>)
 */
const VirtualizedTable = ({
  data = [],
  columns,
  renderRow: customRenderRow,
  header,
  rowHeight = 56,
  maxHeight = 700,
  threshold = 30,
  onRowClick,
  emptyMessage = 'Aucune donnée',
  className = '',
}) => {
  const listRef = useRef(null);
  const isCustomMode = typeof customRenderRow === 'function';

  // ----- Column-mode row renderer -----
  const columnRow = useCallback(({ index, style }) => {
    const item = data[index];
    if (!item) return null;
    return (
      <div
        style={style}
        className={`flex items-center border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
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
            {col.render ? col.render(item) : item[col.key] || '—'}
          </div>
        ))}
      </div>
    );
  }, [data, columns, onRowClick]);

  // ----- Custom-mode row renderer -----
  const customRow = useCallback(({ index, style }) => {
    const item = data[index];
    if (!item) return null;
    return customRenderRow(item, index, style);
  }, [data, customRenderRow]);

  // ----- Empty state -----
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const listHeight = Math.min(data.length * rowHeight, maxHeight);
  const Row = isCustomMode ? customRow : columnRow;

  // ----- Below threshold: render without virtualization -----
  if (data.length < threshold) {
    if (isCustomMode) {
      return (
        <div className={className}>
          {header}
          {data.map((item, index) => customRenderRow(item, index, undefined))}
        </div>
      );
    }
    // Column mode fallback
    return (
      <div className={`w-full ${className}`}>
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
        {data.map((item, index) => (
          <div
            key={item.id || index}
            className={`flex items-center border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
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
                {col.render ? col.render(item) : item[col.key] || '—'}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // ----- Virtualized rendering -----
  if (isCustomMode) {
    return (
      <div className={className}>
        {header}
        <List
          ref={listRef}
          height={listHeight}
          itemCount={data.length}
          itemSize={rowHeight}
          width="100%"
          overscanCount={5}
        >
          {Row}
        </List>
      </div>
    );
  }

  // Column mode virtualized
  return (
    <div className={`w-full ${className}`}>
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
      <List
        ref={listRef}
        height={listHeight}
        itemCount={data.length}
        itemSize={rowHeight}
        width="100%"
        overscanCount={5}
      >
        {Row}
      </List>
    </div>
  );
};

export default memo(VirtualizedTable);
