import { useGameStore } from '../../store'
import type { NpcSummary, ClientActionType } from '../../ws/messageTypes'

interface Props {
  npcs: NpcSummary[]
  dispatch: (type: ClientActionType, payload?: unknown) => void
}

export default function NpcList({ npcs, dispatch }: Props) {
  const { openDialog, inCombat } = useGameStore()
  const alive = npcs.filter(n => n.alive)
  if (alive.length === 0) return null

  return (
    <div style={{ marginTop:8, borderTop:'1px solid var(--border)', paddingTop:6 }}>
      {alive.map(npc => (
        <div key={npc.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'2px 0', fontSize:13 }}>
          <span style={{ color: npc.attitude === 'hostile' ? 'var(--red)' : npc.attitude === 'friendly' ? 'var(--green)' : 'var(--text)' }}>
            {npc.name}
          </span>
          {!inCombat && (
            <>
              {npc.attitude !== 'hostile' && (
                <button style={{ fontSize:11, padding:'1px 6px' }} title={`MUD 指令: talk ${npc.name}`}
                  onClick={() => openDialog(npc.id, npc.name)}>交談</button>
              )}
              <button style={{ fontSize:11, padding:'1px 6px', color:'var(--red)', borderColor:'#662222' }} title={`MUD 指令: attack ${npc.name} / fight ${npc.name}`}
                onClick={() => dispatch('ATTACK', { targetId: npc.id })}>攻擊</button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
