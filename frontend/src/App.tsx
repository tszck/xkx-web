import { useEffect, useState } from 'react'
import { useGameStore } from './store'
import { createGuestSession, getMe, loginAccount, registerAccount } from './api/auth'
import { getToken } from './api/client'
import { getPlayerState } from './api/player'
import { useGameSocket } from './ws/useGameSocket'
import GuestWelcome from './components/auth/GuestWelcome'
import GameLayout from './components/layout/GameLayout'
import RenameModal from './components/auth/RenameModal'
import NpcDialog from './components/npc/NpcDialog'

export default function App() {
  const { token, setAuth, hydrateFromSnapshot, renameModalOpen, dialogOpen } = useGameStore()
  const [loading, setLoading] = useState(true)
  const [startupError, setStartupError] = useState<string | null>(null)
  const { dispatch } = useGameSocket(token)

  const hydrate = async () => {
    try {
      const snapshot = await getPlayerState()
      hydrateFromSnapshot(snapshot)
    } catch {
      // Ignore API hydration errors; WS events will still drive live state.
    }
  }

  useEffect(() => {
    const init = async () => {
      setStartupError(null)
      try {
        const existing = getToken()
        if (existing) {
          const me = await getMe()
          if (me) {
            setAuth(me.token, me.playerId, me.displayName)
            await hydrate()
            setLoading(false)
            return
          }
        }
      } catch (err) {
        setStartupError(err instanceof Error ? err.message : '前端部署設定錯誤，無法連線到後端。')
      }
      setLoading(false)
    }
    init()
  }, [hydrateFromSnapshot, setAuth])

  const handleStart = async () => {
    setLoading(true)
    try {
      const res = await createGuestSession()
      setAuth(res.token, res.playerId, res.displayName)
      await hydrate()
    } catch (err) {
      setStartupError(err instanceof Error ? err.message : '無法建立訪客帳號，請確認後端與 API URL 設定。')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (username: string, password: string) => {
    setLoading(true)
    setStartupError(null)
    try {
      const res = await loginAccount(username, password)
      setAuth(res.token, res.playerId, res.displayName)
      await hydrate()
    } catch (err) {
      setStartupError(err instanceof Error ? err.message : '登入失敗')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (payload: {
    username: string
    password: string
    displayName: string
    stats: { str: number; con: number; dex: number; int_stat: number; per: number; kar: number; sta: number; spi: number }
  }) => {
    setLoading(true)
    setStartupError(null)
    try {
      const res = await registerAccount(payload)
      setAuth(res.token, res.playerId, res.displayName)
      await hydrate()
    } catch (err) {
      setStartupError(err instanceof Error ? err.message : '註冊失敗')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">載入中…</div>
  if (!token) return (
    <GuestWelcome
      onGuest={handleStart}
      onLogin={handleLogin}
      onRegister={handleRegister}
      loading={loading}
      error={startupError}
    />
  )

  return (
    <>
      <GameLayout dispatch={dispatch} />
      {renameModalOpen && <RenameModal />}
      {dialogOpen && <NpcDialog dispatch={dispatch} />}
    </>
  )
}
