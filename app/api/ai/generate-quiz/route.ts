import { NextResponse } from 'next/server';
import { generatePoiQuiz } from '@/lib/services/openrouter';
import { auth } from '@/auth';
import { rateLimit } from '@/lib/services/ratelimit';
import { SECURITY_CONFIG } from '@/lib/config/constants';

export async function POST(req: Request) {
    try {
        // SEC-02: Auth guard — prevenir abús de quota d'IA
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'No autoritzat.' }, { status: 401 });
        }

        // SEC-04: Rate Limiting
        const { attempts, windowSeconds } = SECURITY_CONFIG.RATE_LIMITS.AI_GENERATE;
        const rl = await rateLimit(`ai:${session.user.id}`, attempts, windowSeconds);
        if (!rl.success) {
            return NextResponse.json({ success: false, error: 'Massa peticions. Espera un minut.' }, { status: 429 });
        }

        const body = await req.json();
        const { title, content, type } = body;

        if (!title || !content) {
            return NextResponse.json({
                success: false,
                error: "Manca el títol o el contingut del punt per generar el quiz."
            }, { status: 400 });
        }

        const quiz = await generatePoiQuiz(title, content, type || 'CIVIL');

        if (!quiz || Object.keys(quiz).length === 0) {
            return NextResponse.json({
                success: false,
                error: "El motor d'IA no ha pogut generar un quiz vàlid. Prova de nou."
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, quiz });
    } catch (error: any) {
        console.error("AI Quiz Route Error:", error);
        return NextResponse.json({
            success: false,
            error: "S'ha produït un error de connexió amb el servei d'IA."
        }, { status: 500 });
    }
}
