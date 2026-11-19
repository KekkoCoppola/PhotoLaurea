// lib.js is an Apps Script file (global functions, no modules).
// Load it the way Apps Script does: evaluate it in a fresh global context.
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'

const ctx = {}
runInNewContext(readFileSync(new URL('../src/lib.js', import.meta.url), 'utf8'), ctx)
const { normalizeName, nameKey, buildDriveFileName, buildAvatarFileName, uploadMeta, isValidCode, summarizeUsers, albumItems, pickAvatar, isServableVoice, isPrivate, canManage } = ctx

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
    .map(u => ({ ...u, recent: u.recent.map(r => r.id + ':' + r.kind) }))
  expect(users).toEqual([
    {
      name: 'Bruno',
      avatarId: 'bAvNew',
      count: 5,
      lastUpload: '2026-11-20T12:04:00Z',
      recent: [
        'b5:photo',
        'b4:photo',
        'b3:photo',
        'b2:photo',
      ],
    },
    {
      name: 'Anna',
      avatarId: 'aAv',
      count: 2,
      lastUpload: '2026-11-20T11:00:00Z',
      recent: [
        'a2:video',
        'a1:photo',
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
    { id: 'vid', mimeType: 'video/mp4', kind: 'video', ratio: 1.7778 },
    { id: 'rot', mimeType: 'image/jpeg', kind: 'photo', ratio: 1.3333 },
    { id: 'old', mimeType: 'image/jpeg', kind: 'photo', ratio: 0.75 },
    { id: 'nometa', mimeType: 'image/heic', kind: 'photo', ratio: 1.25 },
  ])
})

test('uploadMeta: testo nella descrizione, nota vocale con durata', () => {
  const when = new Date('2026-11-20T18:05:09Z')
  const text = uploadMeta('text', 'x.txt', when, { text: '  Auguri dottore!  ' })
  expect(text.name).toBe('TESTO_20261120-190509.txt')
  expect(text.description).toBe('Auguri dottore!')
  expect({ ...text.appProperties }).toEqual({ photolaurea: 'text' })
  expect(uploadMeta('text', 'x.txt', when, { text: 'a'.repeat(3000) }).description).toHaveLength(1000)

  const voice = uploadMeta('voice', 'nota.m4a', when, { durationMs: 42317.6 })
  expect(voice.name).toBe('VOCALE_20261120-190509.m4a')
  expect({ ...voice.appProperties }).toEqual({ photolaurea: 'voice', durationMs: '42318' })
  expect(uploadMeta('voice', 'senza-estensione', when, {}).name).toBe('VOCALE_20261120-190509.webm')
})

test('albumItems: testi e note vocali', () => {
  const files = [
    { id: 't1', createdTime: '2026-11-20T12:00:00Z', mimeType: 'text/plain', description: 'Ciao!', appProperties: { photolaurea: 'text' } },
    { id: 't2', createdTime: '2026-11-20T11:00:00Z', mimeType: 'text/plain', description: 'x'.repeat(300), appProperties: { photolaurea: 'text' } },
    { id: 'v1', createdTime: '2026-11-20T10:00:00Z', mimeType: 'audio/mp4', appProperties: { photolaurea: 'voice', durationMs: '42318' } },
  ]
  expect(JSON.parse(JSON.stringify(albumItems(files)))).toEqual([
    { id: 't1', mimeType: 'text/plain', kind: 'text', ratio: 0.8, text: 'Ciao!' },
    { id: 't2', mimeType: 'text/plain', kind: 'text', ratio: 1.35, text: 'x'.repeat(300) },
    { id: 'v1', mimeType: 'audio/mp4', kind: 'voice', ratio: 1, durationMs: 42318 },
  ])
})

test('isServableVoice: solo note vocali nelle cartelle ospiti, sotto il limite', () => {
  const voice = { parents: ['guest'], appProperties: { photolaurea: 'voice' }, size: '58356' }
  const guest = { parents: ['root'] }
  expect(isServableVoice(voice, guest, 'root', 15e6)).toBe(true)
  expect(isServableVoice({ ...voice, appProperties: {} }, guest, 'root', 15e6)).toBe(false) // foto o altro
  expect(isServableVoice({ ...voice, appProperties: { photolaurea: 'text' } }, guest, 'root', 15e6)).toBe(false)
  expect(isServableVoice(voice, { parents: ['altro'] }, 'root', 15e6)).toBe(false) // fuori da Laurea/
  expect(isServableVoice({ ...voice, size: '20000000' }, guest, 'root', 15e6)).toBe(false) // troppo grande
  expect(isServableVoice(voice, null, 'root', 15e6)).toBe(false)
  expect(isServableVoice(voice, guest, '', 15e6)).toBe(false)
})

const priv = { appProperties: { photolaurea: 'text', visibility: 'private' } }

test('isPrivate: solo con visibility private', () => {
  expect(isPrivate(priv)).toBe(true)
  expect(isPrivate({ appProperties: { visibility: 'all' } })).toBe(false)
  expect(isPrivate({})).toBe(false)
})

test('summarizeUsers: gli elementi "solo io e Kekko" non arrivano in home', () => {
  const users = summarizeUsers([{ id: 'f', name: 'Anna' }], [
    { id: 'pub', parents: ['f'], createdTime: '2026-11-20T10:00:00Z', mimeType: 'image/jpeg' },
    { id: 'hid', parents: ['f'], createdTime: '2026-11-20T11:00:00Z', mimeType: 'image/jpeg', appProperties: { visibility: 'private' } },
  ], 4)
  expect(users[0].count).toBe(1)
  expect(users[0].lastUpload).toBe('2026-11-20T10:00:00Z')
  expect(users[0].recent.map(r => r.id)).toEqual(['pub'])
  // solo elementi nascosti: l'ospite non compare in home
  expect(summarizeUsers([{ id: 'g', name: 'Bea' }], [
    { id: 'h', parents: ['g'], createdTime: '2026-11-20T10:00:00Z', mimeType: 'image/jpeg', appProperties: { visibility: 'private' } },
  ], 4)).toEqual([])
})

test('albumItems: nascosti solo per il proprietario, e segnati', () => {
  const files = [
    { id: 'pub', createdTime: '2026-11-20T10:00:00Z', mimeType: 'image/jpeg' },
    { id: 'hid', createdTime: '2026-11-20T11:00:00Z', mimeType: 'text/plain', description: 'ciao', ...priv },
  ]
  expect(albumItems(files).map(i => i.id)).toEqual(['pub'])
  const own = JSON.parse(JSON.stringify(albumItems(files, true)))
  expect(own.map(i => [i.id, i.visibility])).toEqual([['hid', 'private'], ['pub', undefined]])
})

test('canManage: solo i file nella propria cartella, sotto la radice dell’evento', () => {
  const folder = { name: 'Francesco Coppola', parents: ['root'] }
  expect(canManage(folder, 'root', 'francesco  coppola')).toBe(true)
  expect(canManage(folder, 'root', 'Giulia')).toBe(false)
  expect(canManage({ ...folder, parents: ['altro'] }, 'root', 'Francesco Coppola')).toBe(false)
  expect(canManage(null, 'root', 'Francesco Coppola')).toBe(false)
  expect(canManage(folder, 'root', '')).toBe(false)
})
