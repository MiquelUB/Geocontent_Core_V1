
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.poi.count();
    console.log(`Found ${count} POIs in the database.`);
    
    if (count > 0) {
      const pois = await prisma.poi.findMany({ take: 5 });
      console.log('Sample POIs:', JSON.stringify(pois, null, 2));
    }
  } catch (error) {
    console.error('Connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
