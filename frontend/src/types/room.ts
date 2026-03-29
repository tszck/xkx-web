import type { NpcSummary, ItemSummary } from '../ws/messageTypes'

export interface Room {
  roomId: string
  short: string
  long: string
  exits: Record<string, string>
  npcs: NpcSummary[]
  items: ItemSummary[]
  coords?: { x: number; y: number }
}
