// "2 minuti fa" … "9 giorni fa"; from the 10th day on, the date as GG/MM/AA (Rome time).

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const dateFormat = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many} fa`

export function timeAgo(when: Date | string, now: Date = new Date()): string {
  const date = typeof when === 'string' ? new Date(when) : when
  const elapsed = now.getTime() - date.getTime()
  if (elapsed < MIN) return 'adesso'
  if (elapsed < HOUR) return plural(Math.floor(elapsed / MIN), 'minuto', 'minuti')
  if (elapsed < DAY) return plural(Math.floor(elapsed / HOUR), 'ora', 'ore')
  const days = Math.floor(elapsed / DAY)
  if (days < 10) return plural(days, 'giorno', 'giorni')
  return dateFormat.format(date)
}
