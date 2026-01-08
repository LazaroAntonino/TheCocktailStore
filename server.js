// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { openai } = require('./openaiClient');

const app = express();
app.use(cors());
app.use(express.json());

// Servir tus archivos estáticos (index.html, css, js, etc.)
const publicDir = __dirname; // si todo está en la raíz
app.use(express.static(publicDir));

const ASSISTANT_ID = process.env.ASSISTANT_ID;
console.log('ASSISTANT_ID cargado:', ASSISTANT_ID ? ASSISTANT_ID : 'NO DEFINIDO, revisa .env');

// Endpoint que usará el frontend: POST /api/chat
app.post('/api/chat', async (req, res) => {
try {
  const { message, threadId: clientThreadId } = req.body;
  console.log('--- Nueva solicitud de chat ---');
  console.log('Mensaje recibido:', message);
  console.log('threadId del cliente (clientThreadId):', clientThreadId);

  if (!message) {
    return res.status(400).json({ error: 'Falta el mensaje' });
  }

  let threadId = clientThreadId;

  // 1) Crear thread si no existe
  if (!threadId) {
    console.log('threadId vacío → creando nuevo hilo...');
    const thread = await openai.beta.threads.create();
    threadId = thread.id;
    console.log('Nuevo hilo creado con ID:', threadId);
  } else {
    console.log('Usando threadId existente:', threadId);
  }

  // 2) Añadir el mensaje del usuario al hilo
  console.log('Añadiendo mensaje al hilo:', threadId);
  await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: message,
  });
  console.log('Mensaje añadido.');

  // 3) Crear run del assistant y esperar a que termine (helper createAndPoll)
  console.log('Creando run con createAndPoll para threadId:', threadId);
  const run = await openai.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: ASSISTANT_ID,
  });
  console.log('Run finalizada. Estado:', run.status);

  if (['failed', 'cancelled', 'expired'].includes(run.status)) {
    throw new Error(`La ejecución terminó con estado: ${run.status}`);
  }

  // 4) Obtener mensajes del hilo y coger el último del assistant
  console.log('Recuperando mensajes del hilo:', threadId);
  const messages = await openai.beta.threads.messages.list(threadId);
  const assistantMsg = messages.data.find((m) => m.role === 'assistant');

  let reply = 'Lo siento, no pude obtener respuesta del asistente.';
  if (assistantMsg && Array.isArray(assistantMsg.content)) {
    const textPart = assistantMsg.content.find((c) => c.type === 'text');
    if (textPart?.text?.value) {
      reply = textPart.text.value;
    }
  }
  console.log('Respuesta del asistente:', reply);

  return res.json({ reply, threadId });
} catch (err) {
  console.error('--- ERROR en /api/chat ---');
  console.error(err);
  return res.status(500).json({ error: err.message || 'Error interno del servidor' });
}
});

// Arrancar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
console.log(`Servidor escuchando en http://localhost:${PORT}`);
console.log(`Abre http://localhost:${PORT}/index.html`);
});