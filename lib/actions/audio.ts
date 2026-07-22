'use server';

import { prisma } from '@/lib/database/prisma';
import { getDefaultMunicipalityId } from '@/lib/actions/queries';
import { getLocalizedContent } from '@/lib/i18n-db';

const OPENROUTER_TTS_URL = "https://openrouter.ai/api/v1/audio/speech";

/**
 * Genera audioguies per a tots els idiomes suportats d'un POI específic.
 * Utilitza el model gpt-4o-mini-tts via OpenRouter.
 */
export async function generatePoiAudiosAction(poiId: string) {
  try {
    const poi = await prisma.poi.findUnique({ where: { id: poiId } });
    if (!poi) return { success: false, error: "POI no trobat." };

    const locales = ['ca', 'es', 'en', 'fr'];
    const texts: Record<string, string> = {};

    for (const locale of locales) {
      // Regla de contingut: Prioritzem textContent, si no description, si no el títol.
      const text = getLocalizedContent(poi, 'textContent', locale) || 
                   getLocalizedContent(poi, 'description', locale) || 
                   getLocalizedContent(poi, 'title', locale);
      
      if (text) {
        texts[locale] = text;
      } else {
        console.warn(`[Audio] No text found for POI ${poiId} in locale ${locale}`);
      }
    }

    if (Object.keys(texts).length === 0) {
      return { success: false, error: "No hi ha text per generar àudios." };
    }

    const fastApiUrl = process.env.INTERNAL_API_URL || 'http://127.0.0.1:8000';
    console.log(`[Audio] Cridant FastAPI (Múscul) per generar àudios sincrònicament pel POI ${poiId}...`);

    const response = await fetch(`${fastApiUrl}/audio/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poi_id: poiId, texts })
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

    const currentTranslations = (poi.audioTranslations as any) || {};
    const newTranslations = { ...currentTranslations, ...result.urls };
    const defaultAudioUrl = poi.audioUrl || newTranslations['ca'] || Object.values(newTranslations)[0] || '';

    // Actualitzem la base de dades amb les noves URLs i el camp base audioUrl
    await prisma.poi.update({
      where: { id: poiId },
      data: { 
        audioTranslations: newTranslations,
        ...(defaultAudioUrl ? { audioUrl: defaultAudioUrl } : {})
      }
    });

    return { success: true, data: newTranslations };
  } catch (error: any) {
    console.error("Audio Generation Fatal Error:", error);
    return { success: false, error: error.message || "Error desconegut en la generació d'àudio." };
  }
}
