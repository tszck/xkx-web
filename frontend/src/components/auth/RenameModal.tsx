import { useState } from 'react'
import { useGameStore } from '../../store'
import { renamePlayer } from '../../api/auth'

export default function RenameModal() {
  const { setRenameModal, setDisplayName } = useGameStore()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    try {
      const res = await renamePlayer(name)
      setDisplayName(res.displayName)
      setRenameModal(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
      <div className="box" style={{ width:320 }}>
        <div className="box-title">更改名號</div>
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="輸入新名號（2-20字）"
          style={{ width:'100%', background:'#0a0a0a', border:'1px solid var(--border-bright)', color:'var(--text)', padding:'6px 8px', fontFamily:'var(--font)', marginBottom:8 }} />
        {error && <div style={{ color:'var(--red)', fontSize:12, marginBottom:6 }}>{error}</div>}
        <div style={{ display:'flex', gap:6 }}>
          <button className="primary" onClick={submit}>確定</button>
          <button onClick={() => setRenameModal(false)}>取消</button>
        </div>
      </div>
    </div>
  )
}
