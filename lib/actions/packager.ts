'use server';

export const runtime = 'nodejs';

import { prisma } from "../database/prisma";
import { packagerQueue } from "../queue/client";
import { revalidatePath } from "next/cache";

/**
 * Outbox Pattern: Generació de Paquets Territorials (V2 Sovereign)
 * Escriu un event a la taula OutboxEvent. El worker Python (ARQ) el processarà.
 */
export async function generateTerritorialPackageAction(municipalityId: string) {
  try {
    const muni = await prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { id: true, name: true }
    });

    if (!muni) throw new Error("Municipi no trobat");

    // Canviem l'estat a PROCESSING a la DB abans d'afegir a la cua
    await prisma.municipality.update({
      where: { id: municipalityId },
      data: { packagingStatus: 'PROCESSING' }
    });

    // Afegim a la cua i obtenim el jobId
    const job = await packagerQueue.add('generate-package', { 
      municipalityId 
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    });

    revalidatePath('/admin');

    // Retornem el jobId (HTTP 202 Accepted logic)
    return { 
      success: true, 
      jobId: job.id, 
      message: `La generació del paquet per a ${muni.name} s'ha posat en cua.` 
    };

  } catch (err: any) {
    console.error("[generateTerritorialPackageAction Error]", err);
    return { success: false, error: err.message || "Error al posar la tasca en cua." };
  }
}

/**
 * Funció de conveniència que és un àlies de l'acció principal
 */
export async function queueTerritorialPackageAction(municipalityId: string) {
  return generateTerritorialPackageAction(municipalityId);
}

/**
 * Comprova l'estat des de la DB (el worker l'actualitzarà quan acabi)
 */
export async function getPackagingStatus(municipalityId: string) {
  try {
    const muni = await prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { 
        packagingStatus: true,
        lastPublishedAt: true
      }
    });

    if (!muni) return { status: 'IDLE' };
    return { 
      status: (muni.packagingStatus || 'IDLE') as 'IDLE' | 'PROCESSING' | 'ERROR',
      lastSync: muni.lastPublishedAt 
    };
  } catch (err) {
    console.error("[getPackagingStatus]", err);
    return { status: 'ERROR' };
  }
}

/**
 * Comprova canvis pendents (es manté igual)
 */
export async function checkPendingChanges(municipalityId: string) {
  try {
    const muni = await prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { lastPublishedAt: true }
    });

    if (!muni) return { hasChanges: false };
    const lastPub = muni.lastPublishedAt || new Date(0);

    const recentRoute = await prisma.route.findFirst({
      where: { municipalityId, updatedAt: { gt: lastPub } },
      select: { id: true }
    });

    if (recentRoute) return { hasChanges: true };

    const recentPoi = await prisma.poi.findFirst({
      where: { 
        routePois: { some: { route: { municipalityId } } },
        updatedAt: { gt: lastPub }
      },
      select: { id: true }
    });

    if (recentPoi) return { hasChanges: true };

    return { hasChanges: false };
  } catch (err) {
    return { hasChanges: false };
  }
}
