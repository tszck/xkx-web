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

function normalizeRoomId(input: string): string {
  const cleaned = input.replace(/\\/g, '/').replace(/\.c$/, '')
  if (cleaned.startsWith('/')) return cleaned
  if (cleaned.startsWith('d/')) return `/${cleaned}`
  return cleaned
}

function resolveRelativeRoom(currentRoomId: string, target: string): string {
  const baseDir = path.posix.dirname(currentRoomId)
  return normalizeRoomId(path.posix.join(baseDir, target))
}

function parseExits(src: string, currentRoomId: string): Record<string, string> {
  const exits: Record<string, string> = {}
  const block = src.match(/set\("exits",\s*\(\[([\s\S]*?)\]\)\)/)
  if (!block) return exits
  const entries = block[1].matchAll(/"([^"]+)"\s*:\s*(?:"([^"]+)"|__DIR__\s*\+?\s*"([^"]+)")/g)
  for (const m of entries) {
    const dir = m[1]?.trim().toLowerCase()
    if (!dir) continue

    if (m[2]) {
      const rawTarget = m[2].trim()
      exits[dir] = rawTarget.startsWith('/') || rawTarget.startsWith('d/')
        ? normalizeRoomId(rawTarget)
        : resolveRelativeRoom(currentRoomId, rawTarget)
      continue
    }

    if (m[3]) {
      exits[dir] = resolveRelativeRoom(currentRoomId, m[3].trim())
    }
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

function processFile(filePath: string, domain: string, domainPath: string, outDir: string) {
  const src = fs.readFileSync(filePath, 'utf-8')
  const relativePath = path.relative(domainPath, filePath).replace(/\\/g, '/')
  const relativeNoExt = relativePath.replace(/\.c$/, '')
  const fileId = `/d/${domain}/${relativeNoExt}`

  const short = parseString(src, 'short') ?? path.basename(filePath, '.c')
  const long = parseHeredoc(src) ?? ''
  const exits = parseExits(src, fileId)
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

  const outFile = path.join(outDir, `${relativeNoExt}.json`)
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify(room, null, 2))
}

function collectRoomFiles(domainPath: string): string[] {
  const files: string[] = []
  const skipDirs = new Set(['npc', 'obj'])

  const walk = (currentPath: string) => {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue
        walk(entryPath)
        continue
      }
      if (entry.isFile() && entry.name.endsWith('.c')) {
        files.push(entryPath)
      }
    }
  }

  walk(domainPath)
  return files
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
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })
  const files = collectRoomFiles(domainPath)
  for (const file of files) {
    try { processFile(file, domain, domainPath, outDir) }
    catch (e) { console.warn(`Skipped ${file}:`, (e as Error).message) }
  }
  console.log(`[${domain}] ${files.length} rooms processed`)
}

console.log('Done.')
