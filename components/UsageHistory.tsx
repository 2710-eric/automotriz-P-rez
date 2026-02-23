
import React from 'react';
import { UsageLog } from '../types';

interface UsageHistoryProps {
  logs: UsageLog[];
}

const UsageHistory: React.FC<UsageHistoryProps> = ({ logs }) => {
  return (
    <div className="bg-[#1E293B] rounded-3xl border border-slate-700 shadow-xl overflow-hidden">
      <div className="p-8 border-b border-slate-700 flex items-center justify-between bg-slate-800/20">
        <div>
          <h3 className="font-black text-slate-100 uppercase tracking-tighter text-lg italic">Historial de Consumo</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Últimos movimientos de aceites</p>
        </div>
        <div className="px-3 py-1 bg-slate-900 rounded-lg border border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {logs.length} Movimientos
        </div>
      </div>
      
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-600 font-bold uppercase tracking-widest italic text-xs">
            No se han registrado retiros de aceite todavía.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/30 text-slate-500 uppercase text-[9px] font-black tracking-widest">
                <th className="px-8 py-4 border-b border-slate-700">Maestro</th>
                <th className="px-8 py-4 border-b border-slate-700">Producto Utilizado</th>
                <th className="px-8 py-4 border-b border-slate-700">Fecha y Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                      <span className="font-bold text-slate-200 text-xs">Maestro {log.usedBy}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="text-xs font-bold text-white uppercase italic">{log.brand}</div>
                    <div className="text-[9px] text-slate-500 font-black uppercase mt-0.5">{log.liters}</div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="text-[10px] font-bold text-slate-400">
                      {new Date(log.timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} - {new Date(log.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default UsageHistory;
