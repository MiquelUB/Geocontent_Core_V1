'use server'


import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { prisma } from "../database/prisma";

import { z } from 'zod';
import { generatePoiQuiz, generateFinalRouteQuiz } from '../services/openrouter';
import { checkPlanLimits, canAddPoiToRoute } from '../planLimits';
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import { uploadFile } from './storage';
import { autoTranslateAction } from './ai';
import { getDefaultMunicipalityId, getRouteWithPois as _getRouteWithPois } from '../services/queries';
import { auth } from "@/auth";
import { requireAdmin } from '@/lib/auth-guard';
import { rateLimit } from '@/lib/services/ratelimit';

// Server Action Wrapper per a Client Components
export async function getRouteWithPois(routeId: string) {
  return _getRouteWithPois(routeId);
}

function mergeTranslations(existing: Record<string, string>, incoming: Record<string, string>): Record<string, string> {
  if (!existing || typeof existing !== 'object') existing = {};
  const result = { ...existing };
  if (incoming && typeof incoming === 'object') {
    for (const [key, value] of Object.entries(incoming)) {
      if (typeof value === 'string' && value.trim() !== '') {
        result[key] = value.trim();
      }
    }
  }
  return result;
}



// --- Validació de Dades (Zod) ---

const CreateLegendSchema = z.object({
  title: z.string().min(1, "El títol és obligatori"),
  description: z.string().optional(),
  category: z.string().optional(),
  latitude: z.coerce.number().min(40, "Latitud massa baixa").max(43, "Latitud massa alta").optional(),
  longitude: z.coerce.number().min(0, "Longitud massa baixa").max(4, "Longitud massa alta").optional(),
  route_id: z.string().uuid().optional().nullable(),
  text_content: z.string().optional(),
  carousel_images: z.string().optional().transform(val => {
    try { return val ? JSON.parse(val) : [] } catch { return [] }
  }),
  title_translations: z.string().optional().transform(val => {
    try { return val ? JSON.parse(val) : {} } catch { return {} }
  }),
  description_translations: z.string().optional().transform(val => {
    try { return val ? JSON.parse(val) : {} } catch { return {} }
  })
});

const CreatePoiSchema = z.object({
  title: z.string().min(1, "El títol és obligatori"),
  description: z.string().optional(),
  latitude: z.coerce.number().min(40, "Latitud fora de rang (Catalunya)").max(43, "Latitud fora de rang (Catalunya)"),
  longitude: z.coerce.number().min(0, "Longitud fora de rang (Catalunya)").max(4, "Longitud fora de rang (Catalunya)"),
  route_id: z.string().uuid().optional().nullable().catch(null),
  text_content: z.string().optional(),
  voice_script: z.string().optional(),
  type: z.string().optional(),
  manual_quiz: z.string().optional().transform(val => {
    try { return val ? JSON.parse(val) : null } catch { return null }
  }),
  video_urls: z.string().optional().transform(val => {
    try { return val ? JSON.parse(val) : [] } catch { return [] }
  }),
  carousel_images: z.string().optional().transform(val => {
    try { return val ? JSON.parse(val) : [] } catch { return [] }
  }),
  carousel_captions: z.string().optional().transform(val => {
    try { return val ? JSON.parse(val) : [] } catch { return [] }
  }),
  icon: z.string().optional(),
  title_translations: z.string().optional().transform(val => {
    try { return val ? JSON.parse(val) : {} } catch { return {} }
  }),
  description_translations: z.string().optional().transform(val => {
    try { return val ? JSON.parse(val) : {} } catch { return {} }
  }),
  text_content_translations: z.string().optional().transform(val => {
    try { return val ? JSON.parse(val) : {} } catch { return {} }
  })
});

// --- Funcions de Municipis ---

export async function getOrCreateMunicipalityByName(name: string): Promise<string> {
  const slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  const existing = await prisma.municipality.findUnique({
    where: { slug }
  });
  if (existing) return existing.id;

  const created = await prisma.municipality.create({
    data: { name, slug }
  });
  return created.id;
}



