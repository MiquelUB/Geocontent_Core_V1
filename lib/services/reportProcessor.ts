import { prisma } from '@/lib/database/prisma';
import { generateExecutiveReportAi } from './openrouter';
import { generatePdf } from './pdf';
import { getExecutiveAnalytics } from '../analytics';
import { ExecutiveReportInputData, ExecutiveReportOutputJson } from '../types/executiveReport';
import { EXECUTIVE_REPORT_MUSTACHE_TEMPLATE } from '../templates/executiveReportTemplate';
import { ADMIN_THEMES } from '@/lib/adminTheme';
import Mustache from 'mustache';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Mapeig de temes a colors secundaris suaus per a les capçaleres i fons de targetes
 */
const THEME_BG_MAP: Record<string, string> = {
  mountain: '#eef3ef',
  coast: '#e6eef5',
  interior: '#f9ede9',
  bloom: '#faf0f5',
  city: '#f0f0f0'
};

/**
 * Textos d'estat per al seguiment de propostes
 */
const ESTAT_TEXTS: Record<string, string> = {
  millora: 'Millora',
  empitjora: 'Empitjora',
  sense_canvi: 'Sense canvi',
  no_valorable: 'No valorable'
};

/**
 * Textos descriptius de les palanques digitals
 */
const PALANCA_TEXTS: Record<string, string> = {
  contingut: 'Contingut',
  quiz: 'Quiz',
  estructura_ruta: 'Estructura de la ruta',
  traduccions: 'Traduccions',
  dates: 'Dates i temporada',
  offline: 'Mode offline',
  difusio_digital: 'Difusió digital',
  nova_ruta: 'Nova ruta'
};

/**
 * Textos dels semàfors de salut de les rutes
 */
const SEMAFOR_TEXTS: Record<string, string> = {
  consolidada: 'Consolidada',
  a_vigilar: 'A vigilar',
  a_revisar: 'A revisar',
  sense_dades: 'Sense dades'
};

/**
 * Genera un SVG inline del mapa de calor anònim a partir de les coordenades dels POIs
 */
