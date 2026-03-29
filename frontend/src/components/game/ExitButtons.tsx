import { useGameStore } from '../../store'
import type { ClientActionType } from '../../ws/messageTypes'
import './ExitButtons.css'

interface Props { dispatch: (type: ClientActionType, payload?: unknown) => void }

const DIRS = [
  ['northwest','西北'], ['north','北'], ['northeast','東北'],
  ['west','西'],        ['',    ''],    ['east','東'],
  ['southwest','西南'], ['south','南'], ['southeast','東南'],
]
const VERT = [['up','上'],['down','下']]

export default function ExitButtons({ dispatch }: Props) {
  const room = useGameStore(s => s.room)
  const exits = room?.exits ?? {}
  const move = (dir: string) => dispatch('MOVE', { direction: dir })

  return (
    <div className="exit-wrap box">
      <div className="compass">
        {DIRS.map(([dir, label]) => dir ? (
          <button key={dir} disabled={!exits[dir]} onClick={() => move(dir)}
            className={`exit-btn ${exits[dir] ? 'active' : ''}`}>{label}</button>
        ) : <span key="c" className="compass-center">·</span>)}
      </div>
      <div className="vert-exits">
        {VERT.map(([dir, label]) => (
          <button key={dir} disabled={!exits[dir]} onClick={() => move(dir)}
            className={`exit-btn vert ${exits[dir] ? 'active' : ''}`}>{label}</button>
        ))}
      </div>
    </div>
  )
}
