import type { GameSession } from '../GameSession'
import { worldLoader } from '../world/WorldLoader'
import { dynamicQuest } from '../quests/DynamicQuest'
import { questManager } from '../quests/QuestManager'

export class TalkAction {
  async execute(session: GameSession, payload: { npcId: string; topic?: string }) {
    const room = session.currentRoom
    if (!room) return

    const npc = room.npcs.get(payload.npcId)
    if (!npc || !npc.alive) {
      session.sendLog('找不到此人。', 'npc'); return
    }

    const topic = payload.topic?.toLowerCase().trim() ?? ''
    await session.setActionState('dialog', npc.def.id, { roomId: room.id, topic: topic || null })

    try {
      if (topic === 'quest' || topic === '任務' || topic === '任务') {
        await this.handleQuestTopic(session, npc.def.name)
        return
      }

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
    } finally {
      await session.clearActionState()
    }
  }

  private async handleQuestTopic(session: GameSession, npcName: string) {
    const qiRatio = session.state.maxQi > 0 ? session.state.qi / session.state.maxQi : 0
    const jingRatio = session.state.maxJing > 0 ? session.state.jing / session.state.maxJing : 0

    if (session.state.combatExp < 50) {
      session.send({ type: 'DIALOG', payload: { npcName, text: '你江湖歷練尚淺，先多走動練功，再來接委託。' } })
      return
    }
    if (qiRatio < 0.6 || jingRatio < 0.6) {
      session.send({ type: 'DIALOG', payload: { npcName, text: '你氣血未復，先調息再談任務。' } })
      return
    }

    const existing = await questManager.getActiveDynamicQuest(session)
    if (existing) {
      session.send({ type: 'DIALOG', payload: { npcName, text: '你手上已有任務，先完成再來。' } })
      return
    }

    const quest = dynamicQuest.generateHuntQuest(session)
    if (!quest) {
      session.send({ type: 'DIALOG', payload: { npcName, text: '最近沒有合適的委託，你先四處歷練吧。' } })
      return
    }

    await questManager.assignQuest(session, quest.questId, quest.targetNpcId, quest.description)
    session.send({ type: 'DIALOG', payload: { npcName, text: `委託給你：${quest.description}。完成後回報江湖消息。` } })
    session.sendLog(`接取任務：${quest.description}`, 'quest')
    session.sendLog(`任務提示：完成可得 ${quest.rewardXp} 經驗、${quest.rewardScore} 聲望。`, 'quest')
  }
}
