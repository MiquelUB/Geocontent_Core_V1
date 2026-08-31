'use server';


import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { prisma } from "../database/prisma";
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import { signIn as authSignIn, signOut as authSignOut, auth } from "@/auth";
import { requireAuth } from '@/lib/auth-guard';
import { rateLimit } from '@/lib/services/ratelimit';
import { SECURITY_CONFIG } from '@/lib/config/constants';



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
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes((session.user as any).role)) {
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
  // SEC: Cal sessió activa per consultar perfils d'usuari
  await requireAuth();
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
    if (!municipalityId || municipalityId.trim() === '') {
      return { success: false, error: "Municipality ID is required" };
    }
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(municipalityId);
    if (!isValidUUID) {
      return { success: false, error: "Invalid Municipality ID format" };
    }

    const muni = await prisma.municipality.findUnique({ where: { id: municipalityId } });
    if (!muni) return { success: false, error: "Municipality not found" };
    if (!muni.adminMasterPassword) return { success: false, error: "No password configured" };

    // Suportar fallback per a contrasenyes en text pla de migracions antigues
    let isValid = false;
    if (muni.adminMasterPassword.startsWith('$2') || muni.adminMasterPassword.length === 60) {
      isValid = await bcrypt.compare(password, muni.adminMasterPassword);
    } else {
      isValid = password === muni.adminMasterPassword;
    }

    if (!isValid) return { success: false, error: "Invalid password" };

    return { success: true };
  } catch (err) {
    console.error("Error in verifyAdminPassword:", err);
    return { success: false, error: "Database error" };
  }
}

export async function loginOrRegister(
  name: string,
  email: string,
  emailConsent: boolean = true
): Promise<{success: boolean, user?: any, error?: string}> {
  try {
    // 1. Rate limiting per IP (prevenir spam massiu)
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    const rl = await rateLimit(`register:${ip}`, 5, 3600); // 5 intents/hora per IP
    if (!rl.success) {
      return { success: false, error: 'Massa intents des d\'aquesta IP. Torna-ho a provar en 1 hora.' };
    }

    // 2. Validació d'email amb Zod (prevenir input malformat)
    const emailSchema = z.string().email().max(254);
    const emailParse = emailSchema.safeParse(email.toLowerCase().trim());
    if (!emailParse.success) {
      return { success: false, error: 'Format d\'email no vàlid.' };
    }

    // 3. Validació de nom
    const nameSchema = z.string().min(2).max(100).trim();
    const nameParse = nameSchema.safeParse(name);
    if (!nameParse.success) {
      return { success: false, error: 'El nom ha de tenir entre 2 i 100 caràcters.' };
    }

    // Assignar el municipi per defecte de l'instància
    // Aquest sistema V2 és single-tenant per instància, per tant tots els turistes pertanyen a aquest municipi base
    const defaultMunicipality = await prisma.municipality.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });

    // 4. Upsert amb resposta uniforme (evitar enumeració d'usuaris)
    const user = await prisma.user.upsert({
      where: { email: emailParse.data },
      update: { 
        username: nameParse.data,
        emailConsent: emailConsent,
        termsAcceptedAt: new Date()
      },
      create: {
        email: emailParse.data,
        username: nameParse.data,
        role: 'TOURIST',
        xp: 0,
        level: 1,
        municipalityId: defaultMunicipality?.id || null,
        emailConsent: emailConsent,
        termsAcceptedAt: new Date()
      },
      select: { id: true, email: true, role: true, username: true, municipalityId: true, emailConsent: true } // NO retornar password_hash ni camps interns
    });

    return { success: true, user };
  } catch (err: any) {
    console.error("Error in loginOrRegister:", err.message); // Log intern sense detalls sensibles
    return { success: false, error: 'No s\'ha pogut completar el registre. Torna-ho a provar.' };
  }
}

// --- Gestió d'Usuaris Administradors (Capa 1) ---

export async function getAdminUsers() {
  const session = await auth();
  if (!session || (session.user as any).email !== 'mistic_master') {
    return { success: false, error: "Accés denegat: Només el Super Admin pot llistar gestors." };
  }

  try {
    const users = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, username: true, email: true, createdAt: true }
    });
    return { success: true, users };
  } catch (err: any) {
    console.error("Error getAdminUsers:", err);
    return { success: false, error: "Error de base de dades" };
  }
}

export async function createAdminUser(name: string, email: string, pass: string) {
  const session = await auth();
  if (!session || (session.user as any).email !== 'mistic_master') {
    return { success: false, error: "Accés denegat: Només el Super Admin pot crear gestors." };
  }

  const rl = await rateLimit(`createAdmin:${(session.user as any).email}`, 10, 3600);
  if (!rl.success) return { success: false, error: "Massa peticions de creació." };

  try {
    const emailParse = z.string().email().safeParse(email.trim().toLowerCase());
    if (!emailParse.success) return { success: false, error: "Email no vàlid." };

    const existing = await prisma.user.findUnique({ where: { email: emailParse.data } });
    if (existing) return { success: false, error: "Aquest email ja està registrat." };

    const hash = await bcrypt.hash(pass, 10);
    
    await prisma.user.create({
      data: {
        username: name.trim(),
        email: emailParse.data,
        passwordHash: hash,
        role: 'ADMIN',
        xp: 0,
        level: 1
      }
    });

    return { success: true };
  } catch (err: any) {
    console.error("Error createAdminUser:", err);
    return { success: false, error: "Error de base de dades" };
  }
}

export async function deleteAdminUser(userId: string) {
  const session = await auth();
  if (!session || (session.user as any).email !== 'mistic_master') {
    return { success: false, error: "Accés denegat: Només el Super Admin pot esborrar gestors." };
  }

  try {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return { success: false, error: "Usuari no trobat." };

    if (target.email === 'mistic_master' || target.username === 'mistic_master') {
      return { success: false, error: "Acció crítica bloquejada: No es pot eliminar l'usuari mistic_master." };
    }

    await prisma.user.delete({ where: { id: userId } });
    return { success: true };
  } catch (err: any) {
    console.error("Error deleteAdminUser:", err);
    return { success: false, error: "Error de base de dades" };
  }
}
