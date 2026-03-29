import { useEffect, useRef } from 'react'
import { useGameStore } from '../../store'
import './EventLog.css'

export default function EventLog() {
  const log = useGameStore(s => s.log)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [log.length])

  return (
    <div className="box event-log">
      <div className="box-title">訊息記錄</div>
      <div className="log-entries">
        {log.map((entry, i) => (
          <div key={i} className={`log-entry log-${entry.category}`}>
            <span className="log-cat">[{catLabel(entry.category)}]</span> {entry.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

function catLabel(cat: string): string {
  const map: Record<string, string> = { move:'移動', combat:'戰鬥', system:'系統', npc:'人物', item:'物品', quest:'任務' }
  return map[cat] ?? cat
}
