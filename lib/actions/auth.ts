'use server'

import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { prisma } from "../database/prisma";
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import { signIn as authSignIn, signOut as authSignOut } from "@/auth";
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
    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {
        username: name
      },
      create: {
        email: email.toLowerCase(),
        username: name,
        role: 'tourist', // <-- Hardcoded. Zero trust.
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
