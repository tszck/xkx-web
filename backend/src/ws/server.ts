import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage, Server } from 'http'
import { getSessionByToken } from '../db/queries/session'
import { getPlayerById, getPlayerState, getPlayerSkills, getPlayerInventory } from '../db/queries/player'
import { GameSession } from '../engine/GameSession'
import { sessionMap } from './session-map'
import { handleMessage } from './handler'
import { getGuestRemainingMs, isGuestSessionExpired } from '../auth/guestPolicy'
import type { DBSession } from '../db/queries/session'

export function attachWsServer(httpServer: Server) {
  const wss = new WebSocketServer({ noServer: true })

  httpServer.on('upgrade', async (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`)
    if (url.pathname !== '/ws') {
      socket.destroy()
      return
    }

    const token = url.searchParams.get('token')
    if (!token) { socket.destroy(); return }

    const dbSession = await getSessionByToken(token).catch(() => null)
    if (!dbSession?.player_id) { socket.destroy(); return }
    if (await isGuestSessionExpired(dbSession)) { socket.destroy(); return }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, token, dbSession)
    })
  })

  wss.on('connection', async (ws: WebSocket, _req: IncomingMessage, token: string, dbSession: DBSession) => {
    const playerId = dbSession.player_id
    if (!playerId) { ws.close(); return }

    // Kick existing session for same player
    const existing = sessionMap.getByPlayerId(playerId)
    if (existing) {
      existing.close()
      sessionMap.delete(existing.token)
    }

    const [player, state, skills, inventory] = await Promise.all([
      getPlayerById(playerId),
      getPlayerState(playerId),
      getPlayerSkills(playerId),
      getPlayerInventory(playerId),
    ])

    if (!player || !state) { ws.close(); return }

    const session = new GameSession(ws, token, player, state, skills, inventory)
    sessionMap.set(token, session)
    await session.start()

    const remainingMs = await getGuestRemainingMs(dbSession)
    const timeoutHandle = remainingMs !== null ? setTimeout(() => {
      session.send({ type: 'ERROR', payload: { code: 'GUEST_TIMEOUT', message: '訪客試玩已超時，請註冊正式帳號或重新登入。' } })
      session.close()
    }, remainingMs) : null

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        handleMessage(session, msg)
      } catch { /* ignore malformed */ }
    })

    ws.on('close', async () => {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      await session.save()
      session.stop()
      sessionMap.delete(token)
    })
  })

  console.log('WebSocket server attached')
}
