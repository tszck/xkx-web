import { useGameStore } from '../../store'

function Bar({ label, value, max, cls }: { label: string; value: number; max: number; cls: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="bar-wrap">
      <span className="bar-label">{label}</span>
      <div className="bar-track"><div className={`bar-fill ${cls}`} style={{ width:`${pct}%` }} /></div>
      <span className="bar-val">{value}/{max}</span>
    </div>
  )
}

export default function StatsPanel() {
  const { stats, displayName, setRenameModal } = useGameStore()

  return (
    <div className="box" style={{ flexShrink: 0 }}>
      <button
        type="button"
        className="box-title"
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          textAlign: 'left',
          padding: 0,
          cursor: 'pointer',
        }}
        onClick={() => setRenameModal(true)}
      >
        {displayName || '俠客'} [改名]
      </button>
      {stats ? (
        <>
          <Bar label="氣" value={stats.qi} max={stats.maxQi} cls="qi" />
          <Bar label="精" value={stats.jing} max={stats.maxJing} cls="jing" />
          <Bar label="力" value={stats.neili} max={stats.maxNeili} cls="neili" />
          <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:6 }}>
            經驗：{stats.combatExp.toLocaleString()}
            身家：{formatMoney(stats.money)}
          </div>
        </>
      ) : (
        <div style={{ color:'var(--text-dim)', fontSize:12 }}>載入中…</div>
      )}
    </div>
  )
}

function formatMoney(wen: number): string {
  if (wen >= 10000) return `${Math.floor(wen/10000)}兩金`
  if (wen >= 100) return `${Math.floor(wen/100)}兩銀`
  return `${wen}文`
}
