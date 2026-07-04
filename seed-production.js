/**
 * PXX — Seed de Producció (V2 Sovereign)
 * Usa el mòdul `pg` directament (raw SQL) per evitar problemes
 * d'inicialització de PrismaClient al contenidor standalone.
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function seed() {
  const connectionString = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ [Seed] Cap variable DATABASE_DIRECT_URL o DATABASE_URL configurada.');
    return;
  }

  const pool = new Pool({ connectionString });

  try {
    // 1. Comprovar si ja existeix algun municipi
    const checkResult = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'municipalities') AS table_exists"
    );

    if (!checkResult.rows[0].table_exists) {
      console.log('⚠️  [Seed] La taula municipalities no existeix. Esperant que prisma db push la creï...');
      return;
    }

    const muniResult = await pool.query('SELECT id FROM municipalities LIMIT 1');
    if (muniResult.rows.length > 0) {
      console.log('✅ [Seed] La DB ja té dades. Salt el seed.');
      return;
    }

    console.log('🚀 [Seed] DB buida detectada. Iniciant seed automàtic...');

    const adminEmail = (process.env.SUPER_ADMIN_EMAIL || 'admin@projectexinoxano.com').toLowerCase().trim();
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin';
    const masterPassword = process.env.ADMIN_MASTER_PASSWORD || 'admin';

    // 2. Encriptar contrasenyes
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const masterPasswordHash = await bcrypt.hash(masterPassword, 12);

    // 3. Crear el Super Admin (upsert via INSERT ON CONFLICT)
    const adminResult = await pool.query(
      `INSERT INTO users (id, email, password_hash, role, username, xp, level, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'SUPER_ADMIN', 'Super Admin PXX', 0, 1, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = 'SUPER_ADMIN'
       RETURNING id`,
      [adminEmail, passwordHash]
    );
    const adminId = adminResult.rows[0].id;
    console.log(`  ✅ Super Admin: ${adminId}`);

    // 4. Crear el municipi (upsert via INSERT ON CONFLICT)
    const muniInsertResult = await pool.query(
      `INSERT INTO municipalities (id, name, slug, theme_id, admin_master_password, name_translations, plan_tier, packaging_status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'basic', 'IDLE', NOW(), NOW())
       ON CONFLICT (slug) DO UPDATE SET admin_master_password = $4
       RETURNING id, name`,
      [
        'Projecte Xino Xano Core',
        'pxx-core',
        'mountain',
        masterPasswordHash,
        JSON.stringify({
          ca: 'Projecte Xino Xano Core',
          es: 'Proyecto Xino Xano Core',
          en: 'Project Xino Xano Core',
          fr: 'Projet Xino Xano Core'
        })
      ]
    );
    const muni = muniInsertResult.rows[0];
    console.log(`  ✅ Municipi: ${muni.name} (${muni.id})`);

    // 5. Vincular admin al municipi
    await pool.query(
      'UPDATE users SET municipality_id = $1 WHERE id = $2',
      [muni.id, adminId]
    );
    console.log('  🔗 Admin vinculat al municipi.');

    console.log('🎉 [Seed] Completat correctament!');
  } catch (err) {
    console.error('❌ [Seed] Error:', err.message || err);
  } finally {
    await pool.end();
  }
}

seed();
