import { useState } from 'react'
import { useGameStore } from '../../store'
import type { ClientActionType } from '../../ws/messageTypes'
import './NpcDialog.css'

interface Props { dispatch: (type: ClientActionType, payload?: unknown) => void }

export default function NpcDialog({ dispatch }: Props) {
  const { dialogNpc, dialogText, closeDialog } = useGameStore()
  const [topic, setTopic] = useState('')

  if (!dialogNpc) return null

  const send = () => {
    dispatch('TALK', { npcId: dialogNpc.id, topic: topic || undefined })
    setTopic('')
  }

  return (
    <div className="dialog-overlay" onClick={closeDialog}>
      <div className="dialog-box box" onClick={e => e.stopPropagation()}>
        <div className="box-title">與【{dialogNpc.name}】交談</div>
        {dialogText && <div className="dialog-text">「{dialogText}」</div>}
        <div className="dialog-input">
          <input value={topic} onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="詢問話題（Enter 送出）" />
          <button onClick={send}>詢問</button>
          <button onClick={closeDialog}>離開</button>
        </div>
      </div>
    </div>
  )
}
