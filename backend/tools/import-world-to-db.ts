import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { Pool } from 'pg'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable must be set. Check .env file.')
  process.exit(1)
}
const DATABASE_URL = process.env.DATABASE_URL
const DATA_DIR = path.resolve(__dirname, '../src/data')

function walkJsonFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (entry.name.endsWith('.json')) out.push(p)
    }
  }
  walk(dir)
  return out
}

function domainFromId(id: string, fallback: string): string {
  const parts = id.split('/').filter(Boolean)
  if (parts.length >= 2 && parts[0] === 'd') return parts[1]
  return fallback
}

async function importCollection(pool: Pool, table: string, subdir: string, fallbackDomain: string) {
  const dir = path.join(DATA_DIR, subdir)
  const files = walkJsonFiles(dir)
  let count = 0

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>
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
  }

  return count
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL })

  try {
    await pool.query('BEGIN')

    const rooms = await importCollection(pool, 'world_rooms', 'rooms', 'world')
    const npcs = await importCollection(pool, 'world_npcs', 'npcs', 'world')
    const items = await importCollection(pool, 'world_items', 'items', 'world')
    const skills = await importCollection(pool, 'world_skills', 'skills', 'skill')

    await pool.query('COMMIT')
    console.log(`Imported world data -> rooms:${rooms} npcs:${npcs} items:${items} skills:${skills}`)
  } catch (err) {
    await pool.query('ROLLBACK')
    console.error('Import failed:', err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
