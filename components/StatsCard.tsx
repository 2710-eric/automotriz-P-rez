
import React from 'react';

interface StatsCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
  isAlert?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color, isAlert }) => {
  return (
    <div className={`p-6 rounded-[1.5rem] border transition-all shadow-lg ${
      isAlert ? 'bg-rose-600/10 border-rose-500/50' : 'bg-[#1E293B] border-slate-700'
    }`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{title}</h4>
          <p className={`text-3xl font-black italic tracking-tighter ${isAlert ? 'text-rose-500' : 'text-white'}`}>
            {value}
          </p>
        </div>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner bg-slate-900 border border-slate-800 ${color}`}>
          <i className={`fa-solid ${icon}`}></i>
        </div>
      </div>
      {isAlert && value > 0 && (
        <div className="mt-3 flex items-center gap-2 text-[8px] font-black text-rose-500 uppercase tracking-[0.2em] animate-pulse">
          <i className="fa-solid fa-triangle-exclamation"></i>
          Revisar Stock
        </div>
      )}
    </div>
  );
};

export default StatsCard;
