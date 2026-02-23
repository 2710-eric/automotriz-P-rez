
import React from 'react';
import { Product } from '../types';

interface InventoryTableProps {
  products: Product[];
  onDelete: (id: string) => void;
  onDecrement: (id: string) => void;
  onEdit: (product: Product) => void;
  lowStockThreshold: number;
}

const InventoryTable: React.FC<InventoryTableProps> = ({ products, onDelete, onDecrement, onEdit, lowStockThreshold }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-900/50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
            <th className="px-8 py-5 border-b border-slate-700">Lubricante / Marca</th>
            <th className="px-8 py-5 border-b border-slate-700">Ubicación</th>
            <th className="px-8 py-5 border-b border-slate-700 text-center">Disponible</th>
            <th className="px-8 py-5 border-b border-slate-700 text-right">Control</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {products.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-8 py-20 text-center text-slate-600 font-bold uppercase tracking-widest italic">
                Sin existencias de aceite registradas.
              </td>
            </tr>
          ) : products.map((product) => {
            const isOutOfStock = product.quantity === 0;
            const isLowStock = !isOutOfStock && product.quantity <= lowStockThreshold;
            
            return (
              <tr key={product.id} className="hover:bg-slate-800/40 transition-all group">
                <td className="px-8 py-6">
                  <div>
                    <div className="font-black text-white text-sm italic group-hover:text-amber-500 transition-colors uppercase tracking-tight">
                      {product.brand}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        {product.liters}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-tighter">
                    <i className="fa-solid fa-box text-[10px] text-slate-600"></i>
                    {product.location}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex justify-center">
                    <div className={`w-14 h-11 rounded-xl flex flex-col items-center justify-center border shadow-2xl transition-transform group-hover:scale-110 ${
                      isOutOfStock ? 'bg-rose-600/20 border-rose-500 text-rose-500' : 
                      isLowStock ? 'bg-orange-600/20 border-orange-500 text-orange-500' : 
                      'bg-slate-900 border-slate-700 text-amber-500'
                    }`}>
                      <span className="text-lg font-black leading-none">{product.quantity}</span>
                      <span className="text-[7px] font-black uppercase tracking-widest mt-0.5">UNS</span>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex justify-end items-center gap-3">
                    <button
                      onClick={() => onDecrement(product.id)}
                      disabled={isOutOfStock}
                      className="h-11 px-5 rounded-2xl bg-amber-500 text-slate-900 text-[10px] font-black uppercase italic tracking-tighter hover:bg-amber-400 transition-all shadow-xl disabled:opacity-10 active:scale-90 flex items-center gap-2"
                    >
                      <i className="fa-solid fa-minus"></i> Usar
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(product)} className="p-3 text-slate-600 hover:text-amber-500 transition-colors">
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button onClick={() => onDelete(product.id)} className="p-3 text-slate-600 hover:text-rose-500 transition-colors">
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default InventoryTable;
