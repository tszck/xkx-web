import { create } from 'zustand'
import type { ServerEvent, RoomPayload, LogEntry, PlayerStatsPayload, InventoryItem, CombatRoundPayload, SkillPayload, QuestAssignedPayload, QuestCompletePayload } from '../ws/messageTypes'
import type { PlayerSnapshotResponse } from '../api/player'

export interface QuestEntry {
  questId: string
  description: string
  status: 'active' | 'completed'
  assignedNpc?: string
  reward?: string
}

function describeQuest(questId: string, assignedNpc?: string | null) {
  if (questId.startsWith('dyn_hunt:')) {
    const target = assignedNpc ?? questId.split(':')[1] ?? '未知目標'
    return `擊敗目標：${target}`
  }
  return questId
}

interface GameState {
  // Auth
  token: string | null
  playerId: number | null
  displayName: string
  // Room
  room: RoomPayload | null
  // Event log
  log: LogEntry[]
  // Stats
  stats: PlayerStatsPayload | null
  // Inventory
  inventory: InventoryItem[]
  // Skills
  skills: SkillPayload[]
  // Quests
  quests: QuestEntry[]
  // Combat
  inCombat: boolean
  combatEnemy: { id: string; name: string; qiRatio: number; qi: number; maxQi: number } | null
  lastRound: CombatRoundPayload | null
  // Dialog
  dialogOpen: boolean
  dialogNpc: { id: string; name: string } | null
  dialogText: string
  // UI
  renameModalOpen: boolean
  helpModalOpen: boolean
  // Minimap room summaries (loaded once)
  roomSummaries: Array<{ id: string; short: string; coords?: { x: number; y: number } }>

  // Actions
  setAuth: (token: string, playerId: number, displayName: string) => void
  setDisplayName: (name: string) => void
  setRoomSummaries: (s: GameState['roomSummaries']) => void
  hydrateFromSnapshot: (snapshot: PlayerSnapshotResponse) => void
  handleServerEvent: (event: ServerEvent) => void
  openDialog: (npcId: string, npcName: string) => void
  closeDialog: () => void
  setRenameModal: (open: boolean) => void
  setHelpModal: (open: boolean) => void
}

const MAX_LOG = 200

