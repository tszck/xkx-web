import { useMemo, useState } from 'react'
import './GuestWelcome.css'

const STAT_KEYS = ['str', 'con', 'dex', 'int_stat', 'per', 'kar', 'sta', 'spi'] as const
const STAT_LABELS: Record<(typeof STAT_KEYS)[number], string> = {
  str: '臂力', con: '根骨', dex: '身法', int_stat: '悟性',
  per: '容貌', kar: '福緣', sta: '體質', spi: '精神',
}
const BASE_STAT = 10
const BONUS_BUDGET = 30

type RegisterStats = Record<(typeof STAT_KEYS)[number], number>

interface Props {
  onGuest: () => void
  onLogin: (username: string, password: string) => void
  onRegister: (payload: { username: string; password: string; displayName: string; stats: RegisterStats }) => void
  loading?: boolean
  error?: string | null
}

const ASCII_TITLE = `
 ╔══════════════════════════════╗
 ║          俠  客  行          ║
 ╚══════════════════════════════╝`

export default function GuestWelcome({ onGuest, onLogin, onRegister, loading = false, error }: Props) {
  const [mode, setMode] = useState<'login' | 'register' | 'guest'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [stats, setStats] = useState<RegisterStats>({
    str: 14, con: 14, dex: 14, int_stat: 14, per: 12, kar: 12, sta: 10, spi: 10,
  })

  const remaining = useMemo(() => {
    const used = STAT_KEYS.reduce((sum, key) => sum + (stats[key] - BASE_STAT), 0)
    return BONUS_BUDGET - used
  }, [stats])

  const adjustStat = (key: (typeof STAT_KEYS)[number], delta: number) => {
    setStats(prev => {
      const next = prev[key] + delta
      if (next < BASE_STAT || next > 25) return prev
      const used = STAT_KEYS.reduce((sum, k) => sum + (prev[k] - BASE_STAT), 0)
      const nextUsed = used + delta
      if (nextUsed < 0 || nextUsed > BONUS_BUDGET) return prev
      return { ...prev, [key]: next }
    })
  }

  const onSubmitLogin = () => {
    onLogin(username.trim(), password)
  }

  const onSubmitRegister = () => {
    if (remaining !== 0) return
    onRegister({ username: username.trim(), password, displayName: displayName.trim(), stats })
  }

  return (
    <div className="welcome-screen">
      <pre className="welcome-ascii">{ASCII_TITLE}</pre>
      <p className="welcome-sub">江湖路遠，浪跡天涯</p>
      <div className="welcome-tabs">
        <button disabled={loading} className={mode === 'login' ? 'primary' : ''} onClick={() => setMode('login')}>登入</button>
        <button disabled={loading} className={mode === 'register' ? 'primary' : ''} onClick={() => setMode('register')}>註冊</button>
        <button disabled={loading} className={mode === 'guest' ? 'primary' : ''} onClick={() => setMode('guest')}>訪客</button>
      </div>

      {mode !== 'guest' && (
        <div className="welcome-form box">
          <label>
            帳號
            <input disabled={loading} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="3-20 英文/數字/底線" />
          </label>
          <label>
            密碼
            <input disabled={loading} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 碼" />
          </label>

          {mode === 'register' && (
            <>
              <label>
                角色名
                <input disabled={loading} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="2-20 字" />
              </label>
              <div className="stats-box">
                <div className="stats-head">屬性分配（剩餘 {remaining}）</div>
                {STAT_KEYS.map((key) => (
                  <div key={key} className="stat-row">
                    <span>{STAT_LABELS[key]}</span>
                    <div className="stat-controls">
                      <button disabled={loading} onClick={() => adjustStat(key, -1)}>-</button>
                      <strong>{stats[key]}</strong>
                      <button disabled={loading} onClick={() => adjustStat(key, +1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'guest' && (
        <p className="welcome-desc">
          以訪客身份遊覽江湖，進度自動儲存。<br/>
          系統將為您分配一個武林代號。
        </p>
      )}

      {error && <p className="welcome-desc" style={{ color: 'var(--red)' }}>{error}</p>}

      {mode === 'login' && <button className="primary welcome-btn" disabled={loading} onClick={onSubmitLogin}>登入江湖</button>}
      {mode === 'register' && <button className="primary welcome-btn" disabled={loading || remaining !== 0} onClick={onSubmitRegister}>建立角色</button>}
      {mode === 'guest' && <button className="primary welcome-btn" disabled={loading} onClick={onGuest}>訪客進入</button>}
    </div>
  )
}
