import { NextResponse } from 'next/server';
import { generateFinalRouteQuiz } from '@/lib/services/openrouter';
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

        const { title, pois } = await req.json();

        if (!pois || pois.length === 0) {
            return NextResponse.json({ success: false, error: "No hi ha punts per generar el quiz." }, { status: 400 });
        }

        const quiz = await generateFinalRouteQuiz(title, pois);

        if (!quiz || !quiz.preguntes) {
            return NextResponse.json({ success: false, error: "Error generant el quiz AI de la ruta." }, { status: 500 });
        }

        return NextResponse.json({ success: true, quiz });
    } catch (error: any) {
        console.error("AI Route Quiz Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
