import type { GameSession } from '../GameSession'
import { MoveAction } from './MoveAction'
import { AttackAction } from './AttackAction'
import { TalkAction } from './TalkAction'
import { ItemAction } from './ItemAction'
import { TrainAction } from './TrainAction'
import { buildLookActionHint } from './RawActionCatalog'

export type ClientAction =
  | { type: 'MOVE';        payload: { direction: string } }
  | { type: 'ATTACK';      payload: { targetId: string } }
  | { type: 'FLEE' }
  | { type: 'TALK';        payload: { npcId: string; topic?: string } }
  | { type: 'GET_ITEM';    payload: { itemId: string } }
  | { type: 'DROP_ITEM';   payload: { itemId: string } }
  | { type: 'USE_ITEM';    payload: { itemId: string } }
  | { type: 'EQUIP_ITEM';  payload: { itemId: string } }
  | { type: 'LOOK';        payload?: { target?: string } }
  | { type: 'TRAIN_SKILL'; payload: { skillId: string; npcId: string } }
  | { type: 'REST' }
  | { type: 'PING' }

const move = new MoveAction()
const attack = new AttackAction()
const talk = new TalkAction()
const item = new ItemAction()
const train = new TrainAction()

export class ActionHandler {
  async handle(session: GameSession, action: ClientAction) {
    switch (action.type) {
      case 'PING':
        session.send({ type: 'PONG' }); break
      case 'MOVE':
        await move.execute(session, action.payload); break
      case 'ATTACK':
        attack.execute(session, action.payload)
        await session.logAction('ATTACK', { targetId: action.payload.targetId }, 'OK')
        break
      case 'FLEE':
        attack.flee(session)
        await session.logAction('FLEE', {}, 'OK')
        break
      case 'TALK':
        await talk.execute(session, action.payload)
        await session.logAction('TALK', { npcId: action.payload.npcId, topic: action.payload.topic ?? null }, 'OK')
        break
      case 'GET_ITEM':
        await item.get(session, action.payload)
        await session.logAction('GET_ITEM', { itemId: action.payload.itemId }, 'OK')
        break
      case 'DROP_ITEM':
        await item.drop(session, action.payload)
        await session.logAction('DROP_ITEM', { itemId: action.payload.itemId }, 'OK')
        break
      case 'USE_ITEM':
        await item.use(session, action.payload)
        await session.logAction('USE_ITEM', { itemId: action.payload.itemId }, 'OK')
        break
      case 'EQUIP_ITEM':
        await item.equip(session, action.payload)
        await session.logAction('EQUIP_ITEM', { itemId: action.payload.itemId }, 'OK')
        break
      case 'LOOK':
        if (session.currentRoom) {
          session.send({ type: 'ROOM_ENTER', payload: session.currentRoom.toPayload() })
          session.sendLog(buildLookActionHint(session), 'system')
        }
        await session.logAction('LOOK', { target: action.payload?.target ?? null }, 'OK')
        break
      case 'TRAIN_SKILL':
        await train.execute(session, action.payload)
        await session.logAction('TRAIN_SKILL', { skillId: action.payload.skillId, npcId: action.payload.npcId }, 'OK')
        break
      case 'REST':
        session.state.heal(Math.floor(session.state.maxQi * 0.1))
        session.send({ type: 'STAT_UPDATE', payload: session.state.toStatPayload() })
        session.sendLog('你靜心調息，恢復了一些氣血。', 'system')
        await session.logAction('REST', {}, 'OK')
        break
      default:
        session.send({ type: 'ERROR', payload: { code: 'UNKNOWN_ACTION', message: '未知指令' } })
    }
  }
}
