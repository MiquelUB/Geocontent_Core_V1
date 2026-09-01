
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
    
    let retries = 15;
    while (retries > 0) {
      try {
        await client.$executeRawUnsafe('ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "voice_script" TEXT;');
        await client.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_consent" BOOLEAN DEFAULT true;');
        await client.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP WITH TIME ZONE;');
        await client.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP WITH TIME ZONE;');
        await client.$executeRawUnsafe('ALTER TABLE "municipalities" ADD COLUMN IF NOT EXISTS "voice_persona" TEXT DEFAULT \'Persona gran, veu càlida, serena i amb experiència patrimonial\';');
        await client.$executeRawUnsafe('ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "video_translations" JSONB DEFAULT \'{}\';');
        await client.$executeRawUnsafe('ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "voice_id" TEXT;');

        // Deduplicar usuaris per email (case-insensitive) i fusionar registres existents
        await client.$executeRawUnsafe(`
          DO $$
          DECLARE
              dup RECORD;
              primary_id UUID;
              duplicate_ids UUID[];
              dup_id UUID;
          BEGIN
              FOR dup IN 
                  SELECT LOWER(TRIM(email)) AS clean_email, COUNT(*) 
                  FROM users 
                  WHERE email IS NOT NULL AND TRIM(email) != ''
                  GROUP BY LOWER(TRIM(email)) 
                  HAVING COUNT(*) > 1
              LOOP
                  SELECT id INTO primary_id 
                  FROM users 
                  WHERE LOWER(TRIM(email)) = dup.clean_email 
                  ORDER BY 
                      CASE role 
                          WHEN 'SUPER_ADMIN' THEN 1 
                          WHEN 'ADMIN' THEN 2 
                          WHEN 'MUNICIPAL_ADMIN' THEN 3 
                          ELSE 4 
                      END,
                      xp DESC,
                      created_at ASC
                  LIMIT 1;

                  SELECT array_agg(id) INTO duplicate_ids 
                  FROM users 
                  WHERE LOWER(TRIM(email)) = dup.clean_email AND id != primary_id;

                  IF duplicate_ids IS NOT NULL THEN
                      FOREACH dup_id IN ARRAY duplicate_ids
                      LOOP
                          -- Reassignar progressos de ruta si no estan duplicats
                          UPDATE user_route_progress 
                          SET user_id = primary_id 
                          WHERE user_id = dup_id 
                            AND route_id NOT IN (SELECT route_id FROM user_route_progress WHERE user_id = primary_id);
                          DELETE FROM user_route_progress WHERE user_id = dup_id;

                          -- Reassignar desbloquejos si no estan duplicats
                          UPDATE user_unlocks 
                          SET user_id = primary_id 
                          WHERE user_id = dup_id 
                            AND poi_id NOT IN (SELECT poi_id FROM user_unlocks WHERE user_id = primary_id);
                          DELETE FROM user_unlocks WHERE user_id = dup_id;

                          -- Reassignar o netejar telemetria
                          BEGIN
                            UPDATE user_telemetry SET user_id = primary_id WHERE user_id = dup_id;
                          EXCEPTION WHEN OTHERS THEN
                            DELETE FROM user_telemetry WHERE user_id = dup_id;
                          END;

                          BEGIN
                            UPDATE accounts SET user_id = primary_id WHERE user_id = dup_id;
                          EXCEPTION WHEN OTHERS THEN
                            DELETE FROM accounts WHERE user_id = dup_id;
                          END;

                          BEGIN
                            UPDATE sessions SET user_id = primary_id WHERE user_id = dup_id;
                          EXCEPTION WHEN OTHERS THEN
                            DELETE FROM sessions WHERE user_id = dup_id;
                          END;

                          -- Eliminar el registre duplicat
                          DELETE FROM users WHERE id = dup_id;
                      END LOOP;
                  END IF;

                  UPDATE users SET email = dup.clean_email WHERE id = primary_id;
              END LOOP;
          END $$;
        `);

        // Normalitzar tots els emails a minúscules
        await client.$executeRawUnsafe(`UPDATE users SET email = LOWER(TRIM(email)) WHERE email != LOWER(TRIM(email));`);

        console.log("Columns added and user deduplication completed.");
        break; // Success
      } catch (dbErr) {
        retries--;
        if (retries === 0) {
          throw dbErr;
        }
        console.log(`Database not fully ready yet, retrying... (${retries} attempts left)`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await client.$disconnect();
  }
}

run();
