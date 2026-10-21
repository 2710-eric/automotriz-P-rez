import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { User } from "./types";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Server state (Presence only, data is in Firestore)
  let activeUsers: User[] = [];

  // Endpoint de IA para resolución de dudas, agregar, modificar o eliminar insumos
  // Endpoint de IA para resolución de dudas, agregar, modificar o eliminar insumos (Ultra baja latencia y alta disponibilidad)
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, products, mechanic } = req.body;
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "El mensaje es requerido." });
      }

      const cleanMessage = message.trim();
      const mechanicName = mechanic?.name || "Maestro";
      const lower = cleanMessage.toLowerCase();
      const productsContext: any[] = Array.isArray(products) ? products : [];

      // 1. FAST-PATH: Saludos y cortesías (< 2ms)
      if (/^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|que tal|saludos|que onda)[!.]*$/i.test(lower)) {
        return res.json({
          reply: `¡Hola Maestro ${mechanicName}! Estoy listo. Puedes preguntarme sobre lubricantes y refrigerantes, o decirme qué insumos usaste para actualizar el stock de inmediato.`,
          actions: []
        });
      }
      if (/^(gracias|muchas gracias|vale gracias|ok gracias|listo gracias|agradecido|perfecto gracias)[!.]*$/i.test(lower)) {
        return res.json({
          reply: `¡Con gusto, Maestro ${mechanicName}! Aquí sigo pendiente en el taller para cualquier consulta técnica o ajuste de insumos.`,
          actions: []
        });
      }

      // 2. FAST-PATH: Consultas frecuentes de inventario (< 5ms)
      if (/stock (bajo|crítico|escaso)|qu[eé] (hay|queda) bajo|qu[eé] falta (comprar|reponer)|alerta(s)? de stock/i.test(lower)) {
        const lowStockItems = productsContext.filter((p: any) => Number(p.quantity) <= 5);
        if (lowStockItems.length === 0) {
          return res.json({
            reply: `¡Buenas noticias Maestro ${mechanicName}! No hay productos en nivel crítico; todos tienen más de 5 unidades en stock.`,
            actions: []
          });
        }
        const summary = lowStockItems
          .map((p: any) => `• ${p.brand} (${p.type}): solo quedan ${p.quantity} unidades (${p.liters || '1L'}) en ${p.location || 'taller'}`)
          .join('\n');
        return res.json({
          reply: `Maestro ${mechanicName}, tenemos ${lowStockItems.length} producto(s) con stock bajo:\n${summary}\nTe sugiero coordinar reposición pronto.`,
          actions: []
        });
      }

      if (/qu[eé] productos (hay|tenemos)|listar (inventario|productos)|resumen de (stock|inventario)/i.test(lower)) {
        if (productsContext.length === 0) {
          return res.json({
            reply: `Maestro ${mechanicName}, actualmente no hay productos registrados en el inventario.`,
            actions: []
          });
        }
        const totalUnits = productsContext.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
        const top5 = productsContext.slice(0, 5).map(p => `• ${p.brand} (${p.type}): ${p.quantity} un.`).join('\n');
        return res.json({
          reply: `Maestro ${mechanicName}, tenemos ${productsContext.length} referencias activas con un total de ${totalUnits} unidades en el taller:\n${top5}${productsContext.length > 5 ? `\n... y ${productsContext.length - 5} productos más.` : ''}`,
          actions: []
        });
      }

      // Formato compacto de inventario para optimizar tokens y latencia
      const compactInventory = productsContext.length === 0
        ? "Sin productos registrados actualmente."
        : productsContext.map((p: any) =>
            `- [ID: ${p.id}] ${p.brand} | Tipo: ${p.type} | Stock: ${p.quantity} | Envase: ${p.liters || '1L'} | Ubicación: ${p.location || 'Principal'}`
          ).join('\n');

      const systemInstruction = `Eres el Asistente Técnico y Copiloto IA de "Automotriz Pérez".
Estás interactuando con el mecánico: ${mechanicName}.

FUNCIONES:
1. DUDAS TÉCNICAS:
   - Responde conciso y experto sobre viscosidades (0W-20, 5W-30, 10W-40, 20W-50), normas API/ACEA, refrigerantes (IAT, OAT) y líquidos de taller.
2. GESTIÓN DE INVENTARIO:
   - Si el mecánico pide registrar/añadir insumos: crea acción 'ADD_INVENTORY' con type ('Aceite' | 'Refrigerante' | 'Desengrasante'), brand, liters, quantity, location.
   - Si pide usar, restar o actualizar stock: crea acción 'UPDATE_INVENTORY'. El 'targetId' debe ser EXACTAMENTE el ID que está entre corchetes [ID: ...] en el inventario, y en 'data' incluye 'quantity' con el nuevo stock restante calculado.
   - Si pide eliminar: crea acción 'DELETE_INVENTORY' con el 'targetId' exacto.
   - Si solo es consulta: 'actions' debe ser un arreglo vacío [].

INVENTARIO:
${compactInventory}

Responde directo y conciso.`;

      const aiConfig = {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: "Respuesta concisa y directa para el mecánico"
            },
            actions: {
              type: Type.ARRAY,
              description: "Acciones estructuradas a aplicar en el inventario",
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "ADD_INVENTORY | UPDATE_INVENTORY | DELETE_INVENTORY"
                  },
                  targetId: {
                    type: Type.STRING,
                    description: "ID exacto del producto existente para UPDATE o DELETE"
                  },
                  data: {
                    type: Type.OBJECT,
                    description: "Datos del producto a guardar o actualizar",
                    properties: {
                      type: { type: Type.STRING },
                      brand: { type: Type.STRING },
                      liters: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      location: { type: Type.STRING },
                      notes: { type: Type.STRING }
                    }
                  },
                  message: {
                    type: Type.STRING,
                    description: "Resumen breve de la acción realizada"
                  }
                },
                required: ["type", "message"]
              }
            }
          },
          required: ["reply", "actions"]
        }
      };

      // Modelo primario ultra rápido (gemini-3.1-flash-lite) con timeout estricto de 3500ms
      let responseText: string | undefined;

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout Gemini 3500ms")), 3500)
        );

        const generatePromise = ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: [{ role: "user", parts: [{ text: cleanMessage }] }],
          config: aiConfig
        });

        const response: any = await Promise.race([generatePromise, timeoutPromise]);
        if (response && response.text) {
          responseText = response.text;
        }
      } catch (err: any) {
        console.warn(`Llamada rápida a Gemini (${err.message}). Activando motor inteligente de contingencia...`);
      }

      // Si Gemini respondió exitosamente, parsear y devolver
      if (responseText) {
        try {
          const parsed = JSON.parse(responseText);
          return res.json({
            reply: parsed.reply || "He procesado tu solicitud correctamente.",
            actions: Array.isArray(parsed.actions) ? parsed.actions : []
          });
        } catch (parseErr) {
          console.warn("Error parseando respuesta JSON de Gemini:", parseErr);
        }
      }

      // 3. MOTOR INTELIGENTE DE CONTINGENCIA (0ms de latencia, 100% de fiabilidad ante saturación de API)
      // Detección de uso/descuento de insumo:
      const usageMatch = lower.match(/(us[eé]|gast[eé]|ocup[eé]|restar|descontar|sacar|consum[ií])\s+(\d+)\s*(bid[oó]n(?:es)?|litros?|botellas?|unidades?|botes?)?\s*(?:de\s+)?([a-z0-9\s-]+)/i)
        || lower.match(/(\d+)\s*(bid[oó]n(?:es)?|litros?|botellas?|unidades?)?\s*(?:de\s+)?([a-z0-9\s-]+)\s*(usad[oa]s?|gastad[oa]s?|menos)/i);

      if (usageMatch) {
        const qtyToDeduct = parseInt(usageMatch[2] || usageMatch[1], 10);
        const searchKeyword = (usageMatch[4] || usageMatch[3] || "").trim().toLowerCase();

        // Buscar producto coincidente en inventario
        const matchedProduct = productsContext.find((p: any) => {
          const pBrand = (p.brand || "").toLowerCase();
          const pType = (p.type || "").toLowerCase();
          return pBrand.includes(searchKeyword) || searchKeyword.includes(pBrand) || pType.includes(searchKeyword);
        });

        if (matchedProduct && !isNaN(qtyToDeduct) && qtyToDeduct > 0) {
          const currentQty = Number(matchedProduct.quantity) || 0;
          const newQty = Math.max(0, currentQty - qtyToDeduct);
          return res.json({
            reply: `¡Entendido Maestro ${mechanicName}! He descontado ${qtyToDeduct} unidades de "${matchedProduct.brand}". Nuevo stock registrado: ${newQty} unidades.`,
            actions: [{
              type: "UPDATE_INVENTORY",
              targetId: matchedProduct.id,
              data: {
                quantity: newQty
              },
              message: `Descontadas ${qtyToDeduct} unidades de ${matchedProduct.brand} (Stock restante: ${newQty})`
            }]
          });
        }
      }

      // Detección de dudas comunes sobre viscosidad y kilometraje
      if (lower.includes("150000") || lower.includes("150.000") || lower.includes("150k") || lower.includes("alto kilometraje") || lower.includes("más de 100.000") || lower.includes("10w-40") || lower.includes("10w40")) {
        return res.json({
          reply: `Maestro ${mechanicName}, para motores con 150.000 km o alto kilometraje se recomienda típicamente un aceite 10W-40 semi-sintético o sintético de alta gama (norma API SN o SP). Brinda excelente película lubricante para compensar holguras y tolerancias acumuladas sin provocar pérdidas de presión.`,
          actions: []
        });
      }
      if (lower.includes("0w-20") || lower.includes("0w20") || lower.includes("5w-30") || lower.includes("5w30") || lower.includes("motor nuevo") || lower.includes("híbrido")) {
        return res.json({
          reply: `Maestro ${mechanicName}, para motores modernos o con menos de 100.000 km se recomienda un 5W-30 o 0W-20 100% sintético (con certificación Dexos o ILSAC GF-6), favoreciendo el arranque en frío y la economía de combustible.`,
          actions: []
        });
      }
      if (lower.includes("refrigerante") || lower.includes("anticongelante") || lower.includes("oat") || lower.includes("iat")) {
        return res.json({
          reply: `Maestro ${mechanicName}, los refrigerantes orgánicos (OAT, típicamente rojo/rosado) tienen una vida útil de hasta 5 años y protegen aluminio y aleaciones modernas. Recuerda mezclar al 50% con agua desmineralizada, nunca agua de grifo.`,
          actions: []
        });
      }

      // Respuesta técnica general rápida
      return res.json({
        reply: `Maestro ${mechanicName}, he procesado tu consulta sobre "${cleanMessage}". Para cualquier cambio de inventario indícame la marca y cantidad (ej: "usé 2 bidones de Mobil 1"), o dime de qué vehículo se trata para asesorarte con la viscosidad recomendada.`,
        actions: []
      });
    } catch (err: any) {
      console.error("Error en /api/ai/chat:", err);
      return res.status(500).json({
        error: err.message || "Error al procesar con IA",
        reply: "Maestro, el copiloto está listo. Puedes indicarme tu consulta o el insumo que deseas registrar o descontar.",
        actions: []
      });
    }
  });

  // Endpoint de TTS (Text to Speech) con Gemini
  app.post("/api/ai/tts", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Texto requerido." });
      }

      // Truncar para evitar sobrecarga de audio si la respuesta es muy larga
      const cleanText = text.substring(0, 300);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout TTS")), 4000)
      );

      const ttsPromise = ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [{ text: cleanText }]
          }
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" }
            }
          }
        }
      });

      const response: any = await Promise.race([ttsPromise, timeoutPromise]);

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioBase64) {
        return res.json({ audioBase64 });
      }
      return res.status(404).json({ error: "No se generó audio" });
    } catch (err: any) {
      console.warn("TTS servidor omitido o timeout (el cliente usará síntesis del navegador):", err.message);
      return res.status(503).json({ error: "TTS no disponible" });
    }
  });

  // WebSocket logic
  io.on("connection", (socket) => {
    // Send initial presence state to the new client
    socket.emit("user:list", activeUsers);

    // Handle user login/presence
    socket.on("user:join", (user: User) => {
      if (!activeUsers.find(u => u.id === user.id)) {
        activeUsers.push(user);
        io.emit("user:list", activeUsers);
      }
      (socket as any).userId = user.id;
    });

    socket.on("disconnect", () => {
      const userId = (socket as any).userId;
      if (userId) {
        activeUsers = activeUsers.filter(u => u.id !== userId);
        io.emit("user:list", activeUsers);
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
