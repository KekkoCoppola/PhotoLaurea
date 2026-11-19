import { expect, test } from 'vitest'
import { base64ToBlob } from './voiceAudio'

test('base64 → Blob con il tipo giusto e i byte originali', async () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 255, 128])
  const b64 = btoa(String.fromCharCode(...bytes))
  const blob = base64ToBlob(b64, 'audio/mp4')
  expect(blob.type).toBe('audio/mp4')
  expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes)
})
