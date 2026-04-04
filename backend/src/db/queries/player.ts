import { query } from '../pool'

const NEW_PLAYER_SPAWN_ROOM = '/d/city/kedian'

export interface DBPlayer {
  id: number
  display_name: string
  guest_name: string
}

export interface DBPlayerState {
  player_id: number
  current_room: string
  qi: number; max_qi: number
  jing: number; max_jing: number
  neili: number; max_neili: number
  eff_qi: number; eff_jing: number
  str: number; con: number; dex: number; int_stat: number
  per: number; kar: number; sta: number; spi: number
  combat_exp: number
  age: number; shen: number; shen_type: number
  potential: number; learned_points: number
  money: number
  family_name: string | null
  family_generation: number | null
}

export async function createPlayer(displayName: string, guestName: string): Promise<DBPlayer> {
  const r = await query<DBPlayer>(
    `INSERT INTO players (display_name, guest_name) VALUES ($1, $2) RETURNING *`,
    [displayName, guestName]
  )
  return r.rows[0]
}

export async function getPlayerById(id: number): Promise<DBPlayer | null> {
  const r = await query<DBPlayer>(`SELECT * FROM players WHERE id = $1`, [id])
  return r.rows[0] ?? null
}

export async function getPlayerByUsername(username: string): Promise<DBPlayer | null> {
  const r = await query<DBPlayer>(
    `SELECT p.*
     FROM players p
     JOIN player_accounts a ON a.player_id = p.id
     WHERE a.username = $1`,
    [username.toLowerCase()]
  )
  return r.rows[0] ?? null
}

export async function updateDisplayName(playerId: number, name: string) {
  await query(`UPDATE players SET display_name=$1, updated_at=now() WHERE id=$2`, [name, playerId])
}

export async function initPlayerState(playerId: number): Promise<DBPlayerState> {
  const r = await query<DBPlayerState>(
    `INSERT INTO player_state (player_id, current_room) VALUES ($1, $2)
     ON CONFLICT (player_id) DO UPDATE SET updated_at=now()
     RETURNING *`,
    [playerId, NEW_PLAYER_SPAWN_ROOM]
  )
  return r.rows[0]
}

export interface PlayerStatAllocation {
  str: number
  con: number
  dex: number
  int_stat: number
  per: number
  kar: number
  sta: number
  spi: number
}

export async function applyInitialStats(playerId: number, stats: PlayerStatAllocation) {
  const maxQi = 80 + stats.con * 3 + stats.str
  const maxJing = 80 + stats.spi * 3 + stats.int_stat
  const maxNeili = 20 + stats.int_stat * 2 + stats.con

  await query(
    `UPDATE player_state
     SET str=$2,
         con=$3,
         dex=$4,
         int_stat=$5,
         per=$6,
         kar=$7,
         sta=$8,
         spi=$9,
         max_qi=$10,
         qi=$10,
         eff_qi=$10,
         max_jing=$11,
         jing=$11,
         eff_jing=$11,
         max_neili=$12,
         neili=$12,
         updated_at=now()
     WHERE player_id=$1`,
    [
      playerId,
      stats.str,
      stats.con,
      stats.dex,
      stats.int_stat,
      stats.per,
      stats.kar,
      stats.sta,
      stats.spi,
      maxQi,
      maxJing,
      maxNeili,
    ]
  )
}

export async function getPlayerState(playerId: number): Promise<DBPlayerState | null> {
  const r = await query<DBPlayerState>(`SELECT * FROM player_state WHERE player_id = $1`, [playerId])
  return r.rows[0] ?? null
}

export async function savePlayerState(playerId: number, state: Partial<DBPlayerState>) {
  const fields = Object.keys(state).filter(k => k !== 'player_id')
  if (fields.length === 0) return
  const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ')
  const vals = fields.map(f => (state as Record<string, unknown>)[f])
  await query(
    `UPDATE player_state SET ${sets}, updated_at=now() WHERE player_id=$1`,
    [playerId, ...vals]
  )
}

export async function getPlayerSkills(playerId: number) {
  const r = await query<{ skill_id: string; level: number; mapped_to: string | null }>(
    `SELECT skill_id, level, mapped_to FROM player_skills WHERE player_id=$1`,
    [playerId]
  )
  return r.rows
}

export async function upsertSkill(playerId: number, skillId: string, level: number, mappedTo?: string) {
  await query(
    `INSERT INTO player_skills (player_id, skill_id, level, mapped_to) VALUES ($1,$2,$3,$4)
     ON CONFLICT (player_id, skill_id) DO UPDATE SET level=$3, mapped_to=$4`,
    [playerId, skillId, level, mappedTo ?? null]
  )
}

export async function getPlayerInventory(playerId: number) {
  const r = await query<{ id: number; item_id: string; quantity: number; slot: string | null; extra_data: unknown }>(
    `SELECT id, item_id, quantity, slot, extra_data FROM player_inventory WHERE player_id=$1`,
    [playerId]
  )
  return r.rows
}

export async function getPlayerQuests(playerId: number) {
  const r = await query<{ quest_id: string; status: string; assigned_npc: string | null }>(
    `SELECT quest_id, status, assigned_npc FROM player_quests WHERE player_id=$1 AND status='active'`,
    [playerId]
  )
  return r.rows
}
