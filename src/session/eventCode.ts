// Event code comes from the QR link: https://.../PhotoLaurea/#CODE (the hash never reaches the server).
// Remembered on this device so a reload without the hash still works.

const STORAGE_KEY = 'photolaurea.code'

export function codeFromHash(hash: string): string {
  const raw = hash.replace(/^#/, '')
  try {
    return decodeURIComponent(raw).trim()
  } catch {
    return raw.trim()
  }
}

export function initialCode(): string {
  const fromLink = codeFromHash(window.location.hash)
  if (fromLink) return fromLink
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberCode(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // private mode / storage blocked: the link still carries the code
  }
}
