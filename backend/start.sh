#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# start.sh — Inicia el backend Camila en el servidor AWS
# Uso: bash start.sh [--daemon]
# ─────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🤖 Iniciando Camila AI Backend..."

# Verificar que existe .env
if [ ! -f ".env" ]; then
  echo "❌ Error: archivo .env no encontrado en $SCRIPT_DIR"
  echo "   Copia .env.example a .env y configura las variables."
  exit 1
fi

# ─────────────────────────────────────────────────────────────────
# Entorno Virtual Python
# ─────────────────────────────────────────────────────────────────
if [ ! -d "venv" ]; then
  echo "📦 Creando entorno virtual venv..."
  python3 -m venv venv || python -m venv venv
fi

if [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
elif [ -f "venv/Scripts/activate" ]; then
  source venv/Scripts/activate
fi

# Instalar dependencias si no están
pip install -r requirements.txt --quiet

# Modo daemon (para producción con nohup)
if [ "$1" == "--daemon" ]; then
  echo "🚀 Iniciando en modo background (nohup)..."
  nohup python main.py >> /var/log/camila-backend.log 2>&1 &
  echo "✅ PID: $!"
  echo $! > /tmp/camila-backend.pid
  echo "   Log: /var/log/camila-backend.log"
  echo "   Stop: kill \$(cat /tmp/camila-backend.pid)"
else
  echo "🚀 Iniciando en modo foreground (Ctrl+C para detener)..."
  python main.py
fi
