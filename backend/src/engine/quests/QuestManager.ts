import type { GameSession } from '../GameSession'
import { pool } from '../../db/pool'
import { dynamicQuest } from './DynamicQuest'

// TODO: Implement dynamic quest generation based on combat_exp brackets
// Reference: /root/projects/xkx/adm/daemons/questd.c and /quest/dynamic_quest
// Main quest and side quests will be provided by user and implemented here.

export class QuestManager {
  async assignQuest(session: GameSession, questId: string, npcId: string, description: string) {
    await pool.query(
      `INSERT INTO player_quests (player_id, quest_id, assigned_npc) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [session.playerId, questId, npcId]
    )
    session.send({ type: 'QUEST_ASSIGNED', payload: { questId, description } })
  }

  async completeQuest(session: GameSession, questId: string, rewardText: string) {
    await pool.query(
      `UPDATE player_quests SET status='completed', completed_at=now()
       WHERE player_id=$1 AND quest_id=$2`,
      [session.playerId, questId]
    )
    session.send({ type: 'QUEST_COMPLETE', payload: { questId, reward: rewardText } })
  }

  async hasQuest(session: GameSession, questId: string): Promise<boolean> {
    const r = await pool.query(
      `SELECT 1 FROM player_quests WHERE player_id=$1 AND quest_id=$2 AND status='active'`,
      [session.playerId, questId]
    )
    return r.rowCount! > 0
  }

  async hasCompleted(session: GameSession, questId: string): Promise<boolean> {
    const r = await pool.query(
      `SELECT 1 FROM player_quests WHERE player_id=$1 AND quest_id=$2 AND status='completed'`,
      [session.playerId, questId]
    )
    return r.rowCount! > 0
  }

  async getActiveDynamicQuest(session: GameSession): Promise<{ questId: string; assignedNpc: string | null } | null> {
    const r = await pool.query<{ quest_id: string; assigned_npc: string | null }>(
      `SELECT quest_id, assigned_npc
       FROM player_quests
       WHERE player_id=$1 AND status='active' AND quest_id LIKE 'dyn_hunt:%'
       ORDER BY started_at DESC
       LIMIT 1`,
      [session.playerId]
    )
    if (!r.rows[0]) return null
    return { questId: r.rows[0].quest_id, assignedNpc: r.rows[0].assigned_npc }
  }

  async completeNpcKillQuests(session: GameSession, npcDefId: string, npcName: string, npcCombatExp: number) {
    const active = await pool.query<{ quest_id: string }>(
      `SELECT quest_id
       FROM player_quests
       WHERE player_id=$1 AND status='active' AND assigned_npc=$2`,
      [session.playerId, npcDefId]
    )
    if (active.rowCount === 0) return

    const { rewardXp, rewardScore } = dynamicQuest.getKillReward(npcCombatExp)
    session.state.combatExp += rewardXp
    session.state.shen += rewardScore
    session.send({ type: 'STAT_UPDATE', payload: session.state.toStatPayload() })

    for (const row of active.rows) {
      await this.completeQuest(session, row.quest_id, `獲得 ${rewardXp} 經驗、${rewardScore} 聲望`) 
      session.sendLog(`任務完成：你擊敗了${npcName}。`, 'quest')
    }
  }
}

export const questManager = new QuestManager()
