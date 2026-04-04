import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../src/data')
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://xkx:xkx_dev_pass@localhost:5432/xkx_game'

function walkJsonFiles(dir) {
  const out = []
  const walk = (d) => {
    if (!fs.existsSync(d)) return
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (entry.name.endsWith('.json')) out.push(p)
    }
  }
  walk(dir)
  return out
}

function domainFromId(id, fallback) {
  const parts = id.split('/').filter(Boolean)
  if (parts.length >= 2 && parts[0] === 'd') return parts[1]
  return fallback
}

async function importCollection(pool, table, subdir, fallbackDomain) {
  const dir = path.join(DATA_DIR, subdir)
  const files = walkJsonFiles(dir)
  let count = 0

  console.log(`\n📂 Importing ${table} from ${subdir} (${files.length} files)...`)

  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'))
      const id = typeof raw.id === 'string' ? raw.id : ''
      if (!id) continue

      const domain = domainFromId(id, fallbackDomain)
      await pool.query(
        `INSERT INTO ${table} (id, domain, data, updated_at)
         VALUES ($1, $2, $3::jsonb, now())
         ON CONFLICT (id)
         DO UPDATE SET domain = EXCLUDED.domain, data = EXCLUDED.data, updated_at = now()`,
        [id, domain, JSON.stringify(raw)]
      )
      count++
      if (count % 1000 === 0) process.stdout.write(`.`)
    } catch (e) {
      console.error(`Failed to import ${file}:`, e.message)
    }
  }

  console.log(`\n  ✅ Imported ${count} ${table}`)
  return count
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL })

  try {
    console.log('🚀 Starting content rollout import...')
    await pool.query('BEGIN')

    const rooms = await importCollection(pool, 'world_rooms', 'rooms', 'world')
    const npcs = await importCollection(pool, 'world_npcs', 'npcs', 'world')
    const items = await importCollection(pool, 'world_items', 'items', 'world')
    const skills = await importCollection(pool, 'world_skills', 'skills', 'skill')

    await pool.query('COMMIT')
    console.log(`\n✅ World data imported successfully!`)
    console.log(`   Rooms: ${rooms} | NPCs: ${npcs} | Items: ${items} | Skills: ${skills}`)
  } catch (err) {
    await pool.query('ROLLBACK')
    console.error('\n❌ Import failed:', err.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
