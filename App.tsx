
import React, { useState, useEffect, useMemo, useRef, Component } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { Product, ProductType, User, UsageLog, ShopSettings, Mechanic } from './types';
import ConsumptionChart from './components/ConsumptionChart';
import UsageHistory from './components/UsageHistory';
import AIAssistant from './components/AIAssistant';
import Tutorial from './components/Tutorial';
import { Package, Droplets, Thermometer, History, TrendingUp, AlertTriangle, Users, Plus, Search, LogOut, Bot, LayoutDashboard, RefreshCcw, HelpCircle, Trash2, AlertCircle, X } from 'lucide-react';
import { 
  db, auth, loginWithGoogle, handleFirestoreError, OperationType, 
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit,
  writeBatch, testConnection
} from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorInfo: string | null;
}

class ErrorBoundary extends Component<any, any> {
  state = { hasError: false, errorInfo: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const { hasError, errorInfo } = this.state;
    if (hasError) {
      let displayMessage = "Ha ocurrido un error inesperado.";
      try {
        const parsed = JSON.parse(errorInfo || "");
        if (parsed.error === "Missing or insufficient permissions.") {
          displayMessage = "No tienes permisos suficientes para realizar esta acción o ver estos datos. Por favor, asegúrate de estar correctamente identificado.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl border border-white/20">
            <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-600 w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase italic mb-4">¡Ups! Algo salió mal</h2>
            <p className="text-slate-600 font-medium mb-8 leading-relaxed">
              {displayMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-3"
            >
              <RefreshCcw className="w-5 h-5" />
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

const LOW_STOCK_ALERT = 5;

const App: React.FC = () => {
  // Estados de Usuario
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Estados de Inventario
  const [products, setProducts] = useState<Product[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  // Estados de eliminación y modales de confirmación
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  // Verificación de primera visita para activar tutorial automáticamente
  useEffect(() => {
    try {
      const hasSeen = localStorage.getItem('automotriz_tutorial_first_visit');
      if (!hasSeen) {
        setIsTutorialOpen(true);
        localStorage.setItem('automotriz_tutorial_first_visit', 'true');
      }
    } catch (e) {
      console.warn("Storage check skipped:", e);
    }
  }, []);

  const isAdmin = useMemo(() => {
    return currentUser?.email?.toLowerCase() === 'eric.27102004@gmail.com' || currentUser?.role === 'admin';
  }, [currentUser]);

  // Configuración del Taller
  const [shopSettings, setShopSettings] = useState<ShopSettings>({ phone: '555-0123' });

  // Estado del Formulario - Se añade 'location' por ser ahora requerido en la interfaz Product
  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    type: ProductType.ACEITE,
    brand: '',
    liters: '',
    quantity: 0,
    location: 'Principal'
  });

  const socketRef = useRef<Socket | null>(null);

  // WebSocket Connection (Solo para presencia)
  useEffect(() => {
    testConnection();
    const socket = io({
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });
    socketRef.current = socket;

    socket.on('connect_error', (err) => {
      console.error("WebSocket connection error:", err.message);
    });

    socket.on('user:list', (users: User[]) => {
      setActiveUsers(users);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Firebase Firestore Listeners
  useEffect(() => {
    if (!currentUser) return;

    // Listener para Configuración del Taller
    const unsubscribeSettings = onSnapshot(doc(db, 'shopSettings', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        setShopSettings(docSnap.data() as ShopSettings);
      }
    }, (error) => {
      // No lanzamos error crítico para los settings, solo logueamos
      console.warn("No se pudo cargar la configuración del taller (usando valores por defecto):", error);
    });

    const qProducts = query(collection(db, 'products'));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      const productsData = snapshot.docs.map(doc => doc.data() as Product);
      setProducts(productsData);
      
      // Actualizar estado de sincronización
      if (!snapshot.metadata.fromCache) {
        setIsSynced(true);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    const qLogs = query(collection(db, 'usageLogs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const logsData = snapshot.docs.map(doc => doc.data() as UsageLog);
      setUsageLogs(logsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'usageLogs');
    });

    return () => {
      unsubscribeSettings();
      unsubscribeProducts();
      unsubscribeLogs();
    };
  }, [currentUser]);

  // Firebase Auth Listener
  useEffect(() => {
    let isMounted = true;
    let authChecked = false;

    // Timeout de seguridad solo si Firebase tarda más de lo habitual
    const timeout = setTimeout(() => {
      if (isMounted && !authChecked) {
        setIsCheckingSession(false);
      }
    }, 2500);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      authChecked = true;
      clearTimeout(timeout);
      if (!isMounted) return;

      if (firebaseUser) {
        const user: User = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Maestro',
          email: firebaseUser.email,
          lastActive: Date.now()
        };
        setCurrentUser(user);
        socketRef.current?.emit('user:join', user);

        // Sincronizar perfil de usuario en Firestore
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              name: user.name,
              email: firebaseUser.email,
              lastActive: Date.now(),
              role: 'user'
            });
          } else {
            // Solo actualizamos campos básicos, no el rol
            await updateDoc(userRef, {
              name: user.name,
              lastActive: Date.now()
            });
          }
        } catch (error) {
          console.error("Error al sincronizar perfil en Firestore:", error);
        }
      } else {
        setCurrentUser(null);
      }
      setIsCheckingSession(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleGoogleLogin = async () => {
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      setLoginError(error.message || "Error desconocido al iniciar sesión.");
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Acciones de Inventario
  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brand || !formData.liters) return;

    const productId = editingId || crypto.randomUUID();
    const logAction: 'INGRESO' | 'EDICION' = editingId ? 'EDICION' : 'INGRESO';
    
    const productData: Product = {
      ...formData,
      id: productId,
      lastUpdated: Date.now()
    };

    const newLog: UsageLog = {
      id: crypto.randomUUID(),
      usedBy: currentUser?.name || 'Desconocido',
      brand: productData.brand,
      type: productData.type,
      liters: productData.liters,
      timestamp: Date.now(),
      action: logAction,
      quantity: productData.quantity
    };

    try {
      await setDoc(doc(db, 'products', productId), productData);
      await setDoc(doc(db, 'usageLogs', newLog.id), newLog);
      
      setEditingId(null);
      setFormData({ type: ProductType.ACEITE, brand: '', liters: '', quantity: 0, location: 'Principal' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `products/${productId} or usageLogs/${newLog.id}`);
    }
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

  // Iniciar eliminación de un producto individual abriendo modal
  const handleInitiateDelete = (product: Product) => {
    setProductToDelete(product);
  };

  // Confirmar eliminación individual en Firestore
  const handleConfirmSingleDelete = async () => {
    if (!productToDelete) return;
    setIsDeletingSingle(true);
    try {
      await deleteDoc(doc(db, 'products', productToDelete.id));
      setProductToDelete(null);
    } catch (error) {
      console.error("Error al eliminar producto:", error);
      handleFirestoreError(error, OperationType.DELETE, `products/${productToDelete.id}`);
    } finally {
      setIsDeletingSingle(false);
    }
  };

  // Confirmar vaciado total de inventario en Firestore con Batch
  const handleConfirmBulkDelete = async () => {
    if (products.length === 0) {
      setIsBulkDeleteModalOpen(false);
      return;
    }
    setIsDeletingBulk(true);
    try {
      const batchSize = 400;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = products.slice(i, i + batchSize);
        chunk.forEach(p => {
          batch.delete(doc(db, 'products', p.id));
        });
        await batch.commit();
      }
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      console.error("Error al vaciar inventario:", error);
      handleFirestoreError(error, OperationType.DELETE, 'products');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleUseProduct = async (product: Product) => {
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

    try {
      await updateDoc(doc(db, 'products', product.id), {
        quantity: product.quantity - 1,
        lastUpdated: Date.now()
      });
      await setDoc(doc(db, 'usageLogs', newLog.id), newLog);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
    }
  };

  // Función para normalizar categorías de producto
  const normalizeProductType = (rawType?: string): ProductType => {
    const lower = (rawType || '').toLowerCase();
    if (lower.includes('refrig') || lower.includes('anticong')) return ProductType.REFRIGERANTE;
    if (lower.includes('desengras')) return ProductType.DESENGRASANTE;
    return ProductType.ACEITE;
  };

  // Manejador de acciones de IA
  const handleAiExecute = async (actions: any | any[]) => {
    const actionList = Array.isArray(actions) ? actions : [actions];
    console.log("IA Actions to execute:", actionList);
    
    for (const action of actionList) {
      try {
        switch (action.type) {
          case 'UPDATE_INVENTORY': {
            let targetId = action.targetId;
            // Si no se proporcionó targetId, buscar por coincidencia en marca
            if (!targetId && action.data?.brand) {
              const matched = products.find(p => 
                p.brand.toLowerCase().includes(action.data.brand.toLowerCase()) ||
                action.data.brand.toLowerCase().includes(p.brand.toLowerCase())
              );
              if (matched) targetId = matched.id;
            }

            if (!targetId && products.length > 0) {
              // Buscar primer producto que coincida con el tipo
              const matchedType = products.find(p => p.type === normalizeProductType(action.data?.type));
              if (matchedType) targetId = matchedType.id;
            }

            if (targetId) {
              const productRef = doc(db, 'products', targetId);
              const productSnap = await getDoc(productRef);
              if (productSnap.exists()) {
                const p = productSnap.data() as Product;
                const updatePayload: any = { ...action.data };
                if (updatePayload.type) {
                  updatePayload.type = normalizeProductType(updatePayload.type);
                }
                if ('quantity' in updatePayload) {
                  updatePayload.quantity = Math.max(0, Number(updatePayload.quantity) || 0);
                }

                const newData: Product = {
                  ...p,
                  ...updatePayload,
                  lastUpdated: Date.now()
                };
                
                const oldQty = Number(p.quantity) || 0;
                const newQty = Number(newData.quantity) || 0;
                const isDecrement = updatePayload.quantity !== undefined && newQty < oldQty;
                const diff = Math.abs(newQty - oldQty);
                
                const newLog: UsageLog = {
                  id: crypto.randomUUID(),
                  usedBy: `IA (${currentUser?.name || 'Maestro'})`,
                  brand: newData.brand,
                  type: newData.type,
                  liters: newData.liters,
                  timestamp: Date.now(),
                  action: isDecrement ? 'CONSUMO' : 'EDICION',
                  quantity: diff > 0 ? diff : 1
                };
                
                await setDoc(productRef, newData);
                await setDoc(doc(db, 'usageLogs', newLog.id), newLog);
              }
            }
            break;
          }
          case 'ADD_INVENTORY': {
            const newId = crypto.randomUUID();
            const raw = action.data || {};
            const cleanType = normalizeProductType(raw.type);
            const newProduct: Product = {
              id: newId,
              type: cleanType,
              brand: (raw.brand || 'Insumo Taller').trim(),
              liters: (raw.liters || '1L').trim(),
              quantity: Math.max(0, Number(raw.quantity) || 1),
              location: (raw.location || 'Principal').trim(),
              notes: raw.notes || '',
              lastUpdated: Date.now()
            };
            
            const newLog: UsageLog = {
              id: crypto.randomUUID(),
              usedBy: `IA (${currentUser?.name || 'Maestro'})`,
              brand: newProduct.brand,
              type: newProduct.type,
              liters: newProduct.liters,
              timestamp: Date.now(),
              action: 'INGRESO',
              quantity: newProduct.quantity
            };
            
            await setDoc(doc(db, 'products', newId), newProduct);
            await setDoc(doc(db, 'usageLogs', newLog.id), newLog);
            break;
          }
          case 'DELETE_INVENTORY': {
            let targetId = action.targetId;
            if (!targetId && action.data?.brand) {
              const matched = products.find(p => 
                p.brand.toLowerCase().includes(action.data.brand.toLowerCase()) ||
                action.data.brand.toLowerCase().includes(p.brand.toLowerCase())
              );
              if (matched) targetId = matched.id;
            }

            if (targetId) {
              const existing = products.find(p => p.id === targetId);
              await deleteDoc(doc(db, 'products', targetId));
              if (existing) {
                const delLog: UsageLog = {
                  id: crypto.randomUUID(),
                  usedBy: `IA (${currentUser?.name || 'Maestro'})`,
                  brand: existing.brand,
                  type: existing.type,
                  liters: existing.liters,
                  timestamp: Date.now(),
                  action: 'CONSUMO',
                  quantity: existing.quantity
                };
                await setDoc(doc(db, 'usageLogs', delLog.id), delLog);
              }
            }
            break;
          }
        }
      } catch (error) {
        console.error("Error executing IA action:", error);
      }
    }
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
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Verificando Terminal...</p>
        </div>
      </div>
    );
  }

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

          <div className="p-10 space-y-8">
            <div className="text-center space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Acceso de Personal Autorizado</p>
              <h2 className="text-2xl font-black text-slate-900 uppercase italic">Iniciar Sesión</h2>
            </div>
            
            {loginError && (
              <div className="w-full p-4 bg-red-50 border border-red-200 rounded-2xl space-y-2">
                <p className="text-red-600 text-[11px] font-bold leading-relaxed text-center uppercase tracking-wider">
                  {loginError}
                </p>
                {loginError.includes('DOMINIO_NO_AUTORIZADO') && (
                  <div className="pt-2 border-t border-red-200 text-[10px] text-slate-700 space-y-2">
                    <p className="font-semibold text-center text-slate-800">Dominio actual detectado:</p>
                    <code className="block p-2 bg-white rounded-lg border border-red-200 text-slate-900 font-mono text-center select-all break-all">
                      {window.location.hostname}
                    </code>
                    <a
                      href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-red-600 underline font-black hover:text-red-700 pt-1"
                    >
                      Ir a Consola Firebase &rarr;
                    </a>
                  </div>
                )}
              </div>
            )}

            <button 
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className={`w-full ${isLoggingIn ? 'bg-slate-700' : 'bg-slate-900 hover:bg-slate-800'} text-white font-black py-5 rounded-2xl transition-all uppercase tracking-widest text-sm shadow-xl shadow-slate-900/20 active:scale-[0.98] flex items-center justify-center gap-4`}
            >
              {isLoggingIn ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <i className="fa-brands fa-google text-xl"></i>
              )}
              {isLoggingIn ? 'Procesando...' : 'Continuar con Google'}
            </button>

            <button 
              onClick={() => setIsTutorialOpen(true)}
              className="w-full bg-slate-100 text-slate-600 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
            >
              <HelpCircle className="w-4 h-4" />
              ¿Cómo funciona? Ver Tutorial
            </button>

            <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-widest leading-relaxed">
              Al ingresar, tu sesión quedará guardada de forma segura en este terminal.
            </p>
          </div>
        </motion.div>

        {/* Tutorial interactivo funcional antes de iniciar sesión */}
        <Tutorial 
          isOpen={isTutorialOpen} 
          onClose={() => setIsTutorialOpen(false)} 
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
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
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isSynced ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'}`}></span>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {isSynced ? 'Nube Sincronizada' : 'Conectando Nube...'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${activeUsers.length > 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                    {activeUsers.length} {activeUsers.length === 1 ? 'Maestro' : 'Maestros'} en Línea
                  </p>
                </div>
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
              onClick={() => setIsTutorialOpen(true)} 
              className="w-12 h-12 bg-white/5 hover:bg-white/10 text-white rounded-2xl flex items-center justify-center transition-all border border-white/10 group"
              title="Ver Tutorial"
            >
              <HelpCircle className="w-5 h-5 transition-transform group-hover:scale-110" />
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
              <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <input 
                    type="text" 
                    placeholder="Filtrar..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-[10px] font-black uppercase italic outline-none focus:border-red-600 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {/* Botón pequeño para eliminar todo el inventario */}
                {isAdmin && (
                  <button
                    onClick={() => setIsBulkDeleteModalOpen(true)}
                    disabled={products.length === 0}
                    className={`flex items-center gap-1.5 px-3.5 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                      products.length === 0
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                        : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 hover:border-red-600'
                    }`}
                    title={products.length === 0 ? "El inventario ya está vacío" : "Eliminar todo el inventario con advertencia"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vaciar Todo</span>
                  </button>
                )}
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
                          <div className="flex justify-end items-center gap-2">
                            <button 
                              onClick={() => handleEdit(p)} 
                              title="Editar producto"
                              className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                            >
                              <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                            </button>
                            {isAdmin && (
                              <button 
                                onClick={() => handleInitiateDelete(p)} 
                                title="Eliminar producto"
                                className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
                              >
                                <i className="fa-solid fa-trash-can text-[10px]"></i>
                              </button>
                            )}
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
      {currentUser && (
        <AIAssistant 
          isOpen={isAiOpen} 
          onClose={() => setIsAiOpen(false)} 
          products={products}
          shopSettings={shopSettings}
          mechanic={{ id: currentUser.id, name: currentUser.name }}
          onExecute={handleAiExecute}
        />
      )}

      <Tutorial 
        isOpen={isTutorialOpen} 
        onClose={() => setIsTutorialOpen(false)} 
      />

      {/* Modal de Advertencia Crítica: Vaciar Todo el Inventario */}
      <AnimatePresence>
        {isBulkDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeletingBulk && setIsBulkDeleteModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-red-200 z-10"
            >
              <div className="p-6 bg-red-50/70 border-b border-red-100 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-600/30">
                  <AlertTriangle className="w-6 h-6 animate-bounce" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-600">
                    Advertencia Crítica
                  </span>
                  <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">
                    ¿Vaciar todo el inventario?
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !isDeletingBulk && setIsBulkDeleteModalOpen(false)}
                  disabled={isDeletingBulk}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-slate-600 text-sm leading-relaxed">
                  Estás a punto de eliminar <strong className="text-red-600 font-black">{products.length} productos</strong> registrados en el taller.
                </p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 space-y-1">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600" /> Esta acción es irreversible
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    Todos los lubricantes, refrigerantes y registros de stock en el inventario real se borrarán permanentemente de la base de datos.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isDeletingBulk}
                  onClick={() => setIsBulkDeleteModalOpen(false)}
                  className="px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs uppercase tracking-wider hover:bg-slate-100 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingBulk || products.length === 0}
                  onClick={handleConfirmBulkDelete}
                  className="px-6 py-3 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-wider hover:bg-red-700 transition-all flex items-center gap-2 shadow-lg shadow-red-600/30 disabled:opacity-50"
                >
                  {isDeletingBulk ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Vaciando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Sí, Vaciar Todo</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmación: Eliminar Producto Individual */}
      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeletingSingle && setProductToDelete(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 z-10"
            >
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-600">
                    Confirmar Eliminación
                  </span>
                  <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">
                    ¿Eliminar este producto?
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !isDeletingSingle && setProductToDelete(null)}
                  disabled={isDeletingSingle}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {productToDelete.type}
                    </span>
                    <span className="px-2.5 py-1 bg-slate-200 text-slate-800 text-[10px] font-black rounded-lg">
                      Stock: {productToDelete.quantity}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    {productToDelete.brand}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    Presentación: {productToDelete.liters} {productToDelete.location ? `· Ubicación: ${productToDelete.location}` : ''}
                  </p>
                </div>
                <p className="text-slate-500 text-xs">
                  Este insumo se quitará permanentemente del inventario real y de las estadísticas del taller.
                </p>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isDeletingSingle}
                  onClick={() => setProductToDelete(null)}
                  className="px-5 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs uppercase tracking-wider hover:bg-slate-100 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingSingle}
                  onClick={handleConfirmSingleDelete}
                  className="px-6 py-3 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-wider hover:bg-red-700 transition-all flex items-center gap-2 shadow-lg shadow-red-600/30 disabled:opacity-50"
                >
                  {isDeletingSingle ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Sí, Eliminar</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
    </ErrorBoundary>
  );
};

export default App;
