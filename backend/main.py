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
import urllib.request
from contextlib import asynccontextmanager
from typing import Optional
from dotenv import load_dotenv

import base64
import datetime
import math
import psycopg2
import psycopg2.extras
import smtplib
from email.message import EmailMessage
from fastapi import FastAPI, HTTPException, Response, Request, BackgroundTasks, Query
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

# ---------------------------------------------------------------------------
# Evolution API — WhatsApp (compartido con pedidos.distribuidoratridente.cl)
# ---------------------------------------------------------------------------
EVOLUTION_API_URL           = (os.environ.get("EVOLUTION_API_URL") or "http://localhost:8080").rstrip("/")
EVOLUTION_API_GLOBAL_KEY    = os.environ.get("EVOLUTION_API_GLOBAL_KEY") or "tridente_global_secret_123"
WHATSAPP_INSTANCE_NAME      = os.environ.get("WHATSAPP_INSTANCE_NAME") or "tridente_ws"
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
PRIMARY_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
]

def generate_with_fallback(contents: list, system_instruction: str) -> str:
    """Llama a Gemini con fallback rápido entre modelos en caso de error o sobrecarga."""
    last_exc = None
    for model_name in FALLBACK_MODELS:
        for attempt in range(2):
            try:
                res = gemini_client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.3,
                        max_output_tokens=280,
                    ),
                )
                if res and res.text:
                    return res.text
            except Exception as exc:
                last_exc = exc
                err_str = str(exc)
                log.warning("Modelo %s (intento %d) falló: %s", model_name, attempt + 1, err_str[:120])
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    break
                time.sleep(0.3)
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


SYNONYMS = {
    "cigarro": ["kent", "lucky", "pall mall", "marlboro", "atlas", "latinos", "philip morris", "chesterfield", "tabaco"],
    "cigarros": ["kent", "lucky", "pall mall", "marlboro", "atlas", "latinos", "philip morris", "chesterfield", "tabaco"],
    "cigarrillo": ["kent", "lucky", "pall mall", "marlboro", "atlas", "latinos", "philip morris", "chesterfield", "tabaco"],
    "cigarrillos": ["kent", "lucky", "pall mall", "marlboro", "atlas", "latinos", "philip morris", "chesterfield", "tabaco"],
    "pucho": ["kent", "lucky", "pall mall", "marlboro", "atlas", "latinos"],
    "puchos": ["kent", "lucky", "pall mall", "marlboro", "atlas", "latinos"],
    "tabaco": ["captain black", "bristol", "ocb", "clipper", "tabaco"],
    "tabacos": ["captain black", "bristol", "ocb", "clipper", "tabaco"],
    "dulce": ["confites", "caramelo", "chocolate", "gomita"],
    "dulces": ["confites", "caramelo", "chocolate", "gomita"],
    "chocolate": ["chocolate", "vizzio", "costa", "arcor", "ambrosoli", "sahne nuss", "chocman"],
    "chocolates": ["chocolate", "vizzio", "costa", "arcor", "ambrosoli", "sahne nuss", "chocman"],
    "galleta": ["galleta", "mckay", "costa", "arcor", "triton", "oreo", "morochas"],
    "galletas": ["galleta", "mckay", "costa", "arcor", "triton", "oreo", "morochas"],
    "snack": ["snack", "papas", "ramitas", "lays", "evercrisp", "doritos", "salado"],
    "snacks": ["snack", "papas", "ramitas", "lays", "evercrisp", "doritos", "salado"],
    "pila": ["pila", "duracell", "eveready", "bateria"],
    "pilas": ["pila", "duracell", "eveready", "bateria"],
    "bateria": ["pila", "duracell", "eveready", "bateria"],
    "baterias": ["pila", "duracell", "eveready", "bateria"],
    "encendedor": ["clipper", "encendedor", "gas", "ronson"],
    "encendedores": ["clipper", "encendedor", "gas", "ronson"],
    "papelillo": ["ocb", "papelillo", "tabaco"],
    "papelillos": ["ocb", "papelillo", "tabaco"],
    "filtro": ["filtro", "ocb", "tabaco"],
    "filtros": ["filtro", "ocb", "tabaco"],
    "vapo": ["vaporizador", "vape", "vapo", "pod"],
    "vaporizador": ["vaporizador", "vape", "vapo", "pod"],
    "vaporizadores": ["vaporizador", "vape", "vapo", "pod"],
}


def query_productos(termino: str, limit: int = 12) -> list[dict]:
    """Busca productos en {DB_SCHEMA}.productos por nombre, código o categoría con sinónimos y fallback garantizado."""
    term_clean = (termino or "").lower().strip()
    if not term_clean:
        return []

    search_variants = SYNONYMS.get(term_clean, [term_clean])
    results = []
    seen_codes = set()

    # 1. Intentar consulta en Base de Datos PostgreSQL
    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                for variant in search_variants[:8]:
                    pattern = f"%{variant}%"
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
                    cur.execute(sql, (pattern, pattern, pattern, limit))
                    for row in cur.fetchall():
                        item = dict(row)
                        # Descartar puritos si el cliente no pidió puritos expresamente
                        if "purito" in str(item.get("nombre") or "").lower() and "purito" not in term_clean:
                            continue
                        code = item.get("codigo")
                        if code not in seen_codes:
                            seen_codes.add(code)
                            if item.get("precio_unitario") is not None:
                                item["precio_unitario"] = int(item["precio_unitario"])
                            if item.get("precio_caja") is not None:
                                item["precio_caja"] = int(item["precio_caja"])
                            results.append(item)
                            if len(results) >= limit:
                                return results
                if results:
                    return results
    except Exception as exc:
        log.warning("DB query failed for '%s': %s", termino, exc)

    # 2. Fallback a catálogo precargado en memoria (_catalog_cache)
    all_prods = _catalog_cache.get("products") or load_fallback_catalog()
    for variant in search_variants:
        for p in all_prods:
            code = p.get("codigo")
            if code in seen_codes:
                continue
            nom = str(p.get("nombre") or "").lower()
            cat = str(p.get("categoria") or "").lower()
            cod = str(p.get("codigo") or "").lower()
            if "purito" in nom and "purito" not in term_clean:
                continue
            if variant in nom or variant in cat or variant in cod:
                seen_codes.add(code)
                results.append({
                    "codigo": p.get("codigo"),
                    "nombre": p.get("nombre"),
                    "categoria": p.get("categoria"),
                    "precio_unitario": p.get("precio_unitario"),
                    "tiene_caja": p.get("tiene_caja", True),
                    "cantidad_caja": p.get("cantidad_caja"),
                    "precio_caja": p.get("precio_caja"),
                    "stock": p.get("stock", 999),
                })
                if len(results) >= limit:
                    return results

    return results


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
    """Obtiene la configuración de SMTP desde variables de entorno o desde bdtridente.system_settings."""
    env_host = os.environ.get("SMTP_HOST")
    if env_host == "s550.v2nets.com":
        env_host = "s560.v2nets.com"
    env_port = int(os.environ.get("SMTP_PORT", 465))
    env_user = os.environ.get("SMTP_USERNAME") or os.environ.get("SMTP_USER")
    env_pass = os.environ.get("SMTP_PASSWORD") or os.environ.get("SMTP_PASS")
    if env_pass in ["tu_password_smtp_aqui", ""]:
        env_pass = None
    env_from = os.environ.get("SMTP_FROM_EMAIL") or env_user
    env_name = os.environ.get("SMTP_FROM_NAME") or "Distribuidora Tridente"

    if env_host and env_user and env_pass:
        return {
            "host": env_host,
            "port": env_port,
            "username": env_user,
            "password": env_pass,
            "from_email": env_from,
            "from_name": env_name,
        }

    # Si falta la contraseña en .env, consultar la tabla system_settings de PostgreSQL
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT smtp_host, smtp_port, smtp_username, smtp_password, smtp_from_email, smtp_from_name FROM {DB_SCHEMA}.system_settings LIMIT 1")
                row = cur.fetchone()
                if row:
                    host = row[0] or env_host or "s560.v2nets.com"
                    port = row[1] or env_port or 465
                    user = row[2] or env_user or "pedidos@correotridente.cl"
                    password = row[3] or env_pass
                    from_email = row[4] or env_from or user
                    from_name = row[5] or env_name or "Distribuidora Tridente"
                    if host and user and password:
                        return {
                            "host": host,
                            "port": port,
                            "username": user,
                            "password": password,
                            "from_email": from_email,
                            "from_name": from_name,
                        }
    except Exception as exc:
        log.warning("No se pudo obtener configuración SMTP de BD: %s", exc)
    return None

