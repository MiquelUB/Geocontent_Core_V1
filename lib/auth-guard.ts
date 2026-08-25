'use server'

import { auth } from '@/auth';

/**
 * Helper d'autenticació per a Server Actions i API Routes.
 * Retorna el userId autenticat o llança un error.
 *
 * Ús: const userId = await requireAuth();
 */
export async function requireAuth(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('No autenticat. Sessió requerida.');
  }
  return session.user.id;
}

/**
 * Helper per a rutes d'admin. Retorna userId i rol.
 * FIX: Els rols de Prisma/NextAuth JWT són en MAJÚSCULES (ADMIN, SUPER_ADMIN, MUNICIPAL_ADMIN).
 */
export async function requireAdmin(): Promise<{ userId: string; role: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('No autenticat. Sessió requerida.');
  }
  const role = (session.user as any).role as string;
  if (!role || !['SUPER_ADMIN', 'ADMIN', 'MUNICIPAL_ADMIN'].includes(role)) {
    throw new Error('Permisos insuficients.');
  }
  return { userId: session.user.id, role };
}

/**
 * Helper exclusiu per a operacions de Super Admin (manteniment, CLI, etc.).
 * Retorna el userId autenticat o llança un error.
 */
export async function requireSuperAdmin(): Promise<string> {
  const { userId, role } = await requireAdmin();
  if (role !== 'SUPER_ADMIN') {
    throw new Error('Permisos de Super Admin requerits.');
  }
  return userId;
}
