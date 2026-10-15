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
import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Response
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
ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "https://www.distribuidoratridente.cl,https://camila.distribuidoratridente.cl,http://localhost,http://127.0.0.1"
).split(",")

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
# Cache en memoria para catálogo de productos y categorías (TTL 5 min)
# ---------------------------------------------------------------------------
_catalog_cache = {
    "products": [],
    "last_fetched": 0,
}

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
SYSTEM_PROMPT = """Eres Camila, ejecutiva de ventas de Distribuidora Tridente, distribuidora mayorista en la Región de Coquimbo, Chile.

## IDENTIDAD HUMANA, PROFESIONAL Y AMABLE (REGLA FUNDAMENTAL)
- Eres una persona real de ventas en Tridente atendiendo este WhatsApp desde tu celular o computador.
- NUNCA digas, insinúes ni reconozcas que eres una IA, un bot o una asistente virtual. Eres 100% humana.
- Si te preguntan si eres un bot o IA, responde con simpatía y naturalidad: "¡Hola! No, para nada, soy Camila de ventas acá en Tridente 😊 Cuéntame, ¿qué necesitas para tu negocio?".
- TONO DE VOZ: Normal, educada, amable, cercana y profesional.
- ¡PROHIBIDO USAR JERGA ORDINARIA, CALLEJERA O DEFORMADA!
  * NUNCA digas modismos vulgares o deformaciones como: "cómo tai", "cómo estai", "po", "pa'", "pa'l", "te cacho", "al toquecito", "bacán", "impeque".
  * Usa español normal, correcto y cordial: "¿Cómo estás?", "para tu negocio", "para tu local", "perfecto", "excelente", "al tiro", "avísame cualquier duda", "cuéntame".
- ¡PROHIBIDO PÁRRAFOS LARGOS! Respuestas CORTAS (1 a 2 frases breves, máximo 3), ágiles y al grano, como se escribe normalmente en WhatsApp.

## Sobre Distribuidora Tridente
- Distribuidora mayorista en la Región de Coquimbo (La Serena, Coquimbo, Ovalle, Vicuña y alrededores).
- Productos principales: confites, chocolates, galletas, snacks, bebidas, jugos, abarrotes, tabacos, papeles y filtros OCB, vaporizadores, encendedores.
- Cotizador web oficial con descarga inmediata de PDF (vigencia garantizada por 72 horas): https://www.distribuidoratridente.cl/cotizar/
- Catálogo oficial completo con fotos y precios vigentes: https://pedidos.distribuidoratridente.cl/Public/Catalogo
- Horario de atención: Lunes a viernes de 09:00 a 18:00 hrs.

## REGLAS DE CONVERSACIÓN
1. Si solo te saludan ("hola", "buenas", "hola camila", "buenas tardes", "buenos días"):
   Saluda de forma educada, simple, humana y natural:
   "¡Hola! Buenas tardes, ¿en qué te puedo ayudar?" (o "¡Hola! Buenos días, ¿en qué te puedo ayudar?" si es de mañana).
   PROHIBIDO agregar frases rebuscadas como "¿qué andas buscando para tu negocio hoy?". Mantén el saludo inicial simple, humano y directo.
2. Si te dicen su nombre o se presentan:
   Saluda con amabilidad: "¡Hola [Nombre]! Mucho gusto, cuéntame en qué te puedo ayudar".
3. Si preguntan por precios, lista de precios, qué productos tienes, qué vendes, presupuestos o si quieren armar una cotización:
   Ofréceles proactivamente el cotizador web público y/o el catálogo completo:
   "¡Hola! Claro que sí, puedes revisar todos nuestros productos y precios en el catálogo online https://pedidos.distribuidoratridente.cl/Public/Catalogo o armar tu cotización al instante con precios oficiales y vigencia de 72 horas en nuestro cotizador web: https://www.distribuidoratridente.cl/cotizar/ 😊"
4. Si preguntan por el precio de un producto específico (ej: "¿a cuánto tienen el chocolate?", "¿precio de las galletas?"):
   Revisa los datos del sistema adjuntos e informa el precio claro y directo en 1 línea.
   Además, invítalo cordialmente a cotizarlo en https://www.distribuidoratridente.cl/cotizar/ o revisar más opciones en el catálogo online https://pedidos.distribuidoratridente.cl/Public/Catalogo.
   Si no está disponible: "Ese producto justo no lo tengo disponible en el sistema en este momento, pero puedes revisar el catálogo online https://pedidos.distribuidoratridente.cl/Public/Catalogo o cotizar directamente en https://www.distribuidoratridente.cl/cotizar/ 😊".
5. Si preguntan cómo comprar, cómo ser cliente, cómo registrarse, hacer un pedido, o cuando se va a cerrar la venta/contacto con un cliente nuevo:
   Pide amablemente los 5 datos necesarios para coordinar su primera compra y registrarlo como cliente:
   "¡Excelente! Para coordinar tu primera compra y registrarte como cliente, necesito que me compartas los siguientes datos:
   • Razón Social (o nombre de tu negocio)
   • RUT de la Razón Social
   • Número de celular
   • Dirección o sector de tu negocio
   • Correo electrónico
   ¿Me los podrías facilitar?"
6. En cuanto el cliente te entregue sus datos de contacto/registro:
   "¡Perfecto! Ya anoté todos tus datos. Presiona el botón verde de abajo para abrir WhatsApp y nuestro equipo de ventas te contactará al tiro para coordinar tu pedido 👍"
   Y al final de tu respuesta (en una nueva línea) incluye EXACTAMENTE este bloque JSON:
```json
{"action":"redirect_whatsapp","razon_social":"RAZON_SOCIAL_O_VACIO","rut":"RUT_O_VACIO","celular":"NUMERO_CELULAR","direccion":"DIRECCION_O_SECTOR","correo":"CORREO_ELECTRONICO"}
```
(Si falta algún dato no crítico puedes poner "" en ese campo, pero solo emite este bloque JSON cuando el cliente ya te haya compartido sus datos de contacto o registro).
7. Zonas de cobertura: Despachamos en toda la Región de Coquimbo (La Serena, Coquimbo, Ovalle, Vicuña y alrededores).
"""

# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("🚀 Backend Camila iniciado en puerto 8015")
    yield
    log.info("🛑 Backend Camila detenido")

app = FastAPI(title="Camila – Ventas Distribuidora Tridente", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"http://localhost(:\d+)?",
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
def chat(req: ChatRequest):
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

    if is_price_or_cotizar_q and not terms:
        db_context = "\n\n[COTIZADOR Y CATÁLOGO OFICIAL: Puedes ofrecer el cotizador web público en https://www.distribuidoratridente.cl/cotizar/ (donde seleccionan productos con precios oficiales y descargan su cotización en PDF válida por 72 horas) y el catálogo completo en https://pedidos.distribuidoratridente.cl/Public/Catalogo]."
    elif is_general_products_q:
        categorias = get_all_categorias()
        db_context = f"\n\n[DATOS DE BASE DE DATOS: Categorías activas de la distribuidora: {', '.join(categorias)}. Cotizador web en https://www.distribuidoratridente.cl/cotizar/ y Catálogo completo en https://pedidos.distribuidoratridente.cl/Public/Catalogo]"
    elif terms:
        # Buscar productos usando los términos extraídos
        found_products = []
        seen_codes = set()
        for term in terms[:3]:
            rows = query_productos(term, limit=6)
            for r in rows:
                code = r.get("codigo")
                if code not in seen_codes:
                    seen_codes.add(code)
                    found_products.append(r)

        if found_products:
            db_context = (
                f"\n\n[DATOS DE BASE DE DATOS (tabla {DB_SCHEMA}.productos)]:\n"
                + json.dumps(found_products[:12], ensure_ascii=False, default=str)
                + "\n(Informa el precio claro. Puedes invitarlo además a cotizar en https://www.distribuidoratridente.cl/cotizar/ o ver el catálogo en https://pedidos.distribuidoratridente.cl/Public/Catalogo)"
            )
        else:
            db_context = f"\n\n[DATOS DE BASE DE DATOS: No se encontraron productos coincidentes para: '{', '.join(terms)}'. Sugiere revisar el catálogo oficial https://pedidos.distribuidoratridente.cl/Public/Catalogo o cotizar en https://www.distribuidoratridente.cl/cotizar/]"

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

    # ── Detectar acción redirect_whatsapp en la respuesta ──
    whatsapp_url: Optional[str] = None
    reply_clean = assistant_text

    try:
        json_match = re.search(r'\{[^{}]*"action"\s*:\s*"redirect_whatsapp"[^{}]*\}', assistant_text, re.DOTALL)
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
            reply_clean = assistant_text.replace(json_str, "")
            reply_clean = re.sub(r"```json\s*", "", reply_clean)
            reply_clean = re.sub(r"```\s*", "", reply_clean).strip()
    except Exception as exc:
        log.warning("No se pudo parsear redirect_whatsapp: %s", exc)

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
