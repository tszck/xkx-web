import type { GameSession } from '../GameSession'
import { pool } from '../../db/pool'

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
}

export const questManager = new QuestManager()
