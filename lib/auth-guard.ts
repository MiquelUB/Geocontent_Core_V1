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
 */
export async function requireAdmin(): Promise<{ userId: string; role: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('No autenticat. Sessió requerida.');
  }
  const role = (session.user as any).role;
  if (!role || !['super_admin', 'admin', 'municipal_admin'].includes(role)) {
    throw new Error('Permisos insuficients.');
  }
  return { userId: session.user.id, role };
}
