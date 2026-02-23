
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { Product, ProductType, User, UsageLog, ShopSettings, Mechanic } from './types';
import ConsumptionChart from './components/ConsumptionChart';
import UsageHistory from './components/UsageHistory';
import AIAssistant from './components/AIAssistant';
import { Package, Droplets, Thermometer, History, TrendingUp, AlertTriangle, Users, Plus, Search, LogOut, Bot, LayoutDashboard } from 'lucide-react';

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
  const [isAiOpen, setIsAiOpen] = useState(false);

  // Configuración del Taller (Mock)
  const [shopSettings] = useState<ShopSettings>({ phone: '555-0123' });

  // Estado del Formulario - Se añade 'location' por ser ahora requerido en la interfaz Product
  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    type: ProductType.ACEITE,
    brand: '',
    liters: '',
    quantity: 0,
    location: 'Principal'
  });

  const socketRef = useRef<Socket | null>(null);

  // WebSocket Connection
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('init', ({ products, activeUsers, usageLogs }) => {
      setProducts(products);
      setActiveUsers(activeUsers);
      setUsageLogs(usageLogs);
    });

    socket.on('inventory:sync', (syncedProducts: Product[]) => {
      setProducts(syncedProducts);
    });

    socket.on('user:list', (users: User[]) => {
      setActiveUsers(users);
    });

    socket.on('log:sync', (logs: UsageLog[]) => {
      setUsageLogs(logs);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Carga inicial de sesión de usuario
  useEffect(() => {
    const sessionUser = sessionStorage.getItem('taller_perez_current');
    if (sessionUser) {
      const user = JSON.parse(sessionUser);
      setCurrentUser(user);
      socketRef.current?.emit('user:join', user);
    }
  }, []);

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
    socketRef.current?.emit('user:join', newUser);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('taller_perez_current');
    window.location.reload();
  };

  const handleResetSystem = () => {
    if (confirm('¿ESTÁS SEGURO? Esta acción ELIMINARÁ TODO el inventario y la bitácora para el lanzamiento.')) {
      socketRef.current?.emit('system:reset');
    }
  };

  // Acciones de Inventario
  const handleAddOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brand || !formData.liters) return;

    let updatedProducts: Product[];
    let logAction: 'INGRESO' | 'EDICION' = 'INGRESO';
    let targetProduct: Product;

    if (editingId) {
      updatedProducts = products.map(p => p.id === editingId ? { ...formData, id: p.id } : p);
      targetProduct = updatedProducts.find(p => p.id === editingId)!;
      logAction = 'EDICION';
      setEditingId(null);
    } else {
      const newProduct: Product = { ...formData, id: crypto.randomUUID() };
      updatedProducts = [newProduct, ...products];
      targetProduct = newProduct;
      logAction = 'INGRESO';
    }

    const newLog: UsageLog = {
      id: crypto.randomUUID(),
      usedBy: currentUser?.name || 'Desconocido',
      brand: targetProduct.brand,
      type: targetProduct.type,
      liters: targetProduct.liters,
      timestamp: Date.now(),
      action: logAction,
      quantity: targetProduct.quantity
    };

    setProducts(updatedProducts);
    socketRef.current?.emit('inventory:update', updatedProducts);
    socketRef.current?.emit('log:add', newLog);
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
      const updatedProducts = products.filter(p => p.id !== id);
      setProducts(updatedProducts);
      socketRef.current?.emit('inventory:update', updatedProducts);
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
      timestamp: Date.now(),
      action: 'CONSUMO',
      quantity: 1
    };

    const updatedProducts = products.map(p => p.id === product.id ? { ...p, quantity: p.quantity - 1 } : p);
    setProducts(updatedProducts);
    socketRef.current?.emit('inventory:update', updatedProducts);
    socketRef.current?.emit('log:add', newLog);
  };

  // Manejador de acciones de IA
  const handleAiExecute = (actions: any | any[]) => {
    const actionList = Array.isArray(actions) ? actions : [actions];
    console.log("IA Actions:", actionList);
    
    setProducts(currentProducts => {
      let tempProducts = [...currentProducts];
      const logsToEmit: UsageLog[] = [];

      actionList.forEach(action => {
        switch (action.type) {
          case 'UPDATE_INVENTORY':
            tempProducts = tempProducts.map(p => {
              if (p.id === action.targetId) {
                const newData = { ...p, ...action.data };
                if ('quantity' in newData) newData.quantity = Number(newData.quantity) || 0;
                
                const diff = Math.abs((Number(action.data.quantity) || p.quantity) - p.quantity);
                const isDecrement = action.data.quantity !== undefined && action.data.quantity < p.quantity;
                logsToEmit.push({
                  id: crypto.randomUUID(),
                  usedBy: `IA (${currentUser?.name})`,
                  brand: newData.brand,
                  type: newData.type,
                  liters: newData.liters,
                  timestamp: Date.now(),
                  action: isDecrement ? 'CONSUMO' : 'EDICION',
                  quantity: diff || newData.quantity
                });
                return newData;
              }
              return p;
            });
            break;
          case 'ADD_INVENTORY':
            const newProduct = { ...action.data, id: crypto.randomUUID() };
            if ('quantity' in newProduct) newProduct.quantity = Number(newProduct.quantity) || 0;
            tempProducts = [newProduct, ...tempProducts];
            
            logsToEmit.push({
              id: crypto.randomUUID(),
              usedBy: `IA (${currentUser?.name})`,
              brand: newProduct.brand,
              type: newProduct.type,
              liters: newProduct.liters,
              timestamp: Date.now(),
              action: 'INGRESO',
              quantity: newProduct.quantity
            });
            break;
          case 'DELETE_INVENTORY':
            tempProducts = tempProducts.filter(p => p.id !== action.targetId);
            break;
        }
      });

      socketRef.current?.emit('inventory:update', tempProducts);
      logsToEmit.forEach(log => socketRef.current?.emit('log:add', log));
      return tempProducts;
    });
  };

  // Estadísticas
  const stats = useMemo(() => {
    return {
      total: products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0),
      lowStock: products.filter(p => (Number(p.quantity) || 0) <= LOW_STOCK_ALERT).length,
      types: {
        aceite: products.filter(p => p.type === ProductType.ACEITE).length,
        refrigerante: products.filter(p => p.type === ProductType.REFRIGERANTE).length,
        desengrasante: products.filter(p => p.type === ProductType.DESENGRASANTE).length,
      }
    };
  }, [products]);

  // Filtrado
  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      (p.brand || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );
  }, [products, searchTerm]);

  // Pantalla de Login
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.1),transparent_50%)]"></div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 border border-white/20"
        >
          <div className="bg-red-600 p-10 text-center relative">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <i className="fa-solid fa-car-side text-white text-6xl mb-6 drop-shadow-lg"></i>
            </motion.div>
            <h1 className="text-white text-4xl font-black uppercase tracking-tighter italic">Automotriz Pérez</h1>
            <p className="text-red-100 text-xs font-bold uppercase tracking-[0.3em] mt-2 opacity-80">Gestión de Maestros</p>
          </div>
          <form onSubmit={handleLogin} className="p-10 space-y-8">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identificación del Personal</label>
              <div className="relative">
                <i className="fa-solid fa-user-gear absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input 
                  type="text" 
                  required
                  className="w-full pl-14 pr-6 py-5 bg-slate-50 border-2 border-slate-100 focus:border-red-600 rounded-2xl outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300"
                  placeholder="Nombre del Maestro..."
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest text-sm shadow-xl shadow-slate-900/20 active:scale-[0.98]">
              Entrar al Sistema
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900">
      {/* Encabezado */}
      <header className="bg-slate-900 text-white shadow-2xl sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <motion.div 
              whileHover={{ rotate: 15 }}
              className="bg-red-600 w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/30"
            >
              <i className="fa-solid fa-wrench text-2xl"></i>
            </motion.div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter italic leading-none">Automotriz Pérez</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Terminal de Control Activa</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="hidden lg:flex items-center gap-4 bg-white/5 px-6 py-3 rounded-2xl border border-white/10">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Maestro en Turno</p>
                <p className="text-sm font-black text-red-500 uppercase italic">{currentUser.name}</p>
              </div>
              <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center border border-white/5">
                <i className="fa-solid fa-user-shield text-slate-400"></i>
              </div>
            </div>
            <button 
              onClick={handleResetSystem} 
              className="w-12 h-12 bg-white/5 hover:bg-orange-600/20 hover:text-orange-500 rounded-2xl flex items-center justify-center transition-all border border-white/10 group"
              title="Reiniciar Sistema (Limpiar Todo)"
            >
              <AlertTriangle className="w-5 h-5 transition-transform group-hover:scale-110" />
            </button>
            <button 
              onClick={handleLogout} 
              className="w-12 h-12 bg-white/5 hover:bg-red-600/20 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all border border-white/10 group"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5 transition-transform group-hover:scale-110" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Barra Lateral */}
        <aside className="lg:col-span-3 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200"
          >
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
              <Users className="w-3.5 h-3.5 text-red-600" /> Personal Online
            </h3>
            <ul className="space-y-3">
              <AnimatePresence>
                {activeUsers.map(user => (
                  <motion.li 
                    key={user.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 group"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center font-black text-slate-400 text-[10px] group-hover:bg-red-50 group-hover:text-red-600 transition-colors uppercase">
                        {user.name.substring(0, 2)}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                    </div>
                    <span className="text-xs font-black text-slate-700 uppercase italic">{user.name}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200"
          >
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Alertas Críticas
            </h3>
            <div className="space-y-2">
              {products.filter(p => (Number(p.quantity) || 0) <= LOW_STOCK_ALERT).length === 0 ? (
                <div className="py-2 text-center">
                  <p className="text-[9px] text-slate-400 font-bold uppercase italic">Stock Optimizado</p>
                </div>
              ) : (
                products.filter(p => (Number(p.quantity) || 0) <= LOW_STOCK_ALERT).map(p => (
                  <motion.div 
                    key={p.id} 
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    className="p-3 bg-amber-50 border border-amber-100 rounded-xl"
                  >
                    <p className="text-[8px] font-black text-amber-800 uppercase tracking-widest mb-0.5">Bajo Stock</p>
                    <p className="text-[11px] font-black text-slate-800 uppercase italic truncate">{p.brand}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] font-bold text-amber-600 uppercase">{p.liters}</span>
                      <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-black rounded-md">{p.quantity} U</span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <UsageHistory logs={usageLogs} />
          </motion.div>
        </aside>

        {/* Sección Central */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Existencias', value: stats.total, icon: Package, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Alertas', value: stats.lowStock, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Maestros', value: activeUsers.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex items-center gap-4"
              >
                <div className={`${stat.bg} w-12 h-12 rounded-xl flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-900 italic leading-none mt-1">{stat.value}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Formulario Compacto */}
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none">
              <Plus className="w-32 h-32" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tighter italic mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                <Plus className="w-4 h-4" />
              </div>
              {editingId ? 'Editar Registro' : 'Nuevo Ingreso'}
            </h2>
            <form onSubmit={handleAddOrUpdate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">Categoría</label>
                <select 
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-red-600 font-black text-slate-700 uppercase italic transition-all appearance-none cursor-pointer text-xs"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value as ProductType})}
                >
                  <option value={ProductType.ACEITE}>Aceite</option>
                  <option value={ProductType.REFRIGERANTE}>Refrigerante</option>
                  <option value={ProductType.DESENGRASANTE}>Desengrasante</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">Marca</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej: Mobil 1..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-red-600 font-black text-slate-700 uppercase italic transition-all text-xs"
                  value={formData.brand}
                  onChange={(e) => setFormData({...formData, brand: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">Presentación</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej: 4L..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-red-600 font-black text-slate-700 uppercase italic transition-all text-xs"
                  value={formData.liters}
                  onChange={(e) => setFormData({...formData, liters: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block ml-1">Stock</label>
                <div className="flex gap-3">
                  <input 
                    type="number" 
                    required
                    min="0"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-red-600 font-black text-slate-700 transition-all text-xs"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                  />
                  <button type="submit" className="bg-red-600 text-white w-14 h-11 rounded-xl flex items-center justify-center hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 active:scale-95">
                    <i className="fa-solid fa-check text-sm"></i>
                  </button>
                </div>
              </div>
            </form>
            {editingId && (
              <button 
                onClick={() => {setEditingId(null); setFormData({type: ProductType.ACEITE, brand:'', liters:'', quantity:0, location: 'Principal'});}} 
                className="mt-4 text-[9px] font-black text-slate-400 hover:text-red-600 uppercase tracking-widest flex items-center gap-2 transition-colors"
              >
                <i className="fa-solid fa-xmark"></i> Cancelar
              </button>
            )}
          </motion.section>

          {/* Tabla Compacta */}
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-3">
                  <LayoutDashboard className="w-5 h-5 text-red-600" />
                  Inventario Real
                </h2>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">Sincronización Activa</p>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                <input 
                  type="text" 
                  placeholder="Filtrar..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-[10px] font-black uppercase italic outline-none focus:border-red-600 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    <th className="px-8 py-4">Ficha</th>
                    <th className="px-8 py-4">Marca</th>
                    <th className="px-8 py-4">Presentación</th>
                    <th className="px-8 py-4 text-center">Stock</th>
                    <th className="px-8 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence mode="popLayout">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-black uppercase italic tracking-widest text-[10px]">
                          Sin registros.
                        </td>
                      </tr>
                    ) : filteredProducts.map(p => (
                      <motion.tr 
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        key={p.id} 
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-8 py-4">
                          <span className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase italic tracking-widest ${
                            p.type === ProductType.ACEITE ? 'bg-red-50 text-red-600 border border-red-100' : 
                            p.type === ProductType.REFRIGERANTE ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                            'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}>
                            {p.type}
                          </span>
                        </td>
                        <td className="px-8 py-4 font-black text-slate-800 uppercase italic text-xs">{p.brand}</td>
                        <td className="px-8 py-4 font-bold text-slate-500 text-[10px] uppercase">{p.liters}</td>
                        <td className="px-8 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => handleUseProduct(p)}
                              className="w-7 h-7 bg-slate-100 hover:bg-red-600 hover:text-white text-slate-400 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-90"
                            >
                              <i className="fa-solid fa-minus text-[8px]"></i>
                            </button>
                            <span className={`inline-block px-3 py-1.5 rounded-lg font-black text-[10px] min-w-[50px] ${
                              (Number(p.quantity) || 0) <= LOW_STOCK_ALERT ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 animate-pulse' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {Number(p.quantity) || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleEdit(p)} 
                              className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                            >
                              <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                            </button>
                            <button 
                              onClick={() => handleDelete(p.id)} 
                              className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"
                            >
                              <i className="fa-solid fa-trash-can text-[10px]"></i>
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* Gráfica Compacta */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <ConsumptionChart logs={usageLogs} />
          </motion.div>
        </div>
      </main>

      {/* Floating AI Assistant Toggle */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsAiOpen(true)}
        className="fixed bottom-10 right-10 w-20 h-20 bg-slate-900 text-white rounded-[2rem] shadow-2xl flex items-center justify-center z-40 border-4 border-white/10 group overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <Bot className="w-10 h-10 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
      </motion.button>

      {/* AI Assistant Sidebar */}
      <AIAssistant 
        isOpen={isAiOpen} 
        onClose={() => setIsAiOpen(false)} 
        products={products}
        shopSettings={shopSettings}
        mechanic={{ id: currentUser.id, name: currentUser.name }}
        onExecute={handleAiExecute}
      />

      <footer className="mt-auto bg-slate-950 py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="w-12 h-px bg-slate-800"></div>
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              className="w-3 h-3 bg-red-600 rounded-full"
            ></motion.div>
            <div className="w-12 h-px bg-slate-800"></div>
          </div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] italic">
            &copy; 2024 Automotriz Pérez - Sistema de Gestión de Alto Rendimiento
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
