import { create } from 'zustand'
import type { ServerEvent, RoomPayload, LogEntry, PlayerStatsPayload, InventoryItem, CombatRoundPayload, SkillPayload } from '../ws/messageTypes'

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
  // Combat
  inCombat: boolean
  combatEnemy: { id: string; name: string; qiRatio: number } | null
  lastRound: CombatRoundPayload | null
  // Dialog
  dialogOpen: boolean
  dialogNpc: { id: string; name: string } | null
  dialogText: string
  // UI
  renameModalOpen: boolean
  // Minimap room summaries (loaded once)
  roomSummaries: Array<{ id: string; short: string; coords?: { x: number; y: number } }>

  // Actions
  setAuth: (token: string, playerId: number, displayName: string) => void
  setDisplayName: (name: string) => void
  setRoomSummaries: (s: GameState['roomSummaries']) => void
  handleServerEvent: (event: ServerEvent) => void
  openDialog: (npcId: string, npcName: string) => void
  closeDialog: () => void
  setRenameModal: (open: boolean) => void
}

const MAX_LOG = 200

export const useGameStore = create<GameState>((set, get) => ({
  token: null, playerId: null, displayName: '',
  room: null, log: [], stats: null, inventory: [], skills: [],
  inCombat: false, combatEnemy: null, lastRound: null,
  dialogOpen: false, dialogNpc: null, dialogText: '',
  renameModalOpen: false, roomSummaries: [],

  setAuth: (token, playerId, displayName) => set({ token, playerId, displayName }),
  setDisplayName: (name) => set({ displayName: name }),
  setRoomSummaries: (s) => set({ roomSummaries: s }),
  openDialog: (id, name) => set({ dialogOpen: true, dialogNpc: { id, name }, dialogText: '' }),
  closeDialog: () => set({ dialogOpen: false }),
  setRenameModal: (open) => set({ renameModalOpen: open }),

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
        const { enemyId: id, enemyName: name } = payload as { enemyId: string; enemyName: string }
        set({ inCombat: true, combatEnemy: { id, name, qiRatio: 100 } }); break
      }
      case 'COMBAT_ROUND': {
        const round = payload as CombatRoundPayload
        set(s => ({
          lastRound: round,
          combatEnemy: s.combatEnemy ? { ...s.combatEnemy, qiRatio: round.enemyQiRatio } : null,
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
    }
  },
}))
