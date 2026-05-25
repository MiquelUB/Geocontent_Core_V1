import { PrismaClient, UserRole } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@projectexinoxano.com'
  const password = process.env.SUPER_ADMIN_PASSWORD || 'admin'

  console.log(`🚀 Iniciant seed per a l'usuari: ${email}`)

  const passwordHash = await bcrypt.hash(password, 12)

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: UserRole.SUPER_ADMIN,
    },
    create: {
      email,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      username: 'Super Admin PXX',
    },
  })

  console.log(`✅ Administrador creat/actualitzat amb èxit: ${admin.id}`)
}

main()
  .catch((e) => {
    console.error('❌ Error durant el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
