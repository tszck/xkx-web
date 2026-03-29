import { useGameStore } from '../../store'
import type { ClientActionType } from '../../ws/messageTypes'

interface Props { dispatch: (type: ClientActionType, payload?: unknown) => void }

export default function CombatHUD({ dispatch: _d }: Props) {
  const { inCombat, combatEnemy, lastRound, stats } = useGameStore()
  if (!inCombat || !combatEnemy) return null

  const ratio = (n: number, max: number) => Math.max(0, Math.min(100, (n / (max || 1)) * 100))

  return (
    <div className="box" style={{ borderColor:'#883333', padding:'8px 10px' }}>
      <div style={{ color:'#cc8844', fontWeight:'bold', marginBottom:4 }}>⚔ 戰鬥中：{combatEnemy.name}</div>
      <div className="bar-wrap">
        <span className="bar-label">敵方</span>
        <div className="bar-track"><div className="bar-fill enemy" style={{ width:`${combatEnemy.qiRatio}%` }} /></div>
        <span className="bar-val">{combatEnemy.qiRatio}%</span>
      </div>
      {stats && (
        <div className="bar-wrap">
          <span className="bar-label">氣血</span>
          <div className="bar-track"><div className="bar-fill qi" style={{ width:`${ratio(stats.qi, stats.maxQi)}%` }} /></div>
          <span className="bar-val">{stats.qi}/{stats.maxQi}</span>
        </div>
      )}
      {lastRound && <div style={{ color:'#cc9966', fontSize:12, marginTop:4 }}>{lastRound.message}</div>}
    </div>
  )
}
