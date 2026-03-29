import { useGameStore } from '../../store'
import type { ClientActionType } from '../../ws/messageTypes'

interface Props { dispatch: (type: ClientActionType, payload?: unknown) => void }

export default function ActionBar({ dispatch }: Props) {
  const { inCombat, room } = useGameStore()

  if (inCombat) return (
    <div className="box" style={{ display:'flex', gap:'6px', padding:'6px 10px' }}>
      <button className="danger" onClick={() => dispatch('FLEE')}>逃跑</button>
      <button onClick={() => dispatch('LOOK')}>觀察</button>
    </div>
  )

  return (
    <div className="box" style={{ display:'flex', gap:'6px', flexWrap:'wrap', padding:'6px 10px' }}>
      <button onClick={() => dispatch('LOOK')}>察看</button>
      <button onClick={() => dispatch('REST')}>調息</button>
      {room?.npcs.filter(n => n.alive && n.attitude === 'hostile').map(n => (
        <button key={n.id} className="danger"
          onClick={() => dispatch('ATTACK', { targetId: n.id })}>攻擊 {n.name}</button>
      ))}
      {room?.npcs.filter(n => n.alive && n.attitude !== 'hostile').map(n => (
        <button key={n.id}
          onClick={() => useGameStore.getState().openDialog(n.id, n.name)}>交談 {n.name}</button>
      ))}
    </div>
  )
}
