const { PrismaClient } = require('@prisma/client');

async function run() {
  const directUrl = process.env.DATABASE_DIRECT_URL || process.env.Direct_URL;
  const pgbouncerUrl = process.env.DATABASE_URL;
  
  let client = new PrismaClient({ 
    datasources: { db: { url: directUrl || pgbouncerUrl } } 
  });

  try {
    try {
      await client.$connect();
    } catch (e) {
      if (directUrl && pgbouncerUrl && directUrl !== pgbouncerUrl) {
        console.warn(`[Migration] Direct connection failed (${e.message}). Falling back to PgBouncer...`);
        client = new PrismaClient({ 
          datasources: { db: { url: pgbouncerUrl } } 
        });
        await client.$connect();
      } else {
        throw e;
      }
    }
    
    console.log("Connected to DB via Prisma, adding columns if not exists...");
    await client.$executeRawUnsafe('ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "voice_script" TEXT;');
    await client.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_consent" BOOLEAN DEFAULT true;');
    await client.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP WITH TIME ZONE;');
    await client.$executeRawUnsafe('ALTER TABLE "municipalities" ADD COLUMN IF NOT EXISTS "voice_persona" TEXT DEFAULT \'Persona gran, veu càlida, serena i amb experiència patrimonial\';');
    await client.$executeRawUnsafe('ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "video_translations" JSONB DEFAULT \'{}\';');
    console.log("Columns added or already exist.");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await client.$disconnect();
  }
}

run();
