
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- DB WIPE START ---')
  try {
    const pVisits = await prisma.poiVisits.deleteMany({})
    const uUnlocks = await prisma.userUnlock.deleteMany({})
    const uProgress = await prisma.userRouteProgress.deleteMany({})
    const rPois = await prisma.routePoi.deleteMany({})
    const pois = await prisma.poi.deleteMany({})
    const routes = await prisma.route.deleteMany({})
    
    console.log('Results:', {
      poiVisits: pVisits.count,
      userUnlocks: uUnlocks.count,
      userRouteProgress: uProgress.count,
      routePois: rPois.count,
      pois: pois.count,
      routes: routes.count
    })
    console.log('--- DB WIPE SUCCESS ---')
  } catch (err) {
    console.error('--- DB WIPE FAILED ---', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
