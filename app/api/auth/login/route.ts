import { NextResponse } from 'next/server';

/**
 * POST /api/auth/login
 * 
 * DEPRECAT: Redirigit a Auth.js v5 (Magic Links).
 * Aquesta ruta existeix per mantenir compatibilitat amb clients antics
 * que encara podrien fer POST a /api/auth/login.
 */
export async function POST() {
  return NextResponse.json(
    { 
      error: 'Login amb password desactivat. Usa /auth/signin per accedir amb Magic Link.',
      redirect: '/auth/signin' 
    }, 
    { status: 410 } // 410 Gone
  );
}

export async function GET() {
  return NextResponse.redirect(new URL('/auth/signin', process.env.NEXTAUTH_URL || 'http://localhost:3000'));
}
