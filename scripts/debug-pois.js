
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pois = await prisma.poi.findMany({
    where: {
      title: {
        contains: 'Creperia',
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      title: true,
      route_id: true,
      latitude: true,
      longitude: true
    }
  });

  console.log('POIs found with "Creperia":');
  console.log(JSON.stringify(pois, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
