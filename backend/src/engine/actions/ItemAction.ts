import type { GameSession } from '../GameSession'
import { worldLoader } from '../world/WorldLoader'

export class ItemAction {
  async get(session: GameSession, payload: { itemId: string }) {
    const room = session.currentRoom
    if (!room) return
    const idx = room.floorItems.findIndex(i => i.itemId === payload.itemId)
    if (idx === -1) { session.sendLog('地上沒有這個東西。', 'item'); return }
    const [item] = room.floorItems.splice(idx, 1)
    await session.inventory.addItem(item.itemId, item.quantity)
    await session.appendRoomItemDelta(room.id, item.itemId, -item.quantity)
    session.send({ type: 'INVENTORY_UPDATE', payload: { items: session.inventory.toPayload() } })
    session.send({ type: 'ROOM_ENTER', payload: room.toPayload() })
    session.sendLog(`你拿起了 ${item.itemId}。`, 'item')
  }

  async drop(session: GameSession, payload: { itemId: string }) {
    const room = session.currentRoom
    if (!room) return
    const ok = await session.inventory.removeItem(payload.itemId)
    if (!ok) { session.sendLog('你沒有這個東西。', 'item'); return }
    room.floorItems.push({ itemId: payload.itemId, quantity: 1 })
    await session.appendRoomItemDelta(room.id, payload.itemId, 1)
    session.send({ type: 'INVENTORY_UPDATE', payload: { items: session.inventory.toPayload() } })
    session.send({ type: 'ROOM_ENTER', payload: room.toPayload() })
    session.sendLog(`你丟下了 ${payload.itemId}。`, 'item')
  }

  async equip(session: GameSession, payload: { itemId: string }) {
    const def = worldLoader.getItem(payload.itemId)
    if (!def) { session.sendLog('找不到此物品。', 'item'); return }
    const slot = def.type === 'weapon' || def.type === 'sword' ? 'weapon' : 'armor'
    const ok = await session.inventory.equip(payload.itemId, slot)
    if (!ok) { session.sendLog('你沒有這件物品。', 'item'); return }
    session.send({ type: 'INVENTORY_UPDATE', payload: { items: session.inventory.toPayload() } })
    session.sendLog(`你裝備了 ${def.name}。`, 'item')
  }

  async use(session: GameSession, payload: { itemId: string }) {
    const def = worldLoader.getItem(payload.itemId)
    if (!def) { session.sendLog('找不到此物品。', 'item'); return }
    if (def.type === 'food' || def.type === 'medicine') {
      const ok = await session.inventory.removeItem(payload.itemId)
      if (!ok) { session.sendLog('你沒有這個東西。', 'item'); return }
      const healAmt = def.value ?? 20
      session.state.heal(healAmt)
      session.send({ type: 'STAT_UPDATE', payload: session.state.toStatPayload() })
      session.send({ type: 'INVENTORY_UPDATE', payload: { items: session.inventory.toPayload() } })
      session.sendLog(`你使用了 ${def.name}，恢復了 ${healAmt} 點氣血。`, 'item')
    } else {
      session.sendLog('這個東西無法使用。', 'item')
    }
  }
}
