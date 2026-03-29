import StatsPanel from '../player/StatsPanel'
import MiniMap from '../player/MiniMap'
import './LeftPanel.css'

export default function LeftPanel() {
  return (
    <div className="left-panel">
      <StatsPanel />
      <MiniMap />
    </div>
  )
}
