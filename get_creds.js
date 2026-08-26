const { Client } = require('pg')
const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5434/geocontent_db?schema=public&sslmode=disable'
})
async function main() {
  await client.connect()
  const users = await client.query("SELECT email, username, role FROM \"User\" WHERE role = 'admin'")
  console.log('--- ADMIN USERS (Capa 1) ---')
  for (const u of users.rows) {
    console.log(`Email: ${u.email} | Username: ${u.username}`)
  }
  
  const munis = await client.query("SELECT name, \"adminPassword\" FROM \"Municipality\"")
  console.log('\n--- MUNICIPALITIES (Capa 2) ---')
  for (const m of munis.rows) {
    console.log(`Municipality: ${m.name} | Master Password: ${m.adminPassword}`)
  }
  await client.end()
}
main().catch(console.error)
