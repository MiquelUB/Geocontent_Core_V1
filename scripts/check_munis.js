
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const munis = await prisma.municipality.findMany();
    console.log(JSON.stringify(munis, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
