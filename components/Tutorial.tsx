import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, ChevronLeft, Package, Droplets, Bot, TrendingUp, CheckCircle2 } from 'lucide-react';

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const steps: Step[] = [
  {
    title: "Gestión de Inventario",
    description: "Agrega nuevos productos al stock usando el formulario superior. Puedes especificar marca, tipo (Aceite, Refrigerante, etc.), litros y ubicación.",
    icon: <Package className="w-8 h-8" />,
    color: "bg-blue-600"
  },
  {
    title: "Registro de Consumo",
    description: "Cuando uses un producto, haz clic en el botón 'Usar' en la tabla. El sistema descontará automáticamente 1 unidad y registrará quién lo usó.",
    icon: <Droplets className="w-8 h-8" />,
    color: "bg-red-600"
  },
  {
    title: "Asistente Inteligente",
    description: "Usa el botón flotante del robot para hablar con el Asistente IA. Puedes pedirle que registre consumos por voz o que te dé resúmenes del inventario.",
    icon: <Bot className="w-8 h-8" />,
    color: "bg-slate-900"
  },
  {
    title: "Estadísticas y Alertas",
    description: "Visualiza el historial de uso y gráficas de consumo en la parte inferior. El sistema te alertará con color rojo cuando un producto tenga poco stock.",
    icon: <TrendingUp className="w-8 h-8" />,
    color: "bg-emerald-600"
  }
];

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

const Tutorial: React.FC<TutorialProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = React.useState(0);

  const next = () => {
    if (currentStep < steps.length - 1) setCurrentStep(s => s + 1);
    else onClose();
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20"
          >
            {/* Header */}
            <div className="p-8 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Guía de Inicio</h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col items-center text-center gap-6"
                >
                  <div className={`w-20 h-20 ${steps[currentStep].color} rounded-3xl flex items-center justify-center shadow-2xl text-white rotate-3`}>
                    {steps[currentStep].icon}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">
                      {steps[currentStep].title}
                    </h3>
                    <p className="text-slate-600 font-medium leading-relaxed">
                      {steps[currentStep].description}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-8 bg-slate-50 flex items-center justify-between">
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-8 bg-slate-900' : 'w-2 bg-slate-300'}`}
                  />
                ))}
              </div>
              
              <div className="flex gap-3">
                {currentStep > 0 && (
                  <button 
                    onClick={prev}
                    className="px-6 py-3 bg-white text-slate-900 font-black rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all uppercase tracking-widest text-[10px] flex items-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Atrás
                  </button>
                )}
                <button 
                  onClick={next}
                  className="px-8 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-lg shadow-slate-900/20"
                >
                  {currentStep === steps.length - 1 ? 'Finalizar' : 'Siguiente'}
                  {currentStep !== steps.length - 1 && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Tutorial;
