/**
 * Camila | Ejecutiva Comercial de Distribuidora Tridente
 * Distribuidora Tridente (www.distribuidoratridente.cl)
 *
 * REGLAS ESTRICTAS:
 * 1. Responde ÚNICAMENTE utilizando información fidedigna y directa de Distribuidora Tridente.
 * 2. Si no dispone de información explícita sobre un producto, precio, despacho o contacto,
 *    responde amablemente indicándolo y sugiriendo el contacto directo con Camila por WhatsApp.
 * 3. No inventa precios, stock, tiempos de entrega ni condiciones de venta.
 * 4. Tono comercial, cercano, claro, servicial, natural y profesional (humano, no robótico).
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
    horario: 'Lunes a Viernes • Atención dedicada a almacenes, minimarkets y botillerías',
    zonasDespacho: [
      'La Serena y Coquimbo (radio urbano con entregas programadas)',
      'Ovalle y Provincia del Limarí (rutas semanales directas para comerciantes)',
      'Valle de Elqui y Alrededores (Vicuña, Paihuano y localidades aledañas)'
    ],
    marcasOficiales: [
      'Arcor', 'Bon o Bon', 'Ambrosoli', 'Costa', 'McKay',
      'Clipper', 'OCB', 'Captain Black', 'Tennessee', 'Springfield', 'Roadhouse', 'Ronson',
      'Duracell', 'Eveready', 'Kuroko', 'Bristol'
    ]
  };

  // Helper para generar el avatar SVG de Camila con IDs únicos
  function getCamilaAvatarSVG(suffix) {
    const s = suffix || '1';
    return `
      <svg class="vendedor-avatar-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Camila - Ventas Tridente">
        <defs>
          <linearGradient id="camilaBg_${s}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#eff6ff"/>
            <stop offset="100%" stop-color="#dbeafe"/>
          </linearGradient>
          <linearGradient id="camilaBlazer_${s}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1e3a8a"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
          <linearGradient id="camilaHair_${s}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#3e2723"/>
            <stop offset="100%" stop-color="#1a0f0d"/>
          </linearGradient>
          <clipPath id="camilaClip_${s}">
            <circle cx="50" cy="50" r="50"/>
          </clipPath>
        </defs>
        <g clip-path="url(#camilaClip_${s})">
          <rect width="100" height="100" fill="url(#camilaBg_${s})"/>
          <path d="M26 38 C20 48 18 68 22 78 C25 85 30 82 32 75 C30 65 30 50 32 42 Z" fill="url(#camilaHair_${s})"/>
          <path d="M74 38 C80 48 82 68 78 78 C75 85 70 82 68 75 C70 65 70 50 68 42 Z" fill="url(#camilaHair_${s})"/>
          <path d="M15 100 C15 78 32 70 50 70 C68 70 85 78 85 100 Z" fill="url(#camilaBlazer_${s})"/>
          <path d="M42 70 L50 86 L58 70 Z" fill="#ffffff"/>
          <path d="M46 70 L50 78 L54 70 Z" fill="#f8fafc"/>
          <rect x="43" y="54" width="14" height="18" rx="7" fill="#fcd5b8"/>
          <path d="M43 62 C47 66 53 66 57 62 L57 68 C53 71 47 71 43 68 Z" fill="#f4b595" opacity="0.6"/>
          <ellipse cx="50" cy="46" rx="19" ry="21" fill="#fcd5b8"/>
          <circle cx="38" cy="51" r="3.5" fill="#f87171" opacity="0.25"/>
          <circle cx="62" cy="51" r="3.5" fill="#f87171" opacity="0.25"/>
          <ellipse cx="42" cy="44" rx="2.5" ry="3" fill="#292524"/>
          <circle cx="43" cy="43" r="0.8" fill="#ffffff"/>
          <ellipse cx="58" cy="44" rx="2.5" ry="3" fill="#292524"/>
          <circle cx="59" cy="43" r="0.8" fill="#ffffff"/>
          <path d="M37 39 C40 37 45 38 46 40" stroke="#3e2723" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M63 39 C60 37 55 38 54 40" stroke="#3e2723" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M50 45 L49 49 L52 49" stroke="#e09f7a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M44 54 C47 58 53 58 56 54" stroke="#e11d48" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M30 40 C30 25 40 18 50 18 C60 18 70 25 70 40 C70 32 65 24 55 24 C45 24 35 28 30 40 Z" fill="url(#camilaHair_${s})"/>
          <path d="M30 38 C32 26 44 22 55 22 C64 22 70 28 70 38 C68 30 58 26 50 26 C40 26 34 32 30 38 Z" fill="#4a2e2b"/>
          <path d="M31 38 C35 48 37 55 38 60 C36 55 33 46 31 38 Z" fill="url(#camilaHair_${s})"/>
          <path d="M69 38 C65 48 63 55 62 60 C64 55 67 46 69 38 Z" fill="url(#camilaHair_${s})"/>
          <path d="M31 43 C30 32 38 23 50 23 C62 23 70 32 69 43" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" fill="none"/>
          <rect x="28" y="40" width="5" height="10" rx="2.5" fill="#3b82f6"/>
          <path d="M30 48 C30 55 36 60 43 60" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" fill="none"/>
          <circle cx="44" cy="60" r="2.2" fill="#f59e0b"/>
        </g>
      </svg>
    `;
  }

  // Función para normalizar texto (sin acentos, minúsculas, limpio)
  function normalizar(texto) {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // Motor de Respuestas de Camila que cumple estrictamente las 5 reglas
  function obtenerRespuestaBot(mensajeUsuario) {
    const q = normalizar(mensajeUsuario);

    // 1. Identidad / Nombre de Camila
    if (q.includes('quien eres') || q.includes('como te llamas') || q.includes('tu nombre') ||
        q.includes('con quien hablo') || q.includes('eres bot') || q.includes('eres un bot') ||
        q.includes('eres real') || q.includes('eres humana') || q.includes('eres persona') ||
        q.includes('camila')) {
      return {
        texto: `¡Hola! Soy <strong>Camila</strong>, ejecutiva comercial de <strong>Distribuidora Tridente</strong>. 👋<br><br>` +
               `Me encargo de asesorar a dueños de almacenes, minimarkets y botillerías en sus compras mayoristas: alfajores Bon o Bon, chocolates, galletas, tabacos OCB, pilas Duracell y coordinar los despachos directos a tu local.<br><br>` +
               `¿Qué productos necesitas surtir hoy en tu negocio?`,
        cta: {
          texto: '💬 Hablar con Camila por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20hacer%20una%20consulta%20para%20mi%20negocio`
        },
        chips: ['🍫 Alfajores Bon o Bon', '🍬 Gomitas y Confites', '🚚 Zonas de Despacho', '📋 ¿Cómo Comprar?']
      };
    }

    // 2. Saludos
    if (/^(hola|buen(os)?\s*(dias|tardes|noches)|saludos|que\s*tal|buenas|holas?)\b/.test(q)) {
      return {
        texto: `¡Hola! Qué gusto saludarte. 👋 Soy <strong>Camila</strong>, del equipo de ventas de <strong>Distribuidora Tridente</strong>.<br><br>` +
               `Estoy aquí para ayudarte a armar tu pedido mayorista y darte los mejores precios en: <strong>Bon o Bon</strong>, chocolates Costa y Arcor, confites, galletas McKay, papelillos OCB, encendedores Clipper, pilas Duracell y abarrotes con despacho a tu local.<br><br>` +
               `Elige una categoría o dime qué necesitas para tu negocio:`,
        chips: [
          '🍫 Alfajores Bon o Bon',
          '🍬 Gomitas y Confites',
          '🍪 Galletas McKay y Costa',
          '🚬 Papelillos OCB y Filtros',
          '🔥 Encendedores Clipper',
          '🔋 Pilas Duracell y Eveready',
          '🚚 Zonas de Despacho',
          '📋 ¿Cómo Comprar?'
        ]
      };
    }

    // 3. Bon o Bon Específico (Blanco, Negro, Bombones, Alfajores)
    if (q.includes('bon o bon') || (q.includes('alfajor') && (q.includes('blanco') || q.includes('negro') || q.includes('leche') || q.includes('caja')))) {
      return {
        texto: `🍫 <strong>Línea Oficial Bon o Bon (Arcor) al por mayor:</strong><br><br>` +
               `• <strong>Alfajores Bon o Bon Blanco:</strong> Relleno cremoso de pasta de maní y cobertura de chocolate blanco (en display/caja).<br>` +
               `• <strong>Alfajores Bon o Bon Chocolate con Leche:</strong> El clásico alfajor con suave cobertura de chocolate con leche.<br>` +
               `• <strong>Bombones Bon o Bon:</strong> Formatos surtidos, tradicionales y cajas especiales para venta por unidad en mostrador.<br><br>` +
               `📦 <em>Venta en formatos de cajas y bultos cerrados para asegurar el mejor margen de reventa.</em><br><br>` +
               `¿Deseas consultar la lista de precios mayoristas vigente?`,
        cta: {
          texto: '💬 Cotizar Bon o Bon con Camila',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20cotizar%20alfajores%20y%20bombones%20Bon%20o%20Bon`
        },
        chips: ['🍫 Chocolates Costa y Arcor', '🍬 Gomitas Frugelé', '📄 Ver Catálogo', '🚚 Despacho']
      };
    }

    // 4. Chocolates y Bombones (Costa, Arcor, Chocman, Vizzio, etc.)
    if (q.includes('chocman') || q.includes('vizzio') || q.includes('trencito') || q.includes('golazo') ||
        q.includes('chocolate') || q.includes('tableta') || q.includes('bombones')) {
      return {
        texto: `🍫 <strong>Chocolates y Bombones de Primeras Marcas:</strong><br><br>` +
               `• <strong>Costa:</strong> Chocman tradicional, Vizzio (almendras y maní con chocolate), barras y tabletas.<br>` +
               `• <strong>Arcor:</strong> Chocolates Golazo, tabletas de chocolate con leche, semiamargo, chocolate blanco y bombones surtidos.<br>` +
               `• <strong>Ambrosoli:</strong> Chocolates y bombones rellenos de alta rotación para confiterías y almacenes.<br><br>` +
               `Todos vienen listos en exhibidores para mostrador de venta rápida.`,
        cta: {
          texto: '💬 Cotizar Chocolates con Camila',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20cotizar%20chocolates%20y%20bombones`
        },
        chips: ['🍫 Alfajores Bon o Bon', '🍬 Caramelos Ambrosoli', '🍪 Galletas y Snacks', '📋 ¿Cómo Comprar?']
      };
    }

    // 5. Gomitas, Caramelos y Confites (Frugelé, Peritas, Toffees, Mentitas, Chubi, etc.)
    if (q.includes('frugele') || q.includes('perita') || q.includes('toffee') || q.includes('mentita') ||
        q.includes('chubi') || q.includes('chupete') || q.includes('gomita') || q.includes('caramelo') ||
        q.includes('confite') || q.includes('masticable') || q.includes('dulce') || q.includes('candies') || q.includes('ambrosoli')) {
      return {
        texto: `🍬 <strong>Confites, Caramelos y Gomitas (Ambrosoli y Arcor):</strong><br><br>` +
               `• <strong>Frugelé:</strong> Gomitas clásicas y frutales en bolsas individuales y formatos surtidos.<br>` +
               `• <strong>Ambrosoli:</strong> Caramelos tradicionales, peritas ácidas, toffees de leche/mantequilla, mentitas y Chubi.<br>` +
               `• <strong>Golosinas Arcor:</strong> Caramelos masticables, chupetes y confites duros surtidos.<br><br>` +
               `Productos infaltables en el mostrador para compras al paso en minimarkets.`,
        cta: {
          texto: '💬 Cotizar Confites con Camila',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20cotizar%20confites,%20Frugele%20y%20dulces`
        },
        chips: ['💨 Chicles (Beldent, Bubbaloo)', '🍫 Bon o Bon y Chocolates', '📄 Ver Catálogo']
      };
    }

    // 6. Chicles y Masticables (Beldent, Bubbaloo, Grosso, Topline)
    if (q.includes('chicle') || q.includes('beldent') || q.includes('bubbaloo') || q.includes('grosso') ||
        q.includes('topline') || q.includes('pastilla')) {
      return {
        texto: `💨 <strong>Chicles y Pastillas de Alta Rotación:</strong><br><br>` +
               `• <strong>Beldent:</strong> Chicles sin azúcar en sabores menta, mentol, clorofila y frutales (en tira y display).<br>` +
               `• <strong>Bubbaloo:</strong> Chicles rellenos con centro líquido sabores frutales clásicos.<br>` +
               `• <strong>Grosso y Topline:</strong> Chicles en tiras económicas para kioscos y almacenes.<br><br>` +
               `Vienen en displays diseñados para colocar junto a la caja registradora.`,
        cta: {
          texto: '💬 Cotizar Chicles con Camila',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20cotizar%20chicles%20Beldent%20y%20Bubbaloo`
        },
        chips: ['🍬 Ver Gomitas y Confites', '🍪 Galletas y Snacks', '📋 ¿Cómo Comprar?']
      };
    }

    // 7. Galletas y Colaciones (McKay, Costa, Arcor, Tritón, Kuky, etc.)
    if (q.includes('galleta') || q.includes('triton') || q.includes('kuky') || q.includes('vino') ||
        q.includes('criollita') || q.includes('tuareg') || q.includes('frack') || q.includes('donuts') ||
        q.includes('mckay') || q.includes('soda') || q.includes('agua') || q.includes('obleas')) {
      return {
        texto: `🍪 <strong>Variedad Mayorista en Galletas (McKay, Costa y Arcor):</strong><br><br>` +
               `• <strong>McKay:</strong> Galletas Vino, Criollitas, Kuky con chips de chocolate, galletas de Agua y Soda.<br>` +
               `• <strong>Costa:</strong> Galletas Tritón (chocolate y vainilla), Tuareg, Frack, Donuts y obleas rellenas.<br>` +
               `• <strong>Colaciones individuales y paquetes familiares:</strong> Ideales para surtir despensas y recreos.<br><br>` +
               `Disponibles por cajas y fardos cerrados.`,
        cta: {
          texto: '💬 Cotizar Galletas con Camila',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20cotizar%20galletas%20McKay%20y%20Costa`
        },
        chips: ['🥔 Snacks Salados y Ramitas', '🍫 Bon o Bon', '📄 Catálogo Digital']
      };
    }

    // 8. Snacks Salados, Ramitas y Frutos Secos
    if (q.includes('snack') || q.includes('ramita') || q.includes('papas') || q.includes('frutos secos') ||
        q.includes('mani') || q.includes('salado')) {
      return {
        texto: `🥔 <strong>Snacks Salados para Botillerías y Almacenes:</strong><br><br>` +
               `• <strong>Ramitas:</strong> Sabor salado tradicional y sabor queso.<br>` +
               `• <strong>Papas Fritas y Snacks crujientes:</strong> Formatos personales y grandes para compartir.<br>` +
               `• <strong>Maní y Frutos Secos:</strong> Maní salado, con cáscara y mix de frutos secos listos para exhibir.<br><br>` +
               `Excelente complemento de alta rotación para acompañar bebidas y celebraciones.`,
        cta: {
          texto: '💬 Cotizar Snacks con Camila',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20cotizar%20snacks%20y%20ramitas`
        },
        chips: ['🍪 Galletas McKay y Costa', '🚬 Tabaco y Accesorios', '🚚 Zonas de Despacho']
      };
    }

    // 9. Papelillos OCB y Filtros
    if (q.includes('ocb') || q.includes('papelillo') || q.includes('filtro') || q.includes('virgin') ||
        q.includes('x-pert') || q.includes('xpert') || q.includes('canamo') || q.includes('hemp') ||
        q.includes('enroladora') || q.includes('armador')) {
      return {
        texto: `🚬 <strong>Línea Completa OCB Original al por mayor:</strong><br><br>` +
               `• <strong>Papelillos OCB:</strong><br>` +
               `  - <em>OCB Premium (caja negra):</em> El más vendido en formato 1 1/4 y King Size.<br>` +
               `  - <em>OCB X-Pert:</em> Papel ultrafino de combustión lenta.<br>` +
               `  - <em>OCB Virgin:</em> Papel marrón natural no blanqueado.<br>` +
               `  - <em>OCB Cáñamo Orgánico:</em> 100% natural.<br>` +
               `• <strong>Filtros OCB:</strong> Formatos Regular, Slim (6mm), Ultra Slim (5.7mm) y con carbón activo.<br>` +
               `• <strong>Accesorios:</strong> Enroladoras/armadores de cigarrillos manuales OCB.<br><br>` +
               `Gran margen de rentabilidad para botillerías y minimarkets.`,
        cta: {
          texto: '💬 Cotizar OCB con Camila',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20cotizar%20papelillos%20y%20filtros%20OCB`
        },
        chips: ['🔥 Encendedores Clipper/Ronson', '🍂 Tabacos para Enrolar', '📄 Ver Catálogo']
      };
    }

    // 10. Encendedores Clipper, Ronson y Gas
    if (q.includes('clipper') || q.includes('ronson') || q.includes('encendedor') || q.includes('gas') ||
        q.includes('butano') || q.includes('chispero') || q.includes('fuego')) {
      return {
        texto: `🔥 <strong>Encendedores y Gas para Recarga:</strong><br><br>` +
               `• <strong>Clipper Original:</strong><br>` +
               `  - Encendedores recargables clásicos, coleccionables con diseños exclusivos.<br>` +
               `  - Tamaños estándar y mini, con sistema de piedra reemplazable y prensador.<br>` +
               `• <strong>Ronson:</strong><br>` +
               `  - Encendedores electrónicos confiables para venta directa.<br>` +
               `  - Latas de Gas Butano Ronson refinado para recarga de encendedores y sopletes.<br><br>` +
               `En displays exhibidores listos para venta en mostrador.`,
        cta: {
          texto: '💬 Cotizar Clipper con Camila',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20cotizar%20encendedores%20Clipper%20y%20Ronson`
        },
        chips: ['🚬 Papelillos OCB', '🍂 Tabacos (Captain Black, Tennessee)', '🔋 Pilas Duracell']
      };
    }

    // 11. Tabacos para Enrolar (Captain Black, Tennessee, Springfield, Roadhouse)
    if (q.includes('tabaco') || q.includes('captain black') || q.includes('tennessee') ||
        q.includes('springfield') || q.includes('roadhouse') || q.includes('liar') || q.includes('enrolar') || q.includes('cigarro')) {
      return {
        texto: `🍂 <strong>Tabacos para Liar de Primeras Marcas:</strong><br><br>` +
               `• <strong>Captain Black:</strong> Variedades Regular, Cherry y aromáticos en paquetes sellados.<br>` +
               `• <strong>Tennessee:</strong> Tabaco de excelente corte y aroma tradicional.<br>` +
               `• <strong>Springfield y Roadhouse:</strong> Opciones reconocidas por fumadores exigentes.<br><br>` +
               `📦 Paquetes oficiales con sellos legales vigentes. Consulta por compras en fardos y displays.`,
        cta: {
          texto: '💬 Cotizar Tabacos con Camila',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20cotizar%20tabacos%20Captain%20Black%20y%20Tennessee`
        },
        chips: ['🚬 Papelillos OCB y Filtros', '🔥 Encendedores Clipper', '🚚 Zonas de Despacho']
      };
    }

    // 12. Pilas Duracell y Eveready
    if (q.includes('pila') || q.includes('bateria') || q.includes('duracell') || q.includes('eveready') ||
        q.includes('aa') || q.includes('aaa') || q.includes('2032') || q.includes('boton') || q.includes('9v')) {
      return {
        texto: `🔋 <strong>Pilas y Baterías Oficiales Duracell y Eveready:</strong><br><br>` +
               `• <strong>Duracell (Larga Duración Alcalina):</strong><br>` +
               `  - Pilas AA y AAA (en tiras y blíster para colgar en caja).<br>` +
               `  - Pilas medianas C, grandes D y rectangulares 9V.<br>` +
               `  - Pilas botón de litio (CR2032, CR2025, CR2016) para llaves, controles y balanzas.<br>` +
               `• <strong>Eveready:</strong><br>` +
               `  - Pilas de carbón y alcalinas Super Heavy Duty, la alternativa económica más vendida.<br><br>` +
               `Garantía de originalidad con fecha de vencimiento amplia.`,
        cta: {
          texto: '💬 Cotizar Pilas con Camila',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20cotizar%20pilas%20Duracell%20y%20Eveready`
        },
        chips: ['🍫 Bon o Bon y Confites', '🛒 Abarrotes de Almacén', '📋 ¿Cómo Comprar?']
      };
    }

    // 13. Abarrotes y Consumo Masivo (Bristol, Kuroko, etc.)
    if (q.includes('abarrote') || q.includes('consumo') || q.includes('mercaderia') || q.includes('despensa') ||
        q.includes('kuroko') || q.includes('bristol') || q.includes('almacen')) {
      return {
        texto: `🛒 <strong>Abarrotes y Artículos de Consumo para Almacenes:</strong><br><br>` +
               `Trabajamos líneas seleccionadas de abarrotes de alta rotación (incluyendo marcas como <strong>Bristol</strong> y <strong>Kuroko</strong>):<br>` +
               `• Productos esenciales de despensa y colaciones.<br>` +
               `• Bebidas, té, café y jugos en polvo.<br>` +
               `• Artículos de rotación rápida para el vecino del barrio.<br><br>` +
               `Revisa las novedades en nuestro portal digital o pídeme la lista actualizada por WhatsApp para coordinar tu despacho.`,
        cta: {
          texto: '🌐 Ver Catálogo Digital',
          url: TRIDENTE_KNOWLEDGE.catalogoDigital
        },
        chips: ['🍫 Bon o Bon y Chocolates', '🍪 Galletas McKay', '🚚 Métodos de Despacho']
      };
    }

    // 14. Zonas y Métodos de Despacho
    if (q.includes('despacho') || q.includes('envio') || q.includes('entrega') || q.includes('reparto') ||
        q.includes('donde entregan') || q.includes('zona') || q.includes('cobertura') || q.includes('ruta') ||
        q.includes('serena') || q.includes('coquimbo') || q.includes('ovalle') || q.includes('limari') ||
        q.includes('elqui') || q.includes('vicuna') || q.includes('paihuano')) {
      return {
        texto: `🚚 <strong>Zonas de Despacho y Cobertura de Distribuidora Tridente:</strong><br><br>` +
               `📍 <strong>La Serena y Coquimbo:</strong> Entregas periódicas y programadas dentro del radio urbano.<br>` +
               `📍 <strong>Ovalle y Provincia del Limarí:</strong> Rutas semanales directas para abastecer comerciantes.<br>` +
               `📍 <strong>Valle de Elqui y Alrededores:</strong> Entregas en Vicuña, Paihuano y localidades aledañas.<br><br>` +
               `Dime en qué comuna o sector está tu negocio y te confirmo de inmediato la próxima ruta de entrega directo a la puerta de tu local.`,
        cta: {
          texto: '💬 Coordinar Despacho con Camila',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20consultar%20por%20la%20ruta%20de%20despacho%20para%20mi%20local`
        },
        chips: ['📋 ¿Cómo Comprar?', '🍫 Ver Productos', '📞 Contactar a Ventas']
      };
    }

    // 15. Cómo hacer un pedido / Métodos de compra
    if (q.includes('como comprar') || q.includes('como hago') || q.includes('hacer pedido') || q.includes('realizar pedido') ||
        q.includes('portal') || q.includes('pedidos') || q.includes('comprar') || q.includes('minimo') || q.includes('orden')) {
      return {
        texto: `Para comprar en <strong>Distribuidora Tridente</strong> tienes 2 opciones muy rápidas:<br><br>` +
               `1️⃣ <strong>Vía WhatsApp conmigo:</strong> Escríbeme al <strong>${TRIDENTE_KNOWLEDGE.whatsappNumber}</strong> con tu lista de productos y te armo la cotización de inmediato.<br><br>` +
               `2️⃣ <strong>Portal Web de Pedidos 24 Horas:</strong> Ingresa a <a href="${TRIDENTE_KNOWLEDGE.portalPedidos}" target="_blank" rel="noopener">pedidos.distribuidoratridente.cl</a> para armar y gestionar tus compras a cualquier hora.<br><br>` +
               `🧾 <em>Emitimos facturación inmediata con RUT o boleta comercial.</em>`,
        cta: {
          texto: '🚀 Ir al Portal de Pedidos',
          url: TRIDENTE_KNOWLEDGE.portalPedidos
        },
        chips: ['💬 Escribir por WhatsApp', '🚚 Zonas de Despacho', '🍫 Ver Catálogo']
      };
    }

    // 16. Precios y Cotizaciones (Regla 3: No inventar precios)
    if (q.includes('precio') || q.includes('cuanto vale') || q.includes('cuanto cuesta') || q.includes('valor') ||
        q.includes('cotizar') || q.includes('cotizacion') || q.includes('tarifa') || q.includes('lista de precio')) {
      return {
        texto: `Nuestros precios son <strong>100% mayoristas</strong> por caja y bulto cerrado para asegurar el mejor margen para tu negocio.<br><br>` +
               `Para no brindarte un valor desactualizado, te comparto la <strong>lista de precios vigente y cotización inmediata</strong> por WhatsApp:`,
        cta: {
          texto: '💬 Pedir Lista de Precios a Camila',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20solicitar%20la%20lista%20de%20precios%20mayorista%20actualizada`
        },
        chips: ['📄 Ver Catálogo Digital', '🚚 Zonas de Despacho', '📋 ¿Cómo Comprar?']
      };
    }

    // 17. Contacto, Ubicación y Horarios
    if (q.includes('contacto') || q.includes('telefono') || q.includes('whatsapp') || q.includes('donde estan') ||
        q.includes('direccion') || q.includes('ubicacion') || q.includes('horario') || q.includes('atencion')) {
      return {
        texto: `📌 <strong>Canales Oficiales de Distribuidora Tridente:</strong><br><br>` +
               `📱 <strong>WhatsApp Ventas (Camila):</strong> <a href="${TRIDENTE_KNOWLEDGE.whatsappLink}" target="_blank" rel="noopener">${TRIDENTE_KNOWLEDGE.whatsappNumber}</a><br>` +
               `📍 <strong>Ubicación:</strong> ${TRIDENTE_KNOWLEDGE.ubicacion}<br>` +
               `⏰ <strong>Horario:</strong> ${TRIDENTE_KNOWLEDGE.horario}<br>` +
               `🌐 <strong>Portal de Pedidos:</strong> <a href="${TRIDENTE_KNOWLEDGE.portalPedidos}" target="_blank" rel="noopener">pedidos.distribuidoratridente.cl</a>`,
        cta: {
          texto: '💬 Escribirle a Camila por WhatsApp',
          url: TRIDENTE_KNOWLEDGE.whatsappLink
        },
        chips: ['🍫 Catálogo Mayorista', '🚚 Despacho a Regiones', '📋 ¿Cómo Pedir?']
      };
    }

    // 18. Menú General de Categorías y Catálogo
    if (q.includes('catalogo') || q.includes('productos') || q.includes('que venden') || q.includes('que tienen') ||
        q.includes('categoria') || q.includes('menu')) {
      return {
        texto: `Distribuimos las principales marcas mayoristas en 5 grandes categorías:<br><br>` +
               `🍫 <strong>Confites y Chocolates:</strong> Bon o Bon, Arcor, Ambrosoli, Costa, Frugelé.<br>` +
               `🍪 <strong>Galletas y Snacks:</strong> McKay (Kuky, Criollitas, Vino), Costa (Tritón), ramitas y papas.<br>` +
               `🚬 <strong>Tabacos y Fumador:</strong> Papelillos OCB, encendedores Clipper/Ronson, tabacos Captain Black/Tennessee.<br>` +
               `🔋 <strong>Pilas y Energía:</strong> Duracell (alcalinas y botón) y Eveready.<br>` +
               `🛒 <strong>Abarrotes:</strong> Artículos seleccionados de rotación diaria.<br><br>` +
               `¿Sobre cuál te gustaría cotizar o conocer más detalles?`,
        cta: {
          texto: '📄 Abrir Catálogo Digital en la Web',
          url: 'catalogo.html'
        },
        chips: [
          '🍫 Alfajores Bon o Bon',
          '🍬 Gomitas Frugelé',
          '🍪 Galletas McKay',
          '🚬 Papelillos OCB',
          '🔥 Encendedores Clipper',
          '🔋 Pilas Duracell'
        ]
      };
    }

    // 19. Facturación / Boleta / RUT
    if (q.includes('factura') || q.includes('boleta') || q.includes('rut') || q.includes('iva') || q.includes('empresa')) {
      return {
        texto: `¡Sí, por supuesto! En Distribuidora Tridente emitimos <strong>facturación inmediata con RUT</strong> para empresas y comerciantes, así como boleta comercial según lo que requieras.<br><br>` +
               `Solo me indicas tu RUT y razón social al momento de confirmar el pedido.`,
        cta: {
          texto: '💬 Coordinar Pedido con Factura',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Camila,%20quisiera%20hacer%20un%20pedido%20con%20factura`
        },
        chips: ['📋 ¿Cómo Comprar?', '🚚 Zonas de Despacho', '🍫 Ver Productos']
      };
    }

    // 20. Agradecimientos y despedidas
    if (q.includes('gracias') || q.includes('muchas gracias') || q.includes('vale') || q.includes('perfecto') ||
        q.includes('chao') || q.includes('adios') || q.includes('hasta luego')) {
      return {
        texto: `¡De nada! Ha sido un gusto atenderte. En <strong>Distribuidora Tridente</strong> estamos listos para ser el mejor aliado de tu negocio. ¡Que tengas excelentes ventas! 🌟`,
        chips: ['💬 Hablar con Camila por WhatsApp', '📄 Ver Catálogo', '🚚 Despacho']
      };
    }

    // 21. Regla 5: Preguntas fuera del ámbito de la distribuidora
    if (q.includes('futbol') || q.includes('partido') || q.includes('deporte') || q.includes('politica') ||
        q.includes('chiste') || q.includes('clima') || q.includes('tiempo manana') || q.includes('musica') ||
        q.includes('cancion') || q.includes('pelicula') || q.includes('juego') || q.includes('videojuego') ||
        q.includes('presidente') || q.includes('inteligencia artificial') || q.includes('chatgpt') ||
        q.includes('gemini') || q.includes('robot')) {
      return {
        texto: `Como ejecutiva comercial de <strong>Distribuidora Tridente</strong>, estoy enfocada en atenderte con respecto a nuestro catálogo mayorista, confites, chocolates Bon o Bon, tabacos, pilas y despachos para tu local. 😊<br><br>` +
               `¿Te gustaría que revisemos cotizaciones o consultar las rutas de entrega para tu negocio?`,
        chips: ['🍫 Bon o Bon y Confites', '🚬 OCB y Clipper', '🔋 Pilas Duracell', '🚚 Despacho']
      };
    }

    // 22. Regla 2 y 3: No inventar información ni productos que no estén explícitamente en la web
    return {
      texto: `No dispongo de esa información específica en este momento en mi catálogo público.<br><br>` +
             `Para darte una respuesta exacta sobre stock disponible, productos particulares o cotizaciones por mayor, conversemos directamente por WhatsApp:`,
      cta: {
        texto: `💬 Consultar con Camila por WhatsApp`,
        url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=${encodeURIComponent('Hola Camila, quisiera consultar por: ' + mensajeUsuario)}`
      },
      chips: ['🍫 Catálogo Mayorista', '🚚 Zonas de Despacho', '📞 Contacto Oficial']
    };
  }

  // Creación y renderizado del widget en el DOM
  function inicializarVendedorTridente() {
    // Evitar duplicados
    if (document.getElementById('vendedorTridenteWidget')) return;

    // Inyectar HTML del widget con Camila como ejecutiva
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'vendedorTridenteWidget';
    widgetContainer.innerHTML = `
      <!-- Backdrop Oscuro para Móvil al abrir el chat -->
      <div class="vendedor-backdrop" id="vendedorBackdrop" aria-hidden="true"></div>

      <!-- Contenedor Flotante Vendedor Tridente (Ubicado ARRIBA de WhatsApp) -->
      <div class="vendedor-tridente-float" id="vendedorTridenteFloat">
        <!-- Nube / Speech Bubble personalizada de Camila -->
        <div class="vendedor-cloud" id="vendedorCloud" role="button" tabindex="0" title="Hablar con Camila de Ventas Tridente">
          <span class="vendedor-cloud-text">💬 ¡Hola! Soy Camila, ¿te ayudo con tu pedido?</span>
          <button type="button" class="vendedor-cloud-close" id="vendedorCloudClose" aria-label="Cerrar aviso">&times;</button>
        </div>

        <!-- Botón Circular con Avatar de Camila -->
        <button type="button" class="vendedor-tridente-btn" id="vendedorTridenteBtn" aria-label="Hablar con Camila de Ventas Tridente" title="Hablar con Camila">
          <span class="vendedor-status-indicator" title="Camila en línea"></span>
          <div class="vendedor-btn-avatar-wrap">
            ${getCamilaAvatarSVG('btn')}
          </div>
        </button>
      </div>

      <!-- Ventana de Chat Flotante Responsive -->
      <div class="vendedor-chat-window" id="vendedorChatWindow" role="dialog" aria-labelledby="vendedorChatTitle" aria-hidden="true">
        <!-- Header con Avatar y Estado de Camila -->
        <div class="vendedor-chat-header">
          <div class="vendedor-header-avatar">
            ${getCamilaAvatarSVG('hdr')}
            <span class="vendedor-avatar-dot" title="En línea"></span>
          </div>
          <div class="vendedor-header-info">
            <h3 id="vendedorChatTitle" class="vendedor-header-name">Camila | Ventas Tridente</h3>
            <p class="vendedor-header-status">Ejecutiva Comercial • En línea</p>
          </div>
          <div class="vendedor-header-actions">
            <button type="button" class="vendedor-header-btn" id="vendedorChatReset" aria-label="Ver menú principal" title="Ver opciones">🏠</button>
            <button type="button" class="vendedor-header-btn" id="vendedorChatClose" aria-label="Cerrar chat" title="Cerrar">✕</button>
          </div>
        </div>

        <!-- Mensajes -->
        <div class="vendedor-chat-messages" id="vendedorChatMessages">
          <!-- Mensaje de bienvenida inicial de Camila -->
          <div class="vendedor-msg vendedor-msg-bot">
            <div class="vendedor-msg-bubble">
              ¡Hola! 👋 Soy <strong>Camila</strong>, tu ejecutiva comercial en <strong>Distribuidora Tridente</strong>.<br><br>
              Te ayudo a armar tu pedido mayorista con los mejores precios directos: alfajores <strong>Bon o Bon</strong>, chocolates Costa y Arcor, gomitas Frugelé, galletas McKay, papelillos OCB, encendedores Clipper, pilas Duracell y despachos a tu local.<br><br>
              ¿Qué productos necesitas surtir hoy?
            </div>
            <span class="vendedor-msg-time">Ahora</span>
          </div>

          <!-- Menú amplio de sugerencias de productos iniciales -->
          <div class="vendedor-quick-chips" id="vendedorInitialChips">
            <button type="button" class="vendedor-chip" data-query="¿Qué variedades de alfajores Bon o Bon tienen?">🍫 Alfajores Bon o Bon</button>
            <button type="button" class="vendedor-chip" data-query="¿Tienen gomitas Frugelé y caramelos Ambrosoli?">🍬 Gomitas y Confites</button>
            <button type="button" class="vendedor-chip" data-query="¿Qué galletas McKay y Costa tienen?">🍪 Galletas McKay y Costa</button>
            <button type="button" class="vendedor-chip" data-query="¿Tienen papelillos OCB y filtros?">🚬 Papelillos OCB y Filtros</button>
            <button type="button" class="vendedor-chip" data-query="¿Tienen encendedores Clipper y gas Ronson?">🔥 Encendedores Clipper</button>
            <button type="button" class="vendedor-chip" data-query="¿Venden tabacos Captain Black y Tennessee?">🍂 Tabacos para Liar</button>
            <button type="button" class="vendedor-chip" data-query="¿Qué pilas Duracell y Eveready tienen?">🔋 Pilas Duracell y Eveready</button>
            <button type="button" class="vendedor-chip" data-query="¿Qué abarrotes manejan para almacén?">🛒 Abarrotes y Consumo</button>
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
          <input type="text" id="vendedorChatInput" class="vendedor-chat-input" placeholder="Pregúntale a Camila por Bon o Bon, OCB, despachos..." autocomplete="off" maxlength="250" />
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
    const backdrop = document.getElementById('vendedorBackdrop');
    const closeBtn = document.getElementById('vendedorChatClose');
    const resetBtn = document.getElementById('vendedorChatReset');
    const form = document.getElementById('vendedorChatForm');
    const input = document.getElementById('vendedorChatInput');
    const messages = document.getElementById('vendedorChatMessages');

    function abrirChat() {
      chatWindow.classList.add('vendedor-chat-open');
      chatWindow.setAttribute('aria-hidden', 'false');
      if (backdrop) backdrop.classList.add('vendedor-backdrop-active');
      if (cloud) cloud.style.display = 'none';

      // Evitar scroll en body en pantallas táctiles pequeñas
      if (window.innerWidth <= 600) {
        document.body.classList.add('vendedor-modal-open');
      }

      setTimeout(() => {
        if (input) input.focus();
      }, 250);
      scrollAlFondo();
    }

    function cerrarChat() {
      chatWindow.classList.remove('vendedor-chat-open');
      chatWindow.setAttribute('aria-hidden', 'true');
      if (backdrop) backdrop.classList.remove('vendedor-backdrop-active');
      document.body.classList.remove('vendedor-modal-open');
    }

    function toggleChat() {
      if (chatWindow.classList.contains('vendedor-chat-open')) {
        cerrarChat();
      } else {
        abrirChat();
      }
    }

    if (btn) btn.addEventListener('click', toggleChat);
    if (backdrop) backdrop.addEventListener('click', cerrarChat);

    if (cloud) {
      cloud.addEventListener('click', (e) => {
        if (e.target !== cloudClose) {
          abrirChat();
        }
      });
      cloud.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
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

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        enviarMensaje('Ver menú de categorías de productos');
      });
    }

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

    // 2. Simular tipeo natural
    if (typing) typing.style.display = 'flex';
    scrollAlFondo();

    setTimeout(() => {
      if (typing) typing.style.display = 'none';

      // 3. Obtener respuesta de Camila y renderizar
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

      // Si incluye sugerencias (chips), agregarlos con contenedor horizontal interactivo
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
    }, 400);
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
