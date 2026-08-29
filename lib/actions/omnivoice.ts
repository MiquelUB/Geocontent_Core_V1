'use server'

import { auth } from "@/auth";
import { prisma } from "../database/prisma";
import { rateLimit } from '@/lib/services/ratelimit';
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';

/**
 * Envia una petició de generació de Text-to-Speech (Omnivoice) a l'Outbox (ARQ).
 */
export async function requestTtsGeneration(poiId: string, voiceId?: string) {
  try {
    const session = await auth();
    if (!session || !session.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return { success: false, error: "Accés denegat: Només els administradors poden generar àudio." };
    }

    const userId = session.user.id;
    
    // Rate Limiting: 10 peticions per hora per usuari per evitar costos massius d'IA
    const rl = await rateLimit(`omnivoice_tts:${userId}`, 10, 3600);
    if (!rl.success) {
      return { success: false, error: "Massa peticions de generació d'àudio. Si us plau, espera una estona." };
    }

    // Verificar que el POI existeix i l'usuari té permís (és del mateix municipi o super_admin)
    const poi = await prisma.poi.findUnique({
      where: { id: poiId },
      include: {
        routePois: {
          include: {
            route: true
          }
        }
      }
    });

    if (!poi) return { success: false, error: "POI no trobat." };

    // Verificació multi-tenant
    if (session.user.role !== 'SUPER_ADMIN') {
      const isOwner = poi.routePois.some(rp => rp.route.municipalityId === session.user.municipalityId);
      if (!isOwner) {
        return { success: false, error: "Accés denegat: Aquest POI no pertany al teu municipi." };
      }
    }

    // Inserir a l'Outbox per ser processat asíncronament pel worker de Python
    await prisma.outboxEvent.create({
      data: {
        topic: 'GENERATE_TTS',
        payload: {
          poiId: poi.id,
          userId: userId,
          voiceId: voiceId || poi.voiceId || null,
          voiceScript: poi.voiceScript || poi.textContent || poi.description || ''
        },
        status: 'PENDING'
      }
    });

    return { success: true, message: "Generació d'àudio encuada correctament." };
  } catch (err: any) {
    console.error("[requestTtsGeneration Error]:", err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

/**
 * Envia una petició de traducció i doblatge de vídeo a l'Outbox (ARQ).
 */
export async function requestVideoTranslation(poiId: string, videoUrl: string, voiceId?: string) {
  try {
    const session = await auth();
    if (!session || !session.user || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return { success: false, error: "Accés denegat: Només els administradors poden traduir vídeos." };
    }

    const userId = session.user.id;
    
    // Rate Limiting: 5 peticions de vídeo per hora per usuari
    const rl = await rateLimit(`omnivoice_video:${userId}`, 5, 3600);
    if (!rl.success) {
      return { success: false, error: "Massa peticions de traducció de vídeo. Si us plau, espera una estona." };
    }

    const poi = await prisma.poi.findUnique({
      where: { id: poiId },
      include: {
        routePois: {
          include: {
            route: true
          }
        }
      }
    });

    if (!poi) return { success: false, error: "POI no trobat." };

    if (session.user.role !== 'SUPER_ADMIN') {
      const isOwner = poi.routePois.some(rp => rp.route.municipalityId === session.user.municipalityId);
      if (!isOwner) {
        return { success: false, error: "Accés denegat: Aquest POI no pertany al teu municipi." };
      }
    }

    // Inserir a l'Outbox per ser processat asíncronament pel worker de Python
    await prisma.outboxEvent.create({
      data: {
        topic: 'TRANSLATE_VIDEO',
        payload: {
          poiId: poi.id,
          userId: userId,
          videoUrl: videoUrl,
          voiceId: voiceId || poi.voiceId || null
        },
        status: 'PENDING'
      }
    });

    return { success: true, message: "Traducció de vídeo encuada correctament." };
  } catch (err: any) {
    console.error("[requestVideoTranslation Error]:", err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}
