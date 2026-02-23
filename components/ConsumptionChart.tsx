
import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
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
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-red-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            Métricas
          </h3>
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5 ml-11">Rotación (6 meses)</p>
        </div>
      </div>

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 900 }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 900 }}
            />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ 
                borderRadius: '16px', 
                border: '1px solid #f1f5f9', 
                boxShadow: '0 15px 20px -5px rgb(0 0 0 / 0.1)',
                fontSize: '10px',
                fontWeight: '900',
                textTransform: 'uppercase',
                padding: '12px'
              }}
            />
            <Legend 
              verticalAlign="top" 
              align="right" 
              iconType="circle"
              wrapperStyle={{ paddingBottom: '20px', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}
            />
            <Bar 
              dataKey={ProductType.ACEITE} 
              name="Aceite" 
              fill="#ef4444" 
              radius={[4, 4, 0, 0]} 
              barSize={16}
            />
            <Bar 
              dataKey={ProductType.REFRIGERANTE} 
              name="Refrigerante" 
              fill="#3b82f6" 
              radius={[4, 4, 0, 0]} 
              barSize={16}
            />
            <Bar 
              dataKey={ProductType.DESENGRASANTE} 
              name="Desengrasante" 
              fill="#10b981" 
              radius={[4, 4, 0, 0]} 
              barSize={16}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ConsumptionChart;
