import type { NpcDef } from './WorldLoader'

export class NpcInstance {
  readonly def: NpcDef
  readonly instanceId: string
  qi: number
  jing: number
  alive: boolean = true
  inCombatWith: string | null = null  // playerId

  constructor(def: NpcDef, instanceId: string) {
    this.def = def
    this.instanceId = instanceId
    // HP derived from combatExp bracket
    const base = Math.max(50, Math.min(def.combatExp / 100, 2000))
    this.qi = Math.round(base)
    this.jing = Math.round(base * 0.8)
  }

  get maxQi() { return Math.round(Math.max(50, Math.min(this.def.combatExp / 100, 2000))) }
  get maxJing() { return Math.round(this.maxQi * 0.8) }
  get qiRatio() { return Math.max(0, Math.round((this.qi / this.maxQi) * 100)) }

  toSummary() {
    return {
      id: this.instanceId,
      defId: this.def.id,
      name: this.def.name,
      attitude: this.def.attitude,
      alive: this.alive,
    }
  }
}
