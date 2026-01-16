// js/chatbot.js
(() => {
  const $ = (id) => document.getElementById(id);
  const toggle = $('tcs-chat-toggle');
  const widget = $('tcs-chat-widget');
  const backdrop = $('tcs-chat-backdrop');
  const closeBtn = $('tcs-chat-close');
  const resetKeyBtn = $('tcs-chat-reset-key');
  const form = $('tcs-chat-form');
  const input = $('tcs-chat-text');
  const messagesEl = $('tcs-chat-messages');

  if (!toggle || !widget || !backdrop || !closeBtn || !form || !input || !messagesEl) return;

  const state = { sending: false, open: false, threadId: null };
  const messages = [];

  function pushEvent(name, data = {}) {
    try {
      if (window.dataLayer) window.dataLayer.push({ event: name, ...data });
    } catch (_) { }
  }

  async function logToSheets(userMsg, botMsg) {
    const SHEET_URL =
      'https://script.google.com/macros/s/AKfycbwc5Zyc3bVzUYXpoTl3eFqOinkLnXCtkzzYT7DQmKj5-TpxKvTxMb6ME5FvOs8BLW618w/exec';

    try {
      await fetch(SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userMsg,
          botResponse: botMsg,
          sessionId: Date.now(),
        }),
      });
    } catch (err) {
      console.error('Error logging to sheets:', err);
    }
  }

  function addMessage(text, who = 'bot', type = 'normal') {
    const div = document.createElement('div');
    div.className = type === 'status' ? 'tcs-msg status' : `tcs-msg ${who}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'tcs-msg bot';
    const inner = document.createElement('div');
    inner.className = 'tcs-typing';
    inner.innerHTML =
      '<span class="tcs-typing-dot"></span><span class="tcs-typing-dot"></span><span class="tcs-typing-dot"></span>';
    wrap.appendChild(inner);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  function openChat() {
    if (state.open) return;
    backdrop.classList.remove('tcs-hidden');
    widget.classList.remove('tcs-hidden');
    requestAnimationFrame(() => {
      backdrop.classList.add('show');
      widget.classList.add('open');
    });
    widget.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    state.open = true;
    pushEvent('chat_opened');
    if (messages.length === 0) {
      addMessage('¡Hola! Soy el asistente de The Cocktail Store. ¿En qué puedo ayudarte hoy?', 'bot');
    }
    setTimeout(() => input.focus(), 150);
    document.addEventListener('keydown', onEsc);
  }

  function closeChat() {
    if (!state.open) return;
    backdrop.classList.remove('show');
    widget.classList.remove('open');
    widget.addEventListener(
      'transitionend',
      () => {
        backdrop.classList.add('tcs-hidden');
        widget.classList.add('tcs-hidden');
      },
      { once: true }
    );
    widget.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    state.open = false;
    pushEvent('chat_closed');
    document.removeEventListener('keydown', onEsc);
  }

  function onEsc(e) {
    if (e.key === 'Escape') closeChat();
  }

  toggle.addEventListener('click', () => {
    state.open ? closeChat() : openChat();
  });
  closeBtn.addEventListener('click', closeChat);
  backdrop.addEventListener('click', closeChat);

  if (resetKeyBtn) {
    resetKeyBtn.addEventListener('click', () => {
      addMessage('La API key ya no se configura desde el navegador.', 'bot', 'status');
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.sending) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    input.disabled = true;

    messages.push({ role: 'user', content: text });
    addMessage(text, 'user');
    const typingEl = showTyping();
    state.sending = true;

    try {
      // Llamamos al backend
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          threadId: state.threadId,
        }),
      });

      const data = await res.json();
      typingEl.remove();

      if (!res.ok || data.error) {
        const msg = data.error || `Error ${res.status}`;
        addMessage(`Error: ${msg}`, 'bot');
        pushEvent('chat_error', { status: res.status, message: msg });
        return;
      }

      const reply = data.reply || 'Lo siento, no pude responder ahora.';
      if (data.threadId) state.threadId = data.threadId;

      addMessage(reply, 'bot');
      messages.push({ role: 'assistant', content: reply });
      await logToSheets(text, reply);

      // ==========================================================
      // AGENTE 1: INTERACCIÓN (SIEMPRE se envía)
      // ==========================================================
      if (data.interaction) {
        console.log('📊 Push Interacción:', data.interaction);
        window.dataLayer.push(data.interaction);
      }

      // ==========================================================
      // AGENTE 2: FUNNEL (Solo si hay evento de ecommerce)
      // ==========================================================
      if (data.analytics && data.analytics.event) {
        console.log('📈 Push Funnel:', data.analytics);
        window.dataLayer.push(data.analytics);
      }
      // ==========================================================

    } catch (err) {
      typingEl.remove();
      addMessage('Error al conectar con el servidor. Intenta de nuevo.', 'bot');
      console.error(err); // Agregué console log para debug
      pushEvent('chat_error', { message: String(err) });
    } finally {
      state.sending = false;
      input.disabled = false;
      if (submitBtn) submitBtn.disabled = false;
      input.focus();
    }
  });
})();