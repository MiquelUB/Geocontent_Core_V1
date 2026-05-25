import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  const munis = await prisma.municipality.findMany({});
  
  console.log(`🟢 Trobats ${munis.length} municipis:`);
  for (const m of munis) {
    console.log(`- Nom: ${m.name}`);
    console.log(`  ID: ${m.id}`);
    console.log(`  Contrasenya Mestra (adminMasterPassword): "${m.adminMasterPassword}"`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
