
import React, { useState } from 'react';

interface LoginProps {
  onLogin: (name: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) return;
    onLogin(name.trim());
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 font-sans">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>
      
      <div className="max-w-md w-full bg-[#1E293B] rounded-[2.5rem] p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-slate-700 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-2 bg-amber-500"></div>
        
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-amber-500/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
            <i className="fa-solid fa-car-on text-slate-900 text-4xl"></i>
          </div>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">Automotriz Pérez</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">Control de Maestros</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest block ml-2">¿Quién está en turno?</label>
            <div className="relative">
              <i className="fa-solid fa-user-gear absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"></i>
              <input
                autoFocus
                type="text"
                placeholder="Nombre del Maestro..."
                className="w-full pl-14 pr-6 py-5 bg-slate-900 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none text-white font-bold transition-all placeholder:text-slate-700 shadow-inner"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-5 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-2xl font-black uppercase italic tracking-tighter text-lg shadow-xl shadow-amber-500/10 transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            Entrar al Sistema <i className="fa-solid fa-arrow-right-to-bracket"></i>
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-slate-800 text-center">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Uso exclusivo para personal del taller</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
