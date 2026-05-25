
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const muni = await prisma.municipality.findFirst();
    if (!muni) {
      console.log('No municipality found');
      return;
    }
    console.log('Current theme:', muni.themeId);
    const updated = await prisma.municipality.update({
      where: { id: muni.id },
      data: { themeId: 'coast' }
    });
    console.log('Updated theme:', updated.themeId);
    
    // Reset back to mountain
    await prisma.municipality.update({
      where: { id: muni.id },
      data: { themeId: 'mountain' }
    });
    console.log('Reset to mountain');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
