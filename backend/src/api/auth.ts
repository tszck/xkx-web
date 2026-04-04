import { Router, Request, Response } from 'express'
import { nanoid } from 'nanoid'
import { createSession, deleteSessionByToken, getSessionByToken } from '../db/queries/session'
import { createPlayer, getPlayerById, initPlayerState, updateDisplayName, applyInitialStats, getPlayerByUsername } from '../db/queries/player'
import { createAccount, hasAccountByPlayerId, verifyAccountPassword } from '../db/queries/account'
import { generateGuestName } from '../utils/guestNameGen'
import { isGuestSessionExpired } from '../auth/guestPolicy'

const router = Router()

const STAT_KEYS = ['str', 'con', 'dex', 'int_stat', 'per', 'kar', 'sta', 'spi'] as const
const BASE_STAT = 10
const BONUS_BUDGET = 30

type StatKey = typeof STAT_KEYS[number]
type RegisterStats = Record<StatKey, number>

function validateStats(stats: unknown): RegisterStats | null {
  if (!stats || typeof stats !== 'object') return null
  const typed = stats as Record<string, unknown>
  const normalized = {} as RegisterStats
  let bonus = 0

  for (const key of STAT_KEYS) {
    const value = Number(typed[key])
    if (!Number.isInteger(value) || value < BASE_STAT || value > 25) return null
    normalized[key] = value
    bonus += value - BASE_STAT
  }

  if (bonus !== BONUS_BUDGET) return null
  return normalized
}

function validateUsername(username: string) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username)
}

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

router.post('/register', async (req: Request, res: Response) => {
  const { username, password, displayName, stats } = req.body as {
    username?: string
    password?: string
    displayName?: string
    stats?: unknown
  }

  const normalizedUsername = (username ?? '').trim().toLowerCase()
  const normalizedDisplayName = (displayName ?? '').trim()

  if (!validateUsername(normalizedUsername)) {
    return res.status(400).json({ error: '帳號需為 3-20 字元英文、數字或底線' })
  }
  if (!password || password.length < 6 || password.length > 64) {
    return res.status(400).json({ error: '密碼長度需 6-64 字元' })
  }
  if (!normalizedDisplayName || normalizedDisplayName.length < 2 || normalizedDisplayName.length > 20) {
    return res.status(400).json({ error: '角色名長度需 2-20 字元' })
  }

  const statAlloc = validateStats(stats)
  if (!statAlloc) {
    return res.status(400).json({ error: '屬性分配無效（基礎 10 點，每項上限 25，額外點數需剛好 30）' })
  }

  const existingAccount = await getPlayerByUsername(normalizedUsername)
  if (existingAccount) {
    return res.status(409).json({ error: '帳號已存在' })
  }

  const existingToken = getToken(req)
  if (existingToken) {
    const session = await getSessionByToken(existingToken)
    if (session?.player_id) {
      const alreadyRegistered = await hasAccountByPlayerId(session.player_id)
      if (!alreadyRegistered) {
        await updateDisplayName(session.player_id, normalizedDisplayName)
        await applyInitialStats(session.player_id, statAlloc)
        await createAccount(session.player_id, normalizedUsername, password)
        const upgraded = await getPlayerById(session.player_id)
        if (!upgraded) return res.status(404).json({ error: '角色不存在' })
        return res.json({ token: existingToken, playerId: upgraded.id, displayName: upgraded.display_name })
      }
    }
  }

  const player = await createPlayer(normalizedDisplayName, normalizedDisplayName)
  await initPlayerState(player.id)
  await applyInitialStats(player.id, statAlloc)
  await createAccount(player.id, normalizedUsername, password)

  const token = nanoid(32)
  await createSession(token, player.id)
  return res.json({ token, playerId: player.id, displayName: player.display_name })
})

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string }
  const normalizedUsername = (username ?? '').trim().toLowerCase()

  if (!normalizedUsername || !password) {
    return res.status(400).json({ error: '請提供帳號與密碼' })
  }

  const verified = await verifyAccountPassword(normalizedUsername, password)
  if (!verified) {
    return res.status(401).json({ error: '帳號或密碼錯誤' })
  }

  const player = await getPlayerById(verified.playerId)
  if (!player) {
    return res.status(404).json({ error: '角色不存在' })
  }

  const token = nanoid(32)
  await createSession(token, player.id)
  return res.json({ token, playerId: player.id, displayName: player.display_name })
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

  if (await isGuestSessionExpired(session)) {
    return res.status(403).json({ error: '訪客試玩已超時，請註冊正式帳號或重新登入。', code: 'GUEST_TIMEOUT' })
  }

  const player = await getPlayerById(session.player_id)
  if (!player) return res.status(404).json({ error: 'Player not found' })

  res.json({ playerId: player.id, displayName: player.display_name, guestName: player.guest_name })
})

router.post('/logout', async (req: Request, res: Response) => {
  const token = getToken(req)
  if (!token) return res.json({ ok: true })
  await deleteSessionByToken(token)
  res.json({ ok: true })
})

export default router
