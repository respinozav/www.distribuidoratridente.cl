/**
 * Camila — Ventas Distribuidora Tridente
 * Interfaz directa de WhatsApp optimizada 100% para celulares y escritorio.
 *
 * Mejoras clave:
 *  - 100% responsive móvil (pantalla completa en smartphone, soporte notch/safe-areas, sin zoom indeseado).
 *  - Tono y apariencia 100% humana (Camila de ventas en línea, sin términos de bot ni asistente virtual).
 *  - Chips de consulta rápida táctiles para celulares ("¿Cómo ser cliente?", "Ver catálogo", "¿Dónde despachan?").
 *  - Flujo conversacional chileno y derivación directa a WhatsApp con datos precargados.
 */

(function () {
  'use strict';

  // ─── Configuración ───────────────────────────────────────────────────────
  const BACKEND_URL  = 'https://camila.distribuidoratridente.cl';  // producción (proxy inverso)
  const BACKEND_DEV  = 'http://localhost:8015';                     // desarrollo local
  const API_BASE     = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? BACKEND_DEV
    : BACKEND_URL;

  // ─── Estado ──────────────────────────────────────────────────────────────
  let sessionId  = null;
  let isOpen     = false;

  // ─── Avatar de Camila ────────────────────────────────────────────────────
  function getCamilaAvatarHTML() {
    return `
      <img
        src="img/camila.jpg"
        alt="Camila de Ventas Tridente"
        class="wa-avatar-img"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
      />
      <div class="wa-avatar-fallback" style="display:none;">C</div>
      <span class="wa-avatar-online" title="En línea"></span>
    `;
  }

  // ─── Formateador de texto a HTML seguro (Markdown simple + URLs) ─────────
  function formatReply(text) {
    if (!text) return '';
    let out = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Negrita **texto**
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Cursiva *texto*
    out = out.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    // Viñetas * item o - item al inicio de línea
    out = out.replace(/^[*-]\s+(.+)$/gm, '• $1');
    // URLs clickeables
    out = out.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="wa-link">$1</a>'
    );
    // Saltos de línea
    out = out.replace(/\n/g, '<br>');
    return out;
  }

  function getTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ─── Estilos CSS WhatsApp optimizados para Móvil y Desktop ──────────────
  function injectStyles() {
    if (document.getElementById('camila-wa-styles')) return;
    const style = document.createElement('style');
    style.id = 'camila-wa-styles';
    style.textContent = `
      /* Contenedor flotante */
      #camilaWidget {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }

      /* Bloqueo de scroll cuando el chat está abierto en celular */
      body.camila-body-locked {
        overflow: hidden !important;
        touch-action: none;
      }

      /* Botón flotante estilo WhatsApp oficial */
      #camilaBtn {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: #25d366;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.28);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        position: relative;
        outline: none;
        -webkit-tap-highlight-color: transparent;
      }
      #camilaBtn:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 24px rgba(37, 211, 102, 0.55);
      }
      #camilaBtn:active {
        transform: scale(0.96);
      }
      #camilaBtn svg {
        width: 34px;
        height: 34px;
        fill: #ffffff;
      }

      /* Badge de notificación en el botón */
      .wa-badge-dot {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 14px;
        height: 14px;
        background: #ef4444;
        border: 2px solid #ffffff;
        border-radius: 50%;
      }

      /* Tooltip amigable de Camila */
      #camilaCloud {
        position: absolute;
        bottom: 74px;
        right: 0;
        background: #ffffff;
        border-radius: 14px 14px 2px 14px;
        padding: 10px 14px;
        box-shadow: 0 6px 22px rgba(0, 0, 0, 0.16);
        font-size: 0.82rem;
        color: #111b21;
        width: 220px;
        line-height: 1.35;
        cursor: pointer;
        animation: wa-cloud-in 0.35s ease;
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid rgba(0, 0, 0, 0.06);
        -webkit-tap-highlight-color: transparent;
      }
      #camilaCloudClose {
        position: absolute;
        top: -6px;
        right: -6px;
        background: #64748b;
        color: #fff;
        border: none;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      @keyframes wa-cloud-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* Ventana de chat WhatsApp (Escritorio) */
      #camilaChatWindow {
        position: absolute;
        bottom: 74px;
        right: 0;
        width: 380px;
        height: 570px;
        max-height: calc(100vh - 110px);
        background: #efeae2;
        border-radius: 18px;
        box-shadow: 0 16px 44px rgba(0, 0, 0, 0.24);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: scale(0.92) translateY(12px);
        opacity: 0;
        pointer-events: none;
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
      }
      #camilaChatWindow.wa-open {
        transform: scale(1) translateY(0);
        opacity: 1;
        pointer-events: all;
      }

      /* Header WhatsApp */
      .wa-header {
        background: #008069;
        color: #ffffff;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
      }
      .wa-back-btn {
        background: transparent;
        border: none;
        color: #ffffff;
        cursor: pointer;
        padding: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        -webkit-tap-highlight-color: transparent;
      }
      .wa-back-btn:hover { background: rgba(255,255,255,0.18); }
      .wa-avatar-wrap {
        position: relative;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: #0e3763;
        flex-shrink: 0;
      }
      .wa-avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
      }
      .wa-avatar-fallback {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: #fff;
        background: #1e3a8a;
        border-radius: 50%;
      }
      .wa-avatar-online {
        position: absolute;
        bottom: 1px;
        right: 1px;
        width: 11px;
        height: 11px;
        background: #25d366;
        border: 2px solid #008069;
        border-radius: 50%;
      }
      .wa-header-info {
        flex: 1;
        min-width: 0;
      }
      .wa-contact-name {
        font-size: 0.98rem;
        font-weight: 600;
        color: #ffffff;
        margin: 0;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .wa-contact-status {
        font-size: 0.74rem;
        color: #d1fae5;
        margin: 2px 0 0;
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .wa-status-dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        background: #25d366;
        border-radius: 50%;
      }
      .wa-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .wa-icon-btn {
        background: transparent;
        border: none;
        color: #ffffff;
        cursor: pointer;
        padding: 6px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.95;
        -webkit-tap-highlight-color: transparent;
      }
      .wa-icon-btn:hover { background: rgba(255,255,255,0.18); opacity: 1; }

      /* Cuerpo de conversación */
      .wa-chat-body {
        flex: 1;
        overflow-y: auto;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        background-color: #efeae2;
        background-image: radial-gradient(#d5ceb8 0.75px, transparent 0.75px);
        background-size: 16px 16px;
        -webkit-overflow-scrolling: touch;
      }
      .wa-chat-body::-webkit-scrollbar { width: 5px; }
      .wa-chat-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

      /* Notificación cifrada / chip */
      .wa-chip-notice {
        align-self: center;
        background: #ffeecd;
        color: #54656f;
        font-size: 0.69rem;
        line-height: 1.35;
        padding: 5px 12px;
        border-radius: 8px;
        text-align: center;
        max-width: 90%;
        box-shadow: 0 1px 1px rgba(11,20,26,0.08);
      }
      .wa-chip-date {
        align-self: center;
        background: #ffffff;
        color: #54656f;
        font-size: 0.68rem;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 6px;
        box-shadow: 0 1px 1px rgba(11,20,26,0.08);
        text-transform: uppercase;
      }

      /* Burbujas de chat */
      .wa-bubble-wrap {
        display: flex;
        flex-direction: column;
        max-width: 82%;
        animation: wa-bubble-in 0.18s ease;
      }
      @keyframes wa-bubble-in {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .wa-bubble-in {
        align-self: flex-start;
      }
      .wa-bubble-out {
        align-self: flex-end;
      }

      .wa-bubble {
        position: relative;
        padding: 8px 11px 7px;
        font-size: 0.85rem;
        line-height: 1.42;
        color: #111b21;
        word-break: break-word;
        box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13);
      }
      .wa-bubble-in .wa-bubble {
        background: #ffffff;
        border-radius: 0 8px 8px 8px;
      }
      .wa-bubble-out .wa-bubble {
        background: #d9fdd3;
        border-radius: 8px 0 8px 8px;
      }

      .wa-bubble-meta {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 3px;
        font-size: 0.66rem;
        color: #667781;
        margin-top: 3px;
        margin-left: 12px;
        float: right;
      }
      .wa-ticks {
        color: #53bdeb;
        font-weight: bold;
        display: inline-flex;
      }

      .wa-link {
        color: #027eb5;
        text-decoration: underline;
        word-break: break-all;
      }

      /* Sugerencias Rápidas (Chips táctiles para celular) */
      .wa-quick-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 2px 0 4px;
        animation: wa-bubble-in 0.2s ease;
      }
      .wa-chip-btn {
        background: #ffffff;
        border: 1px solid #00a884;
        color: #007a5e;
        font-size: 0.76rem;
        font-weight: 600;
        padding: 6px 12px;
        border-radius: 16px;
        cursor: pointer;
        transition: all 0.15s ease;
        box-shadow: 0 1px 2px rgba(0,0,0,0.06);
        -webkit-tap-highlight-color: transparent;
      }
      .wa-chip-btn:hover, .wa-chip-btn:active {
        background: #00a884;
        color: #ffffff;
        border-color: #00a884;
        transform: scale(0.97);
      }

      /* Botón de acción WhatsApp Oficial */
      .wa-action-card {
        margin-top: 8px;
        background: #f0fdf4;
        border: 1px solid #86efac;
        border-radius: 10px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .wa-action-title {
        font-size: 0.78rem;
        color: #166534;
        font-weight: 700;
      }
      .wa-action-desc {
        font-size: 0.75rem;
        color: #374151;
        line-height: 1.35;
      }
      .wa-action-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: #25d366;
        color: #ffffff;
        font-weight: 700;
        font-size: 0.85rem;
        padding: 10px 14px;
        min-height: 44px;
        border-radius: 8px;
        text-decoration: none;
        box-shadow: 0 2px 8px rgba(37,211,102,0.4);
        transition: transform 0.15s, background 0.15s;
        -webkit-tap-highlight-color: transparent;
      }
      .wa-action-btn:hover { background: #1eb954; color: #fff; transform: translateY(-1px); }
      .wa-action-btn:active { transform: scale(0.98); }
      .wa-action-btn svg { width: 18px; height: 18px; fill: #fff; flex-shrink: 0; }

      /* Indicador escribiendo */
      .wa-typing-bubble {
        align-self: flex-start;
        background: #ffffff;
        border-radius: 0 8px 8px 8px;
        padding: 8px 12px;
        display: none;
        align-items: center;
        gap: 4px;
        box-shadow: 0 1px 0.5px rgba(11,20,26,0.13);
      }
      .wa-typing-dot {
        width: 6px;
        height: 6px;
        background: #8696a0;
        border-radius: 50%;
        animation: wa-jump 0.9s infinite;
      }
      .wa-typing-dot:nth-child(2) { animation-delay: 0.15s; }
      .wa-typing-dot:nth-child(3) { animation-delay: 0.3s; }
      @keyframes wa-jump {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-5px); }
      }

      /* Barra inferior de entrada estilo WhatsApp */
      .wa-footer {
        background: #f0f2f5;
        padding: 8px 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .wa-input-pill {
        flex: 1;
        background: #ffffff;
        border-radius: 20px;
        border: none;
        outline: none;
        padding: 10px 14px;
        font-size: 0.88rem;
        color: #111b21;
        font-family: inherit;
      }
      .wa-input-pill::placeholder { color: #8696a0; }
      .wa-send-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #00a884;
        border: none;
        color: #ffffff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: transform 0.15s, background 0.15s;
        -webkit-tap-highlight-color: transparent;
      }
      .wa-send-btn:hover { background: #008069; transform: scale(1.05); }
      .wa-send-btn:active { transform: scale(0.95); }
      .wa-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .wa-send-btn svg { width: 18px; height: 18px; fill: #ffffff; }

      /* =====================================================================
         OPTIMIZACIÓN RESPONSIVE CELULARES (90% de clientes en smartphone)
         ===================================================================== */
      @media (max-width: 640px) {
        #camilaWidget {
          bottom: 16px;
          right: 16px;
        }

        #camilaWidget.wa-chat-active #camilaBtn,
        #camilaWidget.wa-chat-active #camilaCloud {
          display: none !important;
        }

        #camilaBtn {
          width: 58px;
          height: 58px;
        }
        #camilaBtn svg {
          width: 32px;
          height: 32px;
        }

        #camilaCloud {
          width: 200px;
          max-width: calc(100vw - 90px);
          bottom: 70px;
          font-size: 0.78rem;
          padding: 8px 12px;
        }

        /* Pantalla completa en celular como WhatsApp Web/App nativo */
        #camilaChatWindow {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100% !important;
          height: 100dvh !important;
          max-height: 100dvh !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          transform: none !important;
          z-index: 100000 !important;
        }

        /* Header con soporte safe-area en iPhone / Notch */
        .wa-header {
          padding-top: max(10px, env(safe-area-inset-top, 10px));
          padding-bottom: 10px;
          padding-left: 10px;
          padding-right: 12px;
        }
        .wa-back-btn {
          width: 40px;
          height: 40px;
          padding: 8px;
        }

        /* Footer con soporte safe-area para barra inferior de gestos */
        .wa-footer {
          padding-top: 8px;
          padding-left: 10px;
          padding-right: 10px;
          padding-bottom: max(10px, env(safe-area-inset-bottom, 10px));
        }

        /* Input a 16px para evitar auto-zoom indeseado en Safari iOS */
        .wa-input-pill {
          font-size: 16px !important;
          padding: 10px 14px;
        }

        .wa-send-btn {
          width: 42px;
          height: 42px;
        }

        .wa-bubble-wrap {
          max-width: 88%;
        }

        .wa-chip-btn {
          font-size: 0.78rem;
          padding: 7px 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Construir interfaz del Widget ───────────────────────────────────────
  function createWidget() {
    if (document.getElementById('camilaWidget')) return;

    const widget = document.createElement('div');
    widget.id = 'camilaWidget';
    widget.innerHTML = `
      <!-- Tooltip amigable de Camila -->
      <div id="camilaCloud" role="button" tabindex="0" title="Chatear con Camila en WhatsApp">
        <button type="button" id="camilaCloudClose" aria-label="Cerrar">×</button>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="#25D366" style="flex-shrink:0;">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.586-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.311.045-.698.077-1.121-.059-.268-.087-.61-.205-1.049-.395-1.849-.801-3.053-2.659-3.146-2.783-.092-.123-.746-.992-.746-1.893 0-.9.472-1.343.64-1.527.168-.185.367-.231.49-.231.122 0 .245.002.352.007.112.006.262-.043.41.314.153.37.52 1.272.566 1.365.046.092.077.2.015.323-.061.123-.092.2-.184.308-.092.107-.194.24-.277.322-.093.093-.19.194-.082.38.107.185.477.787 1.025 1.274.706.628 1.302.822 1.487.914.185.093.292.078.4-.046.108-.124.46-.538.583-.723.123-.184.246-.153.414-.092.169.062 1.074.507 1.258.6.185.092.308.138.353.215.046.077.046.446-.098.851z"/>
        </svg>
        <div><strong>¡Hola! 👋 Soy Camila</strong><br>¿Necesitas algo para tu negocio? Escríbeme aquí</div>
      </div>

      <!-- ÚNICO BOTÓN VISIBLE: Botón oficial de WhatsApp -->
      <button type="button" id="camilaBtn" aria-label="Abrir WhatsApp Distribuidora Tridente" title="Chatear con Camila en WhatsApp">
        <span class="wa-badge-dot" id="camilaBadge"></span>
        <svg viewBox="0 0 24 24">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.586-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.311.045-.698.077-1.121-.059-.268-.087-.61-.205-1.049-.395-1.849-.801-3.053-2.659-3.146-2.783-.092-.123-.746-.992-.746-1.893 0-.9.472-1.343.64-1.527.168-.185.367-.231.49-.231.122 0 .245.002.352.007.112.006.262-.043.41.314.153.37.52 1.272.566 1.365.046.092.077.2.015.323-.061.123-.092.2-.184.308-.092.107-.194.24-.277.322-.093.093-.19.194-.082.38.107.185.477.787 1.025 1.274.706.628 1.302.822 1.487.914.185.093.292.078.4-.046.108-.124.46-.538.583-.723.123-.184.246-.153.414-.092.169.062 1.074.507 1.258.6.185.092.308.138.353.215.046.077.046.446-.098.851z"/>
        </svg>
      </button>

      <!-- VENTANA DE CHAT: Apariencia exacta de WhatsApp -->
      <div id="camilaChatWindow" role="dialog" aria-label="Chat con Camila • Distribuidora Tridente" aria-hidden="true">
        <!-- Header WhatsApp -->
        <div class="wa-header">
          <button type="button" class="wa-back-btn" id="camilaBackBtn" aria-label="Volver atrás">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div class="wa-avatar-wrap">
            ${getCamilaAvatarHTML()}
          </div>
          <div class="wa-header-info">
            <h4 class="wa-contact-name">Camila</h4>
            <p class="wa-contact-status" id="camilaStatusText">
              <span class="wa-status-dot"></span> en línea
            </p>
          </div>
          <div class="wa-header-actions">
            <button type="button" class="wa-icon-btn" title="Cerrar chat" id="camilaCloseIcon" aria-label="Cerrar chat">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Cuerpo de conversación -->
        <div class="wa-chat-body" id="camilaMessages">
          <!-- Chip fecha -->
          <div class="wa-chip-date">Hoy</div>

          <!-- Chip de aviso -->
          <div class="wa-chip-notice">
            🔒 Chat directo con <strong>Camila</strong> • Ventas Distribuidora Tridente
          </div>


          <!-- Burbuja de escritura -->
          <div class="wa-typing-bubble" id="camilaTyping">
            <span class="wa-typing-dot"></span>
            <span class="wa-typing-dot"></span>
            <span class="wa-typing-dot"></span>
          </div>
        </div>

        <!-- Formulario inferior WhatsApp -->
        <form class="wa-footer" id="camilaChatForm">
          <input
            type="text"
            id="camilaChatInput"
            class="wa-input-pill"
            placeholder="Escribe un mensaje aquí..."
            autocomplete="off"
            maxlength="300"
          />
          <button type="submit" class="wa-send-btn" id="camilaSendBtn" aria-label="Enviar mensaje">
            <svg viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(widget);
  }

  // ─── Helpers de Mensajes ──────────────────────────────────────────────────
  function scrollBottom() {
    const el = document.getElementById('camilaMessages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  function setTyping(active) {
    const bubble = document.getElementById('camilaTyping');
    const status = document.getElementById('camilaStatusText');
    if (bubble) bubble.style.display = active ? 'inline-flex' : 'none';
    if (status) {
      status.innerHTML = active
        ? '<em>escribiendo...</em>'
        : '<span class="wa-status-dot"></span> en línea';
    }
    scrollBottom();
  }

  function appendUserMessage(text) {
    const messages = document.getElementById('camilaMessages');
    if (!messages) return;

    const wrap = document.createElement('div');
    wrap.className = 'wa-bubble-wrap wa-bubble-out';
    wrap.innerHTML = `
      <div class="wa-bubble">
        ${formatReply(text)}
        <span class="wa-bubble-meta">
          ${getTime()}
          <span class="wa-ticks">✓✓</span>
        </span>
      </div>
    `;
    const typing = document.getElementById('camilaTyping');
    if (typing) messages.insertBefore(wrap, typing);
    else messages.appendChild(wrap);
    scrollBottom();
  }

  function appendBotMessage(replyHtml, whatsappUrl) {
    const messages = document.getElementById('camilaMessages');
    if (!messages) return;

    const wrap = document.createElement('div');
    wrap.className = 'wa-bubble-wrap wa-bubble-in';

    let actionHTML = '';
    if (whatsappUrl) {
      actionHTML = `
        <div class="wa-action-card">
          <div class="wa-action-title">
            ✅ ¡Datos listos para coordinar!
          </div>
          <div class="wa-action-desc">
            Toca el botón verde para abrir WhatsApp y mi compañero te contacta al tiro:
          </div>
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="wa-action-btn">
            <svg viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.586-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.311.045-.698.077-1.121-.059-.268-.087-.61-.205-1.049-.395-1.849-.801-3.053-2.659-3.146-2.783-.092-.123-.746-.992-.746-1.893 0-.9.472-1.343.64-1.527.168-.185.367-.231.49-.231.122 0 .245.002.352.007.112.006.262-.043.41.314.153.37.52 1.272.566 1.365.046.092.077.2.015.323-.061.123-.092.2-.184.308-.092.107-.194.24-.277.322-.093.093-.19.194-.082.38.107.185.477.787 1.025 1.274.706.628 1.302.822 1.487.914.185.093.292.078.4-.046.108-.124.46-.538.583-.723.123-.184.246-.153.414-.092.169.062 1.074.507 1.258.6.185.092.308.138.353.215.046.077.046.446-.098.851z"/>
            </svg>
            📲 Abrir WhatsApp Oficial con Ventas
          </a>
        </div>
      `;
    }

    wrap.innerHTML = `
      <div class="wa-bubble">
        ${replyHtml}
        ${actionHTML}
        <span class="wa-bubble-meta">${getTime()}</span>
      </div>
    `;

    const typing = document.getElementById('camilaTyping');
    if (typing) messages.insertBefore(wrap, typing);
    else messages.appendChild(wrap);
    scrollBottom();
  }

  // ─── Enviar mensaje al Backend Python ─────────────────────────────────────
  async function sendMessage(text) {
    const input = document.getElementById('camilaChatInput');
    const sendBtn = document.getElementById('camilaSendBtn');
    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    setTyping(true);

    try {
      const payload = { message: text, session_id: sessionId };
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.session_id) sessionId = data.session_id;

      setTyping(false);
      appendBotMessage(formatReply(data.reply), data.whatsapp_url);

    } catch (err) {
      setTyping(false);
      appendBotMessage(
        '⚠️ Tuve un pequeño problema de conexión acá en el sistema. Puedes escribirme directo al WhatsApp de ventas: <a href="https://wa.me/56944488407" target="_blank" class="wa-link">+56 9 4448 8407</a> y te respondo al tiro.',
        null
      );
      console.error('Camila Error:', err);
    } finally {
      if (input) { input.disabled = false; input.focus(); }
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  // ─── Vincular Eventos ─────────────────────────────────────────────────────
  function bindEvents() {
    const widget     = document.getElementById('camilaWidget');
    const btn        = document.getElementById('camilaBtn');
    const chatWin    = document.getElementById('camilaChatWindow');
    const backBtn    = document.getElementById('camilaBackBtn');
    const closeIcon  = document.getElementById('camilaCloseIcon');
    const cloud      = document.getElementById('camilaCloud');
    const cloudClose = document.getElementById('camilaCloudClose');
    const form       = document.getElementById('camilaChatForm');
    const input      = document.getElementById('camilaChatInput');
    const badge      = document.getElementById('camilaBadge');
    const chips      = document.getElementById('camilaQuickChips');

    function openChat() {
      isOpen = true;
      if (widget) widget.classList.add('wa-chat-active');
      if (chatWin) {
        chatWin.classList.add('wa-open');
        chatWin.setAttribute('aria-hidden', 'false');
      }
      document.body.classList.add('camila-body-locked');
      if (cloud) cloud.style.display = 'none';
      if (badge) badge.style.display = 'none';
      setTimeout(() => { if (input) input.focus(); }, 250);
      scrollBottom();
    }

    function closeChat() {
      isOpen = false;
      if (widget) widget.classList.remove('wa-chat-active');
      if (chatWin) {
        chatWin.classList.remove('wa-open');
        chatWin.setAttribute('aria-hidden', 'true');
      }
      document.body.classList.remove('camila-body-locked');
    }

    if (btn) btn.addEventListener('click', () => isOpen ? closeChat() : openChat());
    if (backBtn) backBtn.addEventListener('click', closeChat);
    if (closeIcon) closeIcon.addEventListener('click', closeChat);

    if (cloud) {
      cloud.addEventListener('click', (e) => {
        if (e.target !== cloudClose) openChat();
      });
    }

    if (cloudClose) {
      cloudClose.addEventListener('click', (e) => {
        e.stopPropagation();
        cloud.style.display = 'none';
        sessionStorage.setItem('camila_cloud_dismissed', '1');
      });
    }

    if (sessionStorage.getItem('camila_cloud_dismissed') === '1' && cloud) {
      cloud.style.display = 'none';
    }

    // Chips de sugerencia rápida (un toque en celular)
    if (chips) {
      chips.addEventListener('click', (e) => {
        const chipBtn = e.target.closest('.wa-chip-btn');
        if (!chipBtn) return;
        const msg = chipBtn.getAttribute('data-msg');
        if (!msg) return;
        appendUserMessage(msg);
        sendMessage(msg);
        chips.style.display = 'none'; // ocultar tras el primer uso para dejar limpia la conversación
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closeChat();
    });

    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        appendUserMessage(text);
        input.value = '';
        if (chips) chips.style.display = 'none';
        sendMessage(text);
      });
    }
  }

  // ─── Iniciar ──────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    createWidget();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
