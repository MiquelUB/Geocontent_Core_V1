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

  return client;
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