ADMIN_ROL_ID = "29f48a5a-623c-4677-a8b8-e9c848165595"

def get_admin_notification_destinatarios() -> tuple[list[dict], list[str]]:
    """Paso A: Obtiene los administradores activos configurados para recibir alertas de Camila.
    Ejecuta:
      SELECT nombre, correo, celular, recibe_camila_whatsapp, recibe_camila_email
      FROM bdtridente.usuarios
      WHERE activo = true
        AND (recibe_camila_whatsapp = true OR recibe_camila_email = true);
    Retorna:
      - whatsapp_dest: list de dicts {"nombre": str, "celular": "569...", "raw": "+569..."}
      - email_dest: list de strings ["correo@ejemplo.com", ...]
    """
    whatsapp_dest = []
    email_dest = []
    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(f"""
                    SELECT nombre, correo, celular, recibe_camila_whatsapp, recibe_camila_email
                    FROM {DB_SCHEMA}.usuarios
                    WHERE activo = true
                      AND (recibe_camila_whatsapp = true OR recibe_camila_email = true);
                """)
                rows = cur.fetchall()
                for r in rows:
                    # Filtro WhatsApp: recibe_camila_whatsapp = true y celular no nulo
                    if r.get("recibe_camila_whatsapp"):
                        raw_cel = (r.get("celular") or "").strip()
                        clean_phone = format_chile_phone(raw_cel)
                        if clean_phone:
                            raw_formatted = raw_cel if raw_cel.startswith("+") else f"+{clean_phone}"
                            whatsapp_dest.append({
                                "nombre": r.get("nombre") or "Administrador",
                                "celular": clean_phone,
                                "raw": raw_formatted
                            })
                    # Filtro Email: recibe_camila_email = true y correo válido
                    if r.get("recibe_camila_email"):
                        raw_email = (r.get("correo") or "").strip()
                        if raw_email and "@" in raw_email and raw_email not in email_dest:
                            email_dest.append(raw_email)
    except Exception as exc:
        log.warning("No se pudo obtener destinatarios administradores de BD: %s", exc)

    if not email_dest:
        email_dest = ["pedidos.tridente2026@gmail.com"]

    return whatsapp_dest, email_dest


def get_admin_recipients() -> list[str]:
    """Obtiene los correos de administradores configurados para recibir alertas."""
    _, emails = get_admin_notification_destinatarios()
    return emails


def get_admin_whatsapp_recipients() -> list[dict]:
    """Retorna lista de {celular, nombre, raw} de administradores con recibe_camila_whatsapp=true."""
    wa, _ = get_admin_notification_destinatarios()
    return wa


def format_chile_phone(raw: str) -> str:
    """Normaliza un número telefónico chileno al formato 569XXXXXXXX para Evolution API.
    - Limpia espacios, guiones y caracteres no numéricos.
    - 9 dígitos -> antepone '56'
    - 8 dígitos -> antepone '569'
    - 11+ dígitos comenzando con 56 -> usar tal cual
    """
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return ""
    # Quitar prefijo internacional si ya viene con 00 o +
    if digits.startswith("00"):
        digits = digits[2:]
    if len(digits) == 9:          # ej: 912345678
        return "56" + digits
    if len(digits) == 8:          # ej: 12345678
        return "569" + digits
    if len(digits) >= 11 and digits.startswith("56"):
        return digits[:11]        # mantener 56XXXXXXXXX
    if len(digits) >= 10 and digits.startswith("9"):
        return "56" + digits[:9]
    return digits                 # devolver lo que venga


def send_whatsapp_notifications(
    cliente_data: dict,
    transcript_text: str = "",
    recipients: Optional[list[dict]] = None,
    total_estimado: Optional[float] = None
) -> tuple[bool, str]:
    """Paso B: Envía notificación WhatsApp a los administradores calificados.
    Retorna (enviado_whatsapp: bool, destinatarios_str: str).
    """
    if recipients is None:
        recipients, _ = get_admin_notification_destinatarios()

    destinatarios_todos = [d.get("raw") or f"+{d['celular']}" for d in recipients] if recipients else []

    if not recipients:
        log.info("No hay administradores con recibe_camila_whatsapp=true — omitiendo WhatsApp.")
        return False, ""

    if not EVOLUTION_API_URL or not EVOLUTION_API_GLOBAL_KEY:
        log.info("Evolution API no configurada — omitiendo envío WhatsApp de lead.")
        return False, ", ".join(destinatarios_todos)

    razon_social  = (cliente_data.get("razon_social") or cliente_data.get("nombre") or "Cliente Web").strip()
    whatsapp_cl   = (cliente_data.get("whatsapp") or cliente_data.get("celular") or "No indicado").strip()
    correo_cl     = (cliente_data.get("correo") or cliente_data.get("email") or "No indicado").strip()
    pedido        = (cliente_data.get("productos_solicitados") or "Registro / consulta web").strip()

    try:
        import zoneinfo
        tz = zoneinfo.ZoneInfo("America/Santiago")
        now = datetime.datetime.now(tz)
    except Exception:
        now = datetime.datetime.utcnow() - datetime.timedelta(hours=3)
    fecha_hora_cl = now.strftime("%d/%m/%Y %H:%M")

    seccion_total = ""
    if total_estimado and total_estimado > 0:
        seccion_total = f"\n💰 *Total estimado:* ${int(total_estimado):,} (IVA incluido)\n"

    seccion_transcripcion = ""
    if transcript_text and transcript_text.strip():
        texto_t = transcript_text.strip()
        if len(texto_t) > 3000:
            texto_t = "...\n" + texto_t[-3000:]
        seccion_transcripcion = (
            f"\n\n💬 *Conversación completa:*\n"
            f"```\n{texto_t}\n```"
        )

    mensaje = (
        f"🤖 *NUEVO PROSPECTO / VENTA - CAMILA IA*\n"
        f"*Distribuidora Tridente*\n\n"
        f"🏢 *Razón Social / Cliente:* {razon_social}\n"
        f"📱 *WhatsApp:* {whatsapp_cl}\n"
        f"📧 *Correo:* {correo_cl}\n\n"
        f"📝 *Detalle de la consulta / productos:*\n{pedido}"
        f"{seccion_total}"
        f"{seccion_transcripcion}\n\n"
        f"⏰ *Fecha y hora:* {fecha_hora_cl}"
    )

    endpoint = f"{EVOLUTION_API_URL}/message/sendText/{WHATSAPP_INSTANCE_NAME}"
    headers  = {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_GLOBAL_KEY,
    }

    enviado_al_menos_uno = False
    destinatarios_enviados = []

    for dest in recipients:
        payload = json.dumps({
            "number": dest["celular"],
            "text":   mensaje,
            "delay":  1200,
        }).encode("utf-8")

        try:
            req = urllib.request.Request(endpoint, data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=15) as resp:
                status = resp.getcode()
                body   = resp.read().decode("utf-8", errors="replace")[:300]
            if status in (200, 201):
                enviado_al_menos_uno = True
                destinatarios_enviados.append(dest.get("raw") or f"+{dest['celular']}")
                log.info("📱 WhatsApp enviado a %s (%s): HTTP %s", dest["nombre"], dest["celular"], status)
            else:
                log.warning("📱 WhatsApp resp inesperada %s a %s: %s", status, dest["celular"], body)
        except Exception as exc:
            log.warning("📱 Error al enviar WhatsApp a %s (%s): %s", dest["nombre"], dest["celular"], exc)

    destinatarios_str = ", ".join(destinatarios_enviados) if destinatarios_enviados else ", ".join(destinatarios_todos)
    return enviado_al_menos_uno, destinatarios_str


