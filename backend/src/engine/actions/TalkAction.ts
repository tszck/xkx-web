import type { GameSession } from '../GameSession'
import { worldLoader } from '../world/WorldLoader'

export class TalkAction {
  execute(session: GameSession, payload: { npcId: string; topic?: string }) {
    const room = session.currentRoom
    if (!room) return

    const npc = room.npcs.get(payload.npcId)
    if (!npc || !npc.alive) {
      session.sendLog('找不到此人。', 'npc'); return
    }

    const topic = payload.topic?.toLowerCase().trim() ?? ''

    // Shop flow
    if (npc.def.type === 'shop' || npc.def.type === 'waiter') {
      if (!topic || topic === 'list' || topic === '買' || topic === 'buy') {
        const items = (npc.def.shopItems ?? []).map(id => {
          const def = worldLoader.getItem(id)
          return def ? `${def.name}（${def.value} 文）` : id
        }).join('、')
        session.send({ type: 'DIALOG', payload: { npcName: npc.def.name, text: items ? `本店出售：${items}` : '本店暫無貨物。' } })
        return
      }
    }

    // Inquiry topics from NPC def
    if (topic && npc.def.inquiryTopics[topic]) {
      session.send({ type: 'DIALOG', payload: { npcName: npc.def.name, text: npc.def.inquiryTopics[topic] } })
      return
    }

    // Random chat messages
    const chats = npc.def.chatMessages
    if (chats.length > 0) {
      const text = chats[Math.floor(Math.random() * chats.length)]
      session.send({ type: 'DIALOG', payload: { npcName: npc.def.name, text } })
      return
    }

    const fallback: Record<string, string> = {
      friendly: '「有何貴幹？」',
      neutral:  '對方似乎不想和你說話。',
      hostile:  '「找死！」',
    }
    session.send({ type: 'DIALOG', payload: { npcName: npc.def.name, text: fallback[npc.def.attitude] ?? '……' } })
  }
}
