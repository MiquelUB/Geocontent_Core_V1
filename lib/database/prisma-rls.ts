import { prisma } from "./prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";

/**
 * PXX V2 Sovereign — Prisma RLS Extensor
 * 
 * Aquest helper estén el client de Prisma per aplicar de manera automàtica
 * les polítiques de Row Level Security (RLS) definides a la base de dades.
 * 
 * Com que RLS a PostgreSQL depèn del paràmetre de sessió 'app.current_user_id',
 * i Prisma fa pooling de connexions, és IMPRESCINDIBLE que aquest paràmetre
 * es configuri dins d'una transacció LOCAL (`SET LOCAL`).
 * 
 * Totes les operacions fetes amb el client resultant s'executaran dins d'una
 * transacció per assegurar que el setting 'app.current_user_id' només afecti
 * a la petició actual i s'esborri immediatament en acabar, evitant fuites
 * de dades entre ajuntaments / usuaris (multi-tenant leaks).
 */

export function withRLS(userId: string) {
  // Sanitització preventiva de l'UUID / ID d'usuari amb validació de format
  const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const safeUserId = isValidUUID(userId) ? userId : '00000000-0000-0000-0000-000000000000';

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Totes les consultes es corren en una transacció de connexió única
          return prisma.$transaction(async (tx) => {
            // Configurem la variable de sessió de PostgreSQL per a aquesta connexió de transacció
            await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${safeUserId}';`);
            
            // Correm la consulta original utilitzant el context de la transacció
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
            const txModel = (tx as any)[modelKey];
            
            if (txModel && typeof txModel[operation] === "function") {
              return txModel[operation](args);
            }
            
            // Fallback en cas d'operacions no suportades pel model
            return query(args);
          });
        },
      },
    },
    client: {
      async $queryRaw<T = any>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]) {
        return prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${safeUserId}';`);
          return tx.$queryRaw<T>(query, ...values);
        });
      },
      async $executeRaw(query: TemplateStringsArray | Prisma.Sql, ...values: any[]) {
        return prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${safeUserId}';`);
          return tx.$executeRaw(query, ...values);
        });
      }
    }
  });
}

/**
 * Obté una instància del client de Prisma auto-configurada amb l'RLS
 * de l'usuari actual autenticat.
 * 
 * Si no hi ha cap usuari autenticat o sessió, retorna el client global
 * de Prisma normal (les polítiques SELECT públiques seguiran funcionant).
 */
export async function getRLSClient() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    
    if (userId) {
      return withRLS(userId);
    }
  } catch (err) {
    console.error("[getRLSClient] Error resolent la sessió de l'usuari per a RLS:", err);
  }
  
  return prisma;
}
