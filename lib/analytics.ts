import { prisma } from '@/lib/database/prisma';
import {
  ExecutiveReportInputData,
  KPIValue,
  FiabilitatKpi,
  RutaSemafor,
  ComentariTipus,
  ClientTipus,
  NivellDades
} from './types/executiveReport';

/**
 * Construeix un objecte KPIValue segons el contracte de la Secció 3.
 */
function buildKpi(
  valor: number | null,
  anterior: number | null,
  n: number,
  thresholds: { baixa: number; mitjana: number } = { baixa: 5, mitjana: 20 }
): KPIValue {
  if (valor === null || n === 0) {
    return {
      valor: null,
      anterior: anterior !== null ? Math.round(anterior * 100) / 100 : null,
      delta_abs: null,
      delta_pct: null,
      n: 0,
      fiabilitat: 'baixa',
      disponible: false
    };
  }

  const fiabilitat: FiabilitatKpi =
    n < thresholds.baixa ? 'baixa' : n < thresholds.mitjana ? 'mitjana' : 'alta';

  let delta_abs: number | null = null;
  let delta_pct: number | null = null;

  if (anterior !== null) {
    delta_abs = Math.round((valor - anterior) * 100) / 100;
    if (anterior > 0) {
      delta_pct = Math.round(((valor - anterior) / anterior) * 100);
    }
  }

  return {
    valor: Math.round(valor * 100) / 100,
    anterior: anterior !== null ? Math.round(anterior * 100) / 100 : null,
    delta_abs,
    delta_pct,
    n,
    fiabilitat,
    disponible: true
  };
}

/**
 * Formata una data a dd/mm/aaaa.
 */
