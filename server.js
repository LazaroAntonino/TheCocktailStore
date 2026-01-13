const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { openai } = require('./openaiClient'); // Asegúrate de exportar openai correctamente aquí

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 1. CARGAMOS LOS DOS IDs
const ASSISTANT_ID = process.env.ASSISTANT_ID; // El Chatbot
const ASSISTANT_ANALYTICS_ID = process.env.ASSISTANT_ANALYTICS_ID; // El Analista

console.log('Bot ID:', ASSISTANT_ID);
console.log('Analista ID:', ASSISTANT_ANALYTICS_ID);

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

    // 4. Recuperar respuesta del Vendedor
    const messages = await openai.beta.threads.messages.list(mainThreadId);
    // data[0] suele ser el último mensaje, pero filtramos por si acaso
    const botMsgObj = messages.data.find((m) => m.role === 'assistant');

    let botReply = "Lo siento, hubo un error de comunicación.";
    if (botMsgObj && botMsgObj.content[0].type === 'text') {
      botReply = botMsgObj.content[0].text.value;
    }

    console.log(`💬 Respuesta: "${botReply}"`);


    // =================================================================================
    // FASE 2: EL ANALISTA (Experto GA4)
    // =================================================================================
    let analyticsData = null;

    try {
      console.log('🕵️ Ejecutando Analista (Assistant Dedicado)...');

      // A. Creamos un hilo TEMPORAL (usar y tirar)
      const analyticsThread = await openai.beta.threads.create();

      // B. Contexto para el analista
      const contexto = `
        ANALISIS DE INTERACCIÓN:
        - Usuario dijo: "${message}"
        - Chatbot respondió: "${botReply}"
        
        Recuerda tus instrucciones: Eres el Arquitecto de Datos.
        Genera el objeto JSON para DataLayer basándote en esta interacción.
      `;

      await openai.beta.threads.messages.create(analyticsThread.id, {
        role: 'user',
        content: contexto,
      });

      // C. Ejecutamos el Assistant 2 (Analista)
      const runAnalytics = await openai.beta.threads.runs.createAndPoll(analyticsThread.id, {
        assistant_id: ASSISTANT_ANALYTICS_ID, // <--- Tu segundo ID del .env
      });

      if (runAnalytics.status === 'completed') {
        const aMessages = await openai.beta.threads.messages.list(analyticsThread.id);
        const aMsg = aMessages.data[0]; // El último mensaje es la respuesta

        if (aMsg && aMsg.content[0].type === 'text') {
          let jsonRaw = aMsg.content[0].text.value;

          // --- LIMPIEZA DE SEGURIDAD ---
          // A veces GPT devuelve '''json { ... } ''', esto lo limpia:
          jsonRaw = jsonRaw.replace(/```json/g, '').replace(/```/g, '').trim();

          analyticsData = JSON.parse(jsonRaw);
          console.log('📊 JSON Generado:', JSON.stringify(analyticsData, null, 2));
        }
      }

      // D. IMPORTANTE: Borrar el hilo temporal para no ensuciar tu cuenta de OpenAI
      // await openai.beta.threads.del(analyticsThread.id);

    } catch (err) {
      console.error('⚠️ Error en el proceso de analítica:', err.message);
      // Fallamos silenciosamente en analítica para no romper el chat del usuario
      analyticsData = null;
    }

    // =================================================================================
    // FASE 3: RESPUESTA FINAL
    // =================================================================================
    return res.json({
      reply: botReply,
      threadId: mainThreadId,
      analytics: analyticsData,
    });

  } catch (err) {
    console.error('--- ERROR CRÍTICO EN /api/chat ---');
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server en http://localhost:${PORT}`));