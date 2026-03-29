import { useEffect, useState } from 'react'
import { useGameStore } from './store'
import { createGuestSession, getMe } from './api/auth'
import { getToken } from './api/client'
import { useGameSocket } from './ws/useGameSocket'
import GuestWelcome from './components/auth/GuestWelcome'
import GameLayout from './components/layout/GameLayout'
import RenameModal from './components/auth/RenameModal'
import NpcDialog from './components/npc/NpcDialog'

export default function App() {
  const { token, setAuth, renameModalOpen, dialogOpen } = useGameStore()
  const [loading, setLoading] = useState(true)
  const { dispatch } = useGameSocket(token)

  useEffect(() => {
    const init = async () => {
      const existing = getToken()
      if (existing) {
        const me = await getMe()
        if (me) { setAuth(me.token, me.playerId, me.displayName); setLoading(false); return }
      }
      setLoading(false)
    }
    init()
  }, [setAuth])

  const handleStart = async () => {
    setLoading(true)
    const res = await createGuestSession()
    setAuth(res.token, res.playerId, res.displayName)
    setLoading(false)
  }

  if (loading) return <div className="loading">載入中…</div>
  if (!token) return <GuestWelcome onStart={handleStart} />

  return (
    <>
      <GameLayout dispatch={dispatch} />
      {renameModalOpen && <RenameModal />}
      {dialogOpen && <NpcDialog dispatch={dispatch} />}
    </>
  )
}
