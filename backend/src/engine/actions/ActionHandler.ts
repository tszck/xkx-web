import type { GameSession } from '../GameSession'
import { MoveAction } from './MoveAction'
import { AttackAction } from './AttackAction'
import { TalkAction } from './TalkAction'
import { ItemAction } from './ItemAction'
import { TrainAction } from './TrainAction'

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
  handle(session: GameSession, action: ClientAction) {
    switch (action.type) {
      case 'PING':
        session.send({ type: 'PONG' }); break
      case 'MOVE':
        move.execute(session, action.payload); break
      case 'ATTACK':
        attack.execute(session, action.payload); break
      case 'FLEE':
        attack.flee(session); break
      case 'TALK':
        talk.execute(session, action.payload); break
      case 'GET_ITEM':
        item.get(session, action.payload); break
      case 'DROP_ITEM':
        item.drop(session, action.payload); break
      case 'USE_ITEM':
        item.use(session, action.payload); break
      case 'EQUIP_ITEM':
        item.equip(session, action.payload); break
      case 'LOOK':
        if (session.currentRoom) {
          session.send({ type: 'ROOM_ENTER', payload: session.currentRoom.toPayload() })
        }
        break
      case 'TRAIN_SKILL':
        train.execute(session, action.payload); break
      case 'REST':
        session.state.heal(Math.floor(session.state.maxQi * 0.1))
        session.send({ type: 'STAT_UPDATE', payload: session.state.toStatPayload() })
        session.sendLog('你靜心調息，恢復了一些氣血。', 'system')
        break
      default:
        session.send({ type: 'ERROR', payload: { code: 'UNKNOWN_ACTION', message: '未知指令' } })
    }
  }
}
