/**
 * Hazte Cliente — Distribuidora Tridente
 * Modal de registro rápido para clientes mayoristas y derivación directa a WhatsApp (+56 9 7987 5179)
 */

(function () {
  'use strict';

  const WHATSAPP_NUMERO = '56979875179'; // Destino oficial para altas mayoristas (+56 9 7987 5179)

  function initHazteClienteModal() {
    if (document.getElementById('hazteClienteModal')) return;

    const modalHTML = `
      <div class="hz-modal-backdrop" id="hazteClienteBackdrop" aria-hidden="true"></div>
      <div class="hz-modal" id="hazteClienteModal" role="dialog" aria-modal="true" aria-labelledby="hzModalTitle" aria-hidden="true">
        <div class="hz-modal-header">
          <div class="hz-modal-badge">
            <span>🤝</span> Alta de Clientes Mayoristas
          </div>
          <button type="button" class="hz-modal-close" id="hzModalCloseBtn" aria-label="Cerrar modal">&times;</button>
          <h3 id="hzModalTitle" class="hz-modal-title">¡Hazte Cliente de Tridente!</h3>
          <p class="hz-modal-subtitle">
            Completa tus datos para crear tu cuenta comercial y acceder a precios mayoristas preferenciales.
          </p>
        </div>

        <form id="hzClienteForm" class="hz-modal-body" novalidate>
          <div class="hz-form-group">
            <label for="hzRazonSocial" class="hz-label">
              Razón Social o Nombre del Negocio <span class="hz-required">*</span>
            </label>
            <div class="hz-input-wrap">
              <span class="hz-input-icon">🏢</span>
              <input 
                type="text" 
                id="hzRazonSocial" 
                name="razon_social" 
                class="hz-input" 
                placeholder="Ej: Minimarket Los Laureles SpA" 
                required 
                autocomplete="organization"
              />
            </div>
            <div class="hz-error-msg" id="hzRazonSocialError">Ingresa la razón social o nombre de tu negocio.</div>
          </div>

          <div class="hz-form-group">
            <label for="hzCelular" class="hz-label">
              Celular / WhatsApp <span class="hz-required">*</span>
            </label>
            <div class="hz-input-wrap">
              <span class="hz-input-icon">📱</span>
              <input 
                type="tel" 
                id="hzCelular" 
                name="celular" 
                class="hz-input" 
                placeholder="Ej: +56 9 1234 5678" 
                required 
                autocomplete="tel"
              />
            </div>
            <div class="hz-error-msg" id="hzCelularError">Ingresa un número de celular de contacto válido.</div>
          </div>

          <div class="hz-form-group">
            <label for="hzCorreo" class="hz-label">
              Correo Electrónico <span class="hz-required">*</span>
            </label>
            <div class="hz-input-wrap">
              <span class="hz-input-icon">✉️</span>
              <input 
                type="email" 
                id="hzCorreo" 
                name="correo" 
                class="hz-input" 
                placeholder="Ej: contacto@minegocio.cl" 
                required 
                autocomplete="email"
              />
            </div>
            <div class="hz-error-msg" id="hzCorreoError">Ingresa un correo electrónico válido.</div>
          </div>

          <div class="hz-notice">
            <span class="hz-notice-icon">💬</span>
            <span>Al pinchar en <strong>Enviar</strong>, se abrirá WhatsApp con tus datos listos para enviar a nuestro equipo de ventas (+56 9 7987 5179).</span>
          </div>

          <div class="hz-modal-footer">
            <button type="submit" class="hz-btn-submit" id="hzSubmitBtn">
              <svg class="hz-wa-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.53 1.769.784 2.8.784 3.178 0 5.765-2.587 5.766-5.766 0-3.18-2.587-5.77-5.77-5.77zm0-2.172c4.378 0 7.938 3.56 7.939 7.938 0 4.38-3.56 7.939-7.939 7.939-1.393 0-2.698-.363-3.83-1.002l-4.201 1.103 1.121-4.102c-.732-1.206-1.15-2.62-1.15-4.138 0-4.378 3.56-7.938 7.939-7.938zm3.87 11.233c-.161.455-.833.865-1.365.92-.515.053-.94-.092-2.383-.69-1.782-.74-2.923-2.56-3.011-2.678-.088-.118-.727-.968-.727-1.847s.457-1.312.62-1.49c.162-.178.354-.222.472-.222.119 0 .237.001.34.006.109.005.253-.042.395.299.148.356.505 1.232.548 1.321.044.089.074.193.015.311-.059.119-.089.193-.178.297-.089.104-.187.232-.267.311-.089.089-.182.185-.078.363.104.178.461.761.989 1.232.679.605 1.252.793 1.43.882.178.089.282.074.386-.044.104-.119.444-.519.563-.697.118-.178.237-.148.395-.089.158.059 1.007.474 1.18.563.173.089.288.133.33.207.042.074.042.43-.119.885z"/>
              </svg>
              <span>Enviar a WhatsApp</span>
            </button>
          </div>
        </form>

        <div class="hz-success-state" id="hzSuccessState" style="display: none;">
          <div class="hz-success-icon">✓</div>
          <h4 class="hz-success-title">¡Abriendo WhatsApp!</h4>
          <p class="hz-success-text">
            Si la ventana no se abrió de forma automática, presiona el botón para enviar tus datos directamente a nuestro WhatsApp:
          </p>
          <a href="#" target="_blank" rel="noopener noreferrer" class="hz-btn-success-reopen" id="hzReopenLink">
            💬 Continuar en WhatsApp (+56 9 7987 5179)
          </a>
          <button type="button" class="hz-btn-close-final" id="hzCloseFinalBtn">
            Cerrar
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    attachEvents();
  }

  function attachEvents() {
    const backdrop = document.getElementById('hazteClienteBackdrop');
    const closeBtn = document.getElementById('hzModalCloseBtn');
    const closeFinalBtn = document.getElementById('hzCloseFinalBtn');
    const form = document.getElementById('hzClienteForm');

    if (backdrop) backdrop.addEventListener('click', cerrarModalHazteCliente);
    if (closeBtn) closeBtn.addEventListener('click', cerrarModalHazteCliente);
    if (closeFinalBtn) closeFinalBtn.addEventListener('click', cerrarModalHazteCliente);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('hz-modal-open')) {
        cerrarModalHazteCliente();
      }
    });

    // Delegación para botones o enlaces con data-action o clase
    document.addEventListener('click', function (e) {
      const trigger = e.target.closest('.nav-hazte-cliente, [data-action="hazte-cliente"]');
      if (trigger) {
        e.preventDefault();
        abrirModalHazteCliente();
      }
    });

    if (form) {
      form.addEventListener('submit', handleFormSubmit);

      // Limpiar errores mientras se escribe
      ['hzRazonSocial', 'hzCelular', 'hzCorreo'].forEach(function (id) {
        const input = document.getElementById(id);
        if (input) {
          input.addEventListener('input', function () {
            input.classList.remove('hz-input-error');
            const err = document.getElementById(id + 'Error');
            if (err) err.classList.remove('visible');
          });
        }
      });
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();

    const razonInput = document.getElementById('hzRazonSocial');
    const celInput = document.getElementById('hzCelular');
    const emailInput = document.getElementById('hzCorreo');

    const razon = razonInput ? razonInput.value.trim() : '';
    const cel = celInput ? celInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';

    let hasError = false;

    // Validación Razón Social (mínimo 2 caracteres)
    if (!razon || razon.length < 2) {
      showFieldError('hzRazonSocial', true);
      hasError = true;
    } else {
      showFieldError('hzRazonSocial', false);
    }

    // Validación Celular (mínimo 8 dígitos)
    const digitsOnly = cel.replace(/\D/g, '');
    if (!cel || digitsOnly.length < 8) {
      showFieldError('hzCelular', true);
      hasError = true;
    } else {
      showFieldError('hzCelular', false);
    }

    // Validación Correo Electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showFieldError('hzCorreo', true);
      hasError = true;
    } else {
      showFieldError('hzCorreo', false);
    }

    if (hasError) {
      const firstError = document.querySelector('.hz-input-error');
      if (firstError) firstError.focus();
      return;
    }

    // Construir mensaje amigable y completo para WhatsApp
    const mensaje = 
      `👋 ¡Hola! Deseo registrarme como cliente en Distribuidora Tridente.\n\n` +
      `📋 *Datos del Solicitante:*\n` +
      `• *Razón Social / Negocio:* ${razon}\n` +
      `• *Celular:* ${cel}\n` +
      `• *Correo:* ${email}\n\n` +
      `Quedo a la espera de su respuesta para comenzar a cotizar y realizar pedidos mayoristas. ¡Muchas gracias!`;

    const waUrl = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;

    // Abrir WhatsApp
    try {
      const waWin = window.open(waUrl, '_blank');
      if (!waWin || waWin.closed || typeof waWin.closed === 'undefined') {
        window.location.href = waUrl;
      }
    } catch (err) {
      window.location.href = waUrl;
    }

    // Mostrar estado de confirmación en el modal
    const formEl = document.getElementById('hzClienteForm');
    const successEl = document.getElementById('hzSuccessState');
    const reopenLink = document.getElementById('hzReopenLink');

    if (formEl && successEl) {
      formEl.style.display = 'none';
      successEl.style.display = 'flex';
      if (reopenLink) reopenLink.href = waUrl;
    }
  }

  function showFieldError(inputId, isError) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(inputId + 'Error');
    if (input) {
      if (isError) input.classList.add('hz-input-error');
      else input.classList.remove('hz-input-error');
    }
    if (err) {
      if (isError) err.classList.add('visible');
      else err.classList.remove('visible');
    }
  }

  function abrirModalHazteCliente() {
    initHazteClienteModal();

    const backdrop = document.getElementById('hazteClienteBackdrop');
    const modal = document.getElementById('hazteClienteModal');
    const form = document.getElementById('hzClienteForm');
    const success = document.getElementById('hzSuccessState');

    // Restaurar vista de formulario si estaba en éxito
    if (form) form.style.display = 'flex';
    if (success) success.style.display = 'none';

    // Limpiar errores previos
    ['hzRazonSocial', 'hzCelular', 'hzCorreo'].forEach(function (id) {
      const input = document.getElementById(id);
      if (input) input.classList.remove('hz-input-error');
      const err = document.getElementById(id + 'Error');
      if (err) err.classList.remove('visible');
    });

    if (backdrop) {
      backdrop.classList.add('active');
      backdrop.setAttribute('aria-hidden', 'false');
    }
    if (modal) {
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('hz-modal-open');

    // Focus en primer campo
    setTimeout(function () {
      const input = document.getElementById('hzRazonSocial');
      if (input) input.focus();
    }, 120);
  }

  function cerrarModalHazteCliente() {
    const backdrop = document.getElementById('hazteClienteBackdrop');
    const modal = document.getElementById('hazteClienteModal');

    if (backdrop) {
      backdrop.classList.remove('active');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('hz-modal-open');
  }

  // Métodos globales
  window.abrirModalHazteCliente = abrirModalHazteCliente;
  window.cerrarModalHazteCliente = cerrarModalHazteCliente;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHazteClienteModal);
  } else {
    initHazteClienteModal();
  }
})();

