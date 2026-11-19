import { callApi } from '../api/client'

// Drive refuses to be played inside other sites (cross-origin blocking), so voice notes come
// through the backend as base64 and play from a local object URL. One download per note.

export function base64ToBlob(data: string, mimeType: string): Blob {
  const raw = atob(data)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

const cache = new Map<string, Promise<string>>()

export function loadVoice(code: string, id: string): Promise<string> {
  let url = cache.get(id)
  if (!url) {
    url = callApi<{ mimeType: string; data: string }>('media', { code, id }).then(r =>
      URL.createObjectURL(base64ToBlob(r.data, r.mimeType)),
    )
    url.catch(() => cache.delete(id)) // a failed download can be retried
    cache.set(id, url)
  }
  return url
}
