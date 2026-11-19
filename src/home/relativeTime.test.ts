import { expect, test } from 'vitest'
import { timeAgo } from './relativeTime'

const now = new Date('2026-11-20T18:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms)
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

test('meno di un minuto: adesso', () => {
  expect(timeAgo(ago(0), now)).toBe('adesso')
  expect(timeAgo(ago(59_000), now)).toBe('adesso')
})

test('orologio del telefono avanti: adesso, non "tra"', () => {
  expect(timeAgo(ago(-5 * MIN), now)).toBe('adesso')
})

test('minuti', () => {
  expect(timeAgo(ago(MIN), now)).toBe('1 minuto fa')
  expect(timeAgo(ago(2 * MIN), now)).toBe('2 minuti fa')
  expect(timeAgo(ago(59 * MIN + 59_000), now)).toBe('59 minuti fa')
})

test('ore', () => {
  expect(timeAgo(ago(HOUR), now)).toBe('1 ora fa')
  expect(timeAgo(ago(3 * HOUR), now)).toBe('3 ore fa')
  expect(timeAgo(ago(23 * HOUR + 59 * MIN), now)).toBe('23 ore fa')
})

test('giorni fino a 9', () => {
  expect(timeAgo(ago(DAY), now)).toBe('1 giorno fa')
  expect(timeAgo(ago(2 * DAY), now)).toBe('2 giorni fa')
  expect(timeAgo(ago(9 * DAY + 23 * HOUR), now)).toBe('9 giorni fa')
})

test('dal decimo giorno: data GG/MM/AA, ora di Roma', () => {
  expect(timeAgo(ago(10 * DAY), now)).toBe('10/11/26')
  // 23:30 UTC del 31/12 è già 1 gennaio a Roma
  expect(timeAgo(new Date('2025-12-31T23:30:00Z'), now)).toBe('01/01/26')
})

test('accetta stringhe ISO', () => {
  expect(timeAgo('2026-11-20T17:58:00Z', now)).toBe('2 minuti fa')
})
