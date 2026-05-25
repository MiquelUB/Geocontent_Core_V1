require('dotenv').config({ path: '/media/akaun/Project_1/Projecte_Pxx/Geocontent_Core_V1/.env' });
const cp = require('child_process');

console.log('Using DATABASE_URL:', process.env.DATABASE_URL);
console.log('Using DATABASE_DIRECT_URL:', process.env.DATABASE_DIRECT_URL);

const res = cp.spawnSync('npx', [
  'prisma',
  'db',
  'push',
  '--schema=/media/akaun/Project_1/Projecte_Pxx/Geocontent_Core_V1/prisma/schema.prisma'
], {
  stdio: 'inherit',
  env: process.env,
  cwd: '/media/akaun/Project_1/Projecte_Pxx/Geocontent_Core_V1'
});

process.exit(res.status);
