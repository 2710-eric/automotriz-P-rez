
import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductType, User, UsageLog } from './types';
import ConsumptionChart from './components/ConsumptionChart';
import UsageHistory from './components/UsageHistory';
import { Package, Droplets, Thermometer, History, TrendingUp } from 'lucide-react';

const LOW_STOCK_ALERT = 5;

const App: React.FC = () => {
  // Estados de Usuario
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [loginName, setLoginName] = useState('');

  // Estados de Inventario
  const [products, setProducts] = useState<Product[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estado del Formulario - Se añade 'location' por ser ahora requerido en la interfaz Product
  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    type: ProductType.ACEITE,
    brand: '',
    liters: '',
    quantity: 0,
    location: 'Principal'
  });

  // Carga inicial desde LocalStorage
  useEffect(() => {
    const savedProducts = localStorage.getItem('taller_perez_inventory');
    const savedUsers = localStorage.getItem('taller_perez_users');
    const savedLogs = localStorage.getItem('taller_perez_logs');
    const sessionUser = sessionStorage.getItem('taller_perez_current');

    if (savedProducts) setProducts(JSON.parse(savedProducts));
    if (savedUsers) setActiveUsers(JSON.parse(savedUsers));
    if (savedLogs) {
      setUsageLogs(JSON.parse(savedLogs));
    } else {
      // Mock data for the chart
      const mockLogs: UsageLog[] = [];
      const now = Date.now();
      const oneMonth = 30 * 24 * 60 * 60 * 1000;
      
      for (let i = 0; i < 20; i++) {
        const types = [ProductType.ACEITE, ProductType.REFRIGERANTE, ProductType.DESENGRASANTE];
        mockLogs.push({
          id: crypto.randomUUID(),
          usedBy: 'Sistema',
          brand: i % 3 === 0 ? 'Castrol' : i % 3 === 1 ? 'Prestone' : 'Wurth',
          type: types[i % 3],
          liters: '1L',
          timestamp: now - Math.random() * 5 * oneMonth
        });
      }
      setUsageLogs(mockLogs);
    }
    if (sessionUser) setCurrentUser(JSON.parse(sessionUser));
  }, []);

  // Guardar datos
  useEffect(() => {
    localStorage.setItem('taller_perez_inventory', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('taller_perez_users', JSON.stringify(activeUsers));
  }, [activeUsers]);

  useEffect(() => {
    localStorage.setItem('taller_perez_logs', JSON.stringify(usageLogs));
  }, [usageLogs]);

  // Manejo de Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim()) return;

    const newUser: User = {
      id: crypto.randomUUID(),
      name: loginName.trim(),
      lastActive: Date.now()
    };

    setCurrentUser(newUser);
    sessionStorage.setItem('taller_perez_current', JSON.stringify(newUser));
    
    // Actualizar lista de usuarios activos (evitar duplicados por nombre en esta demo)
    setActiveUsers(prev => {
      const filtered = prev.filter(u => u.name.toLowerCase() !== newUser.name.toLowerCase());
      return [newUser, ...filtered].slice(0, 5); // Mostrar últimos 5
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('taller_perez_current');
  };

  // Acciones de Inventario
  const handleAddOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brand || !formData.liters) return;

    if (editingId) {
      setProducts(prev => prev.map(p => p.id === editingId ? { ...formData, id: p.id } : p));
      setEditingId(null);
    } else {
      const newProduct: Product = { ...formData, id: crypto.randomUUID() };
      setProducts(prev => [newProduct, ...prev]);
    }

    setFormData({ type: ProductType.ACEITE, brand: '', liters: '', quantity: 0, location: 'Principal' });
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setFormData({
      type: product.type,
      brand: product.brand,
      liters: product.liters,
      quantity: product.quantity,
      location: product.location || 'Principal',
      notes: product.notes
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleUseProduct = (product: Product) => {
    if (product.quantity <= 0) {
      alert('No hay stock disponible para este producto.');
      return;
    }

    const newLog: UsageLog = {
      id: crypto.randomUUID(),
      usedBy: currentUser?.name || 'Desconocido',
      brand: product.brand,
      type: product.type,
      liters: product.liters,
      timestamp: Date.now()
    };

    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity - 1 } : p));
    setUsageLogs(prev => [newLog, ...prev]);
  };

  // Filtrado
  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.brand.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  // Pantalla de Login
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-red-600 p-8 text-center">
            <i className="fa-solid fa-car-side text-white text-5xl mb-4"></i>
            <h1 className="text-white text-3xl font-bold uppercase tracking-tighter">Automotriz Pérez</h1>
            <p className="text-red-100 text-sm italic">Servicio y calidad para tu vehículo</p>
          </div>
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 uppercase mb-2">Nombre del Mecánico / Personal</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-3 bg-slate-100 border-2 border-transparent focus:border-red-600 rounded-lg outline-none transition-all"
                placeholder="Ingresa tu nombre..."
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
              />
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white font-bold py-4 rounded-lg hover:bg-slate-800 transition-colors uppercase tracking-widest">
              Ingresar al Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Encabezado */}
      <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-red-600 p-2 rounded-lg">
              <i className="fa-solid fa-wrench text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold uppercase tracking-tight">Automotriz Pérez</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest hidden sm:block">Panel de Inventario Profesional</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-300">Usuario Activo</p>
                <p className="text-sm font-bold text-red-500">{currentUser.name}</p>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors">
                <i className="fa-solid fa-power-off text-lg"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Barra Lateral: Personal y Alertas */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <i className="fa-solid fa-users text-red-600"></i> Personal Activo
            </h3>
            <ul className="space-y-3">
              {activeUsers.map(user => (
                <li key={user.id} className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-sm font-bold text-slate-700">{user.name}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-amber-500"></i> Alertas de Stock
            </h3>
            <div className="space-y-2">
              {products.filter(p => p.quantity <= LOW_STOCK_ALERT).length === 0 ? (
                <p className="text-xs text-slate-400 italic">Todo en orden.</p>
              ) : (
                products.filter(p => p.quantity <= LOW_STOCK_ALERT).map(p => (
                  <div key={p.id} className="p-2 bg-amber-50 border-l-4 border-amber-500 text-[10px] font-bold text-amber-800">
                    BAJO STOCK: {p.brand} ({p.quantity} unid.)
                  </div>
                ))
              )}
            </div>
          </div>

          <UsageHistory logs={usageLogs} />
        </aside>

        {/* Sección Central: Inventario */}
        <div className="lg:col-span-9 space-y-8">
          
          {/* Formulario de Agregar */}
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold uppercase tracking-tight mb-6 flex items-center gap-3">
              <i className="fa-solid fa-plus-circle text-red-600"></i>
              {editingId ? 'Editar Producto' : 'Agregar al Inventario'}
            </h2>
            <form onSubmit={handleAddOrUpdate} className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Tipo</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-600 font-bold"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value as ProductType})}
                >
                  <option value={ProductType.ACEITE}>Aceite</option>
                  <option value={ProductType.REFRIGERANTE}>Refrigerante</option>
                  <option value={ProductType.DESENGRASANTE}>Desengrasante</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Marca</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej: Castrol, Prestone..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-600 font-bold"
                  value={formData.brand}
                  onChange={(e) => setFormData({...formData, brand: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Litros</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej: 1L, 4L, 5L"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-600 font-bold"
                  value={formData.liters}
                  onChange={(e) => setFormData({...formData, liters: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Cantidad</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    required
                    min="0"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-600 font-bold"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                  />
                  <button type="submit" className="bg-red-600 text-white px-6 rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20">
                    <i className="fa-solid fa-check"></i>
                  </button>
                </div>
              </div>
            </form>
            {editingId && (
              <button onClick={() => {setEditingId(null); setFormData({type: ProductType.ACEITE, brand:'', liters:'', quantity:0, location: 'Principal'});}} className="mt-4 text-xs font-bold text-slate-400 hover:text-red-600 uppercase">
                Cancelar edición
              </button>
            )}
          </section>

          {/* Tabla de Resultados */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-bold uppercase tracking-tight italic">
                Existencias en Almacén
              </h2>
              <div className="relative w-full md:w-64">
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input 
                  type="text" 
                  placeholder="Filtrar por marca..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-red-600 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Marca</th>
                    <th className="px-6 py-4">Litros</th>
                    <th className="px-6 py-4 text-center">Cantidad</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No hay productos que coincidan con la búsqueda.</td>
                    </tr>
                  ) : filteredProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${
                          p.type === ProductType.ACEITE ? 'bg-blue-100 text-blue-700' : 
                          p.type === ProductType.REFRIGERANTE ? 'bg-red-100 text-red-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700">{p.brand}</td>
                      <td className="px-6 py-4 font-medium text-slate-500">{p.liters}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block w-10 py-1 rounded-lg font-bold text-xs ${
                          p.quantity <= LOW_STOCK_ALERT ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {p.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleUseProduct(p)} 
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Registrar Uso"
                          >
                            <i className="fa-solid fa-hand-holding-droplet"></i>
                          </button>
                          <button onClick={() => handleEdit(p)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Gráfica de Consumo */}
          <ConsumptionChart logs={usageLogs} />
        </div>
      </main>

      <footer className="mt-auto bg-slate-900 py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">&copy; 2024 Automotriz Pérez - Gestión Interna de Inventario</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
