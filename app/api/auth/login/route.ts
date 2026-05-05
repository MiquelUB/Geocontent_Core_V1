import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { rateLimit } from '@/lib/services/ratelimit';
import bcrypt from 'bcrypt';
import { setAuthTokens } from '@/lib/actions/auth';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email i contrasenya requerits' }, { status: 400 });
    }

    // 1. Aplicar Rate Limit (5 intents per minut per IP)
    const limiter = await rateLimit(ip, 5, 60);
    if (!limiter.success) {
      return NextResponse.json(
        { error: 'Massa intents. Torna-ho a provar en un minut.' }, 
        { status: 429 }
      );
    }

    // 2. Buscar usuari
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: 'Credencials no vàlides' }, { status: 401 });
    }

    // 3. Verificar contrasenya
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Credencials no vàlides' }, { status: 401 });
    }

    // 4. Generar tokens i establir cookie
    const accessToken = await setAuthTokens({
      id: user.id,
      email: user.email,
      role: user.role
    });

    return NextResponse.json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    console.error('[API Login Error]', err);
    return NextResponse.json({ error: 'Error intern de servidor' }, { status: 500 });
  }
}
