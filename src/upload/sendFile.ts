import { callApi } from '../api/client'
import type { Session } from '../session/session'
import { uploadResumable } from './resumable'

export type UploadKind = 'media' | 'avatar'

// One file to the guest's Drive folder: ask the backend for a session URL, then push the bytes.
export async function sendFile(
  session: Session,
  file: Blob,
  fileName: string,
  kind: UploadKind,
  onProgress?: (sent: number) => void,
): Promise<string> {
  const { uploadUrl } = await callApi<{ uploadUrl: string }>('startUpload', {
    code: session.code,
    name: session.name,
    fileName,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    kind,
  })
  const { id } = await uploadResumable(uploadUrl, file, { onProgress })
  return id
}
