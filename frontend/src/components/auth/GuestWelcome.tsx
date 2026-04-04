import './GuestWelcome.css'

interface Props { onStart: () => void; error?: string | null }

const ASCII_TITLE = `
 ╔══════════════════════════════╗
 ║          俠  客  行          ║
 ╚══════════════════════════════╝`

export default function GuestWelcome({ onStart, error }: Props) {
  return (
    <div className="welcome-screen">
      <pre className="welcome-ascii">{ASCII_TITLE}</pre>
      <p className="welcome-sub">江湖路遠，浪跡天涯</p>
      <p className="welcome-desc">
        以訪客身份遊覽江湖，進度自動儲存。<br/>
        系統將為您分配一個武林代號。
      </p>
      {error && <p className="welcome-desc" style={{ color: 'var(--red)' }}>{error}</p>}
      <button className="primary welcome-btn" onClick={onStart}>進入江湖</button>
    </div>
  )
}
