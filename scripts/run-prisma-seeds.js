require('dotenv').config({ path: '/media/akaun/Project_1/Projecte_Pxx/Geocontent_Core_V1/.env' });
const cp = require('child_process');

process.env.SUPER_ADMIN_EMAIL = 'admin@projectexinoxano.com';
process.env.SUPER_ADMIN_PASSWORD = 'admin';

console.log('Running seed-admin.ts...');
const res1 = cp.spawnSync('npx', [
  'tsx',
  'scripts/seed-admin.ts'
], {
  stdio: 'inherit',
  env: process.env,
  cwd: '/media/akaun/Project_1/Projecte_Pxx/Geocontent_Core_V1'
});

if (res1.status !== 0) {
  console.error('Failed to run seed-admin.ts');
  process.exit(res1.status);
}

console.log('Running seed-municipality.ts...');
const res2 = cp.spawnSync('npx', [
  'tsx',
  'scripts/seed-municipality.ts'
], {
  stdio: 'inherit',
  env: process.env,
  cwd: '/media/akaun/Project_1/Projecte_Pxx/Geocontent_Core_V1'
});

process.exit(res2.status);
