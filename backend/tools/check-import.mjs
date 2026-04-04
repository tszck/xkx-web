import { Pool } from 'pg'

const pool = new Pool({ connectionString: 'postgresql://xkx:xkx_dev_pass@localhost:5432/xkx_game' })
try {
  const res1 = await pool.query('SELECT COUNT(*) as count FROM world_rooms')
  const res2 = await pool.query('SELECT COUNT(DISTINCT domain) as domains FROM world_rooms')
  const res3 = await pool.query('SELECT COUNT(*) as count FROM world_npcs')
  const res4 = await pool.query('SELECT COUNT(*) as count FROM world_items')
  const res5 = await pool.query('SELECT COUNT(*) as count FROM world_skills')
  
  console.log('World Rooms:', res1.rows[0].count, 'domains:', res2.rows[0].domains)
  console.log('World NPCs:', res3.rows[0].count)
  console.log('World Items:', res4.rows[0].count)
  console.log('World Skills:', res5.rows[0].count)
  
  const domainsRes = await pool.query('SELECT DISTINCT domain FROM world_rooms ORDER BY domain')
  console.log('\nDomains imported (', domainsRes.rows.length, '):\n', domainsRes.rows.map(r => r.domain).join(', '))
} finally {
  await pool.end()
}
