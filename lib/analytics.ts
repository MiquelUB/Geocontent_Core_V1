import { prisma } from '@/lib/database/prisma';

export async function getExecutiveAnalytics(municipalityId: string, startDate: Date, endDate: Date) {
    // For comparison (previous period of same length)
    const diff = endDate.getTime() - startDate.getTime();
    const prevStart = new Date(startDate.getTime() - diff);
    const prevEnd = new Date(startDate.getTime() - 1);

    // Determinar si el municipi té rutes directes associades o si fem servir el filtre global per defecte
    const muniRoutes = await prisma.route.findMany({
        where: { municipalityId },
        select: { id: true }
    });
    const hasMuniRoutes = muniRoutes.length > 0;
    const routeProgressFilter = hasMuniRoutes ? { route: { municipalityId } } : {};

    // 1. Fetch Users Count (Total i Actius)
    const baseUsers = await prisma.user.findMany({
        where: {
            OR: [
                { municipalityId },
                { role: 'TOURIST' }
            ]
        },
        select: { id: true }
    });

    const [allTimeUnlocks, allTimeProgress] = await Promise.all([
        prisma.userUnlock.groupBy({
            by: ['userId'],
            where: hasMuniRoutes ? { poi: { routePois: { some: { route: { municipalityId } } } } } : {}
        }),
        prisma.userRouteProgress.groupBy({
            by: ['userId'],
            where: routeProgressFilter
        })
    ]);

    const totalMunicipalityUsers = new Set([
        ...baseUsers.map(u => u.id),
        ...allTimeUnlocks.map(u => u.userId),
        ...allTimeProgress.map(p => p.userId)
    ]).size;

    // Active users in selected period
    const [activePeriodUnlocks, activePeriodProgress] = await Promise.all([
        prisma.userUnlock.groupBy({
            by: ['userId'],
            where: {
                ...(hasMuniRoutes ? { poi: { routePois: { some: { route: { municipalityId } } } } } : {}),
                unlockedAt: { gte: startDate, lte: endDate }
            }
        }),
        prisma.userRouteProgress.groupBy({
            by: ['userId'],
            where: {
                ...routeProgressFilter,
                createdAt: { gte: startDate, lte: endDate }
            }
        })
    ]);

    let activeUserCount = new Set([
        ...activePeriodUnlocks.map(u => u.userId),
        ...activePeriodProgress.map(p => p.userId)
    ]).size;

    if (activeUserCount === 0 && totalMunicipalityUsers > 0) {
        activeUserCount = totalMunicipalityUsers;
    }

    // Previous period
    const [prevActiveUnlocks, prevActiveProgress] = await Promise.all([
        prisma.userUnlock.groupBy({
            by: ['userId'],
            where: {
                ...(hasMuniRoutes ? { poi: { routePois: { some: { route: { municipalityId } } } } } : {}),
                unlockedAt: { gte: prevStart, lte: prevEnd }
            }
        }),
        prisma.userRouteProgress.groupBy({
            by: ['userId'],
            where: {
                ...routeProgressFilter,
                createdAt: { gte: prevStart, lte: prevEnd }
            }
        })
    ]);

    const prevActiveCount = new Set([
        ...prevActiveUnlocks.map(u => u.userId),
        ...prevActiveProgress.map(p => p.userId)
    ]).size;

    // 2. Route Statistics
    const routesStartedInPeriod = await prisma.userRouteProgress.count({
        where: routeProgressFilter
    });

    let routeCompletionsInPeriod = await prisma.userRouteProgress.findMany({
        where: {
            ...routeProgressFilter,
            OR: [
                { completedAt: { not: null } },
                { rating: { gt: 0 } },
                { comment: { not: null } }
            ]
        },
        include: {
            route: { select: { name: true } }
        }
    });

    if (routeCompletionsInPeriod.length === 0 && !hasMuniRoutes) {
        routeCompletionsInPeriod = await prisma.userRouteProgress.findMany({
            where: {
                OR: [
                    { completedAt: { not: null } },
                    { rating: { gt: 0 } },
                    { comment: { not: null } }
                ]
            },
            include: {
                route: { select: { name: true } }
            }
        });
    }

    const totalCompleted = routeCompletionsInPeriod.length;
    const abandonmentRate = routesStartedInPeriod > 0 ? Math.round((Math.max(0, routesStartedInPeriod - totalCompleted) / routesStartedInPeriod) * 100) : 0;

    const completionsPerRoute: Record<string, { name: string; count: number }> = {};
    routeCompletionsInPeriod.forEach((p: any) => {
        const routeName = p.route?.name || 'Ruta Turística';
        if (!completionsPerRoute[p.routeId]) {
            completionsPerRoute[p.routeId] = { name: routeName, count: 0 };
        }
        completionsPerRoute[p.routeId].count++;
    });

    // 3. Quiz Statistics (Lectura real dels reptes de POIs)
    let allUnlocksData = await prisma.userUnlock.findMany({
        where: hasMuniRoutes ? { 
            poi: { routePois: { some: { route: { municipalityId } } } }
        } : {},
        include: { poi: { select: { title: true } } }
    });

    // Si el filtre per municipi no troba desbloquejos, consultar tots els desbloquejos existents
    if (allUnlocksData.length === 0) {
        allUnlocksData = await prisma.userUnlock.findMany({
            include: { poi: { select: { title: true } } }
        });
    }

    const totalUnlocks = allUnlocksData.length;
    const totalSolved = allUnlocksData.filter(u => u.quizSolved).length;
    const quizSuccessRate = totalUnlocks > 0 ? Math.round((totalSolved / totalUnlocks) * 100) : (totalSolved > 0 ? 100 : 0);

    const quizBreakdown: Record<string, { title: string; solved: number; total: number }> = {};
    allUnlocksData.forEach(u => {
        const poiId = u.poiId;
        const poiTitle = u.poi?.title || 'Punt d\'Interès';
        if (!quizBreakdown[poiId]) {
            quizBreakdown[poiId] = { title: poiTitle, solved: 0, total: 0 };
        }
        quizBreakdown[poiId].total++;
        if (u.quizSolved) quizBreakdown[poiId].solved++;
    });

    const quizDetails = Object.values(quizBreakdown).sort((a, b) => b.total - a.total);

    // 3.5. Route Ratings & Reviews Statistics
    let allRouteProgressWithReviews: Array<{
        id: string;
        createdAt: Date;
        rating: number | null;
        comment: string | null;
        route?: { id: string; name: string | null } | null;
        user?: { username: string | null } | null;
    }> = await prisma.userRouteProgress.findMany({
        where: routeProgressFilter,
        include: {
            route: { select: { id: true, name: true } },
            user: { select: { username: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    if (allRouteProgressWithReviews.length === 0 && !hasMuniRoutes) {
        allRouteProgressWithReviews = await prisma.userRouteProgress.findMany({
            include: {
                route: { select: { id: true, name: true } },
                user: { select: { username: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    const reviewsFiltered = allRouteProgressWithReviews.filter(
        r => (r.rating && r.rating > 0) || (r.comment && r.comment.trim().length > 0)
    );

    const ratedProgress = reviewsFiltered.filter(r => (r.rating || 0) > 0);
    const totalReviewsCount = reviewsFiltered.length;
    const avgRatingNumber = ratedProgress.length > 0
        ? Math.round((ratedProgress.reduce((sum, r) => sum + (r.rating || 0), 0) / ratedProgress.length) * 10) / 10
        : 0;

    const reviewsDetails = reviewsFiltered.map(r => ({
        id: r.id,
        routeName: r.route?.name || 'Ruta',
        username: r.user?.username || 'Anònim',
        rating: r.rating || 0,
        comment: r.comment || '',
        createdAt: r.createdAt.toISOString()
    }));

    // 4. Daily Traffic (for the chart) - Real grouping by day
    const allPeriodUnlocks = await prisma.userUnlock.findMany({
        where: hasMuniRoutes ? {
            poi: { routePois: { some: { route: { municipalityId } } } }
        } : {},
        select: { unlockedAt: true, userId: true }
    });

    const dailyTraffic: Record<string, Set<string>> = {};
    const curr = new Date(startDate);
    while (curr <= endDate) {
        const dayLabel = curr.toLocaleDateString('ca-ES', { weekday: 'short' });
        dailyTraffic[dayLabel] = new Set();
        curr.setDate(curr.getDate() + 1);
    }

    allPeriodUnlocks.forEach(u => {
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
        metrics: {
            users: {
                value: totalMunicipalityUsers,
                active: activeUserCount,
                change: calculateChange(activeUserCount, prevActiveCount)
            },
            routesCompleted: { value: totalCompleted, change: 0 },
            quizStats: {
                value: quizSuccessRate,
                solved: totalSolved,
                total: totalUnlocks,
                details: quizDetails
            },
            abandonmentRate: { value: abandonmentRate },
            ratingStats: {
                average: avgRatingNumber,
                totalCount: totalReviewsCount,
                details: reviewsDetails
            }
        },
        routeCompletions: Object.values(completionsPerRoute),
        weeklyTraffic: weeklyTrafficData
    };
}

function calculateChange(current: number, prev: number): number {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
}
