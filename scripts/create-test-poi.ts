import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || '';
const pool = new Pool({
  connectionString,
});
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    console.log('--- Testing POI Creation & Coordinate Sync ---');
    
    // Find an existing route to link the POI to
    console.log('Fetching a route...');
    let route = await prisma.route.findFirst();
    
    if (!route) {
      console.log('No route found, creating a test route...');
      // Find a municipality first
      let muni = await prisma.municipality.findFirst();
      if (!muni) {
        console.log('No municipality found, creating Ajuntament de Barcelona...');
        muni = await prisma.municipality.create({
          data: {
            name: 'Ajuntament de Barcelona',
            slug: 'barcelona',
            logoUrl: 'https://example.com/logo.png',
          }
        });
      }
      route = await prisma.route.create({
        data: {
          name: 'Ruta Gòtica de Barcelona',
          slug: 'ruta-gotica',
          municipalityId: muni.id,
          description: 'A beautiful gothic walk in Barcelona',
        }
      });
    }
    
    console.log(`Using Route: ${route.name} (${route.id})`);
    
    // Define a unique POI ID for testing
    const testPoiId = '00000000-0000-0000-0000-000000000001';
    
    // Clean up if it already exists
    console.log('Cleaning up existing test POI...');
    await prisma.$executeRawUnsafe(`DELETE FROM route_pois WHERE poi_id = '${testPoiId}';`);
    await prisma.$executeRawUnsafe(`DELETE FROM pois WHERE id = '${testPoiId}';`);
    
    // Create new POI using Prisma (passing coordinates!)
    console.log('Creating POI with coordinates via Prisma...');
    const newPoi = await prisma.poi.create({
      data: {
        id: testPoiId,
        title: 'Catedral de Barcelona',
        description: 'La basílica metropolitana de la Santa Creu i Santa Eulàlia',
        latitude: 41.3839, // Gothic Quarter Cathedral Lat
        longitude: 2.1762, // Gothic Quarter Cathedral Lng
        appThumbnail: 'https://images.unsplash.com/photo-1549880180-4c706ee36e52',
      }
    });
    
    // Link POI to the route
    await prisma.routePoi.create({
      data: {
        routeId: route.id,
        poiId: newPoi.id,
        orderIndex: 0,
      }
    });
    
    console.log('POI Created! Retrieving it from database using standard Prisma findUnique...');
    const fetchedPoi = await prisma.poi.findUnique({
      where: { id: testPoiId }
    });
    
    console.log('\n--- Prisma Readback Results ---');
    console.log(`Title: ${fetchedPoi?.title}`);
    console.log(`Latitude (parsed from standard column): ${fetchedPoi?.latitude}`);
    console.log(`Longitude (parsed from standard column): ${fetchedPoi?.longitude}`);
    
    // Query the PostGIS geometry value directly to verify trigger sync
    const [geomCheck] = await prisma.$queryRaw<any[]>`
      SELECT ST_AsText(location) as location_text, ST_SRID(location) as srid 
      FROM pois 
      WHERE id = ${testPoiId}::uuid;
    `;
    
    console.log('\n--- PostGIS Trigger Sync Results ---');
    console.log(`PostGIS location Point WKT: ${geomCheck?.location_text}`);
    console.log(`PostGIS SRID (should be 4326): ${geomCheck?.srid}`);
    
    // Confirm exact coordinate values
    const isMatched = 
      fetchedPoi?.latitude === 41.3839 && 
      fetchedPoi?.longitude === 2.1762 && 
      geomCheck?.location_text === 'POINT(2.1762 41.3839)';
      
    if (isMatched) {
      console.log('\n SUCCESS: Bidirectional PostGIS sync is 100% operational!');
    } else {
      console.log('\n WARNING: Trigger or coordinate mapping mismatch detected.');
    }
    
  } catch (err: any) {
    console.error('Error during test POI creation:', err.stack || err.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
