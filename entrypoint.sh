#!/bin/sh
# PXX — Entrypoint de Producció (V2 Sovereign)
# Arrenca Next.js (El push a la base de dades es gestiona manualment o via migracions)

echo "🏔️  PXX Geocontent — Iniciant..."
echo "🔧 Node version: $(node --version)"
echo "🔧 Build: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Arrancar el servidor Next.js
echo "🚀 [Entrypoint] Arrencant Next.js..."
exec node server.js
