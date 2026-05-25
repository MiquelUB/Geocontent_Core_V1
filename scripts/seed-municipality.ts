import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🚀 Creant Municipi per defecte i configurant Seguretat Mestra...")

  // 1. Creem el municipi "Core"
  const municipality = await prisma.municipality.upsert({
    where: { slug: 'pxx-core' },
    update: {
      adminMasterPassword: 'admin', // Aquesta és la "Contrasenya Mestra"
    },
    create: {
      name: 'Projecte Xino Xano Core',
      slug: 'pxx-core',
      themeId: 'mountain',
      adminMasterPassword: 'admin', // Contrasenya per defecte per al Gate
      nameTranslations: {
        ca: 'Projecte Xino Xano Core',
        es: 'Proyecto Xino Xano Core',
        en: 'Project Xino Xano Core',
        fr: 'Projet Xino Xano Core'
      }
    }
  })

  console.log(`✅ Municipi creat/actualitzat: ${municipality.name} (${municipality.id})`)

  // 2. Vinculem el Super Admin al municipi per evitar errors de context
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@projectexinoxano.com'
  await prisma.user.updateMany({
    where: { email },
    data: { municipalityId: municipality.id }
  })

  console.log(`🔗 Super Admin vinculat al municipi.`)
}

main()
  .catch((e) => {
    console.error('❌ Error durant el seed del municipi:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
