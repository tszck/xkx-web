import type { ClientActionType } from '../../ws/messageTypes'
import RoomView from '../game/RoomView'
import ExitButtons from '../game/ExitButtons'
import ActionBar from '../game/ActionBar'
import EventLog from '../game/EventLog'
import CombatHUD from '../game/CombatHUD'
import './CenterPanel.css'

interface Props {
  dispatch: (type: ClientActionType, payload?: unknown) => void
}

export default function CenterPanel({ dispatch }: Props) {
  return (
    <div className="center-panel">
      <RoomView dispatch={dispatch} />
      <CombatHUD dispatch={dispatch} />
      <ExitButtons dispatch={dispatch} />
      <ActionBar dispatch={dispatch} />
      <EventLog />
    </div>
  )
}
