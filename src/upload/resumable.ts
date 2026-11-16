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

// "bytes=0-N" -> N + 1. Browsers usually cannot read Range: Drive does not list it in
// Access-Control-Expose-Headers. Then we fall back to what we know (see the 308 branch).
function parseRange(range: string | null): number | null {
  const m = range?.match(/bytes=0-(\d+)/)
  return m ? Number(m[1]) + 1 : null
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
  let offset = 0 // next byte to send = last offset Drive confirmed
  let sentEnd = 0 // end (exclusive) of the chunk in flight
  let failures = 0
  let askStatus = false

  for (;;) {
    let res: Response | null = null
    try {
      if (askStatus || total === 0) {
        res = await fetchImpl(uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes */${total}` } })
      } else {
        sentEnd = Math.min(offset + chunkSize, total)
        res = await fetchImpl(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Range': `bytes ${offset}-${sentEnd - 1}/${total}` },
          body: file.slice(offset, sentEnd),
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
      // Range unreadable: after a chunk PUT the chunk was accepted -> sentEnd;
      // after a status query keep the last confirmed offset. Drive tolerates
      // re-sent bytes it already has (verified 2026-11-16), so this is safe.
      const known = parseRange(res.headers.get('Range'))
      offset = known ?? (askStatus ? offset : sentEnd)
      failures = 0
      askStatus = false
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