def save_camila_log(
    razon_social: str,
    whatsapp: str,
    correo: str,
    resumen: str,
    conversacion: str,
    total_estimado: Optional[float],
    enviado_whatsapp: bool,
    enviado_email: bool,
    destinatarios_whatsapp: str,
    destinatarios_email: str,
    estado: str = "COMPLETADA",
    origen: str = "WEB_CAMILA"
) -> Optional[str]:
    """Paso C: Inserta el registro de la venta o cotización en bdtridente.camila_logs (SQL directo).
    Fallback HTTP a pedidos.distribuidoratridente.cl/api/camila/logs si la BD local fallase.
    """
    wa_clean = format_chile_phone(whatsapp) if whatsapp else ""
    wa_cliente = f"+{wa_clean}" if wa_clean else (whatsapp or "")

    sql = f"""
        INSERT INTO {DB_SCHEMA}.camila_logs (
            razon_social,
            whatsapp,
            correo,
            resumen,
            conversacion,
            total_estimado,
            enviado_whatsapp,
            enviado_email,
            destinatarios_whatsapp,
            destinatarios_email,
            estado,
            origen,
            created_at,
            updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
        ) RETURNING id;
    """
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (
                    (razon_social or "Cliente Web")[:255],
                    wa_cliente[:50] if wa_cliente else None,
                    correo[:255] if correo else None,
                    resumen or "Cotización o registro web",
                    conversacion or "",
                    float(total_estimado) if total_estimado is not None and total_estimado > 0 else None,
                    bool(enviado_whatsapp),
                    bool(enviado_email),
                    destinatarios_whatsapp or "",
                    destinatarios_email or "",
                    estado or "COMPLETADA",
                    origen or "WEB_CAMILA"
                ))
                new_id = cur.fetchone()[0]
            conn.commit()
            log.info("✓ Log Camila guardado en bdtridente.camila_logs con ID: %s (%s)", new_id, razon_social)
            return str(new_id)
    except Exception as exc:
        log.error("Error al guardar en bdtridente.camila_logs vía SQL: %s. Intentando HTTP fallback...", exc)
        # Fallback HTTP REST a pedidos.distribuidoratridente.cl
        try:
            payload = json.dumps({
                "razon_social": razon_social or "Cliente Web",
                "whatsapp": wa_cliente,
                "correo": correo,
                "resumen": resumen or "Cotización o registro web",
                "conversacion": conversacion or "",
                "total_estimado": float(total_estimado) if total_estimado is not None else 0.0,
                "enviado_whatsapp": bool(enviado_whatsapp),
                "enviado_email": bool(enviado_email),
                "destinatarios_whatsapp": destinatarios_whatsapp,
                "destinatarios_email": destinatarios_email,
                "estado": estado,
                "origen": origen
            }).encode("utf-8")
            req = urllib.request.Request(
                "https://pedidos.distribuidoratridente.cl/api/camila/logs",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                log.info("✓ Log Camila guardado vía HTTP fallback: HTTP %s", resp.getcode())
        except Exception as http_exc:
            log.warning("No se pudo enviar log Camila por HTTP fallback: %s", http_exc)
    return None

def format_conversation_transcript(history: list) -> str:
    """Formatea la conversación completa en texto plano con el formato solicitado:
    Cliente: hola
    Camila: Hola
    """
    lines = []
    for item in history:
        role = getattr(item, "role", "")
        parts = getattr(item, "parts", [])
        text = ""
        for p in parts:
            t = getattr(p, "text", "")
            if t:
                # Limpiar cualquier bloque JSON interno o instrucciones técnicas
                t_clean = re.sub(r"```json.*?```", "", t, flags=re.DOTALL)
                t_clean = re.sub(r'\{[^{}]*"action"\s*:\s*"[^"]*"[^{}]*\}', "", t_clean, flags=re.DOTALL)
                t_clean = re.sub(r"\[(?:DATOS|INSTRUCCIÓN|POLÍTICA|Horario|PRODUCTOS|CONTEXTO).*?\]", "", t_clean, flags=re.DOTALL).strip()
                if t_clean:
                    text = t_clean
        if not text:
            continue
        if role == "user":
            lines.append(f"Cliente: {text}")
        elif role == "model":
            lines.append(f"Camila: {text}")
    return "\n".join(lines)

def build_cotizacion_email_html(cliente_data: dict, productos_lista: list, folio: str, transcript_text: str = "") -> str:
    """Genera una plantilla HTML elegante para la cotización enviada por Camila."""
    razon_social = (
        cliente_data.get("razon_social")
        or cliente_data.get("nombre")
        or cliente_data.get("empresa")
        or "Cliente Web"
    ).strip()
    whatsapp = (
        cliente_data.get("whatsapp")
        or cliente_data.get("celular")
        or cliente_data.get("telefono")
        or "No indicado"
    ).strip()
    correo = (
        cliente_data.get("correo")
        or cliente_data.get("email")
        or "No indicado"
    ).strip()
    pedido = (
        cliente_data.get("productos_solicitados")
        or cliente_data.get("pedido")
        or "Registro de nuevo cliente mayorista / Consulta de productos en catálogo"
    ).strip()
    direccion = (cliente_data.get("direccion") or "Región de Coquimbo").strip()
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
        filas_html = f"""
        <tr>
            <td colspan="5" style="padding: 16px; text-align: left; color: #1e293b; font-size: 14px; line-height: 1.5;">
                <strong>Detalle informado en la conversación:</strong><br>{pedido}
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

    # Sección de historial de conversación
    transcripcion_html = ""
    if transcript_text:
        transcripcion_html = f"""
        <!-- Historial Completo de Conversación -->
        <div style="padding: 20px 28px; background: #f8fafc; border-top: 2px solid #e2e8f0;">
          <h3 style="margin: 0 0 10px; font-size: 15px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Historial Completo de la Conversación</h3>
          <pre style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px 20px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 13px; line-height: 1.7; color: #1e293b; white-space: pre-wrap; margin: 0;">{transcript_text}</pre>
        </div>
        """

    html = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;">
      <div style="max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #091e3a 0%, #0284c7 100%); padding: 24px 28px; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">Distribuidora Tridente</h1>
          <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">Nueva Cotización / Solicitud Web • Camila Ventas</p>
        </div>

        <!-- Info Folio -->
        <div style="padding: 24px 28px 16px; background: #fafafa; border-bottom: 1px solid #e2e8f0;">
          <table style="width: 100%;">
            <tr>
              <td>
                <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700;">Folio</span><br>
                <strong style="font-size: 18px; color: #0f172a;">{folio}</strong>
              </td>
              <td style="text-align: right;">
                <span style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700;">Fecha de Solicitud</span><br>
                <span style="font-size: 14px; color: #334155;">{fecha_hoy}</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Datos Cliente -->
        <div style="padding: 20px 28px;">
          <h3 style="margin: 0 0 12px; font-size: 15px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Datos del Contacto / Negocio</h3>
          <table style="width: 100%; font-size: 14px; color: #334155; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; width: 180px; color: #64748b; font-weight: 600;">Razón Social / Negocio:</td><td style="font-weight: 700; color: #0f172a; font-size: 16px;">{razon_social}</td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b; font-weight: 600;">WhatsApp / Celular:</td><td style="font-weight: 700; color: #16a34a; font-size: 15px;"><a href="tel:{whatsapp}" style="color: #16a34a; text-decoration: none;">{whatsapp}</a></td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Correo Electrónico:</td><td style="font-weight: 600;"><a href="mailto:{correo}" style="color: #0284c7; text-decoration: none;">{correo}</a></td></tr>
            <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 0; color: #64748b; font-weight: 600; vertical-align: top;">Pedido / Solicitud:</td><td style="color: #0f172a; font-weight: 600; line-height: 1.5;">{pedido}</td></tr>
            <tr><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Zona / Cobertura:</td><td>{direccion}</td></tr>
          </table>
        </div>

        <!-- Tabla Productos -->
        <div style="padding: 10px 28px 24px;">
          <h3 style="margin: 0 0 12px; font-size: 15px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Detalle de Productos / Solicitud</h3>
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 10px 12px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">#</th>
                <th style="padding: 10px 12px; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Producto / Requerimiento</th>
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

        <!-- Transcripción de la conversación -->
        {transcripcion_html}

        <!-- Banner Condiciones -->
        <div style="padding: 16px 28px; background: #e0f2fe; border-left: 4px solid #0284c7; margin: 20px 28px; border-radius: 4px;">
          <p style="margin: 0; font-size: 13px; color: #0369a1; line-height: 1.5;">
            <strong>📌 Gestión Comercial:</strong><br>
            • Contactar al cliente a la brevedad vía WhatsApp o llamada telefónica para confirmar el pedido.
          </p>
        </div>

        <!-- Footer -->
        <div style="padding: 20px 28px; background: #091e3a; color: #94a3b8; text-align: center; font-size: 12px;">
          <p style="margin: 0 0 6px; color: #e2e8f0; font-weight: 600;">Distribuidora Tridente — Venta Mayorista Exclusiva para Comerciantes</p>
          <p style="margin: 0 0 8px;">Región de Coquimbo • Catálogo online: <a href="https://pedidos.distribuidoratridente.cl/Public/Catalogo" style="color: #38bdf8;">pedidos.distribuidoratridente.cl</a></p>
          <p style="margin: 0; font-size: 11px; opacity: 0.8;">Atención comercial registrada por Camila, ejecutiva de ventas de Distribuidora Tridente.</p>
        </div>

      </div>
    </body>
    </html>
    """
    return html

def send_cotizacion_email_background(cliente_data: dict, productos_lista: list, transcript_text: str = ""):
    """Tarea en segundo plano: guarda en BD, envía correo y WhatsApp a los administradores."""
    # ── 1. Guardar en Base de Datos ──
    razon_social = (cliente_data.get("razon_social") or cliente_data.get("nombre") or cliente_data.get("empresa") or "Cliente Web").strip()
    whatsapp     = (cliente_data.get("whatsapp") or cliente_data.get("celular") or cliente_data.get("telefono") or "No indicado").strip()
    destinatario = (cliente_data.get("correo") or cliente_data.get("email") or "").strip()
    pedido       = (cliente_data.get("productos_solicitados") or "Registro / cotización web").strip()
    fecha_hoy    = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
    folio        = f"C-{int(time.time()) % 1000000:06d}"

    subtotal_neto = sum(p.get("cantidad", 1) * p.get("precio_unitario", 0) for p in productos_lista)
    iva   = int(round(subtotal_neto * 0.19))
    total = subtotal_neto + iva

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
                    razon_social,
                    cliente_data.get("rut") or "S/R",
                    whatsapp,
                    destinatario or "sin_correo@tridente.cl",
                    cliente_data.get("direccion") or "Región de Coquimbo",
                    f"Chat Camila. Solicitud: {pedido}. Transcripción: {transcript_text[:1000]}",
                    subtotal_neto, iva, total, len(productos_lista),
                    json.dumps(productos_lista, ensure_ascii=False)
                ))
            conn.commit()
            log.info("✓ Cotización %s guardada en BD para %s (%s)", folio, razon_social, whatsapp)
    except Exception as exc:
        log.warning("No se pudo guardar la cotización en BD: %s", exc)

    # ── 2. Envío de CORREO a administradores con recibe_camila_email=true (Paso B: Email) ──
    whatsapp_recipients, admin_email_recipients = get_admin_notification_destinatarios()

    enviado_email = False
    destinatarios_email_str = ", ".join(admin_email_recipients) if admin_email_recipients else ""

    smtp_cfg = get_smtp_config()
    if smtp_cfg:
        html_content = build_cotizacion_email_html(cliente_data, productos_lista, folio, transcript_text)
        plain_text = f"""Nueva Cotización Web - {razon_social}

DATOS DEL CLIENTE / NEGOCIO:
- Razón Social: {razon_social}
- WhatsApp / Celular: {whatsapp}
- Correo Electrónico: {destinatario or 'No indicado'}
- Pedido / Solicitud: {pedido}
- Fecha: {fecha_hoy}
- Folio: {folio}

============================================================
HISTORIAL COMPLETO DE LA CONVERSACIÓN:
============================================================
{transcript_text}
============================================================
"""
        msg = EmailMessage()
        msg["Subject"] = f"Nueva Cotización Web - {razon_social}"
        msg["From"]    = f"{smtp_cfg['from_name']} <{smtp_cfg['from_email']}>"
        if admin_email_recipients:
            msg["To"] = ", ".join(admin_email_recipients)
            if destinatario and "@" in destinatario and destinatario not in admin_email_recipients:
                msg["Cc"] = destinatario
        else:
            msg["To"] = destinatario if ("@" in destinatario) else smtp_cfg["username"]
        msg.set_content(plain_text)
        msg.add_alternative(html_content, subtype="html")
        try:
            with smtplib.SMTP_SSL(smtp_cfg["host"], smtp_cfg["port"], timeout=20) as server:
                server.login(smtp_cfg["username"], smtp_cfg["password"])
                server.send_message(msg)
            enviado_email = True
            log.info("📧 Correo enviado a: %s (Cliente: %s)", admin_email_recipients, razon_social)
        except Exception as exc:
            log.error("Error al enviar correo SMTP: %s", exc)
    else:
        log.error("No hay servidor SMTP configurado — omitiendo envío de correo.")

    # ── 3. Envío de WHATSAPP a administradores con recibe_camila_whatsapp=true (Paso B: WhatsApp) ──
    total_estimado_val = float(total) if (productos_lista and total > 0) else None
    enviado_whatsapp, destinatarios_whatsapp_str = send_whatsapp_notifications(
        cliente_data=cliente_data,
        transcript_text=transcript_text,
        recipients=whatsapp_recipients,
        total_estimado=total_estimado_val
    )

    # ── 4. Guardar en bdtridente.camila_logs (Paso C) ──
    save_camila_log(
        razon_social=razon_social,
        whatsapp=whatsapp,
        correo=destinatario,
        resumen=pedido,
        conversacion=transcript_text,
        total_estimado=total_estimado_val,
        enviado_whatsapp=enviado_whatsapp,
        enviado_email=enviado_email,
        destinatarios_whatsapp=destinatarios_whatsapp_str,
        destinatarios_email=destinatarios_email_str,
        estado="COMPLETADA",
        origen="WEB_CAMILA"
    )


