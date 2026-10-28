'use server';

import { reportQueue } from '@/lib/queue/client';
import { prisma } from '@/lib/database/prisma';
import { revalidatePath } from 'next/cache';
import { requireAuth, requireAdmin } from '@/lib/auth-guard';
import * as fs from 'fs';
import * as path from 'path';

export async function generateReport(
  municipalityId: string,
  startDateParam?: string,
  endDateParam?: string
) {
  console.log(`[generateReport] Sol·licitud per al municipi: ${municipalityId}, període: ${startDateParam} - ${endDateParam}`);
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

    const now = new Date();
    const startDate = startDateParam ? new Date(startDateParam) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = endDateParam ? new Date(endDateParam) : now;

    const formattedStart = `${String(startDate.getDate()).padStart(2, '0')}/${String(startDate.getMonth() + 1).padStart(2, '0')}/${startDate.getFullYear()}`;
    const formattedEnd = `${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}/${endDate.getFullYear()}`;

    const report = await prisma.report.create({
      data: {
        municipalityId,
        status: 'PENDING',
        title: `Informe Impacte - ${muniName} (${formattedStart} – ${formattedEnd})`
      }
    });

    console.log(`[generateReport] Creat registre a la BD: ${report.id}`);

    try {
      await reportQueue.add('generate-report', {
        reportId: report.id,
        municipalityId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      console.log(`[generateReport] Afegit a OutboxEvent`);

      // 🚀 Execució directa (Next.js Background Task)
      import('../services/reportProcessor').then(m => {
        m.processReport(report.id, municipalityId, startDate, endDate).catch(err => {
          console.error("[generateReport] Error en processament directe:", err);
        });
      });
    } catch (queueError: any) {
      console.warn("[generateReport] Queue error (Redis down). Falling back to direct process (Dev Mode).");
      import('../services/reportProcessor').then(m => {
        m.processReport(report.id, municipalityId, startDate, endDate).catch(err => {
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
    // SEC: Informes executius — només accessible per admins
    await requireAdmin();
    const whereClause = (municipalityId && municipalityId !== 'null' && municipalityId !== 'undefined') ? { municipalityId } : {};
    const reports = await prisma.report.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
    return reports.map(r => ({
      ...r,
      resultUrl: `/api/admin/reports/${r.id}/download`
    }));
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

    // Netejar fitxers PDF locals
    const fileName = `report-${reportId}.pdf`;
    const paths = [
      path.join(process.cwd(), 'public', 'reports', fileName),
      path.join('/tmp', 'reports', fileName)
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch {}
      }
    }

    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting report:", error);
    return { success: false, error: "No s'ha pogut eliminar l'informe" };
  }
}
