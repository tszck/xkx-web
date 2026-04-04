import { pool } from '../../db/pool'
import { worldLoader } from '../world/WorldLoader'

export interface InventoryItem {
  id: number
  itemId: string
  quantity: number
  slot: string | null
  extraData: unknown
}

export class Inventory {
  private items: InventoryItem[]
  private playerId: number

  constructor(playerId: number, rows: Array<{ id: number; item_id: string; quantity: number; slot: string | null; extra_data: unknown }>) {
    this.playerId = playerId
    this.items = rows.map(r => ({
      id: r.id,
      itemId: r.item_id,
      quantity: r.quantity,
      slot: r.slot,
      extraData: r.extra_data,
    }))
  }

  getAll() { return this.items }

  getEquipped(slot: string) {
    return this.items.find(i => i.slot === slot)
  }

  async addItem(itemId: string, quantity = 1) {
    const existing = this.items.find(i => i.itemId === itemId && i.slot === null)
    if (existing) {
      existing.quantity += quantity
      await pool.query(`UPDATE player_inventory SET quantity=$1 WHERE id=$2`, [existing.quantity, existing.id])
    } else {
      const r = await pool.query<{ id: number }>(
        `INSERT INTO player_inventory (player_id, item_id, quantity) VALUES ($1,$2,$3) RETURNING id`,
        [this.playerId, itemId, quantity]
      )
      this.items.push({ id: r.rows[0].id, itemId, quantity, slot: null, extraData: null })
    }
  }

  async removeItem(itemId: string, quantity = 1): Promise<boolean> {
    const idx = this.items.findIndex(i => i.itemId === itemId && i.slot === null)
    if (idx === -1) return false
    const item = this.items[idx]
    if (item.quantity > quantity) {
      item.quantity -= quantity
      await pool.query(`UPDATE player_inventory SET quantity=$1 WHERE id=$2`, [item.quantity, item.id])
    } else {
      await pool.query(`DELETE FROM player_inventory WHERE id=$1`, [item.id])
      this.items.splice(idx, 1)
    }
    return true
  }

  async equip(itemId: string, slot: string): Promise<boolean> {
    const item = this.items.find(i => i.itemId === itemId && i.slot === null)
    if (!item) return false
    // Unequip existing in slot
    const current = this.items.find(i => i.slot === slot)
    if (current) {
      current.slot = null
      await pool.query(`UPDATE player_inventory SET slot=NULL WHERE id=$1`, [current.id])
    }
    item.slot = slot
    await pool.query(`UPDATE player_inventory SET slot=$1 WHERE id=$2`, [slot, item.id])
    return true
  }

  toPayload() {
    return this.items.map(i => {
      const def = worldLoader.getItem(i.itemId)
      return { id: i.id, itemId: i.itemId, name: def?.name ?? i.itemId, quantity: i.quantity, slot: i.slot, type: def?.type }
    })
  }
}
