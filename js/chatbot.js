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

  const state = { sending: false, open: false, threadId: null, conversationId: null };
  const messages = [];

  const CID_KEY = 'tcs_conversation_id';

  function newConversationId() {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    return `cid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function getOrCreateConversationId() {
    let cid = sessionStorage.getItem(CID_KEY);
    if (!cid) {
      cid = newConversationId();
      sessionStorage.setItem(CID_KEY, cid);
    }
    return cid;
  }

  function resetConversationId() {
    const cid = newConversationId();
    sessionStorage.setItem(CID_KEY, cid);
    return cid;
  }

  state.conversationId = getOrCreateConversationId();

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
          conversation_id: state.conversationId,
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

    if (!state.conversationId) state.conversationId = getOrCreateConversationId();

    backdrop.classList.remove('tcs-hidden');
    widget.classList.remove('tcs-hidden');
    requestAnimationFrame(() => {
      backdrop.classList.add('show');
      widget.classList.add('open');
    });

    widget.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    state.open = true;

    pushEvent('chat_opened', { conversation_id: state.conversationId });

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
    pushEvent('chat_closed', { conversation_id: state.conversationId });
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
      state.conversationId = resetConversationId();

      state.threadId = null;

      messages.length = 0;
      messagesEl.innerHTML = '';

      addMessage('Nueva conversación iniciada. ¿En qué puedo ayudarte?', 'bot');
      pushEvent('chat_new_conversation', { conversation_id: state.conversationId });
      setTimeout(() => input.focus(), 50);
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

    if (!state.conversationId) state.conversationId = getOrCreateConversationId();

    messages.push({ role: 'user', content: text });
    addMessage(text, 'user');

    pushEvent('chat_message_sent', { conversation_id: state.conversationId });

    const typingEl = showTyping();
    state.sending = true;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          threadId: state.threadId,
          conversation_id: state.conversationId,
        }),
      });

      const data = await res.json();
      typingEl.remove();

      if (!res.ok || data.error) {
        const msg = data.error || `Error ${res.status}`;
        addMessage(`Error: ${msg}`, 'bot');
        pushEvent('chat_error', { status: res.status, message: msg, conversation_id: state.conversationId });
        return;
      }

      const reply = data.reply || 'Lo siento, no pude responder ahora.';
      if (data.threadId) state.threadId = data.threadId;

      addMessage(reply, 'bot');
      messages.push({ role: 'assistant', content: reply });

      pushEvent('chat_message_received', { conversation_id: state.conversationId });

      await logToSheets(text, reply);

      // ==========================================================
      // TARJETA DE PRODUCTO (Si el bot muestra un producto)
      // ==========================================================
      if (data.itemDetails) {
        const item = data.itemDetails;
        console.log('🛒 Producto mostrado:', item);

        const card = document.createElement('div');
        card.className = 'tcs-product-card';

        card.innerHTML = `
          <img class="tcs-product-image" src="${item.image}" alt="${item.name}">
          <div class="tcs-product-info">
            <div class="tcs-product-name">${item.name}</div>
            <div class="tcs-product-price">${item.price.toFixed(2)}€</div>
            <div class="tcs-product-desc">${item.description}</div>
            <div class="tcs-product-actions">
              <a href="product.html?id=${item.id}" class="tcs-product-link">Ver detalles</a>
              <button class="tcs-product-add-cart" data-product='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                <i class="fas fa-cart-plus"></i> Añadir
              </button>
            </div>
          </div>
        `;

        // Event listener para el botón de añadir al carrito
        const addCartBtn = card.querySelector('.tcs-product-add-cart');
        addCartBtn.addEventListener('click', () => {
          if (window.cartService) {
            window.cartService.addItem(item);
            
            // Feedback visual
            addCartBtn.innerHTML = '<i class="fas fa-check"></i> ¡Añadido!';
            addCartBtn.disabled = true;
            addCartBtn.classList.add('added');
            
            setTimeout(() => {
              addCartBtn.innerHTML = '<i class="fas fa-cart-plus"></i> Añadir';
              addCartBtn.disabled = false;
              addCartBtn.classList.remove('added');
            }, 2000);

            // Evento de analítica
            window.dataLayer.push({
              event: 'add_to_cart',
              event_category: 'ecommerce',
              event_action: 'add_to_cart_chatbot',
              event_label: item.name,
              currency: 'EUR',
              value: item.price,
              items: [{
                item_id: item.id,
                item_name: item.name,
                price: item.price,
                item_category: item.category,
                quantity: 1
              }]
            });
          } else {
            console.error('CartService no disponible');
          }
        });

        messagesEl.appendChild(card);
        messagesEl.scrollTop = messagesEl.scrollHeight;

        // Evento de analítica para producto mostrado en chat
        window.dataLayer.push({
          event: 'chat_product_shown',
          item_id: item.id,
          item_name: item.name,
          item_price: item.price,
          item_category: item.category,
        });
      }

      // ==========================================================
      // AGENTE 1: INTERACCIÓN (SIEMPRE se envía)
      // ==========================================================
      if (data.interaction) {
        console.log('📊 Push Interacción:', data.interaction);
        window.dataLayer.push({ ...data.interaction, conversation_id: state.conversationId });
      }

      // ==========================================================
      // AGENTE 2: FUNNEL (Solo si hay evento de ecommerce)
      // ==========================================================
      if (data.analytics && data.analytics.event) {
        console.log('📈 Push Funnel:', data.analytics);
        window.dataLayer.push({ ...data.analytics, conversation_id: state.conversationId });
      }
      // ==========================================================

    } catch (err) {
      typingEl.remove();
      addMessage('Error al conectar con el servidor. Intenta de nuevo.', 'bot');
      console.error(err);
      pushEvent('chat_error', { message: String(err), conversation_id: state.conversationId });
    } finally {
      state.sending = false;
      input.disabled = false;
      if (submitBtn) submitBtn.disabled = false;
      input.focus();
    }
  });
})();