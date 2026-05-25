require('dotenv').config({ path: '/media/akaun/Project_1/Projecte_Pxx/Geocontent_Core_V1/.env' });
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const munis = await prisma.municipality.findMany();
    console.log(`Found ${munis.length} municipalities in the database.`);
    console.log('Municipalities:', JSON.stringify(munis, null, 2));

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        municipalityId: true
      }
    });
    console.log(`Found ${users.length} users in the database.`);
    console.log('Users:', JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
