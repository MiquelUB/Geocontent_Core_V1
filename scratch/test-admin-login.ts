import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "miquel@projectexinoxano.cat";
  const password = "k+ec+LxxM+HQ4Wmrf!cDh*xi3D92nY";

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!user) {
    console.log("❌ L'usuari no existeix a la base de dades!");
    return;
  }

  console.log("🟢 Usuari trobat:");
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Rol: ${user.role}`);
  console.log(`   Has passwordHash: ${!!user.passwordHash}`);

  if (user.passwordHash) {
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    console.log(`   Password match: ${isMatch ? "✅ SI" : "❌ NO"}`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
