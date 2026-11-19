import { expect, test } from 'vitest'
import { bucketLevels, extensionFor, pickAudioMime } from './audioFormat'

test('preferisce mp4 AAC (si sente ovunque, anche su iPhone)', () => {
  expect(pickAudioMime(m => m.startsWith('audio/mp4') || m.startsWith('audio/webm'))).toBe('audio/mp4;codecs=mp4a.40.2')
  expect(pickAudioMime(m => m === 'audio/mp4' || m.startsWith('audio/webm'))).toBe('audio/mp4')
})

test('senza mp4: webm opus, poi webm', () => {
  expect(pickAudioMime(m => m.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus')
  expect(pickAudioMime(m => m === 'audio/webm')).toBe('audio/webm')
})

test('nessun formato noto: lascia scegliere al browser', () => {
  expect(pickAudioMime(() => false)).toBe('')
})

test('estensione dal tipo', () => {
  expect(extensionFor('audio/mp4')).toBe('m4a')
  expect(extensionFor('audio/mp4;codecs=mp4a.40.2')).toBe('m4a')
  expect(extensionFor('audio/webm;codecs=opus')).toBe('webm')
  expect(extensionFor('audio/ogg')).toBe('ogg')
  expect(extensionFor('')).toBe('webm')
})

test('bucketLevels: media per gruppo, normalizzata al picco, minimo visibile', () => {
  expect(bucketLevels([0.1, 0.1, 0.4, 0.4], 2)).toEqual([0.25, 1])
  expect(bucketLevels([], 3)).toEqual([0.08, 0.08, 0.08])
  expect(bucketLevels([0, 0, 0], 3)).toEqual([0.08, 0.08, 0.08])
  expect(bucketLevels([0.5], 3)).toEqual([1, 1, 1])
})
