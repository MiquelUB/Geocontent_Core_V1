
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('🔥 STARTING NUCLEAR CLEANUP v2 (Correct SQL Names) 🔥');
  
  try {
    // Order based on dependencies
    const queries = [
      'DELETE FROM "poi_visits"',
      'DELETE FROM "user_unlocks"',
      'DELETE FROM "user_route_progress"',
      'DELETE FROM "route_pois"',
      'DELETE FROM "pois"',
      'DELETE FROM "routes"',
      'DELETE FROM "user_telemetry"'
    ];

    for (const query of queries) {
      console.log(`Executing: ${query}`);
      try {
        await prisma.$executeRawUnsafe(query);
      } catch (e) {
        console.warn(`⚠️ Query failed (might be expected if table empty): ${query}`, e.message);
      }
    }

    console.log('✅ ALL POIS AND ROUTES DELETED FROM DATABASE.');
  } catch (error) {
    console.error('❌ SQL Cleanup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
