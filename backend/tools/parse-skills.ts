#!/usr/bin/env tsx
/**
 * Migration tool: LPC skill files + e2c_dict.o → JSON
 * Usage: tsx tools/parse-skills.ts <xkx-root> <out-dir>
 */
import fs from 'fs'
import path from 'path'

const [,, xkxRoot, outRoot] = process.argv
if (!xkxRoot || !outRoot) { console.error('Usage: tsx parse-skills.ts <xkx-root> <out-dir>'); process.exit(1) }

function extractReturn(src: string, funcName: string): string {
  const rx = new RegExp(`${funcName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?return\\s+"([^"]+)"`)
  return src.match(rx)?.[1] ?? ''
}

function extractIntReturn(src: string, funcName: string): number {
  const rx = new RegExp(`${funcName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?return\\s+(\\d+)`)
  return parseInt(src.match(rx)?.[1] ?? '0', 10)
}

function parsePrereqs(src: string): string[] {
  const prereqs: string[] = []
  const familyM = src.match(/query\("family\/family_name"\)\s*!=\s*"([^"]+)"/)
  if (familyM) prereqs.push(`family:${familyM[1]}`)
  const skillM = src.matchAll(/query_skill\("([^"]+)"\)\s*<\s*(\d+)/g)
  for (const m of skillM) prereqs.push(`${m[1]}:${m[2]}`)
  return prereqs
}

// Parse e2c_dict
function loadE2cDict(xkxRoot: string): Record<string, string> {
  const dictPath = path.join(xkxRoot, 'data', 'e2c_dict.o')
  if (!fs.existsSync(dictPath)) return {}
  const src = fs.readFileSync(dictPath, 'utf-8')
  const names: Record<string, string> = {}
  for (const line of src.split('\n')) {
    const m = line.match(/^([a-z0-9_\-]+)\s*=\s*(.+)$/)
    if (m) names[m[1].trim()] = m[2].trim()
  }
  return names
}

fs.mkdirSync(outRoot, { recursive: true })
const skillDir = path.join(xkxRoot, 'kungfu', 'skill')
if (!fs.existsSync(skillDir)) { console.error('No skill dir'); process.exit(1) }

const e2c = loadE2cDict(xkxRoot)
const names: Record<string, string> = {}

function processSkill(filePath: string) {
  const src = fs.readFileSync(filePath, 'utf-8')
  const skillId = path.basename(filePath, '.c')
  const nameCN = e2c[skillId] ?? skillId

  const skill = {
    id: skillId,
    nameCN,
    type: extractReturn(src, 'type') || 'martial',
    martialType: extractReturn(src, 'martialtype') || 'other',
    learnBonus: extractIntReturn(src, 'learn_bonus'),
    successRate: extractIntReturn(src, 'success'),
    powerPoint: extractIntReturn(src, 'power_point'),
    prerequisites: parsePrereqs(src),
  }

  names[skillId] = nameCN
  fs.writeFileSync(path.join(outRoot, `${skillId}.json`), JSON.stringify(skill, null, 2))
}

let count = 0
const walkDir = (d: string) => {
  for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
    if (entry.isDirectory()) { walkDir(path.join(d, entry.name)); continue }
    if (!entry.name.endsWith('.c')) continue
    try { processSkill(path.join(d, entry.name)); count++ }
    catch (e) { console.warn(`Skipped ${entry.name}:`, (e as Error).message) }
  }
}
walkDir(skillDir)
fs.writeFileSync(path.join(outRoot, 'names.json'), JSON.stringify(names, null, 2))
console.log(`Processed ${count} skills. names.json written.`)
