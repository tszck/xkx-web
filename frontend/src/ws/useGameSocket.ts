import { useEffect, useRef, useCallback } from 'react'
import type { ServerEvent, ClientActionType } from './messageTypes'
import { useGameStore } from '../store'

declare const __WS_URL__: string

export function useGameSocket(token: string | null) {
  const ws = useRef<WebSocket | null>(null)
  const { handleServerEvent } = useGameStore()

  const dispatch = useCallback((type: ClientActionType, payload?: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(payload ? { type, payload } : { type }))
    }
  }, [])

  useEffect(() => {
    if (!token) return

    const url = `${__WS_URL__}?token=${encodeURIComponent(token)}`
    const socket = new WebSocket(url)
    ws.current = socket

    socket.onopen = () => {
      console.log('WS connected')
      socket.send(JSON.stringify({ type: 'PING' }))
    }

    socket.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as ServerEvent
        handleServerEvent(event)
      } catch { /* ignore */ }
    }

    socket.onclose = () => {
      console.log('WS disconnected')
      ws.current = null
    }

    socket.onerror = (err) => console.error('WS error', err)

    return () => { socket.close() }
  }, [token, handleServerEvent])

  return { dispatch, isConnected: ws.current?.readyState === WebSocket.OPEN }
}
