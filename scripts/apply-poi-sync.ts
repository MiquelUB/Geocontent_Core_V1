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
    console.log('Applying database updates to "pois" table...');
    
    // 1. Add columns to "pois" if they don't exist
    console.log('Adding latitude and longitude columns...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
      ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
    `);

    // 2. Create the trigger function
    console.log('Creating trigger function sync_poi_location...');
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION sync_poi_location()
      RETURNS TRIGGER AS $$
      BEGIN
        -- If latitude/longitude changed or location is null, update location
        IF (TG_OP = 'INSERT') OR 
           (OLD.latitude IS DISTINCT FROM NEW.latitude) OR 
           (OLD.longitude IS DISTINCT FROM NEW.longitude) THEN
          IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
            NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
          ELSE
            NEW.location := NULL;
          END IF;
        -- If location changed directly (e.g. from Python or GIS), sync back to lat/lng
        ELSIF (OLD.location IS DISTINCT FROM NEW.location) THEN
          IF NEW.location IS NOT NULL THEN
            NEW.latitude := ST_Y(NEW.location);
            NEW.longitude := ST_X(NEW.location);
          ELSE
            NEW.latitude := NULL;
            NEW.longitude := NULL;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 3. Create the trigger
    console.log('Creating trigger trg_sync_poi_location...');
    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS trg_sync_poi_location ON "pois";
      CREATE TRIGGER trg_sync_poi_location
      BEFORE INSERT OR UPDATE ON "pois"
      FOR EACH ROW
      EXECUTE FUNCTION sync_poi_location();
    `);

    // 4. Run synchronization for existing records
    console.log('Synchronizing existing records...');
    await prisma.$executeRawUnsafe(`
      UPDATE "pois"
      SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location IS NULL;
    `);
    
    await prisma.$executeRawUnsafe(`
      UPDATE "pois"
      SET latitude = ST_Y(location), longitude = ST_X(location)
      WHERE location IS NOT NULL AND (latitude IS NULL OR longitude IS NULL);
    `);

    console.log('Database updates applied successfully!');
  } catch (err: any) {
    console.error('Error applying database updates:', err.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
