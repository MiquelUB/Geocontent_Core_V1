'use server';

import { prisma } from '@/lib/database/prisma';
import { uploadToS3 } from '@/lib/services/s3';
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
    const currentTranslations = (poi.audioTranslations as any) || {};
    const results: Record<string, string> = { ...currentTranslations };

    for (const locale of locales) {
      // Regla de contingut: Prioritzem textContent, si no description, si no el títol.
      const text = getLocalizedContent(poi, 'textContent', locale) || 
                   getLocalizedContent(poi, 'description', locale) || 
                   getLocalizedContent(poi, 'title', locale);

      if (!text) {
        console.warn(`[Audio] No text found for POI ${poiId} in locale ${locale}`);
        continue;
      }

      console.log(`[Audio] Generating TTS for ${poiId} in ${locale}...`);

      const response = await fetch(OPENROUTER_TTS_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.SITE_URL || "https://projectexinoxano.com",
          "X-Title": "PXX Dashboard",
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL_AUDIO_ID || "openai/gpt-4o-mini-tts-2025-12-15",
          input: text.substring(0, 4000), // OpenAI limit approx
          voice: "shimmer",
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Audio] Error from OpenRouter (${locale}):`, errText);
        continue;
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      const s3Key = `media/pois/${poiId}/audio/${locale}.mp3`;
      
      // Pugem a S3 (Stockholm per defecte segons config)
      await uploadToS3(audioBuffer, s3Key, "audio/mpeg");

      // Construïm la URL pública. 
      // Nota: En producció idealment usaríem un CloudFront o un helper de config.
      const bucket = process.env.S3_BUCKET || "geocontent";
      const region = process.env.S3_REGION || "eu-north-1";
      const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
      
      results[locale] = publicUrl;
    }

    // Actualitzem la base de dades amb les noves URLs
    await prisma.poi.update({
      where: { id: poiId },
      data: { audioTranslations: results }
    });

    return { success: true, data: results };
  } catch (error: any) {
    console.error("Audio Generation Fatal Error:", error);
    return { success: false, error: error.message || "Error desconegut en la generació d'àudio." };
  }
}
