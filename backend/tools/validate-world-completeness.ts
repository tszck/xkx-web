import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://xkx:password@localhost:5432/xkx_game'
const SOURCE_DATA_DIR = process.env.SOURCE_DATA_DIR ?? path.resolve(__dirname, '../src/data')

type JsonRecord = Record<string, unknown>

function walkJsonFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (currentDir: string) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const nextPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(nextPath)
      } else if (entry.name.endsWith('.json')) {
        out.push(nextPath)
      }
    }
  }
  walk(dir)
  return out
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
    return Object.fromEntries(entries.map(([key, entry]) => [key, normalize(entry)]))
  }
  return value
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonRecord
}

function loadSourceMap(subdir: string) {
  const dir = path.join(SOURCE_DATA_DIR, subdir)
  const map = new Map<string, JsonRecord>()
  for (const filePath of walkJsonFiles(dir)) {
    const record = readJson(filePath)
    if (typeof record.id !== 'string' || !record.id) continue
    map.set(record.id, record)
  }
  return map
}

function deriveRuntimeRows(room: JsonRecord) {
  const roomId = String(room.id)
  const exits = Object.entries((room.exits as Record<string, string>) ?? {})
    .filter(([, target]) => typeof target === 'string' && target.trim())
    .map(([direction, target]) => ({
      from_room_id: roomId,
      direction: direction.trim().toLowerCase(),
      to_room_id: target.trim().startsWith('/') ? target.trim() : `/${target.trim()}`,
      meta: { source: 'world_rooms.data.exits' },
    }))
  const npcFrequency = new Map<string, number>()
  for (const npcId of (room.npcs as string[]) ?? []) {
    if (!npcId) continue
    npcFrequency.set(npcId, (npcFrequency.get(npcId) ?? 0) + 1)
  }
  const npcCounts = (room.npcCounts as Record<string, number>) ?? {}
  const npcRows = Array.from(new Set([...npcFrequency.keys(), ...Object.keys(npcCounts)])).sort().map((npcId) => ({
    room_id: roomId,
    npc_id: npcId,
    spawn_count: typeof npcCounts[npcId] === 'number' ? npcCounts[npcId] : (npcFrequency.get(npcId) ?? 0),
    spawn_meta: { source: 'world_rooms.data.npcs', hasNpcCounts: Object.keys(npcCounts).length > 0 },
  })).filter((row) => row.spawn_count > 0)

  const itemFrequency = new Map<string, number>()
  for (const itemId of (room.items as string[]) ?? []) {
    if (!itemId) continue
    itemFrequency.set(itemId, (itemFrequency.get(itemId) ?? 0) + 1)
  }
  const itemRows = Array.from(itemFrequency.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([itemId, spawnCount]) => ({
    room_id: roomId,
    item_id: itemId,
    spawn_count: spawnCount,
    spawn_meta: { source: 'world_rooms.data.items' },
  }))
  return { exits, npcRows, itemRows }
}

