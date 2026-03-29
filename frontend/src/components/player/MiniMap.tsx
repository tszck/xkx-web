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

  if (!room?.coords || roomSummaries.length === 0) return null

  const cx = room.coords.x, cy = room.coords.y
  const R = 5  // radius of cells to show
  const CELL = 16

  // Build grid
  const grid: Record<string, string> = {}
  for (const r of roomSummaries) {
    if (!r.coords) continue
    const dx = r.coords.x - cx, dy = r.coords.y - cy
    if (Math.abs(dx) <= R && Math.abs(dy) <= R) {
      grid[`${dx},${dy}`] = r.id === room.roomId ? 'current' : 'room'
    }
  }

  return (
    <div className="box" style={{ flexShrink:0 }}>
      <div className="box-title">地圖</div>
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
    </div>
  )
}
