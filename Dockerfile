# STAGE 1: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./

# 1. Li diem a Prisma que no intenti generar el client durant el npm install
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

# 2. Instal·lem de forma normal però tolerant conflictes de dependències
RUN npm install --legacy-peer-deps

# 3. Copiem tot el codi font
COPY . .

# 4. Ara sí, generem el client de Prisma
RUN npx prisma generate

# 5. Compilem el frontend de Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# STAGE 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar assets amb permisos correctes (Correcció EACCES)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Garantir que els motors de Prisma estiguin disponibles al runtime standalone
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
