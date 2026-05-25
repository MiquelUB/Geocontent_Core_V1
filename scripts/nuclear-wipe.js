
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔥 STARTING NUCLEAR CLEANUP (SQL) 🔥');
  
  try {
    // We use a transaction and raw SQL to bypass Prisma model issues
    await prisma.$transaction([
      prisma.$executeRaw`DELETE FROM "UserPOIUnlock"`,
      prisma.$executeRaw`DELETE FROM "Visit"`,
      prisma.$executeRaw`DELETE FROM "RoutePoi"`,
      prisma.$executeRaw`DELETE FROM "POI"`,
      prisma.$executeRaw`DELETE FROM "Route"`
    ]);

    console.log('✅ ALL POIS AND ROUTES DELETED FROM DATABASE.');
  } catch (error) {
    console.error('❌ SQL Cleanup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
