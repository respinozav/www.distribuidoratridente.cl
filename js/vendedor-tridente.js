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
      'Clipper', 'OCB', 'Captain Black', 'Tennessee', 'Springfield', 'Roadhouse', 'Ronson',
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
               `Estoy aquí para asesorarte sobre todo nuestro catálogo mayorista: <strong>Bon o Bon</strong>, chocolates, confites, galletas, tabacos OCB, encendedores Clipper, pilas Duracell y abarrotes, además de despachos para tu negocio.<br><br>` +
               `Elige una categoría o escribe tu consulta:`,
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

    // 2. Bon o Bon Específico (Blanco, Negro, Bombones, Alfajores)
    if (q.includes('bon o bon') || (q.includes('alfajor') && (q.includes('blanco') || q.includes('negro') || q.includes('leche') || q.includes('caja')))) {
      return {
        texto: `🍫 <strong>Línea Oficial Bon o Bon (Arcor) al por mayor:</strong><br><br>` +
               `• <strong>Alfajores Bon o Bon Blanco:</strong> Con relleno cremoso de pasta de maní y cobertura de chocolate blanco (en display/caja).<br>` +
               `• <strong>Alfajores Bon o Bon Chocolate con Leche:</strong> El clásico alfajor con suave cobertura de chocolate con leche.<br>` +
               `• <strong>Bombones Bon o Bon:</strong> Formatos surtidos, tradicionales y cajas especiales para venta por unidad en mostrador.<br><br>` +
               `📦 <em>Venta en formatos de cajas y bultos cerrados para maximizar tu ganancia.</em><br><br>` +
               `¿Deseas consultar la lista de precios mayoristas vigente?`,
        cta: {
          texto: '💬 Cotizar Bon o Bon por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20alfajores%20y%20bombones%20Bon%20o%20Bon`
        },
        chips: ['🍫 Chocolates Costa y Arcor', '🍬 Gomitas Frugelé', '📄 Ver Catálogo', '🚚 Despacho']
      };
    }

    // 3. Chocolates y Bombones (Costa, Arcor, Chocman, Vizzio, etc.)
    if (q.includes('chocman') || q.includes('vizzio') || q.includes('trencito') || q.includes('golazo') ||
        q.includes('chocolate') || q.includes('tableta') || q.includes('bombones')) {
      return {
        texto: `🍫 <strong>Chocolates y Bombones de Primeras Marcas:</strong><br><br>` +
               `• <strong>Costa:</strong> Chocman tradicional, Vizzio (almendras y maní con chocolate), barras y tabletas de chocolate.<br>` +
               `• <strong>Arcor:</strong> Chocolates Golazo, tabletas de chocolate con leche, semiamargo, chocolate blanco y bombones surtidos.<br>` +
               `• <strong>Ambrosoli:</strong> Chocolates y bombones rellenos de alta rotación para confiterías y almacenes.<br><br>` +
               `Todos vienen listos en exhibidores para mostrador de venta rápida.`,
        cta: {
          texto: '💬 Solicitar Precios de Chocolates por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20chocolates%20y%20bombones`
        },
        chips: ['🍫 Alfajores Bon o Bon', '🍬 Caramelos Ambrosoli', '🍪 Galletas y Snacks', '📋 ¿Cómo Comprar?']
      };
    }

    // 4. Gomitas, Caramelos y Confites (Frugelé, Peritas, Toffees, Mentitas, Chubi, etc.)
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
          texto: '💬 Cotizar Confites y Gomitas por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20confites,%20Frugele%20y%20dulces`
        },
        chips: ['💨 Chicles (Beldent, Bubbaloo)', '🍫 Bon o Bon y Chocolates', '📄 Ver Catálogo']
      };
    }

    // 5. Chicles y Masticables (Beldent, Bubbaloo, Grosso, Topline)
    if (q.includes('chicle') || q.includes('beldent') || q.includes('bubbaloo') || q.includes('grosso') ||
        q.includes('topline') || q.includes('pastilla')) {
      return {
        texto: `💨 <strong>Chicles y Pastillas de Alta Rotación:</strong><br><br>` +
               `• <strong>Beldent:</strong> Chicles sin azúcar en sabores menta, mentol, clorofila y frutales (en tira y display).<br>` +
               `• <strong>Bubbaloo:</strong> Chicles rellenos con centro líquido sabores frutales clásicos.<br>` +
               `• <strong>Grosso y Topline:</strong> Chicles en tiras económicas para kioscos y almacenes.<br><br>` +
               `Vienen en displays diseñados para colocar junto a la caja registradora.`,
        cta: {
          texto: '💬 Cotizar Chicles por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20chicles%20Beldent%20y%20Bubbaloo`
        },
        chips: ['🍬 Ver Gomitas y Confites', '🍪 Galletas y Snacks', '📋 ¿Cómo Comprar?']
      };
    }

    // 6. Galletas y Colaciones (McKay, Costa, Arcor, Tritón, Kuky, etc.)
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
          texto: '💬 Cotizar Galletas por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20galletas%20McKay%20y%20Costa`
        },
        chips: ['🥔 Snacks Salados y Ramitas', '🍫 Bon o Bon', '📄 Catálogo Digital']
      };
    }

    // 7. Snacks Salados, Ramitas y Frutos Secos
    if (q.includes('snack') || q.includes('ramita') || q.includes('papas') || q.includes('frutos secos') ||
        q.includes('mani') || q.includes('salado')) {
      return {
        texto: `🥔 <strong>Snacks Salados para Botillerías y Almacenes:</strong><br><br>` +
               `• <strong>Ramitas:</strong> Sabor salado tradicional y sabor queso.<br>` +
               `• <strong>Papas Fritas y Snacks crujientes:</strong> Formatos personales y grandes para compartir.<br>` +
               `• <strong>Maní y Frutos Secos:</strong> Maní salado, con cáscara y mix de frutos secos listos para exhibir.<br><br>` +
               `Excelente complemento de alta rotación para acompañar bebidas y celebraciones.`,
        cta: {
          texto: '💬 Cotizar Snacks por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20snacks%20y%20ramitas`
        },
        chips: ['🍪 Galletas McKay y Costa', '🚬 Tabaco y Accesorios', '🚚 Zonas de Despacho']
      };
    }

    // 8. Papelillos OCB y Filtros
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
          texto: '💬 Cotizar OCB por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20papelillos%20y%20filtros%20OCB`
        },
        chips: ['🔥 Encendedores Clipper/Ronson', '🍂 Tabacos para Enrolar', '📄 Ver Catálogo']
      };
    }

    // 9. Encendedores Clipper, Ronson y Gas
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
          texto: '💬 Cotizar Clipper y Ronson por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20encendedores%20Clipper%20y%20Ronson`
        },
        chips: ['🚬 Papelillos OCB', '🍂 Tabacos (Captain Black, Tennessee)', '🔋 Pilas Duracell']
      };
    }

    // 10. Tabacos para Enrolar (Captain Black, Tennessee, Springfield, Roadhouse)
    if (q.includes('tabaco') || q.includes('captain black') || q.includes('tennessee') ||
        q.includes('springfield') || q.includes('roadhouse') || q.includes('liar') || q.includes('enrolar') || q.includes('cigarro')) {
      return {
        texto: `🍂 <strong>Tabacos para Liar de Primeras Marcas:</strong><br><br>` +
               `• <strong>Captain Black:</strong> Variedades Regular, Cherry y aromáticos en paquetes sellados.<br>` +
               `• <strong>Tennessee:</strong> Tabaco de excelente corte y aroma tradicional.<br>` +
               `• <strong>Springfield y Roadhouse:</strong> Opciones reconocidas por fumadores exigentes.<br><br>` +
               `📦 Paquetes oficiales con sellos legales vigentes. Consulta por compras en fardos y displays.`,
        cta: {
          texto: '💬 Cotizar Tabacos por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20tabacos%20Captain%20Black%20y%20Tennessee`
        },
        chips: ['🚬 Papelillos OCB y Filtros', '🔥 Encendedores Clipper', '🚚 Zonas de Despacho']
      };
    }

    // 11. Pilas Duracell y Eveready
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
          texto: '💬 Cotizar Pilas por WhatsApp',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20cotizar%20pilas%20Duracell%20y%20Eveready`
        },
        chips: ['🍫 Bon o Bon y Confites', '🛒 Abarrotes de Almacén', '📋 ¿Cómo Comprar?']
      };
    }

    // 12. Abarrotes y Consumo Masivo (Bristol, Kuroko, etc.)
    if (q.includes('abarrote') || q.includes('consumo') || q.includes('mercaderia') || q.includes('despensa') ||
        q.includes('kuroko') || q.includes('bristol') || q.includes('almacen')) {
      return {
        texto: `🛒 <strong>Abarrotes y Artículos de Consumo para Almacenes:</strong><br><br>` +
               `Trabajamos líneas seleccionadas de abarrotes de alta rotación (incluyendo marcas como <strong>Bristol</strong> y <strong>Kuroko</strong>):<br>` +
               `• Productos esenciales de despensa y colaciones.<br>` +
               `• Bebidas, té, café y jugos en polvo.<br>` +
               `• Artículos de rotación rápida para el vecino del barrio.<br><br>` +
               `Revisa las novedades en nuestro portal digital o solicita el catálogo al vendedor.`,
        cta: {
          texto: '🌐 Ver Catálogo Digital',
          url: TRIDENTE_KNOWLEDGE.catalogoDigital
        },
        chips: ['🍫 Bon o Bon y Chocolates', '🍪 Galletas McKay', '🚚 Métodos de Despacho']
      };
    }

    // 13. Zonas y Métodos de Despacho
    if (q.includes('despacho') || q.includes('envio') || q.includes('entrega') || q.includes('reparto') ||
        q.includes('donde entregan') || q.includes('zona') || q.includes('cobertura') || q.includes('ruta') ||
        q.includes('serena') || q.includes('coquimbo') || q.includes('ovalle') || q.includes('limari') ||
        q.includes('elqui') || q.includes('vicuna') || q.includes('paihuano')) {
      return {
        texto: `🚚 <strong>Zonas de Despacho y Cobertura de Distribuidora Tridente:</strong><br><br>` +
               `📍 <strong>La Serena y Coquimbo:</strong> Entregas periódicas y programadas dentro del radio urbano.<br>` +
               `📍 <strong>Ovalle y Provincia del Limarí:</strong> Rutas semanales directas para abastecer comerciantes.<br>` +
               `📍 <strong>Valle de Elqui y Alrededores:</strong> Entregas en Vicuña, Paihuano y localidades aledañas.<br><br>` +
               `<em>Nota:</em> Los días exactos de ruta y condiciones de entrega se coordinan al momento de confirmar el pedido con el área de despacho para que llegue directo a la puerta de tu local.`,
        cta: {
          texto: '💬 Coordinar Despacho a mi Negocio',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20consultar%20por%20la%20ruta%20de%20despacho%20para%20mi%20local`
        },
        chips: ['📋 ¿Cómo Comprar?', '🍫 Ver Productos', '📞 Contactar a Ventas']
      };
    }

    // 14. Cómo hacer un pedido / Métodos de compra
    if (q.includes('como comprar') || q.includes('como hago') || q.includes('hacer pedido') || q.includes('realizar pedido') ||
        q.includes('portal') || q.includes('pedidos') || q.includes('comprar') || q.includes('minimo') || q.includes('orden')) {
      return {
        texto: `Para comprar en <strong>Distribuidora Tridente</strong> tienes 2 opciones muy rápidas:<br><br>` +
               `1️⃣ <strong>Vía WhatsApp Directo:</strong> Escríbenos al <strong>${TRIDENTE_KNOWLEDGE.whatsappNumber}</strong> con tu lista de productos y datos de facturación.<br><br>` +
               `2️⃣ <strong>Portal Web de Pedidos 24 Horas:</strong> Ingresa a <a href="${TRIDENTE_KNOWLEDGE.portalPedidos}" target="_blank" rel="noopener">pedidos.distribuidoratridente.cl</a> para armar y gestionar tus compras a cualquier hora.<br><br>` +
               `🧾 <em>Emitimos facturación inmediata con RUT o boleta comercial.</em>`,
        cta: {
          texto: '🚀 Ir al Portal de Pedidos',
          url: TRIDENTE_KNOWLEDGE.portalPedidos
        },
        chips: ['💬 Escribir por WhatsApp', '🚚 Zonas de Despacho', '🍫 Ver Catálogo']
      };
    }

    // 15. Precios y Cotizaciones (Regla 3: No inventar precios)
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

    // 16. Contacto, Ubicación y Horarios
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
        chips: ['🍫 Catálogo Mayorista', '🚚 Despacho a Regiones', '📋 ¿Cómo Pedir?']
      };
    }

    // 17. Menú General de Categorías y Catálogo
    if (q.includes('catalogo') || q.includes('productos') || q.includes('que venden') || q.includes('que tienen') ||
        q.includes('categoria') || q.includes('menu')) {
      return {
        texto: `Distribuimos las principales marcas mayoristas en 5 grandes categorías:<br><br>` +
               `🍫 <strong>Confites y Chocolates:</strong> Bon o Bon, Arcor, Ambrosoli, Costa, Frugelé.<br>` +
               `🍪 <strong>Galletas y Snacks:</strong> McKay (Kuky, Criollitas, Vino), Costa (Tritón), ramitas y papas.<br>` +
               `🚬 <strong>Tabacos y Fumador:</strong> Papelillos OCB, encendedores Clipper/Ronson, tabacos Captain Black/Tennessee.<br>` +
               `🔋 <strong>Pilas y Energía:</strong> Duracell (alcalinas y botón) y Eveready.<br>` +
               `🛒 <strong>Abarrotes:</strong> Artículos seleccionados de rotación diaria.<br><br>` +
               `¿Sobre cuál te gustaría conocer más detalles?`,
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

    // 18. Facturación / Boleta / RUT
    if (q.includes('factura') || q.includes('boleta') || q.includes('rut') || q.includes('iva') || q.includes('empresa')) {
      return {
        texto: `Sí, en Distribuidora Tridente emitimos <strong>facturación inmediata con RUT</strong> para empresas y comerciantes, así como también boleta según requieras.<br><br>` +
               `Solo debes indicar tu RUT y razón social al momento de confirmar el pedido.`,
        cta: {
          texto: '💬 Coordinar Pedido con Factura',
          url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=Hola%20Distribuidora%20Tridente,%20quisiera%20hacer%20un%20pedido%20con%20factura`
        },
        chips: ['📋 ¿Cómo Comprar?', '🚚 Zonas de Despacho', '🍫 Ver Productos']
      };
    }

    // 19. Agradecimientos y despedidas
    if (q.includes('gracias') || q.includes('muchas gracias') || q.includes('vale') || q.includes('perfecto') ||
        q.includes('chao') || q.includes('adios') || q.includes('hasta luego')) {
      return {
        texto: `¡De nada! Ha sido un placer atenderte. En <strong>Distribuidora Tridente</strong> estamos listos para ser el mejor aliado de tu negocio. ¡Que tengas excelentes ventas! 🌟`,
        chips: ['💬 Hablar por WhatsApp', '📄 Ver Catálogo', '🚚 Despacho']
      };
    }

    // 20. Regla 5: Preguntas fuera del ámbito de la distribuidora
    if (q.includes('futbol') || q.includes('partido') || q.includes('deporte') || q.includes('politica') ||
        q.includes('chiste') || q.includes('clima') || q.includes('tiempo manana') || q.includes('musica') ||
        q.includes('cancion') || q.includes('pelicula') || q.includes('juego') || q.includes('videojuego') ||
        q.includes('presidente') || q.includes('quien eres') || q.includes('que eres') || q.includes('inteligencia artificial') ||
        q.includes('chatgpt') || q.includes('gemini') || q.includes('robot')) {
      return {
        texto: `Como asistente comercial oficial de <strong>Distribuidora Tridente</strong>, mi único propósito es atenderte con respecto a nuestro catálogo mayorista, confites, marcas, despachos y compras para tu negocio.<br><br>` +
               `¿Te gustaría consultar sobre nuestras líneas de Bon o Bon, chocolates, tabacos, pilas o zonas de entrega?`,
        chips: ['🍫 Bon o Bon y Confites', '🚬 OCB y Clipper', '🔋 Pilas Duracell', '🚚 Despacho']
      };
    }

    // 21. Regla 2 y 3: No inventar información ni productos que no estén explícitamente en la web
    return {
      texto: `No dispongo de esa información específica en este momento en nuestro catálogo público.<br><br>` +
             `Para entregarte una respuesta exacta sobre stock disponible, productos particulares o cotizaciones por mayor, te sugiero comunicarte directamente con nuestro equipo:`,
      cta: {
        texto: `💬 Consultar con un Ejecutivo por WhatsApp`,
        url: `${TRIDENTE_KNOWLEDGE.whatsappLink}?text=${encodeURIComponent('Hola Distribuidora Tridente, tengo una consulta: ' + mensajeUsuario)}`
      },
      chips: ['🍫 Catálogo Mayorista', '🚚 Zonas de Despacho', '📞 Contacto Oficial']
    };
  }

  // Creación y renderizado del widget en el DOM
  function inicializarVendedorTridente() {
    // Evitar duplicados
    if (document.getElementById('vendedorTridenteWidget')) return;

    // Inyectar HTML del widget (incluyendo backdrop móvil para óptima experiencia responsive)
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'vendedorTridenteWidget';
    widgetContainer.innerHTML = `
      <!-- Backdrop Oscuro para Móvil al abrir el chat -->
      <div class="vendedor-backdrop" id="vendedorBackdrop" aria-hidden="true"></div>

      <!-- Contenedor Flotante Vendedor Tridente (Ubicado ARRIBA de WhatsApp) -->
      <div class="vendedor-tridente-float" id="vendedorTridenteFloat">
        <!-- Nube / Speech Bubble ("Habla con un vendedor de Tridente") -->
        <div class="vendedor-cloud" id="vendedorCloud" role="button" tabindex="0" title="Abrir chat con Vendedor Tridente">
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

      <!-- Ventana de Chat Flotante Responsive -->
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
            <button type="button" class="vendedor-header-btn" id="vendedorChatReset" aria-label="Ver menú principal" title="Ver menú principal">🏠</button>
            <button type="button" class="vendedor-header-btn" id="vendedorChatClose" aria-label="Cerrar chat" title="Cerrar">✕</button>
          </div>
        </div>

        <!-- Mensajes -->
        <div class="vendedor-chat-messages" id="vendedorChatMessages">
          <!-- Mensaje de bienvenida inicial -->
          <div class="vendedor-msg vendedor-msg-bot">
            <div class="vendedor-msg-bubble">
              ¡Hola! 👋 Soy el <strong>Vendedor Tridente</strong>, tu asistente comercial oficial.<br><br>
              Estoy preparado para responderte sobre todo nuestro catálogo mayorista: alfajores <strong>Bon o Bon</strong>, chocolates Costa y Arcor, gomitas Frugelé, galletas McKay, papelillos OCB, encendedores Clipper, pilas Duracell y despachos para tu local.<br><br>
              ¿Qué productos te gustaría consultar hoy?
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
          <input type="text" id="vendedorChatInput" class="vendedor-chat-input" placeholder="Pregunta por Bon o Bon, OCB, despachos..." autocomplete="off" maxlength="250" />
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
