import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable must be set. Check .env file.')
  process.exit(1)
}
const DATABASE_URL = process.env.DATABASE_URL

type RoomData = {
  id: string
  exits?: Record<string, string>
  npcs?: string[]
  npcCounts?: Record<string, number>
  items?: string[]
}

type ExitRow = {
  from_room_id: string
  direction: string
  to_room_id: string
  meta: Record<string, unknown>
}

type SpawnRow = {
  room_id: string
  npc_id?: string
  item_id?: string
  spawn_count: number
  spawn_meta: Record<string, unknown>
}

const EXIT_COLUMNS = ['from_room_id', 'direction', 'to_room_id', 'meta'] as const
const NPC_COLUMNS = ['room_id', 'npc_id', 'spawn_count', 'spawn_meta'] as const
const ITEM_COLUMNS = ['room_id', 'item_id', 'spawn_count', 'spawn_meta'] as const

function normalizeTarget(target: string) {
  const trimmed = target.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function countValues(values: string[] | undefined) {
  const counts = new Map<string, number>()
  for (const value of values ?? []) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

function buildExitRows(rooms: RoomData[]) {
  const rows: ExitRow[] = []
  const expectedByRoom = new Map<string, Array<{ direction: string; to_room_id: string }>>()

  for (const room of rooms) {
    const exits = room.exits ?? {}
    const normalized = Array.from(Object.entries(exits))
      .filter(([, target]) => typeof target === 'string' && target.trim().length > 0)
      .map(([direction, target]) => ({
        direction: direction.trim().toLowerCase(),
        to_room_id: normalizeTarget(target),
      }))
      .sort((left, right) => left.direction.localeCompare(right.direction))

    expectedByRoom.set(room.id, normalized)
    for (const exit of normalized) {
      rows.push({
        from_room_id: room.id,
        direction: exit.direction,
        to_room_id: exit.to_room_id,
        meta: { source: 'world_rooms.data.exits' },
      })
    }
  }

  return { rows, expectedByRoom }
}

function buildSpawnRows(rooms: RoomData[]) {
  const npcRows: SpawnRow[] = []
  const itemRows: SpawnRow[] = []
  const npcExpected = new Map<string, Map<string, number>>()
  const itemExpected = new Map<string, Map<string, number>>()

  for (const room of rooms) {
    const npcFrequency = countValues(room.npcs)
    const npcCounts = room.npcCounts ?? {}
    const npcIds = new Set([...npcFrequency.keys(), ...Object.keys(npcCounts)])
    const npcSummary = new Map<string, number>()

    for (const npcId of Array.from(npcIds).sort()) {
      const count = typeof npcCounts[npcId] === 'number' ? npcCounts[npcId] : (npcFrequency.get(npcId) ?? 0)
      if (count <= 0) continue
      npcSummary.set(npcId, count)
      npcRows.push({
        room_id: room.id,
        npc_id: npcId,
        spawn_count: count,
        spawn_meta: { source: 'world_rooms.data.npcs', hasNpcCounts: Object.keys(npcCounts).length > 0 },
      })
    }
    npcExpected.set(room.id, npcSummary)

    const itemFrequency = countValues(room.items)
    const itemSummary = new Map<string, number>()
    for (const itemId of Array.from(itemFrequency.keys()).sort()) {
      const count = itemFrequency.get(itemId) ?? 0
      if (count <= 0) continue
      itemSummary.set(itemId, count)
      itemRows.push({
        room_id: room.id,
        item_id: itemId,
        spawn_count: count,
        spawn_meta: { source: 'world_rooms.data.items' },
      })
    }
    itemExpected.set(room.id, itemSummary)
  }

  return { npcRows, itemRows, npcExpected, itemExpected }
}

async function bulkInsert<T extends Record<string, unknown>>(pool: Pool, table: string, columns: readonly (keyof T)[], rows: T[]) {
  const chunkSize = 500
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize)
    const values: unknown[] = []
    const placeholders = chunk
      .map((row, rowIndex) => {
        const base = rowIndex * columns.length
        const rowPlaceholders = columns.map((_, columnIndex) => `$${base + columnIndex + 1}`)
        columns.forEach((column) => values.push(row[column]))
        return `(${rowPlaceholders.join(', ')})`
      })
      .join(', ')

    if (chunk.length === 0) continue
    await pool.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`,
      values
    )
  }
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL })

  try {
    const roomResult = await pool.query<{ id: string; data: RoomData }>('SELECT id, data FROM world_rooms ORDER BY id')
    const rooms = roomResult.rows.map((row) => ({ ...row.data, id: row.id }))

    const { rows: exitRows, expectedByRoom } = buildExitRows(rooms)
    const { npcRows, itemRows, npcExpected, itemExpected } = buildSpawnRows(rooms)

    await pool.query('BEGIN')
    await pool.query('TRUNCATE world_room_exits, world_room_npc_spawns, world_room_item_spawns')

    await bulkInsert<ExitRow>(pool, 'world_room_exits', EXIT_COLUMNS, exitRows)
    await bulkInsert<SpawnRow>(pool, 'world_room_npc_spawns', NPC_COLUMNS, npcRows)
    await bulkInsert<SpawnRow>(pool, 'world_room_item_spawns', ITEM_COLUMNS, itemRows)

    const summary = await pool.query(`
      SELECT
        (SELECT count(*) FROM world_room_exits) AS exits,
        (SELECT count(*) FROM world_room_npc_spawns) AS npc_spawns,
        (SELECT count(*) FROM world_room_item_spawns) AS item_spawns
    `)

    const actualExits = Number(summary.rows[0].exits)
    const actualNpcSpawns = Number(summary.rows[0].npc_spawns)
    const actualItemSpawns = Number(summary.rows[0].item_spawns)

    if (actualExits !== exitRows.length) throw new Error(`Exit count mismatch: expected ${exitRows.length}, got ${actualExits}`)
    if (actualNpcSpawns !== npcRows.length) throw new Error(`NPC spawn count mismatch: expected ${npcRows.length}, got ${actualNpcSpawns}`)
    if (actualItemSpawns !== itemRows.length) throw new Error(`Item spawn count mismatch: expected ${itemRows.length}, got ${actualItemSpawns}`)
    if (actualExits <= 0) throw new Error('No runtime exits were seeded')

    const sampleRooms = rooms.filter((room) => (room.exits && Object.keys(room.exits).length > 0) || (room.npcCounts && Object.keys(room.npcCounts).length > 0) || (room.items && room.items.length > 0)).slice(0, 8)

    for (const room of sampleRooms) {
      const exitCheck = await pool.query<{ direction: string; to_room_id: string }>('SELECT direction, to_room_id FROM world_room_exits WHERE from_room_id = $1 ORDER BY direction', [room.id])
      const expectedExits = expectedByRoom.get(room.id) ?? []
      const actualExitSignature = exitCheck.rows.map((exit) => `${exit.direction}:${exit.to_room_id}`)
      const expectedExitSignature = expectedExits.map((exit) => `${exit.direction}:${exit.to_room_id}`)
      if (actualExitSignature.join('|') !== expectedExitSignature.join('|')) {
        throw new Error(`Exit parity mismatch for ${room.id}`)
      }

      const npcCheck = await pool.query<{ npc_id: string; spawn_count: number }>('SELECT npc_id, spawn_count FROM world_room_npc_spawns WHERE room_id = $1 ORDER BY npc_id', [room.id])
      const expectedNpc = npcExpected.get(room.id) ?? new Map<string, number>()
      const actualNpcSignature = npcCheck.rows.map((row) => `${row.npc_id}:${row.spawn_count}`)
      const expectedNpcSignature = Array.from(expectedNpc.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([id, count]) => `${id}:${count}`)
      if (actualNpcSignature.join('|') !== expectedNpcSignature.join('|')) {
        throw new Error(`NPC spawn parity mismatch for ${room.id}`)
      }

      const itemCheck = await pool.query<{ item_id: string; spawn_count: number }>('SELECT item_id, spawn_count FROM world_room_item_spawns WHERE room_id = $1 ORDER BY item_id', [room.id])
      const expectedItems = itemExpected.get(room.id) ?? new Map<string, number>()
      const actualItemSignature = itemCheck.rows.map((row) => `${row.item_id}:${row.spawn_count}`)
      const expectedItemSignature = Array.from(expectedItems.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([id, count]) => `${id}:${count}`)
      if (actualItemSignature.join('|') !== expectedItemSignature.join('|')) {
        throw new Error(`Item spawn parity mismatch for ${room.id}`)
      }
    }

    await pool.query('COMMIT')
    console.log(`Normalized runtime world data -> exits:${actualExits} npc_spawns:${actualNpcSpawns} item_spawns:${actualItemSpawns}`)
    console.log(`Sample parity checks passed for ${sampleRooms.length} rooms`)
  } catch (err) {
    await pool.query('ROLLBACK')
    console.error('Normalization failed:', err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()