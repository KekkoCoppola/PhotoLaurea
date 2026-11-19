import { expect, test } from 'vitest'
import { springLinear, springValue } from './spring'

test('molla: parte da 0 e si ferma a 1', () => {
  expect(springValue(0)).toBe(0)
  expect(springValue(1)).toBeCloseTo(1, 2)
})

test('molla: rimbalza oltre il bersaglio (effetto bouncy)', () => {
  const peak = Math.max(...Array.from({ length: 101 }, (_, i) => springValue(i / 100)))
  expect(peak).toBeGreaterThan(1.04)
  expect(peak).toBeLessThan(1.25) // elastica ma non esagerata
})

test('springLinear: easing CSS linear() da 0 a 1', () => {
  const css = springLinear(20)
  expect(css.startsWith('linear(0, ')).toBe(true)
  expect(css.endsWith(', 1)')).toBe(true)
  expect(css.split(',').length).toBe(21)
})
