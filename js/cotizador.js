/**
 * ============================================================================
 * DISTRIBUIDORA TRIDENTE - COTIZADOR WEB PÚBLICO
 * Vigencia fija de 72 Horas y Descarga Exclusiva en PDF
 * ============================================================================
 */

(function () {
  'use strict';

  // Configuración
  const API_BASE = 'https://camila.distribuidoratridente.cl';
  const ITEMS_PER_PAGE = 24;

  // Estado del Cotizador
  const state = {
    products: [],
    categories: [],
    selectedCategory: 'TODAS',
    searchQuery: '',
    currentPage: 1,
    cart: [], // [{ id, codigo, nombre, tipo_empaque, cantidad_caja, precio_unitario, cantidad, afecto, imagen_url }]
    client: {
      razonSocial: '',
      rut: '',
      telefono: '',
      email: '',
      direccion: '',
      observaciones: '',
    },
    clientValid: {
      razonSocial: false,
      rut: false,
      telefono: false,
      email: false,
      direccion: false,
    },
    isGeneratingPdf: false,
  };

  // ─── Formateador de Moneda Chilena ──────────────────────────────────────────
  function formatMoney(amount) {
    return '$' + Math.round(Number(amount) || 0).toLocaleString('es-CL');
  }

  // ─── Formateador y Validador de RUT Chileno (Módulo 11) ─────────────────────
  function cleanRut(rut) {
    return (rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
  }

  function formatRut(rut) {
    const raw = cleanRut(rut);
    if (!raw) return '';
    if (raw.length === 1) return raw;
    const cuerpo = raw.slice(0, -1);
    const dv = raw.slice(-1);
    const formattedCuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${formattedCuerpo}-${dv}`;
  }

  function validateRut(rut) {
    const raw = cleanRut(rut);
    if (raw.length < 2) return false;
    const cuerpo = raw.slice(0, -1);
    const dv = raw.slice(-1);
    if (!/^\d+$/.test(cuerpo)) return false;

    let suma = 0;
    let multiplo = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += multiplo * parseInt(cuerpo.charAt(i), 10);
      multiplo = multiplo < 7 ? multiplo + 1 : 2;
    }
    const dvEsperado = 11 - (suma % 11);
    const dvCalc = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : dvEsperado.toString();
    return dvCalc === dv;
  }

  // ─── Fechas y Vigencia de 72 Horas ──────────────────────────────────────────
  function getValidityTimes(now = new Date()) {
    const expiry = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const formatDate = (d) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    return {
      issuedAt: now,
      expiresAt: expiry,
      issuedText: `${formatDate(now)} a las ${formatTime(now)} hrs`,
      expiresText: `${formatDate(expiry)} a las ${formatTime(expiry)} hrs`,
      bannerText: `⏱️ Cotización válida por 72 horas (hasta el ${formatDate(expiry)} a las ${formatTime(expiry)} hrs)`,
    };
  }

  // ─── Persistencia Local del Carrito ─────────────────────────────────────────
  function saveCart() {
    try {
      sessionStorage.setItem('tridente_cot_cart', JSON.stringify(state.cart));
      sessionStorage.setItem('tridente_cot_client', JSON.stringify(state.client));
    } catch (e) {}
  }

  function loadCart() {
    try {
      const savedCart = sessionStorage.getItem('tridente_cot_cart');
      if (savedCart) state.cart = JSON.parse(savedCart);
      const savedClient = sessionStorage.getItem('tridente_cot_client');
      if (savedClient) state.client = JSON.parse(savedClient);
    } catch (e) {}
  }

  // ─── Cálculos Financieros Exactos ───────────────────────────────────────────
  function computeTotals() {
    let totalNeto = 0;
    let totalExento = 0;
    let totalIva = 0;
    let totalFinal = 0;
    let totalUnidades = 0;
    let totalCajas = 0;

    state.cart.forEach((item) => {
      const lineTotal = item.precio_unitario * item.cantidad;
      totalFinal += lineTotal;

      if (item.tipo_empaque === 'caja') {
        totalCajas += item.cantidad;
      } else {
        totalUnidades += item.cantidad;
      }

      if (item.afecto) {
        // En productos afectos, el precio de lista incluye IVA
        const neto = Math.round(lineTotal / 1.19);
        const iva = lineTotal - neto;
        totalNeto += neto;
        totalIva += iva;
      } else {
        // Producto exento de IVA (ej. tabacos)
        totalExento += lineTotal;
      }
    });

    return {
      totalNeto,
      totalExento,
      totalIva,
      totalFinal,
      totalUnidades,
      totalCajas,
      itemsCount: state.cart.length,
    };
  }

  // ─── Renderizado de la Vigencia ─────────────────────────────────────────────
  function updateVigenciaBanners() {
    const v = getValidityTimes();
    const heroBanner = document.getElementById('heroVigenciaText');
    if (heroBanner) heroBanner.textContent = v.bannerText;

    const sidebarEmision = document.getElementById('summaryEmisionTime');
    if (sidebarEmision) sidebarEmision.textContent = v.issuedText;

    const sidebarVence = document.getElementById('summaryVenceTime');
    if (sidebarVence) sidebarVence.textContent = v.expiresText;
  }

  // ─── Renderizado del Selector de Categorías ──────────────────────────────────
  function renderCategories() {
    const container = document.getElementById('categoryPills');
    if (!container) return;

    const allCount = state.products.length;
    let html = `
      <button type="button" class="category-pill ${state.selectedCategory === 'TODAS' ? 'active' : ''}" data-cat="TODAS">
        Todas <span class="pill-count">${allCount}</span>
      </button>
    `;

    state.categories.forEach((cat) => {
      const count = state.products.filter((p) => (p.categoria || '').toUpperCase() === cat.toUpperCase()).length;
      html += `
        <button type="button" class="category-pill ${state.selectedCategory === cat ? 'active' : ''}" data-cat="${cat}">
          ${cat} <span class="pill-count">${count}</span>
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.category-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedCategory = btn.getAttribute('data-cat');
        state.currentPage = 1;
        renderCategories();
        renderProducts();
      });
    });
  }

  // ─── Filtrado y Renderizado del Catálogo de Productos ─────────────────────────
  function getFilteredProducts() {
    let list = state.products;

    if (state.selectedCategory !== 'TODAS') {
      list = list.filter((p) => (p.categoria || '').toUpperCase() === state.selectedCategory.toUpperCase());
    }

    if (state.searchQuery.trim()) {
      const q = state.searchQuery.trim().toLowerCase();
      list = list.filter((p) => {
        const nom = (p.nombre || '').toLowerCase();
        const cod = (p.codigo || '').toLowerCase();
        const cat = (p.categoria || '').toLowerCase();
        return nom.includes(q) || cod.includes(q) || cat.includes(q);
      });
    }

    return list;
  }

  function renderProducts() {
    const grid = document.getElementById('productsGrid');
    const countLabel = document.getElementById('catalogResultsCount');
    if (!grid) return;

    const filtered = getFilteredProducts();
    if (countLabel) countLabel.textContent = `${filtered.length} productos disponibles`;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: #64748b;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
          <p style="font-size: 1.05rem; font-weight: 600; color: #1e293b;">No se encontraron productos coincidentes</p>
          <p style="font-size: 0.88rem;">Intenta con otro término de búsqueda o selecciona otra categoría.</p>
        </div>
      `;
      renderPagination(0);
      return;
    }

    const startIndex = (state.currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    let html = '';
    pageItems.forEach((p) => {
      const hasCaja = p.tiene_caja && p.precio_caja > 0 && p.cantidad_caja > 0;
      const afectoClass = p.afecto ? 'afecto' : 'exento';
      const afectoLabel = p.afecto ? 'Afecto 19% IVA' : 'Exento de IVA';

      // SVG fallback estilizado para productos sin imagen
      const imgHtml = p.imagen_url
        ? `<img src="${p.imagen_url}" alt="${p.nombre}" class="product-img" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
           <div class="product-img-fallback" style="display:none;">
             <svg width="36" height="36" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1zm-4.44-6.19l-2.35 3.02-1.56-1.88c-.2-.25-.58-.25-.78 0l-1.74 2.23c-.26.33-.02.82.4.82h8.93c.41 0 .65-.48.4-.81l-2.52-3.38c-.19-.26-.58-.26-.78 0z"/></svg>
             <span>Tridente</span>
           </div>`
        : `<div class="product-img-fallback">
             <svg width="36" height="36" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1zm-4.44-6.19l-2.35 3.02-1.56-1.88c-.2-.25-.58-.25-.78 0l-1.74 2.23c-.26.33-.02.82.4.82h8.93c.41 0 .65-.48.4-.81l-2.52-3.38c-.19-.26-.58-.26-.78 0z"/></svg>
             <span>Tridente</span>
           </div>`;

      html += `
        <div class="product-card" data-id="${p.id}">
          <div class="product-img-wrap">
            ${imgHtml}
          </div>

          <div class="product-badges-row">
            <span class="product-sku">SKU: ${p.codigo || 'S/C'}</span>
            <span class="product-tag-iva ${afectoClass}">${afectoLabel}</span>
          </div>

          <h3 class="product-name" title="${p.nombre}">${p.nombre}</h3>

          <div class="packaging-selector">
            <div class="packaging-option">
              <input type="radio" id="pkg_u_${p.id}" name="pkg_${p.id}" value="unidad" checked />
              <label for="pkg_u_${p.id}">
                Por Unidad
                <span class="packaging-price">${formatMoney(p.precio_unitario)}</span>
              </label>
            </div>
            <div class="packaging-option ${!hasCaja ? 'disabled' : ''}">
              <input type="radio" id="pkg_c_${p.id}" name="pkg_${p.id}" value="caja" ${!hasCaja ? 'disabled' : ''} />
              <label for="pkg_c_${p.id}">
                Caja x${p.cantidad_caja || '-'}
                <span class="packaging-price">${hasCaja ? formatMoney(p.precio_caja) : 'N/A'}</span>
              </label>
            </div>
          </div>

          <div class="product-action-row">
            <div class="qty-control">
              <button type="button" class="qty-btn btn-qty-minus" aria-label="Disminuir cantidad">−</button>
              <input type="number" class="qty-input" value="1" min="1" max="999" aria-label="Cantidad" />
              <button type="button" class="qty-btn btn-qty-plus" aria-label="Aumentar cantidad">+</button>
            </div>

            <button type="button" class="btn-add-product" data-id="${p.id}">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              <span>Agregar</span>
            </button>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
    bindProductCardEvents(grid);
    renderPagination(filtered.length);
  }

  function bindProductCardEvents(container) {
    container.querySelectorAll('.product-card').forEach((card) => {
      const pid = card.getAttribute('data-id');
      const minusBtn = card.querySelector('.btn-qty-minus');
      const plusBtn = card.querySelector('.btn-qty-plus');
      const qtyInput = card.querySelector('.qty-input');
      const addBtn = card.querySelector('.btn-add-product');

      minusBtn.addEventListener('click', () => {
        let val = parseInt(qtyInput.value, 10) || 1;
        if (val > 1) qtyInput.value = val - 1;
      });

      plusBtn.addEventListener('click', () => {
        let val = parseInt(qtyInput.value, 10) || 1;
        qtyInput.value = val + 1;
      });

      qtyInput.addEventListener('change', () => {
        let val = parseInt(qtyInput.value, 10);
        if (isNaN(val) || val < 1) qtyInput.value = 1;
      });

      addBtn.addEventListener('click', () => {
        const prod = state.products.find((x) => x.id === pid);
        if (!prod) return;

        const pkgRadio = card.querySelector(`input[name="pkg_${pid}"]:checked`);
        const tipoEmpaque = pkgRadio ? pkgRadio.value : 'unidad';
        const cantidad = parseInt(qtyInput.value, 10) || 1;

        addToCart(prod, tipoEmpaque, cantidad);

        // Feedback visual
        addBtn.classList.add('added-feedback');
        const origText = addBtn.innerHTML;
        addBtn.innerHTML = `<span>✓ Agregado</span>`;
        setTimeout(() => {
          addBtn.classList.remove('added-feedback');
          addBtn.innerHTML = origText;
        }, 1200);

        showToast(`Agregado: ${prod.nombre} (${cantidad} ${tipoEmpaque === 'caja' ? 'caja(s)' : 'unid.'})`, 'success');
      });
    });
  }

  function renderPagination(totalItems) {
    const container = document.getElementById('catalogPagination');
    if (!container) return;

    if (totalItems <= ITEMS_PER_PAGE) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const start = (state.currentPage - 1) * ITEMS_PER_PAGE + 1;
    const end = Math.min(state.currentPage * ITEMS_PER_PAGE, totalItems);

    container.innerHTML = `
      <div class="pagination-info">
        Mostrando <strong>${start} - ${end}</strong> de <strong>${totalItems}</strong> productos
      </div>
      <div class="pagination-controls">
        <button type="button" class="pagination-btn" id="pagPrev" ${state.currentPage === 1 ? 'disabled' : ''}>← Anterior</button>
        <span style="display:flex; align-items:center; font-size:0.85rem; font-weight:700; color:#172B4D; padding:0 8px;">
          Página ${state.currentPage} de ${totalPages}
        </span>
        <button type="button" class="pagination-btn" id="pagNext" ${state.currentPage >= totalPages ? 'disabled' : ''}>Siguiente →</button>
      </div>
    `;

    const prevBtn = document.getElementById('pagPrev');
    const nextBtn = document.getElementById('pagNext');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (state.currentPage > 1) {
          state.currentPage--;
          renderProducts();
          document.getElementById('productsSection')?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (state.currentPage < totalPages) {
          state.currentPage++;
          renderProducts();
          document.getElementById('productsSection')?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  }

  // ─── Gestión de Cotización / Carro ──────────────────────────────────────────
  function addToCart(prod, tipoEmpaque, cantidad) {
    const isCaja = tipoEmpaque === 'caja';
    const unitPrice = isCaja ? prod.precio_caja : prod.precio_unitario;

    const existingIndex = state.cart.findIndex(
      (item) => item.id === prod.id && item.tipo_empaque === tipoEmpaque
    );

    if (existingIndex >= 0) {
      state.cart[existingIndex].cantidad += cantidad;
    } else {
      state.cart.push({
        id: prod.id,
        codigo: prod.codigo || 'S/C',
        nombre: prod.nombre,
        tipo_empaque: tipoEmpaque,
        cantidad_caja: prod.cantidad_caja || null,
        precio_unitario: unitPrice,
        cantidad: cantidad,
        afecto: Boolean(prod.afecto),
        imagen_url: prod.imagen_url || null,
      });
    }

    saveCart();
    renderSummary();
  }

  function removeFromCart(index) {
    state.cart.splice(index, 1);
    saveCart();
    renderSummary();
  }

  function updateCartItemQty(index, newQty) {
    if (newQty <= 0) {
      removeFromCart(index);
    } else {
      state.cart[index].cantidad = newQty;
      saveCart();
      renderSummary();
    }
  }

  function clearCart() {
    if (state.cart.length === 0) return;
    if (confirm('¿Deseas vaciar todos los productos de la cotización?')) {
      state.cart = [];
      saveCart();
      renderSummary();
      showToast('Cotización vaciada', 'warning');
    }
  }

  // ─── Renderizado de la Columna de Resumen ────────────────────────────────────
  function renderSummary() {
    const listEl = document.getElementById('summaryItemsList');
    const badgeEl = document.getElementById('summaryCountBadge');
    const netEl = document.getElementById('totalsNeto');
    const exentoRow = document.getElementById('totalsExentoRow');
    const exentoEl = document.getElementById('totalsExento');
    const ivaEl = document.getElementById('totalsIva');
    const finalEl = document.getElementById('totalsFinalAmount');
    const downloadBtn = document.getElementById('btnDownloadPdf');

    const totals = computeTotals();

    if (badgeEl) badgeEl.textContent = `${totals.itemsCount} productos`;

    if (netEl) netEl.textContent = formatMoney(totals.totalNeto);
    if (ivaEl) ivaEl.textContent = formatMoney(totals.totalIva);
    if (finalEl) finalEl.textContent = formatMoney(totals.totalFinal);

    if (exentoRow && exentoEl) {
      if (totals.totalExento > 0) {
        exentoRow.style.display = 'flex';
        exentoEl.textContent = formatMoney(totals.totalExento);
      } else {
        exentoRow.style.display = 'none';
      }
    }

    if (downloadBtn) {
      downloadBtn.disabled = state.cart.length === 0 || state.isGeneratingPdf;
    }

    if (!listEl) return;

    if (state.cart.length === 0) {
      listEl.innerHTML = `
        <div class="summary-empty-state">
          <div class="summary-empty-icon">📋</div>
          <div class="summary-empty-text">
            <strong>Tu cotización está vacía</strong><br />
            Explora el catálogo y agrega los productos que necesitas cotizar.
          </div>
        </div>
      `;
      return;
    }

    let html = '';
    state.cart.forEach((item, index) => {
      const empaqueLabel = item.tipo_empaque === 'caja' ? `Caja x${item.cantidad_caja || '-'}` : 'Unidad';
      const itemSubtotal = item.precio_unitario * item.cantidad;

      html += `
        <div class="summary-item-row" data-index="${index}">
          <div class="summary-item-info">
            <div class="summary-item-name" title="${item.nombre}">${item.nombre}</div>
            <div class="summary-item-meta">
              <span>SKU: ${item.codigo}</span>
              <span>•</span>
              <span style="font-weight:600; color:#172B4D;">${empaqueLabel}</span>
              <span>•</span>
              <span>${formatMoney(item.precio_unitario)}</span>
            </div>
          </div>

          <div class="summary-item-pricing">
            <div class="summary-item-total">${formatMoney(itemSubtotal)}</div>
            <div class="summary-item-actions">
              <div class="qty-control" style="height: 26px;">
                <button type="button" class="qty-btn btn-cart-minus" data-index="${index}" style="width:20px; font-size:0.9rem;">−</button>
                <span style="padding:0 6px; font-size:0.8rem; font-weight:700;">${item.cantidad}</span>
                <button type="button" class="qty-btn btn-cart-plus" data-index="${index}" style="width:20px; font-size:0.9rem;">+</button>
              </div>
              <button type="button" class="btn-remove-item" data-index="${index}" title="Eliminar producto" aria-label="Eliminar producto">
                🗑️
              </button>
            </div>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll('.btn-cart-minus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        updateCartItemQty(idx, state.cart[idx].cantidad - 1);
      });
    });

    listEl.querySelectorAll('.btn-cart-plus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        updateCartItemQty(idx, state.cart[idx].cantidad + 1);
      });
    });

    listEl.querySelectorAll('.btn-remove-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        removeFromCart(idx);
      });
    });
  }

  // ─── Validación del Formulario de Cliente Nuevo ──────────────────────────────
  function initClientForm() {
    const razonSocialInput = document.getElementById('clientRazonSocial');
    const rutInput = document.getElementById('clientRut');
    const rutError = document.getElementById('clientRutError');
    const telInput = document.getElementById('clientTelefono');
    const emailInput = document.getElementById('clientEmail');
    const dirInput = document.getElementById('clientDireccion');
    const obsInput = document.getElementById('clientObservaciones');

    // Restaurar valores si existen en sesión
    if (state.client.razonSocial && razonSocialInput) razonSocialInput.value = state.client.razonSocial;
    if (state.client.rut && rutInput) rutInput.value = state.client.rut;
    if (state.client.telefono && telInput) telInput.value = state.client.telefono;
    if (state.client.email && emailInput) emailInput.value = state.client.email;
    if (state.client.direccion && dirInput) dirInput.value = state.client.direccion;
    if (state.client.observaciones && obsInput) obsInput.value = state.client.observaciones;

    // Razón Social
    razonSocialInput?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      state.client.razonSocial = val;
      state.clientValid.razonSocial = val.length >= 3;
      toggleValidationState(razonSocialInput, state.clientValid.razonSocial);
      saveCart();
    });

    // RUT con autoformateo y validación de módulo 11
    rutInput?.addEventListener('input', (e) => {
      const formatted = formatRut(e.target.value);
      e.target.value = formatted;
      state.client.rut = formatted;

      const isValid = validateRut(formatted);
      state.clientValid.rut = isValid;
      toggleValidationState(rutInput, isValid);

      if (rutError) {
        if (!formatted) {
          rutError.textContent = 'Ingresa el RUT de la empresa o comerciante.';
          rutError.className = 'cot-help-text';
        } else if (isValid) {
          rutError.textContent = '✓ RUT chileno válido.';
          rutError.className = 'cot-help-text text-success';
        } else {
          rutError.textContent = '⚠️ RUT inválido. Verifica los números y dígito verificador.';
          rutError.className = 'cot-help-text text-error';
        }
      }
      saveCart();
    });

    // Teléfono
    telInput?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      state.client.telefono = val;
      state.clientValid.telefono = val.replace(/\D/g, '').length >= 8;
      toggleValidationState(telInput, state.clientValid.telefono);
      saveCart();
    });

    // Email
    emailInput?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      state.client.email = val;
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      state.clientValid.email = isEmail;
      toggleValidationState(emailInput, isEmail);
      saveCart();
    });

    // Dirección
    dirInput?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      state.client.direccion = val;
      state.clientValid.direccion = val.length >= 5;
      toggleValidationState(dirInput, state.clientValid.direccion);
      saveCart();
    });

    // Observaciones
    obsInput?.addEventListener('input', (e) => {
      state.client.observaciones = e.target.value.trim();
      saveCart();
    });

    // Validar estado inicial
    if (razonSocialInput) state.clientValid.razonSocial = (razonSocialInput.value || '').trim().length >= 3;
    if (rutInput) state.clientValid.rut = validateRut(rutInput.value || '');
    if (telInput) state.clientValid.telefono = (telInput.value || '').replace(/\D/g, '').length >= 8;
    if (emailInput) state.clientValid.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value || '');
    if (dirInput) state.clientValid.direccion = (dirInput.value || '').trim().length >= 5;
  }

  function toggleValidationState(input, isValid) {
    if (!input.value.trim()) {
      input.classList.remove('is-valid', 'is-invalid');
    } else if (isValid) {
      input.classList.add('is-valid');
      input.classList.remove('is-invalid');
    } else {
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
    }
  }

  function validateAllClientFields() {
    const razonSocialInput = document.getElementById('clientRazonSocial');
    const rutInput = document.getElementById('clientRut');
    const telInput = document.getElementById('clientTelefono');
    const emailInput = document.getElementById('clientEmail');
    const dirInput = document.getElementById('clientDireccion');

    const rs = (razonSocialInput?.value || '').trim();
    const rut = (rutInput?.value || '').trim();
    const tel = (telInput?.value || '').trim();
    const mail = (emailInput?.value || '').trim();
    const dir = (dirInput?.value || '').trim();

    if (!rs || rs.length < 3) {
      showToast('Por favor ingresa la Razón Social o Nombre del Cliente', 'error');
      razonSocialInput?.focus();
      return false;
    }

    if (!rut || !validateRut(rut)) {
      showToast('El RUT ingresado no es válido. Verifica el dígito verificador.', 'error');
      rutInput?.focus();
      return false;
    }

    if (!tel || tel.replace(/\D/g, '').length < 8) {
      showToast('Ingresa un número telefónico o WhatsApp de contacto válido.', 'error');
      telInput?.focus();
      return false;
    }

    if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      showToast('Ingresa un correo electrónico válido.', 'error');
      emailInput?.focus();
      return false;
    }

    if (!dir || dir.length < 5) {
      showToast('Ingresa la dirección de despacho y Comuna / Ciudad.', 'error');
      dirInput?.focus();
      return false;
    }

    return true;
  }

  // ─── Generación Oficial de PDF (Formato Oficial de Pedidos Tridente) ───────────
  async function generateCotizacionPDF() {
    if (!validateAllClientFields()) return;

    if (state.cart.length === 0) {
      showToast('Debes agregar al menos un producto a la cotización.', 'warning');
      return;
    }

    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
      showToast('El generador de PDF aún se está cargando. Intenta de nuevo en 2 segundos.', 'warning');
      return;
    }

    const downloadBtn = document.getElementById('btnDownloadPdf');
    const btnSpinner = document.getElementById('pdfBtnSpinner');
    const btnText = document.getElementById('pdfBtnText');

    try {
      state.isGeneratingPdf = true;
      if (downloadBtn) downloadBtn.disabled = true;
      if (btnSpinner) btnSpinner.style.display = 'inline-block';
      if (btnText) btnText.textContent = 'Generando Comprobante PDF...';

      // 1. Código y Tiempos de Vigencia Fija (72 Horas)
      const randomCode = Math.floor(100000 + Math.random() * 900000);
      const cotCode = `COT-${randomCode}`;
      const v = getValidityTimes();
      const totals = computeTotals();

      // 2. Instanciar jsPDF (Formato Carta / Letter)
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 215.9 mm
      const margin = 14;
      const usableWidth = pageWidth - margin * 2;

      // 3. Encabezado Oficial
      // Logo Tridente
      if (typeof window.TRIDENTE_LOGO_BASE64 !== 'undefined') {
        doc.addImage(window.TRIDENTE_LOGO_BASE64, 'PNG', margin, 12, 28, 30.8);
      }

      // Membrete Institucional (Izquierda)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(23, 43, 77); // #172B4D
      doc.text('DISTRIBUIDORA TRIDENTE', 46, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Distribuidora Mayorista de Confites, Snacks, Tabacos y Abarrotes', 46, 23);
      doc.text('La Serena, Coquimbo, Ovalle y Región de Coquimbo, Chile', 46, 27);
      doc.text('WhatsApp: +56 9 4448 8407  |  Web: www.distribuidoratridente.cl', 46, 31);

      // Título y Folio (Derecha)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(20, 108, 206); // #146CCE
      doc.text(`COTIZACIÓN #${cotCode}`, pageWidth - margin, 18, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Emisión: ${v.issuedText}`, pageWidth - margin, 24, { align: 'right' });

      // Vigencia estricta 72 Horas destacada en rojo/ámbar corporativo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38);
      doc.text('⏱️ VIGENCIA: 72 HORAS FIJAS', pageWidth - margin, 29, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Válida hasta: ${v.expiresText}`, pageWidth - margin, 33, { align: 'right' });

      // Línea divisoria azul institucional (#146CCE)
      doc.setDrawColor(20, 108, 206);
      doc.setLineWidth(1);
      doc.line(margin, 40, pageWidth - margin, 40);

      // 4. Bloque de Información del Cliente (Formato Tarjeta)
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, 43, usableWidth, 27, 2, 2, 'FD');

      // Título del bloque
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(23, 43, 77);
      doc.text('DATOS DEL CLIENTE (PROSPECTO REGISTRADO):', margin + 4, 48);

      // Columna 1 del Cliente
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text('Razón Social:', margin + 4, 54);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(state.client.razonSocial || 'No especificado', margin + 26, 54);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('RUT:', margin + 4, 59);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(state.client.rut || 'No especificado', margin + 26, 59);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Dirección / Comuna:', margin + 4, 64);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(state.client.direccion || 'No especificado', margin + 34, 64);

      // Columna 2 del Cliente
      const col2X = margin + 102;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Teléfono / WhatsApp:', col2X, 54);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(state.client.telefono || 'No especificado', col2X + 32, 54);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Correo Electrónico:', col2X, 59);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(state.client.email || 'No especificado', col2X + 32, 59);

      if (state.client.observaciones) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(51, 65, 85);
        doc.text('Observaciones:', col2X, 64);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(state.client.observaciones.slice(0, 45), col2X + 24, 64);
      }

      // 5. Tabla de Productos (jspdf-autotable)
      const tableHeaders = [
        ['#', 'Código', 'Producto / Descripción', 'Empaque', 'Cant.', 'IVA', 'Precio Unit.', 'Subtotal']
      ];

      const tableRows = state.cart.map((item, idx) => {
        const empaqueStr = item.tipo_empaque === 'caja' ? `Caja x${item.cantidad_caja || '-'}` : 'Unidad';
        const ivaStr = item.afecto ? 'Afecto' : 'Exento';
        const subtotal = item.precio_unitario * item.cantidad;

        return [
          idx + 1,
          item.codigo,
          item.nombre,
          empaqueStr,
          item.cantidad,
          ivaStr,
          formatMoney(item.precio_unitario),
          formatMoney(subtotal)
        ];
      });

      doc.autoTable({
        startY: 74,
        head: tableHeaders,
        body: tableRows,
        margin: { left: margin, right: margin },
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 2.5,
          overflow: 'linebreak',
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [23, 43, 77], // #172B4D Azul Tridente
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 8.5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 'auto', halign: 'left' },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
          5: { cellWidth: 15, halign: 'center' },
          6: { cellWidth: 22, halign: 'right' },
          7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        },
        didDrawPage: (data) => {
          // Footer institucional en cada página
          const pageCount = doc.internal.getNumberOfPages();
          const pageHeight = doc.internal.pageSize.getHeight();

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(
            'Distribuidora Tridente SpA • La Serena, Región de Coquimbo • www.distribuidoratridente.cl',
            margin,
            pageHeight - 8
          );
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            pageWidth - margin,
            pageHeight - 8,
            { align: 'right' }
          );
        },
      });

      // 6. Bloque de Totales y Notas Comerciales
      let finalY = doc.lastAutoTable.finalY + 6;
      const pageHeight = doc.internal.pageSize.getHeight();

      // Si queda poco espacio para totales y notas, agregar nueva página
      if (finalY + 60 > pageHeight - 15) {
        doc.addPage();
        finalY = 20;
      }

      // Cuadro de Desglose de Totales (Alineado a la derecha)
      const totalsBoxWidth = 84;
      const totalsBoxX = pageWidth - margin - totalsBoxWidth;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.roundedRect(totalsBoxX, finalY, totalsBoxWidth, totals.totalExento > 0 ? 36 : 30, 2, 2, 'FD');

      let lineY = finalY + 5.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Subtotal Neto (Afecto):', totalsBoxX + 4, lineY);
      doc.text(formatMoney(totals.totalNeto), pageWidth - margin - 4, lineY, { align: 'right' });

      if (totals.totalExento > 0) {
        lineY += 5;
        doc.text('Subtotal Exento:', totalsBoxX + 4, lineY);
        doc.text(formatMoney(totals.totalExento), pageWidth - margin - 4, lineY, { align: 'right' });
      }

      lineY += 5;
      doc.text('IVA (19%):', totalsBoxX + 4, lineY);
      doc.text(formatMoney(totals.totalIva), pageWidth - margin - 4, lineY, { align: 'right' });

      lineY += 6;
      // Barra de Total Final Destacada (#146CCE)
      doc.setFillColor(20, 108, 206);
      doc.roundedRect(totalsBoxX + 2, lineY - 3.5, totalsBoxWidth - 4, 10, 1.5, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text('TOTAL FINAL (CLP):', totalsBoxX + 5, lineY + 3);
      doc.setFontSize(11);
      doc.text(formatMoney(totals.totalFinal), pageWidth - margin - 5, lineY + 3, { align: 'right' });

      // 7. Notas Comerciales al Pie (Alineado a la izquierda)
      const notesWidth = usableWidth - totalsBoxWidth - 6;
      doc.setFillColor(255, 251, 235); // Fondo ámbar suave
      doc.setDrawColor(254, 230, 138);
      doc.roundedRect(margin, finalY, notesWidth, totals.totalExento > 0 ? 36 : 30, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(146, 64, 14);
      doc.text('TÉRMINOS Y CONDICIONES DE LA COTIZACIÓN:', margin + 4, finalY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 53, 15);
      const notes = [
        '• Valores expresados en pesos chilenos (CLP) con impuestos incluidos.',
        '• Esta cotización no reserva stock de productos de forma inmediata.',
        '• Oferta válida exclusivamente por 72 horas a partir de su emisión o hasta agotar existencias.',
        '• Para formalizar tu pedido, contáctanos a nuestro WhatsApp oficial: +56 9 4448 8407.',
      ];

      let noteY = finalY + 9.5;
      notes.forEach((nt) => {
        doc.text(nt, margin + 4, noteY);
        noteY += 4.5;
      });

      // 8. Disparar Descarga Automática del PDF
      const sanitizedClientName = (state.client.razonSocial || 'Cliente')
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, '')
        .trim();
      const fileName = `Cotizacion - ${sanitizedClientName} - ${cotCode}.pdf`;

      doc.save(fileName);

      showToast(`¡Cotización ${cotCode} descargada con éxito!`, 'success');
    } catch (err) {
      console.error('Error generando PDF:', err);
      showToast('Ocurrió un error al generar el PDF. Por favor reintenta.', 'error');
    } finally {
      state.isGeneratingPdf = false;
      if (downloadBtn) downloadBtn.disabled = state.cart.length === 0;
      if (btnSpinner) btnSpinner.style.display = 'none';
      if (btnText) btnText.textContent = 'Descargar Cotización (PDF)';
    }
  }

  // ─── Toasts de Notificación ─────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    let container = document.getElementById('cotToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'cotToastContainer';
      container.className = 'cot-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `cot-toast ${type}`;
    toast.innerHTML = `
      <span style="font-size:1.1rem;">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // ─── Carga de Datos desde API con Fallback ───────────────────────────────────
  async function loadCatalogData() {
    // 1. Usar datos precargados si existen para renderizado en 0ms
    if (window.TRIDENTE_PRODUCTOS_PRECARGADOS && Array.isArray(window.TRIDENTE_PRODUCTOS_PRECARGADOS)) {
      state.products = window.TRIDENTE_PRODUCTOS_PRECARGADOS;
    }
    if (window.TRIDENTE_CATEGORIAS_PRECARGADAS && Array.isArray(window.TRIDENTE_CATEGORIAS_PRECARGADAS)) {
      state.categories = window.TRIDENTE_CATEGORIAS_PRECARGADAS;
    }

    renderCategories();
    renderProducts();

    // 2. Intentar actualizar desde el backend en vivo
    try {
      const [resProd, resCat] = await Promise.all([
        fetch(`${API_BASE}/api/productos`),
        fetch(`${API_BASE}/api/categorias`),
      ]);

      if (resProd.ok) {
        const prodData = await resProd.json();
        if (Array.isArray(prodData) && prodData.length > 0) {
          state.products = prodData;
        }
      }

      if (resCat.ok) {
        const catData = await resCat.json();
        if (Array.isArray(catData) && catData.length > 0) {
          state.categories = catData;
        }
      }

      renderCategories();
      renderProducts();
    } catch (err) {
      console.warn('Usando catálogo precargado local (API en segundo plano no disponible):', err);
    }
  }

  // ─── Inicialización de Eventos Generales ─────────────────────────────────────
  function initEvents() {
    const searchInput = document.getElementById('catalogSearchInput');
    const clearSearchBtn = document.getElementById('searchClearBtn');
    const clearCartBtn = document.getElementById('btnClearCot');
    const downloadPdfBtn = document.getElementById('btnDownloadPdf');

    // Búsqueda interactiva
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        state.currentPage = 1;
        if (clearSearchBtn) {
          clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
        }
        renderProducts();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          state.searchQuery = '';
          state.currentPage = 1;
          clearSearchBtn.style.display = 'none';
          renderProducts();
          searchInput.focus();
        }
      });
    }

    // Vaciar Cotización
    if (clearCartBtn) {
      clearCartBtn.addEventListener('click', clearCart);
    }

    // Botón Único de Descarga PDF
    if (downloadPdfBtn) {
      downloadPdfBtn.addEventListener('click', generateCotizacionPDF);
    }
  }

  // ─── Inicio ─────────────────────────────────────────────────────────────────
  function init() {
    loadCart();
    updateVigenciaBanners();
    initClientForm();
    initEvents();
    renderSummary();
    loadCatalogData();

    // Actualizar reloj de vigencia cada minuto
    setInterval(updateVigenciaBanners, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
