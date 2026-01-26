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
  let messages = [];

  const CID_KEY = 'tcs_conversation_id';
  const TID_KEY = 'tcs_thread_id';
  const MSG_KEY = 'tcs_chat_messages';

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

  // Persistir threadId
  function getThreadId() {
    return sessionStorage.getItem(TID_KEY);
  }

  function setThreadId(tid) {
    if (tid) {
      sessionStorage.setItem(TID_KEY, tid);
    }
  }

  function clearThreadId() {
    sessionStorage.removeItem(TID_KEY);
  }

  // Persistir mensajes
  function getStoredMessages() {
    try {
      const stored = sessionStorage.getItem(MSG_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveMessages() {
    try {
      sessionStorage.setItem(MSG_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error('Error saving messages:', e);
    }
  }

  function clearStoredMessages() {
    sessionStorage.removeItem(MSG_KEY);
  }

  // Función para crear tarjeta de producto (reutilizable)
  function createProductCard(item) {
    if (!item || !item.id || !item.name) return null;

    const card = document.createElement('div');
    card.className = 'tcs-product-card';

    const price = typeof item.price === 'number' ? item.price.toFixed(2) : item.price;
    const description = item.description || '';
    const image = item.image || 'images/placeholder.png';

    card.innerHTML = `
      <img class="tcs-product-image" src="${image}" alt="${item.name}">
      <div class="tcs-product-info">
        <div class="tcs-product-name">${item.name}</div>
        <div class="tcs-product-price">${price}€</div>
        <div class="tcs-product-desc">${description}</div>
        <div class="tcs-product-actions">
          <a href="product.html?id=${item.id}" class="tcs-product-link">Ver detalles</a>
          <button class="tcs-product-add-cart" data-product='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
            <i class="fas fa-cart-plus"></i> Añadir
          </button>
        </div>
      </div>
    `;

    // Evento para "Ver detalles" - view_item
    const viewLink = card.querySelector('.tcs-product-link');
    if (viewLink) {
      viewLink.addEventListener('click', () => {
        if (window.dataLayer) {
          window.dataLayer.push({
            event: 'view_item',
            event_category: 'ecommerce',
            event_action: 'view_item_chatbot',
            event_label: item.name,
            conversation_id: state.conversationId,
            currency: 'EUR',
            value: typeof item.price === 'number' ? item.price : parseFloat(item.price),
            items: [{
              item_id: item.id,
              item_name: item.name,
              price: typeof item.price === 'number' ? item.price : parseFloat(item.price),
              item_category: item.category || '',
              quantity: 1
            }]
          });
        }
      });
    }

    // Evento para añadir al carrito - add_to_cart
    const addBtn = card.querySelector('.tcs-product-add-cart');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        try {
          const productData = JSON.parse(addBtn.dataset.product.replace(/&#39;/g, "'"));
          
          // Añadir al carrito
          if (window.cartUIInstance && typeof window.cartUIInstance.addToCart === 'function') {
            window.cartUIInstance.addToCart(productData, 1);
          } else if (window.cartService && typeof window.cartService.addItem === 'function') {
            window.cartService.addItem(productData, 1);
          }

          // Evento de analytics add_to_cart
          if (window.dataLayer) {
            window.dataLayer.push({
              event: 'add_to_cart',
              event_category: 'ecommerce',
              event_action: 'add_to_cart_chatbot',
              event_label: item.name,
              conversation_id: state.conversationId,
              currency: 'EUR',
              value: typeof item.price === 'number' ? item.price : parseFloat(item.price),
              items: [{
                item_id: item.id,
                item_name: item.name,
                price: typeof item.price === 'number' ? item.price : parseFloat(item.price),
                item_category: item.category || '',
                quantity: 1
              }]
            });
          }

          // Feedback visual
          addBtn.innerHTML = '<i class="fas fa-check"></i> ¡Añadido!';
          addBtn.disabled = true;
          addBtn.classList.add('added');
          
          setTimeout(() => {
            addBtn.innerHTML = '<i class="fas fa-cart-plus"></i> Añadir';
            addBtn.disabled = false;
            addBtn.classList.remove('added');
          }, 2000);
        } catch (err) {
          console.error('Error adding to cart:', err);
        }
      });
    }

    return card;
  }

  // Inicializar estado desde sessionStorage
  state.conversationId = getOrCreateConversationId();
  state.threadId = getThreadId();
  messages = getStoredMessages();

  // Restaurar mensajes en el DOM si existen
  function restoreMessages() {
    if (messages.length > 0) {
      messages.forEach((msg) => {
        // Restaurar mensaje de texto
        const div = document.createElement('div');
        div.className = `tcs-msg ${msg.role === 'user' ? 'user' : 'bot'}`;
        div.textContent = msg.content;
        messagesEl.appendChild(div);

        // Restaurar tarjetas de productos si las hay
        if (msg.products && Array.isArray(msg.products) && msg.products.length > 0) {
          msg.products.forEach((item) => {
            const card = createProductCard(item);
            if (card) {
              messagesEl.appendChild(card);
            }
          });
        }
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  // Restaurar mensajes al cargar
  restoreMessages();

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

  // ==========================================================
  // POLLING PARA ANALYTICS (se ejecuta en background)
  // ==========================================================
  async function pollForAnalytics(messageId, maxAttempts = 30, intervalMs = 500) {
    let attempts = 0;
    
    const poll = async () => {
      if (attempts >= maxAttempts) return;
      
      attempts++;
      
      try {
        const res = await fetch(`/api/chat/analytics/${messageId}`);
        
        if (!res.ok) {
          if (attempts < maxAttempts) setTimeout(poll, intervalMs);
          return;
        }
        
        const data = await res.json();
        
        if (!data.ready) {
          setTimeout(poll, intervalMs);
          return;
        }
        
        // AGENTE 1: INTERACCIÓN
        if (data.interaction && window.dataLayer) {
          window.dataLayer.push({ ...data.interaction, conversation_id: state.conversationId });
        }

        // AGENTE 2: FUNNEL
        if (data.analytics && data.analytics.event && window.dataLayer) {
          window.dataLayer.push({ ...data.analytics, conversation_id: state.conversationId });
        }
        
      } catch (err) {
        if (attempts < maxAttempts) setTimeout(poll, intervalMs);
      }
    };
    
    setTimeout(poll, 800);
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

    // Bloquear scroll del body
    document.body.style.overflow = 'hidden';

    backdrop.classList.remove('tcs-hidden');
    widget.classList.remove('tcs-hidden');
    requestAnimationFrame(() => {
      backdrop.classList.add('show');
      widget.classList.add('open');
      // Scroll al fondo después de abrir
      setTimeout(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }, 50);
    });

    widget.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    state.open = true;

    pushEvent('chat_opened', { conversation_id: state.conversationId });

    if (messages.length === 0) {
      addMessage('¡Hola! Soy el asistente de The Cocktail Store. ¿En qué puedo ayudarte hoy?', 'bot');
    }
    setTimeout(() => {
      input.focus();
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 150);
    document.addEventListener('keydown', onEsc);
  }

  function closeChat() {
    if (!state.open) return;

    // Restaurar scroll del body
    document.body.style.overflow = '';

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
      clearThreadId();

      messages.length = 0;
      clearStoredMessages();
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
    saveMessages();
    addMessage(text, 'user');

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
      if (data.threadId) {
        state.threadId = data.threadId;
        setThreadId(data.threadId);
      }

      addMessage(reply, 'bot');
      
      // Preparar datos de productos para persistir
      let productsToSave = null;
      
      // ==========================================================
      // TARJETA DE PRODUCTO (Si el bot muestra un producto o varios)
      // ==========================================================
      if (data.itemDetails) {
        // Normalizar: si es un solo objeto, lo convertimos a array
        const items = Array.isArray(data.itemDetails) ? data.itemDetails : [data.itemDetails];
        productsToSave = items.filter(item => item && item.id && item.name);
        
        items.forEach((item) => {
          const card = createProductCard(item);
          if (card) {
            messagesEl.appendChild(card);
          }
        });

        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      // Guardar mensaje con productos si los hay
      messages.push({ role: 'assistant', content: reply, products: productsToSave });
      saveMessages();

      // Log to sheets (no bloqueante)
      logToSheets(text, reply);

      // ==========================================================
      // 🚀 POLLING PARA ANALYTICS (en background, no bloquea UI)
      // ==========================================================
      if (data.messageId) {
        pollForAnalytics(data.messageId);
      }

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