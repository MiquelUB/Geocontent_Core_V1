#!/bin/sh
# PXX — Entrypoint de Producció (V2 Sovereign)
# Arrenca Next.js (El push a la base de dades es gestiona manualment o via migracions)

echo "🏔️  PXX Geocontent — Iniciant..."

# Arrancar el servidor Next.js
echo "🚀 [Entrypoint] Arrencant Next.js..."
exec node server.js
