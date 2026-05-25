import { prisma } from '@/lib/database/prisma';
import { generateExecutiveSummary } from './openrouter';
import { generateBarChartUrl, generatePieChartUrl } from './charts';
import { generatePdf } from './pdf';
import { getExecutiveAnalytics } from '../analytics';
import * as fs from 'fs';
import * as path from 'path';

export async function processReport(reportId: string, municipalityId: string) {
  console.log(`[Processor] Processing report ${reportId} for municipality ${municipalityId}`);

  try {
    // 1. Update status to PROCESSING
    await prisma.report.update({
      where: { id: reportId },
      data: { status: 'PROCESSING' }
    });

    // 2. Fetch REAL analytics data (covering the current month by default for PDF reporting)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = now;

    const analytics = await getExecutiveAnalytics(municipalityId, startDate, endDate);
    const { metrics, routeCompletions } = analytics;

    // Fetch municipality name
    const municipality = await prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { name: true }
    });
    const municipalityName = municipality?.name || 'Municipi';

    // NEW: Generate real AI insights instead of using the hardcoded dashboard string
    console.log("[Processor] Calling AI for executive summary...");
    const aiSummary = await generateExecutiveSummary(analytics, municipalityName);

    // 3. Generate Content (Charts for PDF)
    console.log("[Processor] Generating Charts...");
    const weeklyData = analytics.weeklyTraffic || [];
    const barChartUrl = generateBarChartUrl(weeklyData);

    // 4. Generate HTML for PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e2b25; }
          h1, h2 { font-family: 'Playfair Display', serif; color: #568F72; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #568F72; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-weight: bold; font-size: 24px; color: #2D4636; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .card { background: #F9F7F2; padding: 20px; border-radius: 8px; border: 1px solid #E5E1D5; }
          .chart { width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4px; }
          .summary { background: #fff; border-left: 4px solid #568F72; padding: 15px; font-style: italic; white-space: pre-wrap; margin-bottom: 30px; }
          .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
          .metric-box { text-align: center; padding: 15px; background: white; border-radius: 6px; border: 1px solid #eee; }
          .metric-value { font-size: 24px; font-weight: bold; color: #568F72; display: block; }
          .metric-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
          ul { padding-left: 20px; }
          li { margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">${municipalityName}</div>
          <div>Impacte Turístic Digital</div>
        </div>

        <h1>Informe d'Impacte Executiu: ${municipalityName}</h1>
        <div class="summary">
          ${aiSummary || "S'ha generat l'informe però el resum d'IA no està disponible. Consulteu les mètriques següents."}
        </div>

        <div class="grid">
          <div class="metric-box">
            <span class="metric-value">${metrics.users.active}</span>
            <span class="metric-label">Usuaris Actius</span>
          </div>
          <div class="metric-box">
            <span class="metric-value">${metrics.routesCompleted.value}</span>
            <span class="metric-label">Èxit per Ruta</span>
          </div>
          <div class="metric-box">
            <span class="metric-value">${metrics.quizStats.value}%</span>
            <span class="metric-label">Èxit en Reptes</span>
          </div>
          <div class="metric-box">
            <span class="metric-value">${metrics.abandonmentRate.value}%</span>
            <span class="metric-label">Abandonament</span>
          </div>
        </div>

        <div style="margin-bottom: 30px;">
             <div class="card">
                <h2>Rendiment Setmanal</h2>
                <img src="${barChartUrl}" class="chart" />
             </div>
        </div>

        <div class="section">
            <h2>Punts d'Interès Destacats</h2>
            <ul>
                ${metrics.quizStats.details.slice(0, 5).map((p: any) => `
                    <li><strong>${p.title}:</strong> ${p.solved} de ${p.total} reptes resolts (${Math.round(p.solved / p.total * 100)}% èxit).</li>
                `).join('')}
            </ul>
        </div>

        <div class="footer">
          Aquest informe ha estat generat automàticament per la plataforma Geocontent per al període del ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}.
        </div>
      </body>
      </html>
    `;

    // 5. Generate PDF
    console.log("[Processor] Rendering PDF with Puppeteer...");
    const pdfBuffer = await generatePdf(html);

    // 6. Save PDF to public folder
    const fileName = `report-${reportId}.pdf`;
    const publicDir = path.join(process.cwd(), 'public', 'reports');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    const filePath = path.join(publicDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    const resultUrl = `/reports/${fileName}`;

    // 7. Update Status to COMPLETED
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'COMPLETED',
        resultUrl: resultUrl,
        data: analytics as any
      }
    });

    console.log(`[Processor] Report ${reportId} finished successfully.`);
    return { success: true, url: resultUrl };

  } catch (error: any) {
    console.error(`[Processor] Job ${reportId} failed:`, error);
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'FAILED',
        data: { error: error.message || "Descripció de l'error no disponible" } as any
      }
    });
    return { success: false, error: error.message };
  }
}
