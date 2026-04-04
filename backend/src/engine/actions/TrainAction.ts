import type { GameSession } from '../GameSession'
import { worldLoader } from '../world/WorldLoader'

const TRAIN_COST_PER_LEVEL = 50  // wen per level gained

function calcTrainingGain(session: GameSession, skillDef: { martialType: string; learnBonus: number; successRate: number; powerPoint: number }) {
  const s = session.state

  // Attribute affinity by martial type from traditional MUD stat expectations.
  if ((skillDef.martialType === 'dodge' || skillDef.martialType === 'sword' || skillDef.martialType === 'blade') && s.dex < 12) {
    return { gain: 0, reason: '你的身法不足，尚難領會此類武學。' }
  }
  if ((skillDef.martialType === 'force' || skillDef.martialType === 'parry') && s.con < 12) {
    return { gain: 0, reason: '你的根骨不足，尚難承受此類內外勁路。' }
  }
  if ((skillDef.martialType === 'unarmed' || skillDef.martialType === 'cuff' || skillDef.martialType === 'strike') && s.str < 12) {
    return { gain: 0, reason: '你的臂力不足，尚難掌握此類拳掌武學。' }
  }

  const intBonus = Math.floor((s.intStat - 10) / 4)
  const spiBonus = Math.floor((s.spi - 10) / 5)
  const dexBonus = Math.floor((s.dex - 10) / 6)
  const learnBonus = Math.floor(skillDef.learnBonus / 20)
  const successBonus = Math.floor((skillDef.successRate - 50) / 25)
  const powerPenalty = Math.floor(skillDef.powerPoint / 100)

  const gain = Math.max(1, Math.min(10, 3 + intBonus + spiBonus + dexBonus + learnBonus + successBonus - powerPenalty))
  return { gain, reason: null as string | null }
}

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

    const { gain, reason } = calcTrainingGain(session, skillDef)
    if (gain <= 0) {
      session.sendLog(reason ?? '你的資質尚不足以修習此武學。', 'system'); return
    }

    const cost = TRAIN_COST_PER_LEVEL + Math.max(0, Math.floor(skillDef.powerPoint / 10))
    if (session.state.money < cost) {
      session.sendLog(`修習需要 ${cost} 文錢，你囊中羞澀。`, 'system'); return
    }

    const potentialCost = Math.max(1, Math.ceil(gain / 2))
    if (session.state.potential <= session.state.learnedPoints + potentialCost - 1) {
      session.sendLog('你的悟性已達極限，無法再修習新武學。', 'system'); return
    }

    session.state.money -= cost
    session.state.learnedPoints += potentialCost
    const newLevel = await session.skills.improve(payload.skillId, gain)
    session.send({ type: 'STAT_UPDATE', payload: session.state.toStatPayload() })
    session.send({ type: 'SKILL_UPDATE', payload: { skillId: payload.skillId, level: newLevel } })
    session.sendLog(`你向${npc.def.name}學習了「${skillDef.nameCN}」，精進 ${gain} 級（現為 ${newLevel} 級）。`, 'system')
  }
}
