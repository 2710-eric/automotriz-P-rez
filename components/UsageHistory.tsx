
import React from 'react';
import { History } from 'lucide-react';
import { UsageLog } from '../types';

interface UsageHistoryProps {
  logs: UsageLog[];
}

const UsageHistory: React.FC<UsageHistoryProps> = ({ logs }) => {
  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h3 className="font-black text-slate-900 uppercase tracking-tighter text-base italic flex items-center gap-2">
            <History className="w-4 h-4 text-red-600" />
            Bitácora
          </h3>
          <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">Actividad técnica</p>
        </div>
        <div className="px-2 py-0.5 bg-slate-900 rounded-md text-[8px] font-black text-white uppercase tracking-widest">
          {logs.length} OPS
        </div>
      </div>
      
      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-black uppercase tracking-widest italic text-[9px]">
            Sin registros.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      log.action === 'CONSUMO' ? 'bg-red-600' : 
                      log.action === 'INGRESO' ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}></div>
                    <span className="font-black text-slate-800 text-[10px] uppercase italic">M. {log.usedBy}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${
                      log.action === 'CONSUMO' ? 'bg-red-50 text-red-600 border border-red-100' : 
                      log.action === 'INGRESO' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                      'bg-blue-50 text-blue-600 border border-blue-100'
                    }`}>
                      {log.action || 'CONSUMO'}
                    </span>
                    <span className="text-[8px] font-black text-slate-400 uppercase">
                      {new Date(log.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-black text-slate-600 uppercase italic truncate max-w-[120px]">{log.brand}</div>
                    <div className="text-[8px] text-slate-400 font-bold uppercase flex items-center gap-2">
                      {log.liters} 
                      <span className="text-slate-900 bg-slate-100 px-1 rounded">x{log.quantity}</span>
                    </div>
                  </div>
                  <div className="text-[9px] font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded-md">
                    {new Date(log.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UsageHistory;
