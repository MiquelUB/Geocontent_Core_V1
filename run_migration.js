const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log("Connected to DB, adding voice_script column if not exists...");
    await client.query('ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "voice_script" TEXT;');
    await client.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_consent" BOOLEAN DEFAULT true;');
    await client.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP WITH TIME ZONE;');
    console.log("Columns added or already exist.");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await client.end();
  }
}
run();
