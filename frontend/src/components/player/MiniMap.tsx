import { useEffect } from 'react'
import { useGameStore } from '../../store'
import { apiFetch } from '../../api/client'

export default function MiniMap() {
  const { room, roomSummaries, setRoomSummaries } = useGameStore()

  useEffect(() => {
    if (roomSummaries.length === 0) {
      apiFetch<typeof roomSummaries>('/world/rooms').then(setRoomSummaries).catch(() => {})
    }
  }, [roomSummaries.length, setRoomSummaries])

  if (!room || roomSummaries.length === 0) return null

  const summaryMap = new Map(roomSummaries.map(r => [r.id, r]))
  const exitList = Object.entries(room.exits)

  if (!room.coords) {
    return (
      <div className="box" style={{ flexShrink: 0 }}>
        <div className="box-title">地圖</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>此區域無座標地圖，顯示出口資訊。</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {exitList.map(([dir, target]) => {
            const targetShort = summaryMap.get(target)?.short ?? target
            return (
              <div key={dir} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: 'var(--accent)' }}>{dir}</span>
                <span style={{ color: 'var(--text-dim)' }}>{targetShort}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const cx = room.coords.x, cy = room.coords.y
  const R = 7
  const CELL = 14

  // Build grid
  const grid: Record<string, string> = {}
  for (const r of roomSummaries) {
    if (!r.coords) continue
    const dx = r.coords.x - cx, dy = r.coords.y - cy
    if (Math.abs(dx) <= R && Math.abs(dy) <= R) {
      grid[`${dx},${dy}`] = r.id === room.roomId ? 'current' : 'room'
    }
  }

  const nearby = roomSummaries
    .filter(r => r.coords)
    .map(r => ({
      id: r.id,
      short: r.short,
      dx: (r.coords?.x ?? 0) - cx,
      dy: (r.coords?.y ?? 0) - cy,
    }))
    .filter(r => Math.abs(r.dx) <= 2 && Math.abs(r.dy) <= 2 && !(r.dx === 0 && r.dy === 0))
    .sort((a, b) => Math.abs(a.dx) + Math.abs(a.dy) - (Math.abs(b.dx) + Math.abs(b.dy)))
    .slice(0, 6)

  return (
    <div className="box" style={{ flexShrink:0 }}>
      <div className="box-title">地圖</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
        目前位置：{room.short} ({cx},{cy})
      </div>
      <div style={{ position:'relative', width:(2*R+1)*CELL, height:(2*R+1)*CELL, background:'#0a0a0a', overflow:'hidden' }}>
        {Object.entries(grid).map(([key, type]) => {
          const [dx, dy] = key.split(',').map(Number)
          return (
            <div key={key} style={{
              position:'absolute',
              left: (dx + R) * CELL + 2, top: (R - dy) * CELL + 2,
              width: CELL - 3, height: CELL - 3,
              background: type === 'current' ? 'var(--accent)' : '#2a2a2a',
              border: type === 'current' ? 'none' : '1px solid #333',
              borderRadius: 1,
            }} />
          )
        })}
      </div>
      {nearby.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {nearby.map(r => (
            <div key={r.id} style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {r.short} ({r.dx >= 0 ? `+${r.dx}` : r.dx},{r.dy >= 0 ? `+${r.dy}` : r.dy})
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
