const OpenAI = require('openai');

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.ASSISTANT_ID;

exports.handler = async (event, context) => {
try {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const { message, threadId } = JSON.parse(event.body || '{}');

  if (!message) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Falta el campo "message"' }),
    };
  }

  let thread_id = threadId;
  if (!thread_id) {
    const thread = await openai.beta.threads.create();
    thread_id = thread.id;
  }

  await openai.beta.threads.messages.create(thread_id, {
    role: 'user',
    content: message,
  });

  let run = await openai.beta.threads.runs.create(thread_id, {
    assistant_id: ASSISTANT_ID,
  });

  while (run.status === 'queued' || run.status === 'in_progress') {
    await new Promise((r) => setTimeout(r, 1000));
    run = await openai.beta.threads.runs.retrieve(run.id, {
      thread_id: thread_id,
    });
  }

  if (run.status !== 'completed') {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Run falló con estado: ${run.status}` }),
    };
  }

  const messages = await openai.beta.threads.messages.list(thread_id, {
    limit: 10,
  });

  const lastAssistantMsg = messages.data.find((m) => m.role === 'assistant');

  const reply =
    lastAssistantMsg?.content?.[0]?.text?.value ||
    'Lo siento, no pude generar una respuesta ahora.';

  return {
    statusCode: 200,
    body: JSON.stringify({
      reply,
      threadId: thread_id,
    }),
  };
} catch (err) {
  console.error('Error en function /chat:', err);
  return {
    statusCode: 500,
    body: JSON.stringify({
      error: 'Error interno en el servidor',
      detail: err.message || String(err),
    }),
  };
}
};