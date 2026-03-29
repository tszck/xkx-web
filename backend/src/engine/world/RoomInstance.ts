import type { RoomDef } from './WorldLoader'
import type { NpcInstance } from './NpcInstance'

export class RoomInstance {
  readonly def: RoomDef
  npcs: Map<string, NpcInstance> = new Map()
  floorItems: Array<{ itemId: string; quantity: number }> = []

  constructor(def: RoomDef) {
    this.def = def
  }

  get id() { return this.def.id }
  get short() { return this.def.short }
  get long() { return this.def.long }
  get exits() { return this.def.exits }
  get coords() { return this.def.coords }

  toPayload() {
    return {
      roomId: this.def.id,
      short: this.def.short,
      long: this.def.long,
      exits: this.def.exits,
      npcs: Array.from(this.npcs.values()).map(n => n.toSummary()),
      items: this.floorItems,
      coords: this.def.coords,
    }
  }
}
