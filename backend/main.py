"""
CAMILA — Agente IA de Distribuidora Tridente
FastAPI backend en puerto 8015.

Funciones:
  - Chat con Gemini (google-genai) con reintentos y fallback automático de modelos
  - Consulta productos desde PostgreSQL (esquema bdtridente)
  - Recopila datos de contacto (celular + dirección) y habilita enlace directo a WhatsApp
"""

import os
import json
import logging
import uuid
import re
import time
import urllib.parse
from contextlib import asynccontextmanager
from typing import Optional
from dotenv import load_dotenv

import base64
import datetime
import psycopg2
import psycopg2.extras
import smtplib
from email.message import EmailMessage
from fastapi import FastAPI, HTTPException, Response, Request, BackgroundTasks
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types

# ---------------------------------------------------------------------------
# Configuración y Variables de Entorno
# ---------------------------------------------------------------------------
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("camila")

GEMINI_API_KEY  = os.environ["GEMINI_API_KEY"]
DB_HOST         = os.environ.get("DATABASE_HOST", "localhost")
DB_PORT         = int(os.environ.get("DATABASE_PORT", 5432))
DB_NAME         = os.environ.get("DATABASE_NAME", "postgres")
DB_SCHEMA       = os.environ.get("DATABASE_SCHEMA", "bdtridente")
DB_USER         = os.environ.get("DATABASE_USER", "postgres")
DB_PASSWORD     = os.environ.get("DATABASE_PASSWORD", "")
WHATSAPP_NUMBER = os.environ.get("WHATSAPP_NUMBER", "56944488407")
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "https://www.distribuidoratridente.cl,https://distribuidoratridente.cl,https://camila.distribuidoratridente.cl,https://pedidos.distribuidoratridente.cl,http://localhost,http://127.0.0.1",
    ).split(",")
    if o.strip()
]

# ---------------------------------------------------------------------------
# Gemini Client y Modelos con Fallback
# ---------------------------------------------------------------------------
gemini_client = genai.Client(api_key=GEMINI_API_KEY)
PRIMARY_MODEL = "gemini-3.1-flash-lite"
FALLBACK_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
]

def generate_with_fallback(contents: list, system_instruction: str) -> str:
    """Llama a Gemini con fallback rápido entre modelos en caso de error o sobrecarga."""
    last_exc = None
    for model_name in FALLBACK_MODELS:
        try:
            res = gemini_client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.4,
                    max_output_tokens=600,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                ),
            )
            if res and res.text:
                return res.text
        except Exception as exc:
            last_exc = exc
            log.warning("Modelo %s falló: %s", model_name, exc)
            continue
    if last_exc:
        raise last_exc
    return ""

# ---------------------------------------------------------------------------
# Sesiones en memoria {session_id: [Content, ...]}
# ---------------------------------------------------------------------------
sessions: dict[str, list] = {}

# ---------------------------------------------------------------------------
# Conexión PostgreSQL (Base de datos postgres, Esquema bdtridente)
# ---------------------------------------------------------------------------
def get_db():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        options=f"-c search_path={DB_SCHEMA},public",
        connect_timeout=10,
    )


def query_productos(termino: str, limit: int = 12) -> list[dict]:
    """Busca productos en {DB_SCHEMA}.productos por nombre, código o categoría."""
    sql = f"""
        SELECT
            p.codigo,
            p.nombre,
            c.nombre AS categoria,
            p.precio AS precio_unitario,
            p.tiene_caja,
            p.cantidad_caja,
            p.precio_caja,
            p.cantidad AS stock
        FROM {DB_SCHEMA}.productos p
        LEFT JOIN {DB_SCHEMA}.categorias c ON c.id = p.categoria_id
        WHERE
            p.activo = true
            AND p.eliminado_at IS NULL
            AND (
                p.nombre ILIKE %s
                OR c.nombre ILIKE %s
                OR p.codigo ILIKE %s
            )
        ORDER BY p.nombre
        LIMIT %s
    """
    pattern = f"%{termino}%"
    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, (pattern, pattern, pattern, limit))
                results = []
                for row in cur.fetchall():
                    item = dict(row)
                    if item.get("precio_unitario") is not None:
                        item["precio_unitario"] = int(item["precio_unitario"])
                    if item.get("precio_caja") is not None:
                        item["precio_caja"] = int(item["precio_caja"])
                    results.append(item)
                return results
    except Exception as exc:
        log.warning("DB query failed for '%s': %s", termino, exc)
        return []


