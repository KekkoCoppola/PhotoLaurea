// The guest's identity on this phone, so reopening the link goes straight to the home.

export type Session = { code: string; name: string; avatarId?: string }

const STORAGE_KEY = 'photolaurea.session'

export function parseSession(raw: string | null, linkCode: string): Session | null {
  if (!raw) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const { code, name, avatarId } = data as Record<string, unknown>
  if (typeof code !== 'string' || !code || typeof name !== 'string' || !name) return null
  if (avatarId !== undefined && typeof avatarId !== 'string') return null
  if (linkCode && linkCode.trim().toUpperCase() !== code.trim().toUpperCase()) return null
  return avatarId ? { code, name, avatarId } : { code, name }
}

export function loadSession(linkCode: string): Session | null {
  try {
    return parseSession(localStorage.getItem(STORAGE_KEY), linkCode)
  } catch {
    return null
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // private mode / storage blocked: the guest just redoes the onboarding next time
  }
}
