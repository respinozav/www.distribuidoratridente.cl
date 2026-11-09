/**
 * Catálogo de Productos — Distribuidora Tridente
 * Integración frontend con backend FastAPI (/api/catalogo) y base de datos PostgreSQL.
 * Soporta búsqueda con debounce, filtrado por categorías, ordenamiento estricto,
 * paginación de 20 productos por página, estados visuales y fallback resiliente.
 */

(function () {
  'use strict';

  // Configuración de Backend y WhatsApp
  const BACKEND_URL = 'https://camila.distribuidoratridente.cl';
  const BACKEND_DEV = 'http://localhost:8015';
  const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? BACKEND_DEV
    : BACKEND_URL;

  const WHATSAPP_NUMERO = '56979875179'; // Ventas Tridente Oficial (+56 9 7987 5179)

  // Estado reactivo del catálogo
  const state = {
    q: '',
    categoria: '',
    page: 1,
    limit: 20,
    total: 0,
    total_paginas: 1,
    loading: false,
    categories: [],
  };

  let debounceTimer = null;

  // Categorías Emojis para presentación visual
  const categoryEmojis = {
    'ABARROTES': '🔋',
    'CONFITES': '🍫',
    'BAT': '🚬',
    'MARLBORO': '🚬',
    'ATLAS': '🚬',
    'LATINOS': '🚬',
    'TABACOS': '🍂',
    'TABAQUERIA': '💨',
    'VAPORIZADORES': '⚡',
  };

  function getCategoryEmoji(catName) {
    if (!catName) return '📦';
    const upper = catName.toUpperCase().trim();
    for (const [key, emoji] of Object.entries(categoryEmojis)) {
      if (upper.includes(key)) return emoji;
    }
    return '📦';
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveImageUrl(url) {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return API_BASE + url;
    return API_BASE + '/' + url;
  }

  // Leer estado inicial desde la URL
  function readParamsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    state.q = (params.get('q') || params.get('search') || '').trim();
    state.categoria = (params.get('categoria') || '').trim();
    const p = parseInt(params.get('page'), 10);
    state.page = !isNaN(p) && p >= 1 ? p : 1;
  }

  // Sincronizar URL con el estado actual
  function syncParamsToUrl() {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.categoria && state.categoria.toUpperCase() !== 'TODAS') {
      params.set('categoria', state.categoria);
    }
    if (state.page > 1) {
      params.set('page', state.page);
    }
    const newRelativePathQuery = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState(null, '', newRelativePathQuery);
  }

  // Cargar lista de categorías desde el backend o fallback
  async function loadCategories() {
    const catContainer = document.getElementById('catCategoriesRow');
    if (!catContainer) return;

    try {
      const resp = await fetch(`${API_BASE}/api/catalogo/categorias`);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          state.categories = data;
          renderCategoryPills(data);
          return;
        }
      }
    } catch (err) {
      console.warn('[Catalogo] Backend categorias no disponible, usando fallback...');
    }

    // Fallback con categorías precargadas
    if (window.TRIDENTE_CATEGORIAS_PRECARGADAS && Array.isArray(window.TRIDENTE_CATEGORIAS_PRECARGADAS)) {
      const fallbackCats = window.TRIDENTE_CATEGORIAS_PRECARGADAS.map(name => ({
        id: name,
        nombre: name,
        total_productos: 0
      }));
      state.categories = fallbackCats;
      renderCategoryPills(fallbackCats);
    }
  }

  function renderCategoryPills(categories) {
    const catContainer = document.getElementById('catCategoriesRow');
    if (!catContainer) return;

    const isAllActive = !state.categoria || state.categoria.toUpperCase() === 'TODAS';

    let html = `
      <button 
        type="button" 
        class="cat-category-pill ${isAllActive ? 'active' : ''}" 
        data-cat=""
      >
        <span>🌟</span>
        <span>Todas las Categorías</span>
      </button>
    `;

    categories.forEach(c => {
      const isActive = state.categoria && state.categoria.toLowerCase() === c.nombre.toLowerCase();
      const countBadge = c.total_productos > 0 ? `<span class="cat-category-count">${c.total_productos}</span>` : '';
      html += `
        <button 
          type="button" 
          class="cat-category-pill ${isActive ? 'active' : ''}" 
          data-cat="${escapeHtml(c.nombre)}"
        >
          <span>${getCategoryEmoji(c.nombre)}</span>
          <span>${escapeHtml(c.nombre)}</span>
          ${countBadge}
        </button>
      `;
    });

    catContainer.innerHTML = html;

    // Asignar eventos de clic
    catContainer.querySelectorAll('.cat-category-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedCat = btn.getAttribute('data-cat') || '';
        selectCategory(selectedCat);
      });
    });
  }

  function selectCategory(catName) {
    state.categoria = catName;
    state.page = 1;
    syncParamsToUrl();
    renderCategoryPills(state.categories);
    fetchCatalog();
  }

  // Renderizar esqueletos durante carga
  function renderSkeletons() {
    const grid = document.getElementById('catGrid');
    if (!grid) return;

    let skeletonsHtml = '';
    for (let i = 0; i < 8; i++) {
      skeletonsHtml += `
        <div class="cat-skeleton-card">
          <div class="cat-skeleton-img"></div>
          <div class="cat-skeleton-body">
            <div class="cat-skeleton-line short"></div>
            <div class="cat-skeleton-line title"></div>
            <div class="cat-skeleton-line btn"></div>
          </div>
        </div>
      `;
    }
    grid.innerHTML = skeletonsHtml;
  }

  // Fetch del Catálogo (API con Fallback Local automático)
  async function fetchCatalog() {
    state.loading = true;
    renderSkeletons();
    updateSummaryBar();

    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.categoria && state.categoria.toUpperCase() !== 'TODAS') {
      params.set('categoria', state.categoria);
    }
    params.set('page', state.page);
    params.set('limit', state.limit);

    try {
      const resp = await fetch(`${API_BASE}/api/catalogo?${params.toString()}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      state.total = data.total || 0;
      state.total_paginas = data.total_paginas || 1;
      state.page = data.pagina_actual || 1;

      renderProducts(data.productos || []);
      renderPagination();
      updateSummaryBar();
      state.loading = false;
      return;
    } catch (err) {
      console.warn('[Catalogo] Error de conexión con API, activando fallback local:', err);
    }

    // Fallback resiliente usando TRIDENTE_PRODUCTOS_PRECARGADOS
    fallbackLocalCatalog();
  }

  function fallbackLocalCatalog() {
    const all = window.TRIDENTE_PRODUCTOS_PRECARGADOS || [];
    let filtered = all;

    if (state.q) {
      const st = state.q.toLowerCase();
      filtered = filtered.filter(p => {
        const nom = (p.nombre || '').toLowerCase();
        const cod = (p.codigo || '').toLowerCase();
        const cat = (p.categoria || '').toLowerCase();
        return nom.includes(st) || cod.includes(st) || cat.includes(st);
      });
    }

    if (state.categoria && state.categoria.toUpperCase() !== 'TODAS') {
      const cf = state.categoria.toLowerCase();
      filtered = filtered.filter(p => (p.categoria || '').toLowerCase() === cf);
    }

    // Ordenamiento estricto: 1° categoría, 2° nombre
    filtered.sort((a, b) => {
      const catA = (a.categoria || '').toLowerCase();
      const catB = (b.categoria || '').toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB, 'es');
      return (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase(), 'es');
    });

    state.total = filtered.length;
    state.total_paginas = Math.max(1, Math.ceil(state.total / state.limit));
    if (state.page > state.total_paginas) state.page = 1;

    const offset = (state.page - 1) * state.limit;
    const paginated = filtered.slice(offset, offset + state.limit);

    renderProducts(paginated);
    renderPagination();
    updateSummaryBar();
    state.loading = false;
  }

  // Renderizar Grilla de Productos
  function renderProducts(productos) {
    const grid = document.getElementById('catGrid');
    if (!grid) return;

    if (!productos || productos.length === 0) {
      grid.innerHTML = `
        <div class="cat-empty-state">
          <div class="cat-empty-icon">🔍</div>
          <h3 class="cat-empty-title">No se encontraron productos</h3>
          <p class="cat-empty-desc">
            No encontramos coincidencias para los filtros seleccionados. Intenta con otra palabra clave o selecciona otra categoría.
          </p>
          <button type="button" class="cat-btn-reset-filters" id="btnResetFilters">
            Limpiar filtros y ver todos
          </button>
        </div>
      `;
      const resetBtn = document.getElementById('btnResetFilters');
      if (resetBtn) resetBtn.addEventListener('click', resetFilters);
      return;
    }

    let cardsHtml = '';
    productos.forEach(p => {
      const hasImage = p.has_image && p.imagen_url;
      const imageUrl = resolveImageUrl(p.imagen_url);
      const emoji = getCategoryEmoji(p.categoria);
      const stockBadge = p.stock !== null && p.stock !== undefined
        ? `<span class="cat-card-stock ${p.stock > 10 ? 'in-stock' : 'low-stock'}">
            ${p.stock > 0 ? '✓ En Stock' : 'Consultar'}
           </span>`
        : '';

      const boxBadge = p.tiene_caja && p.cantidad_caja
        ? `<div class="cat-card-box-info"><span>📦 Display / Caja ${p.cantidad_caja} un.</span></div>`
        : '';

      const waMsg = encodeURIComponent(
        `👋 ¡Hola! Me interesa consultar disponibilidad y precios mayoristas para el producto: ${p.nombre} (Código: ${p.codigo || 'S/C'}). ¡Muchas gracias!`
      );
      const waUrl = `https://wa.me/${WHATSAPP_NUMERO}?text=${waMsg}`;

      cardsHtml += `
        <article class="cat-card" data-id="${escapeHtml(p.id)}">
          <div class="cat-card-img-wrap">
            ${hasImage ? `
              <img 
                src="${imageUrl}" 
                alt="${escapeHtml(p.nombre)}" 
                class="cat-card-img" 
                loading="lazy"
                onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
              />
              <div class="cat-card-placeholder" style="display:none;">
                <span class="cat-placeholder-icon">${emoji}</span>
                <span class="cat-placeholder-text">Distribuidora Tridente</span>
              </div>
            ` : `
              <div class="cat-card-placeholder">
                <span class="cat-placeholder-icon">${emoji}</span>
                <span class="cat-placeholder-text">Distribuidora Tridente</span>
              </div>
            `}
            ${p.codigo ? `<span class="cat-card-code">#${escapeHtml(p.codigo)}</span>` : ''}
          </div>

          <div class="cat-card-body">
            <div class="cat-card-meta">
              <span class="cat-card-category">${escapeHtml(p.categoria)}</span>
              ${stockBadge}
            </div>

            <h3 class="cat-card-title" title="${escapeHtml(p.nombre)}">
              ${escapeHtml(p.nombre)}
            </h3>

            ${boxBadge}

            <div class="cat-card-footer">
              <button 
                type="button" 
                class="cat-btn-quote" 
                onclick="window.cotizarProductoCatalogo('${escapeHtml(p.nombre).replace(/'/g, "\\'")}', '${escapeHtml(p.codigo || '').replace(/'/g, "\\'")}')"
              >
                <span>📋 Cotizar</span>
              </button>
              <a 
                href="${waUrl}" 
                target="_blank" 
                rel="noopener noreferrer" 
                class="cat-btn-wa" 
                title="Consultar por WhatsApp"
                aria-label="Consultar por WhatsApp"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.53 1.769.784 2.8.784 3.178 0 5.765-2.587 5.766-5.766 0-3.18-2.587-5.77-5.77-5.77zm0-2.172c4.378 0 7.938 3.56 7.939 7.938 0 4.38-3.56 7.939-7.939 7.939-1.393 0-2.698-.363-3.83-1.002l-4.201 1.103 1.121-4.102c-.732-1.206-1.15-2.62-1.15-4.138 0-4.378 3.56-7.938 7.939-7.938z"/>
                </svg>
              </a>
            </div>
          </div>
        </article>
      `;
    });

    grid.innerHTML = cardsHtml;
  }

  // Renderizar Paginador Inteligente
  function renderPagination() {
    const container = document.getElementById('catPagination');
    if (!container) return;

    if (state.total_paginas <= 1) {
      container.innerHTML = '';
      return;
    }

    let buttonsHtml = '';

    // Botón Anterior
    const prevDisabled = state.page <= 1 ? 'disabled' : '';
    buttonsHtml += `
      <button 
        type="button" 
        class="cat-page-btn" 
        data-page="${state.page - 1}" 
        ${prevDisabled} 
        aria-label="Página anterior"
      >
        ‹ Anterior
      </button>
    `;

    // Algoritmo de rango de páginas visible (e.g. 1 ... 4 5 6 ... 15)
    const total = state.total_paginas;
    const current = state.page;
    const delta = 2; // páginas a cada lado de la actual
    const range = [];

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    let prevNumber = 0;
    for (const p of range) {
      if (prevNumber && p - prevNumber > 1) {
        buttonsHtml += `<span class="cat-page-btn ellipsis">…</span>`;
      }
      const activeClass = p === current ? 'active' : '';
      buttonsHtml += `
        <button 
          type="button" 
          class="cat-page-btn ${activeClass}" 
          data-page="${p}"
        >
          ${p}
        </button>
      `;
      prevNumber = p;
    }

    // Botón Siguiente
    const nextDisabled = state.page >= total ? 'disabled' : '';
    buttonsHtml += `
      <button 
        type="button" 
        class="cat-page-btn" 
        data-page="${state.page + 1}" 
        ${nextDisabled} 
        aria-label="Página siguiente"
      >
        Siguiente ›
      </button>
    `;

    container.innerHTML = `
      <div class="cat-pagination-nav">
        ${buttonsHtml}
      </div>
      <div class="cat-page-info">
        Página <strong>${state.page}</strong> de <strong>${state.total_paginas}</strong> (${state.total} productos)
      </div>
    `;

    // Vincular clics de paginación
    container.querySelectorAll('.cat-page-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-page'), 10);
        if (!isNaN(p) && p >= 1 && p <= state.total_paginas && p !== state.page) {
          state.page = p;
          syncParamsToUrl();
          fetchCatalog();
          scrollToCatalogTop();
        }
      });
    });
  }

  function scrollToCatalogTop() {
    const section = document.getElementById('catalogoSection') || document.getElementById('catGrid');
    if (section) {
      const yOffset = -80;
      const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  // Actualizar Barra de Resumen / Filtros activos
  function updateSummaryBar() {
    const countEl = document.getElementById('catResultsCount');
    const filtersEl = document.getElementById('catActiveFilters');

    if (countEl) {
      const start = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;
      const end = Math.min(state.page * state.limit, state.total);
      countEl.innerHTML = `Mostrando <strong>${start} - ${end}</strong> de <strong>${state.total}</strong> productos`;
    }

    if (filtersEl) {
      let filterTags = '';
      if (state.q) {
        filterTags += `
          <span class="cat-filter-tag">
            <span>Búsqueda: "${escapeHtml(state.q)}"</span>
            <button type="button" id="btnClearSearchTag" aria-label="Eliminar búsqueda">&times;</button>
          </span>
        `;
      }
      if (state.categoria && state.categoria.toUpperCase() !== 'TODAS') {
        filterTags += `
          <span class="cat-filter-tag">
            <span>Categoría: ${escapeHtml(state.categoria)}</span>
            <button type="button" id="btnClearCatTag" aria-label="Eliminar filtro categoría">&times;</button>
          </span>
        `;
      }
      if (filterTags) {
        filterTags += `
          <button type="button" class="cat-btn-clear-all" id="btnClearAllFilters">
            Limpiar todo
          </button>
        `;
      }
      filtersEl.innerHTML = filterTags;

      // Listeners de tags
      const btnClearSearch = document.getElementById('btnClearSearchTag');
      if (btnClearSearch) {
        btnClearSearch.addEventListener('click', () => {
          const searchInput = document.getElementById('catSearchInput');
          if (searchInput) searchInput.value = '';
          state.q = '';
          state.page = 1;
          syncParamsToUrl();
          toggleClearBtn();
          fetchCatalog();
        });
      }

      const btnClearCat = document.getElementById('btnClearCatTag');
      if (btnClearCat) {
        btnClearCat.addEventListener('click', () => {
          selectCategory('');
        });
      }

      const btnClearAll = document.getElementById('btnClearAllFilters');
      if (btnClearAll) {
        btnClearAll.addEventListener('click', resetFilters);
      }
    }
  }

  function resetFilters() {
    const searchInput = document.getElementById('catSearchInput');
    if (searchInput) searchInput.value = '';
    state.q = '';
    state.categoria = '';
    state.page = 1;
    syncParamsToUrl();
    toggleClearBtn();
    renderCategoryPills(state.categories);
    fetchCatalog();
  }

  function toggleClearBtn() {
    const clearBtn = document.getElementById('catSearchClear');
    if (clearBtn) {
      clearBtn.style.display = state.q ? 'flex' : 'none';
    }
  }

  // Interacción para Cotizar Producto desde el Catálogo
  window.cotizarProductoCatalogo = function (nombre, codigo) {
    if (window.Camila && typeof window.Camila.openChat === 'function') {
      window.Camila.openChat(`Hola Camila, quisiera cotizar el producto: ${nombre} (Código: ${codigo || 'S/C'}).`);
    } else {
      const btnCamila = document.getElementById('camilaBtn');
      if (btnCamila) {
        btnCamila.click();
      } else {
        const waMsg = encodeURIComponent(
          `👋 ¡Hola! Quisiera cotizar formalmente este producto mayorista:\n• Producto: ${nombre}\n• Código: ${codigo || 'S/C'}`
        );
        window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${waMsg}`, '_blank');
      }
    }
  };

  // Inicialización de Eventos del DOM
  function init() {
    readParamsFromUrl();

    const searchInput = document.getElementById('catSearchInput');
    const searchForm = document.getElementById('catSearchForm');
    const clearBtn = document.getElementById('catSearchClear');

    if (searchInput) {
      searchInput.value = state.q;
      toggleClearBtn();

      // Debounce para búsqueda en tiempo real
      searchInput.addEventListener('input', () => {
        state.q = searchInput.value.trim();
        toggleClearBtn();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          state.page = 1;
          syncParamsToUrl();
          fetchCatalog();
        }, 300);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        state.q = '';
        toggleClearBtn();
        state.page = 1;
        syncParamsToUrl();
        fetchCatalog();
      });
    }

    if (searchForm) {
      searchForm.addEventListener('submit', e => {
        e.preventDefault();
        clearTimeout(debounceTimer);
        if (searchInput) state.q = searchInput.value.trim();
        state.page = 1;
        syncParamsToUrl();
        fetchCatalog();
      });
    }

    // Cargar categorías y primer lote de productos
    loadCategories();
    fetchCatalog();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