def get_all_categorias() -> list[str]:
    """Retorna todas las categorías activas de la distribuidora."""
    sql = f"SELECT DISTINCT nombre FROM {DB_SCHEMA}.categorias WHERE activo = true AND eliminado_at IS NULL ORDER BY nombre"
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                return [r[0] for r in cur.fetchall()]
    except Exception as exc:
        log.warning("DB categorias failed: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Servicio de Envío de Cotizaciones por Correo Electrónico (SMTP)
# ---------------------------------------------------------------------------
def get_smtp_config():
    """Obtiene la configuración de SMTP directamente desde bdtridente.system_settings."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT smtp_host, smtp_port, smtp_username, smtp_password, smtp_from_email, smtp_from_name FROM {DB_SCHEMA}.system_settings LIMIT 1")
                row = cur.fetchone()
                if row and row[0] and row[2] and row[3]:
                    return {
                        "host": row[0],
                        "port": row[1] or 465,
                        "username": row[2],
                        "password": row[3],
                        "from_email": row[4] or row[2],
                        "from_name": row[5] or "Distribuidora Tridente",
                    }
    except Exception as exc:
        log.warning("No se pudo obtener configuración SMTP de BD: %s", exc)
    return None

def get_admin_recipients():
    """Obtiene los correos del equipo de ventas/administración que reciben copias de cotizaciones."""
    recipients = ["pedidos.tridente2026@gmail.com"]
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT correo FROM {DB_SCHEMA}.usuarios WHERE recibe_pedido = true")
                rows = cur.fetchall()
                for r in rows:
                    if r[0] and r[0] not in recipients:
                        recipients.append(r[0])
    except Exception as exc:
        log.warning("No se pudo obtener destinatarios administradores de BD: %s", exc)
    return recipients

def build_cotizacion_email_html(cliente_data: dict, productos_lista: list, folio: str) -> str:
    """Genera una plantilla HTML elegante para la cotización enviada por Camila."""
    nombre = cliente_data.get("nombre") or "Estimado/a Cliente"
    telefono = cliente_data.get("telefono") or "No indicado"
    direccion = cliente_data.get("direccion") or "Región de Coquimbo"
    correo = cliente_data.get("correo") or ""
    fecha_hoy = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")

    filas_html = ""
    subtotal_neto = 0

    if productos_lista:
        for idx, item in enumerate(productos_lista, 1):
            p_nombre = item.get("nombre", "Producto")
            p_cant = item.get("cantidad", 1)
            p_precio = item.get("precio_unitario", 0)
            p_sub = p_cant * p_precio
            subtotal_neto += p_sub
            filas_html += f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-size: 14px; color: #1e293b;">{idx}</td>
                <td style="padding: 10px 12px; font-size: 14px; font-weight: 600; color: #0f172a;">{p_nombre}</td>
                <td style="padding: 10px 12px; font-size: 14px; text-align: center; color: #334155;">{p_cant}</td>
                <td style="padding: 10px 12px; font-size: 14px; text-align: right; color: #334155;">${p_precio:,.0f}</td>
                <td style="padding: 10px 12px; font-size: 14px; text-align: right; font-weight: 700; color: #0369a1;">${p_sub:,.0f}</td>
            </tr>
            """.replace(",", ".")
    else:
        filas_html = """
        <tr>
            <td colspan="5" style="padding: 16px; text-align: center; color: #64748b; font-size: 14px;">
                Cotización general con lista de precios y catálogo mayorista adjunto.
            </td>
        </tr>
        """

    iva = int(round(subtotal_neto * 0.19))
    total = subtotal_neto + iva

    totales_box = ""
    if subtotal_neto > 0:
        totales_box = f"""
        <table style="width: 100%; max-width: 320px; margin-left: auto; margin-top: 16px; border-collapse: collapse;">
            <tr>
                <td style="padding: 6px 10px; color: #64748b; font-size: 14px;">Subtotal Neto:</td>
                <td style="padding: 6px 10px; text-align: right; font-weight: 600; font-size: 14px;">${subtotal_neto:,.0f}</td>
            </tr>
            <tr>
                <td style="padding: 6px 10px; color: #64748b; font-size: 14px;">IVA (19%):</td>
                <td style="padding: 6px 10px; text-align: right; font-weight: 600; font-size: 14px;">${iva:,.0f}</td>
            </tr>
            <tr style="border-top: 2px solid #0284c7; background: #f0f9ff;">
                <td style="padding: 8px 10px; font-weight: 700; font-size: 16px; color: #0c4a6e;">TOTAL:</td>
                <td style="padding: 8px 10px; text-align: right; font-weight: 800; font-size: 18px; color: #0284c7;">${total:,.0f}</td>
            </tr>
        </table>
        """.replace(",", ".")

    html = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;">
      <div style="max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #091e3a 0%, #0284c7 100%); padding: 24px 28px; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">Distribuidora Tridente</h1>
          <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">Cotización Mayorista Oficial • Emitida por Camila</p>
        </div>

        <!-- Info Folio -->
        <div style="padding: 24px 28px 16px; background: #fafafa; border-bottom: 1px solid #e2e8f0;">
          <table style="width: 100%;">
            <tr>
              <td>
                <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700;">Folio Cotización</span><br>
                <strong style="font-size: 18px; color: #0f172a;">{folio}</strong>
              </td>
              <td style="text-align: right;">
                <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700;">Fecha de Emisión</span><br>
                <span style="font-size: 14px; color: #334155;">{fecha_hoy}</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Datos Cliente -->
        <div style="padding: 20px 28px;">
          <h3 style="margin: 0 0 12px; font-size: 15px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Datos del Solicitante</h3>
          <table style="width: 100%; font-size: 14px; color: #334155;">
            <tr><td style="padding: 4px 0; width: 140px; color: #64748b;">Razón Social / Nombre:</td><td style="font-weight: 600; color: #0f172a;">{nombre}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Correo Electrónico:</td><td><a href="mailto:{correo}" style="color: #0284c7;">{correo}</a></td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Teléfono / Celular:</td><td>{telefono}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Dirección / Sector:</td><td>{direccion}</td></tr>
          </table>
        </div>

        <!-- Tabla Productos -->
        <div style="padding: 10px 28px 24px;">
          <h3 style="margin: 0 0 12px; font-size: 15px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Detalle de Productos Cotizados</h3>
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 10px 12px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">#</th>
                <th style="padding: 10px 12px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Producto</th>
                <th style="padding: 10px 12px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: center;">Cant.</th>
                <th style="padding: 10px 12px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: right;">Precio Unit.</th>
                <th style="padding: 10px 12px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {filas_html}
            </tbody>
          </table>

          {totales_box}
        </div>

        <!-- Banner Condiciones -->
        <div style="padding: 16px 28px; background: #e0f2fe; border-left: 4px solid #0284c7; margin: 0 28px 20px; border-radius: 4px;">
          <p style="margin: 0; font-size: 13px; color: #0369a1; line-height: 1.5;">
            <strong>📌 Condiciones Comerciales y Despacho:</strong><br>
            • Validez de esta cotización: <strong>72 horas</strong> a partir de su emisión.<br>
            • Pedido mínimo para despacho gratuito en ruta: <strong>$150.000 netos</strong> (+ IVA).<br>
            • Para coordinar despacho o activar su pedido, responda a este correo o comuníquese con su vendedor asignado.
          </p>
        </div>

        <!-- Footer -->
        <div style="padding: 20px 28px; background: #091e3a; color: #94a3b8; text-align: center; font-size: 12px;">
          <p style="margin: 0 0 6px; color: #e2e8f0; font-weight: 600;">Distribuidora Tridente — Venta Mayorista Exclusiva para Comerciantes</p>
          <p style="margin: 0 0 8px;">Región de Coquimbo • Catálogo online: <a href="https://pedidos.distribuidoratridente.cl/Public/Catalogo" style="color: #38bdf8;">pedidos.distribuidoratridente.cl</a></p>
          <p style="margin: 0; font-size: 11px; opacity: 0.8;">Atención generada automáticamente por Camila, asistente de ventas de Distribuidora Tridente.</p>
        </div>

      </div>
    </body>
    </html>
    """
    return html

def send_cotizacion_email_background(cliente_data: dict, productos_lista: list):
    """Tarea asíncrona para generar el folio, guardar en BD y enviar el correo con copia a ventas."""
    smtp_cfg = get_smtp_config()
    if not smtp_cfg:
        log.error("No hay servidor SMTP configurado para enviar la cotización.")
        return

    destinatario = (cliente_data.get("correo") or "").strip()
    if not destinatario or "@" not in destinatario:
        log.warning("Correo de cliente inválido: '%s'", destinatario)
        return

    # Generar folio único C-XXXXXX
    folio = f"C-{int(time.time()) % 1000000:06d}"
    
    # Calcular totales
    subtotal_neto = sum(p.get("cantidad", 1) * p.get("precio_unitario", 0) for p in productos_lista)
    iva = int(round(subtotal_neto * 0.19))
    total = subtotal_neto + iva

    # Guardar en Base de Datos
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {DB_SCHEMA}.cotizaciones_clientes (
                        folio, cliente_razon_social, cliente_rut, cliente_telefono, cliente_correo,
                        cliente_direccion, cliente_observaciones, fecha_vencimiento, subtotal_neto,
                        iva, total, total_items, productos, estado
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, NOW() + INTERVAL '72 hours', %s, %s, %s, %s, %s, 'emitida_camila'
                    ) ON CONFLICT (folio) DO NOTHING RETURNING id;
                """, (
                    folio,
                    cliente_data.get("nombre") or "Cliente Web",
                    cliente_data.get("rut") or "S/R",
                    cliente_data.get("telefono") or "",
                    destinatario,
                    cliente_data.get("direccion") or "",
                    f"Generada por Camila IA a través del chat web. Solicitud: {cliente_data.get('productos_solicitados', '')}",
                    subtotal_neto,
                    iva,
                    total,
                    len(productos_lista),
                    json.dumps(productos_lista, ensure_ascii=False)
                ))
            conn.commit()
            log.info("✓ Cotización %s guardada en BD para %s", folio, destinatario)
    except Exception as exc:
        log.warning("No se pudo guardar la cotización en BD: %s", exc)

    # Preparar el correo
    html_content = build_cotizacion_email_html(cliente_data, productos_lista, folio)
    admin_recipients = get_admin_recipients()

    msg = EmailMessage()
    msg["Subject"] = f"Cotización Oficial #{folio} — Distribuidora Tridente"
    msg["From"] = f"{smtp_cfg['from_name']} <{smtp_cfg['from_email']}>"
    msg["To"] = destinatario
    if admin_recipients:
        msg["Bcc"] = ", ".join(admin_recipients)
    msg.add_alternative(html_content, subtype="html")

    # Enviar correo vía SMTP SSL
    try:
        with smtplib.SMTP_SSL(smtp_cfg["host"], smtp_cfg["port"], timeout=20) as server:
            server.login(smtp_cfg["username"], smtp_cfg["password"])
            server.send_message(msg)
        log.info("📧 Cotización %s enviada con éxito a %s (Bcc: %s)", folio, destinatario, admin_recipients)
    except Exception as exc:
        log.error("Error al enviar cotización por SMTP a %s: %s", destinatario, exc)


