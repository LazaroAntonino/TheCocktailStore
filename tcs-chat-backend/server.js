const express = require('express');
const cors = require('cors');
require('dotenv').config();

console.log('DEBUG ENV:');
console.log('  OPENAI_API_KEY existe?', !!process.env.OPENAI_API_KEY);
console.log('  ASSISTANT_ID:', process.env.ASSISTANT_ID);

const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// Cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.ASSISTANT_ID;

// Endpoint del chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message, threadId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Falta el campo "message"' });
    }

    // 1) Crear thread si no nos pasan uno
    let thread_id = threadId;
    if (!thread_id) {
      const thread = await openai.beta.threads.create();
      thread_id = thread.id;
    }

    // 2) Añadir mensaje del usuario al thread
    await openai.beta.threads.messages.create(thread_id, {
      role: 'user',
      content: message,
    });

    // 3) Lanzar el run del assistant
    let run = await openai.beta.threads.runs.create(thread_id, {
      assistant_id: ASSISTANT_ID,
    });

    // 👇 bucle corregido
    while (run.status === 'queued' || run.status === 'in_progress') {
      await new Promise((r) => setTimeout(r, 1000));
      run = await openai.beta.threads.runs.retrieve(
        run.id,
        { thread_id: thread_id }
      );
    }

    if (run.status !== 'completed') {
      return res.status(500).json({ error: `Run falló con estado: ${run.status}` });
    }

    // 5) Obtener mensajes y coger el último del assistant
    const messages = await openai.beta.threads.messages.list(thread_id, {
      limit: 10,
    });

    const lastAssistantMsg = messages.data.find((m) => m.role === 'assistant');

    const reply =
      lastAssistantMsg?.content?.[0]?.text?.value ||
      'Lo siento, no pude generar una respuesta ahora.';

    return res.json({
      reply,
      threadId: thread_id,
    });
  } catch (err) {
    console.error('Error en /api/chat:', err);
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

// Arrancar servidor
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Servidor de chat escuchando en http://localhost:${port}`);
});