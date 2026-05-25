
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔥 NUCLEAR WIPE v3 (With dotenv) 🔥');
  
  try {
    const queries = [
      'DELETE FROM public.poi_visits',
      'DELETE FROM public.user_unlocks',
      'DELETE FROM public.user_route_progress',
      'DELETE FROM public.route_pois',
      'DELETE FROM public.pois',
      'DELETE FROM public.routes',
      'DELETE FROM public.user_telemetry'
    ];

    for (const query of queries) {
      console.log(`Executing: ${query}`);
      try {
        await prisma.$executeRawUnsafe(query);
      } catch (e) {
        console.warn(`⚠️ Query failed: ${query}`, e.message);
      }
    }

    console.log('✅ ALL POIS AND ROUTES DELETED.');
  } catch (error) {
    console.error('❌ SQL Cleanup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
