import fs from 'fs'
import path from 'path'
import type { GameSession } from '../GameSession'

const RAW_XKX_DIR = process.env.RAW_XKX_DIR ?? '/root/projects/xkx'
const COMMAND_DIRS = ['cmds/std', 'cmds/skill']

let cached: Set<string> | null = null

function loadCommands(): Set<string> {
  if (cached) return cached
  const commands = new Set<string>()

  for (const relDir of COMMAND_DIRS) {
    const absDir = path.join(RAW_XKX_DIR, relDir)
    if (!fs.existsSync(absDir)) continue

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(p)
          continue
        }
        if (!entry.name.endsWith('.c')) continue
        commands.add(entry.name.replace(/\.c$/, '').toLowerCase())
      }
    }

    walk(absDir)
  }

  cached = commands
  return commands
}

function hasAny(commands: Set<string>, names: string[]) {
  return names.some((name) => commands.has(name))
}

export function buildLookActionHint(session: GameSession): string {
  const room = session.currentRoom
  const commands = loadCommands()
  const hints: string[] = []

  if (commands.has('look')) hints.push('察看(look)')

  if (room && Object.keys(room.exits).length > 0 && commands.has('go')) {
    hints.push('往某方向移動(go 方向)')
  }

  const npcs = room ? Array.from(room.npcs.values()).filter((npc) => npc.alive) : []
  const hasFriendlyNpc = npcs.some((npc) => npc.def.attitude !== 'hostile')
  const hasHostileNpc = npcs.some((npc) => npc.def.attitude === 'hostile')

  if (hasFriendlyNpc && hasAny(commands, ['ask', 'talk'])) {
    hints.push('與某人交談(talk 某人)')
  }

  if (hasHostileNpc && hasAny(commands, ['attack', 'kill', 'hit'])) {
    hints.push('向某人發動攻勢(attack 某人)')
  }

  if (hasHostileNpc && commands.has('fight')) {
    hints.push('向某人要求切磋(fight 某人)')
  }

  const hasTrainerNpc = npcs.some((npc) => npc.def.type === 'trainer')
  if (hasTrainerNpc && hasAny(commands, ['train', 'learn', 'xue'])) {
    hints.push('向某人修習武學(train 武學 某人)')
  }

  const roomItems = room?.floorItems ?? []
  if (roomItems.length > 0 && commands.has('get')) {
    hints.push('拾取物品(get 物品)')
  }

  const inventory = session.inventory.getAll()
  if (inventory.length > 0 && commands.has('drop')) {
    hints.push('丟棄物品(drop 物品)')
  }
  if (inventory.length > 0 && hasAny(commands, ['eat', 'drink', 'use'])) {
    hints.push('使用物品(use 物品)')
  }
  if (inventory.length > 0 && hasAny(commands, ['wear', 'wield', 'equip'])) {
    hints.push('裝備物品(equip 物品)')
  }

  if (hints.length === 0) {
    return '目前可用操作有限，先四處探索(look / go 方向)。'
  }

  return `你可以 ${hints.join('，')}。`
}