def load_fallback_catalog() -> list[dict]:
    """Carga los productos de respaldo desde tridente-catalog.js si la BD aún no responde."""
    try:
        catalog_path = os.path.join(os.path.dirname(__file__), "..", "js", "tridente-catalog.js")
        if os.path.exists(catalog_path):
            with open(catalog_path, "r", encoding="utf-8") as f:
                content = f.read()
                m = re.search(r"window\.TRIDENTE_PRODUCTOS_PRECARGADOS\s*=\s*(\[.*?\]);", content, re.DOTALL)
                if m:
                    return json.loads(m.group(1))
    except Exception as e:
        log.warning("No se pudo cargar catalogo fallback desde archivo: %s", e)
    return []


_catalog_cache: dict = {"products": load_fallback_catalog(), "last_fetched": 0}


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


def get_catalog_categories() -> list[dict]:
    """Retorna las categorías activas con conteo de productos para los filtros del catálogo."""
    sql = f"""
        SELECT
            c.id,
            c.nombre,
            COUNT(p.id) AS total_productos
        FROM {DB_SCHEMA}.categorias c
        LEFT JOIN {DB_SCHEMA}.productos p ON p.categoria_id = c.id AND p.activo = true AND p.eliminado_at IS NULL
        WHERE c.activo = true AND c.eliminado_at IS NULL
        GROUP BY c.id, c.nombre
        HAVING COUNT(p.id) > 0
        ORDER BY c.nombre ASC
    """
    try:
        with get_db() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql)
                return [
                    {
                        "id": str(r["id"]),
                        "nombre": r["nombre"],
                        "total_productos": int(r["total_productos"]),
                    }
                    for r in cur.fetchall()
                ]
    except Exception as exc:
        log.warning("DB get_catalog_categories fallo: %s. Usando conteo de catálogo cacheado...", exc)
        counts = {}
        for p in _catalog_cache.get("products", []):
            cat = p.get("categoria") or "Otras"
            counts[cat] = counts.get(cat, 0) + 1
        return [
            {"id": cat, "nombre": cat, "total_productos": count}
            for cat, count in sorted(counts.items(), key=lambda x: x[0].lower())
        ]


