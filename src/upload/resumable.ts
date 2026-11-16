// Chunked upload to a Google Drive resumable session URL, with resume on failure.
// Protocol: https://developers.google.com/drive/api/guides/manage-uploads#resumable

export const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024 // multiple of 256 KiB
const MIN_THROUGHPUT_BYTES_PER_MS = 50 // 50 KB/s: below this a chunk request counts as stalled
const MAX_BACKOFF_MS = 30_000

export type UploadOptions = {
  chunkSize?: number
  maxRetries?: number
  timeoutMs?: number
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

// "bytes=0-N" -> N + 1. Browsers often cannot read Range: Drive does not always list it in
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
    maxRetries = 8,
    timeoutMs = Math.max(60_000, chunkSize / MIN_THROUGHPUT_BYTES_PER_MS),
    onProgress,
    fetchImpl = fetch,
    sleep = defaultSleep,
  } = opts
  const total = file.size
  let offset = 0 // next byte to send = last offset Drive confirmed
  let sentEnd = 0 // end (exclusive) of the chunk in flight
  let failures = 0 // consecutive attempts without progress
  let askStatus = false

  async function put(headers: Record<string, string>, body?: Blob): Promise<Response | null> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      return await fetchImpl(uploadUrl, { method: 'PUT', headers, body, signal: ctrl.signal })
    } catch {
      return null // network error or timeout
    } finally {
      clearTimeout(timer)
    }
  }

  for (;;) {
    const statusQuery = askStatus || total === 0 || offset >= total
    const confirmedBefore = offset
    let res: Response | null
    if (statusQuery) {
      res = await put({ 'Content-Range': `bytes */${total}` })
    } else {
      sentEnd = Math.min(offset + chunkSize, total)
      res = await put({ 'Content-Range': `bytes ${offset}-${sentEnd - 1}/${total}` }, file.slice(offset, sentEnd))
    }

    if (res && (res.status === 200 || res.status === 201)) {
      onProgress?.(total, total)
      const body = (await res.json()) as { id: string }
      return { id: body.id }
    }
    if (res && res.status === 404) throw new UploadError('SESSION_EXPIRED')
    if (res && res.status === 410) throw new UploadError('SESSION_EXPIRED')

    let retryWithStatus = true
    if (res && res.status === 308 && total > 0) {
      // Range unreadable: after a chunk PUT the chunk was accepted -> sentEnd;
      // after a status query keep the last confirmed offset. Drive tolerates
      // re-sent bytes it already has (verified 2026-11-16), so this is safe.
      offset = parseRange(res.headers.get('Range')) ?? (statusQuery ? offset : sentEnd)
      askStatus = false
      onProgress?.(offset, total)
      if (offset > confirmedBefore) {
        failures = 0
        continue
      }
      retryWithStatus = false // no progress: count it, then resend from offset
    } else if (res && res.status !== 308 && res.status < 500 && res.status !== 429) {
      throw new UploadError('FAILED', `HTTP ${res.status}`)
    }

    // network error, timeout, 5xx, 429, or a 308 without progress
    failures++
    if (failures > maxRetries) throw new UploadError('FAILED')
    await sleep(Math.min(1000 * 2 ** (failures - 1), MAX_BACKOFF_MS))
    askStatus = retryWithStatus
  }
}
