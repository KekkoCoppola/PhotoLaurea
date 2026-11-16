import { expect, test } from 'vitest'
import { codeFromHash } from './eventCode'

test('codeFromHash legge il codice dopo #', () => {
  expect(codeFromHash('#LAUREAKEKKO')).toBe('LAUREAKEKKO')
})

test('codeFromHash decodifica e toglie spazi', () => {
  expect(codeFromHash('#%20LAUREA%20KEKKO%20')).toBe('LAUREA KEKKO')
})

test('codeFromHash senza hash restituisce stringa vuota', () => {
  expect(codeFromHash('')).toBe('')
  expect(codeFromHash('#')).toBe('')
})

test('codeFromHash con codifica rotta non esplode', () => {
  expect(codeFromHash('#%E0%A4%A')).toBe('%E0%A4%A')
})
