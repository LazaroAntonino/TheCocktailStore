const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { openai } = require('./openaiClient'); // Asegúrate de exportar openai correctamente aquí

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 1. CARGAMOS LOS TRES IDs
const ASSISTANT_ID = process.env.ASSISTANT_ID;
const ASSISTANT_INTERACTION_ID = process.env.ASSISTANT_INTERACTION_ID;
const ASSISTANT_ANALYTICS_ID = process.env.ASSISTANT_ANALYTICS_ID;

// Cache temporal para almacenar analytics pendientes (en producción usar Redis)
const analyticsCache = new Map();

// Limpieza automática del cache cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of analyticsCache.entries()) {
    if (now - value.timestamp > 5 * 60 * 1000) { // 5 minutos
      analyticsCache.delete(key);
    }
  }
}, 60 * 1000);

// =================================================================================
// FUNCIÓN: Ejecutar agentes de analytics en background (no bloquea)
// =================================================================================
async function runAnalyticsAgentsInBackground(messageId, userMessage, botReply, itemDetails) {
  const results = { interaction: null, analytics: null, ready: false };
  
  try {
    // Ejecutamos AMBOS agentes en PARALELO
    const [interactionResult, funnelResult] = await Promise.allSettled([
      // Agente de Interacción
      (async () => {
        const interactionThread = await openai.beta.threads.create();
        
        const contextoInteraccion = `
          ANALIZA ESTA INTERACCIÓN:
          - Usuario dijo: "${userMessage}"
          - Chatbot respondió: "${botReply}"
          
          Genera el objeto JSON de chatbot_interaction según tus instrucciones.
        `;

        await openai.beta.threads.messages.create(interactionThread.id, {
          role: 'user',
          content: contextoInteraccion,
        });

        const runInteraction = await openai.beta.threads.runs.createAndPoll(interactionThread.id, {
          assistant_id: ASSISTANT_INTERACTION_ID,
        });

        if (runInteraction.status === 'completed') {
          const iMessages = await openai.beta.threads.messages.list(interactionThread.id);
          const iMsg = iMessages.data[0];

          if (iMsg && iMsg.content[0].type === 'text') {
            let jsonRaw = iMsg.content[0].text.value;
            jsonRaw = jsonRaw.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonRaw);
          }
        }
        return null;
      })(),
      
      // Agente de Funnel
      (async () => {
        const analyticsThread = await openai.beta.threads.create();
        
        const itemDetailsJson = itemDetails ? JSON.stringify(itemDetails) : 'null';

        const contextoFunnel = `
          ANALIZA ESTA INTERACCIÓN PARA DETECTAR EVENTOS DE FUNNEL:
          
          - Usuario dijo: "${userMessage}"
          - Chatbot respondió: "${botReply}"
          - Productos mostrados (itemDetails): ${itemDetailsJson}
          
          IMPORTANTE: Usa los datos de "itemDetails" para construir el array "items" del evento.
          - Si itemDetails es un objeto, es UN producto.
          - Si itemDetails es un array, son VARIOS productos.
          - Si itemDetails es null, no se mostró ningún producto.
          
          Si detectas un evento de funnel (view_item, view_item_list, add_to_cart, view_search_results), devuelve el JSON con los items correctos.
          Si NO hay evento de funnel, devuelve: {"event": null}
        `;

        await openai.beta.threads.messages.create(analyticsThread.id, {
          role: 'user',
          content: contextoFunnel,
        });

        const runAnalytics = await openai.beta.threads.runs.createAndPoll(analyticsThread.id, {
          assistant_id: ASSISTANT_ANALYTICS_ID,
        });

        if (runAnalytics.status === 'completed') {
          const aMessages = await openai.beta.threads.messages.list(analyticsThread.id);
          const aMsg = aMessages.data[0];

          if (aMsg && aMsg.content[0].type === 'text') {
            let jsonRaw = aMsg.content[0].text.value;
            jsonRaw = jsonRaw.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonRaw);
            
            if (parsed.event && parsed.event !== null) {
              return parsed;
            }
          }
        }
        return null;
      })()
    ]);

    // Procesamos resultados
    if (interactionResult.status === 'fulfilled' && interactionResult.value) {
      results.interaction = interactionResult.value;
    }

    if (funnelResult.status === 'fulfilled' && funnelResult.value) {
      results.analytics = funnelResult.value;
    }

  } catch (err) {
    // Error silencioso en background
  }

  // Actualizamos el cache existente (no creamos uno nuevo)
  const cached = analyticsCache.get(messageId);
  if (cached) {
    cached.interaction = results.interaction;
    cached.analytics = results.analytics;
    cached.ready = true;
    cached.timestamp = Date.now();
  } else {
    results.ready = true;
    results.timestamp = Date.now();
    analyticsCache.set(messageId, results);
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, threadId: clientThreadId } = req.body;

    if (!message) return res.status(400).json({ error: 'Falta el mensaje' });

    // =================================================================================
    // FASE 1: EL CHATBOT (Vendedor) - RESPUESTA INMEDIATA
    // =================================================================================
    let mainThreadId = clientThreadId;

    // 1. Crear hilo si no existe (Persistente para el usuario)
    if (!mainThreadId) {
      const thread = await openai.beta.threads.create();
      mainThreadId = thread.id;
    }

    // 2. Añadir mensaje del usuario
    await openai.beta.threads.messages.create(mainThreadId, {
      role: 'user',
      content: message,
    });

    // 3. Ejecutar Assistant 1 (Vendedor)
    const runBot = await openai.beta.threads.runs.createAndPoll(mainThreadId, {
      assistant_id: ASSISTANT_ID,
    });

    if (runBot.status !== 'completed') {
      throw new Error(`El chatbot falló con estado: ${runBot.status}`);
    }

    // 4. Recuperar respuesta del Vendedor (el mensaje más reciente del assistant)
    const messagesBot = await openai.beta.threads.messages.list(mainThreadId, {
      order: 'desc',
      limit: 10
    });
    // data[0] es el mensaje más reciente, buscamos el primer assistant
    const botMsgObj = messagesBot.data.find((m) => m.role === 'assistant');

    let botReply = "Lo siento, hubo un error de comunicación.";
    let itemDetails = null;

    if (botMsgObj && botMsgObj.content[0].type === 'text') {
      const rawContent = botMsgObj.content[0].text.value;
      
      // Intentamos parsear como JSON (nuevo formato)
      try {
        // Limpiamos posibles marcadores de código
        let cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        
        botReply = parsed.response || rawContent;
        itemDetails = parsed.itemDetails || null;
      } catch (e) {
        // Si no es JSON válido, usamos el texto tal cual (fallback)
        botReply = rawContent;
        itemDetails = null;
      }
      
      // Limpiar markdown de imágenes que no queremos mostrar en el chat
      // Elimina patrones como ![Imagen](images/...) o ![texto](url)
      botReply = botReply.replace(/!\[.*?\]\(.*?\)/g, '').trim();
      // Eliminar líneas vacías extra que puedan quedar
      botReply = botReply.replace(/\n{3,}/g, '\n\n');
    }

    // =================================================================================
    // FASE 2: GENERAR ID ÚNICO Y LANZAR ANALYTICS EN BACKGROUND
    // =================================================================================
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Inicializamos el cache ANTES de lanzar el proceso para evitar race conditions
    analyticsCache.set(messageId, { 
      interaction: null, 
      analytics: null, 
      ready: false, 
      timestamp: Date.now() 
    });
    
    // Lanzamos los agentes en background (no bloqueante)
    setImmediate(() => {
      runAnalyticsAgentsInBackground(messageId, message, botReply, itemDetails);
    });

    // =================================================================================
    // FASE 3: RESPUESTA INMEDIATA AL FRONTEND
    // =================================================================================
    return res.json({
      reply: botReply,
      itemDetails: itemDetails,        // Datos del producto (si aplica)
      threadId: mainThreadId,
      messageId: messageId,            // ID para consultar analytics después
      // interaction y analytics ya NO se esperan aquí
    });

  } catch (err) {
    console.error('--- ERROR CRÍTICO EN /api/chat ---');
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =================================================================================
// ENDPOINT: Obtener analytics de un mensaje (polling desde frontend)
// =================================================================================
app.get('/api/chat/analytics/:messageId', (req, res) => {
  const { messageId } = req.params;
  const cached = analyticsCache.get(messageId);
  
  if (!cached) {
    // No existe aún en cache, el proceso background aún no terminó
    return res.json({ ready: false, interaction: null, analytics: null });
  }
  
  if (!cached.ready) {
    // Existe pero aún no está listo
    return res.json({ ready: false, interaction: null, analytics: null });
  }
  
  // Está listo - devolver y marcar como entregado (no borrar inmediatamente)
  // Lo borramos después de un delay para evitar race conditions
  if (!cached.delivered) {
    cached.delivered = true;
    // Borrar del cache después de 10 segundos
    setTimeout(() => {
      analyticsCache.delete(messageId);
    }, 10000);
  }
  
  return res.json({
    ready: true,
    interaction: cached.interaction,
    analytics: cached.analytics
  });
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server en http://localhost:${PORT}`));