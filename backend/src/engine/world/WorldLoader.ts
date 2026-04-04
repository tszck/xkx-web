import fs from 'fs'
import path from 'path'

export interface RoomDef {
  id: string
  short: string
  long: string
  exits: Record<string, string>
  npcs: string[]
  npcCounts?: Record<string, number>
  items: string[]
  coords?: { x: number; y: number }
  flags: Record<string, boolean>
  outdoors?: string
}

export interface NpcDef {
  id: string
  name: string
  ids: string[]
  gender: string
  age: number
  description: string
  attitude: 'friendly' | 'neutral' | 'hostile'
  combatExp: number
  attrs: Record<string, number>
  skills: Record<string, number>
  chatMessages: string[]
  inquiryTopics: Record<string, string>
  carriedItems: string[]
  equippedSlots: Record<string, string>
  type?: 'shop' | 'waiter' | 'trainer' | 'npc'
  shopItems?: string[]
}

export interface ItemDef {
  id: string
  name: string
  ids: string[]
  description: string
  value: number
  weight: number
  type: string
  baseDamage?: number
  baseDefense?: number
  material?: string
}

export interface SkillDef {
  id: string
  nameCN: string
  type: string
  martialType: string
  learnBonus: number
  successRate: number
  powerPoint: number
  prerequisites: string[]
}

// Use src/data for both tsx dev and compiled dist runtime.
const DATA_DIR = path.join(__dirname, '../../../src/data')

class WorldLoader {
  private rooms = new Map<string, RoomDef>()
  private npcs = new Map<string, NpcDef>()
  private items = new Map<string, ItemDef>()
  private skills = new Map<string, SkillDef>()
  private loaded = false

  async load() {
    if (this.loaded) return
    await this.loadDir('rooms', this.rooms)
    await this.loadDir('npcs', this.npcs)
    await this.loadDir('items', this.items)
    await this.loadSkills()
    this.loaded = true
    console.log(`World loaded: ${this.rooms.size} rooms, ${this.npcs.size} npcs, ${this.items.size} items, ${this.skills.size} skills`)
  }

  private async loadDir<T>(subdir: string, map: Map<string, T>) {
    const dir = path.join(DATA_DIR, subdir)
    if (!fs.existsSync(dir)) return
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        if (entry.isDirectory()) { walk(path.join(d, entry.name)); continue }
        if (!entry.name.endsWith('.json')) continue
        try {
          const data = JSON.parse(fs.readFileSync(path.join(d, entry.name), 'utf-8')) as T & { id: string }
          map.set(data.id, data)
        } catch (e) {
          console.warn(`Failed to load ${entry.name}:`, e)
        }
      }
    }
    walk(dir)
  }

  private async loadSkills() {
    const skillDir = path.join(DATA_DIR, 'skills')
    if (!fs.existsSync(skillDir)) return
    const namesFile = path.join(skillDir, 'names.json')
    const names: Record<string, string> = fs.existsSync(namesFile)
      ? JSON.parse(fs.readFileSync(namesFile, 'utf-8'))
      : {}
    this.loadDir('skills', this.skills)
    // Inject Chinese names
    this.skills.forEach((skill, id) => {
      if (names[id]) skill.nameCN = names[id]
    })
  }

  getRoom(id: string): RoomDef | undefined { return this.rooms.get(id) }
  getNpc(id: string): NpcDef | undefined { return this.npcs.get(id) }
  getItem(id: string): ItemDef | undefined { return this.items.get(id) }
  getSkill(id: string): SkillDef | undefined { return this.skills.get(id) }
  getAllNpcs() { return Array.from(this.npcs.values()) }

  getAllRoomSummaries() {
    return Array.from(this.rooms.values()).map(r => ({
      id: r.id, short: r.short, coords: r.coords, exits: Object.keys(r.exits)
    }))
  }

  getRoomsByDomain(domain: string) {
    return Array.from(this.rooms.values()).filter(r => r.id.startsWith(`/d/${domain}/`))
  }
}

export const worldLoader = new WorldLoader()
