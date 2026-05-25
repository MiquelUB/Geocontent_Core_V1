'use server';


import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { cookies } from 'next/headers'
import { prisma } from "../database/prisma";
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import { signIn as authSignIn, signOut as authSignOut, auth } from "@/auth";
import { rateLimit } from '@/lib/services/ratelimit';
import { SECURITY_CONFIG } from '@/lib/config/constants';

/**
 * Login via Magic Link (Auth.js v5)
 */
export async function loginWithMagicLink(email: string) {
  try {
    // SEC-04: Rate Limiting
    const { attempts, windowSeconds } = SECURITY_CONFIG.RATE_LIMITS.LOGIN;
    const rl = await rateLimit(`login:${email.toLowerCase()}`, attempts, windowSeconds);
    if (!rl.success) {
      return { success: false, error: 'Massa intents. Espera 5 minuts.' };
    }

    await authSignIn("resend", { email, redirectTo: "/profile" });
    return { success: true };
  } catch (error: any) {
    // Next.js Redirect throws an error that should be caught by the framework
    if (error.type === "Navigation") throw error;
    console.error("Login error:", error);
    return { success: false, error: "Error enviant el Magic Link." };
  }
}

/**
 * Logout (Auth.js v5)
 */
export async function logout() {
  await authSignOut({ redirectTo: "/" });
  revalidatePath('/');
}

/**
 * Registre d'usuari manual (Backup o Admin)
 * SEC-10: Forçar rol base 'tourist'. L'escalada de privilegis només via DB o CLI.
 */
export async function registerUser(name: string, email: string) {
  try {
    const session = await auth();
    if (!session || (session.user as any).role !== 'admin') {
      return { success: false, error: "Accés denegat. Només administradors." };
    }

    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {
        username: name
      },
      create: {
        email: email.toLowerCase(),
        username: name,
        role: 'TOURIST', // <-- Hardcoded. Zero trust.
        xp: 0,
        level: 1
      }
    });

    return { success: true, user: { id: user.id, email: user.email, role: user.role } };
  } catch (err: any) {
    console.error('[registerUser error]', err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function getUserProfile(userId: string) {
  noStore();
  return prisma.user.findUnique({
    where: { id: userId },
    include: { municipality: true }
  });
}

/**
 * Desbloqueja el Dashboard d'Administració mitjançant una cookie segura
 */
export async function unlockAdminDashboard(municipalityId: string, password: string) {
  try {
    const res = await verifyAdminPassword(municipalityId, password);
    
    if (res.success) {
      const cookieStore = await cookies();
      cookieStore.set('admin_master_unlocked', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600 // 1 hora
      });
      
      revalidatePath('/admin');
      return { success: true };
    }
    
    return { success: false, error: res.error || 'Contrasenya incorrecta' };
  } catch (err) {
    console.error("Error unlocking admin dashboard:", err);
    return { success: false, error: 'Error del servidor' };
  }
}

export async function verifyAdminPassword(municipalityId: string, password: string) {
  try {
    const muni = await prisma.municipality.findUnique({ where: { id: municipalityId } });
    if (!muni) return { success: false, error: "Municipality not found" };
    if (muni.adminMasterPassword && muni.adminMasterPassword !== password) {
      return { success: false, error: "Invalid password" };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: "Database error" };
  }
}

export async function loginOrRegister(name: string, email: string): Promise<{success: boolean, user?: any, error?: string}> {
  // TODO: Implementar lògica de Magic Link per a Auth.js v5
  return { success: true, user: { name, email } };
}
