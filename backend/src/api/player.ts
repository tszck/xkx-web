import { Router, Request, Response } from 'express'
import { getSessionByToken } from '../db/queries/session'
import { getPlayerState, getPlayerSkills, getPlayerInventory, getPlayerQuests } from '../db/queries/player'
import { sessionMap } from '../ws/session-map'
import { isGuestSessionExpired } from '../auth/guestPolicy'

const router = Router()

function getToken(req: Request): string | null {
  return req.headers['x-session-token'] as string ?? null
}

router.get('/state', async (req: Request, res: Response) => {
  const token = getToken(req)
  if (!token) return res.status(401).json({ error: 'No session token' })

  const session = await getSessionByToken(token)
  if (!session?.player_id) return res.status(401).json({ error: 'Invalid session' })
  if (await isGuestSessionExpired(session)) {
    return res.status(403).json({ error: '訪客試玩已超時，請註冊正式帳號或重新登入。', code: 'GUEST_TIMEOUT' })
  }

  const [state, skills, inventory, quests] = await Promise.all([
    getPlayerState(session.player_id),
    getPlayerSkills(session.player_id),
    getPlayerInventory(session.player_id),
    getPlayerQuests(session.player_id),
  ])

  res.json({ state, skills, inventory, quests })
})

router.post('/state', async (req: Request, res: Response) => {
  const token = getToken(req)
  if (!token) return res.status(401).json({ error: 'No session token' })

  const session = await getSessionByToken(token)
  if (!session?.player_id) return res.status(401).json({ error: 'Invalid session' })
  if (await isGuestSessionExpired(session)) {
    return res.status(403).json({ error: '訪客試玩已超時，請註冊正式帳號或重新登入。', code: 'GUEST_TIMEOUT' })
  }

  const gameSession = sessionMap.getByPlayerId(session.player_id)
  if (gameSession) {
    await gameSession.save()
  }

  res.json({ ok: true })
})

export default router
