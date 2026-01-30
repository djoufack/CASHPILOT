
import React from 'react';
import { useProjectStatistics } from '@/hooks/useProjectStatistics';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const ProjectStatistics = ({ tasks }) => {
  const stats = useProjectStatistics(tasks);
  
  const COLORS = ['#10b981', '#3b82f6', '#9ca3af']; // Completed, In Progress, Pending

  if (!tasks) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-sm">Total Tasks</p>
          <p className="text-2xl font-bold text-gradient">{stats.total}</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-sm">Completed</p>
          <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-sm">Overdue</p>
          <p className="text-2xl font-bold text-red-500">{stats.overdue}</p>
        </div>
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-sm">Completion Rate</p>
          <p className="text-2xl font-bold text-gradient">{stats.completionPercentage}%</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-400">
           <span>Progress</span>
           <span>{stats.completionPercentage}%</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${stats.completionPercentage}%` }}
            className="h-full bg-gradient-to-r from-yellow-400 via-amber-300 to-lime-400"
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900 p-3 md:p-4 rounded-xl border border-gray-800 h-[250px] md:h-[300px]">
          <h3 className="text-gradient font-semibold mb-4">Task Status Distribution</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {stats.chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 p-3 md:p-4 rounded-xl border border-gray-800 h-[250px] md:h-[300px]">
          <h3 className="text-gradient font-semibold mb-4">Tasks by Priority</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { name: 'High', value: stats.byPriority.high },
                { name: 'Medium', value: stats.byPriority.medium },
                { name: 'Low', value: stats.byPriority.low },
              ]}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                cursor={{ fill: '#374151', opacity: 0.2 }}
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]}>
                {
                  [
                    { name: 'High', fill: '#ef4444' },
                    { name: 'Medium', fill: '#f59e0b' },
                    { name: 'Low', fill: '#10b981' },
                  ].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))
                }
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ProjectStatistics;
