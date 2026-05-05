#!/bin/sh

# scripts/deploy.sh — Script d'arrencada per a Next.js standalone

echo "🚀 Iniciant el desplegament de Geocontent Core V2..."

# 1. Executar migracions de Prisma (Bloqueja l'arrencada fins que la DB està llesta/migrada)
# Es recomana DATABASE_DIRECT_URL per saltar el PgBouncer en mode DDL
if [ "$SKIP_MIGRATIONS" != "true" ]; then
  echo "📦 Executant migracions de Prisma..."
  npx prisma migrate deploy
fi

# 2. Arrencar l'aplicació en mode standalone
echo "📡 Arrencant el servidor Next.js..."
node server.js
