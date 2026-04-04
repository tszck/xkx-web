import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()

const RAW_XKX_DIR = process.env.RAW_XKX_DIR ?? '/root/projects/xkx'
const TOPICS_FILE = path.join(RAW_XKX_DIR, 'help', 'help', 'topics')

interface HelpTopicCatalogItem {
  key: string
  title: string
}

function stripAnsi(input: string): string {
  return input.replace(/\u001b\[[0-9;]*m/g, '')
}

function toTraditionalChinese(input: string): string {
  // Minimal normalization map for common simplified chars in xkx help corpus.
  const map: Record<string, string> = {
    '侠': '俠', '帮': '幫', '助': '助', '说': '說', '明': '明',
    '档': '檔', '文': '文', '读': '讀', '载': '載', '后': '後',
    '页': '頁', '处': '處', '这': '這', '边': '邊', '为': '為',
    '与': '與', '东': '東', '门': '門', '观': '觀', '调': '調',
    '习': '習', '击': '擊', '务': '務', '发': '發', '术': '術',
    '师': '師', '战': '戰', '斗': '鬥', '药': '藥', '馆': '館',
    '台': '臺', '广': '廣', '开': '開', '关': '關', '网': '網',
    '龙': '龍', '风': '風', '剑': '劍', '图': '圖', '线': '線',
    '级': '級', '国': '國', '两': '兩', '万': '萬', '义': '義',
  }
  return input.replace(/[\u4e00-\u9fff]/g, (ch) => map[ch] ?? ch)
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseCatalog(text: string): HelpTopicCatalogItem[] {
  const out: HelpTopicCatalogItem[] = []
  const seen = new Set<string>()
  const regex = /〖\s*([^〗\s]+)\s*〗\s*([^│\n\r]+)/g

  for (const line of text.split(/\r?\n/)) {
    let m: RegExpExecArray | null
    while ((m = regex.exec(line)) !== null) {
      const key = m[1].trim()
      const title = m[2].trim()
      if (!key || !title || seen.has(key)) continue
      seen.add(key)
      out.push({ key, title })
    }
    regex.lastIndex = 0
  }

  return out
}

router.get('/topics', (_req: Request, res: Response) => {
  try {
    const raw = fs.readFileSync(TOPICS_FILE, 'utf-8')
    const text = toTraditionalChinese(stripAnsi(raw))
    const html = `<pre>${escapeHtml(text)}</pre>`
    res.json({
      id: 'topics',
      title: '俠客行一百 幫助說明',
      text,
      html,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '讀取幫助文件失敗'
    res.status(500).json({ error: message })
  }
})

router.get('/catalog', (_req: Request, res: Response) => {
  try {
    const raw = fs.readFileSync(TOPICS_FILE, 'utf-8')
    const text = toTraditionalChinese(stripAnsi(raw))
    const topics = parseCatalog(text)
    res.json({
      title: '俠客行一百 幫助說明',
      subtitle: '總覽主題索引',
      topics,
      count: topics.length,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '讀取幫助索引失敗'
    res.status(500).json({ error: message })
  }
})

export default router
