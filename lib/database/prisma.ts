import 'server-only';
/**
 * PXX — Prisma Client Singleton (V2 Sovereign)
 * Prevents multiple instances in development (hot reload)
 * Uses a Proxy for fully lazy initialization — safe during Next.js static build.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL || "";
  
  // En l'arquitectura sobirana (Hetzner), usem PgBouncer local si cal,
  // però ja no depenem de les URLs de l'antic Pooler.
  const pool = new Pool({
    connectionString: connectionString,
    max: process.env.NODE_ENV === 'development' ? 2 : 20, // Ajustem segons necessitats Hetzner
    idleTimeoutMillis: 30000
  });

  const adapter = new PrismaPg(pool as any);

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Injectar el context RLS des de Prisma (PAS 5.3) de forma compatible amb Prisma v6/v7
  const extendedClient = client.$extends({
    query: {
      $allModels: {
        async $allOperations(options) {
          const { model, operation, args, query } = options;
          // Evitem cridar a auth() per a taules de NextAuth per prevenir bucles infinits de recursió
          const isAuthTable = ['User', 'Session', 'Account', 'VerificationToken'].includes(model);
          if (isAuthTable) {
            return query(args);
          }

          let session = null;
          try {
            const { getCachedSession } = await import("./prisma-rls-cache");
            session = await getCachedSession();
          } catch (err) {
            // Ignorem errors silenciosament fora del context de request (CLI, build, etc.)
          }

          if (session?.user) {
            const userId = session.user.id || '';
            const municipalityId = (session.user as any).municipalityId || '';
            const safeUserId = userId.replace(/[^a-zA-Z0-9-]/g, "");
            const safeMunicipalityId = municipalityId.replace(/[^a-zA-Z0-9-]/g, "");

            const internalParams = (options as any).__internalParams;

            if (internalParams?.transaction) {
              // Si ja estem dins d'una transacció activa (itx), configurem el context de RLS
              // en la mateixa connexió de la transacció utilitzant el client intern de la transacció.
              try {
                const txClient = (client as any)._createItxClient(internalParams.transaction);
                await txClient.$executeRawUnsafe(`
                  SELECT
                    set_config('app.current_user_id', '${safeUserId}', true),
                    set_config('app.current_municipality_id', '${safeMunicipalityId}', true),
                    set_config('app.role', 'user', true);
                `);
              } catch (err) {
                console.error("[Prisma RLS Transaction Extension Error]:", err);
              }
              return query(args);
            } else {
              // Si no estem en transacció, embolcallem la consulta en una transacció de connexió única
              // per assegurar que el set_config s'apliqui en la mateixa connexió física sota PgBouncer.
              return client.$transaction(async (tx: any) => {
                const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
                const txModel = tx[modelKey];
                if (txModel && typeof txModel[operation] === "function") {
                  return txModel[operation](args);
                }
                return query(args);
              });
            }
          }

          return query(args);
        }
      }
    }
  });

  return extendedClient as any;
}

// Lazy singleton — NOT instantiated at import time. Safe for Next.js static build.
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Proxy que retarda l'accés fins al primer ús
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const p = getPrisma() as any;
    const value = p[prop];
    if (typeof value === 'function') {
      return value.bind(p);
    }
    return value;
  },
});

export default prisma;
