
const { updateMunicipality } = require('../lib/actions/content');

async function testUpdate() {
  try {
    console.log('Testing updateMunicipality...');
    // We need the ID from the DB. 
    // I'll just try to fetch the first one and update it.
    const { prisma } = require('../lib/database/prisma');
    const muni = await prisma.municipality.findFirst();
    if (!muni) {
        console.log('No municipality found');
        return;
    }
    const res = await updateMunicipality(muni.id, muni.name, muni.logoUrl, 'coast');
    console.log('Result:', res);
  } catch (err) {
    console.error('Crash:', err);
  }
}

testUpdate();
