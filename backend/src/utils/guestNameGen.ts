// Generates wuxia-style Traditional Chinese guest names

const SURNAMES = ['李','王','張','劉','陳','楊','趙','黃','周','吳','徐','孫','馬','胡','朱','郭','何','高','林','羅']
const GIVEN = ['雲','風','劍','俠','飛','英','豪','玉','天','龍','虎','鳳','雪','霜','月','星','霞','波','峰','松']
const TITLES = ['江湖新人','武林小俠','遊俠','行者','布衣','過客']

let counter = Math.floor(Math.random() * 9000) + 1000

export function generateGuestName(): string {
  const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)]
  const given = GIVEN[Math.floor(Math.random() * GIVEN.length)] + GIVEN[Math.floor(Math.random() * GIVEN.length)]
  return `${surname}${given}`
}

export function generateGuestTitle(): string {
  return TITLES[Math.floor(Math.random() * TITLES.length)] + String(counter++)
}
