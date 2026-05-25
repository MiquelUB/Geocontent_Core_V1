
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🗑️ Starting total deletion of POIs and Routes...');
  
  // Order matters because of foreign keys
  // First, delete related data if necessary (unlocks, visits, etc.)
  // Actually, we'll try to delete them directly and if there are constraints, we'll handle them.

  try {
    // Delete POI unlocks/visits first
    const unlocks = await prisma.userPOIUnlock.deleteMany({});
    console.log(`- Deleted ${unlocks.count} user unlocks.`);

    const visits = await prisma.visit.deleteMany({});
    console.log(`- Deleted ${visits.count} user visits.`);

    // Delete POIs
    const pois = await prisma.poi.deleteMany({});
    console.log(`- Deleted ${pois.count} POIs.`);

    // Delete RoutePOIs (the join table)
    const routePois = await prisma.routePoi.deleteMany({});
    console.log(`- Deleted ${routePois.count} Route-POI mappings.`);

    // Delete Routes
    const routes = await prisma.route.deleteMany({});
    console.log(`- Deleted ${routes.count} Routes.`);

    console.log('✅ Database cleaned successfully!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
