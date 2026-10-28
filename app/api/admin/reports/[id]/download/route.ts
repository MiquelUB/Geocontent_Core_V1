import { NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Validació de sessió d'administrador
    await requireAdmin();

    const { id: reportId } = await params;
    if (!reportId) {
      return NextResponse.json({ error: "Identificador d'informe requerit" }, { status: 400 });
    }

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: { municipality: { select: { name: true } } }
    });

    if (!report) {
      return NextResponse.json({ error: "Informe no trobat" }, { status: 404 });
    }

    if (report.status === 'FAILED') {
      const errorMsg = (report.data as any)?.error || "La generació de l'informe ha fallat.";
      return NextResponse.json({ error: errorMsg, status: 'FAILED' }, { status: 400 });
    }

    // 2. Comprovar si el fitxer PDF ja existeix a disc
    const fileName = `report-${reportId}.pdf`;
    const pathsToCheck = [
      path.join(process.cwd(), 'public', 'reports', fileName),
      path.join('/tmp', 'reports', fileName),
    ];

    let pdfBuffer: Buffer | null = null;
    for (const p of pathsToCheck) {
      if (fs.existsSync(p)) {
        try {
          const buf = fs.readFileSync(p);
          if (buf && buf.length > 0) {
            pdfBuffer = buf;
            break;
          }
        } catch {
          // Si falla la lectura, continuar
        }
      }
    }

    // 3. Si el fitxer no existeix a disc (per exemple després d'un reinici del contenidor Docker),
    // es regenera de forma transparent
    if (!pdfBuffer) {
      console.log(`[PDF Download] Fitxer no trobat a disc per a ${reportId}. Regenerant...`);
      try {
        const { processReport } = await import('@/lib/services/reportProcessor');
        const regen = await processReport(report.id, report.municipalityId);
        if (regen.success) {
          for (const p of pathsToCheck) {
            if (fs.existsSync(p)) {
              const buf = fs.readFileSync(p);
              if (buf && buf.length > 0) {
                pdfBuffer = buf;
                break;
              }
            }
          }
        }
      } catch (err: any) {
        console.error(`[PDF Download] Error regenerant informe ${reportId}:`, err);
      }
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      return NextResponse.json({
        error: "El document PDF no està disponible a disc en aquests moments. Si us plau, torna a generar l'informe des del panell."
      }, { status: 404 });
    }

    const safeTitle = (report.title || `informe-${reportId}`)
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeTitle}.pdf"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      }
    });

  } catch (error: any) {
    console.error("[PDF Download Error]:", error);
    if (error.message?.includes('No autenticat') || error.message?.includes('Permisos')) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Error en la descàrrega de l'informe" }, { status: 500 });
  }
}