def get_all_catalog_products() -> list[dict]:
    """Retorna el listado completo de productos activos para el cotizador web público."""
    now = time.time()
    if _catalog_cache["products"] and (now - _catalog_cache["last_fetched"] < 300):
        return _catalog_cache["products"]

    sql = f"""
        SELECT
            p.id,
            p.codigo,
            p.nombre,
            c.nombre AS categoria,
            p.precio AS precio_unitario,
            p.tiene_caja,
            p.cantidad_caja,
            p.precio_caja,
            p.afecto,
            (p.imagen_url IS NOT NULL AND length(p.imagen_url) > 20) AS has_image,
            p.cantidad AS stock
        FROM {DB_SCHEMA}.productos p
        LEFT JOIN {DB_SCHEMA}.categorias c ON c.id = p.categoria_id
        WHERE
            p.activo = true
            AND p.eliminado_at IS NULL
        ORDER BY c.nombre NULLS LAST, p.nombre
    """
    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql)
                results = []
                for row in cur.fetchall():
                    item = dict(row)
                    pid = str(item["id"])
                    item["id"] = pid
                    item["precio_unitario"] = int(item["precio_unitario"]) if item.get("precio_unitario") is not None else 0
                    item["precio_caja"] = int(item["precio_caja"]) if item.get("precio_caja") is not None else 0
                    if item.get("afecto") is None:
                        item["afecto"] = True
                    has_img = bool(item.get("has_image"))
                    item["imagen_url"] = f"/api/producto/{pid}/imagen" if has_img else None
                    results.append(item)
                _catalog_cache["products"] = results
                _catalog_cache["last_fetched"] = now
                return results
    except Exception as exc:
        log.warning("DB catalog query failed: %s", exc)
        return _catalog_cache.get("products", [])


