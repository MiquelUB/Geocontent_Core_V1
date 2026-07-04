/**
 * PXX — Seed de Producció (V2 Sovereign)
 * Script en JS pur per executar-se dins del contenidor standalone de Next.js.
 * Comprova si la DB té dades i, si no, crea l'admin i el municipi per defecte.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function seed() {
  const prisma = new PrismaClient({});

  try {
    // Comprovar si ja existeix algun municipi
    const existingMunicipality = await prisma.municipality.findFirst({
      select: { id: true }
    });

    if (existingMunicipality) {
      console.log('✅ [Seed] La DB ja té dades. Salt el seed.');
      return;
    }

    console.log('🚀 [Seed] DB buida detectada. Iniciant seed automàtic...');

    const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@projectexinoxano.com';
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin';
    const masterPassword = process.env.ADMIN_MASTER_PASSWORD || 'admin';

    // 1. Encriptar contrasenyes
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const masterPasswordHash = await bcrypt.hash(masterPassword, 12);

    // 2. Crear / Actualitzar el Super Admin
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash,
        role: 'SUPER_ADMIN',
      },
      create: {
        email: adminEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        username: 'Super Admin PXX',
      },
    });
    console.log(`  ✅ Super Admin: ${admin.id}`);

    // 3. Crear / Actualitzar el municipi
    const municipality = await prisma.municipality.upsert({
      where: { slug: 'pxx-core' },
      update: {
        adminMasterPassword: masterPasswordHash,
      },
      create: {
        name: 'Projecte Xino Xano Core',
        slug: 'pxx-core',
        themeId: 'mountain',
        adminMasterPassword: masterPasswordHash,
        nameTranslations: {
          ca: 'Projecte Xino Xano Core',
          es: 'Proyecto Xino Xano Core',
          en: 'Project Xino Xano Core',
          fr: 'Projet Xino Xano Core'
        }
      }
    });
    console.log(`  ✅ Municipi: ${municipality.name} (${municipality.id})`);

    // 4. Vincular el Super Admin al municipi
    await prisma.user.update({
      where: { id: admin.id },
      data: { municipalityId: municipality.id }
    });
    console.log('  🔗 Admin vinculat al municipi.');

    console.log('🎉 [Seed] Completat correctament!');
  } catch (err) {
    console.error('❌ [Seed] Error:', err.message || err);
    // No fem process.exit(1) perquè volem que el servidor arrenqui igualment
  } finally {
    await prisma.$disconnect();
  }
}

seed();
