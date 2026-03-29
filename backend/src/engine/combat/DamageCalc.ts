// Ported from /d/adm/daemons/combatd.c damage_msg() thresholds
// and damage type descriptions in Traditional Chinese

export type DamageType = 'slash' | 'pierce' | 'blunt' | 'internal'

export interface DamageResult {
  amount: number
  type: DamageType
  typeNameCN: string
  message: string
  severity: 'graze' | 'light' | 'moderate' | 'heavy' | 'severe' | 'lethal'
}

const SLASH_MSGS: Array<[number, string, string]> = [
  [10,  '輕傷', '割破了皮膚，流出少量血跡。'],
  [20,  '輕傷', '劃出一道傷口，鮮血滲出。'],
  [40,  '中傷', '被割出深可見骨的傷口！'],
  [80,  '重傷', '慘遭割傷，傷及筋骨！'],
  [160, '重傷', '被割去一塊血肉，痛徹心扉！'],
]
const PIERCE_MSGS: Array<[number, string, string]> = [
  [10,  '輕傷', '被刺穿衣物，留下輕微刺痛。'],
  [20,  '輕傷', '被刺入皮肉，傷口滲血。'],
  [40,  '中傷', '被深深刺入，血流如注！'],
  [80,  '重傷', '被刺穿要害，劇痛難忍！'],
  [160, '重傷', '洞穿而過，奄奄一息！'],
]
const BLUNT_MSGS: Array<[number, string, string]> = [
  [10,  '輕傷', '受到撞擊，隱隱作痛。'],
  [20,  '輕傷', '被重擊，骨骼傳來酸痛。'],
  [40,  '中傷', '重擊之下，骨骼嘎嘎作響！'],
  [80,  '重傷', '遭到重創，幾乎無法站立！'],
  [120, '重傷', '骨骼盡碎，劇痛無比！'],
  [160, '重傷', '五臟俱傷，血盡氣竭！'],
  [240, '致命', '全身筋脈盡斷，生死一線！'],
]

function msgFromTable(damage: number, table: Array<[number, string, string]>): { severity: string; msg: string } {
  for (const [threshold, sev, msg] of table) {
    if (damage <= threshold) return { severity: sev, msg }
  }
  return { severity: '致命', msg: table[table.length - 1][2] }
}

const TYPE_MAP: Record<DamageType, { nameCN: string; table: Array<[number, string, string]> }> = {
  slash:    { nameCN: '割傷', table: SLASH_MSGS },
  pierce:   { nameCN: '刺傷', table: PIERCE_MSGS },
  blunt:    { nameCN: '瘀傷', table: BLUNT_MSGS },
  internal: { nameCN: '內傷', table: BLUNT_MSGS },
}

export function buildDamageResult(amount: number, type: DamageType): DamageResult {
  const { nameCN, table } = TYPE_MAP[type]
  const { severity, msg } = msgFromTable(Math.abs(amount), table)
  return {
    amount,
    type,
    typeNameCN: nameCN,
    message: msg,
    severity: severity as DamageResult['severity'],
  }
}
