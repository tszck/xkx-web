import type { ClientActionType, InventoryItem, NpcSummary, RoomPayload } from '../ws/messageTypes'

export interface CommandAction {
  type: ClientActionType
  payload?: unknown
}

export interface CommandContext {
  room: RoomPayload | null
  inventory: InventoryItem[]
  dialogNpcId: string | null
}

export interface CommandResult {
  actions: CommandAction[]
  localMessage?: string
  helpQuery?: string
}

const DIR_ALIASES: Record<string, string> = {
  n: 'north', s: 'south', e: 'east', w: 'west',
  ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest',
  u: 'up', d: 'down', i: 'in', o: 'out',
}

function findNpc(npcs: NpcSummary[], query: string) {
  const q = query.trim().toLowerCase()
  return npcs.find(n => n.id.toLowerCase() === q)
    ?? npcs.find(n => n.defId.toLowerCase() === q)
    ?? npcs.find(n => n.name.toLowerCase().includes(q))
}

function findItemId(items: Array<{ itemId: string }>, query: string) {
  const q = query.trim().toLowerCase()
  const exact = items.find(i => i.itemId.toLowerCase() === q)
  if (exact) return exact.itemId
  const partial = items.find(i => i.itemId.toLowerCase().includes(q))
  return partial?.itemId
}

export function parseMudCommand(input: string, context: CommandContext): CommandResult {
  const line = input.trim()
  if (!line) return { actions: [] }

  const [rawCmd, ...rest] = line.split(/\s+/)
  const cmd = rawCmd.toLowerCase()
  const arg = rest.join(' ').trim()

  const maybeDir = DIR_ALIASES[cmd] ?? cmd
  if (context.room?.exits[maybeDir]) {
    return { actions: [{ type: 'MOVE', payload: { direction: maybeDir } }] }
  }

  if (cmd === 'look' || cmd === 'l') return { actions: [{ type: 'LOOK' }] }
  if (cmd === 'rest' || cmd === 'r') return { actions: [{ type: 'REST' }] }
  if (cmd === 'flee' || cmd === 'f') return { actions: [{ type: 'FLEE' }] }
  if (cmd === 'ping') return { actions: [{ type: 'PING' }] }

  if (cmd === 'attack' || cmd === 'kill' || cmd === 'k') {
    const npcs = context.room?.npcs.filter(n => n.alive) ?? []
    const target = arg ? findNpc(npcs, arg) : npcs.find(n => n.attitude === 'hostile') ?? npcs[0]
    if (!target) return { actions: [], localMessage: '找不到可攻擊目標。' }
    return { actions: [{ type: 'ATTACK', payload: { targetId: target.id } }] }
  }

  if (cmd === 'talk' || cmd === 'ask' || cmd === 't') {
    const npcs = context.room?.npcs.filter(n => n.alive) ?? []
    if (!arg && context.dialogNpcId) {
      return { actions: [{ type: 'TALK', payload: { npcId: context.dialogNpcId } }] }
    }
    const [npcQuery, ...topicParts] = rest
    if (!npcQuery) return { actions: [], localMessage: '用法：talk <npc> [topic]' }
    const target = findNpc(npcs, npcQuery)
    if (!target) return { actions: [], localMessage: '找不到可交談目標。' }
    const topic = topicParts.join(' ').trim()
    return {
      actions: [{ type: 'TALK', payload: { npcId: target.id, topic: topic || undefined } }],
    }
  }

  if (cmd === 'quest' || cmd === 'qst') {
    const npcs = context.room?.npcs.filter(n => n.alive && n.attitude !== 'hostile') ?? []
    const target = context.dialogNpcId
      ? npcs.find(n => n.id === context.dialogNpcId)
      : npcs[0]
    if (!target) return { actions: [], localMessage: '附近沒有可接任務的 NPC。' }
    return { actions: [{ type: 'TALK', payload: { npcId: target.id, topic: 'quest' } }] }
  }

  if (cmd === 'get' || cmd === 'take') {
    const roomItems = context.room?.items ?? []
    if (!arg) return { actions: [], localMessage: '用法：get <itemId>' }
    const itemId = findItemId(roomItems, arg)
    if (!itemId) return { actions: [], localMessage: '地上沒有這個物品。' }
    return { actions: [{ type: 'GET_ITEM', payload: { itemId } }] }
  }

  if (cmd === 'drop') {
    if (!arg) return { actions: [], localMessage: '用法：drop <itemId>' }
    const itemId = findItemId(context.inventory, arg)
    if (!itemId) return { actions: [], localMessage: '你沒有這個物品。' }
    return { actions: [{ type: 'DROP_ITEM', payload: { itemId } }] }
  }

  if (cmd === 'use') {
    if (!arg) return { actions: [], localMessage: '用法：use <itemId>' }
    const itemId = findItemId(context.inventory, arg)
    if (!itemId) return { actions: [], localMessage: '你沒有這個物品。' }
    return { actions: [{ type: 'USE_ITEM', payload: { itemId } }] }
  }

  if (cmd === 'equip' || cmd === 'wear' || cmd === 'wield') {
    if (!arg) return { actions: [], localMessage: '用法：equip <itemId>' }
    const itemId = findItemId(context.inventory, arg)
    if (!itemId) return { actions: [], localMessage: '你沒有這個物品。' }
    return { actions: [{ type: 'EQUIP_ITEM', payload: { itemId } }] }
  }

  if (cmd === 'train' || cmd === 'xue') {
    const [skillId, npcQuery] = rest
    if (!skillId || !npcQuery) return { actions: [], localMessage: '用法：train <skillId> <npc>' }
    const npcs = context.room?.npcs.filter(n => n.alive) ?? []
    const target = findNpc(npcs, npcQuery)
    if (!target) return { actions: [], localMessage: '找不到傳功 NPC。' }
    return { actions: [{ type: 'TRAIN_SKILL', payload: { skillId, npcId: target.id } }] }
  }

  if (cmd === 'help' || cmd === '?' || cmd === 'h' || cmd === '幫助' || cmd === '帮助') {
    if (arg) {
      return {
        actions: [],
        localMessage: `已查詢幫助主題：${arg}`,
        helpQuery: arg,
      }
    }
    return {
      actions: [],
      localMessage: '指令: n/s/e/w/ne/nw/se/sw/u/d/in/out, look, rest, attack, flee, talk, quest, get, drop, use, equip, train, ping。輸入 help <主題> 可查詢幫助索引。',
      helpQuery: '',
    }
  }

  return { actions: [], localMessage: `未知指令：${line}（輸入 help 查看）` }
}
