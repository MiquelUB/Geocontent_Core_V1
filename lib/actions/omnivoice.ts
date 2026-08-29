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

    // Crida directa al FastAPI Worker per encuar la tasca a ARQ
    const fastApiUrl = process.env.FASTAPI_PUBLIC_URL_OR_TAILSCALE_IP || 'http://api_core:8000';
    const res = await fetch(`${fastApiUrl}/omnivoice/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poi_id: poi.id,
        voice_id: voiceId || poi.voiceId || 'nova'
      })
    });
    
    if (!res.ok) {
      throw new Error(`FastAPI va retornar error: ${res.status}`);
    }

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

    // Crida directa al FastAPI Worker per encuar la tasca a ARQ
    const fastApiUrl = process.env.FASTAPI_PUBLIC_URL_OR_TAILSCALE_IP || 'http://api_core:8000';
    const res = await fetch(`${fastApiUrl}/omnivoice/video-translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        poi_id: poi.id,
        video_url: videoUrl,
        voice_id: voiceId || poi.voiceId || 'nova'
      })
    });
    
    if (!res.ok) {
      throw new Error(`FastAPI va retornar error: ${res.status}`);
    }

    return { success: true, message: "Traducció de vídeo encuada correctament." };
  } catch (err: any) {
    console.error("[requestVideoTranslation Error]:", err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}
