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

    const state = { sending: false, open: false };
    const messages = [];

    function pushEvent(name, data = {}) { try { if (window.dataLayer) window.dataLayer.push({ event: name, ...data }); } catch (_) { } }

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
        inner.innerHTML = '<span class="tcs-typing-dot"></span><span class="tcs-typing-dot"></span><span class="tcs-typing-dot"></span>';
        wrap.appendChild(inner);
        messagesEl.appendChild(wrap);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return wrap;
    }

    function getApiKey() {
        let key = localStorage.getItem('OPENAI_API_KEY') || '';
        if (!key) {
            key = window.prompt('Introduce tu API key de OpenAI (solo pruebas locales)');
            if (key) localStorage.setItem('OPENAI_API_KEY', key.trim());
        }
        return key || '';
    }

    function changeApiKey() {
        const key = window.prompt('Nueva API key de OpenAI:');
        if (key) {
            localStorage.setItem('OPENAI_API_KEY', key.trim());
            addMessage('API key actualizada para esta sesión local.', 'bot', 'status');
        }
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
        if (messages.length === 0) addMessage('¡Hola! Soy el asistente de The Cocktail Store. ¿En qué puedo ayudarte hoy?', 'bot');
        setTimeout(() => input.focus(), 150);
        document.addEventListener('keydown', onEsc);
    }

    function closeChat() {
        if (!state.open) return;
        backdrop.classList.remove('show');
        widget.classList.remove('open');
        widget.addEventListener('transitionend', () => {
            backdrop.classList.add('tcs-hidden');
            widget.classList.add('tcs-hidden');
        }, { once: true });
        widget.setAttribute('aria-hidden', 'true');
        toggle.setAttribute('aria-expanded', 'false');
        state.open = false;
        pushEvent('chat_closed');
        document.removeEventListener('keydown', onEsc);
    }

    function onEsc(e) { if (e.key === 'Escape') closeChat(); }

    toggle.addEventListener('click', () => { state.open ? closeChat() : openChat(); });
    closeBtn.addEventListener('click', closeChat);
    backdrop.addEventListener('click', closeChat);
    if (resetKeyBtn) resetKeyBtn.addEventListener('click', changeApiKey);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.sending) return;
        const text = input.value.trim();
        if (!text) return;

        const apiKey = getApiKey();
        if (!apiKey) { addMessage('No hay API key configurada. Usa el botón 🔑 para establecerla.', 'bot'); return; }

        input.value = '';
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        input.disabled = true;

        messages.push({ role: 'user', content: text });
        addMessage(text, 'user');
        const typingEl = showTyping();
        state.sending = true;

        try {
            const history = messages.slice(-8);
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'Eres el asistente de The Cocktail Store. Responde en español, breve, claro y útil. Ayuda con productos, recomendaciones y soporte.' },
                        ...history
                    ],
                    temperature: 0.7
                })
            });
            const data = await res.json();
            typingEl.remove();
            if (!res.ok) {
                const msg = data?.error?.message || `Error ${res.status}`;
                addMessage(`Error: ${msg}`, 'bot');
                pushEvent('chat_error', { status: res.status, message: msg });
                return;
            }
            const reply = data?.choices?.[0]?.message?.content?.trim() || 'Lo siento, no pude responder ahora.';
            addMessage(reply, 'bot');
            messages.push({ role: 'assistant', content: reply });
            pushEvent('chat_message_sent', { length: text.length });
        } catch (err) {
            typingEl.remove();
            addMessage('Error al conectar con OpenAI. Intenta de nuevo.', 'bot');
            pushEvent('chat_error', { message: String(err) });
        } finally {
            state.sending = false;
            input.disabled = false;
            if (submitBtn) submitBtn.disabled = false;
            input.focus();
        }
    });
})();