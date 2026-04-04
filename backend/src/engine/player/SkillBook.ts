import { upsertSkill } from '../../db/queries/player'
import { worldLoader } from '../world/WorldLoader'

export interface SkillEntry {
  skillId: string
  level: number
  mappedTo: string | null
}

export class SkillBook {
  private skills: Map<string, SkillEntry>
  private playerId: number

  constructor(playerId: number, entries: Array<{ skill_id: string; level: number; mapped_to: string | null }>) {
    this.playerId = playerId
    this.skills = new Map(entries.map(e => [e.skill_id, { skillId: e.skill_id, level: e.level, mappedTo: e.mapped_to }]))
  }

  getLevel(skillId: string): number {
    return this.skills.get(skillId)?.level ?? 0
  }

  has(skillId: string): boolean {
    return (this.skills.get(skillId)?.level ?? 0) > 0
  }

  async improve(skillId: string, amount: number) {
    const def = worldLoader.getSkill(skillId)
    const current = this.getLevel(skillId)
    const newLevel = Math.min(current + amount, 100)
    this.skills.set(skillId, { skillId, level: newLevel, mappedTo: this.skills.get(skillId)?.mappedTo ?? null })
    await upsertSkill(this.playerId, skillId, newLevel)
    return newLevel
  }

  checkPrerequisites(skillId: string, familyName: string | null): boolean {
    const def = worldLoader.getSkill(skillId)
    if (!def) return false
    for (const prereq of def.prerequisites) {
      if (prereq.startsWith('family:')) {
        const needed = prereq.slice(7)
        if (familyName !== needed) return false
        continue
      }

      const parts = prereq.split(':')
      if (parts.length === 2) {
        const [requiredSkillId, requiredLevelRaw] = parts
        const requiredLevel = Number(requiredLevelRaw)
        if (!requiredSkillId || !Number.isFinite(requiredLevel)) {
          if (this.getLevel(prereq) < 10) return false
          continue
        }
        if (this.getLevel(requiredSkillId) < requiredLevel) return false
        continue
      }

      if (this.getLevel(prereq) < 10) return false
    }
    return true
  }

  toPayload() {
    return Array.from(this.skills.values()).map(s => {
      const def = worldLoader.getSkill(s.skillId)
      return { skillId: s.skillId, level: s.level, nameCN: def?.nameCN ?? s.skillId, martialType: def?.martialType ?? 'other' }
    })
  }
}
