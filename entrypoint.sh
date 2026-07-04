#!/bin/sh
# PXX — Entrypoint de Producció (V2 Sovereign)
# Executa el seed automàtic si la DB està buida i arrenca Next.js.

set -e

echo "🏔️  PXX Geocontent — Iniciant..."

# 1. Executar Prisma DB Push per sincronitzar l'esquema
# Utilitza DATABASE_DIRECT_URL per saltar-se PgBouncer durant DDL
echo "📦 [Entrypoint] Sincronitzant esquema de la DB..."
npx prisma db push --skip-generate 2>&1 || {
  echo "⚠️  [Entrypoint] prisma db push ha fallat. El servidor arrencarà igualment."
}

# 2. Executar el seed automàtic (només si la DB està buida)
echo "🌱 [Entrypoint] Comprovant seed..."
node seed-production.js 2>&1 || {
  echo "⚠️  [Entrypoint] Seed ha fallat. El servidor arrencarà igualment."
}

# 3. Arrancar el servidor Next.js
echo "🚀 [Entrypoint] Arrencant Next.js..."
exec node server.js
