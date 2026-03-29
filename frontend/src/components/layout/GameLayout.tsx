import type { ClientActionType } from '../../ws/messageTypes'
import LeftPanel from './LeftPanel'
import CenterPanel from './CenterPanel'
import RightPanel from './RightPanel'
import './GameLayout.css'

interface Props {
  dispatch: (type: ClientActionType, payload?: unknown) => void
}

export default function GameLayout({ dispatch }: Props) {
  return (
    <div className="game-layout">
      <LeftPanel />
      <CenterPanel dispatch={dispatch} />
      <RightPanel dispatch={dispatch} />
    </div>
  )
}
