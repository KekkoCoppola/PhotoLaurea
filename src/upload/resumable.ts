// Chunked upload to a Google Drive resumable session URL, with resume on failure.
// Protocol: https://developers.google.com/drive/api/guides/manage-uploads#resumable

export const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024 // multiple of 256 KiB

export type UploadOptions = {
  chunkSize?: number
  maxRetries?: number
  onProgress?: (sent: number, total: number) => void
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

export class UploadError extends Error {
  code: 'SESSION_EXPIRED' | 'FAILED'
  constructor(code: 'SESSION_EXPIRED' | 'FAILED', message?: string) {
    super(message ?? code)
    this.name = 'UploadError'
    this.code = code
  }
}

const defaultSleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// "bytes=0-N" -> N + 1; missing header -> nothing stored yet -> 0
function nextOffset(range: string | null): number {
  const m = range?.match(/bytes=0-(\d+)/)
  return m ? Number(m[1]) + 1 : 0
}

export async function uploadResumable(
  uploadUrl: string,
  file: Blob,
  opts: UploadOptions = {},
): Promise<{ id: string }> {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    maxRetries = 5,
    onProgress,
    fetchImpl = fetch,
    sleep = defaultSleep,
  } = opts
  const total = file.size
  let offset = 0
  let failures = 0
  let askStatus = false

  for (;;) {
    let res: Response | null = null
    try {
      if (askStatus || total === 0) {
        res = await fetchImpl(uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes */${total}` } })
      } else {
        const end = Math.min(offset + chunkSize, total)
        res = await fetchImpl(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Range': `bytes ${offset}-${end - 1}/${total}` },
          body: file.slice(offset, end),
        })
      }
    } catch {
      res = null // network error
    }

    if (res && (res.status === 200 || res.status === 201)) {
      onProgress?.(total, total)
      const body = (await res.json()) as { id: string }
      return { id: body.id }
    }
    if (res && res.status === 308) {
      failures = 0
      askStatus = false
      offset = nextOffset(res.headers.get('Range'))
      onProgress?.(offset, total)
      continue
    }
    if (res && (res.status === 404 || res.status === 410)) {
      throw new UploadError('SESSION_EXPIRED')
    }
    if (res && res.status < 500 && res.status !== 429) {
      throw new UploadError('FAILED', `HTTP ${res.status}`)
    }

    // network error, 5xx or 429: wait, then ask the session how much it has
    failures++
    if (failures > maxRetries) throw new UploadError('FAILED')
    await sleep(1000 * 2 ** (failures - 1))
    askStatus = true
  }
}
