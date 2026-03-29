#!/usr/bin/env tsx
/**
 * Migration tool: LPC item files → JSON
 * Usage: tsx tools/parse-items.ts <xkx-root> <out-dir>
 */
import fs from 'fs'
import path from 'path'

const [,, xkxRoot, outRoot] = process.argv
if (!xkxRoot || !outRoot) { console.error('Usage: tsx parse-items.ts <xkx-root> <out-dir>'); process.exit(1) }

function parseString(src: string, key: string): string | null {
  return src.match(new RegExp(`set\\("${key}",\\s*"([^"]*)"\\)`))?.[1] ?? null
}
function parseNum(src: string, key: string): number {
  return Number(src.match(new RegExp(`set\\("${key}",\\s*(\\d+)\\)`))?.[1] ?? '0')
}

function detectType(src: string): string {
  if (/inherit\s+SWORD|init_sword/.test(src)) return 'sword'
  if (/inherit\s+BLADE|init_blade/.test(src)) return 'blade'
  if (/inherit\s+ARMOR|init_armor/.test(src)) return 'armor'
  if (/inherit\s+CLOTH/.test(src)) return 'cloth'
  if (/inherit\s+FOOD|inherit\s+WAITER/.test(src)) return 'food'
  if (/inherit\s+MEDICINE/.test(src)) return 'medicine'
  if (/inherit\s+BOOK/.test(src)) return 'book'
  if (/inherit\s+MONEY/.test(src)) return 'money'
  return 'misc'
}

function parseNames(src: string): { name: string; ids: string[] } {
  const m = src.match(/set_name\("([^"]+)"(?:,\s*\(\{([^}]+)\}\))?\)/)
  const name = m?.[1] ?? '物品'
  const ids = m?.[2]?.match(/"([^"]+)"/g)?.map(s => s.slice(1, -1)) ?? [name]
  return { name, ids }
}

function processItem(filePath: string, domain: string, subdir: string, outDir: string) {
  const src = fs.readFileSync(filePath, 'utf-8')
  const { name, ids } = parseNames(src)
  const itemType = detectType(src)
  const baseName = path.basename(filePath, '.c')
  const itemId = `/d/${domain}/${subdir}/${baseName}`

  const item = {
    id: itemId,
    name,
    ids,
    description: parseString(src, 'long') ?? '',
    value: parseNum(src, 'value'),
    weight: parseNum(src, 'weight'),
    type: itemType,
    material: parseString(src, 'material') ?? null,
    baseDamage: src.match(/init_sword\(\s*(\d+)/)?.[1] ? Number(src.match(/init_sword\(\s*(\d+)/)![1]) : undefined,
    baseDefense: src.match(/init_armor\(\s*(\d+)/)?.[1] ? Number(src.match(/init_armor\(\s*(\d+)/)![1]) : undefined,
  }

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, `${baseName}.json`), JSON.stringify(item, null, 2))
}

const domainBase = path.join(xkxRoot, 'd')
const domains = fs.readdirSync(domainBase).filter(d => fs.statSync(path.join(domainBase, d)).isDirectory())
let total = 0

for (const domain of domains) {
  const objDir = path.join(domainBase, domain, 'obj')
  if (!fs.existsSync(objDir)) continue
  const outDir = path.join(outRoot, domain)
  const files = fs.readdirSync(objDir).filter(f => f.endsWith('.c'))
  for (const file of files) {
    try { processItem(path.join(objDir, file), domain, 'obj', outDir); total++ }
    catch (e) { console.warn(`Skipped ${file}:`, (e as Error).message) }
  }
}
console.log(`Processed ${total} items.`)
