'use server';

import { prisma } from '@/lib/database/prisma';
import { getDefaultMunicipalityId } from '@/lib/actions/queries';
import { getLocalizedContent } from '@/lib/i18n-db';
import { auth } from '@/auth';
import { rateLimit } from '@/lib/services/ratelimit';
import { SECURITY_CONFIG } from '@/lib/config/constants';

const OPENROUTER_TTS_URL = "https://openrouter.ai/api/v1/audio/speech";

/**
 * Genera audioguies per a tots els idiomes suportats d'un POI específic.
 * Utilitza el model gpt-4o-mini-tts via OpenRouter.
 */
export async function generatePoiAudiosAction(poiId?: string, formTexts?: Record<string, string>) {
  try {
    const session = await auth();
    if (!session) {
      return { success: false, error: 'Sessió requerida.' };
    }

    const idToUse = poiId || `temp-${Date.now()}`;
    const rl = await rateLimit(`audio:${idToUse}`, 5, 60);
    if (!rl.success) {
      return { success: false, error: "Massa peticions de generació d'àudio. Espera un minut." };
    }

    let poi = poiId ? await prisma.poi.findUnique({ where: { id: poiId } }) : null;

    const locales = ['ca', 'es', 'en', 'fr'];
    const texts: Record<string, string> = {};

    for (const locale of locales) {
      let text: string | undefined = formTexts?.[locale];
      if (!text && poi) {
        if (locale === 'ca' && poi.voiceScript) {
          text = poi.voiceScript;
        } else {
          // Regla de contingut: Prioritzem textContent, si no description, si no el títol.
          text = getLocalizedContent(poi, 'textContent', locale) || 
                 getLocalizedContent(poi, 'description', locale) || 
                 getLocalizedContent(poi, 'title', locale);
        }
      }
      
      if (text && text.trim()) {
        texts[locale] = text.trim();
      } else {
        console.warn(`[Audio] No text found for POI ${idToUse} in locale ${locale}`);
      }
    }

    if (Object.keys(texts).length === 0) {
      return { success: false, error: "No hi ha text per generar àudios en cap idioma." };
    }

    const fastApiUrl = process.env.INTERNAL_API_URL || 'http://127.0.0.1:8000';
    console.log(`[Audio] Cridant FastAPI (Múscul) per generar àudios sincrònicament pel POI ${idToUse}...`);

    const response = await fetch(`${fastApiUrl}/audio/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poi_id: idToUse, texts })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Audio] FastAPI Error:`, errText);
      return { success: false, error: `Error del Múscul (FastAPI): ${response.statusText}` };
    }

    const result = await response.json();
    if (!result.success) {
      return { success: false, error: "Error intern en la generació d'àudio a FastAPI." };
    }

    const currentTranslations = poi ? ((poi.audioTranslations as any) || {}) : {};
    const newTranslations = { ...currentTranslations, ...result.urls };
    const defaultAudioUrl = (poi?.audioUrl) || newTranslations['ca'] || Object.values(newTranslations)[0] || '';

    if (poiId && poi) {
      // Actualitzem la base de dades si el POI ja existeix
      await prisma.poi.update({
        where: { id: poiId },
        data: { 
          audioTranslations: newTranslations,
          ...(defaultAudioUrl ? { audioUrl: defaultAudioUrl } : {})
        }
      });
    }

    return { success: true, data: newTranslations };

    return { success: true, data: newTranslations };
  } catch (error: any) {
    console.error("Audio Generation Fatal Error:", error);
    return { success: false, error: error.message || "Error desconegut en la generació d'àudio." };
  }
}