function deriveDomain(id: string, fallback = 'world') {
  const parts = id.split('/').filter(Boolean)
  return parts[0] === 'd' && parts[1] ? parts[1] : fallback
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function compareCollections<T extends JsonRecord>(label: string, source: Map<string, T>, dbRows: T[], idField: keyof T = 'id' as keyof T, fallbackDomain = 'world') {
  assert(dbRows.length === source.size, `${label} count mismatch: source=${source.size} db=${dbRows.length}`)

  const dbMap = new Map<string, T>()
  for (const row of dbRows) {
    const id = row[idField]
    assert(typeof id === 'string', `${label} row missing string id`)
    dbMap.set(id, row)
  }

  const missing = Array.from(source.keys()).filter((id) => !dbMap.has(id))
  const extra = Array.from(dbMap.keys()).filter((id) => !source.has(id))
  assert(missing.length === 0, `${label} missing ids: ${missing.slice(0, 10).join(', ')}`)
  assert(extra.length === 0, `${label} extra ids: ${extra.slice(0, 10).join(', ')}`)

  for (const [id, sourceRow] of source.entries()) {
    const dbRow = dbMap.get(id)
    assert(dbRow, `${label} missing row for ${id}`)
    const expectedRow = { id, domain: deriveDomain(id, fallbackDomain), data: sourceRow }
    assert(JSON.stringify(normalize(expectedRow)) === JSON.stringify(normalize(dbRow)), `${label} mismatch for ${id}`)
  }
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL })

  try {
    const sourceRooms = loadSourceMap('rooms')
    const sourceNpcs = loadSourceMap('npcs')
    const sourceItems = loadSourceMap('items')
    const sourceSkills = loadSourceMap('skills')
    sourceSkills.delete('names')

    const [roomRows, npcRows, itemRows, skillRows] = await Promise.all([
      pool.query<JsonRecord>('SELECT id, domain, data FROM world_rooms ORDER BY id'),
      pool.query<JsonRecord>('SELECT id, domain, data FROM world_npcs ORDER BY id'),
      pool.query<JsonRecord>('SELECT id, domain, data FROM world_items ORDER BY id'),
      pool.query<JsonRecord>('SELECT id, domain, data FROM world_skills ORDER BY id'),
    ])

    await compareCollections('rooms', sourceRooms, roomRows.rows)
    await compareCollections('npcs', sourceNpcs, npcRows.rows)
    await compareCollections('items', sourceItems, itemRows.rows)
    await compareCollections('skills', sourceSkills, skillRows.rows, 'id', 'skill')

    const runtimeExitsExpected = new Map<string, JsonRecord>()
    const runtimeNpcSpawnsExpected = new Map<string, JsonRecord>()
    const runtimeItemSpawnsExpected = new Map<string, JsonRecord>()
    for (const room of sourceRooms.values()) {
      for (const exit of deriveRuntimeRows(room).exits) {
        runtimeExitsExpected.set(`${exit.from_room_id}:${exit.direction}`, exit)
      }
      for (const npc of deriveRuntimeRows(room).npcRows) {
        runtimeNpcSpawnsExpected.set(`${npc.room_id}:${npc.npc_id}`, npc)
      }
      for (const item of deriveRuntimeRows(room).itemRows) {
        runtimeItemSpawnsExpected.set(`${item.room_id}:${item.item_id}`, item)
      }
    }

    const [runtimeExitRows, runtimeNpcRows, runtimeItemRows] = await Promise.all([
      pool.query<JsonRecord>('SELECT from_room_id, direction, to_room_id, meta FROM world_room_exits ORDER BY from_room_id, direction'),
      pool.query<JsonRecord>('SELECT room_id, npc_id, spawn_count, spawn_meta FROM world_room_npc_spawns ORDER BY room_id, npc_id'),
      pool.query<JsonRecord>('SELECT room_id, item_id, spawn_count, spawn_meta FROM world_room_item_spawns ORDER BY room_id, item_id'),
    ])

    assert(runtimeExitRows.rowCount === runtimeExitsExpected.size, `runtime exits count mismatch: source=${runtimeExitsExpected.size} db=${runtimeExitRows.rowCount}`)
    assert(runtimeNpcRows.rowCount === runtimeNpcSpawnsExpected.size, `runtime npc spawns count mismatch: source=${runtimeNpcSpawnsExpected.size} db=${runtimeNpcRows.rowCount}`)
    assert(runtimeItemRows.rowCount === runtimeItemSpawnsExpected.size, `runtime item spawns count mismatch: source=${runtimeItemSpawnsExpected.size} db=${runtimeItemRows.rowCount}`)

    const runtimeExitDb = new Map(runtimeExitRows.rows.map((row) => [`${row.from_room_id}:${row.direction}`, row]))
    const runtimeNpcDb = new Map(runtimeNpcRows.rows.map((row) => [`${row.room_id}:${row.npc_id}`, row]))
    const runtimeItemDb = new Map(runtimeItemRows.rows.map((row) => [`${row.room_id}:${row.item_id}`, row]))

    for (const [key, expected] of runtimeExitsExpected.entries()) {
      assert(JSON.stringify(normalize(runtimeExitDb.get(key))) === JSON.stringify(normalize(expected)), `runtime exit mismatch for ${key}`)
    }
    for (const [key, expected] of runtimeNpcSpawnsExpected.entries()) {
      assert(JSON.stringify(normalize(runtimeNpcDb.get(key))) === JSON.stringify(normalize(expected)), `runtime npc spawn mismatch for ${key}`)
    }
    for (const [key, expected] of runtimeItemSpawnsExpected.entries()) {
      assert(JSON.stringify(normalize(runtimeItemDb.get(key))) === JSON.stringify(normalize(expected)), `runtime item spawn mismatch for ${key}`)
    }

    process.env.WORLD_DATA_SOURCE = 'db'
    const { worldLoader } = await import('../src/engine/world/WorldLoader')
    await worldLoader.load()

    assert(worldLoader.getAllRoomSummaries().length === sourceRooms.size, 'worldLoader room count mismatch')
    assert(worldLoader.getAllNpcs().length === sourceNpcs.size, 'worldLoader npc count mismatch')

    const sampleRoomId = sourceRooms.keys().next().value as string | undefined
    if (sampleRoomId) {
      const sourceRoom = sourceRooms.get(sampleRoomId)
      const loadedRoom = worldLoader.getRoom(sampleRoomId)
      assert(sourceRoom && loadedRoom, `missing sample room ${sampleRoomId}`)
      assert(JSON.stringify(normalize(sourceRoom)) === JSON.stringify(normalize(loadedRoom)), `worldLoader room mismatch for ${sampleRoomId}`)
    }

    console.log('Data completeness validation passed.')
    console.log(`Source corpus: rooms=${sourceRooms.size} npcs=${sourceNpcs.size} items=${sourceItems.size} skills=${sourceSkills.size}`)
    console.log(`DB corpus:     rooms=${roomRows.rowCount} npcs=${npcRows.rowCount} items=${itemRows.rowCount} skills=${skillRows.rowCount}`)
    console.log(`Runtime corpus: exits=${runtimeExitRows.rowCount} npc_spawns=${runtimeNpcRows.rowCount} item_spawns=${runtimeItemRows.rowCount}`)
  } finally {
    await pool.end()
  }
}

void main().catch((err) => {
  console.error('Data completeness validation failed:', err)
  process.exitCode = 1
})