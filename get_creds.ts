import { prisma } from './lib/database/prisma';

async function main() {
  const users = await prisma.user.findMany({ where: { role: 'ADMIN' } })
  console.log('--- ADMIN USERS (Capa 1) ---')
  for (const u of users) {
    console.log(`Email: ${u.email} | Username: ${u.username}`)
  }
  
  const munis = await prisma.municipality.findMany()
  console.log('\n--- MUNICIPALITIES (Capa 2) ---')
  for (const m of munis) {
    console.log(`Municipality: ${m.name} | Master Password: ${m.adminMasterPassword}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
