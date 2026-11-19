import { expect, test } from 'vitest'
import { centerSquare } from './crop'

test('landscape: square from the horizontal middle', () => {
  expect(centerSquare(1280, 720)).toEqual({ sx: 280, sy: 0, size: 720 })
})

test('portrait: square from the vertical middle', () => {
  expect(centerSquare(720, 1280)).toEqual({ sx: 0, sy: 280, size: 720 })
})

test('already square', () => {
  expect(centerSquare(500, 500)).toEqual({ sx: 0, sy: 0, size: 500 })
})

test('odd difference rounds down to whole pixels', () => {
  expect(centerSquare(641, 480)).toEqual({ sx: 80, sy: 0, size: 480 })
})
