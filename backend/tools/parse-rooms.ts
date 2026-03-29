#!/usr/bin/env tsx
/**
 * Migration tool: LPC room files → JSON
 * Usage: tsx tools/parse-rooms.ts /path/to/xkx /path/to/output/data/rooms
 *
 * Reads all *.c files in /d/{domain}/ (excluding npc/, obj/ subdirs)
 * and produces one JSON file per room.
 */
import fs from 'fs'
import path from 'path'

const [,, xkxRoot, outRoot] = process.argv
if (!xkxRoot || !outRoot) {
  console.error('Usage: tsx parse-rooms.ts <xkx-root> <out-dir>')
  process.exit(1)
}

function parseString(src: string, key: string): string | null {
  const m = src.match(new RegExp(`set\\("${key}",\\s*"([^"]*)"\\)`))
  return m ? m[1] : null
}

function parseHeredoc(src: string): string | null {
  const m = src.match(/set\("long",\s*@LONG([\s\S]*?)LONG\s*\)/)
  return m ? m[1].trim() : parseString(src, 'long')
}

function parseNum(src: string, key: string): number | null {
  const m = src.match(new RegExp(`set\\("${key}",\\s*(-?\\d+)\\)`))
  return m ? Number(m[1]) : null
}

function parseExits(src: string, fileDir: string, domain: string): Record<string, string> {
  const exits: Record<string, string> = {}
  const block = src.match(/set\("exits",\s*\(\[([\s\S]*?)\]\)\)/)
  if (!block) return exits
  const entries = block[1].matchAll(/"([^"]+)"\s*:\s*(?:"([^"]+)"|__DIR__\s*\+\s*"([^"]+)")/g)
  for (const m of entries) {
    const dir = m[1]
    const target = m[2] ?? `/d/${domain}/${m[3]?.replace(/\.c$/, '')}`
    exits[dir] = target.replace(/\.c$/, '')
  }
  return exits
}

function parseNpcRefs(src: string, domain: string): { npcs: string[], npcCounts: Record<string, number> } {
  const npcs: string[] = []
  const npcCounts: Record<string, number> = {}
  const block = src.match(/set\("objects",\s*\(\[([\s\S]*?)\]\)\)/)
  if (!block) return { npcs, npcCounts }
  const entries = block[1].matchAll(/"([^"]+)"\s*:\s*(\d+)/g)
  for (const m of entries) {
    const id = m[1].replace(/\.c$/, '').replace('__DIR__', `/d/${domain}`)
    npcs.push(id)
    npcCounts[id] = Number(m[2])
  }
  return { npcs, npcCounts }
}

function processFile(filePath: string, domain: string, outDir: string) {
  const src = fs.readFileSync(filePath, 'utf-8')
  const fileId = `/d/${domain}/${path.basename(filePath, '.c')}`

  const short = parseString(src, 'short') ?? path.basename(filePath, '.c')
  const long = parseHeredoc(src) ?? ''
  const exits = parseExits(src, path.dirname(filePath), domain)
  const { npcs, npcCounts } = parseNpcRefs(src, domain)
  const x = parseNum(src, 'coor/x') ?? null
  const y = parseNum(src, 'coor/y') ?? null
  const outdoors = parseString(src, 'outdoors') ?? null
  const noFight = /set\("no_fight",\s*1\)/.test(src)
  const noSteal = /set\("no_steal",\s*1\)/.test(src)

  const room = {
    id: fileId,
    short,
    long,
    exits,
    npcs,
    npcCounts: Object.keys(npcCounts).length ? npcCounts : undefined,
    items: [] as string[],
    coords: x !== null && y !== null ? { x, y } : undefined,
    flags: { ...(noFight ? { no_fight: true } : {}), ...(noSteal ? { no_steal: true } : {}) },
    ...(outdoors ? { outdoors } : {}),
  }

  const outFile = path.join(outDir, `${path.basename(filePath, '.c')}.json`)
  fs.writeFileSync(outFile, JSON.stringify(room, null, 2))
}

// Process all domains or a specific one
const domainBase = path.join(xkxRoot, 'd')
const domains = fs.readdirSync(domainBase).filter(d => {
  const dp = path.join(domainBase, d)
  return fs.statSync(dp).isDirectory() && d !== 'wizard'
})

for (const domain of domains) {
  const domainPath = path.join(domainBase, domain)
  const outDir = path.join(outRoot, domain)
  fs.mkdirSync(outDir, { recursive: true })
  const files = fs.readdirSync(domainPath).filter(f => f.endsWith('.c'))
  for (const file of files) {
    try { processFile(path.join(domainPath, file), domain, outDir) }
    catch (e) { console.warn(`Skipped ${file}:`, (e as Error).message) }
  }
  console.log(`[${domain}] ${files.length} rooms processed`)
}

console.log('Done.')
