import type { DBSession } from '../db/queries/session'
import { hasAccountByPlayerId } from '../db/queries/account'

export const GUEST_FREE_MINUTES = 60
const GUEST_WINDOW_MS = GUEST_FREE_MINUTES * 60 * 1000

export async function isRegisteredPlayer(playerId: number): Promise<boolean> {
  return hasAccountByPlayerId(playerId)
}

export async function isGuestSessionExpired(session: DBSession): Promise<boolean> {
  if (!session.player_id) return false
  const registered = await isRegisteredPlayer(session.player_id)
  if (registered) return false
  const startedAt = session.created_at instanceof Date ? session.created_at.getTime() : new Date(session.created_at).getTime()
  return Date.now() - startedAt > GUEST_WINDOW_MS
}

export async function getGuestRemainingMs(session: DBSession): Promise<number | null> {
  if (!session.player_id) return null
  const registered = await isRegisteredPlayer(session.player_id)
  if (registered) return null
  const startedAt = session.created_at instanceof Date ? session.created_at.getTime() : new Date(session.created_at).getTime()
  return Math.max(0, startedAt + GUEST_WINDOW_MS - Date.now())
}
