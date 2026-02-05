import React from 'react';
import { useBankConnections } from '@/hooks/useBankConnections';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Building2, TrendingUp } from 'lucide-react';

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#ec4899'];

const BankAggregationView = () => {
  const { connections, totalBalance } = useBankConnections();

  const activeConnections = connections.filter(c => c.status === 'active' && c.account_balance != null);

  const chartData = activeConnections.map((conn, i) => ({
    name: conn.account_name || conn.institution_name || `Compte ${i + 1}`,
    value: Math.abs(parseFloat(conn.account_balance)),
    balance: parseFloat(conn.account_balance),
    currency: conn.account_currency || 'EUR',
  }));

  if (activeConnections.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        Aucun compte actif
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-orange-400" />
          <span className="text-lg font-bold text-white">{totalBalance.toFixed(2)} €</span>
        </div>
        <span className="text-xs text-gray-500">{activeConnections.length} compte(s)</span>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }}
            formatter={(value, name) => [`${value.toFixed(2)}€`, name]}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-2">
        {chartData.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-gray-300 truncate max-w-[150px]">{item.name}</span>
            </div>
            <span className={item.balance >= 0 ? 'text-green-400' : 'text-red-400'}>
              {item.balance.toFixed(2)} {item.currency}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BankAggregationView;
