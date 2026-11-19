import { expect, test } from 'vitest'
import { formatDuration, waveform } from './voice'

test('durata m:ss', () => {
  expect(formatDuration(0)).toBe('0:00')
  expect(formatDuration(42_318)).toBe('0:42')
  expect(formatDuration(65_000)).toBe('1:05')
  expect(formatDuration(600_499)).toBe('10:00')
  expect(formatDuration(-5)).toBe('0:00')
})

test('waveform: stessa nota, stessa forma; barre tra 0.2 e 1', () => {
  const a = waveform('abc123', 32)
  expect(a).toHaveLength(32)
  expect(waveform('abc123', 32)).toEqual(a)
  expect(waveform('zzz999', 32)).not.toEqual(a)
  for (const h of a) {
    expect(h).toBeGreaterThanOrEqual(0.2)
    expect(h).toBeLessThanOrEqual(1)
  }
})
