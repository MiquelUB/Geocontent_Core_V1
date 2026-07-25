import { prisma } from '@/lib/database/prisma';

export async function getExecutiveAnalytics(municipalityId: string, startDate: Date, endDate: Date) {
    // For comparison (previous period of same length)
    const diff = endDate.getTime() - startDate.getTime();
    const prevStart = new Date(startDate.getTime() - diff);
    const prevEnd = new Date(startDate.getTime() - 1);

    // 1. Fetch Users Count (V2: Users visiting this municipality)
    const baseUsers = await prisma.user.findMany({
        where: {
            municipalityId,
            role: { not: 'SUPER_ADMIN' }
        },
        select: { id: true }
    });

    const [allTimeUnlocks, allTimeProgress] = await Promise.all([
        prisma.userUnlock.groupBy({
            by: ['userId'],
            where: { poi: { routePois: { some: { route: { municipalityId } } } } }
        }),
        prisma.userRouteProgress.groupBy({
            by: ['userId'],
            where: { route: { municipalityId } }
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
                poi: { routePois: { some: { route: { municipalityId } } } },
                unlockedAt: { gte: startDate, lte: endDate }
            }
        }),
        prisma.userRouteProgress.groupBy({
            by: ['userId'],
            where: {
                route: { municipalityId },
                createdAt: { gte: startDate, lte: endDate }
            }
        })
    ]);

    const activeUserCount = new Set([
        ...activePeriodUnlocks.map(u => u.userId),
        ...activePeriodProgress.map(p => p.userId)
    ]).size;

    // Previous period
    const [prevActiveUnlocks, prevActiveProgress] = await Promise.all([
        prisma.userUnlock.groupBy({
            by: ['userId'],
            where: {
                poi: { routePois: { some: { route: { municipalityId } } } },
                unlockedAt: { gte: prevStart, lte: prevEnd }
            }
        }),
        prisma.userRouteProgress.groupBy({
            by: ['userId'],
            where: {
                route: { municipalityId },
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
        where: {
            route: { municipalityId },
            createdAt: { gte: startDate, lte: endDate }
        }
    });

    const routeCompletionsInPeriod = await prisma.userRouteProgress.findMany({
        where: {
            route: { municipalityId },
            completedAt: { gte: startDate, lte: endDate, not: null }
        },
        include: {
            route: { select: { name: true } }
        }
    });

    const totalCompleted = routeCompletionsInPeriod.length;
    const abandonmentRate = routesStartedInPeriod > 0 ? Math.round((Math.max(0, routesStartedInPeriod - totalCompleted) / routesStartedInPeriod) * 100) : 0;

    const completionsPerRoute: Record<string, { name: string; count: number }> = {};
    routeCompletionsInPeriod.forEach((p: any) => {
        const routeName = p.route?.name || 'Ruta sense nom';
        if (!completionsPerRoute[p.routeId]) {
            completionsPerRoute[p.routeId] = { name: routeName, count: 0 };
        }
        completionsPerRoute[p.routeId].count++;
    });

    // 3. Quiz Statistics
    const allUnlocksData = await prisma.userUnlock.findMany({
        where: { 
            poi: { routePois: { some: { route: { municipalityId } } } },
            unlockedAt: { gte: startDate, lte: endDate }
        },
        include: { poi: { select: { title: true } } }
    });

    const totalUnlocks = allUnlocksData.length;
    const totalSolved = allUnlocksData.filter(u => u.quizSolved).length;
    const quizSuccessRate = totalUnlocks > 0 ? Math.round((totalSolved / totalUnlocks) * 100) : 0;

    const quizBreakdown: Record<string, { title: string; solved: number; total: number }> = {};
    allUnlocksData.forEach(u => {
        const poiId = u.poiId;
        if (!quizBreakdown[poiId]) {
            quizBreakdown[poiId] = { title: u.poi.title, solved: 0, total: 0 };
        }
        quizBreakdown[poiId].total++;
        if (u.quizSolved) quizBreakdown[poiId].solved++;
    });

    const quizDetails = Object.values(quizBreakdown).sort((a, b) => b.total - a.total);

    // 3.5. Route Ratings & Reviews Statistics
    const allRouteProgressWithReviews = await prisma.userRouteProgress.findMany({
        where: {
            route: { municipalityId },
            createdAt: { gte: startDate, lte: endDate },
            OR: [
                { rating: { gt: 0 } },
                { comment: { not: "" } }
            ]
        },
        include: {
            route: { select: { id: true, name: true } },
            user: { select: { username: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    const ratedProgress = allRouteProgressWithReviews.filter(r => (r.rating || 0) > 0);
    const totalReviewsCount = allRouteProgressWithReviews.length;
    const avgRatingNumber = ratedProgress.length > 0
        ? Math.round((ratedProgress.reduce((sum, r) => sum + (r.rating || 0), 0) / ratedProgress.length) * 10) / 10
        : 0;

    const reviewsDetails = allRouteProgressWithReviews.map(r => ({
        id: r.id,
        routeName: r.route?.name || 'Ruta',
        username: r.user?.username || 'Anònim',
        rating: r.rating || 0,
        comment: r.comment || '',
        createdAt: r.createdAt.toISOString()
    }));

    // 4. Daily Traffic (for the chart) - Real grouping by day
    const allPeriodUnlocks = await prisma.userUnlock.findMany({
        where: {
            poi: { routePois: { some: { route: { municipalityId } } } },
            unlockedAt: { gte: startDate, lte: endDate }
        },
        select: { unlockedAt: true, userId: true }
    });

    const dailyTraffic: Record<string, Set<string>> = {};
    // Initialize all days in the range
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

    const generateInsights = (users: number, completes: number, quizRate: number, abandonment: number, avgRating: number, reviewCount: number): string => {
        if (users === 0) return "S'espera aplegar dades del primer visitant per generar conclusions.";
        let insight = `S'han registrat ${users} visitants interactuant en aquest període. `;
        if (reviewCount > 0 && avgRating > 0) {
            insight += `La satisfacció mitjana dels visitants és de ${avgRating}/5 estrelles (basat en ${reviewCount} valoracions). `;
        }
        if (abandonment > 40) insight += `L'abandonament és elevat (${abandonment}%). `;
        if (quizRate > 80) insight += `L'èxit als reptes és excel·lent (${quizRate}%).`;
        return insight;
    };

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
        weeklyTraffic: weeklyTrafficData,
        aiInsights: generateInsights(activeUserCount, totalCompleted, quizSuccessRate, abandonmentRate, avgRatingNumber, totalReviewsCount)
    };
}

function calculateChange(current: number, prev: number): number {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
}