STOP_WORDS = {
    "hola", "buenas", "tardes", "dias", "que", "qué", "tienen", "tienes", "venden", "vendes",
    "hay", "cuanto", "cuánto", "vale", "cuesta", "precio", "precios", "stock", "productos",
    "producto", "por", "favor", "de", "la", "el", "los", "las", "un", "una", "unos", "unas",
    "en", "y", "a", "para", "con", "me", "das", "da", "quisiera", "quiero", "saber", "si",
    "algún", "algun", "algunos", "algunas", "donde", "dónde", "atienden", "atiendes"
}

def extract_search_terms(text: str) -> list[str]:
    """Extrae palabras clave para buscar productos en la base de datos."""
    clean = re.sub(r"[^\w\s]", " ", text.lower())
    words = [w.strip() for w in clean.split() if len(w.strip()) >= 3]
    return [w for w in words if w not in STOP_WORDS]

# ---------------------------------------------------------------------------
# System Prompt de Camila
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """Eres Camila, la asistente virtual experta en ventas de Distribuidora Tridente, distribuidora mayorista en la Región de Coquimbo, Chile. Tu objetivo es orientar a los clientes, mostrar el catálogo y ayudarles a armar sus cotizaciones oficiales enviadas por correo electrónico.

## REGLAS ESTRICTAS Y OBLIGATORIAS (CUMPLIMIENTO ABSOLUTO)
1. NUNCA, bajo ninguna circunstancia, menciones, reveles ni calcules precios de productos directamente en el chat.
2. Si un cliente pregunta por un precio, solicita una cotización o quiere cotizar productos, infórmale amablemente que, por políticas de venta mayorista, las cotizaciones formales valorizadas se envían directamente a su correo electrónico.
3. Solicita siempre el correo electrónico del cliente para enviarle su cotización oficial. Si el cliente menciona productos o cantidades, anótalos para su cotización.
4. Cuando el cliente te proporcione su correo electrónico (y si mencionó productos o interés en cotizar):
   - Confírmale amablemente que su cotización formal ha sido procesada y que le llegará a su bandeja de entrada en los próximos minutos.
   - En ese mismo mensaje, DEBES generar al final un bloque JSON con la acción "emit_cotizacion" con los datos recopilados:
   ```json
   {
     "action": "emit_cotizacion",
     "correo": "correo_del_cliente@ejemplo.com",
     "nombre": "Nombre del cliente o negocio si lo dio, sino vacio",
     "telefono": "Telefono si lo dio, sino vacio",
     "direccion": "Direccion o ciudad si la dio, sino vacio",
     "productos_solicitados": "Lista o descripcion de productos consultados por el cliente"
   }
   ```
5. Si el cliente solo desea registrarse como cliente o hablar con un vendedor, o si solicita contacto por WhatsApp habiendo entregado datos:
   ```json
   {
     "action": "redirect_whatsapp",
     "razon_social": "Nombre o negocio",
     "correo": "correo@ejemplo.com",
     "celular": "numero si lo dio",
     "direccion": "ciudad si la dio"
   }
   ```
6. Si el cliente insiste en saber el precio por el chat, discúlpate cordialmente y reitera que tu sistema solo tiene habilitado el despacho de valores oficiales a través de la cotización formal por correo.

## IDENTIDAD Y TRATO (REGLA FUNDAMENTAL)
- Te presentas como Camila, asistente de ventas de Distribuidora Tridente.
- TRATO DE USTED FORMAL Y CORDIAL: Trate siempre al cliente de "usted" ("le puedo orientar", "su negocio", "su pedido", "en qué le ayudo").
- PROHIBIDO TUTEAR: Nunca use "tú", "te", "puedes", "tienes", "tu negocio".
- PROHIBIDO USAR MODISMOS VULGARES: NUNCA use "cómo tai", "po", "pa'", "te cacho", "bacán". Use español formal, cordial y claro.
- MODERACIÓN EN EMOJIS: Máximo 1 emoji discreto por respuesta o ninguno.
- RESPUESTAS CONCISAS: Respuestas breves (1 a 3 frases máximo), claras y directas.

## Sobre Distribuidora Tridente
- Distribuidora mayorista en la Región de Coquimbo.
- Productos principales: confites, chocolates, galletas, snacks, bebidas, jugos, abarrotes, tabacos, encendedores y accesorios.
- Pedido mínimo mayorista para despacho en ruta: $150.000 netos (+ IVA).
- Catálogo oficial con fotos y detalle de productos: https://pedidos.distribuidoratridente.cl/Public/Catalogo 
- Horario de atención: Lunes a viernes de 09:00 a 18:00 hrs.

## RUTAS Y DÍAS DE DESPACHO MAYORISTA
- La Serena y Coquimbo: Lunes a viernes (entregas diarias programadas en radio urbano).
- Ovalle y Provincia del Limarí: Martes y jueves.
- Valle de Elqui (Vicuña, Paihuano y alrededores): Miércoles.
- Provincia de Choapa (Salamanca, Illapel, Canela y Los Vilos): Viernes (rutas semanales directas).

## REGLAS DE CONVERSACIÓN
1. Si solo saludan ("hola", "buenas tardes", "buenos días"):
   "¡Hola! Buenas tardes, soy Camila, asistente de ventas de Distribuidora Tridente. ¿En qué le puedo orientar hoy?"
2. Enlaces limpios y no repetitivos:
   - NUNCA pegue un punto ni signo de puntuación al final de una URL.
   - Comparta el catálogo (https://pedidos.distribuidoratridente.cl/Public/Catalogo ) únicamente cuando el cliente consulte por productos o variedad disponible.
3. Si preguntan si tienen stock o disponibilidad de productos:
   Confirme la disponibilidad del producto y pregunte qué cantidad necesita y a qué correo electrónico le envía la cotización formal valorizada.
4. Si preguntan cómo comprar, ser cliente o armar cotización:
   "Con gusto le preparamos su cotización oficial. Por favor facilíteme su correo electrónico (y si gusta su nombre o local) para enviarle los valores detallados a su bandeja."
"""

# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
def init_db_tables():
    """Asegura que las tablas de cotizaciones existan en el esquema bdtridente."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(f"""
                    CREATE TABLE IF NOT EXISTS {DB_SCHEMA}.cotizaciones_clientes (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        folio VARCHAR(50) UNIQUE NOT NULL,
                        cliente_razon_social VARCHAR(255) NOT NULL,
                        cliente_rut VARCHAR(20) NOT NULL,
                        cliente_telefono VARCHAR(50) NOT NULL,
                        cliente_correo VARCHAR(255) NOT NULL,
                        cliente_direccion TEXT NOT NULL,
                        cliente_observaciones TEXT DEFAULT '',
                        fecha_emision TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        fecha_vencimiento TIMESTAMPTZ NOT NULL,
                        subtotal_neto NUMERIC(14, 2) DEFAULT 0,
                        subtotal_exento NUMERIC(14, 2) DEFAULT 0,
                        iva NUMERIC(14, 2) DEFAULT 0,
                        total NUMERIC(14, 2) NOT NULL,
                        total_items INTEGER DEFAULT 0,
                        total_unidades INTEGER DEFAULT 0,
                        productos JSONB NOT NULL DEFAULT '[]'::jsonb,
                        estado VARCHAR(50) DEFAULT 'emitida',
                        ip_origen VARCHAR(60),
                        user_agent TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_cotizaciones_clientes_rut ON {DB_SCHEMA}.cotizaciones_clientes(cliente_rut);
                    CREATE INDEX IF NOT EXISTS idx_cotizaciones_clientes_folio ON {DB_SCHEMA}.cotizaciones_clientes(folio);
                    CREATE INDEX IF NOT EXISTS idx_cotizaciones_clientes_fecha ON {DB_SCHEMA}.cotizaciones_clientes(fecha_emision);

                    CREATE TABLE IF NOT EXISTS {DB_SCHEMA}.cotizaciones_productos (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        cotizacion_id UUID NOT NULL REFERENCES {DB_SCHEMA}.cotizaciones_clientes(id) ON DELETE CASCADE,
                        cotizacion_folio VARCHAR(50) NOT NULL,
                        cliente_rut VARCHAR(20) NOT NULL,
                        cliente_razon_social VARCHAR(255) NOT NULL,
                        producto_id VARCHAR(100),
                        codigo_sku VARCHAR(50),
                        nombre_producto VARCHAR(255) NOT NULL,
                        tipo_empaque VARCHAR(50) DEFAULT 'unidad',
                        cantidad_caja INTEGER,
                        precio_unitario NUMERIC(14, 2) NOT NULL,
                        cantidad INTEGER NOT NULL DEFAULT 1,
                        subtotal NUMERIC(14, 2) NOT NULL,
                        afecto_iva BOOLEAN DEFAULT true,
                        fecha_cotizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_cotizaciones_productos_cot_id ON {DB_SCHEMA}.cotizaciones_productos(cotizacion_id);
                    CREATE INDEX IF NOT EXISTS idx_cotizaciones_productos_rut ON {DB_SCHEMA}.cotizaciones_productos(cliente_rut);
                    CREATE INDEX IF NOT EXISTS idx_cotizaciones_productos_fecha ON {DB_SCHEMA}.cotizaciones_productos(fecha_cotizacion);
                    CREATE INDEX IF NOT EXISTS idx_cotizaciones_productos_sku ON {DB_SCHEMA}.cotizaciones_productos(codigo_sku);
                """)
            conn.commit()
        log.info("✓ Tablas de cotizaciones listas en %s", DB_SCHEMA)
    except Exception as exc:
        log.warning("No se pudo verificar tablas de cotizaciones en BD: %s", exc)

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 Backend Camila iniciado en puerto 8015")
    init_db_tables()
    yield
    log.info("🛑 Backend Camila detenido")

app = FastAPI(title="Camila – Ventas Distribuidora Tridente", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https?://.*distribuidoratridente\.cl(:[0-9]+)?|https?://localhost(:[0-9]+)?|https?://127\.0\.0\.1(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    whatsapp_url: Optional[str] = None


class NewSessionResponse(BaseModel):
    session_id: str


class ClienteCotizacion(BaseModel):
    razon_social: str
    rut: str
    telefono: str
    correo: str
    direccion: str
    observaciones: Optional[str] = ""


class ProductoCotizado(BaseModel):
    id: Optional[str] = None
    codigo: Optional[str] = "S/C"
    nombre: str
    tipo_empaque: Optional[str] = "unidad"
    cantidad_caja: Optional[int] = None
    precio_unitario: float
    cantidad: int
    subtotal: float
    afecto: Optional[bool] = True


class TotalesCotizacion(BaseModel):
    subtotal_neto: float = 0
    subtotal_exento: float = 0
    iva: float = 0
    total: float
    total_items: int = 0
    total_unidades: int = 0


class VigenciaCotizacion(BaseModel):
    fecha_emision: Optional[str] = None
    fecha_vencimiento: Optional[str] = None


class GuardarCotizacionRequest(BaseModel):
    folio: str
    cliente: ClienteCotizacion
    totales: TotalesCotizacion
    vigencia: Optional[VigenciaCotizacion] = None
    productos: list[ProductoCotizado]

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    db_status = "connected"
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
    except Exception as exc:
        log.warning("Health check DB probe error: %s", exc)
        db_status = f"disconnected: {exc}"

    return {
        "status": "ok" if "disconnected" not in db_status else "degraded",
        "agent": "Camila",
        "port": int(os.environ.get("BACKEND_PORT", 8015)),
        "primary_model": PRIMARY_MODEL,
        "database": db_status,
    }


@app.post("/session", response_model=NewSessionResponse)
def new_session():
    sid = str(uuid.uuid4())
    sessions[sid] = []
    return {"session_id": sid}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, background_tasks: BackgroundTasks):
    sid = req.session_id or str(uuid.uuid4())
    if sid not in sessions:
        sessions[sid] = []

    history = sessions[sid]
    user_text = req.message.strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Mensaje vacío")

    # ── Enriquecimiento dinámico con Base de Datos ──
    user_lower = user_text.lower()
    terms = extract_search_terms(user_text)
    db_context = ""

    # Si pregunta por precios, cotizaciones, presupuestos o catálogo
    is_price_or_cotizar_q = any(
        phrase in user_lower
        for phrase in [
            "precio", "precios", "cuanto vale", "cuánto vale", "cuanto cuesta", "cuánto cuesta",
            "valor", "valores", "cotizar", "cotizacion", "cotización", "presupuesto",
            "armar cotizacion", "hacer cotizacion", "cotizador", "lista de precios", "catalogo", "catálogo"
        ]
    )
    # Si pregunta por categorías o productos en general
    is_general_products_q = any(
        phrase in user_lower
        for phrase in ["que productos", "qué productos", "que vendes", "qué vendes", "que tienes", "qué tienes", "categorias", "categorías"]
    )

    found_products = []
    if terms:
        seen_codes = set()
        for term in terms[:3]:
            rows = query_productos(term, limit=6)
            for r in rows:
                code = r.get("codigo")
                if code not in seen_codes:
                    seen_codes.add(code)
                    found_products.append(r)

    if is_price_or_cotizar_q and not terms:
        db_context = "\n\n[POLÍTICA DE PRECIOS: Recuerda la regla estricta: las cotizaciones valorizadas se envían exclusivamente por correo electrónico. Pide amablemente el correo para enviarle el documento oficial con los valores exactos]."
    elif is_general_products_q:
        categorias = get_all_categorias()
        db_context = f"\n\n[DATOS DE BASE DE DATOS: Categorías activas de la distribuidora: {', '.join(categorias)}. Catálogo completo en https://pedidos.distribuidoratridente.cl/Public/Catalogo . NUNCA des precios en el chat; ofrece enviar la cotización por correo]."
    elif terms:
        if found_products:
            db_context = (
                f"\n\n[DATOS DE BASE DE DATOS (tabla {DB_SCHEMA}.productos)]:\n"
                + json.dumps(found_products[:12], ensure_ascii=False, default=str)
                + "\n(REGLA ESTRICTA: Confirma disponibilidad del producto pero NUNCA reveles ni calcules precios en el chat. Solicita el correo del cliente para enviarle la cotización formal con los valores exactos)."
            )
        else:
            db_context = f"\n\n[DATOS DE BASE DE DATOS: No se encontraron productos coincidentes para: '{', '.join(terms)}'. Sugiere revisar el catálogo oficial https://pedidos.distribuidoratridente.cl/Public/Catalogo ]"

    # ── Construir historial para Gemini ──
    contents = list(history)
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part(text=user_text + db_context)]
        )
    )

    try:
        assistant_text = generate_with_fallback(contents, SYSTEM_PROMPT)
    except Exception as exc:
        log.error("Error al llamar a Gemini: %s", exc)
        raise HTTPException(status_code=502, detail=f"Error en servicio IA: {exc}")

    # Guardar en historial de sesión
    sessions[sid].append(
        types.Content(role="user", parts=[types.Part(text=user_text)])
    )
    sessions[sid].append(
        types.Content(role="model", parts=[types.Part(text=assistant_text)])
    )

    if len(sessions[sid]) > 40:
        sessions[sid] = sessions[sid][-30:]

    # ── Detectar acciones emit_cotizacion o redirect_whatsapp en la respuesta ──
    whatsapp_url: Optional[str] = None
    reply_clean = assistant_text

    # 1. Acción: emit_cotizacion (Cotización por correo enviada por Camila)
    try:
        cotiz_match = re.search(r'\{[^{}]*"action"\s*:\s*"emit_cotizacion"[^{}]*\}', assistant_text, re.DOTALL)
        if cotiz_match:
            json_str = cotiz_match.group(0)
            action_data = json.loads(json_str)
            correo_cliente = str(action_data.get("correo") or "").strip()
            if correo_cliente and "@" in correo_cliente:
                # Recopilar productos relevantes para la cotización
                prods_cotizados = []
                for p in found_products[:8]:
                    prods_cotizados.append({
                        "id": str(p.get("id") or ""),
                        "codigo": p.get("codigo", "S/C"),
                        "nombre": p.get("nombre", "Producto"),
                        "precio_unitario": float(p.get("precio_unitario") or 0),
                        "cantidad": 1,
                    })

                background_tasks.add_task(send_cotizacion_email_background, action_data, prods_cotizados)
                log.info("Tarea de envío de cotización por correo agendada para: %s", correo_cliente)

            reply_clean = reply_clean.replace(json_str, "")
            reply_clean = re.sub(r"```json\s*", "", reply_clean)
            reply_clean = re.sub(r"```\s*", "", reply_clean).strip()
    except Exception as exc:
        log.warning("No se pudo procesar acción emit_cotizacion: %s", exc)

    # 2. Acción: redirect_whatsapp
    try:
        json_match = re.search(r'\{[^{}]*"action"\s*:\s*"redirect_whatsapp"[^{}]*\}', reply_clean, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
            action_data = json.loads(json_str)
            razon_social = str(action_data.get("razon_social", "") or action_data.get("nombre", "")).strip()
            if razon_social.lower() in ["razon_social_o_vacio", "nombre_cliente_o_vacio", "nombre_cliente", "none", "null", "vacio"]:
                razon_social = ""
            rut = str(action_data.get("rut", "")).strip()
            if rut.lower() in ["rut_o_vacio", "none", "null", "vacio"]:
                rut = ""
            celular = str(action_data.get("celular", "")).strip()
            if celular.lower() in ["numero_celular", "numero_cliente", "none", "null", "vacio"]:
                celular = ""
            direccion = str(action_data.get("direccion", "")).strip()
            if direccion.lower() in ["direccion_o_sector", "direccion_cliente", "none", "null", "vacio"]:
                direccion = ""
            correo = str(action_data.get("correo", "") or action_data.get("email", "")).strip()
            if correo.lower() in ["correo_electronico", "email", "none", "null", "vacio"]:
                correo = ""

            lineas = ["¡Hola! Vengo desde la página web con Camila para registrarme como cliente y coordinar compras:"]
            if razon_social:
                lineas.append(f"• Razón Social / Negocio: {razon_social}")
            if rut:
                lineas.append(f"• RUT: {rut}")
            if celular:
                lineas.append(f"• Celular: {celular}")
            if direccion:
                lineas.append(f"• Dirección / Sector: {direccion}")
            if correo:
                lineas.append(f"• Correo: {correo}")
            lineas.append("Por favor coordinar alta de cliente y visita/contacto del vendedor.")

            wa_text = urllib.parse.quote("\n".join(lineas))
            whatsapp_url = f"https://wa.me/{WHATSAPP_NUMBER}?text={wa_text}"
            reply_clean = reply_clean.replace(json_str, "")
            reply_clean = re.sub(r"```json\s*", "", reply_clean)
            reply_clean = re.sub(r"```\s*", "", reply_clean).strip()
    except Exception as exc:
        log.warning("No se pudo parsear redirect_whatsapp: %s", exc)

    # Limpiar cualquier signo de puntuación pegado al final de una URL (evita error 404 por cotizar.html.)
    reply_clean = re.sub(r'(https?://[^\s<]+?)([.,!?;:]+)(?=\s|$|<)', r'\1', reply_clean)

    return ChatResponse(
        session_id=sid,
        reply=reply_clean,
        whatsapp_url=whatsapp_url,
    )


@app.delete("/session/{session_id}")
def delete_session(session_id: str):
    sessions.pop(session_id, None)
    return {"deleted": session_id}


# ---------------------------------------------------------------------------
# Endpoints para el Cotizador Web Público
# ---------------------------------------------------------------------------

@app.get("/api/productos")
def api_productos():
    """Retorna el listado completo de productos activos para el cotizador web."""
    return get_all_catalog_products()


@app.get("/api/categorias")
def api_categorias():
    """Retorna las categorías activas para el cotizador web."""
    return get_all_categorias()


@app.get("/api/producto/{product_id}/imagen")
def api_producto_imagen(product_id: str):
    """Retorna la imagen del producto en formato binario con caché HTTP de 7 días."""
    sql = f"SELECT imagen_url FROM {DB_SCHEMA}.productos WHERE id = %s AND activo = true LIMIT 1"
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (product_id,))
                row = cur.fetchone()
                if not row or not row[0]:
                    raise HTTPException(status_code=404, detail="Imagen no encontrada")

                raw = str(row[0]).strip()
                if raw.startswith("http://") or raw.startswith("https://"):
                    return RedirectResponse(raw)

                if "," in raw and "base64" in raw:
                    raw = raw.split(",", 1)[1]

                img_bytes = base64.b64decode(raw)
                return Response(
                    content=img_bytes,
                    media_type="image/jpeg",
                    headers={
                        "Cache-Control": "public, max-age=604800, immutable",
                        "Content-Type": "image/jpeg",
                    },
                )
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("Error al obtener imagen para producto %s: %s", product_id, exc)
        raise HTTPException(status_code=404, detail="Error al procesar imagen")


@app.post("/api/cotizaciones")
def guardar_cotizacion(req: GuardarCotizacionRequest, request: Request):
    """Guarda los datos del cliente, totales y productos cotizados con fechas."""
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        exp = now + datetime.timedelta(hours=72)

        fecha_emision = now
        fecha_vencimiento = exp

        if req.vigencia and req.vigencia.fecha_emision:
            try:
                # Intenta parsear si viene en ISO o string
                fecha_emision = datetime.datetime.fromisoformat(req.vigencia.fecha_emision.replace("Z", "+00:00"))
            except Exception:
                fecha_emision = now

        if req.vigencia and req.vigencia.fecha_vencimiento:
            try:
                fecha_vencimiento = datetime.datetime.fromisoformat(req.vigencia.fecha_vencimiento.replace("Z", "+00:00"))
            except Exception:
                fecha_vencimiento = exp

        ip_origen = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", "")

        productos_json = json.dumps([p.model_dump() for p in req.productos], ensure_ascii=False)


        with get_db() as conn:
            with conn.cursor() as cur:
                # 1. Comprobar si el folio ya existe para evitar inserciones masivas/duplicadas
                cur.execute(
                    f"SELECT id FROM {DB_SCHEMA}.cotizaciones_clientes WHERE folio = %s LIMIT 1",
                    (req.folio,)
                )
                existing = cur.fetchone()
                if existing:
                    log.info("ℹ Folio %s ya se encuentra registrado (id=%s). Retornando éxito sin duplicar.", req.folio, existing[0])
                    return {
                        "success": True,
                        "folio": req.folio,
                        "cotizacion_id": str(existing[0]),
                        "message": "Cotización ya registrada previamente",
                        "duplicated": True
                    }

                sql_cotizacion = f"""
                    INSERT INTO {DB_SCHEMA}.cotizaciones_clientes (
                        folio,
                        cliente_razon_social,
                        cliente_rut,
                        cliente_telefono,
                        cliente_correo,
                        cliente_direccion,
                        cliente_observaciones,
                        fecha_emision,
                        fecha_vencimiento,
                        subtotal_neto,
                        subtotal_exento,
                        iva,
                        total,
                        total_items,
                        total_unidades,
                        productos,
                        estado,
                        ip_origen,
                        user_agent
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (folio) DO NOTHING
                    RETURNING id;
                """

                cur.execute(
                    sql_cotizacion,
                    (
                        req.folio,
                        req.cliente.razon_social,
                        req.cliente.rut,
                        req.cliente.telefono,
                        req.cliente.correo,
                        req.cliente.direccion,
                        req.cliente.observaciones or "",
                        fecha_emision,
                        fecha_vencimiento,
                        req.totales.subtotal_neto,
                        req.totales.subtotal_exento,
                        req.totales.iva,
                        req.totales.total,
                        req.totales.total_items,
                        req.totales.total_unidades,
                        productos_json,
                        "emitida",
                        ip_origen,
                        user_agent,
                    )
                )
                row = cur.fetchone()
                if not row:
                    cur.execute(f"SELECT id FROM {DB_SCHEMA}.cotizaciones_clientes WHERE folio = %s", (req.folio,))
                    row = cur.fetchone()
                    return {
                        "success": True,
                        "folio": req.folio,
                        "cotizacion_id": str(row[0]) if row else "",
                        "message": "Cotización ya registrada previamente",
                        "duplicated": True
                    }
                cot_id = row[0]

                # Insertar detalle de cada producto cotizado
                sql_item = f"""
                    INSERT INTO {DB_SCHEMA}.cotizaciones_productos (
                        cotizacion_id,
                        cotizacion_folio,
                        cliente_rut,
                        cliente_razon_social,
                        producto_id,
                        codigo_sku,
                        nombre_producto,
                        tipo_empaque,
                        cantidad_caja,
                        precio_unitario,
                        cantidad,
                        subtotal,
                        afecto_iva,
                        fecha_cotizacion
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    );
                """

                for prod in req.productos:
                    cur.execute(
                        sql_item,
                        (
                            cot_id,
                            req.folio,
                            req.cliente.rut,
                            req.cliente.razon_social,
                            prod.id or "",
                            prod.codigo or "S/C",
                            prod.nombre,
                            prod.tipo_empaque or "unidad",
                            prod.cantidad_caja,
                            prod.precio_unitario,
                            prod.cantidad,
                            prod.subtotal,
                            prod.afecto if prod.afecto is not None else True,
                            fecha_emision,
                        )
                    )

            conn.commit()

        log.info("✓ Cotización guardada en BD: Folio=%s, Cliente=%s, Total=%s", req.folio, req.cliente.razon_social, req.totales.total)
        return {
            "success": True,
            "folio": req.folio,
            "cotizacion_id": str(cot_id),
            "message": "Cotización guardada exitosamente"
        }

    except Exception as exc:
        log.error("Error al guardar cotización: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error al guardar cotización: {exc}")


@app.get("/api/cotizaciones")
def listar_cotizaciones(limit: int = 50):
    """Lista las cotizaciones más recientes generadas desde la web."""
    sql = f"""
        SELECT
            id, folio, cliente_razon_social, cliente_rut, cliente_telefono, cliente_correo,
            cliente_direccion, fecha_emision, fecha_vencimiento, total, total_items, estado
        FROM {DB_SCHEMA}.cotizaciones_clientes
        ORDER BY fecha_emision DESC
        LIMIT %s
    """
    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, (limit,))
                rows = cur.fetchall()
                results = []
                for r in rows:
                    item = dict(r)
                    item["id"] = str(item["id"])
                    if item.get("total") is not None:
                        item["total"] = float(item["total"])
                    if item.get("fecha_emision"):
                        item["fecha_emision"] = item["fecha_emision"].isoformat()
                    if item.get("fecha_vencimiento"):
                        item["fecha_vencimiento"] = item["fecha_vencimiento"].isoformat()
                    results.append(item)
                return results
    except Exception as exc:
        log.warning("Error al listar cotizaciones: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Entrada Principal
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.environ.get("BACKEND_HOST", "0.0.0.0"),
        port=int(os.environ.get("BACKEND_PORT", 8015)),
        reload=False,
        log_level="info",
    )