function formatDateDdMmYyyy(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Dedueix el número d'intents d'un quiz a partir dels punts d'XP obtinguts.
 * A Geocontent: base unlock = 100 XP. Quiz: 1r intent = +50 XP, 2n = +40 XP, 3r = +30 XP, 4t+ = +20 XP.
 */
function deduceAttempts(earnedXp: number, quizSolved: boolean): number | null {
  if (!quizSolved) return null;
  const quizXp = earnedXp - 100;
  if (quizXp >= 50) return 1;
  if (quizXp === 40) return 2;
  if (quizXp === 30) return 3;
  if (quizXp <= 20 && quizXp > 0) return 4;
  return 1;
}

/**
 * Obté totes les analítiques executores d'un municipi per a un període concret
 * respectant de forma estricta el contracte d'entrada de la Secció 3.
 * SENSE cap fallback global que barregi dades d'altres municipis.
 */
export async function getExecutiveAnalytics(municipalityId: string, startDate: Date, endDate: Date) {
  // 1. Dades del municipi
  const municipality = await prisma.municipality.findUnique({
    where: { id: municipalityId },
    select: { id: true, name: true, createdAt: true, planTier: true }
  });

  const clientNom = municipality?.name || 'Municipi';
  let clientTipus: ClientTipus = 'ajuntament';
  const lowerName = clientNom.toLowerCase();
  if (lowerName.includes('museu') || lowerName.includes('fundació') || lowerName.includes('centre')) {
    clientTipus = 'museu';
  } else if (lowerName.includes('associació') || lowerName.includes('consorci')) {
    clientTipus = 'associacio';
  }

  // 2. Períodes
  const diff = endDate.getTime() - startDate.getTime();
  const prevStart = new Date(startDate.getTime() - diff);
  const prevEnd = new Date(startDate.getTime() - 1);
  const dies = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));

  // 3. Rutes i POIs del municipi (amb aïllament estricte per RLS / tenant)
  const routes = await prisma.route.findMany({
    where: { municipalityId },
    include: {
      routePois: {
        include: {
          poi: {
            select: { id: true, title: true, latitude: true, longitude: true }
          }
        },
        orderBy: { orderIndex: 'asc' }
      }
    }
  });

  const routeIds = routes.map(r => r.id);
  const poiIds = Array.from(new Set(routes.flatMap(r => r.routePois.map(rp => rp.poiId))));

  // 4. Usuaris i interaccions
  // Usuaris registrats al municipi
  const registeredUsers = await prisma.user.findMany({
    where: { municipalityId },
    select: { id: true, createdAt: true }
  });

  // Interaccions històriques prèvies a startDate (per discernir usuaris nous vs recurrents)
  const [priorUnlocks, priorProgress] = await Promise.all([
    poiIds.length > 0 ? prisma.userUnlock.findMany({
      where: {
        poiId: { in: poiIds },
        unlockedAt: { lt: startDate }
      },
      select: { userId: true }
    }) : [],
    routeIds.length > 0 ? prisma.userRouteProgress.findMany({
      where: {
        routeId: { in: routeIds },
        createdAt: { lt: startDate }
      },
      select: { userId: true }
    }) : []
  ]);

  const priorUserIds = new Set<string>([
    ...registeredUsers.filter(u => u.createdAt < startDate).map(u => u.id),
    ...priorUnlocks.map(u => u.userId),
    ...priorProgress.map(p => p.userId)
  ]);

  // 5. Interaccions en el període actual
  const [periodUnlocks, periodProgress, periodVisits] = await Promise.all([
    poiIds.length > 0 ? prisma.userUnlock.findMany({
      where: {
        poiId: { in: poiIds },
        unlockedAt: { gte: startDate, lte: endDate }
      },
      include: {
        poi: { select: { id: true, title: true } }
      }
    }) : [],
    routeIds.length > 0 ? prisma.userRouteProgress.findMany({
      where: {
        routeId: { in: routeIds },
        OR: [
          { createdAt: { gte: startDate, lte: endDate } },
          { completedAt: { gte: startDate, lte: endDate } }
        ]
      },
      include: {
        route: { select: { id: true, name: true } },
        user: { select: { username: true } }
      },
      orderBy: { createdAt: 'desc' }
    }) : [],
    poiIds.length > 0 ? prisma.poiVisits.findMany({
      where: {
        poiId: { in: poiIds },
        entryTime: { gte: startDate, lte: endDate }
      },
      select: { poiId: true, durationSeconds: true }
    }) : []
  ]);

  // 6. Interaccions en el període anterior (mateixa durada)
  const [prevUnlocks, prevProgress, prevVisits] = await Promise.all([
    poiIds.length > 0 ? prisma.userUnlock.findMany({
      where: {
        poiId: { in: poiIds },
        unlockedAt: { gte: prevStart, lte: prevEnd }
      }
    }) : [],
    routeIds.length > 0 ? prisma.userRouteProgress.findMany({
      where: {
        routeId: { in: routeIds },
        OR: [
          { createdAt: { gte: prevStart, lte: prevEnd } },
          { completedAt: { gte: prevStart, lte: prevEnd } }
        ]
      }
    }) : [],
    poiIds.length > 0 ? prisma.poiVisits.findMany({
      where: {
        poiId: { in: poiIds },
        entryTime: { gte: prevStart, lte: prevEnd }
      },
      select: { poiId: true, durationSeconds: true }
    }) : []
  ]);

  // 7. Càlculs d'Usuaris
  const currentActiveUserIds = new Set<string>([
    ...periodUnlocks.map(u => u.userId),
    ...periodProgress.map(p => p.userId)
  ]);
  const activeUserCount = currentActiveUserIds.size;

  const prevActiveUserIds = new Set<string>([
    ...prevUnlocks.map(u => u.userId),
    ...prevProgress.map(p => p.userId)
  ]);
  const prevActiveCount = prevActiveUserIds.size;

  let newUsersCount = 0;
  let recurringUsersCount = 0;
  currentActiveUserIds.forEach(uid => {
    if (priorUserIds.has(uid)) {
      recurringUsersCount++;
    } else {
      newUsersCount++;
    }
  });

  const allMuniUserIds = new Set<string>([
    ...priorUserIds,
    ...currentActiveUserIds,
    ...registeredUsers.map(u => u.id)
  ]);
  const totalUsersCount = allMuniUserIds.size;

  // Dades d'usuaris del període anterior
  let prevNewCount: number | null = null;
  let prevRecCount: number | null = null;
  if (prevActiveCount > 0) {
    prevNewCount = prevActiveCount;
    prevRecCount = 0;
  }

  // 8. Càlculs de Rutes (Completades i Abandonades)
  const startedProgress = periodProgress.filter(
    p => p.createdAt >= startDate && p.createdAt <= endDate
  );
  const completedProgress = periodProgress.filter(
    p => p.completedAt && p.completedAt >= startDate && p.completedAt <= endDate
  );

  const completedCount = completedProgress.length;
  const startedCount = startedProgress.length;
  const abandonedCount = Math.max(0, startedCount - completedCount);
  const abandonmentRate = startedCount > 0 ? Math.round((abandonedCount / startedCount) * 100) : 0;

  const prevStarted = prevProgress.filter(
    p => p.createdAt >= prevStart && p.createdAt <= prevEnd
  ).length;
  const prevCompleted = prevProgress.filter(
    p => p.completedAt && p.completedAt >= prevStart && p.completedAt <= prevEnd
  ).length;
  const prevAbandoned = Math.max(0, prevStarted - prevCompleted);
  const prevAbandonmentRate = prevStarted > 0 ? Math.round((prevAbandoned / prevStarted) * 100) : null;

  // 9. Càlculs de Temps
  const validPeriodVisits = periodVisits.filter(v => typeof v.durationSeconds === 'number' && v.durationSeconds > 0);
  const avgPoiSec = validPeriodVisits.length > 0
    ? validPeriodVisits.reduce((acc, v) => acc + (v.durationSeconds || 0), 0) / validPeriodVisits.length
    : null;
  const avgPoiMin = avgPoiSec !== null ? Math.round((avgPoiSec / 60) * 10) / 10 : null;

  const validPrevVisits = prevVisits.filter(v => typeof v.durationSeconds === 'number' && v.durationSeconds > 0);
  const prevAvgPoiSec = validPrevVisits.length > 0
    ? validPrevVisits.reduce((acc, v) => acc + (v.durationSeconds || 0), 0) / validPrevVisits.length
    : null;
  const prevAvgPoiMin = prevAvgPoiSec !== null ? Math.round((prevAvgPoiSec / 60) * 10) / 10 : null;

  // Temps mitjà per ruta (a partir dels progressos completats)
  const routeDurationsMin: number[] = [];
  completedProgress.forEach(cp => {
    if (cp.createdAt && cp.completedAt) {
      const durMin = (cp.completedAt.getTime() - cp.createdAt.getTime()) / (1000 * 60);
      if (durMin > 0 && durMin <= 1440) {
        routeDurationsMin.push(durMin);
      }
    }
  });
  const avgRouteMin = routeDurationsMin.length > 0
    ? Math.round((routeDurationsMin.reduce((a, b) => a + b, 0) / routeDurationsMin.length) * 10) / 10
    : null;

  const prevRouteDurationsMin: number[] = [];
  prevProgress.forEach(pp => {
    if (pp.createdAt && pp.completedAt && pp.completedAt >= prevStart && pp.completedAt <= prevEnd) {
      const durMin = (pp.completedAt.getTime() - pp.createdAt.getTime()) / (1000 * 60);
      if (durMin > 0 && durMin <= 1440) prevRouteDurationsMin.push(durMin);
    }
  });
  const prevAvgRouteMin = prevRouteDurationsMin.length > 0
    ? Math.round((prevRouteDurationsMin.reduce((a, b) => a + b, 0) / prevRouteDurationsMin.length) * 10) / 10
    : null;

  // 10. Quizzes i Distribució d'Intents
  const quizDistribution = { "1": 0, "2": 0, "3": 0, "4": 0 };
  let totalSolvedQuiz = 0;
  let totalAttemptsSum = 0;

  periodUnlocks.forEach(u => {
    if (u.quizSolved) {
      totalSolvedQuiz++;
      const attempts = deduceAttempts(u.earnedXp, u.quizSolved) || 1;
      const key = String(Math.min(4, Math.max(1, attempts))) as "1" | "2" | "3" | "4";
      quizDistribution[key]++;
      totalAttemptsSum += attempts;
    }
  });

  const avgAttempts = totalSolvedQuiz > 0
    ? Math.round((totalAttemptsSum / totalSolvedQuiz) * 10) / 10
    : null;
  const totalUnlocksCount = periodUnlocks.length;
  const participationPct = totalUnlocksCount > 0
    ? Math.round((totalSolvedQuiz / totalUnlocksCount) * 100)
    : null;

  // Quizzes període anterior
  let prevTotalSolved = 0;
  let prevAttemptsSum = 0;
  prevUnlocks.forEach(u => {
    if (u.quizSolved) {
      prevTotalSolved++;
      const attempts = deduceAttempts(u.earnedXp, u.quizSolved) || 1;
      prevAttemptsSum += attempts;
    }
  });
  const prevAvgAttempts = prevTotalSolved > 0
    ? Math.round((prevAttemptsSum / prevTotalSolved) * 10) / 10
    : null;
  const prevParticipationPct = prevUnlocks.length > 0
    ? Math.round((prevTotalSolved / prevUnlocks.length) * 100)
    : null;

  // 11. Valoracions i Comentaris
  const periodReviews = periodProgress.filter(
    p => (p.rating && p.rating > 0) || (p.comment && p.comment.trim().length > 0)
  );
  const ratedReviews = periodReviews.filter(p => (p.rating || 0) > 0);
  const globalRating = ratedReviews.length > 0
    ? Math.round((ratedReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / ratedReviews.length) * 10) / 10
    : null;

  const prevRatedReviews = prevProgress.filter(p => (p.rating || 0) > 0);
  const prevGlobalRating = prevRatedReviews.length > 0
    ? Math.round((prevRatedReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / prevRatedReviews.length) * 10) / 10
    : null;

  // Processament i classificació de comentaris (Constitució III.4: untrusted_document)
  const accessKeywords = [
    'accés', 'acces', 'accedir', 'arribar', 'camí', 'cami', 'senyal', 'trobar',
    'perdut', 'horari', 'tancat', 'obert', 'porta', 'aparcament', 'parking',
    'direcció', 'direccio', 'indicació', 'indicacio', 'obres', 'perill', 'tallat',
    'error', 'erroni', 'errònia', 'erronia', 'fals', 'equivocat'
  ];

  let positiusCount = 0;
  let negatiusCount = 0;
  let docAccesCount = 0;

  const sanitizedComments: Array<{
    id: string;
    ruta_id: string;
    tipus: ComentariTipus;
    data: string;
    text: string;
  }> = [];

  periodReviews.forEach(p => {
    if (p.comment && p.comment.trim().length > 0) {
      // Neutralitzar etiquetes que podrien trencar el delimitador untrusted_document
      const cleanText = p.comment
        .replace(/<\/?untrusted_document>/gi, '')
        .replace(/<\/?[a-z][a-z0-9]*[^<>]*>/gi, '')
        .trim();

      const lower = cleanText.toLowerCase();
      let tipus: ComentariTipus = 'positiu';

      const isAccess = accessKeywords.some(kw => lower.includes(kw));
      if (isAccess) {
        tipus = 'documentacio_acces';
        docAccesCount++;
      } else if (
        (p.rating && p.rating <= 2) ||
        lower.includes('malament') ||
        lower.includes('decepció') ||
        lower.includes('dolent') ||
        lower.includes('mala') ||
        lower.includes('fatal')
      ) {
        tipus = 'negatiu';
        negatiusCount++;
      } else {
        tipus = 'positiu';
        positiusCount++;
      }

      sanitizedComments.push({
        id: p.id,
        ruta_id: p.routeId,
        tipus,
        data: formatDateDdMmYyyy(p.createdAt),
        text: cleanText
      });
    }
  });

  // 12. Dades de Rutes i Embut de POIs
  const allHistoricRatings = routeIds.length > 0 ? await prisma.userRouteProgress.findMany({
    where: {
      routeId: { in: routeIds },
      rating: { gt: 0 }
    },
    select: { routeId: true, rating: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  }) : [];

  const rutesPayload = routes.map(route => {
    const rProgress = periodProgress.filter(p => p.routeId === route.id);
    const rCompleted = rProgress.filter(p => p.completedAt && p.completedAt >= startDate && p.completedAt <= endDate).length;
    const rStarted = rProgress.filter(p => p.createdAt >= startDate && p.createdAt <= endDate).length;
    const rAbandoned = Math.max(0, rStarted - rCompleted);
    const rAbandonRate = rStarted > 0 ? Math.round((rAbandoned / rStarted) * 100) : 0;

    const rRated = rProgress.filter(p => (p.rating || 0) > 0);
    const rAvgRating = rRated.length > 0
      ? Math.round((rRated.reduce((s, p) => s + (p.rating || 0), 0) / rRated.length) * 10) / 10
      : null;

    // Historial per ruta
    const rHist = allHistoricRatings.filter(h => h.routeId === route.id);
    const histByDate: Record<string, { sum: number; n: number }> = {};
    rHist.forEach(h => {
      const d = formatDateDdMmYyyy(h.createdAt);
      if (!histByDate[d]) histByDate[d] = { sum: 0, n: 0 };
      histByDate[d].sum += (h.rating || 0);
      histByDate[d].n++;
    });

    const historial = Object.entries(histByDate).map(([data, v]) => ({
      data,
      mitjana: Math.round((v.sum / v.n) * 10) / 10,
      n: v.n
    }));

    // Temps mitjà per a aquesta ruta
    const rDurations: number[] = [];
    rProgress.forEach(p => {
      if (p.createdAt && p.completedAt) {
        const dMin = (p.completedAt.getTime() - p.createdAt.getTime()) / (1000 * 60);
        if (dMin > 0 && dMin <= 1440) rDurations.push(dMin);
      }
    });
    const rTempsMitja = rDurations.length > 0
      ? Math.round((rDurations.reduce((a, b) => a + b, 0) / rDurations.length) * 10) / 10
      : null;

    // Embut de POIs ordenats
    const poisPayload = route.routePois.map(rp => {
      const poiUnlocks = periodUnlocks.filter(u => u.poiId === rp.poiId);
      const poiVisits = validPeriodVisits.filter(v => v.poiId === rp.poiId);
      const pAvgSec = poiVisits.length > 0
        ? poiVisits.reduce((acc, v) => acc + (v.durationSeconds || 0), 0) / poiVisits.length
        : null;
      const pAvgMin = pAvgSec !== null ? Math.round((pAvgSec / 60) * 10) / 10 : null;

      const pSolved = poiUnlocks.filter(u => u.quizSolved);
      const pDist = { "1": 0, "2": 0, "3": 0, "4": 0 };
      let pSumAttempts = 0;
      pSolved.forEach(u => {
        const a = deduceAttempts(u.earnedXp, u.quizSolved) || 1;
        const k = String(Math.min(4, Math.max(1, a))) as "1" | "2" | "3" | "4";
        pDist[k]++;
        pSumAttempts += a;
      });

      const pAvgAttempts = pSolved.length > 0
        ? Math.round((pSumAttempts / pSolved.length) * 10) / 10
        : null;

      return {
        poi_id: rp.poiId,
        nom: rp.poi.title,
        ordre: rp.orderIndex + 1,
        desbloquejos: poiUnlocks.length,
        temps_mitja_min: pAvgMin,
        quiz: {
          n: pSolved.length,
          intents_mitjans: pAvgAttempts,
          distribucio_intents: pDist
        }
      };
    });

    // Determinació del semàfor segons regles del pla
    let semafor: RutaSemafor = 'sense_dades';
    const totalPoisUnlocks = poisPayload.reduce((s, p) => s + p.desbloquejos, 0);

    if (rStarted === 0 && totalPoisUnlocks === 0) {
      semafor = 'sense_dades';
    } else if (rAbandonRate > 50 || (rAvgRating !== null && rAvgRating < 3.0)) {
      semafor = 'a_revisar';
    } else if (rAbandonRate >= 30 || (rAvgRating !== null && rAvgRating < 4.0)) {
      semafor = 'a_vigilar';
    } else {
      semafor = 'consolidada';
    }

    return {
      ruta_id: route.id,
      nom: route.name || 'Ruta sense nom',
      activa: route.status !== 'CLOSED',
      semafor,
      valoracio: {
        mitjana: rAvgRating,
        n: rRated.length,
        historial
      },
      completades: rCompleted,
      abandonades: rAbandoned,
      temps_mitja_min: rTempsMitja,
      pois: poisPayload
    };
  });

  // 13. Informe anterior
  const previousReport = await prisma.report.findFirst({
    where: {
      municipalityId,
      status: 'COMPLETED',
      createdAt: { lt: startDate }
    },
    orderBy: { createdAt: 'desc' }
  });

  let informeAnteriorData = {
    disponible: false,
    data: '',
    resum: '',
    propostes: [] as Array<{ titol: string; ruta_id: string | null; poi_id: string | null }>
  };

  if (previousReport && previousReport.data) {
    const rawData = previousReport.data as any;
    const aiData = rawData.aiReport || rawData.aiSummary;
    const prevPropostes: any[] = Array.isArray(aiData?.propostes) ? aiData.propostes : [];

    informeAnteriorData = {
      disponible: true,
      data: formatDateDdMmYyyy(previousReport.createdAt),
      resum: typeof aiData === 'string' ? aiData.slice(0, 300) : (aiData?.resum_executiu?.titular || 'Informe anterior'),
      propostes: prevPropostes.map((p: any) => ({
        titol: p.titol || p.accio || 'Proposta anterior',
        ruta_id: p.on?.ruta_id || null,
        poi_id: p.on?.poi_id || null
      }))
    };
  }

  // 14. Nivell de dades (RF-A38)
  const isPeriodAnteriorDisponible = prevActiveCount > 0 || prevUnlocks.length > 0;
  let nivellDades: NivellDades = 'insuficient';

  if (activeUserCount === 0 && totalUnlocksCount === 0 && startedCount === 0) {
    nivellDades = 'insuficient';
  } else if (activeUserCount < 5 || totalUnlocksCount < 10) {
    nivellDades = 'preliminar';
  } else {
    nivellDades = 'suficient';
  }

  // 15. Construcció dels KPIs formalitzats
  const kpis = {
    usuaris: {
      totals: buildKpi(totalUsersCount, null, totalUsersCount, { baixa: 10, mitjana: 30 }),
      nous: buildKpi(newUsersCount, prevNewCount, newUsersCount, { baixa: 5, mitjana: 15 }),
      recurrents: buildKpi(recurringUsersCount, prevRecCount, recurringUsersCount, { baixa: 3, mitjana: 10 })
    },
    rutes: {
      completades: buildKpi(completedCount, prevCompleted, completedCount, { baixa: 3, mitjana: 10 }),
      abandonades: buildKpi(abandonedCount, prevAbandoned, startedCount, { baixa: 3, mitjana: 10 }),
      taxa_abandonament: buildKpi(
        startedCount > 0 ? abandonmentRate : null,
        prevAbandonmentRate,
        startedCount,
        { baixa: 5, mitjana: 15 }
      )
    },
    temps: {
      mitja_per_ruta_min: buildKpi(avgRouteMin, prevAvgRouteMin, routeDurationsMin.length, { baixa: 3, mitjana: 10 }),
      mitja_per_poi_min: buildKpi(avgPoiMin, prevAvgPoiMin, validPeriodVisits.length, { baixa: 5, mitjana: 20 })
    },
    quiz: {
      intents_mitjans: buildKpi(avgAttempts, prevAvgAttempts, totalSolvedQuiz, { baixa: 5, mitjana: 20 }),
      participacio_pct: buildKpi(participationPct, prevParticipationPct, totalUnlocksCount, { baixa: 5, mitjana: 20 }),
      distribucio_intents: quizDistribution
    },
    valoracio: {
      global: buildKpi(globalRating, prevGlobalRating, ratedReviews.length, { baixa: 3, mitjana: 10 })
    },
    comentaris: {
      totals: buildKpi(sanitizedComments.length, null, sanitizedComments.length, { baixa: 3, mitjana: 8 }),
      positius: positiusCount,
      negatius: negatiusCount,
      documentacio_acces: docAccesCount
    },
    dispositius: [] as Array<{ model: string; n: number }>
  };

  // Contracte formal Secció 3
  const contract: ExecutiveReportInputData = {
    client: {
      nom: clientNom,
      tipus: clientTipus
    },
    periode: {
      inici: formatDateDdMmYyyy(startDate),
      final: formatDateDdMmYyyy(endDate),
      dies
    },
    periode_anterior: {
      inici: formatDateDdMmYyyy(prevStart),
      final: formatDateDdMmYyyy(prevEnd),
      disponible: isPeriodAnteriorDisponible
    },
    nivell_dades: nivellDades,
    kpis,
    rutes: rutesPayload,
    comentaris: sanitizedComments,
    informe_anterior: informeAnteriorData
  };

  // 16. Dades per al dashboard interactiu (retrocompatibilitat per a ExecutiveReport.tsx)
  const completionsPerRoute: Record<string, { name: string; count: number }> = {};
  rutesPayload.forEach(r => {
    completionsPerRoute[r.ruta_id] = { name: r.nom, count: r.completades };
  });

  const quizDetails = poisPayloadSummary(rutesPayload);

  const reviewsDetails = sanitizedComments.map(c => {
    const matchedRoute = routes.find(r => r.id === c.ruta_id);
    const matchedProg = periodProgress.find(p => p.id === c.id);
    return {
      id: c.id,
      routeName: matchedRoute?.name || 'Ruta Turística',
      username: 'Usuari Anònim', // Protecció de privacitat
      rating: matchedProg?.rating || 0,
      comment: c.text,
      createdAt: matchedProg?.createdAt?.toISOString() || new Date().toISOString()
    };
  });

  // Agrupació de trànsit diari real en el període
  const dailyTraffic: Record<string, Set<string>> = {};
  const curr = new Date(startDate);
  while (curr <= endDate) {
    const dayLabel = curr.toLocaleDateString('ca-ES', { weekday: 'short' });
    dailyTraffic[dayLabel] = new Set();
    curr.setDate(curr.getDate() + 1);
  }

  periodUnlocks.forEach(u => {
    const dayLabel = u.unlockedAt.toLocaleDateString('ca-ES', { weekday: 'short' });
    if (dailyTraffic[dayLabel]) {
      dailyTraffic[dayLabel].add(u.userId);
    }
  });

  const weeklyTrafficData = Object.entries(dailyTraffic).map(([label, userSet]) => ({
    label: label.charAt(0).toUpperCase() + label.slice(1),
    value: userSet.size
  }));

  return {
    contract,
    metrics: {
      users: {
        value: totalUsersCount,
        active: activeUserCount,
        change: calculateChange(activeUserCount, prevActiveCount)
      },
      routesCompleted: {
        value: completedCount,
        change: calculateChange(completedCount, prevCompleted)
      },
      quizStats: {
        value: participationPct || 0,
        solved: totalSolvedQuiz,
        total: totalUnlocksCount,
        details: quizDetails
      },
      abandonmentRate: { value: abandonmentRate },
      ratingStats: {
        average: globalRating || 0,
        totalCount: ratedReviews.length,
        details: reviewsDetails
      }
    },
    routeCompletions: Object.values(completionsPerRoute),
    weeklyTraffic: weeklyTrafficData
  };
}

function poisPayloadSummary(rutes: any[]) {
  const result: Array<{ title: string; solved: number; total: number }> = [];
  rutes.forEach(r => {
    r.pois?.forEach((p: any) => {
      result.push({
        title: p.nom,
        solved: p.quiz?.n || 0,
        total: p.desbloquejos || 0
      });
    });
  });
  return result.sort((a, b) => b.total - a.total);
}

function calculateChange(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
}
