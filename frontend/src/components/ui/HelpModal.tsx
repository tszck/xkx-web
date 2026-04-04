import { useEffect, useState } from 'react'
import { useGameStore } from '../../store'
import { getHelpTopics } from '../../api/help'

export default function HelpModal() {
  const { setHelpModal } = useGameStore()
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('遊戲幫助')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const helpPageUrl = (typeof window !== 'undefined' && window.location.pathname.startsWith('/xkx-web/'))
    ? '/xkx-web/help.html'
    : '/help.html'

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await getHelpTopics()
        if (!alive) return
        setTitle(res.title)
        setText(res.text)
      } catch (err) {
        if (!alive) return
        setError(err instanceof Error ? err.message : '載入幫助失敗')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [])

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:210 }} onClick={() => setHelpModal(false)}>
      <div className="box" style={{ width:'min(980px, 92vw)', height:'min(82vh, 760px)', display:'flex', flexDirection:'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="box-title" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>{title}</span>
          <div style={{ display:'flex', gap:8 }}>
            <a href={helpPageUrl} target="_blank" rel="noreferrer" style={{ color:'var(--accent)', fontSize:12, textDecoration:'none' }}>獨立頁面</a>
            <button onClick={() => setHelpModal(false)}>關閉</button>
          </div>
        </div>

        {loading && <div style={{ color:'var(--text-dim)', padding:'8px 2px' }}>讀取幫助中…</div>}
        {error && <div style={{ color:'var(--red)', padding:'8px 2px' }}>{error}</div>}

        {!loading && !error && (
          <pre style={{ flex:1, overflow:'auto', margin:0, background:'#0e0e0e', border:'1px solid var(--border)', borderRadius:'2px', padding:'10px 12px', fontSize:13, lineHeight:1.55, whiteSpace:'pre-wrap', color:'var(--text)' }}>
            {text}
          </pre>
        )}
      </div>
    </div>
  )
}
