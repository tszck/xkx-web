import { useEffect, useRef, useCallback } from 'react'
import type { ServerEvent, ClientActionType } from './messageTypes'
import { useGameStore } from '../store'

declare const __WS_URL__: string

function getConfiguredWsUrl() {
  const wsUrl = (__WS_URL__ ?? '').trim()
  if (!wsUrl) {
    throw new Error('前端尚未設定 WebSocket URL，請在 GitHub repository secrets 中設定 VITE_WS_URL。')
  }

  const isGithubPages = typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')
  if (isGithubPages && /localhost|127\.0\.0\.1/.test(wsUrl)) {
    throw new Error('GitHub Pages 前端尚未設定外部 WebSocket URL，請設定 VITE_WS_URL / VITE_API_URL。')
  }

  return wsUrl.replace(/\/$/, '')
}

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

    let url: string
    try {
      url = `${getConfiguredWsUrl()}?token=${encodeURIComponent(token)}`
    } catch (err) {
      console.error(err)
      return
    }
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
