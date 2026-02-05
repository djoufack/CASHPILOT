
import React from 'react';
import { GripVertical, X, Maximize2, Minimize2 } from 'lucide-react';

const DashboardWidget = ({
  title,
  icon: Icon,
  children,
  className = '',
  onRemove,
  collapsible = true,
  defaultCollapsed = false,
}) => {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  return (
    <div className={`bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/30">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-600 cursor-grab" />
          {Icon && <Icon className="w-4 h-4 text-orange-400" />}
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          {collapsible && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-gray-500 hover:text-white p-1"
            >
              {collapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove} className="text-gray-500 hover:text-red-400 p-1">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default DashboardWidget;
