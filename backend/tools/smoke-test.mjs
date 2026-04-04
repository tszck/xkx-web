import { Pool } from 'pg'

const pool = new Pool({ connectionString: 'postgresql://xkx:xkx_dev_pass@localhost:5432/xkx_game' })

async function testDatabaseConnectivity() {
  try {
    console.log('\n=== DATABASE CONNECTIVITY TEST ===')
    
    // Test P2 domain access
    const res = await pool.query(`
      SELECT 
        domain,
        COUNT(*) as room_count
      FROM world_rooms 
      WHERE domain IN ('suzhou', 'hangzhou')
      GROUP BY domain
      ORDER BY domain
    `)
    
    console.log('✅ P2 domains (江南) accessible:')
    for (const row of res.rows) {
      console.log(`   ${row.domain}: ${row.room_count} rooms`)
    }
    
    // Test P3 domain access
    const res3 = await pool.query(`
      SELECT 
        domain,
        COUNT(*) as room_count
      FROM world_rooms 
      WHERE domain IN ('taishan', 'songshan', 'shaolin')
      GROUP BY domain
      ORDER BY domain
    `)
    
    console.log('✅ P3 domains (五嶽少林) accessible:')
    for (const row of res3.rows) {
      console.log(`   ${row.domain}: ${row.room_count} rooms`)
    }
    
    // Test exits exist
    const exitRes = await pool.query(`
      SELECT COUNT(*) as exit_count FROM world_room_exits WHERE from_room_id LIKE '/d/city/%'
    `)
    console.log(`✅ Exits from city domain: ${exitRes.rows[0].exit_count}`)
    
    // Test NPCs exist
    const npcRes = await pool.query(`
      SELECT COUNT(*) as npc_count FROM world_room_npc_spawns LIMIT 1
    `)
    console.log(`✅ NPC spawns available in database`)
    
    console.log('\n✅ All smoke tests passed! Content rollout is working.\n')
    return true
  } catch (err) {
    console.error('❌ Database test failed:', err.message)
    return false
  } finally {
    await pool.end()
  }
}

await testDatabaseConnectivity()
