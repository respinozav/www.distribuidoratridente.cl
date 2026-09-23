#!/bin/bash
set -e

PROJECT_DIR="/var/www/www.distribuidoratridente.cl"

echo "🚀 Iniciando despliegue de www.distribuidoratridente.cl..."
cd "$PROJECT_DIR"

git fetch origin main
git reset --hard origin/main

sudo chown -R ubuntu:www-data "$PROJECT_DIR"
sudo chmod -R 775 "$PROJECT_DIR"

echo "Recargando Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Despliegue finalizado con éxito."
