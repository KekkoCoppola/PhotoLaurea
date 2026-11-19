// lib.js is an Apps Script file (global functions, no modules).
// Load it the way Apps Script does: evaluate it in a fresh global context.
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'

const ctx = {}
runInNewContext(readFileSync(new URL('../src/lib.js', import.meta.url), 'utf8'), ctx)
const { normalizeName, nameKey, buildDriveFileName, buildAvatarFileName, uploadMeta, isValidCode } = ctx

test('normalizeName pulisce', () => {
  expect(normalizeName('  Paolo   Rossi ')).toBe('Paolo Rossi')
  expect(normalizeName('a/b\\c:d')).toBe('abcd')
  expect(normalizeName('A\\B')).toBe('AB')
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

test('buildAvatarFileName marca la foto profilo con ora di Roma', () => {
  expect(buildAvatarFileName(new Date('2026-11-20T18:05:09Z'))).toBe('PROFILO_20261120-190509.jpg')
})

test('uploadMeta: foto profilo marcata, upload normale no', () => {
  const when = new Date('2026-11-20T18:05:09Z')
  const avatar = uploadMeta('avatar', 'qualsiasi.png', when)
  expect(avatar.name).toBe('PROFILO_20261120-190509.jpg')
  expect({ ...avatar.appProperties }).toEqual({ photolaurea: 'avatar' })
  const media = uploadMeta(undefined, 'IMG_1.jpg', when)
  expect(media.name).toBe('20261120-190509_IMG_1.jpg')
  expect(media.appProperties).toBeUndefined()
  expect(uploadMeta('boh', 'x.jpg', when).appProperties).toBeUndefined()
})
