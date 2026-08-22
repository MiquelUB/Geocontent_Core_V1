# STAGE 1: Builder
# CACHE BUSTER FOR RUN_MIGRATION: 2026-08-22T21:33:00Z
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl libc6-compat chromium nss

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app

COPY package.json package-lock.json ./

# 1. COPIEM LA CARPETA PRISMA ABANS DE L'INSTALL
COPY prisma ./prisma/

# 2. Instal·lem les dependències. Ara el teu postinstall funcionarà perquè ja té el schema!
RUN npm install --legacy-peer-deps

# 3. Copiem la resta del codi font
COPY . .

# 4. Generem la resta i compilem
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN npm run build

# STAGE 2: Runner
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar la carpeta prisma per a migracions i schema en runtime
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./

# Copiar assets amb permisos correctes (Correcció EACCES)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Garantir que els motors de Prisma estiguin disponibles al runtime standalone
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copiar mòduls necessaris per al runtime de Prisma (inclou dependències de Prisma 7.x)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs


# Dependències de Prisma 7.x — FIX CRÍTIC:
# @prisma/config té el seu PROPI node_modules/ anidal amb effect+fast-check+pure-rand.
# Hem de copiar-los explícitament o el runtime no els troba.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/fast-check ./node_modules/fast-check
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/effect ./node_modules/effect
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pure-rand ./node_modules/pure-rand
# Mòduls anidats dins de @prisma/config (versió local d'effect i les seves deps)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/config/node_modules ./node_modules/@prisma/config/node_modules

# Copiar l'entrypoint i el seed de producció
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh ./entrypoint.sh
COPY --from=builder --chown=nextjs:nodejs /app/run_migration.js ./run_migration.js
COPY --from=builder --chown=nextjs:nodejs /app/seed-production.js ./seed-production.js

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "entrypoint.sh"]