export const useGameStore = create<GameState>((set, get) => ({
  token: null, playerId: null, displayName: '',
  room: null, log: [], stats: null, inventory: [], skills: [], quests: [],
  inCombat: false, combatEnemy: null, lastRound: null,
  dialogOpen: false, dialogNpc: null, dialogText: '',
  renameModalOpen: false, helpModalOpen: false, roomSummaries: [],

  setAuth: (token, playerId, displayName) => set({ token, playerId, displayName }),
  setDisplayName: (name) => set({ displayName: name }),
  setRoomSummaries: (s) => set({ roomSummaries: s }),
  hydrateFromSnapshot: (snapshot) => {
    const stats = snapshot.state ? {
      qi: snapshot.state.qi,
      maxQi: snapshot.state.max_qi,
      jing: snapshot.state.jing,
      maxJing: snapshot.state.max_jing,
      neili: snapshot.state.neili,
      maxNeili: snapshot.state.max_neili,
      combatExp: snapshot.state.combat_exp,
      money: snapshot.state.money,
      shen: snapshot.state.shen,
    } as PlayerStatsPayload : null

    const inventory = snapshot.inventory.map(i => ({
      id: i.id,
      itemId: i.item_id,
      name: i.item_id,
      quantity: i.quantity,
      slot: i.slot,
    }))

    const skills = snapshot.skills.map(s => ({
      skillId: s.skill_id,
      level: s.level,
      nameCN: s.skill_id,
      martialType: 'other',
    }))

    const quests = snapshot.quests.map(q => ({
      questId: q.quest_id,
      description: describeQuest(q.quest_id, q.assigned_npc),
      status: q.status === 'completed' ? 'completed' as const : 'active' as const,
      assignedNpc: q.assigned_npc ?? undefined,
    }))

    set({ stats, inventory, skills, quests })
  },
  openDialog: (id, name) => set({ dialogOpen: true, dialogNpc: { id, name }, dialogText: '' }),
  closeDialog: () => set({ dialogOpen: false }),
  setRenameModal: (open) => set({ renameModalOpen: open }),
  setHelpModal: (open) => set({ helpModalOpen: open }),

  handleServerEvent: (event) => {
    const { type, payload } = event
    switch (type) {
      case 'ROOM_ENTER':
        set({ room: payload as RoomPayload, inCombat: false, combatEnemy: null }); break
      case 'LOG': {
        const incoming = (payload as { messages: LogEntry[] }).messages
        set(s => ({ log: [...s.log, ...incoming].slice(-MAX_LOG) })); break
      }
      case 'STAT_UPDATE':
        set(s => ({ stats: { ...(s.stats ?? {} as PlayerStatsPayload), ...(payload as Partial<PlayerStatsPayload>) } })); break
      case 'INVENTORY_UPDATE':
        set({ inventory: (payload as { items: InventoryItem[] }).items }); break
      case 'COMBAT_START': {
        const { enemyId: id, enemyName: name, enemyQi, enemyMaxQi } = payload as { enemyId: string; enemyName: string; enemyQi?: number; enemyMaxQi?: number }
        const maxQi = Math.max(1, Number(enemyMaxQi ?? 100))
        const qi = Math.max(0, Math.min(Number(enemyQi ?? maxQi), maxQi))
        const qiRatio = Math.max(0, Math.min(100, Math.round((qi / maxQi) * 100)))
        set({ inCombat: true, combatEnemy: { id, name, qiRatio, qi, maxQi } }); break
      }
      case 'COMBAT_ROUND': {
        const round = payload as CombatRoundPayload
        set(s => ({
          lastRound: round,
          combatEnemy: s.combatEnemy ? {
            ...s.combatEnemy,
            qiRatio: round.enemyQiRatio,
            qi: Number(round.enemyQi ?? s.combatEnemy.qi),
            maxQi: Number(round.enemyMaxQi ?? s.combatEnemy.maxQi),
          } : null,
          log: [...s.log, { timestamp: Date.now(), category: 'combat' as const, text: round.message }].slice(-MAX_LOG),
        })); break
      }
      case 'COMBAT_END':
        set({ inCombat: false, combatEnemy: null, lastRound: null }); break
      case 'DIALOG': {
        const { npcName, text } = payload as { npcName: string; text: string }
        set(s => ({
          dialogOpen: true,
          dialogText: text,
          dialogNpc: s.dialogNpc ?? { id: '', name: npcName },
        })); break
      }
      case 'SKILL_UPDATE': {
        const { skillId, level } = payload as { skillId: string; level: number }
        set(s => ({ skills: s.skills.map(sk => sk.skillId === skillId ? { ...sk, level } : sk) })); break
      }
      case 'QUEST_ASSIGNED': {
        const { questId, description } = payload as QuestAssignedPayload
        set(s => {
          const without = s.quests.filter(q => q.questId !== questId)
          return {
            quests: [{ questId, description, status: 'active' as const }, ...without],
            log: [...s.log, { timestamp: Date.now(), category: 'quest' as const, text: `接取任務：${description}` }].slice(-MAX_LOG),
          }
        })
        break
      }
      case 'QUEST_COMPLETE': {
        const { questId, reward } = payload as QuestCompletePayload
        set(s => ({
          quests: s.quests.map(q => q.questId === questId ? { ...q, status: 'completed' as const, reward } : q),
          log: [...s.log, { timestamp: Date.now(), category: 'quest' as const, text: `任務完成：${questId}（${reward}）` }].slice(-MAX_LOG),
        }))
        break
      }
    }
  },
}))
