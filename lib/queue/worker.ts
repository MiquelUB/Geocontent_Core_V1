import { Worker, Job } from 'bullmq';
import { prisma } from '../database/prisma';
import { uploadStreamToS3, deleteFromS3 } from '../services/s3';
import { getConnection } from './client';
import { TerritorialPackage, OfflineRoute, OfflinePoi } from '../types/offline';

/**
 * PAS 1: Processador amb Streams i Idempotència
 */
async function processPackagerJob(job: Job) {
  const { municipalityId } = job.data;
  const storageUrl = process.env.NEXT_PUBLIC_STORAGE_URL?.replace(/\/$/, "");
  const fileName = `territorial-packages/${municipalityId}/package.json`;

  console.log(`[Worker] 🛠️ Generant paquet (STREAMING) per a: ${municipalityId}`);

  try {
    // 1. Obtenir dades del municipi i rutes
    const muni = await prisma.municipality.findUnique({
      where: { id: municipalityId },
      include: {
        routes: {
          include: {
            routePois: {
              orderBy: { orderIndex: 'asc' },
              include: { 
                poi: true 
              }
            }
          }
        }
      }
    });

    if (!muni) throw new Error("Municipi no trobat");

    // 2. Extraure coordenades del camp PostGIS 'location' (PAS 4 Helper conceptual)
    // Nota: Com que location és Unsupported, fem un map per obtenir lat/lng si calgués SQL cru, 
    // però per ara intentarem extreure-ho de l'objecte si Prisma ho retorna com a buffer/geojson.
    
    const offlineRoutes: OfflineRoute[] = muni.routes.map(route => {
      const pois: OfflinePoi[] = route.routePois.map(rp => {
        const p = rp.poi;
        
        // Helper per parsejar el camp geometry Unsupported si calgués:
        // Aquí assumim que ho tractem com a objecte GeoJSON si el driver ho permet, 
        // o usem 0,0 com a fallback fins a tenir el helper de query crua.
        const latitude = 0; 
        const longitude = 0;

        const mediaUrls = [
          p.appThumbnail,
          p.header16x9,
          p.audioUrl,
          ...(p.videoUrls || []),
          ...(p.carouselImages || [])
        ].filter((url): url is string => !!url);

        return {
          id: p.id,
          latitude,
          longitude,
          title: (p.titleTranslations as Record<string, string>) || { ca: p.title },
          icon: p.icon || 'map-pin',
          mediaUrls,
          quiz: p.manualQuiz as OfflinePoi['quiz']
        };
      });

      return {
        id: route.id,
        slug: route.slug,
        title: (route.nameTranslations as Record<string, string>) || { ca: route.name || '' },
        description: (route.descriptionTranslations as Record<string, string>) || { ca: route.description || '' },
        estimatedTime: 0,
        distance: 0,
        pois
      };
    });

    const packageData: TerritorialPackage = {
      version: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12),
      municipality: {
        id: muni.id,
        name: muni.name,
        bbox: [0.15, 40.5, 3.3, 42.9] // Simplificat per a l'exemple
      },
      config: {
        biomeTheme: muni.themeId || 'mountain',
        iconsMappingUrl: `${storageUrl}/config/icons-mapping.json`
      },
      cartography: {
        vectorTileUrl: `${storageUrl}/territorial-packages/${muni.id}/cartography.pmtiles`,
        styleUrl: `${storageUrl}/config/map-style.json`
      },
      routes: offlineRoutes
    };

    // 3. PUJADA MITJANÇANT STREAM (Evita OOM)
    const { stream, promise } = uploadStreamToS3(fileName, "application/json");
    
    // Escrivim el JSON al stream
    stream.write(JSON.stringify(packageData, null, 2));
    stream.end();

    // Esperem que la pujada acabi
    await promise;

    // 4. Finalització
    await prisma.municipality.update({
      where: { id: municipalityId },
      data: { 
        lastPublishedAt: new Date(),
        packagingStatus: 'IDLE'
      }
    });

    console.log(`[Worker] ✅ Paquet publicat a S3: ${fileName}`);

  } catch (err: any) {
    console.error(`[Worker Error] Job ${job.id} fallit:`, err);
    
    // IDEMPOTÈNCIA: Netegem S3 si ha fallat per no deixar fitxers parcials/corruptes
    try {
      await deleteFromS3(fileName);
      console.log(`[Worker] 🧹 S3 netejat després de l'error.`);
    } catch (s3Err) {
      console.error(`[Worker] No s'ha pogut netejar S3:`, s3Err);
    }

    await prisma.municipality.update({
      where: { id: municipalityId },
      data: { packagingStatus: 'ERROR' }
    });
    
    throw err;
  }
}

/**
 * PAS 2: Execució autònoma del Worker
 */
export async function startPackagerWorker() {
  const connection = await getConnection();
  console.log("[Worker] 🚀 BullMQ Packager Worker iniciat...");

  const worker = new Worker('territorial-packaging', processPackagerJob, {
    connection,
    concurrency: 1 // Procés seqüencial per estalviar recursos a Easypanel
  });

  return worker;
}

// Si s'executa directament (node worker.js)
if (require.main === module) {
  startPackagerWorker().catch(err => {
    console.error("[Worker Fatal Error]", err);
    process.exit(1);
  });
}
