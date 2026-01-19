const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { openai } = require('./openaiClient'); // Asegúrate de exportar openai correctamente aquí

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 1. CARGAMOS LOS TRES IDs
const ASSISTANT_ID = process.env.ASSISTANT_ID; // El Chatbot
const ASSISTANT_INTERACTION_ID = process.env.ASSISTANT_INTERACTION_ID; // Agente de Interacción (SIEMPRE)
const ASSISTANT_ANALYTICS_ID = process.env.ASSISTANT_ANALYTICS_ID; // Agente de Funnel (CONDICIONAL)

console.log('Bot ID:', ASSISTANT_ID);
console.log('Interacción ID:', ASSISTANT_INTERACTION_ID);
console.log('Analista Funnel ID:', ASSISTANT_ANALYTICS_ID);

app.post('/api/chat', async (req, res) => {
  try {
    const { message, threadId: clientThreadId } = req.body;

    if (!message) return res.status(400).json({ error: 'Falta el mensaje' });

    // =================================================================================
    // FASE 1: EL CHATBOT (Vendedor)
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
    console.log('🤖 Ejecutando Chatbot...');
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
      
      console.log('📝 Respuesta raw del bot:', rawContent.substring(0, 200) + '...');
      
      // Intentamos parsear como JSON (nuevo formato)
      try {
        // Limpiamos posibles marcadores de código
        let cleanJson = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        
        botReply = parsed.response || rawContent;
        itemDetails = parsed.itemDetails || null;
        
        console.log('✅ Respuesta parseada como JSON');
        if (itemDetails) {
          console.log('🛒 Producto detectado:', itemDetails.name);
        }
      } catch (e) {
        // Si no es JSON válido, usamos el texto tal cual (fallback)
        console.log('⚠️ Respuesta no es JSON, usando texto plano');
        botReply = rawContent;
        itemDetails = null;
      }
      
      // Limpiar markdown de imágenes que no queremos mostrar en el chat
      // Elimina patrones como ![Imagen](images/...) o ![texto](url)
      botReply = botReply.replace(/!\[.*?\]\(.*?\)/g, '').trim();
      // Eliminar líneas vacías extra que puedan quedar
      botReply = botReply.replace(/\n{3,}/g, '\n\n');
    }

    console.log(`💬 Respuesta: "${botReply.substring(0, 100)}..."`);


    // =================================================================================
    // FASE 2: AGENTE DE INTERACCIÓN (SIEMPRE se ejecuta)
    // =================================================================================
    let interactionData = null;

    try {
      console.log('� Ejecutando Agente de Interacción...');

      const interactionThread = await openai.beta.threads.create();

      const contextoInteraccion = `
        ANALIZA ESTA INTERACCIÓN:
        - Usuario dijo: "${message}"
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
          interactionData = JSON.parse(jsonRaw);
          console.log('✅ Interacción:', JSON.stringify(interactionData, null, 2));
        }
      }
    } catch (err) {
      console.error('⚠️ Error en agente de interacción:', err.message);
      interactionData = null;
    }

    // =================================================================================
    // FASE 3: AGENTE DE FUNNEL (Solo si detecta evento de ecommerce)
    // =================================================================================
    let analyticsData = null;

    try {
      console.log('🕵️ Ejecutando Agente de Funnel...');

      const analyticsThread = await openai.beta.threads.create();

      // Preparamos el contexto completo incluyendo itemDetails
      const itemDetailsJson = itemDetails ? JSON.stringify(itemDetails) : 'null';

      const contextoFunnel = `
        ANALIZA ESTA INTERACCIÓN PARA DETECTAR EVENTOS DE FUNNEL:
        
        - Usuario dijo: "${message}"
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
          
          // Solo guardamos si hay un evento real (no null)
          if (parsed.event && parsed.event !== null) {
            analyticsData = parsed;
            console.log('📈 Funnel detectado:', JSON.stringify(analyticsData, null, 2));
          } else {
            console.log('ℹ️ No se detectó evento de funnel');
          }
        }
      }
    } catch (err) {
      console.error('⚠️ Error en agente de funnel:', err.message);
      analyticsData = null;
    }

    // =================================================================================
    // FASE 4: RESPUESTA FINAL
    // =================================================================================
    return res.json({
      reply: botReply,
      itemDetails: itemDetails,        // Datos del producto (si aplica)
      threadId: mainThreadId,
      interaction: interactionData,    // SIEMPRE se envía
      analytics: analyticsData,        // Solo si hay evento de funnel
    });

  } catch (err) {
    console.error('--- ERROR CRÍTICO EN /api/chat ---');
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server en http://localhost:${PORT}`));