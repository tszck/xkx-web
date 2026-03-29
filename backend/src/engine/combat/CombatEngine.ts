import type { PlayerState } from '../player/PlayerState'
import type { SkillBook } from '../player/SkillBook'
import type { NpcInstance } from '../world/NpcInstance'
import { buildDamageResult, type DamageType } from './DamageCalc'

// Ported from /root/projects/xkx/adm/daemons/combatd.c
// skill_power(ob, skill, usage) equivalent

export interface RoundResult {
  attackerName: string
  defenderName: string
  result: 'hit' | 'dodge' | 'parry' | 'riposte'
  damage?: number
  damageType?: string
  typeNameCN?: string
  message: string
  playerQi: number
  playerJing: number
  enemyQiRatio: number
}

function rand(n: number): number { return Math.floor(Math.random() * n) }

function calcAttackPower(skillLevel: number, baseStr: number): number {
  return Math.max(1, Math.floor(skillLevel * 0.8 + baseStr * 0.5))
}

function calcDefensePower(dodgeLevel: number, dex: number): number {
  return Math.max(1, Math.floor(dodgeLevel * 0.7 + dex * 0.4))
}

function calcParryPower(parryLevel: number, sta: number): number {
  return Math.max(1, Math.floor(parryLevel * 0.6 + sta * 0.3))
}

function selectDamageType(skillId: string): DamageType {
  if (skillId.includes('sword') || skillId.includes('blade') || skillId.includes('saber')) return 'slash'
  if (skillId.includes('spear') || skillId.includes('needle') || skillId.includes('finger')) return 'pierce'
  if (skillId.includes('palm') || skillId.includes('force') || skillId.includes('neili')) return 'internal'
  return 'blunt'
}

export function resolvePlayerAttack(
  player: PlayerState,
  skills: SkillBook,
  npc: NpcInstance,
  playerName: string
): RoundResult {
  const attackSkill = 'unarmed'
  const ap = calcAttackPower(skills.getLevel(attackSkill), player.str)
  const dp = calcDefensePower(npc.def.skills['dodge'] ?? 0, npc.def.attrs['dex'] ?? 10)
  const pp = calcParryPower(npc.def.skills['parry'] ?? 0, npc.def.attrs['sta'] ?? 10)

  if (rand(ap + dp) < dp) {
    return { attackerName: playerName, defenderName: npc.def.name, result: 'dodge', message: `${npc.def.name}閃避了你的攻擊！`, playerQi: player.qi, playerJing: player.jing, enemyQiRatio: npc.qiRatio }
  }
  if (rand(ap + pp) < pp) {
    return { attackerName: playerName, defenderName: npc.def.name, result: 'parry', message: `${npc.def.name}格擋了你的攻擊！`, playerQi: player.qi, playerJing: player.jing, enemyQiRatio: npc.qiRatio }
  }

  const baseDmg = Math.max(1, ap - Math.floor(rand(3)))
  const dmgType = selectDamageType(attackSkill)
  const dr = buildDamageResult(baseDmg, dmgType)
  npc.qi = Math.max(0, npc.qi - dr.amount)
  if (npc.qi <= 0) npc.alive = false

  return {
    attackerName: playerName,
    defenderName: npc.def.name,
    result: 'hit',
    damage: dr.amount,
    damageType: dr.type,
    typeNameCN: dr.typeNameCN,
    message: `你攻擊${npc.def.name}，造成${dr.amount}點${dr.typeNameCN}。${dr.message}`,
    playerQi: player.qi,
    playerJing: player.jing,
    enemyQiRatio: npc.qiRatio,
  }
}

export function resolveNpcAttack(
  npc: NpcInstance,
  player: PlayerState,
  skills: SkillBook,
  playerName: string
): RoundResult {
  const npcAttack = npc.def.skills['unarmed'] ?? npc.def.skills['sword'] ?? 10
  const ap = calcAttackPower(npcAttack, npc.def.attrs['str'] ?? 15)
  const dp = calcDefensePower(skills.getLevel('dodge'), player.dex)
  const pp = calcParryPower(skills.getLevel('parry'), player.sta)

  if (rand(ap + dp) < dp) {
    return { attackerName: npc.def.name, defenderName: playerName, result: 'dodge', message: `你閃避了${npc.def.name}的攻擊！`, playerQi: player.qi, playerJing: player.jing, enemyQiRatio: npc.qiRatio }
  }
  if (rand(ap + pp) < pp) {
    return { attackerName: npc.def.name, defenderName: playerName, result: 'parry', message: `你格擋了${npc.def.name}的攻擊！`, playerQi: player.qi, playerJing: player.jing, enemyQiRatio: npc.qiRatio }
  }

  const baseDmg = Math.max(1, ap - Math.floor(rand(3)))
  const dmgType: DamageType = 'blunt'
  const dr = buildDamageResult(baseDmg, dmgType)
  player.qi = Math.max(0, player.qi - dr.amount)
  player.effQi = Math.max(0, player.effQi - Math.floor(dr.amount / 5))

  return {
    attackerName: npc.def.name,
    defenderName: playerName,
    result: 'hit',
    damage: dr.amount,
    damageType: dr.type,
    typeNameCN: dr.typeNameCN,
    message: `${npc.def.name}攻擊你，造成${dr.amount}點${dr.typeNameCN}。${dr.message}`,
    playerQi: player.qi,
    playerJing: player.jing,
    enemyQiRatio: npc.qiRatio,
  }
}
