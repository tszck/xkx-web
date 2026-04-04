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
const BASE_EXIT_KEYS = new Set([...DIRS.map(([d]) => d).filter(Boolean), ...VERT.map(([d]) => d)])

function labelForExit(dir: string) {
  const map: Record<string, string> = {
    in: '內',
    out: '外',
    enter: '入',
    leave: '離',
    eastup: '東上',
    eastdown: '東下',
    westup: '西上',
    westdown: '西下',
    southup: '南上',
    southdown: '南下',
    northup: '北上',
    northdown: '北下',
  }
  return map[dir] ?? dir
}

export default function ExitButtons({ dispatch }: Props) {
  const room = useGameStore(s => s.room)
  const exits = room?.exits ?? {}
  const move = (dir: string) => dispatch('MOVE', { direction: dir })
  const extraExits = Object.keys(exits).filter(d => !BASE_EXIT_KEYS.has(d))

  return (
    <div className="exit-wrap box">
      <div className="compass">
        {DIRS.map(([dir, label]) => dir ? (
          <button key={dir} disabled={!exits[dir]} onClick={() => move(dir)}
            title={`MUD 指令: ${dir}`}
            className={`exit-btn ${exits[dir] ? 'active' : ''}`}>{label}</button>
        ) : <span key="c" className="compass-center">·</span>)}
      </div>
      <div className="vert-exits">
        {VERT.map(([dir, label]) => (
          <button key={dir} disabled={!exits[dir]} onClick={() => move(dir)}
            title={`MUD 指令: ${dir}`}
            className={`exit-btn vert ${exits[dir] ? 'active' : ''}`}>{label}</button>
        ))}
      </div>
      {extraExits.length > 0 && (
        <div className="extra-exits">
          {extraExits.map(dir => (
            <button key={dir} title={`MUD 指令: ${dir}`} onClick={() => move(dir)} className="extra-exit-btn">
              {labelForExit(dir)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