function generateHeatmapSvg(pois: Array<{ nom: string; lat?: number | null; lng?: number | null; desbloquejos: number }>): string | null {
  const validPois = pois.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number' && (p.lat !== 0 || p.lng !== 0));
  if (validPois.length === 0) return null;

  const minLat = Math.min(...validPois.map(p => p.lat!));
  const maxLat = Math.max(...validPois.map(p => p.lat!));
  const minLng = Math.min(...validPois.map(p => p.lng!));
  const maxLng = Math.max(...validPois.map(p => p.lng!));

  const latSpan = Math.max(0.005, maxLat - minLat);
  const lngSpan = Math.max(0.005, maxLng - minLng);

  const maxUnlocks = Math.max(1, ...validPois.map(p => p.desbloquejos));

  const circles = validPois.map(p => {
    const x = Math.round(50 + ((p.lng! - minLng) / lngSpan) * 600);
    const y = Math.round(150 - ((p.lat! - minLat) / latSpan) * 120);
    const radius = Math.max(8, Math.min(24, Math.round(8 + (p.desbloquejos / maxUnlocks) * 16)));
    const opacity = (0.35 + (p.desbloquejos / maxUnlocks) * 0.45).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#2f8f5b" opacity="${opacity}" />
            <circle cx="${x}" cy="${y}" r="3" fill="#1f2933" />
            <text x="${x}" y="${y + radius + 11}" font-size="9" text-anchor="middle" fill="#555" font-family="system-ui">${p.nom.slice(0, 18)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 700 180" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: auto; background: #FAF8F5; border-radius: 6px; border: 1px solid #ECE7DB;">
    <rect width="100%" height="100%" fill="#F9F7F2"/>
    ${circles}
  </svg>`;
}

/**
 * Construeix l'HTML per a l'informe executiu usant el motor Mustache i la plantilla estàndard.
 * El backend calcula tots els percentatges, sparklines i textos d'estat.
 * La IA només aporta titulars i interpretacions textuals referenciades per ID.
 */
export function buildExecutiveReportHtml(
  contract: ExecutiveReportInputData,
  aiReport: ExecutiveReportOutputJson,
  municipalityThemeId: string = 'mountain',
  municipalityLogoUrl: string | null = null,
  poiCoordinates: Array<{ nom: string; lat?: number | null; lng?: number | null; desbloquejos: number }> = []
): string {
  const themeConfig = ADMIN_THEMES[municipalityThemeId] || ADMIN_THEMES.mountain;
  const color_primari = themeConfig.hex || '#2D4636';
  const color_secundari = THEME_BG_MAP[municipalityThemeId] || '#eef3ef';

  // 1. Dades de marca
  const marca = {
    color_primari,
    color_secundari,
    logo_url: municipalityLogoUrl
  };

  // 2. Data de generació en format dd/mm/aaaa
  const dNow = new Date();
  const generat_el = `${String(dNow.getDate()).padStart(2, '0')}/${String(dNow.getMonth() + 1).padStart(2, '0')}/${dNow.getFullYear()}`;

  // 3. Mapa de gràfiques (IA titular + lectura per ID)
  const defaultGrafiques: Record<string, { titular: string; lectura: string }> = {
    g_usuaris: {
      titular: "Evolució d'usuaris nous i recurrents",
      lectura: "Captació de nous visitants i taxa de retorn al municipi."
    },
    g_rutes: {
      titular: "Finalització i abandonament per ruta",
      lectura: "Proporció d'itineraris completats respecte als iniciats."
    },
    g_estrelles: {
      titular: "Valoració dels visitants per ruta",
      lectura: "Puntuacions en estrelles assignades pels usuaris."
    },
    g_quiz: {
      titular: "Distribució d'intents en els quizzes",
      lectura: "Dificultat percebuda en els reptes patrimonials."
    },
    g_embut: {
      titular: "Desbloquejos en ordre d'itinerari",
      lectura: "Retenció de visitants al llarg dels punts d'interès."
    },
    g_comentaris: {
      titular: "Classificació dels comentaris dels usuaris",
      lectura: "Tipologia de les opinions i incidències reportades."
    }
  };

  const grafiques: Record<string, { titular: string; lectura: string }> = { ...defaultGrafiques };
  if (Array.isArray(aiReport.grafiques)) {
    for (const g of aiReport.grafiques) {
      if (g && g.id) {
        grafiques[g.id] = {
          titular: g.titular || defaultGrafiques[g.id]?.titular || "",
          lectura: g.lectura || defaultGrafiques[g.id]?.lectura || ""
        };
      }
    }
  }

  // 4. Formatar canvis (deltes) dels KPIs
  const formatCanvi = (deltaPct: number | null): string | null => {
    if (!contract.periode_anterior.disponible || deltaPct === null) return null;
    const sign = deltaPct >= 0 ? '+' : '';
    return `${sign}${deltaPct}%`;
  };

  const findAiKpiState = (key: string, deltaPct: number | null): string => {
    const matched = aiReport.lectura_kpis?.find(lk => lk.kpi.toLowerCase().includes(key) || lk.refs.some(r => r.includes(key)));
    if (matched?.estat) return matched.estat;
    if (deltaPct === null) return 'neutre';
    return deltaPct >= 0 ? 'positiu' : 'atencio';
  };

  const findAiKpiLectura = (key: string, fallback: string): string => {
    const matched = aiReport.lectura_kpis?.find(lk => lk.kpi.toLowerCase().includes(key) || lk.refs.some(r => r.includes(key)));
    return matched?.lectura || fallback;
  };

  // 5. Preparació de KPIs per a la plantilla
  const kpis = [
    {
      nom: "Usuaris totals",
      disponible: contract.kpis.usuaris.totals.disponible,
      valor: contract.kpis.usuaris.totals.disponible ? String(contract.kpis.usuaris.totals.valor) : null,
      canvi: formatCanvi(contract.kpis.usuaris.totals.delta_pct),
      estat: findAiKpiState('usuaris', contract.kpis.usuaris.totals.delta_pct),
      fiabilitat: contract.kpis.usuaris.totals.fiabilitat,
      n: contract.kpis.usuaris.totals.n,
      lectura: findAiKpiLectura('usuaris', "Volum total d'usuaris que han interactuat amb el municipi.")
    },
    {
      nom: "Usuaris nous (captació)",
      disponible: contract.kpis.usuaris.nous.disponible,
      valor: contract.kpis.usuaris.nous.disponible ? String(contract.kpis.usuaris.nous.valor) : null,
      canvi: formatCanvi(contract.kpis.usuaris.nous.delta_pct),
      estat: findAiKpiState('nous', contract.kpis.usuaris.nous.delta_pct),
      fiabilitat: contract.kpis.usuaris.nous.fiabilitat,
      n: contract.kpis.usuaris.nous.n,
      lectura: findAiKpiLectura('nous', "Visitants que interactuen per primera vegada.")
    },
    {
      nom: "Rutes completades",
      disponible: contract.kpis.rutes.completades.disponible,
      valor: contract.kpis.rutes.completades.disponible ? String(contract.kpis.rutes.completades.valor) : '0',
      canvi: formatCanvi(contract.kpis.rutes.completades.delta_pct),
      estat: findAiKpiState('completades', contract.kpis.rutes.completades.delta_pct),
      fiabilitat: contract.kpis.rutes.completades.fiabilitat,
      n: contract.kpis.rutes.completades.n,
      lectura: findAiKpiLectura('completades', "Itineraris recorreguts fins a l'últim punt.")
    },
    {
      nom: "Taxa d'abandonament",
      disponible: contract.kpis.rutes.taxa_abandonament.disponible,
      valor: contract.kpis.rutes.taxa_abandonament.disponible ? `${contract.kpis.rutes.taxa_abandonament.valor}%` : null,
      canvi: formatCanvi(contract.kpis.rutes.taxa_abandonament.delta_pct),
      estat: contract.kpis.rutes.taxa_abandonament.valor && contract.kpis.rutes.taxa_abandonament.valor > 40 ? 'atencio' : 'positiu',
      fiabilitat: contract.kpis.rutes.taxa_abandonament.fiabilitat,
      n: contract.kpis.rutes.taxa_abandonament.n,
      lectura: findAiKpiLectura('abandonament', "Visitants sense connexió passades 24 hores.")
    },
    {
      nom: "Participació quizzes",
      disponible: contract.kpis.quiz.participacio_pct.disponible,
      valor: contract.kpis.quiz.participacio_pct.disponible ? `${contract.kpis.quiz.participacio_pct.valor}%` : null,
      canvi: formatCanvi(contract.kpis.quiz.participacio_pct.delta_pct),
      estat: findAiKpiState('quiz', contract.kpis.quiz.participacio_pct.delta_pct),
      fiabilitat: contract.kpis.quiz.participacio_pct.fiabilitat,
      n: contract.kpis.quiz.participacio_pct.n,
      lectura: findAiKpiLectura('quiz', "Percentatge de desbloquejos amb repte superat.")
    },
    {
      nom: "Valoració global",
      disponible: contract.kpis.valoracio.global.disponible,
      valor: contract.kpis.valoracio.global.disponible ? `${contract.kpis.valoracio.global.valor} ★` : null,
      canvi: formatCanvi(contract.kpis.valoracio.global.delta_pct),
      estat: findAiKpiState('valoracio', contract.kpis.valoracio.global.delta_pct),
      fiabilitat: contract.kpis.valoracio.global.fiabilitat,
      n: contract.kpis.valoracio.global.n,
      lectura: findAiKpiLectura('valoracio', "Mitjana de satisfacció recollida a les rutes.")
    }
  ];

  // 6. Gràfica d'Usuaris (barres actual vs anterior)
  const maxUsers = Math.max(
    1,
    contract.kpis.usuaris.totals.valor || 0,
    contract.kpis.usuaris.totals.anterior || 0,
    (contract.kpis.usuaris.nous.valor || 0) + (contract.kpis.usuaris.recurrents.valor || 0)
  );

  const g_usuaris = [
    {
      etiqueta: "Usuaris nous (captació)",
      pct_actual: Math.round(((contract.kpis.usuaris.nous.valor || 0) / maxUsers) * 100),
      pct_anterior: Math.round(((contract.kpis.usuaris.nous.anterior || 0) / maxUsers) * 100),
      te_anterior: contract.periode_anterior.disponible && contract.kpis.usuaris.nous.anterior !== null,
      actual: contract.kpis.usuaris.nous.valor || 0,
      anterior: contract.kpis.usuaris.nous.anterior || 0
    },
    {
      etiqueta: "Usuaris recurrents (retorn)",
      pct_actual: Math.round(((contract.kpis.usuaris.recurrents.valor || 0) / maxUsers) * 100),
      pct_anterior: Math.round(((contract.kpis.usuaris.recurrents.anterior || 0) / maxUsers) * 100),
      te_anterior: contract.periode_anterior.disponible && contract.kpis.usuaris.recurrents.anterior !== null,
      actual: contract.kpis.usuaris.recurrents.valor || 0,
      anterior: contract.kpis.usuaris.recurrents.anterior || 0
    },
    {
      etiqueta: "Usuaris totals actius",
      pct_actual: Math.round(((contract.kpis.usuaris.totals.valor || 0) / maxUsers) * 100),
      pct_anterior: Math.round(((contract.kpis.usuaris.totals.anterior || 0) / maxUsers) * 100),
      te_anterior: contract.periode_anterior.disponible && contract.kpis.usuaris.totals.anterior !== null,
      actual: contract.kpis.usuaris.totals.valor || 0,
      anterior: contract.kpis.usuaris.totals.anterior || 0
    }
  ];

  // 7. Gràfica de Rutes (completades vs abandonades)
  const g_rutes = contract.rutes.map(r => {
    const total = r.completades + r.abandonades;
    const pct_completades = total > 0 ? Math.round((r.completades / total) * 100) : 0;
    const pct_abandonades = total > 0 ? 100 - pct_completades : 0;
    return {
      nom: r.nom,
      pct_completades,
      pct_abandonades,
      completades: r.completades,
      abandonades: r.abandonades
    };
  });

  // 8. Rutes amb valoració, sparkline i semàfor
  const rutes = contract.rutes.map(r => {
    const aiRuta = aiReport.rutes?.find(ar => ar.ruta_id === r.ruta_id);
    const isDispon = r.valoracio.mitjana !== null && r.valoracio.n > 0;
    const pct_estrelles = isDispon ? Math.round((r.valoracio.mitjana! / 5) * 100) : 0;

    // Sparkline: nomes si te 2 o mes punts d'historial
    let sparkline: string | null = null;
    if (r.valoracio.historial && r.valoracio.historial.length >= 2) {
      const h = r.valoracio.historial;
      const points = h.map((pt, idx) => {
        const x = Math.round((idx / (h.length - 1)) * 100);
        const val = Math.max(1, Math.min(5, pt.mitjana));
        const y = Math.round(26 - ((val - 1) / 4) * 22);
        return `${x},${y}`;
      });
      sparkline = points.join(' ');
    }

    return {
      nom: r.nom,
      lectura: aiRuta?.lectura || (r.semafor === 'sense_dades' ? 'Sense dades d\'activitat en el període.' : 'Ruta operativa.'),
      valoracio: {
        disponible: isDispon,
        pct_estrelles,
        mitjana: r.valoracio.mitjana,
        n: r.valoracio.n,
        sparkline
      },
      evolucio: aiRuta?.evolucio || (r.valoracio.historial.length >= 2 ? 'estable' : 'sense_historial'),
      semafor: r.semafor,
      semafor_text: SEMAFOR_TEXTS[r.semafor] || 'Sense dades'
    };
  });

  // 9. Quizzes (distribució d'intents)
  const dist = contract.kpis.quiz.distribucio_intents;
  const totalSolved = dist["1"] + dist["2"] + dist["3"] + dist["4"];
  const g_quiz: any[] = [];

  if (totalSolved > 0) {
    const p1 = Math.round((dist["1"] / totalSolved) * 100);
    const p2 = Math.round((dist["2"] / totalSolved) * 100);
    const p3 = Math.round((dist["3"] / totalSolved) * 100);
    const p4 = Math.max(0, 100 - p1 - p2 - p3);
    g_quiz.push({
      etiqueta: "Distribució global",
      pct1: p1,
      pct2: p2,
      pct3: p3,
      pct4: p4,
      n: totalSolved
    });
  }

  contract.rutes.forEach(r => {
    r.pois.forEach(p => {
      if (p.quiz.n > 0) {
        const nPoi = p.quiz.n;
        const pd = p.quiz.distribucio_intents;
        const q1 = Math.round((pd["1"] / nPoi) * 100);
        const q2 = Math.round((pd["2"] / nPoi) * 100);
        const q3 = Math.round((pd["3"] / nPoi) * 100);
        const q4 = Math.max(0, 100 - q1 - q2 - q3);
        g_quiz.push({
          etiqueta: `${p.nom} (${r.nom})`,
          pct1: q1,
          pct2: q2,
          pct3: q3,
          pct4: q4,
          n: nPoi
        });
      }
    });
  });

  if (g_quiz.length === 0) {
    g_quiz.push({
      etiqueta: "Distribució global",
      pct1: 0,
      pct2: 0,
      pct3: 0,
      pct4: 0,
      n: 0
    });
  }

  // 10. Embut per ruta (desbloquejos per POI en ordre)
  const g_embut = contract.rutes
    .filter(r => r.pois.length > 0)
    .map(r => {
      const maxDesbloquejos = Math.max(1, ...r.pois.map(p => p.desbloquejos));
      return {
        ruta_nom: r.nom,
        pois: r.pois.map(p => ({
          ordre: p.ordre,
          nom: p.nom,
          desbloquejos: p.desbloquejos,
          pct: Math.round((p.desbloquejos / maxDesbloquejos) * 100)
        }))
      };
    });

  // 11. Comentaris (barres per tipus)
  const totCom = contract.kpis.comentaris.positius + contract.kpis.comentaris.negatius + contract.kpis.comentaris.documentacio_acces;
  const g_comentaris = [
    {
      etiqueta: "Positius",
      pct: totCom > 0 ? Math.round((contract.kpis.comentaris.positius / totCom) * 100) : 0,
      n: contract.kpis.comentaris.positius
    },
    {
      etiqueta: "Negatius",
      pct: totCom > 0 ? Math.round((contract.kpis.comentaris.negatius / totCom) * 100) : 0,
      n: contract.kpis.comentaris.negatius
    },
    {
      etiqueta: "Documentació i accés",
      pct: totCom > 0 ? Math.round((contract.kpis.comentaris.documentacio_acces / totCom) * 100) : 0,
      n: contract.kpis.comentaris.documentacio_acces
    }
  ];

  // 12. Seguiment informe anterior
  const seguiment_anterior = (aiReport.seguiment_anterior || []).map(s => ({
    proposta: s.proposta,
    estat_text: ESTAT_TEXTS[s.estat_kpi] || s.estat_kpi,
    nota: s.nota
  }));

  // 13. Propostes d'acció amb palanca_text i on_text
  const propostes = (aiReport.propostes || []).map(p => {
    let on_text: string | null = null;
    if (p.on?.poi_id) {
      let foundPoi: { nom: string } | undefined;
      for (const r of contract.rutes) {
        const match = r.pois.find(poi => poi.poi_id === p.on.poi_id);
        if (match) { foundPoi = match; break; }
      }
      on_text = foundPoi ? `Punt: ${foundPoi.nom}` : `Punt: ${p.on.poi_id.slice(0, 8)}`;
    } else if (p.on?.ruta_id) {
      const match = contract.rutes.find(r => r.ruta_id === p.on.ruta_id);
      on_text = match ? `Ruta: ${match.nom}` : `Ruta: ${p.on.ruta_id.slice(0, 8)}`;
    }

    return {
      prioritat: p.prioritat,
      titol: p.titol,
      accio: p.accio,
      palanca_text: PALANCA_TEXTS[p.palanca] || p.palanca,
      esforc: p.esforc,
      on_text,
      kpi_a_mirar: p.kpi_a_mirar
    };
  });

  // 14. Mapa de calor SVG anònim
  const mapa_calor_svg = generateHeatmapSvg(poiCoordinates);

  // Model de dades complet per a Mustache
  const viewModel = {
    client: { nom: contract.client.nom },
    marca,
    periode: {
      inici: contract.periode.inici,
      final: contract.periode.final
    },
    periode_anterior: {
      inici: contract.periode_anterior.inici,
      final: contract.periode_anterior.final,
      disponible: contract.periode_anterior.disponible
    },
    preliminar: contract.nivell_dades === 'preliminar',
    resum_executiu: aiReport.resum_executiu,
    kpis,
    grafiques,
    g_usuaris,
    g_rutes,
    rutes,
    g_quiz,
    quiz: aiReport.quiz,
    g_embut,
    g_comentaris,
    comentaris: aiReport.comentaris,
    ben_fet: aiReport.ben_fet,
    seguiment_anterior,
    propostes,
    mapa_calor_svg,
    limitacions: aiReport.limitacions || [],
    generat_el
  };

  return Mustache.render(EXECUTIVE_REPORT_MUSTACHE_TEMPLATE, viewModel);
}

/**
 * Processa un informe executiu complet de punta a punta:
 * 1. Calcula mètriques i contracte de la Secció 3 via getExecutiveAnalytics.
 * 2. Genera l'anàlisi de l'Agent d'Informe Executiu via generateExecutiveReportAi.
 * 3. Renderitza l'informe en PDF A4 via Puppeteer i la plantilla estàndard Mustache.
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

    // Dades de marca i coordenades del municipi
    const municipality = await prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { themeId: true, logoUrl: true }
    });

    const poisRaw = await prisma.poi.findMany({
      where: {
        routePois: {
          some: { route: { municipalityId } }
        }
      },
      select: {
        title: true,
        latitude: true,
        longitude: true,
        userUnlocks: {
          where: {
            unlockedAt: { gte: startDate, lte: endDate }
          },
          select: { userId: true }
        }
      }
    });

    const poiCoordinates = poisRaw.map(p => ({
      nom: p.title,
      lat: p.latitude,
      lng: p.longitude,
      desbloquejos: p.userUnlocks.length
    }));

    // 4. Execució de l'Agent d'Informe Executiu (Prompt Seccions 4 i 5 + Guardes Secció 9)
    console.log(`[Processor] Executant Agent d'Informe Executiu (nivell de dades: ${contract.nivell_dades})...`);
    const aiReport = await generateExecutiveReportAi(contract);

    // 5. Generació de l'HTML A4 per al PDF mitjançant la plantilla Mustache estàndard
    console.log("[Processor] Maquetant HTML per al PDF executiu amb Mustache...");
    const html = buildExecutiveReportHtml(
      contract,
      aiReport,
      municipality?.themeId || 'mountain',
      municipality?.logoUrl || null,
      poiCoordinates
    );

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
