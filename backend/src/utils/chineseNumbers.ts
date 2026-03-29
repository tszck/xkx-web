// Money: 1 gold (黃金) = 10000 wen, 1 silver liang (白銀) = 100 wen

export function formatMoney(wen: number): string {
  if (wen <= 0) return '分文皆無'
  const parts: string[] = []
  const gold = Math.floor(wen / 10000)
  const silver = Math.floor((wen % 10000) / 100)
  const copper = wen % 100
  if (gold > 0) parts.push(`黃金 ${gold} 兩`)
  if (silver > 0) parts.push(`白銀 ${silver} 兩`)
  if (copper > 0) parts.push(`銅錢 ${copper} 文`)
  return parts.join(' ')
}
