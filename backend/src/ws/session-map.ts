import type { GameSession } from '../engine/GameSession'

class SessionMap {
  private byToken = new Map<string, GameSession>()
  private byPlayerId = new Map<number, GameSession>()

  set(token: string, session: GameSession) {
    this.byToken.set(token, session)
    this.byPlayerId.set(session.playerId, session)
  }

  getByToken(token: string): GameSession | undefined {
    return this.byToken.get(token)
  }

  getByPlayerId(id: number): GameSession | undefined {
    return this.byPlayerId.get(id)
  }

  delete(token: string) {
    const session = this.byToken.get(token)
    if (session) this.byPlayerId.delete(session.playerId)
    this.byToken.delete(token)
  }

  size() { return this.byToken.size }
}

export const sessionMap = new SessionMap()
