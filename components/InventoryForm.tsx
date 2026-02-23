
import React, { useState, useEffect } from 'react';
import { Product, ProductType } from '../types';

interface InventoryFormProps {
  onSubmit: (product: Omit<Product, 'id' | 'lastUpdated'>) => void;
  editingProduct: Product | null;
  onCancelEdit: () => void;
}

const InventoryForm: React.FC<InventoryFormProps> = ({ onSubmit, editingProduct, onCancelEdit }) => {
  const [brand, setBrand] = useState('');
  const [liters, setLiters] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editingProduct) {
      setBrand(editingProduct.brand);
      setLiters(editingProduct.liters);
      setQuantity(editingProduct.quantity);
      setLocation(editingProduct.location);
      setNotes(editingProduct.notes || '');
    } else {
      setBrand(''); setLiters(''); setQuantity(0); setLocation(''); setNotes('');
    }
  }, [editingProduct]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !location) return;
    onSubmit({ 
      type: ProductType.ACEITE, 
      brand, 
      liters, 
      quantity, 
      location, 
      notes: notes.trim() || undefined 
    });
    if (!editingProduct) {
      setBrand(''); setLiters(''); setQuantity(0); setLocation(''); setNotes('');
    }
  };

  return (
    <div className="bg-[#1E293B] rounded-[2rem] border border-slate-700 p-8 sticky top-32 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <i className="fa-solid fa-oil-can text-8xl text-white"></i>
      </div>

      <div className="mb-8 relative z-10">
        <h3 className="font-black text-slate-100 uppercase italic tracking-tighter text-xl flex items-center gap-3">
          <span className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-slate-900 shadow-lg shadow-amber-500/20">
            {editingProduct ? <i className="fa-solid fa-pen"></i> : <i className="fa-solid fa-plus"></i>}
          </span>
          {editingProduct ? 'Editar Stock' : 'Alta de Aceite'}
        </h3>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
          Control de Lubricantes
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 ml-1">Marca del Aceite</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full px-5 py-3.5 bg-slate-900 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none text-white font-bold transition-all placeholder:text-slate-700 shadow-inner"
              placeholder="Ej: Castrol Edge 5W-30"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 ml-1">Presentación</label>
              <input
                type="text"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                className="w-full px-5 py-3.5 bg-slate-900 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none text-white font-bold transition-all placeholder:text-slate-700 shadow-inner"
                placeholder="Ej: 1 Litro / 4.7L"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 ml-1">Stock Actual</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="w-full px-5 py-3.5 bg-slate-900 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none text-white font-bold transition-all shadow-inner"
                min="0"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 ml-1">Ubicación Estantería</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-5 py-3.5 bg-slate-900 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none text-white font-bold transition-all placeholder:text-slate-700 shadow-inner"
              placeholder="Ej: Pasillo 1, Nivel 3"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 ml-1">Especificaciones Técnicas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-5 py-3 bg-slate-900 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none text-white font-bold transition-all placeholder:text-slate-700 shadow-inner min-h-[80px] resize-none text-xs"
              placeholder="Ej: API SP, ILSAC GF-6A..."
            />
          </div>
        </div>

        <div className="pt-4 space-y-3">
          <button
            type="submit"
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-2xl font-black uppercase italic tracking-tighter text-sm shadow-xl shadow-amber-500/10 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {editingProduct ? 'Actualizar Almacén' : 'Registrar Nuevo Aceite'}
          </button>
          
          {editingProduct && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="w-full py-3 bg-transparent border border-slate-700 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 hover:text-slate-300 transition-all"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default InventoryForm;
