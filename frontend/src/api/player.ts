import { apiFetch } from './client'

export interface PlayerSnapshotResponse {
  state: {
    qi: number; max_qi: number
    jing: number; max_jing: number
    neili: number; max_neili: number
    combat_exp: number
    money: number
    shen: number
  } | null
  skills: Array<{ skill_id: string; level: number }>
  inventory: Array<{ id: number; item_id: string; quantity: number; slot: string | null }>
  quests: Array<{ quest_id: string; status: string; assigned_npc: string | null }>
}

export async function getPlayerState() {
  return apiFetch<PlayerSnapshotResponse>('/player/state')
}

export async function savePlayerState() {
  return apiFetch('/player/state', { method: 'POST' })
}
