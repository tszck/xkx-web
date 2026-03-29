#!/usr/bin/env tsx
/**
 * Migration tool: LPC NPC files → JSON
 * Usage: tsx tools/parse-npcs.ts <xkx-root> <out-dir>
 */
import fs from 'fs'
import path from 'path'

const [,, xkxRoot, outRoot] = process.argv
if (!xkxRoot || !outRoot) { console.error('Usage: tsx parse-npcs.ts <xkx-root> <out-dir>'); process.exit(1) }

function parseString(src: string, key: string): string | null {
  const m = src.match(new RegExp(`set\\("${key}",\\s*"([^"]*)"\\)`))
  if (m) return m[1]
  const m2 = src.match(new RegExp(`set\\("${key}",\\s*@\\w+([ \\s\\S]*?)\\w+\\s*\\)`))
  return m2 ? m2[1].trim() : null
}

function parseNum(src: string, key: string): number { return Number(src.match(new RegExp(`set\\("${key}",\\s*(-?\\d+)\\)`))?.[1] ?? '0') }

function parseNames(src: string): { name: string; ids: string[] } {
  const m = src.match(/set_name\("([^"]+)"(?:,\s*\(\{([^}]+)\}\))?\)/)
  const name = m?.[1] ?? '無名'
  const ids = m?.[2]?.match(/"([^"]+)"/g)?.map(s => s.slice(1, -1)) ?? [name]
  return { name, ids }
}

function parseAttitude(src: string): string {
  if (/set\("attitude",\s*"friendly"\)/.test(src)) return 'friendly'
  if (/set\("attitude",\s*"hostile"\)/.test(src)) return 'hostile'
  return 'neutral'
}

function parseAttrs(src: string): Record<string, number> {
  const attrs: Record<string, number> = {}
  for (const attr of ['str','con','dex','int','per','kar','sta','spi']) {
    const m = src.match(new RegExp(`set\\("${attr}",\\s*(\\d+)\\)`))
    if (m) attrs[attr] = parseInt(m[1], 10)
  }
  return attrs
}

function parseSkills(src: string): Record<string, number> {
  const skills: Record<string, number> = {}
  const rx = /set_skill\("([^"]+)",\s*(\d+)\)/g
  for (const m of src.matchAll(rx)) skills[m[1]] = parseInt(m[2], 10)
  return skills
}

function parseChatMessages(src: string): string[] {
  const msgs: string[] = []
  const block = src.match(/set\("chat_msg",\s*\(\{([\s\S]*?)\}\)\)/)
  if (!block) return msgs
  const entries = block[1].matchAll(/"([^"]+)"/g)
  for (const m of entries) msgs.push(m[1])
  return msgs
}

function parseInquiry(src: string): Record<string, string> {
  const topics: Record<string, string> = {}
  const block = src.match(/set\("inquiry",\s*\(\[([\s\S]*?)\]\)\)/)
  if (!block) return topics
  const entries = block[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)
  for (const m of entries) topics[m[1]] = m[2]
  return topics
}

function detectType(src: string): string {
  if (/inherit\s+F_DEALER|inherit\s+DEALER/.test(src)) return 'shop'
  if (/inherit\s+WAITER/.test(src)) return 'waiter'
  if (/inherit\s+F_MASTER|query_master/.test(src)) return 'trainer'
  return 'npc'
}

function processNpcFile(filePath: string, domain: string, outDir: string) {
  const src = fs.readFileSync(filePath, 'utf-8')
  const fileId = `/d/${domain}/npc/${path.basename(filePath, '.c')}`
  const { name, ids } = parseNames(src)

  const npc = {
    id: fileId,
    name,
    ids,
    gender: parseString(src, 'gender') ?? '未知',
    age: parseNum(src, 'age'),
    description: parseString(src, 'long') ?? '',
    attitude: parseAttitude(src),
    combatExp: parseNum(src, 'combat_exp'),
    attrs: parseAttrs(src),
    skills: parseSkills(src),
    chatMessages: parseChatMessages(src),
    inquiryTopics: parseInquiry(src),
    carriedItems: [] as string[],
    equippedSlots: {} as Record<string, string>,
    type: detectType(src),
  }

  fs.writeFileSync(path.join(outDir, `${path.basename(filePath, '.c')}.json`), JSON.stringify(npc, null, 2))
}

const domainBase = path.join(xkxRoot, 'd')
const domains = fs.readdirSync(domainBase).filter(d => fs.statSync(path.join(domainBase, d)).isDirectory())

for (const domain of domains) {
  const npcDir = path.join(domainBase, domain, 'npc')
  if (!fs.existsSync(npcDir)) continue
  const outDir = path.join(outRoot, domain)
  fs.mkdirSync(outDir, { recursive: true })
  const files = fs.readdirSync(npcDir).filter(f => f.endsWith('.c'))
  for (const file of files) {
    try { processNpcFile(path.join(npcDir, file), domain, outDir) }
    catch (e) { console.warn(`Skipped ${file}:`, (e as Error).message) }
  }
  console.log(`[${domain}/npc] ${files.length} NPCs processed`)
}
console.log('Done.')
