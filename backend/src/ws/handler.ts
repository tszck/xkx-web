import type { GameSession } from '../engine/GameSession'
import type { ClientAction } from '../engine/actions/ActionHandler'
import { ActionHandler } from '../engine/actions/ActionHandler'

const actionHandler = new ActionHandler()
const lastAction = new WeakMap<object, number>()
const DEBOUNCE_MS = 500

export function handleMessage(session: GameSession, msg: unknown) {
  if (!msg || typeof msg !== 'object') return
  const action = msg as ClientAction

  // Debounce
  const now = Date.now()
  const last = lastAction.get(session) ?? 0
  if (now - last < DEBOUNCE_MS && action.type !== 'PING') return
  lastAction.set(session, now)

  void actionHandler.handle(session, action).catch((err) => {
    console.error('Action handler error:', err)
    session.send({ type: 'ERROR', payload: { code: 'ACTION_ERROR', message: '操作失敗' } })
  })
}
