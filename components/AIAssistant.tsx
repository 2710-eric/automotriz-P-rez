import React, { useState, useRef, useEffect } from 'react';
import { Product, ShopSettings, Mechanic, ProductType } from '../types';
import { Bot, Send, Mic, MicOff, Volume2, VolumeX, Sparkles, AlertCircle, CheckCircle, Trash2, Edit3, PlusCircle, Zap, RotateCcw } from 'lucide-react';

interface AIAction {
  type: 'ADD_INVENTORY' | 'UPDATE_INVENTORY' | 'DELETE_INVENTORY';
  targetId?: string;
  data?: Partial<Product>;
  message: string;
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  actions?: AIAction[];
  latencyMs?: number;
  isError?: boolean;
}

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  shopSettings: ShopSettings;
  mechanic: Mechanic;
  onExecute: (actions: AIAction[]) => Promise<void> | void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({
  isOpen,
  onClose,
  products,
  shopSettings,
  mechanic,
  onExecute,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      text: `¡Hola Maestro ${mechanic.name}! Soy tu Copiloto Inteligente de Automotriz Pérez.\n\nEstoy optimizado con respuesta ultra rápida. Puedo responder dudas técnicas de aceites, refrigerantes y motores, o actualizar el inventario al instante. ¿Qué necesitas hoy?`,
      isUser: false,
      timestamp: Date.now(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-scroll al final del chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isOpen, isLoading]);

  // Configuración de reconocimiento de voz (Web Speech API)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setPrompt(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopAudioPlayback();
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Tu navegador no soporta reconocimiento de voz nativo. Por favor escribe tu consulta.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      stopAudioPlayback();
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Recognition start error:', err);
      }
    }
  };

  const stopAudioPlayback = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
  };

  // Síntesis de voz instantánea mediante Web Speech API (0ms latencia) con fallback
  const speakText = async (text: string) => {
    stopAudioPlayback();
    setIsPlayingAudio(true);

    const cleanText = text.replace(/[*#_`[\]]/g, ' ').trim();

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-ES';
      utterance.rate = 1.08;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
      return;
    }

    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
          currentAudioRef.current = audio;
          audio.onended = () => setIsPlayingAudio(false);
          audio.onerror = () => setIsPlayingAudio(false);
          await audio.play();
          return;
        }
      }
    } catch (e) {
      console.warn('Fallo TTS del servidor:', e);
    }
    setIsPlayingAudio(false);
  };

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend || prompt).trim();
    if (!text || isLoading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setPrompt('');
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      text,
      isUser: true,
      timestamp: Date.now(),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setIsLoading(true);
    const startTime = Date.now();

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          products,
          mechanic,
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Error en servidor: ${response.status}`);
      }

      const data = await response.json();
      const actions: AIAction[] = data.actions || [];

      // Ejecutar acciones en Firestore si hay alguna
      if (actions.length > 0) {
        await onExecute(actions);
      }

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        text: data.reply || 'He procesado tu instrucción correctamente.',
        isUser: false,
        timestamp: Date.now(),
        actions,
        latencyMs,
      };

      setChatHistory((prev) => [...prev, aiMsg]);

      if (autoSpeak && data.reply) {
        speakText(data.reply);
      }
    } catch (err: any) {
      console.error('Error al consultar IA:', err);
      const latencyMs = Date.now() - startTime;
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        text: 'Maestro, hubo un retraso o inconveniente de conexión. Por favor reintenta tu consulta.',
        isUser: false,
        timestamp: Date.now(),
        latencyMs,
        isError: true,
      };
      setChatHistory((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    stopAudioPlayback();
    setChatHistory([
      {
        id: 'welcome',
        text: `¡Listo Maestro ${mechanic.name}! Historial reiniciado. ¿En qué te ayudo con los insumos o dudas mecánicas?`,
        isUser: false,
        timestamp: Date.now(),
      },
    ]);
  };

  const quickPrompts = [
    { label: '📦 Stock Bajo', text: '¿Qué insumos tienen stock bajo o están por agotarse?' },
    { label: '🔧 5W-30 vs 10W-40', text: '¿Cuál es la diferencia entre aceite 5W-30 y 10W-40?' },
    { label: '➕ Agregar 5 Mobil 5W-30', text: 'Agrega 5 unidades de Aceite Mobil 1 5W-30 en Bodega Principal' },
    { label: '➖ Usé 1 Refrigerante', text: 'Acabo de usar 1 unidad de Refrigerante, descuéntalo del inventario' },
    { label: '🧪 Anticongelante OAT', text: '¿Qué ventaja tiene el refrigerante orgánico OAT en motores modernos?' },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-slate-900 text-white shadow-2xl z-50 flex flex-col border-l border-slate-800">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/30">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-black text-white text-base uppercase tracking-tight italic flex items-center gap-2">
                Copiloto IA
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 fill-emerald-400" />
                  Ultra Rápido (~1s)
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Maestro {mechanic.name} &bull; Gemini 3.1 Flash Lite
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={clearChat}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all text-xs border border-slate-700/60"
              title="Reiniciar conversación"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (isPlayingAudio) {
                  stopAudioPlayback();
                } else {
                  setAutoSpeak(!autoSpeak);
                }
              }}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all text-xs border ${
                autoSpeak || isPlayingAudio
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title={autoSpeak ? 'Lectura por voz activada' : 'Activar lectura por voz'}
            >
              {autoSpeak || isPlayingAudio ? (
                <Volume2 className={`w-3.5 h-3.5 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors border border-slate-700/60"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
        </div>

        {/* Quick prompt suggestions */}
        <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(q.text)}
              disabled={isLoading}
              className="text-[10px] font-bold text-slate-300 bg-slate-800/90 hover:bg-slate-700 hover:text-white border border-slate-700/60 px-3 py-1.5 rounded-xl whitespace-nowrap transition-all active:scale-95 shrink-0 shadow-sm"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {chatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] p-4 rounded-2xl text-xs leading-relaxed font-medium shadow-md ${
                  msg.isUser
                    ? 'bg-red-600 text-white rounded-tr-none'
                    : msg.isError
                    ? 'bg-rose-950/80 text-rose-200 border border-rose-800/80 rounded-tl-none'
                    : 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-line">{msg.text}</div>

                {/* Badges de acciones ejecutadas */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700/80 space-y-1.5">
                    <p className="text-[9px] uppercase tracking-wider font-black text-amber-400 flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3" /> Acciones Realizadas en Inventario:
                    </p>
                    {msg.actions.map((act, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 bg-slate-900/80 rounded-xl text-[10px] font-bold border border-slate-700/50"
                      >
                        {act.type === 'ADD_INVENTORY' && (
                          <PlusCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        {act.type === 'UPDATE_INVENTORY' && (
                          <Edit3 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        )}
                        {act.type === 'DELETE_INVENTORY' && (
                          <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span className="text-slate-300 leading-tight">{act.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pie de mensaje del asistente: latencia y controles */}
              {!msg.isUser && (
                <div className="flex items-center gap-3 mt-1 ml-2">
                  {msg.latencyMs !== undefined && (
                    <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/50">
                      <Zap className="w-2.5 h-2.5 fill-emerald-400" />
                      {(msg.latencyMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  <button
                    onClick={() => speakText(msg.text)}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                    title="Escuchar mensaje con voz"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Escuchar</span>
                  </button>
                  {msg.isError && (
                    <button
                      onClick={() => {
                        const lastUser = [...chatHistory].reverse().find(m => m.isUser);
                        if (lastUser) sendMessage(lastUser.text);
                      }}
                      className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors font-bold underline"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reintentar</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-3 p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/60 w-fit shadow-md">
              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400 fill-amber-400 animate-pulse" />
                El Copiloto está respondiendo al instante...
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/80">
          {isListening && (
            <div className="mb-2 p-2.5 bg-red-600/20 border border-red-500/40 rounded-xl flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2 text-xs font-bold text-red-300">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                Escuchando al Maestro... Habla ahora
              </div>
              <button
                onClick={toggleListening}
                className="text-[10px] uppercase font-black tracking-wider text-red-200 underline"
              >
                Detener
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleListening}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md shrink-0 ${
                isListening
                  ? 'bg-red-600 text-white animate-pulse shadow-red-600/40'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:bg-slate-700'
              }`}
              title={isListening ? 'Detener micrófono' : 'Hablar por micrófono'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex-1 relative flex items-center"
            >
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  isListening
                    ? 'Escuchando tu voz...'
                    : 'Pregunta sobre lubricantes, agrega o cambia insumos...'
                }
                className="w-full pl-4 pr-12 py-3.5 bg-slate-800 border border-slate-700 rounded-2xl outline-none focus:border-red-500 text-white font-medium text-xs placeholder:text-slate-500 shadow-inner"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!prompt.trim() || isLoading}
                className="absolute right-2 text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          <p className="text-[9px] text-slate-500 text-center font-bold uppercase tracking-wider mt-3">
            Motor Gemini &bull; Consulta dudas técnicas o modifica el inventario en tiempo real
          </p>
        </div>
      </div>
    </>
  );
};

export default AIAssistant;
