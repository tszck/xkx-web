import { useGameStore } from '../../store'
import NpcList from '../npc/NpcList'
import type { ClientActionType } from '../../ws/messageTypes'
import './RoomView.css'

interface Props {
  dispatch: (type: ClientActionType, payload?: unknown) => void
}

export default function RoomView({ dispatch }: Props) {
  const room = useGameStore(s => s.room)
  if (!room) return <div className="box room-view"><span className="text-dim">連接中…</span></div>

  return (
    <div className="box room-view">
      <div className="room-short">【{room.short}】</div>
      <pre className="room-long">{room.long}</pre>
      {room.items.length > 0 && (
        <div className="room-items">
          {room.items.map(item => (
            <button key={item.itemId} className="item-chip"
              onClick={() => dispatch('GET_ITEM', { itemId: item.itemId })}>
              拾取 {item.itemId} ×{item.quantity}
            </button>
          ))}
        </div>
      )}
      <NpcList npcs={room.npcs} dispatch={dispatch} />
    </div>
  )
}
