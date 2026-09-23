/**
 * Vendedor Tridente - Asistente Virtual Oficial
 * Distribuidora Tridente (www.distribuidoratridente.cl)
 *
 * REGLAS ESTRICTAS:
 * 1. Responde ÚNICAMENTE utilizando información fidedigna y directa de Distribuidora Tridente.
 * 2. Si no dispone de información explícita sobre un producto, precio, despacho o contacto,
 *    responde amablemente indicándolo y sugiriendo el contacto oficial por WhatsApp.
 * 3. No inventa precios, stock, tiempos de entrega ni condiciones de venta.
 * 4. Tono comercial, cercano, claro, servicial y profesional.
 * 5. Si saludan o preguntan fuera de ámbito, redirige educadamente a los productos/servicios de Tridente.
 */

(function () {
  'use strict';

  // Base de Conocimiento Oficial Fidedigna de Distribuidora Tridente
  const TRIDENTE_KNOWLEDGE = {
    whatsappNumber: '+56 9 4448 8407',
    whatsappLink: 'https://wa.me/56944488407',
    portalPedidos: 'https://pedidos.distribuidoratridente.cl',
    catalogoDigital: 'https://pedidos.distribuidoratridente.cl/Public/Catalogo',
    ubicacion: 'La Serena, Región de Coquimbo, Chile',
    horario: 'Lunes a Viernes • Atención dedicada a almacenes, minimarkets y comercios',
    zonasDespacho: [
      'La Serena y Coquimbo (radio urbano con entregas programadas)',
      'Ovalle y Provincia del Limarí (rutas semanales directas para comerciantes)',
      'Valle de Elqui y Alrededores (Vicuña, Paihuano y localidades aledañas)'
    ],
    marcasOficiales: [
      'Arcor', 'Bon o Bon', 'Ambrosoli', 'Costa', 'McKay',
      'Clipper', 'OCB', 'Captain Black', 'Tennessee', 'Springfield', 'Ronson',
      'Duracell', 'Eveready', 'Kuroko', 'Bristol'
    ]
  };

  // Función para normalizar texto (sin acentos, minúsculas, limpio)
  function normalizar(texto) {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // Motor de Respuestas que cumple estrictamente las 5 reglas
  function obtenerRespuestaBot(mensajeUsuario) {
    const q = normalizar(mensajeUsuario);

    // 1. Saludos
    if (/^(hola|buen(os)?\s*(dias|tardes|noches)|saludos|que\s*tal|buenas|holas?)\b/.test(q)) {
      return {
        texto: `¡Hola! Un gusto saludarte. 👋 Soy el <strong>Vendedor Tridente</strong>, tu asistente comercial oficial.<br><br>` +
               `Estoy aquí para ayudarte con información sobre nuestro catálogo mayorista (confites, alfajores Bon o Bon, chocolates, tabacos, pilas y abarrotes), zonas de despacho y cómo abastecer tu local.<br><br>` +
               `¿En qué producto o consulta te puedo orientar hoy?`,
        chips: ['🍬 Alfajores y Confites', '🚚 Zonas de Despacho', '📋 ¿Cómo hacer pedido?', '📞 Contacto']
      };
    }

    // 2. Alfajores Bon o Bon / Chocolates / Confites
    if (q.includes('bon o bon') || q.includes('alfajor') || q.includes('chocolate') || q.includes('confite') ||
        q.includes('bombones') || q.includes('caramelo') || q.includes('golosina') || q.includes('candies') ||
        q.includes('masticable') || q.includes('dulce') || q.includes('arcor') || q.includes('ambrosoli') || q.includes('costa')) {
      return {
        texto: `¡Excelente elección! En <strong>Distribuidora Tridente</strong> distribuimos la línea mayorista de <strong>Bon o Bon</strong> (alfajores, bombones y chocolates de Arcor), además de confites y chocolates de primeras marcas como <strong>Ambrosoli, Arcor y Costa</strong>.<br><br>` +
               `📦 <em>Venta por cajas y displays para almacenes, botillerías y minimarkets.</em><br><br>` +
               `Para conocer los precios exactos del día y disponibilidad por volumen, puedes consultar la lista vigente directo con nuestro equipo comercial:`,
        cta: {
          texto: '💬 Consultar precios de Bon o Bon por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20alfajores%20Bon%20o%20Bon%20y%20confites`
        },
        chips: ['📄 Ver Catálogo', '🚚 Métodos de Despacho', '📋 ¿Cómo Comprar?']
      };
    }

    // 3. Galletas y Snacks
    if (q.includes('galleta') || q.includes('snack') || q.includes('papas') || q.includes('ramita') ||
        q.includes('frutos secos') || q.includes('mckay')) {
      return {
        texto: `En nuestra categoría de <strong>Galletas y Snacks</strong> trabajamos con marcas de alta rotación como <strong>McKay, Costa y Arcor</strong>:<br><br>` +
               `• Galletas dulces y saladas en formatos individuales y paquetes surtidos.<br>` +
               `• Snacks salados, ramitas y frutos secos ideales para mostrador.<br><br>` +
               `¿Deseas cotizar para tu negocio?`,
        cta: {
          texto: '💬 Cotizar Galletas y Snacks por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20galletas%20y%20snacks`
        },
        chips: ['🍬 Ver Confites', '🚚 Zonas de Despacho', '📄 Catálogo Digital']
      };
    }

    // 4. Tabaco y Accesorios (OCB, Clipper, Ronson, etc.)
    if (q.includes('tabaco') || q.includes('papelillo') || q.includes('ocb') || q.includes('clipper') ||
        q.includes('ronson') || q.includes('captain black') || q.includes('tennessee') || q.includes('springfield') ||
        q.includes('filtro') || q.includes('encendedor') || q.includes('cigarro')) {
      return {
        texto: `Contamos con una completa línea mayorista de <strong>Tabacos y Accesorios para fumadores</strong>:<br><br>` +
               `• Papelillos y filtros originales <strong>OCB</strong>.<br>` +
               `• Encendedores recargables y de colección <strong>Clipper</strong> y <strong>Ronson</strong>.<br>` +
               `• Tabacos de liar reconocidos: <strong>Captain Black, Tennessee y Springfield</strong>.<br><br>` +
               `Artículos de gran margen para botillerías y minimarkets.`,
        cta: {
          texto: '💬 Cotizar Tabaco y OCB por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20tabacos%20y%20accesorios%20OCB`
        },
        chips: ['🔋 Pilas y Baterías', '📄 Catálogo Completo', '📞 Contactar']
      };
    }

    // 5. Pilas y Baterías (Duracell, Eveready)
    if (q.includes('pila') || q.includes('bateria') || q.includes('duracell') || q.includes('eveready') ||
        q.includes('aa') || q.includes('aaa')) {
      return {
        texto: `Distribuimos pilas y baterías originales de las dos marcas líderes del mercado:<br><br>` +
               `• <strong>Duracell:</strong> Pilas alcalinas AA, AAA, C, D, 9V y pilas botón especiales.<br>` +
               `• <strong>Eveready:</strong> Variedad alcalina y carbón para consumo masivo.<br><br>` +
               `Formatos en tiras y blíster para exhibición directa en caja o mostrador.`,
        cta: {
          texto: '💬 Cotizar Pilas Duracell/Eveready',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20pilas%20Duracell%20y%20Eveready`
        },
        chips: ['🍬 Confites y Chocolates', '🚚 Métodos de Despacho', '📄 Catálogo']
      };
    }

    // 6. Abarrotes y Consumo
    if (q.includes('abarrote') || q.includes('consumo') || q.includes('mercaderia') || q.includes('kuroko') || q.includes('bristol')) {
      return {
        texto: `En <strong>Abarrotes y Consumo</strong> ofrecemos artículos seleccionados de rotación continua para almacenes de barrio y minimarkets.<br><br>` +
               `Puedes revisar las líneas disponibles en nuestro catálogo digital o pedir la lista al ejecutivo comercial.`,
        cta: {
          texto: '🌐 Ver Catálogo Digital',
          url: TRIDENTE_KNOWLEDGE.catalogoDigital
        },
        chips: ['🍬 Confites', '🔋 Pilas', '📞 Contacto Oficial']
      };
    }

    // 7. Zonas y Métodos de Despacho
    if (q.includes('despacho') || q.includes('envio') || q.includes('entrega') || q.includes('reparto') ||
        q.includes('donde entregan') || q.includes('zona') || q.includes('cobertura') || q.includes('ruta') ||
        q.includes('serena') || q.includes('coquimbo') || q.includes('ovalle') || q.includes('limari') ||
        q.includes('elqui') || q.includes('vicuna') || q.includes('paihuano')) {
      return {
        texto: `🚚 <strong>Zonas de Despacho y Cobertura de Distribuidora Tridente:</strong><br><br>` +
               `📍 <strong>La Serena y Coquimbo:</strong> Entregas periódicas y programadas dentro del radio urbano.<br>` +
               `📍 <strong>Ovalle y Provincia del Limarí:</strong> Rutas semanales directas para abastecer comerciantes.<br>` +
               `📍 <strong>Valle de Elqui y Alrededores:</strong> Entregas en Vicuña, Paihuano y localidades aledañas.<br><br>` +
               `<em>Nota:</em> Los días exactos de ruta y condiciones de entrega se coordinan al momento de confirmar el pedido con el área de despacho.`,
        cta: {
          texto: '💬 Coordinar Despacho a mi Negocio',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20consultar%20por%20la%20ruta%20de%20despacho%20para%20mi%20local`
        },
        chips: ['📋 ¿Cómo Comprar?', '🍬 Catálogo de Productos', '📞 Contacto']
      };
    }

    // 8. Cómo hacer un pedido / Métodos de compra
    if (q.includes('como comprar') || q.includes('como hago') || q.includes('hacer pedido') || q.includes('realizar pedido') ||
        q.includes('portal') || q.includes('pedidos') || q.includes('comprar') || q.includes('minimo') || q.includes('orden')) {
      return {
        texto: `Para comprar en <strong>Distribuidora Tridente</strong> tienes 2 opciones muy rápidas:<br><br>` +
               `1️⃣ <strong>Vía WhatsApp:</strong> Envíanos tu lista de productos requeridos junto a los datos de tu negocio al <strong>${TRIDENTE_KNOWLEDGE.whatsappNumber}</strong>.<br><br>` +
               `2️⃣ <strong>Portal Web de Pedidos 24 Horas:</strong> Ingresa a nuestro portal en línea <a href="${TRIDENTE_KNOWLEDGE.portalPedidos}" target="_blank" rel="noopener">pedidos.distribuidoratridente.cl</a>.<br><br>` +
               `🧾 <em>Emitimos facturación inmediata o boleta para comercios.</em>`,
        cta: {
          texto: '🚀 Ir al Portal de Pedidos',
          url: TRIDENTE_KNOWLEDGE.portalPedidos
        },
        chips: ['💬 Hablar por WhatsApp', '🚚 Zonas de Despacho', '🍬 Ver Catálogo']
      };
    }

    // 9. Precios y Cotizaciones (Regla 3: No inventar precios)
    if (q.includes('precio') || q.includes('cuanto vale') || q.includes('cuanto cuesta') || q.includes('valor') ||
        q.includes('cotizar') || q.includes('cotizacion') || q.includes('tarifa') || q.includes('lista de precio')) {
      return {
        texto: `Nuestros precios son <strong>100% mayoristas</strong> y se gestionan por volumen de compra y promociones vigentes de los fabricantes.<br><br>` +
               `Para no brindarte un valor desactualizado o impreciso, nuestro equipo comercial te entrega la <strong>lista de precios vigente y cotización inmediata</strong> por WhatsApp:`,
        cta: {
          texto: '💬 Solicitar Lista de Precios por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20solicitar%20la%20lista%20de%20precios%20mayorista%20actualizada`
        },
        chips: ['📄 Ver Catálogo Digital', '🚚 Zonas de Despacho', '📋 ¿Cómo Comprar?']
      };
    }

    // 10. Contacto, Ubicación y Horarios
    if (q.includes('contacto') || q.includes('telefono') || q.includes('whatsapp') || q.includes('donde estan') ||
        q.includes('direccion') || q.includes('ubicacion') || q.includes('horario') || q.includes('atencion')) {
      return {
        texto: `📌 <strong>Canales Oficiales de Distribuidora Tridente:</strong><br><br>` +
               `📱 <strong>WhatsApp Oficial:</strong> <a href="${TRIDENTE_KNOWLEDGE.whatsappLink}" target="_blank" rel="noopener">${TRIDENTE_KNOWLEDGE.whatsappNumber}</a><br>` +
               `📍 <strong>Ubicación:</strong> ${TRIDENTE_KNOWLEDGE.ubicacion}<br>` +
               `⏰ <strong>Horario:</strong> ${TRIDENTE_KNOWLEDGE.horario}<br>` +
               `🌐 <strong>Portal de Pedidos:</strong> <a href="${TRIDENTE_KNOWLEDGE.portalPedidos}" target="_blank" rel="noopener">pedidos.distribuidoratridente.cl</a>`,
        cta: {
          texto: '💬 Escribir al WhatsApp Oficial',
          url: TRIDENTE_KNOWLEDGE.whatsappLink
        },
        chips: ['🍬 Catálogo Mayorista', '🚚 Despacho a Regiones', '📋 ¿Cómo Pedir?']
      };
    }

    // 11. Catálogo General
    if (q.includes('catalogo') || q.includes('productos') || q.includes('que venden') || q.includes('que tienen')) {
      return {
        texto: `Distribuimos las principales marcas mayoristas en:<br><br>` +
               `🍬 <strong>Confites y Chocolates:</strong> Bon o Bon, Arcor, Ambrosoli, Costa.<br>` +
               `🍪 <strong>Galletas y Snacks:</strong> McKay, Costa, Arcor.<br>` +
               `🚬 <strong>Tabaco y Accesorios:</strong> Papelillos OCB, encendedores Clipper/Ronson, tabacos.<br>` +
               `🔋 <strong>Pilas y Baterías:</strong> Duracell y Eveready.<br>` +
               `📦 <strong>Abarrotes:</strong> Artículos de rotación rápida.<br><br>` +
               `Puedes revisar el catálogo en nuestra web o en el portal oficial:`,
        cta: {
          texto: '📄 Abrir Catálogo Digital',
          url: 'catalogo.html'
        },
        chips: ['🍬 Alfajores Bon o Bon', '🚚 Zonas de Despacho', '💬 Pedir por WhatsApp']
      };
    }

    // 12. Facturación / Boleta / RUT
    if (q.includes('factura') || q.includes('boleta') || q.includes('rut') || q.includes('iva') || q.includes('empresa')) {
      return {
        texto: `Sí, en Distribuidora Tridente emitimos <strong>facturación inmediata con RUT</strong> para empresas y comercios, así como también boleta según requieras.<br><br>` +
               `Solo debes adjuntar los datos de facturación al momento de enviar tu pedido.`,
        cta: {
          texto: '💬 Coordinar Pedido con Factura',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20hacer%20un%20pedido%20con%20factura`
        },
        chips: ['📋 ¿Cómo Comprar?', '🚚 Zonas de Despacho', '🍬 Ver Productos']
      };
    }

    // 13. Agradecimientos y despedidas
    if (q.includes('gracias') || q.includes('muchas gracias') || q.includes('vale') || q.includes('perfecto') ||
        q.includes('chao') || q.includes('adios') || q.includes('hasta luego')) {
      return {
        texto: `¡De nada! Ha sido un placer atenderte. En <strong>Distribuidora Tridente</strong> estamos listos para ser el mejor aliado de tu negocio. ¡Que tengas excelentes ventas! 🌟`,
        chips: ['💬 Hablar por WhatsApp', '📄 Ver Catálogo', '🚚 Despacho']
      };
    }

    // 14. Regla 5: Preguntas fuera del ámbito de la distribuidora
    if (q.includes('futbol') || q.includes('partido') || q.includes('deporte') || q.includes('politica') ||
        q.includes('chiste') || q.includes('clima') || q.includes('tiempo manana') || q.includes('musica') ||
        q.includes('cancion') || q.includes('pelicula') || q.includes('juego') || q.includes('videojuego') ||
        q.includes('presidente') || q.includes('quien eres') || q.includes('que eres') || q.includes('inteligencia artificial') ||
        q.includes('chatgpt') || q.includes('gemini') || q.includes('robot')) {
      return {
        texto: `Como asistente comercial oficial de <strong>Distribuidora Tridente</strong>, mi único propósito es atenderte con respecto a nuestro catálogo mayorista, confites, marcas, despachos y compras para tu negocio.<br><br>` +
               `¿Te gustaría consultar sobre nuestras líneas de Bon o Bon, chocolates, tabacos, pilas o zonas de entrega?`,
        chips: ['🍬 Bon o Bon y Confites', '🚚 Zonas de Despacho', '📋 ¿Cómo Comprar?']
      };
    }

    // 15. Regla 2 y 3: No inventar información ni productos que no estén explícitamente en la web
    return {
      texto: `No dispongo de esa información específica en este momento en nuestro catálogo público.<br><br>` +
             `Para entregarte una respuesta exacta sobre stock, productos particulares o condiciones comerciales, te sugiero comunicarte directamente a través de nuestros canales oficiales:`,
      cta: {
        texto: `💬 Consultar con un Ejecutivo por WhatsApp`,
        url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=${encodeURIComponent('Hola Distribuidora Tridente, tengo una consulta: ' + mensajeUsuario)}`
      },
      chips: ['🍬 Catálogo Mayorista', '🚚 Zonas de Despacho', '📞 Contacto Oficial']
    };
  }

  // Creación y renderizado del widget en el DOM
  function inicializarVendedorTridente() {
    // Evitar duplicados
    if (document.getElementById('vendedorTridenteWidget')) return;

    // Inyectar HTML del widget
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'vendedorTridenteWidget';
    widgetContainer.innerHTML = `
      <!-- Contenedor Flotante Vendedor Tridente (Ubicado ARRIBA de WhatsApp) -->
      <div class="vendedor-tridente-float" id="vendedorTridenteFloat">
        <!-- Nube / Speech Bubble solicitada -->
        <div class="vendedor-cloud" id="vendedorCloud" title="Abrir chat">
          <span class="vendedor-cloud-text">💬 Habla con un vendedor de Tridente</span>
          <button type="button" class="vendedor-cloud-close" id="vendedorCloudClose" aria-label="Cerrar aviso">&times;</button>
        </div>

        <!-- Botón Bot Vendedor Tridente -->
        <button type="button" class="vendedor-tridente-btn" id="vendedorTridenteBtn" aria-label="Abrir asistente Vendedor Tridente">
          <span class="vendedor-status-indicator" title="En línea"></span>
          <svg class="vendedor-btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.477 2 2 6.477 2 12C2 13.82 2.487 15.53 3.337 17.005L2.08 21.208C1.986 21.522 2.072 21.862 2.305 22.095C2.472 22.262 2.703 22.353 2.94 22.353C3.041 22.353 3.143 22.336 3.242 22.302L7.545 20.814C8.938 21.576 10.518 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2Z" fill="currentColor"/>
            <path d="M8.5 10.5C9.328 10.5 10 9.828 10 9C10 8.172 9.328 7.5 8.5 7.5C7.672 7.5 7 8.172 7 9C7 9.828 7.672 10.5 8.5 10.5Z" fill="#FDE047"/>
            <path d="M15.5 10.5C16.328 10.5 17 9.828 17 9C17 8.172 16.328 7.5 15.5 7.5C14.672 7.5 14 8.172 14 9C14 9.828 14.672 10.5 15.5 10.5Z" fill="#FDE047"/>
            <path d="M8 14.5C8.5 16 10 17 12 17C14 17 15.5 16 16 14.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Ventana de Chat Flotante -->
      <div class="vendedor-chat-window" id="vendedorChatWindow" role="dialog" aria-labelledby="vendedorChatTitle" aria-hidden="true">
        <!-- Header -->
        <div class="vendedor-chat-header">
          <div class="vendedor-header-avatar">
            <span class="vendedor-avatar-emoji">👨‍💼</span>
            <span class="vendedor-avatar-dot"></span>
          </div>
          <div class="vendedor-header-info">
            <h3 id="vendedorChatTitle" class="vendedor-header-name">Vendedor Tridente</h3>
            <p class="vendedor-header-status">Asistente Comercial Oficial • En línea</p>
          </div>
          <div class="vendedor-header-actions">
            <button type="button" class="vendedor-header-btn" id="vendedorChatMinimize" aria-label="Minimizar chat" title="Minimizar">─</button>
            <button type="button" class="vendedor-header-btn" id="vendedorChatClose" aria-label="Cerrar chat" title="Cerrar">✕</button>
          </div>
        </div>

        <!-- Mensajes -->
        <div class="vendedor-chat-messages" id="vendedorChatMessages">
          <!-- Mensaje de bienvenida inicial -->
          <div class="vendedor-msg vendedor-msg-bot">
            <div class="vendedor-msg-bubble">
              ¡Hola! 👋 Soy el <strong>Vendedor Tridente</strong>, tu asistente comercial oficial.<br><br>
              Atiendo todas tus dudas sobre nuestro catálogo de productos (confites, alfajores <strong>Bon o Bon</strong>, chocolates, snacks, tabacos, pilas y abarrotes), métodos y zonas de despacho o compras para tu negocio.<br><br>
              ¿En qué te puedo asesorar hoy?
            </div>
            <span class="vendedor-msg-time">Ahora</span>
          </div>

          <!-- Sugerencias iniciales de preguntas frecuentes -->
          <div class="vendedor-quick-chips" id="vendedorInitialChips">
            <button type="button" class="vendedor-chip" data-query="¿Qué productos y marcas tienen en el catálogo?">🍬 Catálogo de Productos</button>
            <button type="button" class="vendedor-chip" data-query="Quisiera saber sobre los alfajores Bon o Bon y chocolates">🍫 Alfajores Bon o Bon</button>
            <button type="button" class="vendedor-chip" data-query="¿Cuáles son las zonas y métodos de despacho?">🚚 Zonas de Despacho</button>
            <button type="button" class="vendedor-chip" data-query="¿Cómo hago un pedido para mi negocio?">📋 ¿Cómo Comprar?</button>
            <button type="button" class="vendedor-chip" data-query="¿Cuáles son los canales de contacto y horarios?">📞 Contacto y Horarios</button>
          </div>
        </div>

        <!-- Indicador escribiendo -->
        <div class="vendedor-typing" id="vendedorTyping" style="display: none;">
          <span></span><span></span><span></span>
        </div>

        <!-- Footer / Input de envío -->
        <form class="vendedor-chat-form" id="vendedorChatForm">
          <input type="text" id="vendedorChatInput" class="vendedor-chat-input" placeholder="Escribe tu consulta aquí..." autocomplete="off" maxlength="250" />
          <button type="submit" class="vendedor-chat-send" id="vendedorChatSend" aria-label="Enviar mensaje">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(widgetContainer);
    vincularEventos();
  }

  // Vincular eventos de interacción
  function vincularEventos() {
    const cloud = document.getElementById('vendedorCloud');
    const cloudClose = document.getElementById('vendedorCloudClose');
    const btn = document.getElementById('vendedorTridenteBtn');
    const chatWindow = document.getElementById('vendedorChatWindow');
    const closeBtn = document.getElementById('vendedorChatClose');
    const minBtn = document.getElementById('vendedorChatMinimize');
    const form = document.getElementById('vendedorChatForm');
    const input = document.getElementById('vendedorChatInput');
    const messages = document.getElementById('vendedorChatMessages');

    function abrirChat() {
      chatWindow.classList.add('vendedor-chat-open');
      chatWindow.setAttribute('aria-hidden', 'false');
      // Ocultar nube cuando el chat está abierto
      if (cloud) cloud.style.display = 'none';
      setTimeout(() => input.focus(), 250);
      scrollAlFondo();
    }

    function cerrarChat() {
      chatWindow.classList.remove('vendedor-chat-open');
      chatWindow.setAttribute('aria-hidden', 'true');
    }

    function toggleChat() {
      if (chatWindow.classList.contains('vendedor-chat-open')) {
        cerrarChat();
      } else {
        abrirChat();
      }
    }

    if (btn) btn.addEventListener('click', toggleChat);
    if (cloud) {
      cloud.addEventListener('click', (e) => {
        if (e.target !== cloudClose) {
          abrirChat();
        }
      });
    }

    if (cloudClose) {
      cloudClose.addEventListener('click', (e) => {
        e.stopPropagation();
        cloud.style.display = 'none';
        sessionStorage.setItem('vendedor_cloud_closed', '1');
      });
    }

    // Verificar si el usuario ya había cerrado la nube en esta sesión
    if (sessionStorage.getItem('vendedor_cloud_closed') === '1' && cloud) {
      cloud.style.display = 'none';
    }

    if (closeBtn) closeBtn.addEventListener('click', cerrarChat);
    if (minBtn) minBtn.addEventListener('click', cerrarChat);

    // Eventos de los chips iniciales o dinámicos
    if (messages) {
      messages.addEventListener('click', (e) => {
        const chip = e.target.closest('.vendedor-chip');
        if (chip && chip.dataset.query) {
          enviarMensaje(chip.dataset.query);
        }
      });
    }

    // Form submit
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const texto = input.value.trim();
        if (!texto) return;
        enviarMensaje(texto);
        input.value = '';
      });
    }

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && chatWindow.classList.contains('vendedor-chat-open')) {
        cerrarChat();
      }
    });
  }

  function scrollAlFondo() {
    const messages = document.getElementById('vendedorChatMessages');
    if (messages) {
      messages.scrollTop = messages.scrollHeight;
    }
  }

  function obtenerHoraActual() {
    const ahora = new Date();
    return ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function enviarMensaje(texto) {
    const messages = document.getElementById('vendedorChatMessages');
    const typing = document.getElementById('vendedorTyping');

    // 1. Renderizar mensaje del usuario
    const userMsg = document.createElement('div');
    userMsg.className = 'vendedor-msg vendedor-msg-user';
    userMsg.innerHTML = `
      <div class="vendedor-msg-bubble">${escaparHTML(texto)}</div>
      <span class="vendedor-msg-time">${obtenerHoraActual()}</span>
    `;
    messages.appendChild(userMsg);
    scrollAlFondo();

    // 2. Simular tipeo
    if (typing) typing.style.display = 'flex';
    scrollAlFondo();

    setTimeout(() => {
      if (typing) typing.style.display = 'none';

      // 3. Obtener respuesta oficial y renderizar
      const respuesta = obtenerRespuestaBot(texto);
      const botMsg = document.createElement('div');
      botMsg.className = 'vendedor-msg vendedor-msg-bot';

      let html = `<div class="vendedor-msg-bubble">${respuesta.texto}`;

      if (respuesta.cta) {
        html += `<br><a href="${respuesta.cta.url}" target="_blank" rel="noopener" class="vendedor-cta-btn">${respuesta.cta.texto}</a>`;
      }

      html += `</div><span class="vendedor-msg-time">${obtenerHoraActual()}</span>`;
      botMsg.innerHTML = html;
      messages.appendChild(botMsg);

      // Si incluye sugerencias (chips), agregarlos
      if (respuesta.chips && respuesta.chips.length > 0) {
        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'vendedor-quick-chips';
        respuesta.chips.forEach(c => {
          const btnChip = document.createElement('button');
          btnChip.type = 'button';
          btnChip.className = 'vendedor-chip';
          btnChip.dataset.query = c;
          btnChip.textContent = c;
          chipsContainer.appendChild(btnChip);
        });
        messages.appendChild(chipsContainer);
      }

      scrollAlFondo();
    }, 450);
  }

  function escaparHTML(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Exportar para pruebas automatizadas si corresponde
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { obtenerRespuestaBot, TRIDENTE_KNOWLEDGE };
  }

  // Inicializar al cargar el DOM en navegador
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inicializarVendedorTridente);
    } else {
      inicializarVendedorTridente();
    }
  }
})();
