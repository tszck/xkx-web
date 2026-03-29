import type { GameSession } from '../GameSession'
import { worldLoader } from '../world/WorldLoader'

const TRAIN_COST_PER_LEVEL = 50  // wen per level gained

export class TrainAction {
  async execute(session: GameSession, payload: { skillId: string; npcId: string }) {
    const room = session.currentRoom
    if (!room) return

    const npc = room.npcs.get(payload.npcId)
    if (!npc || npc.def.type !== 'trainer') {
      session.sendLog('此人無法傳授武學。', 'system'); return
    }

    const skillDef = worldLoader.getSkill(payload.skillId)
    if (!skillDef) { session.sendLog('找不到此武學。', 'system'); return }

    if (!session.skills.checkPrerequisites(payload.skillId, session.state.familyName)) {
      session.sendLog(`你尚不具備修習「${skillDef.nameCN}」的條件。`, 'system'); return
    }

    const cost = TRAIN_COST_PER_LEVEL
    if (session.state.money < cost) {
      session.sendLog(`修習需要 ${cost} 文錢，你囊中羞澀。`, 'system'); return
    }

    if (session.state.potential <= session.state.learnedPoints) {
      session.sendLog('你的悟性已達極限，無法再修習新武學。', 'system'); return
    }

    session.state.money -= cost
    session.state.learnedPoints++
    const newLevel = await session.skills.improve(payload.skillId, 5)
    session.send({ type: 'STAT_UPDATE', payload: session.state.toStatPayload() })
    session.send({ type: 'SKILL_UPDATE', payload: { skillId: payload.skillId, level: newLevel } })
    session.sendLog(`你向${npc.def.name}學習了「${skillDef.nameCN}」，武學精進至 ${newLevel} 級。`, 'system')
  }
}
