import { afterEach, expect, test, vi } from 'vitest'
import { ApiError, callApi } from './client'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

function stubFetch(body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
  vi.stubGlobal('fetch', fn)
  return fn
}

test('callApi manda action e payload come text/plain e restituisce data', async () => {
  vi.stubEnv('VITE_API_URL', 'https://script.example/exec')
  const fn = stubFetch({ ok: true, data: { name: 'Paolo', folderId: 'f1' } })
  const data = await callApi<{ name: string }>('login', { code: 'X', name: 'Paolo' })
  expect(data).toEqual({ name: 'Paolo', folderId: 'f1' })
  const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://script.example/exec')
  expect(init.method).toBe('POST')
  expect(new Headers(init.headers).get('Content-Type')).toBe('text/plain;charset=utf-8')
  expect(JSON.parse(init.body as string)).toEqual({ action: 'login', code: 'X', name: 'Paolo' })
})

test('callApi lancia ApiError con il codice quando ok è false', async () => {
  vi.stubEnv('VITE_API_URL', 'https://script.example/exec')
  stubFetch({ ok: false, error: 'BAD_CODE' })
  const p = callApi('login', { code: 'no', name: 'Paolo' })
  await expect(p).rejects.toBeInstanceOf(ApiError)
  await expect(p).rejects.toMatchObject({ code: 'BAD_CODE' })
})
