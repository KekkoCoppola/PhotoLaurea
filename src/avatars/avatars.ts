// The six site avatars a guest can pick instead of a selfie. Stored on Drive only as the number.
import a1 from '../assets/avatars/avatar-1.png'
import a2 from '../assets/avatars/avatar-2.png'
import a3 from '../assets/avatars/avatar-3.png'
import a4 from '../assets/avatars/avatar-4.png'
import a5 from '../assets/avatars/avatar-5.png'
import a6 from '../assets/avatars/avatar-6.png'

const SOURCES: Record<string, string> = { '1': a1, '2': a2, '3': a3, '4': a4, '5': a5, '6': a6 }

export const AVATAR_PRESETS = Object.keys(SOURCES)

export const avatarSrc = (preset: string | null | undefined): string | null =>
  (preset && SOURCES[preset]) || null
