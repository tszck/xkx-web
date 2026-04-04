import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://xkx:password@localhost:5432/xkx_game'
const RAW_XKX_DIR = process.env.RAW_XKX_DIR ?? '/root/projects/xkx'

interface ExitRow {
  from_room_id: string
  direction: string
  to_room_id: string
  meta: Record<string, unknown>
}

function walkCFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'npc' || entry.name === 'obj') continue
        walk(next)
      } else if (entry.isFile() && entry.name.endsWith('.c')) {
        out.push(next)
      }
    }
  }
  walk(dir)
  return out
}

function normalizePath(input: string) {
  return input.replace(/\\/g, '/').replace(/\.c$/, '').replace(/\/+/g, '/').replace(/\/$/, '')
}

function buildRoomId(rootDDir: string, filePath: string): string {
  const rel = normalizePath(path.relative(rootDDir, filePath))
  return `/${normalizePath(`d/${rel}`)}`
}

function resolveDirTarget(fromRoomId: string, dirExprTarget: string): string {
  const fromDir = path.posix.dirname(fromRoomId)
  const joined = path.posix.join(fromDir, dirExprTarget)
  return normalizePath(joined.startsWith('/') ? joined : `/${joined}`)
}

function parseExits(source: string, fromRoomId: string): ExitRow[] {
  const block = source.match(/set\("exits",\s*\(\[([\s\S]*?)\]\)\)/m)
  if (!block) return []

  const rows: ExitRow[] = []
  const directRegex = /"([^"]+)"\s*:\s*"([^"]+)"/g
  const dirRegex = /"([^"]+)"\s*:\s*__DIR__\s*(?:\+\s*)?"([^"]+)"/g

  for (const match of block[1].matchAll(directRegex)) {
    const direction = match[1].trim().toLowerCase()
    const rawTarget = match[2].trim()
    if (!direction || !rawTarget) continue
    const toRoom = normalizePath(rawTarget.startsWith('/') ? rawTarget : `/${rawTarget}`)
    rows.push({
      from_room_id: fromRoomId,
      direction,
      to_room_id: toRoom,
      meta: { source: 'raw_lpc_exits' },
    })
  }

  for (const match of block[1].matchAll(dirRegex)) {
    const direction = match[1].trim().toLowerCase()
    const rawTarget = match[2].trim()
    if (!direction || !rawTarget) continue
    rows.push({
      from_room_id: fromRoomId,
      direction,
      to_room_id: resolveDirTarget(fromRoomId, rawTarget),
      meta: { source: 'raw_lpc_exits' },
    })
  }

  const dedup = new Map<string, ExitRow>()
  for (const row of rows) dedup.set(`${row.from_room_id}:${row.direction}`, row)
  return Array.from(dedup.values())
}

async function insertBatched(pool: Pool, rows: ExitRow[]) {
  const chunkSize = 1000
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const values: unknown[] = []
    const placeholders = chunk
      .map((row, idx) => {
        const base = idx * 4
        values.push(row.from_room_id, row.direction, row.to_room_id, JSON.stringify(row.meta))
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::jsonb)`
      })
      .join(', ')
    await pool.query(
      `INSERT INTO world_room_exits (from_room_id, direction, to_room_id, meta)
       VALUES ${placeholders}
       ON CONFLICT (from_room_id, direction)
       DO UPDATE SET to_room_id = EXCLUDED.to_room_id, meta = EXCLUDED.meta, updated_at = now()`,
      values
    )
  }
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL })
  const dDir = path.resolve(RAW_XKX_DIR, 'd')

  try {
    const files = walkCFiles(dDir)
    const exits: ExitRow[] = []

    for (const filePath of files) {
      const source = fs.readFileSync(filePath, 'utf-8')
      const roomId = buildRoomId(dDir, filePath)
      exits.push(...parseExits(source, roomId))
    }

    await pool.query('BEGIN')
    await pool.query('TRUNCATE world_room_exits')
    await insertBatched(pool, exits)
    const count = await pool.query('SELECT count(*)::int AS count FROM world_room_exits')
    await pool.query('COMMIT')

    console.log(`Imported raw LPC exits: ${count.rows[0].count}`)
  } catch (err) {
    await pool.query('ROLLBACK')
    console.error('Import raw exits failed:', err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
