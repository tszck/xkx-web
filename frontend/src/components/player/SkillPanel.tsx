import { useGameStore } from '../../store'

export default function SkillPanel() {
  const skills = useGameStore(s => s.skills)
  if (skills.length === 0) return (
    <div className="box" style={{ flexShrink:0 }}>
      <div className="box-title">武學</div>
      <div style={{ color:'var(--text-dim)', fontSize:12 }}>尚未習得任何武學</div>
    </div>
  )

  const grouped: Record<string, typeof skills> = {}
  for (const s of skills) {
    const g = s.martialType || 'other'
    grouped[g] = grouped[g] ?? []
    grouped[g].push(s)
  }

  return (
    <div className="box" style={{ overflow:'auto', flex:1 }}>
      <div className="box-title">武學</div>
      {Object.entries(grouped).map(([type, list]) => (
        <div key={type} style={{ marginBottom:8 }}>
          <div style={{ color:'var(--accent-dim)', fontSize:11, marginBottom:3 }}>{typeLabel(type)}</div>
          {list.map(s => (
            <div key={s.skillId} style={{ marginBottom:3 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <span>{s.nameCN}</span><span style={{ color:'var(--text-dim)' }}>{s.level}</span>
              </div>
              <div className="bar-track" style={{ height:4 }}>
                <div className="bar-fill neili" style={{ width:`${s.level}%` }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function typeLabel(t: string): string {
  const m: Record<string,string> = { force:'內功', strike:'招式', sword:'劍法', unarmed:'拳法', dodge:'身法', parry:'招架', 'other':'其他' }
  return m[t] ?? t
}
