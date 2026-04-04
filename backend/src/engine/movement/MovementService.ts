import type { PoolClient } from 'pg'
import { pool } from '../../db/pool'
import type { GameSession } from '../GameSession'

const DIR_CN: Record<string, string> = {
  north: '北', south: '南', east: '東', west: '西',
  northeast: '東北', northwest: '西北', southeast: '東南', southwest: '西南',
  up: '上', down: '下', in: '内', out: '外',
}

type RoomPositionRow = { room_id: string }
type PlayerStateRow = { current_room: string }
type ExitRow = { to_room_id: string }

export class MovementService {
  async move(session: GameSession, direction: string) {
    const dir = direction.trim().toLowerCase()
    if (!dir) {
      session.send({ type: 'ERROR', payload: { code: 'BAD_DIRECTION', message: '方向錯誤' } })
      return
    }

    if (session.combatTarget) {
      await this.writeActionLog(session.playerId, 'MOVE', { direction: dir }, 'BLOCKED_COMBAT', { message: 'combat' })
      session.sendLog('你正在戰鬥中，無法移動！', 'system')
      return
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const positionResult = await client.query<RoomPositionRow>(
        'SELECT room_id FROM player_position WHERE player_id = $1 FOR UPDATE',
        [session.playerId]
      )

      let currentRoomId = positionResult.rows[0]?.room_id
      if (!currentRoomId) {
        const stateResult = await client.query<PlayerStateRow>(
          'SELECT current_room FROM player_state WHERE player_id = $1 FOR UPDATE',
          [session.playerId]
        )
        currentRoomId = stateResult.rows[0]?.current_room
        if (!currentRoomId) {
          throw new Error(`Missing current room for player ${session.playerId}`)
        }

        await client.query(
          'INSERT INTO player_position (player_id, room_id) VALUES ($1, $2) ON CONFLICT (player_id) DO NOTHING',
          [session.playerId, currentRoomId]
        )
      }

      const exitResult = await client.query<ExitRow>(
        'SELECT to_room_id FROM world_room_exits WHERE from_room_id = $1 AND direction = $2',
        [currentRoomId, dir]
      )

      const targetRoomId = exitResult.rows[0]?.to_room_id
      if (!targetRoomId) {
        await this.writeLogRow(client, session.playerId, 'MOVE', { direction: dir, fromRoomId: currentRoomId }, 'NO_EXIT', { fromRoomId: currentRoomId })
        await client.query('COMMIT')
        session.sendLog('這個方向沒有出路。', 'move')
        return
      }

      await client.query(
        'UPDATE player_position SET room_id = $2, revision = revision + 1, moved_at = now(), updated_at = now() WHERE player_id = $1',
        [session.playerId, targetRoomId]
      )
      await client.query(
        'UPDATE player_state SET current_room = $2, updated_at = now() WHERE player_id = $1',
        [session.playerId, targetRoomId]
      )

      await this.writeLogRow(client, session.playerId, 'MOVE', { direction: dir, fromRoomId: currentRoomId, toRoomId: targetRoomId }, 'OK', { fromRoomId: currentRoomId, toRoomId: targetRoomId })

      await client.query('COMMIT')
      const dirCN = DIR_CN[dir] ?? dir
      session.sendLog(`你向${dirCN}走去。`, 'move')
      session.enterRoom(targetRoomId)
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      console.error('Movement failed:', err)
      session.send({ type: 'ERROR', payload: { code: 'MOVE_FAILED', message: '移動失敗' } })
    } finally {
      client.release()
    }
  }

  private async writeActionLog(
    playerId: number,
    actionType: string,
    payload: Record<string, unknown>,
    resultCode: string,
    resultData: Record<string, unknown>
  ) {
    await pool.query(
      `INSERT INTO player_action_log (player_id, action_type, payload, result_code, result_data)
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb)`,
      [playerId, actionType, JSON.stringify(payload), resultCode, JSON.stringify(resultData)]
    )
  }

  private async writeLogRow(
    client: PoolClient,
    playerId: number,
    actionType: string,
    payload: Record<string, unknown>,
    resultCode: string,
    resultData: Record<string, unknown>
  ) {
    await client.query(
      `INSERT INTO player_action_log (player_id, action_type, payload, result_code, result_data)
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb)`,
      [playerId, actionType, JSON.stringify(payload), resultCode, JSON.stringify(resultData)]
    )
  }
}

export const movementService = new MovementService()