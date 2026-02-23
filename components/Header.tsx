
import React from 'react';
import { ShopSettings, Mechanic } from '../types';

interface HeaderProps {
  settings: ShopSettings;
  mechanic: Mechanic;
  onOpenAi: () => void;
}

const Header: React.FC<HeaderProps> = ({ settings, mechanic, onOpenAi }) => {
  return (
    <header className="bg-[#1E293B] border-b border-slate-700 py-6 px-10 flex items-center justify-between sticky top-0 z-30 shadow-lg">
      <div className="flex items-center gap-8">
        <div>
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Bienvenido, Maestro</h2>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white italic">{mechanic.name}</h1>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
          </div>
        </div>
        
        <div className="hidden xl:flex h-10 w-px bg-slate-700"></div>
        
        <div className="hidden xl:flex items-center gap-8 text-[11px] font-black text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-calendar-day text-amber-500"></i>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
          </div>
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-phone-volume text-amber-500"></i>
            Soporte: {settings.phone}
          </div>
        </div>
      </div>
      
      <button 
        onClick={onOpenAi}
        className="flex items-center gap-4 px-8 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase italic tracking-tighter hover:bg-slate-800 transition-all shadow-2xl border border-slate-700 active:scale-95 group"
      >
        <div className="flex gap-1 items-center">
          <span className="w-1 h-3 bg-amber-500 rounded-full animate-bounce"></span>
          <span className="w-1 h-4 bg-amber-500 rounded-full animate-bounce [animation-delay:0.1s]"></span>
          <span className="w-1 h-3 bg-amber-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
        </div>
        Pedir a la IA
      </button>
    </header>
  );
};

export default Header;
