const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const pois = await prisma.poi.findMany({ select: { id: true, title: true, videoUrls: true }});
  console.log(JSON.stringify(pois.filter(p => p.videoUrls && p.videoUrls.length > 0), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
