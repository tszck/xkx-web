export type ClientActionType =
  | 'MOVE' | 'ATTACK' | 'FLEE' | 'TALK' | 'GET_ITEM' | 'DROP_ITEM'
  | 'USE_ITEM' | 'EQUIP_ITEM' | 'LOOK' | 'TRAIN_SKILL' | 'REST' | 'PING'

export type ServerEventType =
  | 'ROOM_ENTER' | 'ROOM_UPDATE' | 'LOG' | 'COMBAT_START' | 'COMBAT_ROUND'
  | 'COMBAT_END' | 'STAT_UPDATE' | 'INVENTORY_UPDATE' | 'DIALOG'
  | 'QUEST_ASSIGNED' | 'QUEST_COMPLETE' | 'SKILL_UPDATE' | 'SKILL_LEARNED'
  | 'ERROR' | 'PONG' | 'TICK'

export interface NpcSummary { id: string; defId: string; name: string; attitude: string; alive: boolean }
export interface ItemSummary { itemId: string; quantity: number }

export interface RoomPayload {
  roomId: string
  short: string
  long: string
  exits: Record<string, string>
  npcs: NpcSummary[]
  items: ItemSummary[]
  coords?: { x: number; y: number }
}

export interface CombatRoundPayload {
  attackerName: string
  defenderName: string
  result: 'hit' | 'dodge' | 'parry' | 'riposte'
  damage?: number
  typeNameCN?: string
  message: string
  playerQi: number
  playerJing: number
  enemyQiRatio: number
  enemyQi: number
  enemyMaxQi: number
}

export interface LogEntry {
  timestamp: number
  category: 'move' | 'combat' | 'system' | 'npc' | 'item' | 'quest'
  text: string
}

export interface PlayerStatsPayload {
  qi: number; maxQi: number
  jing: number; maxJing: number
  neili: number; maxNeili: number
  combatExp: number
  money: number
  shen: number
}

export interface InventoryItem {
  id: number
  itemId: string
  name: string
  quantity: number
  slot: string | null
  type?: string
}

export interface SkillPayload {
  skillId: string
  level: number
  nameCN: string
  martialType: string
}

export interface QuestAssignedPayload {
  questId: string
  description: string
}

export interface QuestCompletePayload {
  questId: string
  reward: string
}

export interface ServerEvent {
  type: ServerEventType
  payload?: unknown
}

export function sendAction(ws: WebSocket, type: ClientActionType, payload?: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload ? { type, payload } : { type }))
  }
}
