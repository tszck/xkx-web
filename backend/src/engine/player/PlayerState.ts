import type { DBPlayerState } from '../../db/queries/player'

export class PlayerState {
  playerId: number
  currentRoom: string
  qi: number; maxQi: number
  jing: number; maxJing: number
  neili: number; maxNeili: number
  effQi: number; effJing: number
  str: number; con: number; dex: number; intStat: number
  per: number; kar: number; sta: number; spi: number
  combatExp: number
  age: number; shen: number; shenType: number
  potential: number; learnedPoints: number
  money: number
  familyName: string | null
  familyGeneration: number | null

  constructor(db: DBPlayerState) {
    this.playerId = db.player_id
    this.currentRoom = db.current_room
    this.qi = db.qi; this.maxQi = db.max_qi
    this.jing = db.jing; this.maxJing = db.max_jing
    this.neili = db.neili; this.maxNeili = db.max_neili
    this.effQi = db.eff_qi; this.effJing = db.eff_jing
    this.str = db.str; this.con = db.con; this.dex = db.dex; this.intStat = db.int_stat
    this.per = db.per; this.kar = db.kar; this.sta = db.sta; this.spi = db.spi
    this.combatExp = db.combat_exp
    this.age = db.age; this.shen = db.shen; this.shenType = db.shen_type
    this.potential = db.potential; this.learnedPoints = db.learned_points
    this.money = db.money
    this.familyName = db.family_name
    this.familyGeneration = db.family_generation
  }

  toDBPartial(): Partial<DBPlayerState> {
    return {
      current_room: this.currentRoom,
      qi: this.qi, max_qi: this.maxQi,
      jing: this.jing, max_jing: this.maxJing,
      neili: this.neili, max_neili: this.maxNeili,
      eff_qi: this.effQi, eff_jing: this.effJing,
      str: this.str, con: this.con, dex: this.dex, int_stat: this.intStat,
      per: this.per, kar: this.kar, sta: this.sta, spi: this.spi,
      combat_exp: this.combatExp,
      age: this.age, shen: this.shen, shen_type: this.shenType,
      potential: this.potential, learned_points: this.learnedPoints,
      money: this.money,
      family_name: this.familyName,
      family_generation: this.familyGeneration,
    }
  }

  toStatPayload() {
    return {
      qi: this.qi, maxQi: this.maxQi,
      jing: this.jing, maxJing: this.maxJing,
      neili: this.neili, maxNeili: this.maxNeili,
      combatExp: this.combatExp,
      money: this.money,
      shen: this.shen,
    }
  }

  heal(amount: number) {
    this.qi = Math.min(this.qi + amount, this.maxQi)
    this.jing = Math.min(this.jing + amount, this.maxJing)
  }

  isDead() { return this.effQi <= 0 || this.effJing <= 0 }
}
