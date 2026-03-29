import type { GameSession } from '../GameSession'

const DIR_CN: Record<string, string> = {
  north: '北', south: '南', east: '東', west: '西',
  northeast: '東北', northwest: '西北', southeast: '東南', southwest: '西南',
  up: '上', down: '下', in: '内', out: '外',
}

export class MoveAction {
  execute(session: GameSession, payload: { direction: string }) {
    if (session.combatTarget) {
      session.sendLog('你正在戰鬥中，無法移動！', 'system'); return
    }
    const room = session.currentRoom
    if (!room) return

    const dir = payload.direction.toLowerCase()
    const target = room.exits[dir]
    if (!target) {
      session.sendLog(`這個方向沒有出路。`, 'move'); return
    }

    const dirCN = DIR_CN[dir] ?? dir
    session.sendLog(`你向${dirCN}走去。`, 'move')
    session.enterRoom(target)
  }
}
