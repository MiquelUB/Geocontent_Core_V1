import { prisma } from "./database/prisma";

export type PlanTier = 'roure' | 'mirador' | 'enterprise';

interface PlanConfig {
  name: string;
  maxRoutes: number;
  maxPoisPerRoute: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanConfig> = {
  roure: {
    name: 'Pla Roure',
    maxRoutes: 5,
    maxPoisPerRoute: 10,
  },
  mirador: {
    name: 'Pla Mirador',
    maxRoutes: 10,
    maxPoisPerRoute: 20,
  },
  enterprise: {
    name: 'Pla Enterprise',
    maxRoutes: 999,
    maxPoisPerRoute: 100,
  },
};

export async function checkPlanLimits(municipalityId: string) {
  const municipality = await prisma.municipality.findUnique({
    where: { id: municipalityId },
    select: {
      planTier: true,
      _count: {
        select: {
          routes: true,
        },
      },
    } as any,
  }) as any;

  if (!municipality) {
    throw new Error('Municipality not found');
  }

  // Map old tiers to new ones if necessary, default to roure
  let tier = (municipality.planTier?.toLowerCase() as PlanTier) || 'roure';
  if (tier as string === 'basic') tier = 'roure';
  if (tier as string === 'professional') tier = 'mirador';

  const config = PLAN_LIMITS[tier] || PLAN_LIMITS.roure;

  const currentRoutes = municipality._count.routes;
  const totalAllowedRoutes = config.maxRoutes;

  return {
    isWithinRouteLimit: currentRoutes < totalAllowedRoutes,
    currentRoutes,
    maxRoutes: totalAllowedRoutes,
    maxPoisPerRoute: config.maxPoisPerRoute,
    tier,
    planName: config.name,
    extraRoutes: 0
  };
}

export async function canAddPoiToRoute(routeId: string) {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: {
      municipality: {
        select: { planTier: true }
      },
      _count: {
        select: { routePois: true }
      }
    }
  });

  if (!route || !route.municipality) return true;

  let tier = (route.municipality.planTier?.toLowerCase() as PlanTier) || 'roure';
  if (tier as string === 'basic') tier = 'roure';
  if (tier as string === 'professional') tier = 'mirador';

  const config = PLAN_LIMITS[tier] || PLAN_LIMITS.roure;

  return route._count.routePois < config.maxPoisPerRoute;
}
