const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log("Connected to DB, adding voice_script column if not exists...");
    await client.query('ALTER TABLE "pois" ADD COLUMN IF NOT EXISTS "voice_script" TEXT;');
    console.log("Column added or already exists.");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await client.end();
  }
}
run();
