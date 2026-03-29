import type { ClientActionType } from '../../ws/messageTypes'
import InventoryPanel from '../player/InventoryPanel'
import SkillPanel from '../player/SkillPanel'
import './RightPanel.css'

interface Props {
  dispatch: (type: ClientActionType, payload?: unknown) => void
}

export default function RightPanel({ dispatch }: Props) {
  return (
    <div className="right-panel">
      <InventoryPanel dispatch={dispatch} />
      <SkillPanel />
    </div>
  )
}
