import { expect, test } from 'vitest'
import { parseSession } from './session'

const saved = JSON.stringify({ code: 'PROVA', name: 'Mario', avatarId: 'av1' })

test('sessione valida per lo stesso codice', () => {
  expect(parseSession(saved, 'prova')).toEqual({ code: 'PROVA', name: 'Mario', avatarId: 'av1' })
})

test('link con un altro codice: si ricomincia', () => {
  expect(parseSession(saved, 'ALTRO')).toBeNull()
})

test('nessun codice nel link: vale quella salvata', () => {
  expect(parseSession(saved, '')).toEqual({ code: 'PROVA', name: 'Mario', avatarId: 'av1' })
})

test('avatar mancante resta mancante (riprende dal selfie)', () => {
  expect(parseSession(JSON.stringify({ code: 'PROVA', name: 'Mario' }), 'PROVA')).toEqual({ code: 'PROVA', name: 'Mario' })
})

test('dati rovinati o incompleti: null', () => {
  expect(parseSession(null, 'PROVA')).toBeNull()
  expect(parseSession('{rotto', 'PROVA')).toBeNull()
  expect(parseSession(JSON.stringify({ code: 'PROVA' }), 'PROVA')).toBeNull()
  expect(parseSession(JSON.stringify({ code: 'PROVA', name: 'Mario', avatarId: 5 }), 'PROVA')).toBeNull()
})
