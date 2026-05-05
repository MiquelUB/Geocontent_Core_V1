import { NextResponse } from 'next/server';
import { getLegends } from '@/lib/actions/queries';
import { auth } from '@/auth';

/**
 * GET /api/debug-legends
 * 
 * Ruta de diagnòstic. Protegida per autenticació i bloquejada en producció.
 */
export async function GET() {
    // SEC-02: Bloquejar ruta de debug en producció
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Ruta desactivada en producció.' }, { status: 404 });
    }

    // En dev, requerir sessió igualment
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'No autoritzat.' }, { status: 401 });
    }

    const data = await getLegends();
    return NextResponse.json(data);
}
