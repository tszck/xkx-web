import { query } from '../pool'

export interface DBSession {
  id: string
  token: string
  player_id: number | null
  created_at: Date
  last_seen_at: Date
}

export async function createSession(token: string, playerId?: number): Promise<DBSession> {
  const r = await query<DBSession>(
    `INSERT INTO sessions (token, player_id) VALUES ($1, $2) RETURNING *`,
    [token, playerId ?? null]
  )
  return r.rows[0]
}

export async function getSessionByToken(token: string): Promise<DBSession | null> {
  const r = await query<DBSession>(
    `UPDATE sessions SET last_seen_at=now() WHERE token=$1 RETURNING *`,
    [token]
  )
  return r.rows[0] ?? null
}

export async function linkSessionToPlayer(token: string, playerId: number) {
  await query(`UPDATE sessions SET player_id=$1 WHERE token=$2`, [playerId, token])
}

export async function deleteSessionByToken(token: string) {
  await query(`DELETE FROM sessions WHERE token=$1`, [token])
}
