
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function run() {
  let directUrl = process.env.DATABASE_DIRECT_URL || process.env.Direct_URL;
  let pgbouncerUrl = process.env.DATABASE_URL;


  
  const connString = directUrl || pgbouncerUrl;
  const hasSsl = connString && connString.includes('sslmode=require');
  const pool = new Pool({ 
    connectionString: connString,
    ...(hasSsl ? { ssl: { rejectUnauthorized: false } } : {})
  });
  const adapter = new PrismaPg(pool);
  
  let client = new PrismaClient({ 
    adapter 
  });

  try {
    try {
      await client.$connect();
    } catch (e) {
      if (directUrl && pgbouncerUrl && directUrl !== pgbouncerUrl) {
        console.warn(`[Migration] Direct connection failed (${e.message}). Falling back to PgBouncer...`);
        const hasSslBouncer = pgbouncerUrl && pgbouncerUrl.includes('sslmode=require');
        const poolBouncer = new Pool({ 
          connectionString: pgbouncerUrl,
          ...(hasSslBouncer ? { ssl: { rejectUnauthorized: false } } : {})
        });
        const adapterBouncer = new PrismaPg(poolBouncer);
        client = new PrismaClient({ 
          adapter: adapterBouncer 
        });
        await client.$connect();
      } else {
        throw e;
      }
    }
    
    console.log("Connected to DB via Prisma, adding columns if not exists...");
    
    let retries = 5;
    while (retries > 0) {
      try {
        await client.$executeRawUnsafe('ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "voice_script" TEXT;');
        await client.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_consent" BOOLEAN DEFAULT true;');
        await client.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP WITH TIME ZONE;');
        await client.$executeRawUnsafe('ALTER TABLE "municipalities" ADD COLUMN IF NOT EXISTS "voice_persona" TEXT DEFAULT \'Persona gran, veu càlida, serena i amb experiència patrimonial\';');
        await client.$executeRawUnsafe('ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "video_translations" JSONB DEFAULT \'{}\';');
        await client.$executeRawUnsafe('ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "voice_id" TEXT;');
        console.log("Columns added or already exist.");
        break; // Success
      } catch (dbErr) {
        retries--;
        if (retries === 0) {
          throw dbErr;
        }
        console.log(`Database not fully ready yet, retrying... (${retries} attempts left)`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await client.$disconnect();
  }
}

run();
