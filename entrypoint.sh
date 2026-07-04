#!/bin/sh
# PXX — Entrypoint de Producció (V2 Sovereign)
# Executa prisma db push + seed automàtic i arrenca Next.js.

echo "🏔️  PXX Geocontent — Iniciant..."

# 1. Executar Prisma DB Push per sincronitzar l'esquema
# Usa el path directe al CLI (npx no funciona al standalone)
echo "📦 [Entrypoint] Sincronitzant esquema de la DB..."
node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss 2>&1 || {
  echo "⚠️  [Entrypoint] prisma db push ha fallat. Comproveu els logs anteriors."
}

# 2. Executar el seed automàtic (només si la DB està buida)
echo "🌱 [Entrypoint] Comprovant seed..."
node seed-production.js 2>&1 || {
  echo "⚠️  [Entrypoint] Seed ha fallat. El servidor arrencarà igualment."
}

# 3. Arrancar el servidor Next.js
echo "🚀 [Entrypoint] Arrencant Next.js..."
exec node server.js
