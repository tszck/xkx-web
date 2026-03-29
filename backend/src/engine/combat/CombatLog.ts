// Structured combat log helpers
export type LogCategory = 'move' | 'combat' | 'system' | 'npc' | 'item' | 'quest'

export interface LogEntry {
  timestamp: number
  category: LogCategory
  text: string
}

export function makeLog(text: string, category: LogCategory = 'combat'): LogEntry {
  return { timestamp: Date.now(), category, text }
}
