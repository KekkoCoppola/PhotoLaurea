// lib.js is an Apps Script file (global functions, no modules).
// Load it the way Apps Script does: evaluate it in a fresh global context.
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'

const ctx = {}
runInNewContext(readFileSync(new URL('../src/lib.js', import.meta.url), 'utf8'), ctx)
const { normalizeName, nameKey, buildDriveFileName, buildAvatarFileName, uploadMeta, isValidCode, summarizeUsers, albumItems, pickAvatar } = ctx

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

test('summarizeUsers: per ospite foto recenti, conteggio, ultimo caricamento, avatar a parte', () => {
  const folders = [
    { id: 'fA', name: 'Anna' },
    { id: 'fB', name: 'Bruno' },
    { id: 'fC', name: 'Carla' }, // solo avatar: non compare
  ]
  const f = (id, parent, t, extra = {}) => ({ id, parents: [parent], createdTime: t, mimeType: 'image/jpeg', ...extra })
  const avatar = { appProperties: { photolaurea: 'avatar' } }
  const files = [
    f('a1', 'fA', '2026-11-20T10:00:00Z'),
    f('aAv', 'fA', '2026-11-20T09:00:00Z', avatar),
    f('a2', 'fA', '2026-11-20T11:00:00Z', { mimeType: 'video/mp4' }),
    f('b1', 'fB', '2026-11-20T12:00:00Z'),
    f('b2', 'fB', '2026-11-20T12:01:00Z'),
    f('b3', 'fB', '2026-11-20T12:02:00Z'),
    f('b4', 'fB', '2026-11-20T12:03:00Z'),
    f('b5', 'fB', '2026-11-20T12:04:00Z'),
    f('bAvOld', 'fB', '2026-11-20T08:00:00Z', avatar),
    f('bAvNew', 'fB', '2026-11-20T08:30:00Z', avatar),
    f('cAv', 'fC', '2026-11-20T08:00:00Z', avatar),
    f('x', 'altro', '2026-11-20T13:00:00Z'),
  ]
  const users = JSON.parse(JSON.stringify(summarizeUsers(folders, files, 4)))
  expect(users).toEqual([
    {
      name: 'Bruno',
      avatarId: 'bAvNew',
      count: 5,
      lastUpload: '2026-11-20T12:04:00Z',
      recent: [
        { id: 'b5', mimeType: 'image/jpeg' },
        { id: 'b4', mimeType: 'image/jpeg' },
        { id: 'b3', mimeType: 'image/jpeg' },
        { id: 'b2', mimeType: 'image/jpeg' },
      ],
    },
    {
      name: 'Anna',
      avatarId: 'aAv',
      count: 2,
      lastUpload: '2026-11-20T11:00:00Z',
      recent: [
        { id: 'a2', mimeType: 'video/mp4' },
        { id: 'a1', mimeType: 'image/jpeg' },
      ],
    },
  ])
})

test('summarizeUsers: ospite senza foto profilo usa la sua prima foto', () => {
  const users = summarizeUsers([{ id: 'f', name: 'Dario' }], [
    { id: 'd2', parents: ['f'], createdTime: '2026-11-20T11:00:00Z', mimeType: 'image/png' },
    { id: 'd1', parents: ['f'], createdTime: '2026-11-20T10:00:00Z', mimeType: 'image/png' },
  ], 4)
  expect(users[0].avatarId).toBe('d1')
})

test('summarizeUsers: solo video, nessuna foto profilo', () => {
  const users = summarizeUsers([{ id: 'f', name: 'Ezio' }], [
    { id: 'v1', parents: ['f'], createdTime: '2026-11-20T10:00:00Z', mimeType: 'video/mp4' },
  ], 4)
  expect(users[0].avatarId).toBeNull()
})

test('pickAvatar: foto profilo marcata più recente, altrimenti prima foto, altrimenti null', () => {
  const av = { appProperties: { photolaurea: 'avatar' } }
  expect(pickAvatar([
    { id: 'p1', createdTime: '2026-11-20T09:00:00Z', mimeType: 'image/jpeg' },
    { id: 'avOld', createdTime: '2026-11-20T10:00:00Z', mimeType: 'image/jpeg', ...av },
    { id: 'avNew', createdTime: '2026-11-20T11:00:00Z', mimeType: 'image/jpeg', ...av },
  ])).toBe('avNew')
  expect(pickAvatar([
    { id: 'vid', createdTime: '2026-11-20T08:00:00Z', mimeType: 'video/mp4' },
    { id: 'second', createdTime: '2026-11-20T10:00:00Z', mimeType: 'image/jpeg' },
    { id: 'first', createdTime: '2026-11-20T09:00:00Z', mimeType: 'image/heic' },
  ])).toBe('first')
  expect(pickAvatar([{ id: 'vid', createdTime: '2026-11-20T08:00:00Z', mimeType: 'video/mp4' }])).toBeNull()
  expect(pickAvatar([])).toBeNull()
})

test('albumItems: niente avatar, più recenti prima, proporzioni dalle dimensioni', () => {
  const files = [
    { id: 'old', createdTime: '2026-11-20T10:00:00Z', mimeType: 'image/jpeg', imageMediaMetadata: { width: 4000, height: 3000 } },
    { id: 'av', createdTime: '2026-11-20T12:00:00Z', mimeType: 'image/jpeg', appProperties: { photolaurea: 'avatar' } },
    { id: 'rot', createdTime: '2026-11-20T11:00:00Z', mimeType: 'image/jpeg', imageMediaMetadata: { width: 4000, height: 3000, rotation: 1 } },
    { id: 'vid', createdTime: '2026-11-20T11:30:00Z', mimeType: 'video/mp4', videoMediaMetadata: { width: 1080, height: 1920 } },
    { id: 'nometa', createdTime: '2026-11-20T09:00:00Z', mimeType: 'image/heic' },
  ]
  expect(JSON.parse(JSON.stringify(albumItems(files)))).toEqual([
    { id: 'vid', mimeType: 'video/mp4', ratio: 1.7778 },
    { id: 'rot', mimeType: 'image/jpeg', ratio: 1.3333 },
    { id: 'old', mimeType: 'image/jpeg', ratio: 0.75 },
    { id: 'nometa', mimeType: 'image/heic', ratio: 1.25 },
  ])
})
