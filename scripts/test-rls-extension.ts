import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { prisma } from '../lib/database/prisma';
import { setMockSession } from '../lib/database/prisma-rls-cache';

import { Pool } from 'pg';

async function runTests() {
  console.log('--- STARTING RLS CASTING AND ROLE TESTS ---');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const dummyRouteId = '11111111-1111-1111-1111-111111111111';
  const testMuniId = '0c10b9b1-f32f-44cb-bc74-991fedf3b7d9';

  try {
    // Insert a dummy route for testing
    await pool.query(`
      INSERT INTO routes (id, municipality_id, slug, name, name_translations)
      VALUES ($1, $2, 'test-route-rls', 'Test Route RLS', '{}')
      ON CONFLICT (slug) DO UPDATE SET name = 'Test Route RLS', municipality_id = $2;
    `, [dummyRouteId, testMuniId]);
    console.log('Inserted dummy route for test.');

    const isRlsEnabled = await pool.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity 
      FROM pg_class 
      WHERE relname IN ('routes', 'municipalities');
    `);
    console.log('RLS Table Status:', JSON.stringify(isRlsEnabled.rows, null, 2));

    const policies = await pool.query(`
      SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
      FROM pg_policies;
    `);
    console.log('Database Policies:', JSON.stringify(policies.rows, null, 2));
  } catch (err: any) {
    console.error('Failed initialization/meta check:', err.message || err);
  }

  // Test 1: SUPER_ADMIN session with null municipalityId
  console.log('\n[Test 1] SUPER_ADMIN session with NULL municipalityId:');
  setMockSession({
    user: {
      id: 'bd52187c-6807-4cf1-b3ca-8b608d2b0a75', // admin@projectexinoxano.com
      role: 'SUPER_ADMIN',
      municipalityId: null, // should fall back to Nil UUID, but role = 'system' should bypass RLS completely
    }
  });

  try {
    const routes = await prisma.route.findMany({
      select: { id: true, name: true, municipalityId: true }
    });
    console.log(`Success! Found ${routes.length} routes:`, JSON.stringify(routes, null, 2));
  } catch (err: any) {
    console.error('Failed Test 1:', err.message || err);
  }

  // Test 2: ADMIN session with valid municipalityId
  const validMuniId = '0c10b9b1-f32f-44cb-bc74-991fedf3b7d9';
  console.log(`\n[Test 2] ADMIN session with VALID municipalityId (${validMuniId}):`);
  setMockSession({
    user: {
      id: 'bd52187c-6807-4cf1-b3ca-8b608d2b0a75',
      role: 'ADMIN',
      municipalityId: validMuniId,
    }
  });

  try {
    const routes = await prisma.route.findMany({
      select: { id: true, name: true, municipalityId: true }
    });
    console.log(`Success! Found ${routes.length} routes:`, JSON.stringify(routes, null, 2));
  } catch (err: any) {
    console.error('Failed Test 2:', err.message || err);
  }

  // Test 3: ADMIN session with null municipalityId (should query Nil UUID and return 0 routes safely without database crash)
  console.log('\n[Test 3] ADMIN session with NULL municipalityId (should fall back to Nil UUID and return 0 routes safely):');
  setMockSession({
    user: {
      id: 'bd52187c-6807-4cf1-b3ca-8b608d2b0a75',
      role: 'ADMIN',
      municipalityId: null,
    }
  });

  try {
    const routes = await prisma.route.findMany({
      select: { id: true, name: true, municipalityId: true }
    });
    console.log(`Success! Found ${routes.length} routes (expected 0):`, JSON.stringify(routes, null, 2));
  } catch (err: any) {
    console.error('Failed Test 3:', err.message || err);
  }

  try {
    await pool.query('DELETE FROM routes WHERE id = $1', [dummyRouteId]);
    console.log('Cleaned up dummy route.');
  } catch (err: any) {
    console.error('Failed to clean up dummy route:', err.message || err);
  } finally {
    await pool.end();
  }

  console.log('\n--- RLS TESTS COMPLETE ---');
}

runTests()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('Fatal error running tests:', err);
    prisma.$disconnect();
  });
