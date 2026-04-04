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
import {
  clearPlayerActionState,
  getPlayerActionState,
  getPlayerRoomOverrides,
  getPlayerTickState,
  logPlayerAction,
  setPlayerActionState,
  setPlayerTickState,
  upsertPlayerRoomOverride,
} from '../db/queries/runtime'

type RoomOverrideEntry = {
  override_type: string
  data: Record<string, unknown>
}

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
  private runtimeActionState: Awaited<ReturnType<typeof getPlayerActionState>> = null
  private roomOverrides = new Map<string, RoomOverrideEntry[]>()

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

  async start() {
    await this.loadRuntimeState()
    this.enterRoom(this.state.currentRoom)
    this.restoreRuntimeState()
    this.tickTimer = setInterval(() => this.tick(), config.tickIntervalMs)
    this.send({ type: 'INVENTORY_UPDATE', payload: { items: this.inventory.toPayload() } })
  }

  async loadRuntimeState() {
    const [actionState, roomOverrideRows, tickState] = await Promise.all([
      getPlayerActionState(this.playerId),
      getPlayerRoomOverrides(this.playerId),
      getPlayerTickState(this.playerId),
    ])

    this.runtimeActionState = actionState
    if (tickState) {
      this.tickCount = Number(tickState.tick_count) || 0
    }
    this.roomOverrides.clear()
    for (const row of roomOverrideRows) {
      const entries = this.roomOverrides.get(row.room_id) ?? []
      entries.push({
        override_type: row.override_type,
        data: (row.data as Record<string, unknown>) ?? {},
      })
      this.roomOverrides.set(row.room_id, entries)
    }
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
    this.applyRoomOverrides(room)
    this.currentRoom = room
    this.state.currentRoom = roomId
    this.send({ type: 'ROOM_ENTER', payload: room.toPayload() })
  }

  async setActionState(mode: string, targetId: string | null, context: Record<string, unknown> | null = null, cooldownUntil: string | null = null) {
    this.runtimeActionState = {
      player_id: this.playerId,
      mode,
      target_id: targetId,
      context,
      cooldown_until: cooldownUntil,
      updated_at: new Date().toISOString(),
    }
    await setPlayerActionState(this.playerId, mode, targetId, context, cooldownUntil)
  }

  async clearActionState() {
    this.runtimeActionState = {
      player_id: this.playerId,
      mode: 'idle',
      target_id: null,
      context: null,
      cooldown_until: null,
      updated_at: new Date().toISOString(),
    }
    await clearPlayerActionState(this.playerId)
  }

  async appendRoomItemDelta(roomId: string, itemId: string, quantityDelta: number) {
    const entries = this.roomOverrides.get(roomId) ?? []
    let record = entries.find(entry => entry.override_type === 'floor_item_deltas')
    if (!record) {
      record = { override_type: 'floor_item_deltas', data: { deltas: [] } }
      entries.push(record)
      this.roomOverrides.set(roomId, entries)
    }

    const data = record.data as { deltas?: Array<{ itemId: string; quantity: number }> }
    const deltas = Array.isArray(data.deltas) ? data.deltas.slice() : []
    deltas.push({ itemId, quantity: quantityDelta })
    record.data = { deltas }
    await upsertPlayerRoomOverride(this.playerId, roomId, record.override_type, record.data)
  }

  async logAction(actionType: string, payload: Record<string, unknown>, resultCode: string, resultData: Record<string, unknown> = {}) {
    await logPlayerAction(this.playerId, actionType, payload, resultCode, resultData)
  }

  async persistTickState() {
    await setPlayerTickState(this.playerId, this.tickCount)
  }

  private applyRoomOverrides(room: RoomInstance) {
    const entries = this.roomOverrides.get(room.id) ?? []
    const floorItemDeltas = entries.find(entry => entry.override_type === 'floor_item_deltas')
    if (!floorItemDeltas) return

    const data = floorItemDeltas.data as { deltas?: Array<{ itemId: string; quantity: number }> }
    const floorItems = new Map<string, number>()
    for (const delta of data.deltas ?? []) {
      const next = Math.max(0, (floorItems.get(delta.itemId) ?? 0) + Number(delta.quantity))
      if (next === 0) floorItems.delete(delta.itemId)
      else floorItems.set(delta.itemId, next)
    }

    room.floorItems = Array.from(floorItems.entries()).map(([itemId, quantity]) => ({ itemId, quantity }))
  }

  private restoreRuntimeState() {
    if (!this.runtimeActionState) return

    if (this.runtimeActionState.mode === 'combat') {
      const targetId = this.runtimeActionState.target_id
      const roomState = this.runtimeActionState.context as { roomId?: string } | null
      const roomId = roomState?.roomId
      const target = this.currentRoom && targetId
        ? Array.from(this.currentRoom.npcs.values()).find(npc => npc.def.id === targetId && npc.alive)
        : null

      if (target && (!roomId || roomId === this.currentRoom?.id)) {
        this.combatTarget = target
        target.inCombatWith = String(this.playerId)
        this.send({ type: 'COMBAT_START', payload: { enemyId: target.instanceId, enemyName: target.def.name } })
        this.sendLog('你的戰鬥狀態已從資料庫恢復。', 'combat')
        return
      }

      void this.clearActionState()
      return
    }

    if (this.runtimeActionState.mode === 'dialog') {
      this.sendLog('你的對話狀態已從資料庫恢復。', 'system')
    }
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
    void this.persistTickState().catch(console.error)
  }
}
