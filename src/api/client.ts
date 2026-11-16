// Client for the Apps Script Web App. text/plain avoids the CORS preflight Apps Script cannot answer.

export type ApiAction = 'ping' | 'login' | 'startUpload'
export type ApiErrorCode = 'BAD_REQUEST' | 'BAD_CODE' | 'BAD_NAME' | 'UPSTREAM' | 'SERVER'

export class ApiError extends Error {
  code: ApiErrorCode
  constructor(code: ApiErrorCode) {
    super(code)
    this.name = 'ApiError'
    this.code = code
  }
}

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiErrorCode }

export async function callApi<T>(action: ApiAction, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(import.meta.env.VITE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  })
  const body = (await res.json()) as ApiResponse<T>
  if (!body.ok) throw new ApiError(body.error)
  return body.data
}
