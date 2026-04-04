import type { GameSession } from '../GameSession'
import { worldLoader, type NpcDef } from '../world/WorldLoader'

export interface DynamicHuntQuest {
  questId: string
  targetNpcId: string
  targetNpcName: string
  description: string
  rewardXp: number
  rewardScore: number
}

function calcBracketRange(combatExp: number) {
  const base = Math.max(50, combatExp)
  const min = Math.floor(base * 0.6)
  const max = Math.floor(base * 1.6 + 300)
  return { min, max }
}

function calcRewards(targetExp: number) {
  const rewardXp = Math.max(40, Math.min(4000, Math.floor(targetExp * 0.12 + 60)))
  const rewardScore = Math.max(1, Math.min(300, Math.floor(rewardXp / 25)))
  return { rewardXp, rewardScore }
}

function pickCandidate(candidates: NpcDef[], playerExp: number): NpcDef | null {
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) => {
    const da = Math.abs(a.combatExp - playerExp)
    const db = Math.abs(b.combatExp - playerExp)
    return da - db
  })
  const top = sorted.slice(0, Math.min(20, sorted.length))
  return top[Math.floor(Math.random() * top.length)] ?? null
}

export class DynamicQuest {
  generateHuntQuest(session: GameSession): DynamicHuntQuest | null {
    const playerExp = session.state.combatExp
    const { min, max } = calcBracketRange(playerExp)

    const inRoom = session.currentRoom
      ? Array.from(session.currentRoom.npcs.values()).map(n => n.def)
      : []
    const worldNpcs = worldLoader.getAllNpcs()

    const filter = (npc: NpcDef) => npc.combatExp >= min && npc.combatExp <= max && npc.attitude !== 'friendly'
    const roomCandidates = inRoom.filter(filter)
    const worldCandidates = worldNpcs.filter(filter)

    const target = pickCandidate(roomCandidates, playerExp) ?? pickCandidate(worldCandidates, playerExp)
    if (!target) return null

    const { rewardXp, rewardScore } = calcRewards(target.combatExp)
    const questId = `dyn_hunt:${target.id}:${Date.now()}`

    return {
      questId,
      targetNpcId: target.id,
      targetNpcName: target.name,
      description: `擊敗「${target.name}」一次（目標經驗約 ${target.combatExp.toLocaleString()}）`,
      rewardXp,
      rewardScore,
    }
  }

  getKillReward(targetCombatExp: number) {
    return calcRewards(targetCombatExp)
  }
}

export const dynamicQuest = new DynamicQuest()