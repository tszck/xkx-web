import { query } from '../pool'

export interface DBPlayerActionStateRow {
  player_id: number
  mode: string
  target_id: string | null
  context: unknown
  cooldown_until: string | null
  updated_at: string
}

export interface DBRoomOverrideRow {
  room_id: string
  override_type: string
  data: unknown
}

export interface DBPlayerTickStateRow {
  player_id: number
  tick_count: number
  last_tick_at: string
  updated_at: string
}

export async function getPlayerActionState(playerId: number): Promise<DBPlayerActionStateRow | null> {
  const result = await query<DBPlayerActionStateRow>(
    `SELECT player_id, mode, target_id, context, cooldown_until, updated_at
     FROM player_action_state
     WHERE player_id = $1`,
    [playerId]
  )
  return result.rows[0] ?? null
}

export async function setPlayerActionState(
  playerId: number,
  mode: string,
  targetId: string | null,
  context: Record<string, unknown> | null = null,
  cooldownUntil: string | null = null,
) {
  await query(
    `INSERT INTO player_action_state (player_id, mode, target_id, context, cooldown_until)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (player_id) DO UPDATE
     SET mode = EXCLUDED.mode,
         target_id = EXCLUDED.target_id,
         context = EXCLUDED.context,
         cooldown_until = EXCLUDED.cooldown_until,
         updated_at = now()`,
    [playerId, mode, targetId, context ? JSON.stringify(context) : null, cooldownUntil]
  )
}

export async function clearPlayerActionState(playerId: number) {
  await setPlayerActionState(playerId, 'idle', null, null, null)
}

export async function getPlayerRoomOverrides(playerId: number): Promise<DBRoomOverrideRow[]> {
  const result = await query<DBRoomOverrideRow>(
    `SELECT room_id, override_type, data
     FROM player_room_overrides
     WHERE player_id = $1`,
    [playerId]
  )
  return result.rows
}

export async function getPlayerTickState(playerId: number): Promise<DBPlayerTickStateRow | null> {
  const result = await query<DBPlayerTickStateRow>(
    `SELECT player_id, tick_count, last_tick_at, updated_at
     FROM player_tick_state
     WHERE player_id = $1`,
    [playerId]
  )
  return result.rows[0] ?? null
}

export async function setPlayerTickState(playerId: number, tickCount: number) {
  await query(
    `INSERT INTO player_tick_state (player_id, tick_count, last_tick_at)
     VALUES ($1, $2, now())
     ON CONFLICT (player_id) DO UPDATE
     SET tick_count = EXCLUDED.tick_count,
         last_tick_at = EXCLUDED.last_tick_at,
         updated_at = now()`,
    [playerId, tickCount]
  )
}

export async function logPlayerAction(
  playerId: number,
  actionType: string,
  payload: Record<string, unknown>,
  resultCode: string,
  resultData: Record<string, unknown> = {}
) {
  await query(
    `INSERT INTO player_action_log (player_id, action_type, payload, result_code, result_data)
     VALUES ($1, $2, $3::jsonb, $4, $5::jsonb)`,
    [playerId, actionType, JSON.stringify(payload), resultCode, JSON.stringify(resultData)]
  )
}

export async function upsertPlayerRoomOverride(
  playerId: number,
  roomId: string,
  overrideType: string,
  data: Record<string, unknown>
) {
  await query(
    `INSERT INTO player_room_overrides (player_id, room_id, override_type, data)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (player_id, room_id, override_type) DO UPDATE
     SET data = EXCLUDED.data,
         updated_at = now()`,
    [playerId, roomId, overrideType, JSON.stringify(data)]
  )
}