import { updateMunicipalityInternal } from '../services/municipality-service';

export async function updateMunicipality(id: string, name: string, logoUrl?: string, themeId?: string, adminMasterPassword?: string, planTier?: string, extraRoutesCount?: number) {
  const session = await auth();
  if (!session) return { success: false, error: "Accés denegat: Sessió requerida per modificar la configuració." };

  const rl = await rateLimit(`updateMunicipality:${id}`, 10, 60);
  if (!rl.success) return { success: false, error: "Massa peticions d'actualització. Torna a intentar-ho d'aquí a 1 minut." };

  return updateMunicipalityInternal(id, name, logoUrl, themeId, adminMasterPassword, planTier, extraRoutesCount);
}


// --- Funcions de Contingut (Rutes i POIs) ---

export async function createLegend(formData: FormData) {
  try {
    const session = await auth();
    if (!session) return { success: false, error: "Sessió requerida." };

    const validated = CreateLegendSchema.parse(Object.fromEntries(formData.entries()));

    const routeThumbnailFile = formData.get('thumbnail_file') as File || null
    const appThumbFile = formData.get('app_thumbnail_file') as File || null
    const headerFile = formData.get('header_file') as File || null
    const audioFile = formData.get('audio_file') as File || null
    const videoFile = formData.get('video_file') as File || null

    const routeThumbnail = routeThumbnailFile?.size > 0 ? await uploadFile(routeThumbnailFile) : (formData.get('thumbnail_1x1') as string || '')
    const appThumbnail = appThumbFile?.size > 0 ? await uploadFile(appThumbFile) : (formData.get('app_thumbnail') as string || '')
    const header16x9 = headerFile?.size > 0 ? await uploadFile(headerFile) : (formData.get('header_16x9') as string || '')
    const audio_url = audioFile?.size > 0 ? await uploadFile(audioFile) : (formData.get('audio_url') as string || '')
    const video_url = videoFile?.size > 0 ? await uploadFile(videoFile) : (formData.get('video_url') as string || '')

    const { title, description, category, latitude, longitude, route_id, text_content, carousel_images, title_translations, description_translations } = validated;

    const validThemes: string[] = ['mountain', 'coast', 'city', 'interior', 'bloom'];
    let themeId = category?.toLowerCase() as any;
    if (!validThemes.includes(themeId)) themeId = "mountain";

    const municipalityId = await getDefaultMunicipalityId();
    if (!municipalityId) return { success: false, error: GENERIC_ERROR_MESSAGE };

    const result = await prisma.$transaction(async (tx) => {
      const route = await tx.route.create({
        data: {
          municipalityId,
          name: title,
          nameTranslations: title_translations as any,
          slug: title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') + '-' + Date.now(),
          description,
          descriptionTranslations: description_translations as any,
          themeId,
          thumbnail1x1: routeThumbnail || null
        }
      });

      const targetRouteId = route_id || route.id;

      const poi = await tx.poi.create({
        data: {
          title: title,
          titleTranslations: title_translations as any,
          description,
          descriptionTranslations: description_translations as any,
          audioUrl: audio_url,
          videoUrls: video_url ? [video_url] : [],
          textContent: text_content,
          textContentTranslations: {}, // Por defecto vacío en leyenda
          appThumbnail,
          header16x9,
          carouselImages: carousel_images as string[]
        }
      });

      await tx.routePoi.create({
        data: {
          routeId: targetRouteId,
          poiId: poi.id,
          orderIndex: 0
        }
      });

      return route;
    });

    return { success: true, id: result.id };
  } catch (err: any) {
    console.error("[createLegend error]", err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function createRoute(formData: FormData) {
  const name = formData.get('title') as string
  const description = formData.get('description') as string || ''
  const category = formData.get('category') as string || 'mountain'
  const thumbnailFile = formData.get('thumbnail_file') as File || null
  let thumbnail1x1 = formData.get('thumbnail_1x1') as string || ''
  let header16x9 = formData.get('header_16x9') as string || ''

  if (thumbnailFile && thumbnailFile.size > 0) {
    thumbnail1x1 = await uploadFile(thumbnailFile);
  }

  const location = formData.get('location') as string || 'General'
  const downloadRequired = formData.get('download_required') === 'true';
  const municipalityId = formData.get('municipality_id') as string || await getOrCreateMunicipalityByName(location);

  let finalQuizInfo = null;
  const finalQuizRaw = formData.get('final_quiz') as string;
  if (finalQuizRaw) {
    try { finalQuizInfo = JSON.parse(finalQuizRaw); } catch (e) { }
  }

  // Traducciones
  let nameTranslations = {};
  let descTranslations = {};
  try {
    const nt = formData.get('name_translations') as string;
    const dt = formData.get('description_translations') as string;
    if (nt) nameTranslations = JSON.parse(nt);
    if (dt) descTranslations = JSON.parse(dt);
  } catch (e) { }

  try {
    const session = await auth();
    if (!session) return { success: false, error: "Sessió requerida." };

    const limits = await checkPlanLimits(municipalityId);
    if (!limits.isWithinRouteLimit) {
      return {
        success: false,
        error: `HAS ASSOLIT EL LÍMIT DEL TEU PLA (${limits.planName}: ${limits.maxRoutes} rutes). Contacta amb suport per un add-on de ruta (+500€/any) o puja de pla.`
      };
    }

    const id = crypto.randomUUID();
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') + '-' + id.split('-')[0];

    await prisma.route.create({
      data: {
        id,
        name,
        nameTranslations: nameTranslations as any,
        slug,
        description,
        descriptionTranslations: descTranslations as any,
        municipalityId,
        themeId: category as any,
        thumbnail1x1: thumbnail1x1 || null,
        header16x9: header16x9 || null,
        finalQuiz: finalQuizInfo,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    revalidatePath('/admin', 'layout');
    revalidatePath('/', 'layout');

    // Traducció automàtica silenciosa en segon pla (múscul IA)
    // void + catch() per desacoblar la promesa del Server Action i no bloquejar la resposta
    void import('@/lib/actions/ai').then(m => m.autoTranslateAction('route', id)).catch(err => console.error('AutoTranslate Background Error:', err));

    return { success: true, id };
  } catch (err: any) {
    console.error("createRoute Error:", err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function updateRoute(id: string, formData: FormData) {
  try {
    // SEC: Requereix rol d'admin per modificar rutes
    await requireAdmin();
    const existingRoute = await prisma.route.findUnique({ where: { id } });
    if (!existingRoute) return { success: false, error: "Ruta no trobada." };

    const nameParam = formData.get('title') as string;
    const name = nameParam || existingRoute.name || '';

    const descParam = formData.get('description') as string;
    const description = descParam || existingRoute.description || '';

    const location = formData.get('location') as string || '';
    const category = formData.get('category') as string || existingRoute.themeId || 'mountain';
    const thumbnailFile = formData.get('thumbnail_file') as File || null;

    let thumbnail1x1 = (formData.get('thumbnail_1x1') as string) || existingRoute.thumbnail1x1 || '';
    if (thumbnailFile && thumbnailFile.size > 0) {
      thumbnail1x1 = await uploadFile(thumbnailFile);
    }

    const headerFile = formData.get('header_file') as File || null;
    let header16x9 = (formData.get('header_16x9') as string) || existingRoute.header16x9 || '';
    if (headerFile && headerFile.size > 0) {
      header16x9 = await uploadFile(headerFile);
    }

    const muniId = formData.get('municipality_id') as string;
    const downloadRequired = formData.get('download_required') === 'true';
    const locationMuniId = await getOrCreateMunicipalityByName(location);

    let finalQuizInfo = existingRoute.finalQuiz;
    const finalQuizRaw = formData.get('final_quiz') as string;
    if (finalQuizRaw) {
      try { finalQuizInfo = JSON.parse(finalQuizRaw); } catch (e) { }
    }

    // Traducciones (merge amb les existents)
    let nameTranslations = (existingRoute.nameTranslations as any) || {};
    let descTranslations = (existingRoute.descriptionTranslations as any) || {};
    try {
      const nt = formData.get('name_translations') as string;
      const dt = formData.get('description_translations') as string;
      if (nt) nameTranslations = mergeTranslations(nameTranslations, JSON.parse(nt));
      if (dt) descTranslations = mergeTranslations(descTranslations, JSON.parse(dt));
    } catch (e) { }

    await prisma.route.update({
      where: { 
        id,
        // Multi-tenancy check: ensure the route belongs to the admin's municipality
        municipalityId: muniId || undefined 
      },
      data: {
        name,
        nameTranslations: nameTranslations as any,
        description,
        descriptionTranslations: descTranslations as any,
        municipalityId: locationMuniId || muniId || undefined,
        themeId: category as any,
        thumbnail1x1: thumbnail1x1 || null,
        header16x9: header16x9 || null,
        finalQuiz: finalQuizInfo || undefined,
        updatedAt: new Date()
      }
    });

    revalidatePath('/admin', 'layout');
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (err: any) {
    console.error("updateRoute Error:", err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function deleteLegend(id: string, municipalityId?: string) {
  try {
    // SEC: Requereix rol d'admin per eliminar rutes
    await requireAdmin();
    await prisma.route.delete({
      where: { 
        id,
        municipalityId: municipalityId || undefined
      }
    });
    revalidatePath('/admin', 'layout');
    revalidatePath('/', 'layout');

    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function createPoi(formData: FormData) {
  try {
    console.log('[createPoi] 1/8 - Starting...');
    const session = await auth();
    if (!session) return { success: false, error: "Sessió requerida." };

    console.log('[createPoi] 2/8 - Validating Schema...');
    const validated = CreatePoiSchema.parse(Object.fromEntries(formData.entries()));
    const { title, description, latitude, longitude, route_id, text_content, voice_script, video_urls, carousel_images, carousel_captions, icon, title_translations, description_translations, text_content_translations } = validated;
    console.log('[createPoi] 2/8 - Schema OK. lat=%s, lng=%s, route_id=%s', latitude, longitude, route_id);

    const appThumbFile = formData.get('app_thumbnail_file') as File || null
    const headerFile = formData.get('header_file') as File || null
    const audioFile = formData.get('audio_file') as File || null

    console.log('[createPoi] 3/8 - Processing Media URLs...');
    const appThumbnail = appThumbFile?.size > 0 ? await uploadFile(appThumbFile) : (formData.get('app_thumbnail') as string || '')
    const header16x9 = headerFile?.size > 0 ? await uploadFile(headerFile) : (formData.get('header_16x9') as string || '')
    const audioUrl = audioFile?.size > 0 ? await uploadFile(audioFile) : (formData.get('audio_url') as string || '')

    const videoSlotCount = parseInt(formData.get('video_slot_count') as string || '0', 10)
    const uploadedVideoUrls: string[] = []
    for (let i = 0; i < videoSlotCount; i++) {
      const file = formData.get(`video_file_${i}`) as File | null
      if (file && file.size > 0) {
        uploadedVideoUrls.push(await uploadFile(file))
      }
    }

    const finalVideoUrls = [
      ...uploadedVideoUrls,
      ...(video_urls as string[]).filter(u => u && u.startsWith('http') && !uploadedVideoUrls.includes(u))
    ]

    const carouselFileCount = parseInt(formData.get('carousel_file_count') as string || '0', 10)
    const carouselUrlsFromForm = carousel_images as string[]
    const finalCarouselImages: string[] = []

    if (carouselFileCount === 0 && carouselUrlsFromForm.length > 0) {
      carouselUrlsFromForm.forEach(u => finalCarouselImages.push(u))
    } else {
      let urlIdx = 0
      for (let i = 0; i < carouselFileCount; i++) {
        const file = formData.get(`carousel_file_${i}`) as File | null
        if (file && file.size > 0) {
          finalCarouselImages.push(await uploadFile(file))
        } else if (carouselUrlsFromForm[urlIdx]) {
          finalCarouselImages.push(carouselUrlsFromForm[urlIdx])
          urlIdx++
        }
      }
    }

    console.log('[createPoi] 4/8 - Getting municipalityId...');
    let municipalityId = await getDefaultMunicipalityId();

    if (route_id) {
      const parentRoute = await prisma.route.findUnique({
        where: { id: route_id },
        select: { municipalityId: true }
      });
      if (parentRoute?.municipalityId) {
        municipalityId = parentRoute.municipalityId;
      }
    }

    if (!municipalityId) return { success: false, error: GENERIC_ERROR_MESSAGE };

    console.log('[createPoi] 5/8 - Checking Plan Limits...');
    if (route_id) {
      const canAdd = await canAddPoiToRoute(route_id);
      if (!canAdd) {
        return { success: false, error: "S'ha assolit el límit de POIs per aquesta ruta segons el teu pla." };
      }
    }

    const existingCount = route_id
      ? await prisma.routePoi.count({ where: { routeId: route_id } })
      : 0;

    let audio_translations = undefined;
    try {
      const at = formData.get('audio_translations') as string;
      if (at) audio_translations = JSON.parse(at);
    } catch (e) {}

    console.log('[createPoi] 6/8 - Database Transaction...');
    const result = await prisma.$transaction(async (tx) => {
      const poi = await tx.poi.create({
        data: {
          title,
          titleTranslations: title_translations as any,
          description,
          descriptionTranslations: description_translations as any,
          latitude,
          longitude,
          audioUrl,
          audioTranslations: audio_translations as any,
          videoUrls: finalVideoUrls,
          textContent: text_content,
          voiceScript: voice_script || null,
          textContentTranslations: text_content_translations as any,
          type: validated.type ? (validated.type as any) : null,
          manualQuiz: validated.manual_quiz,
          appThumbnail,
          header16x9,
          icon,
          carouselImages: finalCarouselImages,
          carouselCaptions: carousel_captions
        }
      });

      if (route_id) {
        await tx.routePoi.create({
          data: {
            routeId: route_id,
            poiId: poi.id,
            orderIndex: existingCount
          }
        });
      }
      return poi;
    }, { maxWait: 10000, timeout: 30000 });

    console.log('[createPoi] 7/8 - Revalidating & Translation...');
    revalidatePath('/admin', 'layout');
    revalidatePath('/', 'layout');

    // Traducció automàtica silenciosa en segon pla (múscul IA)
    void import('@/lib/actions/ai').then(m => m.autoTranslateAction('poi', result.id)).catch(err => console.error('AutoTranslate Background Error:', err));

    console.log('[createPoi] 8/8 - Done!');
    return { success: true, id: result.id };
  } catch (err: any) {
    console.error('[createPoi error]', err);
    // Retornem l'error real per depurar el timeout o ZodError
    return { success: false, error: err.message || JSON.stringify(err) };
  }
}

export async function updatePoi(id: string, formData: FormData) {
  try {
    console.log(`[updatePoi ${id}] 1/5 - Fetching existing POI...`);
    const session = await auth();
    if (!session) return { success: false, error: "Sessió requerida." };

    const existingPoi = await prisma.poi.findUnique({ where: { id } });
    if (!existingPoi) return { success: false, error: "POI no trobat." };

    const titleParam = formData.get('title') as string;
    const title = titleParam || existingPoi.title;

    const descParam = formData.get('description') as string;
    const description = descParam || existingPoi.description || '';

    const textContentParam = formData.get('text_content') as string;
    const textContent = textContentParam || existingPoi.textContent || '';

    const voiceScriptParam = formData.get('voice_script') as string;
    const voiceScript = voiceScriptParam || existingPoi.voiceScript || null;

    const latStr = formData.get('latitude') as string;
    const lngStr = formData.get('longitude') as string;
    const latitude = latStr ? parseFloat(latStr) : existingPoi.latitude;
    const longitude = lngStr ? parseFloat(lngStr) : existingPoi.longitude;

    const appThumbFile = formData.get('app_thumbnail_file') as File | null;
    const headerFile = formData.get('header_file') as File | null;
    const audioFile = formData.get('audio_file') as File | null;

    console.log(`[updatePoi ${id}] 2/5 - Processing Media...`);
    const appThumbParam = formData.get('app_thumbnail') as string;
    const appThumbnail = (appThumbFile?.size ?? 0) > 0 
      ? await uploadFile(appThumbFile!) 
      : (appThumbParam || existingPoi.appThumbnail || '');

    const headerParam = formData.get('header_16x9') as string;
    const header16x9 = (headerFile?.size ?? 0) > 0 
      ? await uploadFile(headerFile!) 
      : (headerParam || existingPoi.header16x9 || '');

    const audioParam = formData.get('audio_url') as string;
    const audioUrl = (audioFile?.size ?? 0) > 0 
      ? await uploadFile(audioFile!) 
      : (audioParam || existingPoi.audioUrl || '');

    const videoSlotCount = parseInt(formData.get('video_slot_count') as string || '0', 10);
    let urlsFromForm: string[] = [];
    try { urlsFromForm = JSON.parse(formData.get('video_urls') as string || '[]'); } catch (e) {}

    let initialVideoUrls: string[] = [];
    try { initialVideoUrls = JSON.parse(formData.get('initial_video_urls') as string || '[]'); } catch (e) {}
    
    // Si s'han afegit vídeos per altres vies mentre editavem (ex: Consola HLS), els mantenim.
    const concurrentlyAddedVideos = (existingPoi.videoUrls || []).filter(v => !initialVideoUrls.includes(v));

    const uploadedVideoUrls: string[] = [];
    for (let i = 0; i < videoSlotCount; i++) {
      const file = formData.get(`video_file_${i}`) as File | null;
      if (file && file.size > 0) {
        uploadedVideoUrls.push(await uploadFile(file));
      }
    }
    
    let videoUrls = [
      ...uploadedVideoUrls,
      ...urlsFromForm.filter(u => u && u.startsWith('http') && !uploadedVideoUrls.includes(u)),
      ...concurrentlyAddedVideos
    ].slice(0, 4); // Max 4 vídeos en total (Reels + HLS)


    const iconParam = formData.get('icon') as string;
    const icon = iconParam || existingPoi.icon || null;

    const carouselFileCount = parseInt(formData.get('carousel_file_count') as string || '0', 10);
    let carouselUrlsFromForm: string[] = [];
    try { carouselUrlsFromForm = JSON.parse(formData.get('carousel_images') as string || '[]'); } catch(e) {}
    
    let finalCarouselImages: string[] = [];
    if (carouselFileCount === 0 && carouselUrlsFromForm.length > 0) {
      carouselUrlsFromForm.forEach(u => finalCarouselImages.push(u));
    } else {
      let urlIdx = 0;
      for (let i = 0; i < carouselFileCount; i++) {
        const file = formData.get(`carousel_file_${i}`) as File | null;
        if (file && file.size > 0) {
          finalCarouselImages.push(await uploadFile(file));
        } else if (carouselUrlsFromForm[urlIdx]) {
          finalCarouselImages.push(carouselUrlsFromForm[urlIdx]);
          urlIdx++;
        }
      }
    }
    if (finalCarouselImages.length === 0 && existingPoi.carouselImages) {
      finalCarouselImages = existingPoi.carouselImages;
    }

    // Traducciones (merge amb les existents per no perdre idiomes)
    let titleTranslations = (existingPoi.titleTranslations as any) || {};
    let descriptionTranslations = (existingPoi.descriptionTranslations as any) || {};
    let textContentTranslations = (existingPoi.textContentTranslations as any) || {};
    let audioTranslations = (existingPoi.audioTranslations as any) || {};
    let videoTranslations = (existingPoi.videoTranslations as any) || {};

    try {
      const tt = formData.get('title_translations') as string;
      const dt = formData.get('description_translations') as string;
      const tct = formData.get('text_content_translations') as string;
      const at = formData.get('audio_translations') as string;
      const vt = formData.get('video_translations') as string;
      if (tt) titleTranslations = mergeTranslations(titleTranslations, JSON.parse(tt));
      if (dt) descriptionTranslations = mergeTranslations(descriptionTranslations, JSON.parse(dt));
      if (tct) textContentTranslations = mergeTranslations(textContentTranslations, JSON.parse(tct));
      if (at) audioTranslations = mergeTranslations(audioTranslations, JSON.parse(at));
      if (vt) videoTranslations = mergeTranslations(videoTranslations, JSON.parse(vt));
    } catch (e) { }

    const type = formData.get('type') as string;
    const voiceIdParam = formData.get('voice_id') as string;
    const voiceId = formData.has('voice_id') ? voiceIdParam : existingPoi.voiceId;
    const manualQuizStr = formData.get('manual_quiz') as string;
    let manualQuiz = existingPoi.manualQuiz;
    try { if (manualQuizStr) manualQuiz = JSON.parse(manualQuizStr); } catch (e) { }

    const carouselCaptionsStr = formData.get('carousel_captions') as string;
    let carouselCaptions = existingPoi.carouselCaptions;
    try { if (carouselCaptionsStr) carouselCaptions = JSON.parse(carouselCaptionsStr); } catch (e) { }

    console.log(`[updatePoi ${id}] 3/5 - Updating database...`);
    await prisma.poi.update({
      where: { 
        id
      },
      data: {
        title,
        titleTranslations: titleTranslations as any,
        description,
        descriptionTranslations: descriptionTranslations as any,
        latitude,
        longitude,
        audioUrl,
        audioTranslations: audioTranslations as any,
        videoTranslations: videoTranslations as any,
        videoUrls,
        textContent,
        voiceScript,
        voiceId,
        textContentTranslations: textContentTranslations as any,
        appThumbnail,
        header16x9,
        carouselImages: finalCarouselImages,
        carouselCaptions: carouselCaptions ? (carouselCaptions as any) : undefined,
        icon,
        manualQuiz: manualQuiz ? (manualQuiz as any) : undefined,
        type: type ? (type as any) : (existingPoi.type || undefined)
      }
    });

    console.log(`[updatePoi ${id}] 4/5 - Revalidating path...`);
    revalidatePath('/admin', 'layout');
    revalidatePath('/', 'layout');

    console.log(`[updatePoi ${id}] 5/5 - Done!`);
    return { success: true };
  } catch (err: any) {
    console.error('[updatePoi error]', err);
    return { success: false, error: err.message || JSON.stringify(err) };
  }
}

export async function updateLegend(id: string, formData: FormData) {
  // SEC: Requereix rol d'admin per actualitzar rutes i POIs
  await requireAdmin();
  const name = formData.get('title') as string;
  const description = formData.get('description') as string;
  const category = formData.get('category') as string;
  const latitude = parseFloat(formData.get('latitude') as string);
  const longitude = parseFloat(formData.get('longitude') as string);
  const video_url = formData.get('video_url') as string;
  const image_url = formData.get('image_url') as string;
  const audio_url = formData.get('audio_url') as string;

  const textContent = formData.get('text_content') as string;
  const appThumbnail = formData.get('app_thumbnail') as string;
  const header16x9 = formData.get('header_16x9') as string;
  const carouselImages = formData.get('carousel_images') ? JSON.parse(formData.get('carousel_images') as string) : undefined;

  const validThemes: string[] = ['mountain', 'coast', 'city', 'interior', 'bloom'];
  let themeId = category?.toLowerCase() as any;
  if (!validThemes.includes(themeId)) themeId = undefined;

  const muniId = formData.get('municipality_id') as string;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.route.update({
        where: { 
          id,
          municipalityId: muniId || undefined
        },
        data: {
          name: name,
          description,
          themeId: themeId || undefined,
        }
      });

      const routePois = await tx.routePoi.findMany({
        where: { routeId: id },
        include: { poi: true }
      });

      for (const rp of routePois) {
        const poiUpdates: Record<string, any> = {
          title: name,
          description,
          latitude: !isNaN(latitude) ? latitude : undefined,
          longitude: !isNaN(longitude) ? longitude : undefined,
          audioUrl: audio_url || undefined,
          videoUrls: video_url ? [video_url] : undefined,
          textContent: textContent || undefined,
          appThumbnail: appThumbnail || undefined,
          header16x9: header16x9 || undefined,
          carouselImages: carouselImages || undefined
        };

        if (image_url) {
          poiUpdates.images = [image_url];
        }

        await tx.poi.update({
          where: { id: rp.poiId },
          data: poiUpdates
        });
      }
    });

    revalidatePath('/admin', 'layout');
    revalidatePath('/', 'layout');

    // Traducció automàtica silenciosa en segon pla (múscul IA)
    void import('@/lib/actions/ai').then(m => m.autoTranslateAction('route', id)).catch(err => console.error('AutoTranslate Background Error:', err));

    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function addPoiToRoute(routeId: string, poiId: string, orderIndex: number, municipalityId?: string) {
  try {
    // SEC: Requereix rol d'admin per gestionar relacions de POIs
    await requireAdmin();
    const where: Record<string, any> = { id: routeId };
    if (municipalityId) where.municipalityId = municipalityId;

    const route = await prisma.route.findUnique({ where });
    if (!route) throw new Error("Ruta no trobada o accés denegat");

    await prisma.routePoi.create({
      data: { routeId, poiId, orderIndex }
    });
    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function removePoiFromRoute(routeId: string, poiId: string, municipalityId?: string) {
  try {
    // SEC: Requereix rol d'admin
    await requireAdmin();
    const where: Record<string, any> = { id: routeId };
    if (municipalityId) where.municipalityId = municipalityId;

    const route = await prisma.route.findFirst({ where });
    if (!route) throw new Error("Accés denegat");

    await prisma.routePoi.delete({
      where: { routeId_poiId: { routeId, poiId } }
    });
    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function reorderRoutePois(routeId: string, poiIds: string[], municipalityId?: string) {
  try {
    // SEC: Requereix rol d'admin
    await requireAdmin();
    const where: Record<string, any> = { id: routeId };
    if (municipalityId) where.municipalityId = municipalityId;

    const route = await prisma.route.findFirst({ where });
    if (!route) throw new Error("Accés denegat");

    await prisma.$transaction(
      poiIds.map((id, index) =>
        prisma.routePoi.update({
          where: { routeId_poiId: { routeId, poiId: id } },
          data: { orderIndex: index }
        })
      )
    );
    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}


export async function closeRouteAndGenerateFinalQuiz(routeId: string) {
  try {
    // SEC: Requereix rol d'admin per tancar rutes i generar qüestionaris
    await requireAdmin();
    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: {
        routePois: {
          include: { poi: true },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!route) return { success: false, error: "Ruta no trobada." };

    const poiContents = route.routePois.map(rp => ({
      title: rp.poi.title,
      content: rp.poi.textContent || rp.poi.description || ""
    }));

    const finalQuiz = await generateFinalRouteQuiz(route.name || route.slug || "Ruta patrimonial sense títol", poiContents);

    await prisma.route.update({
      where: { id: routeId },
      data: { finalQuiz }
    });

    revalidatePath('/admin', 'layout');
    revalidatePath('/', 'layout');
    return { success: true, finalQuiz };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

