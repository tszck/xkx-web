import { Router, Request, Response } from 'express'
import { nanoid } from 'nanoid'
import { createSession, getSessionByToken, linkSessionToPlayer } from '../db/queries/session'
import { createPlayer, getPlayerById, initPlayerState, updateDisplayName } from '../db/queries/player'
import { generateGuestName } from '../utils/guestNameGen'

const router = Router()

function getToken(req: Request): string | null {
  return req.headers['x-session-token'] as string ?? null
}

router.post('/guest', async (req: Request, res: Response) => {
  const existingToken = getToken(req)
  if (existingToken) {
    const session = await getSessionByToken(existingToken)
    if (session?.player_id) {
      const player = await getPlayerById(session.player_id)
      if (player) {
        return res.json({ token: existingToken, playerId: player.id, displayName: player.display_name })
      }
    }
  }

  const token = nanoid(32)
  const guestName = generateGuestName()
  const player = await createPlayer(guestName, guestName)
  await initPlayerState(player.id)
  await createSession(token, player.id)

  res.json({ token, playerId: player.id, displayName: player.display_name })
})

router.post('/rename', async (req: Request, res: Response) => {
  const token = getToken(req)
  if (!token) return res.status(401).json({ error: 'No session token' })

  const session = await getSessionByToken(token)
  if (!session?.player_id) return res.status(401).json({ error: 'Invalid session' })

  const { name } = req.body as { name?: string }
  if (!name || name.trim().length < 2 || name.trim().length > 20) {
    return res.status(400).json({ error: '名稱長度需 2-20 字元' })
  }

  await updateDisplayName(session.player_id, name.trim())
  res.json({ ok: true, displayName: name.trim() })
})

router.get('/me', async (req: Request, res: Response) => {
  const token = getToken(req)
  if (!token) return res.status(401).json({ error: 'No session token' })

  const session = await getSessionByToken(token)
  if (!session?.player_id) return res.status(401).json({ error: 'Invalid session' })

  const player = await getPlayerById(session.player_id)
  if (!player) return res.status(404).json({ error: 'Player not found' })

  res.json({ playerId: player.id, displayName: player.display_name, guestName: player.guest_name })
})

export default router
