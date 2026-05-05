'use server'

import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { prisma } from "../database/prisma";
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getConnection } from '../queue/client';
import crypto from 'crypto';

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';

/**
 * Helper per hashejar el token abans de guardar-lo a Redis (seguretat extra)
 */
function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Registre d'usuari amb contrasenya xifrada
 */
export async function registerUser(name: string, email: string, password?: string) {
  try {
    const hashedPassword = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const isSuperAdmin = Boolean(superAdminEmail && email.toLowerCase() === superAdminEmail.toLowerCase());

    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {
        username: name,
        password: hashedPassword,
        role: isSuperAdmin ? 'super_admin' : undefined
      },
      create: {
        email: email.toLowerCase(),
        username: name,
        password: hashedPassword,
        role: isSuperAdmin ? 'super_admin' : 'tourist',
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

/**
 * PAS 3: Genera tokens i els emmagatzema a la llista blanca de Redis
 */
export async function setAuthTokens(user: { id: string, email: string, role: string }) {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  const rtHash = hashToken(refreshToken);
  const redis = await getConnection();
  
  // Guardem a Redis: user_id:RT_HASH -> 'valid' (Expiració 7 dies)
  await redis.set(`auth:rt:${user.id}:${rtHash}`, '1', 'EX', 604800);

  // Establim la cookie segura
  (await cookies()).set('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });

  return accessToken;
}

/**
 * PAS 3: Logout amb revocació a Redis
 */
export async function logout() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refreshToken')?.value;

  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
      const rtHash = hashToken(refreshToken);
      const redis = await getConnection();
      
      // Eliminem de la llista blanca
      await redis.del(`auth:rt:${decoded.userId}:${rtHash}`);
    } catch (e) {
      // Token ja expirat o invàlid, ignorem
    }
  }

  cookieStore.delete('refreshToken');
  revalidatePath('/');
}

/**
 * PAS 3: Verificació de Refresh Token contra Redis
 */
export async function verifyAndRefreshToken() {
  const refreshToken = (await cookies()).get('refreshToken')?.value;
  if (!refreshToken) return null;

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
    const rtHash = hashToken(refreshToken);
    const redis = await getConnection();

    // Verifiquem si encara és a la llista blanca
    const isValid = await redis.get(`auth:rt:${decoded.userId}:${rtHash}`);
    if (!isValid) return null;

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return null;

    // Generem nou Access Token
    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
  } catch (e) {
    return null;
  }
}

export async function loginOrRegister(name: string, email: string) {
  return registerUser(name, email);
}

export async function getUserProfile(userId: string) {
  noStore();
  return prisma.user.findUnique({
    where: { id: userId },
    include: { municipality: true }
  });
}
