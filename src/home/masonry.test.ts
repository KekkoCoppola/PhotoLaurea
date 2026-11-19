import { expect, test } from 'vitest'
import { splitColumns } from './masonry'

const item = (id: string, ratio: number) => ({ id, ratio })

test('ogni foto va nella colonna più corta, a parità quella di sinistra', () => {
  const cols = splitColumns([item('a', 0.6), item('b', 1.7), item('c', 1.4), item('d', 1.2), item('e', 1)], 2)
  // heights: L a=.6 → R b=1.7 → L c (.6+1.4=2.0) → R? L=2.0 R=1.7 → d to R (2.9) → e to L (3.0)
  expect(cols.map(c => c.map(i => i.id))).toEqual([['a', 'c', 'e'], ['b', 'd']])
})

test('lista vuota: colonne vuote', () => {
  expect(splitColumns([], 2)).toEqual([[], []])
})

test('una sola foto: a sinistra', () => {
  expect(splitColumns([item('x', 1)], 2).map(c => c.length)).toEqual([1, 0])
})
