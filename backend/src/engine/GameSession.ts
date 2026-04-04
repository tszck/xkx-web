import { WebSocket } from 'ws'
import type { DBPlayer, DBPlayerState } from '../db/queries/player'
import { savePlayerState, upsertSkill } from '../db/queries/player'
import { PlayerState } from './player/PlayerState'
import { SkillBook } from './player/SkillBook'
import { Inventory } from './player/Inventory'
import { RoomInstance } from './world/RoomInstance'
import { NpcInstance } from './world/NpcInstance'
import { worldLoader } from './world/WorldLoader'
import { config } from '../config'

function resolveNpcId(roomId: string, rawNpcId: string): string {
  if (rawNpcId.startsWith('/')) return rawNpcId
  if (rawNpcId.startsWith('npc/')) {
    const parts = roomId.split('/').filter(Boolean)
    const domain = parts[1] ?? 'city'
    return `/d/${domain}/${rawNpcId}`
  }
  return rawNpcId
}

export interface ServerEvent {
  type: string
  payload?: unknown
}

export class GameSession {
  readonly token: string
  readonly playerId: number
  readonly playerName: string
  state: PlayerState
  skills: SkillBook
  inventory: Inventory
  currentRoom: RoomInstance | null = null
  combatTarget: NpcInstance | null = null
  private ws: WebSocket
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private tickCount = 0

  constructor(
    ws: WebSocket,
    token: string,
    player: DBPlayer,
    state: DBPlayerState,
    skillRows: Array<{ skill_id: string; level: number; mapped_to: string | null }>,
    invRows: Array<{ id: number; item_id: string; quantity: number; slot: string | null; extra_data: unknown }>,
  ) {
    this.ws = ws
    this.token = token
    this.playerId = player.id
    this.playerName = player.display_name
    this.state = new PlayerState(state)
    this.skills = new SkillBook(player.id, skillRows)
    this.inventory = new Inventory(player.id, invRows)
  }

  start() {
    this.enterRoom(this.state.currentRoom)
    this.tickTimer = setInterval(() => this.tick(), config.tickIntervalMs)
    this.send({ type: 'INVENTORY_UPDATE', payload: { items: this.inventory.toPayload() } })
  }

  stop() {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null }
  }

  close() {
    this.stop()
    if (this.ws.readyState === WebSocket.OPEN) this.ws.close()
  }

  send(event: ServerEvent) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event))
    }
  }

  sendLog(text: string, category: string = 'system') {
    this.send({ type: 'LOG', payload: { messages: [{ timestamp: Date.now(), category, text }] } })
  }

  enterRoom(roomId: string) {
    const def = worldLoader.getRoom(roomId)
    if (!def) {
      this.sendLog(`【系統】找不到房間：${roomId}`, 'system')
      return
    }
    const room = new RoomInstance(def)
    // Spawn NPCs
    for (const rawNpcId of def.npcs) {
      const npcId = resolveNpcId(roomId, rawNpcId)
      const npcDef = worldLoader.getNpc(npcId)
      if (!npcDef) continue
      const count = def.npcCounts?.[rawNpcId] ?? def.npcCounts?.[npcId] ?? 1
      for (let i = 0; i < count; i++) {
        const inst = new NpcInstance(npcDef, `${npcId}#${i}`)
        room.npcs.set(inst.instanceId, inst)
      }
    }
    this.currentRoom = room
    this.state.currentRoom = roomId
    this.send({ type: 'ROOM_ENTER', payload: room.toPayload() })
  }

  async save() {
    await savePlayerState(this.playerId, this.state.toDBPartial())
  }

  private tick() {
    this.tickCount++
    this.send({ type: 'TICK', payload: { tick: this.tickCount } })
    // Passive HP regen (5% per tick when not in combat)
    if (!this.combatTarget) {
      const regenQi = Math.max(1, Math.floor(this.state.maxQi * 0.02))
      const regenJing = Math.max(1, Math.floor(this.state.maxJing * 0.02))
      if (this.state.qi < this.state.maxQi || this.state.jing < this.state.maxJing) {
        this.state.qi = Math.min(this.state.qi + regenQi, this.state.maxQi)
        this.state.jing = Math.min(this.state.jing + regenJing, this.state.maxJing)
        this.send({ type: 'STAT_UPDATE', payload: this.state.toStatPayload() })
      }
    }
    // Auto-save
    if (this.tickCount % config.autoSaveIntervalTicks === 0) {
      this.save().catch(console.error)
    }
  }
}
