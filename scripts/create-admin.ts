import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

/**
 * Script per crear o ascendir un usuari a super_admin.
 * Ús: npx tsx scripts/create-admin.ts <email>
 */
async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Si us plau, proporciona un email: npx tsx scripts/create-admin.ts user@example.com');
    process.exit(1);
  }

  console.log(`🚀 Ascendint usuari ${email} a super_admin...`);

  try {
    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {
        role: 'SUPER_ADMIN',
      },
      create: {
        email: email.toLowerCase(),
        username: email.split('@')[0],
        role: 'SUPER_ADMIN',
        xp: 1000,
        level: 10
      }
    });

    console.log('✅ Usuari actualitzat amb èxit:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Rol: ${user.role}`);

  } catch (error) {
    console.error('❌ Error creant l\'admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
