import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../../store'
import type { ClientActionType } from '../../ws/messageTypes'
import { parseMudCommand } from '../../game/commandParser'
import './MudCommandBar.css'

interface Props {
  dispatch: (type: ClientActionType, payload?: unknown) => void
}

const KEY_MOVE: Record<string, string> = {
  ArrowUp: 'north',
  ArrowDown: 'south',
  ArrowLeft: 'west',
  ArrowRight: 'east',
  w: 'north',
  a: 'west',
  s: 'south',
  d: 'east',
  q: 'northwest',
  e: 'northeast',
  z: 'southwest',
  c: 'southeast',
}

export default function MudCommandBar({ dispatch }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const setHelpModal = useGameStore(s => s.setHelpModal)
  const room = useGameStore(s => s.room)
  const inventory = useGameStore(s => s.inventory)
  const dialogNpcId = useGameStore(s => s.dialogNpc?.id ?? null)

  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)

  const context = useMemo(() => ({ room, inventory, dialogNpcId }), [room, inventory, dialogNpcId])

  const pushLocalLog = (text: string) => {
    useGameStore.getState().handleServerEvent({
      type: 'LOG',
      payload: {
        messages: [{
          timestamp: Date.now(),
          category: 'system',
          text,
        }],
      },
    })
  }

  const runCommand = (raw: string) => {
    const line = raw.trim()
    if (!line) return

    const result = parseMudCommand(line, context)
    result.actions.forEach(action => dispatch(action.type, action.payload))
    if (result.localMessage) pushLocalLog(result.localMessage)

    setHistory(prev => [line, ...prev].slice(0, 80))
    setHistoryIndex(-1)
    setCommand('')
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const inInput = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
      if (inInput) return

      if (event.key === '/') {
        event.preventDefault()
        inputRef.current?.focus()
        return
      }

      const dir = KEY_MOVE[event.key]
      if (dir && room?.exits[dir]) {
        event.preventDefault()
        dispatch('MOVE', { direction: dir })
        return
      }

      if (event.key === 'l') {
        event.preventDefault()
        dispatch('LOOK')
        return
      }
      if (event.key === 'r') {
        event.preventDefault()
        dispatch('REST')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch, room])

  return (
    <div className="box mud-command-bar">
      <div className="mud-command-header">
        <span>MUD 指令</span>
        <div className="mud-command-head-right">
          <span className="mud-command-hint">/ 聚焦 | WASD/方向鍵移動 | l 察看 | r 調息</span>
          <button title="打開原始 help 文檔" onClick={() => setHelpModal(true)}>Help</button>
        </div>
      </div>
      <div className="mud-command-row">
        <span className="prompt">&gt;</span>
        <input
          ref={inputRef}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="輸入指令，例如：n / look / attack 守衛 / talk 店小二 quest"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              runCommand(command)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              const next = Math.min(historyIndex + 1, history.length - 1)
              if (next >= 0) {
                setHistoryIndex(next)
                setCommand(history[next] ?? '')
              }
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              const next = historyIndex - 1
              if (next < 0) {
                setHistoryIndex(-1)
                setCommand('')
              } else {
                setHistoryIndex(next)
                setCommand(history[next] ?? '')
              }
            }
          }}
        />
        <button className="primary" onClick={() => runCommand(command)}>送出</button>
      </div>
    </div>
  )
}