def get_catalog_page(
    q: Optional[str] = None,
    categoria: Optional[str] = None,
    categoria_id: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> dict:
    """
    Retorna productos paginados para el catálogo público con filtros y ordenamiento estricto:
      1° Por nombre de categoría (ASC, NULLS LAST)
      2° Por nombre de producto (ASC)
    """
    page = max(1, int(page or 1))
    limit = max(1, min(int(limit or 20), 100))
    offset = (page - 1) * limit

    cat_filter = (categoria_id or categoria or "").strip()
    search_term = (q or "").strip()

    where_clauses = [
        "p.activo = true",
        "p.eliminado_at IS NULL",
    ]
    params = []

    if search_term:
        where_clauses.append("(p.nombre ILIKE %s OR p.codigo ILIKE %s OR c.nombre ILIKE %s)")
        pattern = f"%{search_term}%"
        params.extend([pattern, pattern, pattern])

    if cat_filter and cat_filter.upper() != "TODAS":
        where_clauses.append("(c.id::text = %s OR c.nombre ILIKE %s)")
        params.extend([cat_filter, f"%{cat_filter}%"])

    where_sql = " AND ".join(where_clauses)

    count_sql = f"""
        SELECT COUNT(*)
        FROM {DB_SCHEMA}.productos p
        LEFT JOIN {DB_SCHEMA}.categorias c ON c.id = p.categoria_id
        WHERE {where_sql}
    """

    data_sql = f"""
        SELECT
            p.id,
            p.codigo,
            p.nombre,
            c.id AS categoria_id,
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
        WHERE {where_sql}
        ORDER BY c.nombre ASC NULLS LAST, p.nombre ASC
        LIMIT %s OFFSET %s
    """

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(count_sql, tuple(params))
                total = cur.fetchone()[0] or 0

            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                data_params = params + [limit, offset]
                cur.execute(data_sql, tuple(data_params))
                productos = []
                for row in cur.fetchall():
                    item = dict(row)
                    pid = str(item["id"])
                    item["id"] = pid
                    item["codigo"] = str(item.get("codigo") or "")
                    item["nombre"] = str(item.get("nombre") or "")
                    item["categoria"] = str(item.get("categoria") or "Sin Categoría")
                    item["categoria_id"] = str(item["categoria_id"]) if item.get("categoria_id") else None
                    item["precio_unitario"] = int(item["precio_unitario"]) if item.get("precio_unitario") is not None else 0
                    item["precio_caja"] = int(item["precio_caja"]) if item.get("precio_caja") is not None else 0
                    has_img = bool(item.get("has_image"))
                    item["has_image"] = has_img
                    item["imagen_url"] = f"/api/producto/{pid}/imagen" if has_img else None
                    item["stock"] = int(item["stock"]) if item.get("stock") is not None else None
                    productos.append(item)

                total_paginas = max(1, math.ceil(total / limit)) if total > 0 else 1
                return {
                    "productos": productos,
                    "total": total,
                    "total_paginas": total_paginas,
                    "pagina_actual": page,
                    "limit": limit,
                }
    except Exception as exc:
        log.warning("DB get_catalog_page fallo: %s. Usando fallback en memoria...", exc)
        # Fallback usando catálogo en memoria
        all_prods = get_all_catalog_products()
        filtered = []
        for p in all_prods:
            if search_term:
                st = search_term.lower()
                p_nom = str(p.get("nombre", "")).lower()
                p_cod = str(p.get("codigo", "")).lower()
                p_cat = str(p.get("categoria", "")).lower()
                if st not in p_nom and st not in p_cod and st not in p_cat:
                    continue
            if cat_filter and cat_filter.upper() != "TODAS":
                cf = cat_filter.lower()
                p_cat = str(p.get("categoria", "")).lower()
                p_cat_id = str(p.get("categoria_id", "")).lower()
                if cf != p_cat and cf != p_cat_id and cf not in p_cat:
                    continue
            filtered.append(p)

        # Ordenamiento estricto: primero categoría, luego nombre
        filtered.sort(key=lambda x: (str(x.get("categoria") or "").lower(), str(x.get("nombre") or "").lower()))

        total = len(filtered)
        total_paginas = max(1, math.ceil(total / limit)) if total > 0 else 1
        page_items = filtered[offset : offset + limit]

        return {
            "productos": page_items,
            "total": total,
            "total_paginas": total_paginas,
            "pagina_actual": page,
            "limit": limit,
        }


# ---------------------------------------------------------------------------
# Stop Words ampliadas y extracción inteligente de términos de búsqueda
# ---------------------------------------------------------------------------
STOP_WORDS = {
    # Saludos y cortesía
    "hola", "buenas", "tardes", "dias", "días", "noches", "como", "cómo", "estas", "estás", "estoy",
    "bien", "gracias", "favor", "porfa", "saludos", "chao", "adios", "adiós",
    # Verbos comunes y auxiliares
    "que", "qué", "tienen", "tienes", "venden", "vendes", "hay", "cuanto", "cuánto", "vale", "cuesta",
    "precio", "precios", "stock", "productos", "producto", "por", "de", "la", "el", "los", "las",
    "un", "una", "unos", "unas", "en", "y", "a", "para", "con", "me", "te", "se", "nos", "das", "da",
    "quisiera", "quiero", "saber", "si", "algún", "algun", "algunos", "algunas", "donde", "dónde",
    "atienden", "atiendes", "puedo", "puede", "pueden", "ser", "estar", "hacer", "hacerme", "hacerse",
    "necesito", "necesitamos", "necesita", "comprar", "comparar", "compra", "compras", "vender",
    "distribuir", "distribuyen", "distribuye", "trabajan", "trabajas", "manejan", "manejas",
    "tener", "sabes", "sobre", "acerca", "cuenta", "alta", "registro", "registrarme",
    "registrar", "cliente", "clientes", "nuevo", "nueva", "nuevos", "nuevas", "negocio", "local",
    "empresa", "informacion", "información", "ayuda", "orientar", "consultar", "consulta", "cotizar",
    "cotizacion", "cotización", "catalogo", "catálogo", "lista", "detalle", "detalles", "ver", "mirar",
    "buscar", "busco", "buscamos", "ando", "buscando", "mandar", "enviar", "contacto",
    "tendras", "tendrás", "llegan", "despacho", "despachos", "minimo", "mínimo"
}

SHORT_BRAND_WHITELIST = {"ocb", "red", "ice", "box"}

def extract_search_terms(text: str) -> list[str]:
    """Extrae palabras clave de productos reales, evitando verbos, intenciones y palabras genéricas."""
    clean = re.sub(r"[^\w\s]", " ", text.lower())
    words = [w.strip() for w in clean.split()]
    return [
        w for w in words
        if (len(w) >= 4 or w in SHORT_BRAND_WHITELIST) and w not in STOP_WORDS
    ]

def get_chile_time_greeting() -> str:
    """Devuelve el saludo chileno apropiado según la hora actual en Chile continental."""
    try:
        import zoneinfo
        tz = zoneinfo.ZoneInfo("America/Santiago")
        now = datetime.datetime.now(tz)
    except Exception:
        now = datetime.datetime.utcnow() - datetime.timedelta(hours=3)
    hour = now.hour
    if 5 <= hour < 12:
        return "buenos días"
    elif 12 <= hour < 20:
        return "buenas tardes"
    else:
        return "buenas noches"

# ---------------------------------------------------------------------------
# System Prompt de Camila (100% Humano - Tipo WhatsApp)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """Eres Camila, ejecutiva de ventas de Distribuidora Tridente (www.distribuidoratridente.cl). Tu misión es atender a los clientes que entran al sitio web, asesorarlos en sus compras y cerrar cotizaciones o pedidos de forma rápida y efectiva.

## REGLA SUPREMA: 100% HUMANA Y RESPUESTAS ULTRA CORTAS (NO HABLES MUCHO):
- Escribe MÁXIMO 1 o 2 líneas cortas por mensaje (menos de 25 palabras). Tal como chatea una vendedora real por WhatsApp.
- JAMÁS envíes párrafos largos, listas interminables ni explicaciones de más. Habla poco, directo y al grano.
- PROHIBIDO TERMINANTEMENTE decir "asistente", "asistente virtual", "bot", "IA" o "modelo". Eres una persona de ventas de carne y hueso.

## REGLA DE SALUDO (SOLO 1 VEZ AL INICIO - PROHIBIDO SALUDAR EN CADA MENSAJE):
- El saludo ("Hola..", "¡Hola! buenas tardes", etc.) se da EXCLUSIVAMENTE en el primer mensaje de la conversación.
- EN TODAS LAS RESPUESTAS POSTERIORES, ESTÁ TERMINANTEMENTE PROHIBIDO VOLVER A DECIR "HOLA", "¡HOLA!" O SALUDAR DE NUEVO.
  En WhatsApp nadie saluda en cada mensaje. Si la conversación ya está iniciada, ve DIRECTO a responder la consulta.
- Si el cliente ÚNICAMENTE saluda al inicio (ej: "hola", "buenas", "hola como estas", "buenas tardes", "buenas noches"):
  Responde corto, relajado y natural según la hora (usando "tú", no "usted"):
  * "Hola.. buenas tardes, ¿en qué te puedo ayudar?" (o "buenos días" / "buenas noches").
  * "¡Hola! Buenas tardes, ¿en qué te ayudo hoy?"
- Si el cliente en su primer mensaje saluda Y PIDE COSAS O PREGUNTA (ej: "hola buenas tardes tienes cigarros?"):
  Saluda brevemente ("¡Hola!...") y responde de inmediato a lo que pidió.

## REGLA DE ORO DE PRODUCTOS (MUY ESTRICTO):
- NUNCA ofrezcas ni menciones productos que el cliente NO haya preguntado expresamente.
- PROHIBIDO TERMINANTEMENTE ofrecer preservativos u otros productos al azar si el cliente no los mencionó.
- SI EL CLIENTE PREGUNTA POR CIGARROS, CIGARRILLOS O PUCHOS:
  PROHIBIDO TERMINANTEMENTE DECIR "PURITOS" U OFRECER PURITOS.
  Debes mostrar la lista y marcas reales de cigarrillos y tabaco: Kent, Lucky Strike, Pall Mall, Marlboro, Philip Morris, Chesterfield, Atlas, Latinos, tabaco para enrolar y papelillos OCB.
  (Recuerda: si la conversación ya está en curso, NO digas "¡Hola!", ve directo a mostrar las opciones).
- Si el cliente dice que quiere ser cliente, registrarse, comprar o consultar cómo comprar:
  NO nombres ningún producto. Respóndele pidiéndole los datos de esta manera exacta:
Si Claro, mira para ser cliente o comprar, necesito estos datos
Razón Social:
Correo: 
WhatsApp:

## CONSULTA DE PRODUCTOS ESPECÍFICOS:
- Cuando el cliente pregunte por una marca o producto específico (ej: "¿qué tienes en kent?", "¿tienes galletas mckay?"):
  Responde DIRECTAMENTE indicando las opciones y variedades que tenemos en stock (ej: "En Kent tenemos Kent 1 Blanco, Kent 4 Gris, Kent 8 Azul, Actron y Switch. ¿Cuáles te interesan?").
  ¡NO agregues la plantilla de pedir datos (Razón Social, Correo, WhatsApp) en este momento! La plantilla solo se pide cuando el cliente pida precios/cotización, confirme cantidades o quiera comprar/ser cliente.
- Si pregunta por cigarros o tabaco: NUNCA digas puritos; lista cigarrillos (Kent, Lucky Strike, Pall Mall, Marlboro, etc.) y tabaco para enrolar.
- Si pregunta por un rubro que NO vendemos (como abarrotes, bebidas, pan, etc.):
  Aclara directo sin decir hola: "No vendemos abarrotes, pero sí tenemos cigarrillos, confites, galletas y pilas. Puedes ver nuestro catálogo acá: https://www.distribuidoratridente.cl/catalogo.html"
- SÍ vendemos cigarrillos y tabacos (Kent, Lucky Strike, Pall Mall, Marlboro, Atlas, Latinos, Captain Black, OCB, Clipper), confites y chocolates (Costa, Arcor, Ambrosoli), galletas (McKay) y pilas (Duracell, Eveready).
- Si preguntan en general qué productos vendemos: responde en 1 línea con las categorías principales (cigarrillos, confites, galletas y pilas) e invita a ver el catálogo oficial en https://www.distribuidoratridente.cl/catalogo.html

## REGLA DE ORO DE PRECIOS Y COTIZACIÓN (ESTRICTO):
- En el chat NO das precios numéricos unitarios ni totales (solo confirmas disponibilidad, marcas y formatos).
- Si preguntan precios, cotizar o registrarse como cliente, debes pedir los datos así:
Si Claro, mira para ser cliente o comprar, necesito estos datos
Razón Social:
Correo: 
WhatsApp:

## CIERRE DE VENTA Y CAPTURA DE DATOS (CUÁNDO PEDIR LA PLANTILLA):
- Pide los datos de contacto ÚNICAMENTE cuando:
  1. El cliente diga explícitamente que quiere comprar, ser cliente o registrarse ("quiero comprar", "cómo compro", "quiero ser cliente").
  2. El cliente pregunte por precios o pida cotizar ("cuánto vale", "precios", "cotizar").
  3. El cliente indique qué productos y cantidades quiere cotizar ("quiero 10 cartones de Kent").
- En esos casos, pide los datos exactamente en este formato:
Si Claro, mira para ser cliente o comprar, necesito estos datos
Razón Social:
Correo: 
WhatsApp:

## ACCIÓN DE ENVÍO Y NOTIFICACIÓN:
- Apenas el cliente te entregue los datos (Razón Social, Correo y WhatsApp/Celular):
  1. Confírmale en 1 sola línea:
     "¡Listo! Ya le pasé tus datos a ventas para que te contacten con la cotización formal. ¡Muchas gracias! 🙌📦"
  2. En ese mismo mensaje, DEBES generar al final el bloque JSON con la acción "enviar_lead_comercial":
  ```json
  {
    "action": "enviar_lead_comercial",
    "razon_social": "Nombre de la empresa, local o cliente",
    "correo": "correo@ejemplo.com",
    "whatsapp": "+569XXXXXXXX",
    "productos_solicitados": "Detalle de productos o registro de nuevo cliente"
  }
  ```
  El backend se encargará automáticamente de despachar el correo vía SMTP a los administradores de la tabla usuarios (rol_id = 29f48a5a-623c-4677-a8b8-e9c848165595) con el asunto "Nueva Cotización Web - [Razón Social]".
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

                    ALTER TABLE {DB_SCHEMA}.usuarios ADD COLUMN IF NOT EXISTS recibe_camila_whatsapp BOOLEAN DEFAULT false;
                    ALTER TABLE {DB_SCHEMA}.usuarios ADD COLUMN IF NOT EXISTS recibe_camila_email BOOLEAN DEFAULT false;

                    CREATE TABLE IF NOT EXISTS {DB_SCHEMA}.camila_logs (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        razon_social VARCHAR(255) NOT NULL,
                        whatsapp VARCHAR(50),
                        correo VARCHAR(255),
                        resumen TEXT,
                        conversacion TEXT,
                        total_estimado NUMERIC(12, 2),
                        enviado_whatsapp BOOLEAN DEFAULT false,
                        enviado_email BOOLEAN DEFAULT false,
                        destinatarios_whatsapp TEXT,
                        destinatarios_email TEXT,
                        estado VARCHAR(50) DEFAULT 'COMPLETADA',
                        origen VARCHAR(100) DEFAULT 'WEB_CAMILA',
                        metadata_extra JSONB DEFAULT '{{}}'::jsonb,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_camila_logs_created_at ON {DB_SCHEMA}.camila_logs(created_at DESC);
                    CREATE INDEX IF NOT EXISTS idx_camila_logs_estado ON {DB_SCHEMA}.camila_logs(estado);
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
    saludo_horario = get_chile_time_greeting()
    found_products: list[dict] = []

    # ── Detección inteligente de intenciones ──
    clean_words = [w for w in re.sub(r"[^\w\s]", "", user_lower).split() if w]
    greeting_words = {"hola", "buenas", "buen", "dia", "dias", "días", "tardes", "noches", "como", "cómo", "estas", "estás", "que", "qué", "tal", "saludos"}
    
    # 1. Saludo EXCLUSIVO (solo si el mensaje no contiene consultas de productos ni pedidos)
    is_only_greeting = len(clean_words) > 0 and all(w in greeting_words for w in clean_words)

    # 2. Cliente quiere comprar, registrarse o ser cliente
    is_ser_cliente = any(
        phrase in user_lower
        for phrase in [
            "ser cliente", "hacerme cliente", "hacerse cliente", "nuevo cliente", "registrar", "registro",
            "darme de alta", "como compro", "cómo compro", "como comprar", "cómo comprar", "quiero comprar",
            "necesito comprar", "puedo comprar", "comparar", "comprar"
        ]
    )

    # 3. Preguntas de precios, cotizaciones o presupuesto
    is_price_or_cotizar_q = any(
        phrase in user_lower
        for phrase in [
            "precio", "precios", "cuanto vale", "cuánto vale", "cuanto cuesta", "cuánto cuesta",
            "valor", "valores", "cotizar", "cotizacion", "cotización", "presupuesto",
            "armar cotizacion", "hacer cotizacion", "cotizador", "lista de precios"
        ]
    )

    # 4. Preguntas generales sobre catálogo o qué productos venden
    is_general_products_q = any(
        phrase in user_lower
        for phrase in [
            "saber sobre los productos", "que productos", "qué productos", "que vendes", "qué vendes",
            "que tienen", "qué tienen", "categorias", "categorías", "lineas de productos", "líneas de productos", "catalogo", "catálogo"
        ]
    )

    is_first_turn = len(history) == 0

    if is_only_greeting:
        if is_first_turn:
            db_context = (
                f"\n\n[INSTRUCCIÓN DE SALUDO: Primer mensaje de la conversación. En Chile es {saludo_horario}. "
                f"Responde corto, 100% humano y relajado, tal como chatea una persona real por WhatsApp: "
                f"'Hola.. {saludo_horario}, ¿en qué te puedo ayudar?' o '¡Hola! {saludo_horario.capitalize()}, ¿en qué te ayudo hoy?'. "
                f"PROHIBIDO decir 'Acá Camila de Tridente' ni 'le doy la bienvenida'. Cero frases robóticas]."
            )
        else:
            db_context = "\n\n[CONVERSACIÓN EN CURSO: El cliente volvió a saludar. Responde corto y directo como humano en WhatsApp: 'Dime, ¿en qué te puedo ayudar?' (PROHIBIDO volver a decir '¡Hola! buenas tardes')]."
    elif is_ser_cliente:
        db_context = (
            "\n\n[INSTRUCCIÓN VITAL: El cliente quiere ser cliente o comprar. "
            "PROHIBIDO TERMINANTEMENTE ofrecer preservativos, puritos o productos no solicitados. "
            + ("" if is_first_turn else "PROHIBIDO decir 'Hola'. ")
            + "DEBES responder pidiendo los datos con esta plantilla exacta:\n"
            "Si Claro, mira para ser cliente o comprar, necesito estos datos\n"
            "Razón Social:\n"
            "Correo: \n"
            "WhatsApp:]"
        )
    elif is_general_products_q and not terms:
        greeting_txt = "¡Hola! " if is_first_turn else ""
        db_context = (
            f"\n\n[INSTRUCCIÓN: El cliente pregunta qué productos vendemos. "
            + ("" if is_first_turn else "PROHIBIDO decir 'Hola'. ")
            + f"Responde en 1 línea corta: '{greeting_txt}Tenemos cigarrillos, tabacos, confites, galletas y pilas. Puedes revisar todo nuestro catálogo acá: https://www.distribuidoratridente.cl/catalogo.html'. "
            f"¡NO nombres ningún producto individual específico que no haya pedido!]"
        )
    elif is_price_or_cotizar_q and not terms:
        db_context = (
            "\n\n[POLÍTICA DE PRECIOS: En el chat no se dan valores unitarios; se maneja escala mayorista por volumen. "
            + ("" if is_first_turn else "PROHIBIDO decir 'Hola'. ")
            + "Pide los datos exactamente así:\n"
            "Si Claro, mira para ser cliente o comprar, necesito estos datos\n"
            "Razón Social:\n"
            "Correo: \n"
            "WhatsApp:]"
        )
    elif terms:
        found_products = []
        seen_codes = set()
        is_tobacco_query = any(t in ["cigarro", "cigarros", "cigarrillo", "cigarrillos", "pucho", "puchos", "tabaco", "tabacos"] for t in terms)
        for term in terms[:2]:
            rows = query_productos(term, limit=6)
            for r in rows:
                code = r.get("codigo")
                if code not in seen_codes:
                    seen_codes.add(code)
                    found_products.append(r)

        greeting_instruction = "Saluda brevemente ('¡Hola!...') y responde" if is_first_turn else "PROHIBIDO decir 'Hola' ni saludar de nuevo; responde DIRECTO"

        # Detectar si el cliente está pidiendo cotización explícita o solo consultando qué hay
        is_asking_varieties = any(p in user_lower for p in ["que tienes", "qué tienes", "cuales tienes", "cuáles tienes", "que marcas", "qué marcas", "que hay", "qué hay", "tienes", "variedades", "cuales hay", "cuáles hay"])
        is_asking_quote = is_price_or_cotizar_q or is_ser_cliente or any(p in user_lower for p in ["cotizar", "cotizacion", "cotización", "precio", "precios", "comprar"])

        if found_products:
            prods_clean = [
                p.get("nombre") for p in found_products
                if "purito" not in str(p.get("nombre") or "").lower() or any("purito" in t for t in terms)
            ]
            prods_resumen = [f"• {nom}" for nom in prods_clean[:8]]
            
            if is_tobacco_query and any(t in ["cigarro", "cigarros", "cigarrillo", "cigarrillos", "pucho", "puchos"] for t in terms):
                instruccion = (
                    f"{greeting_instruction}. PROHIBIDO DECIR 'puritos' o hablar de puritos. "
                    "Muestra las marcas disponibles de cigarrillos y tabacos (Kent, Lucky Strike, Pall Mall, Marlboro, Philip Morris, Chesterfield, Atlas, Latinos, tabacos para enrolar y papelillos OCB). "
                    "Pregunta qué marcas o cantidades busca. "
                    "¡NO pegues la plantilla de pedir datos todavía!"
                )
            elif is_asking_varieties or not is_asking_quote:
                instruccion = (
                    f"{greeting_instruction} confirmando stock de estas opciones de forma corta y directa en 1 línea. "
                    "Pregunta cuál o qué cantidades le interesan. "
                    "¡NO pegues la plantilla de pedir datos todavía; solo responde qué variedades tenemos!"
                )
            else:
                instruccion = (
                    f"{greeting_instruction} confirmando stock. "
                    "Pide los datos de contacto con la plantilla exacta:\n"
                    "Si Claro, mira para ser cliente o comprar, necesito estos datos\n"
                    "Razón Social:\n"
                    "Correo: \n"
                    "WhatsApp:"
                )

            db_context = (
                f"\n\n[PRODUCTOS ENCONTRADOS RELACIONADOS A SU CONSULTA]:\n"
                + "\n".join(prods_resumen)
                + f"\n(INSTRUCCIÓN: {instruccion})"
            )
        else:
            if is_tobacco_query:
                db_context = (
                    f"\n\n[INSTRUCCIÓN CIGARROS/TABACO: {greeting_instruction}. "
                    "SÍ vendemos cigarrillos (Kent, Lucky Strike, Pall Mall, Marlboro, Philip Morris, Chesterfield, Atlas, Latinos) y tabacos para enrolar con papelillos OCB. "
                    "¡JAMÁS digas puritos! Confirma estas marcas y pregunta qué cantidades busca]."
                )
            else:
                db_context = (
                    f"\n\n[DATOS: No se encontró producto idéntico para: '{', '.join(terms)}'. "
                    f"{greeting_instruction}. Si busca abarrotes o productos que no vendemos, aclara amablemente que no vendemos ese rubro pero sí cigarrillos, confites, galletas y pilas. "
                    f"Responde en 1 O 2 LÍNEAS breves invitando a ver https://www.distribuidoratridente.cl/catalogo.html ]."
                )
    else:
        if is_first_turn:
            db_context = f"\n\n[Horario en Chile: {saludo_horario}. Saluda como humana y responde en MÁXIMO 1 o 2 LÍNEAS breves, estilo WhatsApp]."
        else:
            db_context = "\n\n[CONVERSACIÓN EN CURSO: PROHIBIDO decir 'Hola' ni saludar de nuevo. Responde DIRECTO en MÁXIMO 1 o 2 LÍNEAS breves, estilo WhatsApp]."

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
        if is_only_greeting:
            assistant_text = f"¡Hola! {saludo_horario.capitalize()}, ¿en qué te puedo ayudar?"
        elif is_ser_cliente or is_price_or_cotizar_q:
            assistant_text = "Si Claro, mira para ser cliente o comprar, necesito estos datos:\nRazón Social:\nCorreo:\nWhatsApp:"
        else:
            assistant_text = "Sí, tenemos stock disponible. Si gustas indícame tu Razón Social, correo y WhatsApp para enviarte la cotización formal con los precios mayoristas."

    if not is_first_turn:
        # En conversaciones ya iniciadas, PROHIBIDO volver a decir "¡Hola!", "Hola buenas noches", etc.
        assistant_text = re.sub(
            r"^(¡?\s*(hola|buenas\s+(tardes|noches|d[ií]as)|buen\s+d[ií]a|qu[eé]\s+tal|c[oó]mo\s+est[aá]s)\s*!*[\s,\.]*)+",
            "",
            assistant_text,
            flags=re.IGNORECASE
        ).strip()
        if assistant_text:
            assistant_text = assistant_text[0].upper() + assistant_text[1:]

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
    lead_agendado = False

    # 1. Acción: emit_cotizacion / enviar_lead_comercial (Notificación por correo a administradores)
    try:
        cotiz_match = re.search(r'\{[^{}]*"action"\s*:\s*"(?:emit_cotizacion|enviar_lead_comercial)"[^{}]*\}', assistant_text, re.DOTALL)
        if cotiz_match:
            json_str = cotiz_match.group(0)
            action_data = json.loads(json_str)
            correo_cliente = str(action_data.get("correo") or action_data.get("email") or "").strip()

            # Asegurar claves uniformes
            if "razon_social" not in action_data and "nombre" in action_data:
                action_data["razon_social"] = action_data["nombre"]
            if "whatsapp" not in action_data and "celular" in action_data:
                action_data["whatsapp"] = action_data["celular"]

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

            transcript_text = format_conversation_transcript(sessions[sid])
            background_tasks.add_task(send_cotizacion_email_background, action_data, prods_cotizados, transcript_text)
            lead_agendado = True
            log.info("Tarea de envío de cotización/lead agendada para: %s (%s)", action_data.get("razon_social") or action_data.get("nombre"), correo_cliente)

            # Si el cliente entregó whatsapp, generar también enlace opcional de WhatsApp
            wa_num = str(action_data.get("whatsapp") or action_data.get("celular") or action_data.get("telefono") or "").strip()
            if wa_num and len(wa_num) >= 8:
                wa_msg = f"¡Hola! Vengo desde el chat de Camila en la web con mi cotización para {action_data.get('razon_social', 'mi negocio')}."
                whatsapp_url = f"https://wa.me/{WHATSAPP_NUMBER}?text={urllib.parse.quote(wa_msg)}"

            reply_clean = reply_clean.replace(json_str, "")
            reply_clean = re.sub(r"```json\s*", "", reply_clean)
            reply_clean = re.sub(r"```\s*", "", reply_clean).strip()
    except Exception as exc:
        log.warning("No se pudo procesar acción emit_cotizacion / enviar_lead_comercial: %s", exc)

    # Respaldo automático si el cliente entregó datos de contacto y no se detectó acción JSON
    if not lead_agendado:
        email_m = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', user_text)
        phone_m = re.search(r'(?:\+?56\s?)?9\s?\d{4}\s?\d{4}|\b\d{8,9}\b', user_text)
        if email_m or (phone_m and len(sessions[sid]) >= 2):
            fallback_data = {
                "razon_social": user_text.split(",")[0].strip() if "," in user_text else "Contacto Web",
                "correo": email_m.group(0) if email_m else "",
                "whatsapp": phone_m.group(0) if phone_m else "",
                "productos_solicitados": "Registro o cotización solicitada en chat"
            }
            transcript_text = format_conversation_transcript(sessions[sid])
            background_tasks.add_task(send_cotizacion_email_background, fallback_data, found_products, transcript_text)
            log.info("✓ Tarea de cotización agendada por captura de contacto fallback: %s", fallback_data)

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
# Endpoints para el Cotizador Web Público y Catálogo de Productos
# ---------------------------------------------------------------------------

@app.get("/api/productos")
def api_productos():
    """Retorna el listado completo de productos activos para el cotizador web."""
    return get_all_catalog_products()


@app.get("/api/categorias")
def api_categorias():
    """Retorna las categorías activas para el cotizador web."""
    return get_all_categorias()


@app.get("/api/catalogo/categorias")
def api_catalogo_categorias():
    """Retorna las categorías activas con conteo de productos para los filtros del catálogo."""
    return get_catalog_categories()


@app.get("/api/catalogo")
@app.get("/api/productos/catalogo")
def api_catalogo(
    q: Optional[str] = Query(None, description="Búsqueda por texto o nombre"),
    search: Optional[str] = Query(None, description="Alias para búsqueda"),
    categoria: Optional[str] = Query(None, description="Filtro por nombre o slug de categoría"),
    categoria_id: Optional[str] = Query(None, description="Filtro por ID de categoría"),
    page: int = Query(1, ge=1, description="Número de página"),
    limit: int = Query(20, ge=1, le=100, description="Cantidad de productos por página (20 por defecto)"),
):
    """
    Endpoint público del catálogo de productos con filtros, paginación
    y ordenamiento estricto:
      1° Por categoría (nombre de categoría)
      2° Alfabéticamente por nombre de producto (A-Z)
    """
    search_query = q or search
    return get_catalog_page(
        q=search_query,
        categoria=categoria,
        categoria_id=categoria_id,
        page=page,
        limit=limit,
    )


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
