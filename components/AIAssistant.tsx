
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, Modality, LiveServerMessage, Blob } from "@google/genai";
import { Product, ShopSettings, Mechanic } from '../types';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  shopSettings: ShopSettings;
  mechanic: Mechanic;
  onExecute: (action: any) => void;
}

// Audio Helpers
function decode(base64: string) {
  const b = atob(base64);
  const bytes = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
  return bytes;
}

function encode(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sr: number, ch: number): Promise<AudioBuffer> {
  const d16 = new Int16Array(data.buffer);
  const fc = d16.length / ch;
  const buf = ctx.createBuffer(ch, fc, sr);
  for (let c = 0; c < ch; c++) {
    const cd = buf.getChannelData(c);
    for (let i = 0; i < fc; i++) cd[i] = d16[i * ch + c] / 32768.0;
  }
  return buf;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, products, shopSettings, mechanic, onExecute }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [chatHistory, setChatHistory] = useState<{text: string, isUser: boolean}[]>([]);
  
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  const addChat = (text: string, isUser: boolean) => {
    setChatHistory(prev => [...prev.slice(-10), { text, isUser }]);
  };

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const userText = prompt;
    setPrompt('');
    addChat(userText, true);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Maestro ${mechanic.name} dice: "${userText}". Contexto: ${JSON.stringify({inv: products, settings: shopSettings})}. Retorna JSON con: type, data, targetId, message.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              data: { type: Type.OBJECT },
              targetId: { type: Type.STRING },
              message: { type: Type.STRING }
            },
            required: ["type", "message"]
          }
        },
      });

      const result = JSON.parse(response.text || '{}');
      onExecute(result);
      addChat(result.message, false);
    } catch (error) {
      addChat("Maestro, hubo un error técnico con la IA. Intente de nuevo.", false);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVoice = async () => {
    if (isVoiceActive) { stopVoiceSession(); return; }
    startVoiceSession();
  };

  const startVoiceSession = async () => {
    setIsVoiceActive(true);
    addChat(`Escuchando al Maestro ${mechanic.name}...`, false);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob: Blob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.toolCall) {
              for (const fc of m.toolCall.functionCalls) {
                if (fc.name === 'executeAction') {
                  onExecute(fc.args);
                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result: "Acción confirmada en la terminal." } }
                  }));
                  addChat(fc.args.message, false);
                }
              }
            }
            const audioData = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buf = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const s = outputCtx.createBufferSource();
              s.buffer = buf;
              s.connect(outputCtx.destination);
              s.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buf.duration;
              sourcesRef.current.add(s);
              s.onended = () => sourcesRef.current.delete(s);
            }
          },
          onclose: () => stopVoiceSession()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `Eres la IA copiloto de Automotriz Pérez. Estás hablando con el Maestro ${mechanic.name}. Tu tono es profesional, breve y directo, como un colega experto. Tienes control total del inventario: ${JSON.stringify(products)}. Cuando el Maestro pida un cambio, usa executeAction obligatoriamente.`,
          tools: [{
            functionDeclarations: [{
              name: 'executeAction',
              description: 'Ejecuta modificaciones en el inventario o configuración del taller',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['UPDATE_INVENTORY', 'ADD_INVENTORY', 'DELETE_INVENTORY', 'UPDATE_SHOP_SETTINGS'] },
                  data: { type: Type.OBJECT },
                  targetId: { type: Type.STRING },
                  message: { type: Type.STRING }
                },
                required: ['type', 'data', 'message']
              }
            }]
          }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) { stopVoiceSession(); }
  };

  const stopVoiceSession = () => {
    setIsVoiceActive(false);
    if (sessionRef.current) sessionRef.current.close();
    if (audioContextsRef.current) { audioContextsRef.current.input.close(); audioContextsRef.current.output.close(); }
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 transition-opacity" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-[#1E293B] shadow-[0_0_100px_rgba(0,0,0,0.8)] z-50 flex flex-col animate-slide-in-right border-l border-slate-700">
        <div className="p-8 border-b border-slate-700 flex items-center justify-between bg-slate-900/40">
          <div>
            <h2 className="font-black text-slate-100 flex items-center gap-3 uppercase italic tracking-tighter">
              <i className="fa-solid fa-microchip text-amber-500"></i>
              Copiloto Mecánico
            </h2>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Sesión: Maestro {mechanic.name}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-slate-800 rounded-xl text-slate-500 transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl text-[11px] text-amber-500 font-bold uppercase tracking-tight leading-relaxed italic">
            "Maestro {mechanic.name}, estoy listo para gestionar el almacén. Pídeme que actualice existencias, busque ubicaciones o registre nuevas piezas."
          </div>
          
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-4 rounded-2xl text-xs font-bold ${
                msg.isUser 
                  ? 'bg-amber-500 text-slate-900 rounded-tr-none shadow-lg' 
                  : 'bg-slate-900 text-slate-300 rounded-tl-none border border-slate-700 shadow-xl'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && !isVoiceActive && <div className="text-[10px] font-black text-amber-500/50 animate-pulse italic uppercase tracking-widest px-2">● Sincronizando datos...</div>}
        </div>

        <div className="p-8 border-t border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleVoice}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-2xl ${
                isVoiceActive ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800 border border-slate-700 text-amber-500 hover:bg-slate-700'
              }`}
              title={isVoiceActive ? "Cerrar micrófono" : "Hablar con Copiloto"}
            >
              <i className={`fa-solid ${isVoiceActive ? 'fa-stop' : 'fa-microphone-lines'} text-2xl`}></i>
            </button>
            <form onSubmit={handleCommand} className="flex-1 relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={isVoiceActive ? "IA escuchando..." : "Escribe comando técnico..."}
                className="w-full pl-6 pr-12 py-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 text-white font-bold text-xs placeholder:text-slate-600 shadow-inner"
                disabled={isVoiceActive}
              />
              <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 disabled:text-slate-700">
                <i className="fa-solid fa-bolt"></i>
              </button>
            </form>
          </div>
          <div className="mt-4 flex justify-center">
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] italic">Sistema de Control Inteligente V3.0</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in-right { animation: slide-in-right 0.4s cubic-bezier(0.1, 0.9, 0.2, 1); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </>
  );
};

export default AIAssistant;
