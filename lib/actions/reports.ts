'use server';




import { reportQueue } from '@/lib/queue/client';
import { prisma } from '@/lib/database/prisma';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth-guard';
// Note: processReport is imported dynamically in the fallback to avoid bundling issues

export async function generateReport(municipalityId: string) {
  console.log(`[generateReport] Request for municipality: ${municipalityId}`);
  try {
    // SEC-03: Verificar sessió
    await requireAuth();

    if (!municipalityId || municipalityId.length < 32 || municipalityId === 'null') {
      return { success: false, error: "Municipi no vàlid" };
    }

    const muni = await prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { name: true }
    });
    const muniName = muni?.name || 'Municipi';

    const report = await prisma.report.create({
      data: {
        municipalityId,
        status: 'PENDING',
        title: `Informe Impacte - ${muniName} - ${new Date().toLocaleDateString('es-ES')}`
      }
    });

    console.log(`[generateReport] Created DB record: ${report.id}`);

    try {
      await reportQueue.add('generate-report', {
        reportId: report.id,
        municipalityId
      });
      console.log(`[generateReport] Added to queue`);
    } catch (queueError: any) {
      console.warn("[generateReport] Queue error (Redis down). Falling back to direct process (Dev Mode).");
      // Fallback: Trigger immediately but don't await (background task)
      import('../services/reportProcessor').then(m => {
        m.processReport(report.id, municipalityId).catch(err => {
          console.error("[generateReport] Fallback process failed:", err);
        });
      });

      revalidatePath('/admin');
      return { success: true, reportId: report.id, note: "Processant directament (Redis no detectat)" };
    }

    revalidatePath('/admin');
    return { success: true, reportId: report.id };
  } catch (error: any) {
    console.error("Error generating report:", error);
    return { success: false, error: "S'ha produït un error al processar la sol·licitud" };
  }
}

export async function getReports(municipalityId?: string) {
  try {
    const whereClause = (municipalityId && municipalityId !== 'null' && municipalityId !== 'undefined') ? { municipalityId } : {};
    const reports = await prisma.report.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
    return reports;
  } catch (error) {
    console.error("Error fetching reports:", error);
    return [];
  }
}

export async function deleteReport(reportId: string) {
  try {
    // SEC-03: Verificar sessió
    await requireAuth();

    await prisma.report.delete({
      where: { id: reportId }
    });
    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting report:", error);
    return { success: false, error: "No s'ha pogut eliminar l'informe" };
  }
}
