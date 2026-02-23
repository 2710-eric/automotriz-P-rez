
import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { UsageLog, ProductType } from '../types';

interface ConsumptionChartProps {
  logs: UsageLog[];
}

const ConsumptionChart: React.FC<ConsumptionChartProps> = ({ logs }) => {
  const data = useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    const last6Months = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last6Months.push({
        month: months[d.getMonth()],
        monthIdx: d.getMonth(),
        year: d.getFullYear(),
        [ProductType.ACEITE]: 0,
        [ProductType.REFRIGERANTE]: 0,
        [ProductType.DESENGRASANTE]: 0,
      });
    }

    logs.forEach(log => {
      const logDate = new Date(log.timestamp);
      const monthIdx = logDate.getMonth();
      const year = logDate.getFullYear();

      const monthData = last6Months.find(m => m.monthIdx === monthIdx && m.year === year);
      if (monthData) {
        monthData[log.type] = (monthData[log.type] || 0) + 1;
      }
    });

    return last6Months;
  }, [logs]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <i className="fa-solid fa-chart-column text-red-600"></i>
            Consumo Mensual
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Aceites, Refrigerantes y Desengrasantes (Últimos 6 meses)</p>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
            />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ 
                borderRadius: '12px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            />
            <Legend 
              verticalAlign="top" 
              align="right" 
              iconType="circle"
              wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
            />
            <Bar 
              dataKey={ProductType.ACEITE} 
              name="Aceite" 
              fill="#ef4444" 
              radius={[4, 4, 0, 0]} 
              barSize={15}
            />
            <Bar 
              dataKey={ProductType.REFRIGERANTE} 
              name="Refrigerante" 
              fill="#3b82f6" 
              radius={[4, 4, 0, 0]} 
              barSize={15}
            />
            <Bar 
              dataKey={ProductType.DESENGRASANTE} 
              name="Desengrasante" 
              fill="#10b981" 
              radius={[4, 4, 0, 0]} 
              barSize={15}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ConsumptionChart;
