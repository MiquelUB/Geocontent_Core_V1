'use server'

export const runtime = 'nodejs';

import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { prisma } from "../database/prisma";

import { z } from 'zod';
import { generatePoiQuiz, generateFinalRouteQuiz } from '../services/openrouter';
import { checkPlanLimits, canAddPoiToRoute } from '../planLimits';
import { GENERIC_ERROR_MESSAGE } from '@/lib/errors';
import { uploadFile } from './storage';
import { autoTranslateAction } from './ai';
import { getDefaultMunicipalityId, getRouteWithPois as _getRouteWithPois } from '../services/queries';

// Server Action Wrapper per a Client Components
export async function getRouteWithPois(routeId: string) {
  return _getRouteWithPois(routeId);
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
  })
});

const CreatePoiSchema = z.object({
  title: z.string().min(1, "El títol és obligatori"),
  description: z.string().optional(),
  latitude: z.coerce.number().min(40, "Latitud fora de rang (Catalunya)").max(43, "Latitud fora de rang (Catalunya)"),
  longitude: z.coerce.number().min(0, "Longitud fora de rang (Catalunya)").max(4, "Longitud fora de rang (Catalunya)"),
  route_id: z.string().uuid().optional().nullable().catch(null),
  text_content: z.string().optional(),
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
  icon: z.string().optional()
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
  return updateMunicipalityInternal(id, name, logoUrl, themeId, adminMasterPassword, planTier, extraRoutesCount);
}


// --- Funcions de Contingut (Rutes i POIs) ---

export async function createLegend(formData: FormData) {
  try {
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

    const { title, description, category, latitude, longitude, route_id, text_content, carousel_images } = validated;

    const validThemes: any = ['mountain', 'coast', 'city', 'interior', 'bloom'];
    let themeId = category?.toLowerCase() as any;
    if (!validThemes.includes(themeId)) themeId = "mountain";

    const municipalityId = await getDefaultMunicipalityId();
    if (!municipalityId) return { success: false, error: GENERIC_ERROR_MESSAGE };

    const result = await prisma.$transaction(async (tx) => {
      const route = await tx.route.create({
        data: {
          municipalityId,
          name: title,
          slug: title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') + '-' + Date.now(),
          description,
          themeId,
          thumbnail1x1: routeThumbnail || null,
          downloadRequired: formData.get('download_required') === 'true'
        }
      });

      const targetRouteId = route_id || route.id;

      const poi = await tx.poi.create({
        data: {
          municipalityId,
          title: title,
          description,
          latitude: latitude || 0,
          longitude: longitude || 0,
          images: appThumbnail ? [appThumbnail] : [],
          audioUrl: audio_url,
          videoUrls: video_url ? [video_url] : [],
          textContent: text_content,
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

  try {
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
        slug,
        description,
        municipalityId,
        themeId: category as any,
        thumbnail1x1: thumbnail1x1 || null,
        downloadRequired,
        finalQuiz: finalQuizInfo,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    revalidatePath('/admin');
    revalidatePath('/');

    // Traducció automàtica silenciosa en segon pla (múscul IA)
    (async () => {
      try {
        const { autoTranslateAction } = await import('@/lib/actions/ai');
        await autoTranslateAction('route', id);
      } catch (err) {
        console.error("AutoTranslate Background Error:", err);
      }
    })();

    return { success: true, id };
  } catch (err: any) {
    console.error("createRoute Error:", err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function updateRoute(id: string, formData: FormData) {
  const name = formData.get('title') as string
  const description = formData.get('description') as string || ''
  const location = formData.get('location') as string || ''
  const category = formData.get('category') as string || 'mountain'
  const thumbnailFile = formData.get('thumbnail_file') as File || null
  let thumbnail1x1 = formData.get('thumbnail_1x1') as string || ''

  if (thumbnailFile && thumbnailFile.size > 0) {
    thumbnail1x1 = await uploadFile(thumbnailFile);
  }

  const muniId = formData.get('municipality_id') as string;
  const downloadRequired = formData.get('download_required') === 'true';
  const locationMuniId = await getOrCreateMunicipalityByName(location);

  let finalQuizInfo = null;
  const finalQuizRaw = formData.get('final_quiz') as string;
  if (finalQuizRaw) {
    try { finalQuizInfo = JSON.parse(finalQuizRaw); } catch (e) { }
  }

  try {
    await prisma.route.update({
      where: { 
        id,
        // Multi-tenancy check: ensure the route belongs to the admin's municipality
        municipalityId: muniId || undefined 
      },
      data: {
        name,
        description,
        municipalityId: locationMuniId || muniId || undefined,
        themeId: category as any,
        thumbnail1x1: thumbnail1x1 || null,
        downloadRequired,
        finalQuiz: finalQuizInfo || undefined,
        updatedAt: new Date()
      }
    });

    revalidatePath('/admin');
    revalidatePath('/');

    // Traducció automàtica silenciosa en segon pla (múscul IA)
    (async () => {
      try {
        const { autoTranslateAction } = await import('@/lib/actions/ai');
        await autoTranslateAction('route', id);
      } catch (err) {
        console.error("AutoTranslate Background Error:", err);
      }
    })();

    return { success: true };
  } catch (err: any) {
    console.error("updateRoute Error:", err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function deleteLegend(id: string, municipalityId?: string) {
  try {
    await prisma.route.delete({
      where: { 
        id,
        municipalityId: municipalityId || undefined
      }
    });
    revalidatePath('/admin');
    revalidatePath('/');

    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function createPoi(formData: FormData) {
  try {
    const validated = CreatePoiSchema.parse(Object.fromEntries(formData.entries()));
    const { title, description, latitude, longitude, route_id, text_content, video_urls, carousel_images, icon } = validated;

    const appThumbFile = formData.get('app_thumbnail_file') as File || null
    const headerFile = formData.get('header_file') as File || null
    const audioFile = formData.get('audio_file') as File || null

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

    if (route_id) {
      const canAdd = await canAddPoiToRoute(route_id);
      if (!canAdd) {
        return { success: false, error: "S'ha assolit el límit de POIs per aquesta ruta segons el teu pla." };
      }
    }

    const existingCount = route_id
      ? await prisma.routePoi.count({ where: { routeId: route_id } })
      : 0;

    const result = await prisma.$transaction(async (tx) => {
      const poi = await tx.poi.create({
        data: {
          municipalityId,
          title,
          description,
          latitude,
          longitude,
          images: appThumbnail ? [appThumbnail] : [],
          audioUrl,
          videoUrls: finalVideoUrls,
          textContent: text_content,
          type: validated.type ? (validated.type as any) : null,
          manualQuiz: validated.manual_quiz,
          appThumbnail,
          header16x9,
          icon,
          carouselImages: finalCarouselImages
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
    });

    revalidatePath('/admin');

    // Traducció automàtica silenciosa en segon pla (múscul IA)
    (async () => {
      try {
        const { autoTranslateAction } = await import('@/lib/actions/ai');
        await autoTranslateAction('poi', result.id);
      } catch (err) {
        console.error("AutoTranslate Background Error:", err);
      }
    })();

    return { success: true, id: result.id };
  } catch (err: any) {
    console.error('[createPoi error]', err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function updatePoi(id: string, formData: FormData) {
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const latitude = parseFloat(formData.get('latitude') as string);
  const longitude = parseFloat(formData.get('longitude') as string);

  const appThumbFile = formData.get('app_thumbnail_file') as File | null;
  const headerFile = formData.get('header_file') as File | null;
  const audioFile = formData.get('audio_file') as File | null;

  const appThumbnail = (appThumbFile?.size ?? 0) > 0 ? await uploadFile(appThumbFile!) : (formData.get('app_thumbnail') as string || '');
  const header16x9 = (headerFile?.size ?? 0) > 0 ? await uploadFile(headerFile!) : (formData.get('header_16x9') as string || '');
  const audioUrl = (audioFile?.size ?? 0) > 0 ? await uploadFile(audioFile!) : (formData.get('audio_url') as string || '');

  const videoSlotCount = parseInt(formData.get('video_slot_count') as string || '0', 10);
  const urlsFromForm: string[] = JSON.parse(formData.get('video_urls') as string || '[]');
  const uploadedVideoUrls: string[] = [];
  for (let i = 0; i < videoSlotCount; i++) {
    const file = formData.get(`video_file_${i}`) as File | null;
    if (file && file.size > 0) {
      uploadedVideoUrls.push(await uploadFile(file));
    }
  }
  const videoUrls = [
    ...uploadedVideoUrls,
    ...urlsFromForm.filter(u => u && u.startsWith('http') && !uploadedVideoUrls.includes(u))
  ];

  const textContent = formData.get('text_content') as string || '';
  const icon = formData.get('icon') as string || null;

  const carouselFileCount = parseInt(formData.get('carousel_file_count') as string || '0', 10);
  const carouselUrlsFromForm: string[] = JSON.parse(formData.get('carousel_images') as string || '[]');
  const finalCarouselImages: string[] = [];

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

  try {
    const type = formData.get('type') as string;
    const manualQuizStr = formData.get('manual_quiz') as string;
    const muniId = formData.get('municipality_id') as string;
    let manualQuiz = null;
    try { if (manualQuizStr) manualQuiz = JSON.parse(manualQuizStr); } catch (e) { }

    await prisma.poi.update({
      where: { 
        id,
        municipalityId: muniId || undefined 
      },
      data: {
        title,
        description,
        latitude,
        longitude,
        audioUrl,
        videoUrls,
        textContent,
        appThumbnail,
        header16x9,
        carouselImages: finalCarouselImages,
        icon,
        manualQuiz,
        type: type ? (type as any) : undefined,
        images: appThumbnail ? [appThumbnail] : undefined,
      }
    });

    revalidatePath('/admin');

    // Traducció automàtica silenciosa en segon pla (múscul IA)
    (async () => {
      try {
        const { autoTranslateAction } = await import('@/lib/actions/ai');
        await autoTranslateAction('poi', id);
      } catch (err) {
        console.error("AutoTranslate Background Error:", err);
      }
    })();

    return { success: true };
  } catch (err: any) {
    console.error('[updatePoi error]', err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function updateLegend(id: string, formData: FormData) {
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

  const validThemes: any = ['mountain', 'coast', 'city', 'interior', 'bloom'];
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
        const poiUpdates: any = {
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

    revalidatePath('/admin');
    revalidatePath('/');

    // Traducció automàtica silenciosa en segon pla (múscul IA)
    (async () => {
      try {
        const { autoTranslateAction } = await import('@/lib/actions/ai');
        await autoTranslateAction('route', id);
      } catch (err) {
        console.error("AutoTranslate Background Error:", err);
      }
    })();

    return { success: true };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

export async function addPoiToRoute(routeId: string, poiId: string, orderIndex: number, municipalityId?: string) {
  try {
    const where: any = { id: routeId };
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
    const where: any = { id: routeId };
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
    const where: any = { id: routeId };
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

    revalidatePath('/admin');
    return { success: true, finalQuiz };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: GENERIC_ERROR_MESSAGE };
  }
}

