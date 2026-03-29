import type { GameSession } from '../GameSession'
import { resolvePlayerAttack, resolveNpcAttack } from '../combat/CombatEngine'

export class AttackAction {
  execute(session: GameSession, payload: { targetId: string }) {
    const room = session.currentRoom
    if (!room) return

    const npc = room.npcs.get(payload.targetId)
    if (!npc || !npc.alive) {
      session.sendLog('找不到該目標，或目標已死亡。', 'system'); return
    }
    if (room.def.flags['no_fight']) {
      session.sendLog('此地不允許戰鬥。', 'system'); return
    }

    session.combatTarget = npc
    npc.inCombatWith = String(session.playerId)
    session.send({ type: 'COMBAT_START', payload: { enemyId: npc.instanceId, enemyName: npc.def.name } })

    this.runRound(session)
  }

  private runRound(session: GameSession) {
    const npc = session.combatTarget
    if (!npc || !session.currentRoom) { this.endCombat(session, 'flee'); return }

    // Player attacks first
    const pRound = resolvePlayerAttack(session.state, session.skills, npc, session.playerName)
    session.send({ type: 'COMBAT_ROUND', payload: pRound })

    if (!npc.alive) {
      const xp = Math.floor(npc.def.combatExp * 0.3)
      session.state.combatExp += xp
      session.send({ type: 'STAT_UPDATE', payload: session.state.toStatPayload() })
      // Drop corpse item
      session.currentRoom.floorItems.push({ itemId: `corpse:${npc.def.id}`, quantity: 1 })
      session.send({ type: 'ROOM_ENTER', payload: session.currentRoom.toPayload() })
      this.endCombat(session, 'win', xp)
      return
    }

    // NPC counter-attacks
    const nRound = resolveNpcAttack(npc, session.state, session.skills, session.playerName)
    session.send({ type: 'COMBAT_ROUND', payload: nRound })
    session.send({ type: 'STAT_UPDATE', payload: session.state.toStatPayload() })

    if (session.state.isDead()) {
      this.endCombat(session, 'lose'); return
    }

    // Schedule next round (2s)
    setTimeout(() => {
      if (session.combatTarget === npc) this.runRound(session)
    }, 2000)
  }

  flee(session: GameSession) {
    if (!session.combatTarget) return
    session.combatTarget.inCombatWith = null
    this.endCombat(session, 'flee')
    // Move to a random exit
    const room = session.currentRoom
    if (room) {
      const exits = Object.values(room.exits)
      if (exits.length > 0) {
        const target = exits[Math.floor(Math.random() * exits.length)]
        session.sendLog('你落荒而逃！', 'combat')
        session.enterRoom(target)
      }
    }
  }

  private endCombat(session: GameSession, result: 'win' | 'lose' | 'flee', xpGained?: number) {
    session.combatTarget = null
    session.send({ type: 'COMBAT_END', payload: { result, xpGained } })
    if (result === 'lose') {
      session.state.qi = Math.floor(session.state.maxQi * 0.1)
      session.state.jing = Math.floor(session.state.maxJing * 0.1)
      session.sendLog('你被打敗了！在昏迷中慢慢甦醒……', 'combat')
      session.enterRoom('/d/city/beimen')
    }
  }
}
