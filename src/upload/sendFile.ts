import { callApi } from '../api/client'
import type { Session } from '../session/session'
import { uploadResumable } from './resumable'

export type UploadKind = 'media' | 'avatar' | 'voice' | 'text'

// One file to the guest's Drive folder: ask the backend for a session URL, then push the bytes.
export async function sendFile(
  session: Session,
  file: Blob,
  fileName: string,
  kind: UploadKind,
  onProgress?: (sent: number) => void,
  extra: Record<string, unknown> = {}, // kind-specific fields, e.g. { durationMs } for a voice note
): Promise<string> {
  const { uploadUrl } = await callApi<{ uploadUrl: string }>('startUpload', {
    code: session.code,
    name: session.name,
    fileName,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    kind,
    ...extra,
  })
  const { id } = await uploadResumable(uploadUrl, file, { onProgress })
  return id
}
