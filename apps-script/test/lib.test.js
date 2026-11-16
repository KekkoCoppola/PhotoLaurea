// lib.js is an Apps Script file (global functions, no modules).
// Load it the way Apps Script does: evaluate it in a fresh global context.
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'

const ctx = {}
runInNewContext(readFileSync(new URL('../src/lib.js', import.meta.url), 'utf8'), ctx)
const { normalizeName, nameKey, buildDriveFileName, isValidCode } = ctx

test('normalizeName pulisce', () => {
  expect(normalizeName('  Paolo   Rossi ')).toBe('Paolo Rossi')
  expect(normalizeName('a/b\c:d')).toBe('abcd')
  expect(normalizeName('   / ')).toBe('')
  expect(normalizeName('x'.repeat(60))).toHaveLength(40)
})

test('normalizeName rimuove caratteri di controllo', () => {
  expect(normalizeName('Pa\u0000olo\n')).toBe('Paolo')
})

test('nameKey ignora maiuscole', () => {
  expect(nameKey(' PAOLO ')).toBe(nameKey('paolo'))
})

test('buildDriveFileName usa ora di Roma e conserva il nome', () => {
  expect(buildDriveFileName('IMG 001 (1).HEIC', new Date('2026-11-20T18:05:09Z')))
    .toBe('20261120-190509_IMG 001 (1).HEIC')
  expect(buildDriveFileName('🎓.jpg', new Date('2026-07-01T10:00:00Z'))).toBe('20260701-120000_🎓.jpg')
})

test('isValidCode', () => {
  expect(isValidCode(' laurea26 ', 'LAUREA26')).toBe(true)
  expect(isValidCode('LAUREA25', 'LAUREA26')).toBe(false)
  expect(isValidCode('', '')).toBe(false)
  expect(isValidCode(undefined, 'LAUREA26')).toBe(false)
})
