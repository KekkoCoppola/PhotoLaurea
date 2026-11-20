import { expect, test } from 'vitest'
import { holeRect, placeTooltip, spotlightPath } from './geometry'

const target = { x: 300, y: 760, width: 66, height: 66 }

test('holeRect: il bersaglio con un margine attorno', () => {
  expect(holeRect(target, 10)).toEqual({ x: 290, y: 750, width: 86, height: 86 })
})

test('spotlightPath: schermo intero + buco arrotondato (evenodd)', () => {
  const d = spotlightPath({ x: 290, y: 750, width: 86, height: 86 }, 390, 844, 20)
  expect(d.startsWith('M0 0H390V844H0Z')).toBe(true)
  expect(d).toContain('M310 750') // top edge starts after the corner radius
  expect(d).toContain('A20 20 0 0 1 376 770') // top-right corner
})

test('spotlightPath: raggio limitato a metà del lato più corto', () => {
  expect(spotlightPath({ x: 0, y: 0, width: 20, height: 10 }, 100, 100, 50)).toContain('A5 5')
})

test('placeTooltip: sopra il bersaglio se c’è spazio, centrato e dentro lo schermo', () => {
  const box = { width: 300, height: 150 }
  expect(placeTooltip({ x: 290, y: 750, width: 86, height: 86 }, box, 390, 844)).toEqual({ top: 584, left: 74, placement: 'above' })
})

test('placeTooltip: sotto se sopra non c’è spazio', () => {
  expect(placeTooltip({ x: 20, y: 40, width: 100, height: 60 }, { width: 300, height: 150 }, 390, 844)).toEqual({
    top: 116, left: 16, placement: 'below',
  })
})
