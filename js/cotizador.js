/**
 * ============================================================================
 * DISTRIBUIDORA TRIDENTE - COTIZADOR OFICIAL WEB PÚBLICO
 * Generación de Cotizaciones Formales con Descarga Exclusiva en PDF (72 Horas)
 * Diseño Idéntico al Comprobante Oficial de Pedidos Tridente
 * ============================================================================
 */

(function () {
  'use strict';

  // ─── Estado Global del Cotizador ────────────────────────────────────────────
  const state = {
    products: [],
    categories: [],
    cart: [],
    client: {
      razonSocial: '',
      rut: '',
      email: '',
      telefono: '',
      direccion: '',
      observaciones: '',
    },
    clientValid: {
      razonSocial: false,
      rut: false,
      email: false,
      telefono: false,
      direccion: false,
    },
    selectedProduct: null,
    selectedPackaging: 'unidad',
    selectedQty: 1,
    filterCategory: '',
    searchQuery: '',
    cotFolio: generateFolioCode(),
    isGeneratingPdf: false,
  };

  // ─── Generador de Código de Folio (Ej: COT-605NTA) ──────────────────────────
  function generateFolioCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const nums = Math.floor(100 + Math.random() * 900);
    let letters = '';
    for (let i = 0; i < 3; i++) {
      letters += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `COT-${nums}${letters}`;
  }

  // ─── Utilidades de Formato Monetario Chileno ────────────────────────────────
  function formatMoney(amount) {
    const num = Math.round(Number(amount) || 0);
    return '$' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // ─── Algoritmo de Módulo 11 Chileno para Validación de RUT ──────────────────
  function cleanRut(rut) {
    return String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
  }

  function formatRut(rut) {
    const clean = cleanRut(rut);
    if (!clean) return '';
    if (clean.length === 1) return clean;
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    let formattedBody = '';
    let count = 0;
    for (let i = body.length - 1; i >= 0; i--) {
      formattedBody = body[i] + formattedBody;
      count++;
      if (count === 3 && i > 0) {
        formattedBody = '.' + formattedBody;
        count = 0;
      }
    }
    return `${formattedBody}-${dv}`;
  }

  function validateRut(rut) {
    const clean = cleanRut(rut);
    if (clean.length < 2) return false;
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    if (!/^\d+$/.test(body)) return false;

    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i], 10) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    const expectedDvNum = 11 - (sum % 11);
    let expectedDv = '0';
    if (expectedDvNum === 11) expectedDv = '0';
    else if (expectedDvNum === 10) expectedDv = 'K';
    else expectedDv = String(expectedDvNum);

    return dv === expectedDv;
  }

  // ─── Regla Estricta de Vigencia de 72 Horas ─────────────────────────────────
  function getValidityTimes() {
    const now = new Date();
    const expires = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    const pad = (n) => String(n).padStart(2, '0');

    const day = pad(now.getDate());
    const month = pad(now.getMonth() + 1);
    const year = now.getFullYear();
    const hours = pad(now.getHours());
    const mins = pad(now.getMinutes());

    const expDay = pad(expires.getDate());
    const expMonth = pad(expires.getMonth() + 1);
    const expYear = expires.getFullYear();
    const expHours = pad(expires.getHours());
    const expMins = pad(expires.getMinutes());

    return {
      issuedDate: `${day}-${month}-${year}`,
      issuedTime: `${hours}:${mins}`,
      issuedFull: `${day}-${month}-${year} ${hours}:${mins}`,
      expiresDate: `${expDay}-${expMonth}-${expYear}`,
      expiresTime: `${expHours}:${expMins}`,
      expiresFull: `${expDay}-${expMonth}-${expYear} ${expHours}:${expMins}`,
      expiresText: `${expDay}-${expMonth}-${expYear} a las ${expHours}:${expMins} hrs`,
    };
  }

  // ─── Cálculo Financiero Exacto (Neto, Exento, IVA 19%, Total) ───────────────
  function computeTotals() {
    let subtotalAfectoBruto = 0;
    let subtotalExento = 0;
    let totalUnidades = 0;

    state.cart.forEach((item) => {
      const lineTotal = item.precio_unitario * item.cantidad;
      if (item.tipo_empaque === 'caja' && item.cantidad_caja) {
        totalUnidades += item.cantidad * item.cantidad_caja;
      } else {
        totalUnidades += item.cantidad;
      }

      if (item.afecto) {
        subtotalAfectoBruto += lineTotal;
      } else {
        subtotalExento += lineTotal;
      }
    });

    const subtotalNeto = Math.round(subtotalAfectoBruto / 1.19);
    const iva19 = subtotalAfectoBruto - subtotalNeto;
    const totalFinal = subtotalAfectoBruto + subtotalExento;

    return {
      itemsCount: state.cart.length,
      unidadesCount: totalUnidades,
      subtotalNeto,
      subtotalExento,
      iva19,
      totalFinal,
    };
  }

  // ─── Notificaciones Toast ───────────────────────────────────────────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `cot-toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(16px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // ─── Inicialización y Carga de Catálogo ──────────────────────────────────────
  async function loadCatalog() {
    const countEl = document.getElementById('selectorCatalogCount');

    // 1. Fallback inmediato desde assets precompilados
    if (typeof window.TRIDENTE_CATALOG !== 'undefined' && Array.isArray(window.TRIDENTE_CATALOG.products)) {
      state.products = window.TRIDENTE_CATALOG.products;
      state.categories = window.TRIDENTE_CATALOG.categories || [];
      populateCategorySelect();
      populateProductSelect();
      if (countEl) countEl.textContent = `${state.products.length} productos disponibles`;
    }

    // 2. Sincronización en vivo con API FastAPI
    try {
      const [resProd, resCat] = await Promise.all([
        fetch('https://camila.distribuidoratridente.cl/api/productos', { cache: 'no-cache' }),
        fetch('https://camila.distribuidoratridente.cl/api/categorias', { cache: 'no-cache' }),
      ]);

      if (resProd.ok) {
        const liveProducts = await resProd.json();
        if (Array.isArray(liveProducts) && liveProducts.length > 0) {
          state.products = liveProducts;
        }
      }

      if (resCat.ok) {
        const liveCats = await resCat.json();
        if (Array.isArray(liveCats) && liveCats.length > 0) {
          state.categories = liveCats;
        }
      }

      populateCategorySelect();
      populateProductSelect();
      if (countEl) countEl.textContent = `${state.products.length} productos disponibles`;
    } catch (err) {
      console.warn('Cargando con catálogo local en caché:', err);
    }
  }

  // ─── Poblado de Select de Categorías ────────────────────────────────────────
  function populateCategorySelect() {
    const select = document.getElementById('selectCategoria');
    if (!select) return;

    let currentVal = select.value;
    select.innerHTML = '<option value="">Todas las Categorías</option>';

    // Extraer categorías únicas si no vienen en el array
    let cats = state.categories;
    if (!cats || cats.length === 0) {
      const set = new Set();
      state.products.forEach((p) => {
        if (p.categoria) set.add(p.categoria);
      });
      cats = Array.from(set).sort();
    }

    cats.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === currentVal) opt.selected = true;
      select.appendChild(opt);
    });
  }

  // ─── Poblado Dinámico de Select de Productos (Filtrado por Cat y Búsqueda) ───
  function getFilteredProducts() {
    const cat = (state.filterCategory || '').toLowerCase().trim();
    const query = (state.searchQuery || '').toLowerCase().trim();

    return state.products.filter((p) => {
      // Filtro de categoría
      if (cat) {
        const pCat = (p.categoria || '').toLowerCase();
        if (pCat !== cat) return false;
      }
      // Filtro de búsqueda
      if (query) {
        const nameMatch = (p.nombre || '').toLowerCase().includes(query);
        const skuMatch = String(p.codigo || '').toLowerCase().includes(query);
        if (!nameMatch && !skuMatch) return false;
      }
      return true;
    });
  }

  function populateProductSelect() {
    const select = document.getElementById('selectProducto');
    if (!select) return;

    const filtered = getFilteredProducts();
    const prevSelectedId = state.selectedProduct ? state.selectedProduct.id : '';

    select.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = filtered.length > 0
      ? `-- Elige un producto de la lista (${filtered.length} encontrados) --`
      : '-- No se encontraron productos coincidentes --';
    select.appendChild(defaultOpt);

    filtered.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const sku = p.codigo ? `[${p.codigo}]` : '';
      const precio = formatMoney(p.precio_unitario);
      opt.textContent = `${p.nombre} ${sku} - ${precio}`;
      if (p.id === prevSelectedId) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    // Si había un producto seleccionado pero ya no está en el filtro, ocultar preview
    if (prevSelectedId) {
      const stillThere = filtered.some((p) => p.id === prevSelectedId);
      if (!stillThere) {
        state.selectedProduct = null;
        updateProductPreviewCard();
      }
    }
  }

  // ─── Actualización de la Ficha / Preview del Producto Seleccionado ──────────
  function updateProductPreviewCard() {
    const card = document.getElementById('selectedProductCard');
    if (!card) return;

    const prod = state.selectedProduct;
    if (!prod) {
      card.style.display = 'none';
      return;
    }

    card.style.display = 'flex';

    // Imagen del producto
    const imgEl = document.getElementById('cardProductImg');
    if (imgEl) {
      if (prod.imagen_url) {
        imgEl.src = prod.imagen_url.startsWith('http')
          ? prod.imagen_url
          : `https://camila.distribuidoratridente.cl${prod.imagen_url}`;
      } else {
        imgEl.src = 'img/logo-tridente-pdf.png';
      }
      imgEl.alt = prod.nombre;
    }

    // Textos informativos
    const nameEl = document.getElementById('cardProductName');
    const skuEl = document.getElementById('cardProductSku');
    const catEl = document.getElementById('cardProductCat');
    const ivaEl = document.getElementById('cardProductIva');

    if (nameEl) nameEl.textContent = prod.nombre;
    if (skuEl) skuEl.textContent = `SKU: ${prod.codigo || 'S/C'}`;
    if (catEl) catEl.textContent = prod.categoria || 'General';
    if (ivaEl) {
      ivaEl.textContent = prod.afecto ? 'Afecto IVA (19%)' : 'Exento de IVA';
      ivaEl.className = prod.afecto ? 'card-tag iva-tag' : 'card-tag sku-tag';
    }

    // Precios y Empaque
    const priceUnidadEl = document.getElementById('priceTextUnidad');
    const priceCajaEl = document.getElementById('priceTextCaja');
    const labelCaja = document.getElementById('labelRadioCaja');
    const cajaQtyBadge = document.getElementById('cajaQtyBadge');
    const radioUnidad = document.querySelector('input[name="previewPackaging"][value="unidad"]');
    const radioCaja = document.querySelector('input[name="previewPackaging"][value="caja"]');
    const labelUnidad = document.getElementById('labelRadioUnidad');

    if (priceUnidadEl) priceUnidadEl.textContent = formatMoney(prod.precio_unitario);

    if (prod.tiene_caja && prod.precio_caja > 0) {
      if (labelCaja) labelCaja.style.display = 'inline-flex';
      if (cajaQtyBadge) cajaQtyBadge.textContent = `Caja x${prod.cantidad_caja || 1}`;
      if (priceCajaEl) priceCajaEl.textContent = formatMoney(prod.precio_caja);
    } else {
      if (labelCaja) labelCaja.style.display = 'none';
      state.selectedPackaging = 'unidad';
      if (radioUnidad) radioUnidad.checked = true;
      if (labelUnidad) labelUnidad.classList.add('active');
      if (labelCaja) labelCaja.classList.remove('active');
    }

    // Reset cantidad
    const qtyInput = document.getElementById('inputPreviewQty');
    if (qtyInput) {
      qtyInput.value = '1';
      state.selectedQty = 1;
    }
  }

  // ─── Agregar Producto al Carro / Cotización ──────────────────────────────────
  function addCurrentSelectedProduct() {
    const prod = state.selectedProduct;
    if (!prod) {
      showToast('Por favor selecciona un producto primero.', 'warning');
      return;
    }

    const qtyInput = document.getElementById('inputPreviewQty');
    const cantidad = Math.max(1, parseInt(qtyInput ? qtyInput.value : '1', 10) || 1);
    const tipoEmpaque = state.selectedPackaging;
    const isCaja = tipoEmpaque === 'caja';
    const unitPrice = isCaja ? prod.precio_caja : prod.precio_unitario;

    const existingIdx = state.cart.findIndex(
      (item) => item.id === prod.id && item.tipo_empaque === tipoEmpaque
    );

    if (existingIdx >= 0) {
      state.cart[existingIdx].cantidad += cantidad;
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

    // Renderizar tabla y validar
    renderCotizacionTable();
    checkDownloadState();

    // Feedback al usuario
    const empaqueTxt = isCaja ? `Caja(s) x${prod.cantidad_caja || 1}` : 'unid.';
    showToast(`✓ Agregado: ${prod.nombre} (${cantidad} ${empaqueTxt})`, 'success');

    // Reset cantidad a 1
    if (qtyInput) qtyInput.value = '1';
    state.selectedQty = 1;
  }

  // ─── Modificar / Eliminar Productos de la Tabla ──────────────────────────────
  function updateCartQty(index, newQty) {
    if (newQty <= 0) {
      state.cart.splice(index, 1);
    } else {
      state.cart[index].cantidad = newQty;
    }
    renderCotizacionTable();
    checkDownloadState();
  }

  function removeCartItem(index) {
    const item = state.cart[index];
    state.cart.splice(index, 1);
    renderCotizacionTable();
    checkDownloadState();
    if (item) showToast(`Eliminado: ${item.nombre}`, 'info');
  }

  // ─── Renderizado de la Tabla Idéntica al PDF ─────────────────────────────────
  function renderCotizacionTable() {
    const tbody = document.getElementById('cotizacionTableBody');
    const totalItemsEl = document.getElementById('docTotalItemsText');
    const totalFinalEl = document.getElementById('docTotalFinal');
    const netoEl = document.getElementById('docSubtotalNeto');
    const exentoEl = document.getElementById('docSubtotalExento');
    const exentoRow = document.getElementById('docExentoRow');
    const ivaEl = document.getElementById('docSubtotalIva');

    if (!tbody) return;

    if (state.cart.length === 0) {
      tbody.innerHTML = `
        <tr class="table-empty-row">
          <td colspan="6">
            <div class="table-empty-box">
              <span class="table-empty-icon">📋</span>
              <strong>Aún no has agregado productos a tu cotización</strong>
              <span>Selecciona una categoría o producto arriba y haz clic en "➕ Agregar a la Cotización".</span>
            </div>
          </td>
        </tr>
      `;
      if (totalItemsEl) totalItemsEl.textContent = 'Total productos: 0 ítems (0 un.)';
      if (totalFinalEl) totalFinalEl.textContent = '$0';
      if (netoEl) netoEl.textContent = '$0';
      if (exentoEl) exentoEl.textContent = '$0';
      if (exentoRow) exentoRow.style.display = 'none';
      if (ivaEl) ivaEl.textContent = '$0';
      return;
    }

    let html = '';
    state.cart.forEach((item, index) => {
      const subtotal = item.precio_unitario * item.cantidad;
      const empaqueBadge = item.tipo_empaque === 'caja'
        ? `cja. (x${item.cantidad_caja || 1} un.)`
        : 'un.';
      const ivaLabel = item.afecto ? 'Afecto' : 'Exento';

      const imgSrc = item.imagen_url
        ? (item.imagen_url.startsWith('http') ? item.imagen_url : `https://camila.distribuidoratridente.cl${item.imagen_url}`)
        : 'img/logo-tridente-pdf.png';

      html += `
        <tr>
          <td class="col-producto">
            <div class="table-product-cell">
              <img
                src="${imgSrc}"
                alt="${item.nombre}"
                class="table-product-thumb"
                onerror="this.onerror=null; this.src='img/logo-tridente-pdf.png';"
              />
              <div class="table-product-info">
                <span class="table-product-title">${item.nombre} [${item.codigo}]</span>
                <span class="table-product-sku">Empaque: ${item.tipo_empaque === 'caja' ? `Caja x${item.cantidad_caja}` : 'Unidad'}</span>
              </div>
            </div>
          </td>

          <td class="col-cantidad">
            <div class="table-qty-control">
              <button type="button" class="btn-mini-qty btn-table-minus" data-index="${index}" title="Restar 1">−</button>
              <strong style="min-width: 28px; text-align: center;">${item.cantidad}</strong>
              <button type="button" class="btn-mini-qty btn-table-plus" data-index="${index}" title="Sumar 1">+</button>
              <span style="font-size:0.75rem; color:#64748b; margin-left:4px;">${empaqueBadge}</span>
            </div>
          </td>

          <td class="col-iva">
            <span style="font-size:0.85rem; color:${item.afecto ? '#15803d' : '#475569'}; font-weight:600;">
              ${ivaLabel}
            </span>
          </td>

          <td class="col-unitario">
            ${formatMoney(item.precio_unitario)}
          </td>

          <td class="col-subtotal">
            ${formatMoney(subtotal)}
          </td>

          <td class="col-accion">
            <button type="button" class="btn-table-del" data-index="${index}" title="Eliminar producto" aria-label="Eliminar producto">
              🗑️
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;

    // Enlazar eventos de botones en la tabla
    tbody.querySelectorAll('.btn-table-minus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        updateCartQty(idx, state.cart[idx].cantidad - 1);
      });
    });

    tbody.querySelectorAll('.btn-table-plus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        updateCartQty(idx, state.cart[idx].cantidad + 1);
      });
    });

    tbody.querySelectorAll('.btn-table-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        removeCartItem(idx);
      });
    });

    // Totales calculados
    const totals = computeTotals();
    if (totalItemsEl) {
      totalItemsEl.textContent = `Total productos: ${totals.itemsCount} ítems (${totals.unidadesCount} un.)`;
    }
    const finalFormatted = `${formatMoney(totals.totalFinal)}.- Imp. Inc.`;
    if (totalFinalEl) totalFinalEl.textContent = finalFormatted;
    if (netoEl) netoEl.textContent = formatMoney(totals.subtotalNeto);
    if (ivaEl) ivaEl.textContent = formatMoney(totals.iva19);

    if (totals.subtotalExento > 0 && exentoRow && exentoEl) {
      exentoRow.style.display = 'block';
      exentoEl.textContent = formatMoney(totals.subtotalExento);
    } else if (exentoRow) {
      exentoRow.style.display = 'none';
    }
  }

  // ─── Validación y Habilitación del Botón de Descarga PDF ────────────────────
  function checkDownloadState() {
    const downloadBtn = document.getElementById('btnDownloadPdf');
    const alertBox = document.getElementById('downloadStateAlert');

    const rsInput = document.getElementById('clientRazonSocial');
    const rutInput = document.getElementById('clientRut');
    const telInput = document.getElementById('clientTelefono');
    const mailInput = document.getElementById('clientEmail');
    const dirInput = document.getElementById('clientDireccion');

    const rsVal = (rsInput ? rsInput.value : '').trim();
    const rutVal = (rutInput ? rutInput.value : '').trim();
    const telVal = (telInput ? telInput.value : '').trim();
    const mailVal = (mailInput ? mailInput.value : '').trim();
    const dirVal = (dirInput ? dirInput.value : '').trim();

    const isRsValid = rsVal.length >= 3;
    const isRutValid = validateRut(rutVal);
    const isTelValid = telVal.replace(/\D/g, '').length >= 8;
    const isMailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailVal);
    const isDirValid = dirVal.length >= 5;
    const hasProducts = state.cart.length > 0;

    const allValid = isRsValid && isRutValid && isTelValid && isMailValid && isDirValid && hasProducts;

    if (downloadBtn) {
      downloadBtn.disabled = !allValid;
    }

    if (alertBox) {
      if (allValid) {
        alertBox.className = 'download-state-alert is-ready';
        alertBox.innerHTML = `
          <span class="alert-icon">✅</span>
          <span class="alert-text"><strong>¡Todo listo!</strong> Todos los datos comerciales están completos y tienes ${state.cart.length} producto(s) en la cotización. Ya puedes descargar tu PDF.</span>
        `;
      } else {
        alertBox.className = 'download-state-alert';
        let missing = [];
        if (!isRsValid) missing.push('Razón Social');
        if (!isRutValid) missing.push('RUT válido');
        if (!isMailValid) missing.push('Correo');
        if (!isTelValid) missing.push('Teléfono');
        if (!isDirValid) missing.push('Dirección');
        if (!hasProducts) missing.push('al menos 1 producto');

        alertBox.innerHTML = `
          <span class="alert-icon">⚠️</span>
          <span class="alert-text">Falta para habilitar la descarga: <strong>${missing.join(', ')}</strong>.</span>
        `;
      }
    }

    return allValid;
  }

  // ─── Generación de PDF Idéntica al Screenshot Oficial ───────────────────────
  async function generateCotizacionPDF() {
    if (!checkDownloadState()) {
      showToast('Completa todos los campos obligatorios y agrega al menos un producto.', 'error');
      return;
    }

    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
      showToast('Cargando librería de PDF... por favor reintenta en un momento.', 'warning');
      return;
    }

    const downloadBtn = document.getElementById('btnDownloadPdf');
    const spinner = document.getElementById('pdfBtnSpinner');
    const btnText = document.getElementById('pdfBtnText');

    try {
      state.isGeneratingPdf = true;
      if (downloadBtn) downloadBtn.disabled = true;
      if (spinner) spinner.style.display = 'inline-block';
      if (btnText) btnText.textContent = 'Generando Comprobante Oficial...';

      const v = getValidityTimes();
      const totals = computeTotals();
      const cotCode = state.cotFolio;

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 215.9 mm
      const margin = 18;
      const usableWidth = pageWidth - margin * 2;

      // 1. Logo Tridente Oficial (Top-Left)
      if (typeof window.TRIDENTE_LOGO_BASE64 !== 'undefined') {
        doc.addImage(window.TRIDENTE_LOGO_BASE64, 'PNG', margin, 14, 22, 24.2);
      }

      // 2. Título Formal (Top-Right): COTIZACIÓN #COT-XXXXXX
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(23, 43, 77); // #172B4D
      doc.text(`COTIZACIÓN #${cotCode}`, pageWidth - margin, 26, { align: 'right' });

      // 3. Línea Azul Separadora Oficial (#146CCE)
      doc.setDrawColor(20, 108, 206);
      doc.setLineWidth(1);
      doc.line(margin, 43, pageWidth - margin, 43);

      // 4. Bloque de Datos del Cliente (Exacto al Screenshot)
      let curY = 51;
      const lineHeight = 5.2;

      const rs = (document.getElementById('clientRazonSocial')?.value || '').trim();
      const rut = (document.getElementById('clientRut')?.value || '').trim();
      const email = (document.getElementById('clientEmail')?.value || '').trim();
      const tel = (document.getElementById('clientTelefono')?.value || '').trim();
      const dir = (document.getElementById('clientDireccion')?.value || '').trim();
      const obs = (document.getElementById('clientObservaciones')?.value || '').trim() || 'nada';

      const printField = (label, value, isHighlight = false) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(label, margin, curY);

        const labelWidth = doc.getTextWidth(label) + 2;
        doc.setFont('helvetica', 'normal');
        if (isHighlight) {
          doc.setTextColor(185, 28, 28);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(71, 85, 105);
        }
        doc.text(value, margin + labelWidth, curY);
        curY += lineHeight;
      };

      printField('Cliente / Razón Social: ', rs);
      printField('RUT / Identificador: ', rut);
      printField('Correo Electrónico: ', email);
      printField('Teléfono: ', tel);
      printField('Fecha de emisión: ', v.issuedFull);
      printField('Vigencia de la oferta: ', `72 horas (hasta el ${v.expiresFull})`);
      printField('Dirección / Entrega: ', dir);
      printField('Observaciones: ', obs);

      curY += 4;

      // 5. Tabla de Productos (Idéntica al Screenshot del PDF)
      // Columnas: Producto | Cantidad | IVA | Precio Unit. | Subtotal
      const tableHeaders = [
        ['Producto', 'Cantidad', 'IVA', 'Precio Unit.', 'Subtotal']
      ];

      const tableRows = state.cart.map((item) => {
        const prodLabel = `${item.nombre} [${item.codigo}]`;
        const cantLabel = `${item.cantidad} ${item.tipo_empaque === 'caja' ? `cja. (x${item.cantidad_caja || 1} un.)` : 'un.'}`;
        const ivaLabel = item.afecto ? 'Afecto' : 'Exento';
        const subtotal = item.precio_unitario * item.cantidad;

        return [
          prodLabel,
          cantLabel,
          ivaLabel,
          formatMoney(item.precio_unitario),
          formatMoney(subtotal)
        ];
      });

      doc.autoTable({
        startY: curY,
        head: tableHeaders,
        body: tableRows,
        margin: { left: margin, right: margin },
        styles: {
          font: 'helvetica',
          fontSize: 8.5,
          cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
          textColor: [30, 41, 59],
          lineWidth: 0,
        },
        headStyles: {
          fillColor: [235, 243, 250], // Soft light-blue (#EBF3FA)
          textColor: [23, 43, 77],
          fontStyle: 'bold',
          fontSize: 8.5,
          lineWidth: 0,
        },
        alternateRowStyles: {
          fillColor: [250, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'left' },
          1: { cellWidth: 26, halign: 'center' },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 28, halign: 'right' },
          4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        },
      });

      const finalY = doc.lastAutoTable.finalY + 7;

      // 6. Fila de Total y Conteo de Ítems
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Total productos: ${totals.itemsCount} ítems (${totals.unidadesCount} un.)`, margin, finalY);

      const totalPdfStr = `${formatMoney(totals.totalFinal)}.- Imp. Inc.`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(23, 43, 77);

      doc.setFontSize(12);
      const totalStrWidth = doc.getTextWidth(totalPdfStr);
      doc.text('TOTAL', pageWidth - margin - totalStrWidth - 6, finalY);
      doc.text(totalPdfStr, pageWidth - margin, finalY, { align: 'right' });

      // 7. Condiciones de la Cotización (Pie del Documento)
      const condY = finalY + 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Condiciones de la cotización:', margin, condY);

      const bulletPoints = [
        '• Valores expresados en pesos chilenos (CLP) con impuestos incluidos.',
        '• Esta cotización no reserva stock de productos de forma inmediata.',
        `• Válida hasta el ${v.expiresFull} o hasta agotar existencias.`,
        '• Para confirmar y procesar este pedido, comuníquese con su ejecutivo comercial o responda a este documento.'
      ];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(110, 120, 135);

      bulletPoints.forEach((bp, idx) => {
        doc.text(bp, margin, condY + 4 + idx * 3.8);
      });

      // 8. Descarga Automática del PDF
      const sanitizedName = rs.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s_-]/g, '').trim() || 'Cliente';
      const filename = `Cotizacion - ${sanitizedName} - ${cotCode}.pdf`;

      doc.save(filename);
      showToast(`¡Cotización descargada con éxito! (${filename})`, 'success');
    } catch (err) {
      console.error('Error generando PDF:', err);
      showToast('Ocurrió un error al generar el PDF. Intenta nuevamente.', 'error');
    } finally {
      state.isGeneratingPdf = false;
      if (downloadBtn) downloadBtn.disabled = !checkDownloadState();
      if (spinner) spinner.style.display = 'none';
      if (btnText) btnText.textContent = 'Descargar Cotización (PDF)';
    }
  }

  // ─── Inicialización de Eventos y Listeners ──────────────────────────────────
  function initEvents() {
    const v = getValidityTimes();

    // Folio y fechas en la vista
    const folioEl = document.getElementById('sheetCotFolio');
    const emisionEl = document.getElementById('sheetFechaEmision');
    const vigenciaEl = document.getElementById('sheetVigenciaOferta');
    const heroVigencia = document.getElementById('heroVigenciaText');
    const condVenceEl = document.getElementById('sheetCondicionesVenceDate');

    if (folioEl) folioEl.textContent = `COTIZACIÓN #${state.cotFolio}`;
    if (emisionEl) emisionEl.textContent = v.issuedFull;
    if (vigenciaEl) vigenciaEl.textContent = `72 horas (hasta el ${v.expiresFull})`;
    if (heroVigencia) heroVigencia.textContent = `Cotización válida por 72 horas (hasta el ${v.expiresText})`;
    if (condVenceEl) condVenceEl.textContent = v.expiresFull;

    // Selector de Categoría
    const selectCat = document.getElementById('selectCategoria');
    selectCat?.addEventListener('change', (e) => {
      state.filterCategory = e.target.value;
      populateProductSelect();
    });

    // Input de Búsqueda por Nombre / SKU
    const inputSearch = document.getElementById('inputBuscarProducto');
    const btnClearSearch = document.getElementById('btnClearSearch');

    inputSearch?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      populateProductSelect();
    });

    btnClearSearch?.addEventListener('click', () => {
      if (inputSearch) inputSearch.value = '';
      state.searchQuery = '';
      populateProductSelect();
    });

    // Selector de Producto
    const selectProd = document.getElementById('selectProducto');
    selectProd?.addEventListener('change', (e) => {
      const pid = e.target.value;
      if (!pid) {
        state.selectedProduct = null;
      } else {
        state.selectedProduct = state.products.find((p) => p.id === pid) || null;
      }
      updateProductPreviewCard();
    });

    // Radio de Empaque (Unidad vs Caja)
    const radiosPkg = document.querySelectorAll('input[name="previewPackaging"]');
    const labelUnidad = document.getElementById('labelRadioUnidad');
    const labelCaja = document.getElementById('labelRadioCaja');

    radiosPkg.forEach((r) => {
      r.addEventListener('change', (e) => {
        state.selectedPackaging = e.target.value;
        if (e.target.value === 'unidad') {
          labelUnidad?.classList.add('active');
          labelCaja?.classList.remove('active');
        } else {
          labelCaja?.classList.add('active');
          labelUnidad?.classList.remove('active');
        }
      });
    });

    // Stepper de Cantidad (+ / -)
    const btnMinus = document.getElementById('btnPreviewMinus');
    const btnPlus = document.getElementById('btnPreviewPlus');
    const inputQty = document.getElementById('inputPreviewQty');

    btnMinus?.addEventListener('click', () => {
      let val = parseInt(inputQty?.value || '1', 10);
      if (val > 1) {
        inputQty.value = val - 1;
        state.selectedQty = val - 1;
      }
    });

    btnPlus?.addEventListener('click', () => {
      let val = parseInt(inputQty?.value || '1', 10);
      inputQty.value = val + 1;
      state.selectedQty = val + 1;
    });

    inputQty?.addEventListener('change', () => {
      let val = parseInt(inputQty.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      inputQty.value = val;
      state.selectedQty = val;
    });

    // Botón Agregar Producto Seleccionado
    const btnAdd = document.getElementById('btnAddSelectedProduct');
    btnAdd?.addEventListener('click', () => {
      addCurrentSelectedProduct();
    });

    // Listeners del Formulario de Cliente
    const rsInput = document.getElementById('clientRazonSocial');
    const rutInput = document.getElementById('clientRut');
    const rutErr = document.getElementById('clientRutError');
    const telInput = document.getElementById('clientTelefono');
    const mailInput = document.getElementById('clientEmail');
    const dirInput = document.getElementById('clientDireccion');
    const obsInput = document.getElementById('clientObservaciones');

    rsInput?.addEventListener('input', () => {
      const valid = rsInput.value.trim().length >= 3;
      rsInput.classList.toggle('is-valid', valid);
      rsInput.classList.toggle('is-invalid', !valid && rsInput.value.length > 0);
      checkDownloadState();
    });

    rutInput?.addEventListener('input', (e) => {
      const formatted = formatRut(e.target.value);
      e.target.value = formatted;
      const valid = validateRut(formatted);

      rutInput.classList.toggle('is-valid', valid);
      rutInput.classList.toggle('is-invalid', !valid && formatted.length > 2);

      if (rutErr) {
        if (!formatted) {
          rutErr.textContent = '';
        } else if (valid) {
          rutErr.textContent = '✓ RUT chileno válido';
          rutErr.className = 'field-feedback text-success';
        } else {
          rutErr.textContent = '⚠️ RUT inválido';
          rutErr.className = 'field-feedback text-error';
        }
      }
      checkDownloadState();
    });

    telInput?.addEventListener('input', () => {
      const valid = telInput.value.replace(/\D/g, '').length >= 8;
      telInput.classList.toggle('is-valid', valid);
      telInput.classList.toggle('is-invalid', !valid && telInput.value.length > 0);
      checkDownloadState();
    });

    mailInput?.addEventListener('input', () => {
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailInput.value.trim());
      mailInput.classList.toggle('is-valid', valid);
      mailInput.classList.toggle('is-invalid', !valid && mailInput.value.length > 0);
      checkDownloadState();
    });

    dirInput?.addEventListener('input', () => {
      const valid = dirInput.value.trim().length >= 5;
      dirInput.classList.toggle('is-valid', valid);
      dirInput.classList.toggle('is-invalid', !valid && dirInput.value.length > 0);
      checkDownloadState();
    });

    obsInput?.addEventListener('input', () => {
      checkDownloadState();
    });

    // Botón de Descarga PDF
    const btnDownload = document.getElementById('btnDownloadPdf');
    btnDownload?.addEventListener('click', () => {
      generateCotizacionPDF();
    });

    // Estado inicial de la tabla y botón
    renderCotizacionTable();
    checkDownloadState();
  }

  // ─── Arranque cuando el DOM esté Listo ───────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initEvents();
      loadCatalog();
    });
  } else {
    initEvents();
    loadCatalog();
  }
})();
