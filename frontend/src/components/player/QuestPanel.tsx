import { useGameStore } from '../../store'

export default function QuestPanel() {
  const quests = useGameStore(s => s.quests)
  const active = quests.filter(q => q.status === 'active')
  const completed = quests.filter(q => q.status === 'completed').slice(0, 3)

  return (
    <div className="box" style={{ flexShrink: 0 }}>
      <div className="box-title">任務</div>
      {active.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>目前沒有進行中的任務</div>
      ) : (
        active.map(q => (
          <div key={q.questId} style={{ fontSize: 12, marginBottom: 4, lineHeight: 1.4 }}>
            <div style={{ color: 'var(--accent)' }}>進行中</div>
            <div>{q.description}</div>
          </div>
        ))
      )}

      {completed.length > 0 && (
        <div style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
          {completed.map(q => (
            <div key={q.questId} style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}>
              已完成：{q.description}{q.reward ? `（${q.reward}）` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
