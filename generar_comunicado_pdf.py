import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

def generate_pdf(filename="Comunicado_Oficial_Cotizaciones_Camila_Tridente.pdf"):
    pdf_path = os.path.abspath(filename)
    # Margenes ajustados para encajar perfectamente en 1 página ejecutiva
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=20,
        bottomMargin=18
    )

    styles = getSampleStyleSheet()

    # Colores corporativos
    c_primary = colors.HexColor("#091E3A")      # Azul marino Tridente
    c_accent  = colors.HexColor("#0284C7")      # Celeste corporativo
    c_dark    = colors.HexColor("#0F172A")      # Texto oscuro
    c_muted   = colors.HexColor("#475569")      # Texto secundario
    c_card_bg = colors.HexColor("#F8FAFC")      # Fondo claro
    c_border  = colors.HexColor("#E2E8F0")      # Bordes

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=15,
        textColor=c_primary,
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=c_accent,
    )

    h2_style = ParagraphStyle(
        'Heading2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=9.5,
        textColor=c_primary,
        spaceBefore=3,
        spaceAfter=1,
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.8,
        leading=9.8,
        textColor=c_dark,
        spaceAfter=2,
    )

    bullet_style = ParagraphStyle(
        'BulletText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=c_dark,
    )

    box_text_style = ParagraphStyle(
        'BoxText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0369A1"),
    )

    footer_style = ParagraphStyle(
        'FooterText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=c_muted,
        alignment=1,
    )

    story = []

    # 1. Header con Logo y Datos de la Empresa
    logo_path = os.path.abspath("img/logo-tridente.png")
    logo_img = None
    if os.path.exists(logo_path):
        logo_img = Image(logo_path, width=1.2*inch, height=0.42*inch)

    header_text = [
        Paragraph("<b>DISTRIBUIDORA TRIDENTE SpA</b>", ParagraphStyle('HdrComp', fontName='Helvetica-Bold', fontSize=10, textColor=c_primary, alignment=2)),
        Paragraph("RUT: 77.892.456-1 • Región de Coquimbo, Chile", ParagraphStyle('HdrSub', fontName='Helvetica', fontSize=7.5, textColor=c_muted, alignment=2)),
        Paragraph("Venta Mayorista Exclusiva para Comerciantes", ParagraphStyle('HdrSub2', fontName='Helvetica-Bold', fontSize=7.5, textColor=c_accent, alignment=2)),
        Paragraph("Web: www.distribuidoratridente.cl", ParagraphStyle('HdrSub3', fontName='Helvetica', fontSize=7.5, textColor=c_muted, alignment=2)),
    ]

    header_table = Table([[logo_img if logo_img else "", header_text]], colWidths=[2.0*inch, 5.4*inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_accent, spaceBefore=4, spaceAfter=8))

    # 2. Título del Documento
    story.append(Paragraph("COMUNICADO OFICIAL Y RESUMEN EJECUTIVO", title_style))
    story.append(Paragraph("Ref.: Modernización del Sistema de Cotizaciones Mayoristas y Despacho Automatizado por Correo", subtitle_style))
    story.append(Spacer(1, 3))

    # 3. Metadatos del Documento
    meta_data = [
        [
            Paragraph("<b>Fecha de Emisión:</b> 30 de Octubre de 2026", body_style),
            Paragraph("<b>Emisor:</b> Gerencia Comercial & Operaciones", body_style),
        ],
        [
            Paragraph("<b>Dirigido a:</b> Clientes Mayoristas, Red de Ventas y Comerciantes", body_style),
            Paragraph("<b>Canal Oficial:</b> Asistente Virtual Camila (Web / SMTP)", body_style),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[3.7*inch, 3.7*inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_card_bg),
        ('BOX', (0,0), (-1,-1), 0.8, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.4, c_border),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 3))

    # 4. Contexto y Motivo
    story.append(Paragraph("1. Objetivo y Fundamento del Cambio", h2_style))
    story.append(Paragraph(
        "Distribuidora Tridente informa la actualización integral de sus canales de atención digital. "
        "Con el propósito de <b>resguardar la privacidad de las tarifas mayoristas</b>, evitar cotizaciones no autorizadas "
        "y brindar una atención personalizada e instantánea, se ha <b>desactivado el cotizador manual público</b> del sitio web "
        "y se ha centralizado el proceso de cotización formal a través de nuestra asistente virtual, <b>Camila</b>.",
        body_style
    ))

    # 5. Nuevo Flujo de Atención y Cotización
    story.append(Paragraph("2. Nuevo Protocolo de Cotización con Camila", h2_style))
    pasos_data = [
        [
            Paragraph("<b>Paso 1: Solicitud en el Chat</b>", ParagraphStyle('StepT', fontName='Helvetica-Bold', fontSize=7.5, textColor=c_primary)),
            Paragraph("El comerciante ingresa a <i>www.distribuidoratridente.cl</i>, abre el chat con Camila y solicita cotizar productos o marcas de interés.", bullet_style)
        ],
        [
            Paragraph("<b>Paso 2: Registro del Correo</b>", ParagraphStyle('StepT', fontName='Helvetica-Bold', fontSize=7.5, textColor=c_primary)),
            Paragraph("Por política mayorista, Camila solicita el correo electrónico del solicitante junto con su nombre o razón social.", bullet_style)
        ],
        [
            Paragraph("<b>Paso 3: Emisión Inmediata</b>", ParagraphStyle('StepT', fontName='Helvetica-Bold', fontSize=7.5, textColor=c_primary)),
            Paragraph("El sistema genera un <b>Folio Oficial correlativo (C-XXXXXX)</b> y calcula en segundo plano los valores netos, IVA (19%) y totales.", bullet_style)
        ],
        [
            Paragraph("<b>Paso 4: Envío por Correo Electrónico</b>", ParagraphStyle('StepT', fontName='Helvetica-Bold', fontSize=7.5, textColor=c_primary)),
            Paragraph("El cliente recibe automáticamente un correo formal con diseño corporativo y detalle de productos cotizados, con copia simultánea a ventas.", bullet_style)
        ],
    ]
    pasos_table = Table(pasos_data, colWidths=[2.0*inch, 5.4*inch])
    pasos_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFFFFF")),
        ('BOX', (0,0), (-1,-1), 0.8, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.4, c_border),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(pasos_table)
    story.append(Spacer(1, 3))

    # 6. Políticas Comerciales y Términos Clave
    story.append(Paragraph("3. Políticas Comerciales y Rutas de Despacho", h2_style))
    politicas_html = (
        "• <b>Validez de la Cotización:</b> Cada documento cuenta con una vigencia garantizada de <b>72 horas</b> desde su emisión.<br/>"
        "• <b>Pedido Mínimo Mayorista:</b> Despacho en ruta con entrega directa para pedidos desde <b>$150.000 netos (+ IVA)</b>.<br/>"
        "• <b>Rutas de Despacho Semanal:</b> "
        "<i>La Serena y Coquimbo:</i> Lunes a viernes • "
        "<i>Ovalle y Limarí:</i> Martes y jueves • "
        "<i>Valle de Elqui:</i> Miércoles • "
        "<i>Provincia de Choapa (Illapel, Salamanca, Los Vilos):</i> Viernes."
    )
    story.append(Paragraph(politicas_html, bullet_style))
    story.append(Spacer(1, 3))

    # 7. Cuadro de Aviso Destacado
    box_data = [[
        Paragraph(
            "<b>📌 AVISO CONFIDENCIALIDAD:</b> "
            "Los precios mayoristas no se revelan abiertamente en el chat público. "
            "Todo valor oficial se remite exclusivamente mediante el documento formal emitido a la casilla de correo del cliente.",
            box_text_style
        )
    ]]
    box_table = Table(box_data, colWidths=[7.4*inch])
    box_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#E0F2FE")),
        ('BOX', (0,0), (-1,-1), 0.8, colors.HexColor("#0284C7")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(box_table)
    story.append(Spacer(1, 3))

    # 8. Firma / Cierre
    firma_data = [
        [
            Paragraph("<b>Área Comercial</b><br/>Distribuidora Tridente SpA", ParagraphStyle('F1', fontName='Helvetica', fontSize=7.5, textColor=c_primary, alignment=1)),
            Paragraph("<b>Área de Sistemas e IA</b><br/>Agente Camila de Ventas", ParagraphStyle('F2', fontName='Helvetica', fontSize=7.5, textColor=c_primary, alignment=1)),
        ]
    ]
    firma_table = Table(firma_data, colWidths=[3.7*inch, 3.7*inch])
    firma_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(KeepTogether([
        firma_table,
        Spacer(1, 4),
        HRFlowable(width="100%", thickness=0.4, color=c_border, spaceBefore=2, spaceAfter=2),
        Paragraph("Distribuidora Tridente SpA • Casa Matriz: Región de Coquimbo • pedidos.tridente2026@gmail.com • www.distribuidoratridente.cl", footer_style)
    ]))

    doc.build(story)
    print(f"PDF generado exitosamente en: {pdf_path}")

if __name__ == "__main__":
    generate_pdf()
