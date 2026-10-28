import { prisma } from '@/lib/database/prisma';
import { generateExecutiveReportAi } from './openrouter';
import { generatePdf } from './pdf';
import { getExecutiveAnalytics } from '../analytics';
import { ExecutiveReportInputData, ExecutiveReportOutputJson } from '../types/executiveReport';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Construeix l'HTML A4 per a l'Informe Executiu d'Impacte de Geocontent
 * d'acord amb la Spec 002 i el Prompt de l'Agent d'Informe Executiu.
 */
export function buildExecutiveReportHtml(
  contract: ExecutiveReportInputData,
  aiReport: ExecutiveReportOutputJson
): string {
  const { client, periode, periode_anterior, nivell_dades, kpis, rutes } = contract;

  const nivellBadgeColor =
    nivell_dades === 'suficient' ? '#2e7d32' : nivell_dades === 'preliminar' ? '#ed6c02' : '#d32f2f';
  const nivellBadgeBg =
    nivell_dades === 'suficient' ? '#e8f5e9' : nivell_dades === 'preliminar' ? '#fff3e0' : '#ffebee';

  const semaforColor: Record<string, { bg: string; text: string; label: string }> = {
    consolidada: { bg: '#e8f5e9', text: '#2e7d32', label: 'Consolidada' },
    a_vigilar: { bg: '#fff3e0', text: '#ed6c02', label: 'A vigilar' },
    a_revisar: { bg: '#ffebee', text: '#d32f2f', label: 'A revisar' },
    sense_dades: { bg: '#f5f5f5', text: '#757575', label: 'Sense dades' }
  };

  const deltaFormat = (delta_pct: number | null, delta_abs: number | null) => {
    if (!periode_anterior.disponible || delta_pct === null) return `<span style="color: #888;">-</span>`;
    const isPos = delta_pct >= 0;
    const color = isPos ? '#2e7d32' : '#d32f2f';
    const sign = isPos ? '+' : '';
    return `<span style="color: ${color}; font-weight: 600;">${sign}${delta_pct}%</span>`;
  };

  const fiabilitatBadge = (f: 'baixa' | 'mitjana' | 'alta', n: number) => {
    const bg = f === 'alta' ? '#e8f5e9' : f === 'mitjana' ? '#fff8e1' : '#f5f5f5';
    const text = f === 'alta' ? '#2e7d32' : f === 'mitjana' ? '#f57f17' : '#757575';
    return `<span style="background: ${bg}; color: ${text}; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600;">n=${n} (${f})</span>`;
  };

  return `
    <!DOCTYPE html>
    <html lang="ca">
    <head>
      <meta charset="utf-8" />
      <title>Informe Executiu - ${client.nom}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
        @page { size: A4; margin: 15mm; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #1e2b25;
          line-height: 1.5;
          margin: 0;
          padding: 0;
          font-size: 11px;
        }
        h1, h2, h3, h4 {
          font-family: 'Playfair Display', Georgia, serif;
          color: #2D4636;
          margin-top: 0;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-bottom: 2px solid #568F72;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .logo-title {
          font-size: 20px;
          font-weight: 700;
          color: #2D4636;
          letter-spacing: -0.5px;
        }
        .subtitle {
          font-size: 11px;
          color: #568F72;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
        }
        .period-info {
          text-align: right;
          font-size: 10px;
          color: #666;
        }
        .badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 10px;
        }
        .section {
          margin-bottom: 22px;
          page-break-inside: avoid;
        }
        .card {
          background: #F9F7F2;
          border: 1px solid #E5E1D5;
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 14px;
        }
        .summary-box {
          background: #FFFFFF;
          border-left: 4px solid #568F72;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          padding: 16px;
          border-radius: 0 6px 6px 0;
          margin-bottom: 18px;
        }
        .summary-title {
          font-family: 'Playfair Display', serif;
          font-size: 15px;
          font-weight: 700;
          color: #2D4636;
          margin-bottom: 8px;
        }
        .summary-p {
          font-size: 11px;
          color: #333;
          margin-bottom: 6px;
          line-height: 1.55;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }
        .kpi-card {
          background: #FFFFFF;
          border: 1px solid #E5E1D5;
          border-radius: 6px;
          padding: 10px;
          text-align: center;
        }
        .kpi-label {
          font-size: 9px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
          display: block;
        }
        .kpi-val {
          font-size: 20px;
          font-weight: 700;
          color: #2D4636;
          display: block;
        }
        .kpi-meta {
          margin-top: 4px;
          display: flex;
          justify-content: center;
          gap: 6px;
          align-items: center;
          font-size: 9px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 10.5px;
        }
        th {
          background: #F0ECE1;
          color: #2D4636;
          font-weight: 600;
          text-align: left;
          padding: 7px 10px;
          border-bottom: 1px solid #D5CEBE;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        td {
          padding: 7px 10px;
          border-bottom: 1px solid #ECE7DB;
          vertical-align: top;
        }
        tr:nth-child(even) td {
          background: #FAF8F5;
        }
        .tag-pill {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 600;
        }
        .action-card {
          background: #FFFFFF;
          border: 1px solid #DCE3DE;
          border-left: 4px solid #568F72;
          border-radius: 4px;
          padding: 10px 12px;
          margin-bottom: 8px;
        }
        .quote-box {
          font-style: italic;
          background: #FAF8F5;
          border-left: 3px solid #C4B9A3;
          padding: 6px 10px;
          margin: 4px 0;
          border-radius: 0 4px 4px 0;
          color: #444;
          font-size: 10px;
        }
        .footer {
          margin-top: 25px;
          padding-top: 10px;
          border-top: 1px solid #D5CEBE;
          display: flex;
          justify-content: space-between;
          font-size: 8.5px;
          color: #777;
        }
      </style>
    </head>
    <body>
      <!-- Header -->
      <div class="header">
        <div>
          <div class="subtitle">Geocontent · Plataforma Digital de Turisme Patrimonial</div>
          <div class="logo-title">${client.nom}</div>
        </div>
        <div class="period-info">
          <div>Període: <strong>${periode.inici} – ${periode.final}</strong> (${periode.dies} dies)</div>
          <div style="margin-top: 3px;">
            Nivell de dades:
            <span class="badge" style="background: ${nivellBadgeBg}; color: ${nivellBadgeColor};">
              ${nivell_dades.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <!-- Resum Executiu -->
      <div class="section">
        <div class="summary-box">
          <div class="summary-title">${aiReport?.resum_executiu?.titular || 'Resum Executiu d\'Impacte'}</div>
          ${(aiReport?.resum_executiu?.paragrafs || []).map(p => `<p class="summary-p">${p}</p>`).join('')}
        </div>
      </div>

      <!-- 1. KPIs Clau del Període -->
      <div class="section">
        <h3 style="font-size: 13px; margin-bottom: 8px;">1. Indicadors Clau de Rendiment (KPIs)</h3>
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Usuaris Totals</span>
            <span class="kpi-val">${kpis.usuaris.totals.disponible ? kpis.usuaris.totals.valor : 'no disp.'}</span>
            <div class="kpi-meta">
              ${deltaFormat(kpis.usuaris.totals.delta_pct, kpis.usuaris.totals.delta_abs)}
              ${fiabilitatBadge(kpis.usuaris.totals.fiabilitat, kpis.usuaris.totals.n)}
            </div>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Rutes Completades</span>
            <span class="kpi-val">${kpis.rutes.completades.disponible ? kpis.rutes.completades.valor : '0'}</span>
            <div class="kpi-meta">
              ${deltaFormat(kpis.rutes.completades.delta_pct, kpis.rutes.completades.delta_abs)}
              ${fiabilitatBadge(kpis.rutes.completades.fiabilitat, kpis.rutes.completades.n)}
            </div>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Taxa Abandonament</span>
            <span class="kpi-val">${kpis.rutes.taxa_abandonament.disponible ? `${kpis.rutes.taxa_abandonament.valor}%` : 'no disp.'}</span>
            <div class="kpi-meta">
              ${deltaFormat(kpis.rutes.taxa_abandonament.delta_pct, kpis.rutes.taxa_abandonament.delta_abs)}
              ${fiabilitatBadge(kpis.rutes.taxa_abandonament.fiabilitat, kpis.rutes.taxa_abandonament.n)}
            </div>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Valoració Mitjana</span>
            <span class="kpi-val">${kpis.valoracio.global.disponible ? `${kpis.valoracio.global.valor} ★` : 'no disp.'}</span>
            <div class="kpi-meta">
              ${deltaFormat(kpis.valoracio.global.delta_pct, kpis.valoracio.global.delta_abs)}
              ${fiabilitatBadge(kpis.valoracio.global.fiabilitat, kpis.valoracio.global.n)}
            </div>
          </div>
        </div>

        ${aiReport?.lectura_kpis?.length ? `
          <div class="card" style="padding: 10px 14px;">
            <h4 style="font-size: 11px; margin-bottom: 6px; color: #2D4636;">Lectura i Anàlisi Metodològica dels KPIs</h4>
            <table>
              <thead>
                <tr>
                  <th style="width: 20%;">KPI / Valor</th>
                  <th style="width: 25%;">Fet comprovat</th>
                  <th style="width: 30%;">Lectura analítica</th>
                  <th style="width: 25%;">Hipòtesi causal</th>
                </tr>
              </thead>
              <tbody>
                ${aiReport.lectura_kpis.map(lk => `
                  <tr>
                    <td>
                      <strong>${lk.kpi}</strong><br/>
                      <span style="font-size: 11px; font-weight: 700; color: #2D4636;">${lk.valor}</span>
                      ${lk.canvi ? `<span style="font-size: 9px; color: #666;"> (${lk.canvi})</span>` : ''}
                    </td>
                    <td>${lk.fet}</td>
                    <td>${lk.lectura}</td>
                    <td style="color: #666; font-style: italic;">${lk.hipotesi || 'Cap hipòtesi addicional'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>

      <!-- 2. Estat de les Rutes i Semàfor -->
      <div class="section">
        <h3 style="font-size: 13px; margin-bottom: 8px;">2. Rendiment dels Itineraris i Semàfor de Salut</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 30%;">Ruta</th>
              <th style="width: 15%;">Semàfor</th>
              <th style="width: 15%;">Completades</th>
              <th style="width: 15%;">Valoració</th>
              <th style="width: 25%;">Diagnòstic</th>
            </tr>
          </thead>
          <tbody>
            ${rutes.map(r => {
              const sem = semaforColor[r.semafor] || semaforColor.sense_dades;
              const aiRuta = aiReport?.rutes?.find(ar => ar.ruta_id === r.ruta_id);
              return `
                <tr>
                  <td>
                    <strong>${r.nom}</strong><br/>
                    <span style="font-size: 9px; color: #777;">${r.pois.length} POIs configurats</span>
                  </td>
                  <td>
                    <span class="tag-pill" style="background: ${sem.bg}; color: ${sem.text};">
                      ${sem.label}
                    </span>
                  </td>
                  <td>
                    <strong>${r.completades}</strong>
                    <span style="font-size: 9px; color: #777;">(aband.: ${r.abandonades})</span>
                  </td>
                  <td>
                    ${r.valoracio.mitjana !== null ? `<strong>${r.valoracio.mitjana} ★</strong> <span style="font-size: 9px; color: #777;">(n=${r.valoracio.n})</span>` : '<span style="color: #888;">Sense valoracions</span>'}
                  </td>
                  <td style="font-size: 10px;">
                    ${aiRuta?.lectura || (r.semafor === 'sense_dades' ? 'Sense dades de trànsit.' : 'Ruta operativa.')}
                  </td>
                </tr>
              `;
            }).join('')}
            ${rutes.length === 0 ? `
              <tr>
                <td colspan="5" style="text-align: center; color: #888; padding: 16px;">
                  El municipi no té cap ruta donada d'alta actualment.
                </td>
              </tr>
            ` : ''}
          </tbody>
        </table>
      </div>

      <!-- 3. Quizzes i Resolució de Reptes -->
      <div class="section">
        <h3 style="font-size: 13px; margin-bottom: 8px;">3. Quizzes i Participació Lúdica</h3>
        <div class="card" style="padding: 10px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div>
              <strong>Participació global:</strong> ${kpis.quiz.participacio_pct.disponible ? `${kpis.quiz.participacio_pct.valor}% dels desbloquejos` : 'Sense dades'} ·
              <strong>Intents mitjans:</strong> ${kpis.quiz.intents_mitjans.disponible ? `${kpis.quiz.intents_mitjans.valor} intents per quiz` : 'no disp.'}
            </div>
            <div style="font-size: 9px; color: #555;">
              Distribució d'intents:
              <strong>1r:</strong> ${kpis.quiz.distribucio_intents["1"]} |
              <strong>2n:</strong> ${kpis.quiz.distribucio_intents["2"]} |
              <strong>3r:</strong> ${kpis.quiz.distribucio_intents["3"]} |
              <strong>4t+:</strong> ${kpis.quiz.distribucio_intents["4"]}
            </div>
          </div>
          <p style="margin: 0; font-size: 10.5px; color: #333;">${aiReport?.quiz?.lectura_global || 'Sense incidències detectades en la resolució de quizzes.'}</p>

          ${aiReport?.quiz?.pois_a_revisar?.length ? `
            <div style="margin-top: 8px; border-top: 1px dashed #D5CEBE; padding-top: 6px;">
              <strong style="font-size: 10px; color: #b71c1c;">Punts d'Interès a revisar per dificultat excessiva o ambigüitat:</strong>
              <ul style="margin: 4px 0 0 16px; padding: 0; font-size: 10px;">
                ${aiReport.quiz.pois_a_revisar.map(p => `
                  <li><strong>${p.nom}:</strong> ${p.motiu}</li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- 4. Sensibilitat i Ressenyes dels Usuaris -->
      <div class="section">
        <h3 style="font-size: 13px; margin-bottom: 8px;">4. Sensibilitat dels Turistes i Punts Forts</h3>
        <div class="card" style="padding: 12px 14px;">
          <p style="margin-top: 0; margin-bottom: 8px; font-size: 10.5px;">
            ${aiReport?.comentaris?.sensibilitat || 'No s\'han registrat comentaris ni suggeriments per part dels usuaris en aquest període.'}
          </p>

          ${aiReport?.ben_fet?.length ? `
            <div style="margin-bottom: 10px;">
              <strong style="font-size: 10px; color: #2e7d32;">Elements ben valorats que cal mantenir:</strong>
              <ul style="margin: 4px 0 0 16px; padding: 0; font-size: 10px;">
                ${aiReport.ben_fet.map(bf => `
                  <li><strong>${bf.tema}:</strong> ${bf.evidencia}</li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          ${aiReport?.comentaris?.citacions?.length ? `
            <div style="margin-top: 6px;">
              <strong style="font-size: 10px; color: #555;">Citacions literals destacades (anònimes):</strong>
              ${aiReport.comentaris.citacions.slice(0, 3).map(cit => `
                <div class="quote-box">&ldquo;${cit}&rdquo;</div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- 5. Propostes de Millora Prioritzades (Màxim 5) -->
      <div class="section">
        <h3 style="font-size: 13px; margin-bottom: 8px;">5. Propostes d'Acció Prioritzades (Palanques Digitals Geocontent)</h3>
        ${(aiReport?.propostes || []).map((prop, idx) => `
          <div class="action-card">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
              <strong style="font-size: 11px; color: #2D4636;">
                #${prop.prioritat || idx + 1} · ${prop.titol}
              </strong>
              <span class="tag-pill" style="background: #e0f2f1; color: #00695c; font-size: 9px;">
                Palanca: ${prop.palanca} · Esforç: ${prop.esforc}
              </span>
            </div>
            <p style="margin: 0 0 4px 0; font-size: 10.5px; color: #333;">${prop.accio}</p>
            <div style="font-size: 9px; color: #666;">
              <strong>KPI objectiu al proper informe:</strong> ${prop.kpi_a_mirar}
            </div>
          </div>
        `).join('')}

        ${(!aiReport?.propostes || aiReport.propostes.length === 0) ? `
          <p style="font-style: italic; color: #777;">No hi ha prou dades per recomanar canvis en aquest període. Es recomana continuar registrant trànsit.</p>
        ` : ''}
      </div>

      <!-- 6. Limitacions Metodològiques -->
      ${aiReport?.limitacions?.length ? `
        <div class="section">
          <h4 style="font-size: 11px; margin-bottom: 4px; color: #666;">Limitacions i Consideracions Tècniques</h4>
          <ul style="margin: 0 0 0 16px; padding: 0; font-size: 9.5px; color: #666;">
            ${aiReport.limitacions.map(lim => `<li>${lim}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <!-- Footer -->
      <div class="footer">
        <div>Document oficial generat automàticament per Geocontent Core V1 · Ús intern i presentació a alcaldia.</div>
        <div>Generat: ${new Date().toLocaleDateString('ca-ES')} · RLS & Tenant Guard Actiu</div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Processa un informe executiu complet de punta a punta:
 * 1. Calcula mètriques i contracte de la Secció 3 via getExecutiveAnalytics.
 * 2. Genera l'anàlisi de l'Agent d'Informe Executiu via generateExecutiveReportAi.
 * 3. Renderitza l'informe en PDF A4 via Puppeteer.
 * 4. Desa l'arxiu i actualitza l'estat a PostgreSQL.
 */
export async function processReport(
  reportId: string,
  municipalityId: string,
  startDateParam?: Date,
  endDateParam?: Date
) {
  console.log(`[Processor] Iniciant processament de l'informe ${reportId} per al municipi ${municipalityId}`);

  try {
    // 1. Estat PROCESSING
    await prisma.report.update({
      where: { id: reportId },
      data: { status: 'PROCESSING' }
    });

    // 2. Determinar període d'anàlisi
    const now = new Date();
    const startDate = startDateParam || new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = endDateParam || now;

    // 3. Obtenir analítica del municipi respectant el contracte de la Secció 3 (Sense leaks globals)
    const analytics = await getExecutiveAnalytics(municipalityId, startDate, endDate);
    const { contract } = analytics;

    // 4. Execució de l'Agent d'Informe Executiu (Prompt Seccions 4 i 5 + Guardes Secció 9)
    console.log(`[Processor] Executant Agent d'Informe Executiu (nivell de dades: ${contract.nivell_dades})...`);
    const aiReport = await generateExecutiveReportAi(contract);

    // 5. Generació de l'HTML A4 per al PDF (retirat Rendiment setmanal tal com mana la Secció 8)
    console.log("[Processor] Maquetant HTML per al PDF executiu...");
    const html = buildExecutiveReportHtml(contract, aiReport);

    // 6. Renderitzat del PDF amb Puppeteer
    console.log("[Processor] Renderitzant PDF amb Puppeteer...");
    const pdfBuffer = await generatePdf(html);

    // 7. Desar PDF a les rutes corresponents
    const fileName = `report-${reportId}.pdf`;
    const publicDir = path.join(process.cwd(), 'public', 'reports');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    const filePath = path.join(publicDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    const tmpDir = path.join('/tmp', 'reports');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    fs.writeFileSync(path.join(tmpDir, fileName), pdfBuffer);

    // Endpoint relatiu d'accés segur
    const resultUrl = `/api/admin/reports/${reportId}/download`;

    // 8. Actualitzar registre a la BD amb l'estat COMPLETED
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'COMPLETED',
        resultUrl,
        data: {
          contract,
          aiReport,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          generatedAt: new Date().toISOString()
        } as any
      }
    });

    console.log(`[Processor] Informe ${reportId} completat amb èxit.`);
    return { success: true, url: resultUrl };

  } catch (error: any) {
    console.error(`[Processor] Error greu processant informe ${reportId}:`, error);
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'FAILED',
        data: { error: error.message || "Error desconegut durant la generació de l'informe" } as any
      }
    });
    return { success: false, error: error.message };
  }
}
