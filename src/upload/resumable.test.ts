import { describe, expect, test, vi } from 'vitest'
import { uploadResumable, UploadError } from './resumable'

const URL_ = 'https://upload.example/session'
const CHUNK = 262144
const blob = (n: number) => new Blob([new Uint8Array(n)])
const noSleep = () => Promise.resolve()

type Step = (init: RequestInit) => Response | Promise<Response>
function fakeFetch(steps: Step[]) {
  const calls: { range: string | null; bodySize: number }[] = []
  let i = 0
  const impl = (async (_url: string, init: RequestInit = {}) => {
    const body = init.body as Blob | undefined
    calls.push({ range: new Headers(init.headers).get('Content-Range'), bodySize: body ? body.size : 0 })
    const step = steps[i++]
    if (!step) throw new Error('unexpected extra call')
    return step(init)
  }) as unknown as typeof fetch
  return { impl, calls }
}
const r308 = (range?: string) => () =>
  new Response(null, { status: 308, headers: range ? { Range: range } : {} })
const r200 = (id: string) => () => new Response(JSON.stringify({ id }), { status: 200 })
const netErr = () => { throw new TypeError('Failed to fetch') }

describe('uploadResumable', () => {
  test('invia 3 pezzi con Content-Range corretti e restituisce l\'id', async () => {
    const f = fakeFetch([r308('bytes=0-262143'), r308('bytes=0-524287'), r200('abc')])
    const onProgress = vi.fn()
    const res = await uploadResumable(URL_, blob(600000), { chunkSize: CHUNK, fetchImpl: f.impl, sleep: noSleep, onProgress })
    expect(res).toEqual({ id: 'abc' })
    expect(f.calls.map(c => c.range)).toEqual([
      'bytes 0-262143/600000', 'bytes 262144-524287/600000', 'bytes 524288-599999/600000',
    ])
    expect(onProgress).toHaveBeenLastCalledWith(600000, 600000)
  })

  test('dopo un errore di rete chiede lo stato e riprende dall\'offset', async () => {
    const f = fakeFetch([r308('bytes=0-262143'), netErr, r308('bytes=0-262143'), r308('bytes=0-524287'), r200('abc')])
    await uploadResumable(URL_, blob(600000), { chunkSize: CHUNK, fetchImpl: f.impl, sleep: noSleep })
    expect(f.calls[2]).toEqual({ range: 'bytes */600000', bodySize: 0 })
    expect(f.calls[3].range).toMatch(/^bytes 262144-/)
  })

  test('un 503 viene trattato come errore temporaneo', async () => {
    const f = fakeFetch([() => new Response(null, { status: 503 }), r308(), r308('bytes=0-262143'), r308('bytes=0-524287'), r200('x')])
    const res = await uploadResumable(URL_, blob(600000), { chunkSize: CHUNK, fetchImpl: f.impl, sleep: noSleep })
    expect(res.id).toBe('x')
    expect(f.calls[1].range).toBe('bytes */600000')
  })

  test('308 senza Range riparte da 0', async () => {
    const f = fakeFetch([r308(), r308('bytes=0-262143'), r308('bytes=0-524287'), r200('abc')])
    await uploadResumable(URL_, blob(600000), { chunkSize: CHUNK, fetchImpl: f.impl, sleep: noSleep })
    expect(f.calls[1].range).toBe('bytes 0-262143/600000')
  })

  test('si arrende dopo maxRetries errori consecutivi', async () => {
    const f = fakeFetch(Array(20).fill(netErr))
    const p = uploadResumable(URL_, blob(600000), { chunkSize: CHUNK, fetchImpl: f.impl, sleep: noSleep, maxRetries: 3 })
    await expect(p).rejects.toBeInstanceOf(UploadError)
    await expect(p).rejects.toMatchObject({ code: 'FAILED' })
    expect(f.calls.length).toBe(4)
  })

  test('404 -> SESSION_EXPIRED', async () => {
    const f = fakeFetch([() => new Response(null, { status: 404 })])
    await expect(uploadResumable(URL_, blob(600000), { chunkSize: CHUNK, fetchImpl: f.impl, sleep: noSleep }))
      .rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
  })

  test('file vuoto -> una sola PUT con bytes */0', async () => {
    const f = fakeFetch([r200('empty')])
    const res = await uploadResumable(URL_, blob(0), { chunkSize: CHUNK, fetchImpl: f.impl, sleep: noSleep })
    expect(res.id).toBe('empty')
    expect(f.calls).toEqual([{ range: 'bytes */0', bodySize: 0 }])
  })
})
