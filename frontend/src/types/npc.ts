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
  type?: 'shop' | 'waiter' | 'trainer' | 'npc'
}
