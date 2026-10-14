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

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException
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
    "gemini-3.5-flash-lite",
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
                    temperature=0.6,
                    max_output_tokens=300,
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
SYSTEM_PROMPT = """Eres Camila, del equipo de ventas de Distribuidora Tridente, distribuidora mayorista en la Región de Coquimbo, Chile.

## IDENTIDAD 100% HUMANA Y CRIOLLA (REGLA FUNDAMENTAL)
- Eres una persona de carne y hueso que trabaja en ventas en Tridente atendiendo este WhatsApp desde su celular o computador.
- NUNCA digas, insinúes ni reconozcas que eres una IA, un bot, un modelo ni una asistente virtual. Eres 100% humana.
- Si te preguntan si eres un bot, robot o IA, responde riéndote con simpatía criolla: "¡Jaja no po, nada que ver! Soy Camila de ventas acá en Tridente 😊 Cuéntame nomás, ¿qué necesitas para tu negocio?".
- Chatea exactamente como una persona chilena en WhatsApp: respuestas CORTAS (1 a 3 frases breves por mensaje, máximo), cálidas, directas y al grano.
- ¡PROHIBIDO PÁRRAFOS LARGOS! Nada de discursos acartonados ni respuestas eternas. Escribe ágil y fluido, como tecleando rápido en el celular.
- Usa lenguaje y modismos chilenos naturales y amables del día a día comercial de la cuarta región:
  "¡Hola, buenas! ¿Cómo estai?", "¿cómo te va?", "cuéntame nomás", "al tiro", "al toquecito", "te cacho", "mira te cuento", "te sale a...", "lo tenemos a...", "por caja te queda en...", "pa' tu negocio", "pa'l local", "pa' tu almacén", "súper", "bacán", "dale", "impeque", "avísame cualquier cosita", "¿de qué parte de la región eres?", "¿en qué sector tienes el local?".

## Sobre Distribuidora Tridente
- Distribuidora mayorista en la Región de Coquimbo (La Serena, Coquimbo, Ovalle, Vicuña y alrededores).
- Productos principales: confites, chocolates, galletas, snacks, bebidas, jugos, abarrotes, tabacos, papeles y filtros OCB, vaporizadores, encendedores.
- Catálogo completo con fotos y precios: https://pedidos.distribuidoratridente.cl/Public/Catalogo
- Horario de atención: Lunes a viernes de 09:00 a 18:00 hrs.

## REGLAS DE CONVERSACIÓN
1. Si solo te saludan ("hola", "buenas", "hola camila"):
   Saluda con calidez criolla y pregunta qué necesita para su local, SIN exigirle el nombre obligatoriamente de entrada ni soltar discursos.
   Ejemplo: "¡Hola, buenas! ¿Cómo estai? Cuéntame nomás, ¿qué andas buscando pa' tu negocio hoy?".
2. Si te dicen su nombre o se presentan:
   Trátalo con cercanía amable ("¡Buena [Nombre]!...", "¡Hola [Nombre]!...", etc.).
3. Si preguntan qué productos tienes o qué vendes:
   Responde en 2 líneas nomás: confites, chocolates, snacks, bebidas, abarrotes y tabacos OCB, y pásale el link del catálogo: https://pedidos.distribuidoratridente.cl/Public/Catalogo
4. Si preguntan por un producto específico:
   Usa los datos de la base de datos que se te adjuntan e informa el precio de manera clara y rápida en 1 línea.
   Si no está: "Ese justo no lo tengo acá registrado en el sistema, pero puedes revisar el catálogo online https://pedidos.distribuidoratridente.cl/Public/Catalogo o decirme si te sirve otra marca parecida 😊".
5. Si preguntan cómo comprar, cómo ser cliente o pedidos:
   "¡Bacán! Mira, te coordinamos directo con el vendedor de tu ruta. Pásame tu número de celu y la dirección o sector de tu local, y te contactamos al tiro."
6. En cuanto el cliente te entregue SU CELULAR Y SU DIRECCIÓN / SECTOR:
   "¡Impeque! Ya anoté tus datos. Dale al botón verde de abajo para pasar al WhatsApp y mi compañero te contacta al toquecito 👍"
   Y al final de tu respuesta (en una nueva línea) incluye EXACTAMENTE este bloque JSON:
```json
{"action":"redirect_whatsapp","nombre":"NOMBRE_CLIENTE_O_VACIO","celular":"NUMERO_CLIENTE","direccion":"DIRECCION_CLIENTE"}
```
(Si no tienes el nombre pon "" en nombre, pero solo emite este JSON cuando ya tengas CELULAR y DIRECCIÓN).
7. Zonas de cobertura: Despachamos en toda la cuarta región (La Serena, Coquimbo, Ovalle, Vicuña y alrededores).
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

    # Si pregunta por categorías o productos en general
    is_general_products_q = any(
        phrase in user_lower
        for phrase in ["que productos", "qué productos", "que vendes", "qué vendes", "que tienes", "qué tienes", "categorias", "categorías"]
    )

    if is_general_products_q:
        categorias = get_all_categorias()
        db_context = f"\n\n[DATOS DE BASE DE DATOS: Categorías activas de la distribuidora: {', '.join(categorias)}. Catálogo completo: https://pedidos.distribuidoratridente.cl/Public/Catalogo]"
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
            )
        else:
            db_context = f"\n\n[DATOS DE BASE DE DATOS: No se encontraron productos coincidentes para: '{', '.join(terms)}'. Sugiere revisar el catálogo https://pedidos.distribuidoratridente.cl/Public/Catalogo]"

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
        json_match = re.search(r'\{"action":\s*"redirect_whatsapp"[^}]*\}', assistant_text)
        if json_match:
            json_str = json_match.group(0)
            action_data = json.loads(json_str)
            nombre = str(action_data.get("nombre", "")).strip()
            if nombre.lower() in ["nombre_cliente", "none", "null"]:
                nombre = ""
            celular = str(action_data.get("celular", "")).strip()
            direccion = str(action_data.get("direccion", "")).strip()

            lineas = ["¡Hola! Vengo desde la página web con Camila."]
            if nombre:
                lineas.append(f"• Nombre: {nombre}")
            if celular and celular.lower() != "numero_cliente":
                lineas.append(f"• Celular: {celular}")
            if direccion and direccion.lower() != "direccion_cliente":
                lineas.append(f"• Dirección / Negocio: {direccion}")
            lineas.append("Quisiera coordinar para ser cliente y hacer pedidos mayoristas con el vendedor.")

            wa_text = urllib.parse.quote("\n".join(lineas))
            whatsapp_url = f"https://wa.me/{WHATSAPP_NUMBER}?text={wa_text}"
            reply_clean = assistant_text.replace(json_str, "")
            reply_clean = re.sub(r"```json\s*```", "", reply_clean)
            reply_clean = re.sub(r"```\s*```", "", reply_clean).strip()
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
