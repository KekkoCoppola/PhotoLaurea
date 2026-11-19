// Onboarding (welcome → name → profile photo), then the phase A test upload screen.
import { useEffect, useState } from 'react'
import { ApiError, callApi } from './api/client'
import { thumbnailUrl, videoPreviewUrl } from './drive/urls'
import { UploadError, uploadResumable } from './upload/resumable'
import { initialCode, rememberCode } from './session/eventCode'
import NameStep from './welcome/NameStep'
import ProfileStep from './welcome/ProfileStep'
import Welcome from './welcome/Welcome'

type Session = { code: string; name: string; avatarId?: string }
type UploadKind = 'media' | 'avatar'
type Item = {
  key: string
  file: File
  status: 'in coda' | 'caricamento' | 'fatto' | 'errore'
  sent: number
  id?: string
  error?: string
}

// One file to the user's Drive folder: ask the backend for a session URL, then push the bytes.
async function sendFile(
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

const errorText = (e: unknown) =>
  e instanceof ApiError || e instanceof UploadError ? e.code : e instanceof Error ? e.message : String(e)

function loginMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'BAD_CODE') return 'Codice non valido. Riapri il link dal QR.'
    if (e.code === 'BAD_NAME') return 'Scrivi il tuo nome.'
    return 'Qualcosa è andato storto. Riprova tra poco.'
  }
  return 'Connessione assente. Controlla la rete e riprova.'
}

export default function App() {
  const [welcomed, setWelcomed] = useState(false)
  const [code, setCode] = useState(initialCode)
  const [showCode, setShowCode] = useState(() => !initialCode())
  const [name, setName] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [items, setItems] = useState<Item[]>([])

  const busy = items.some(i => i.status === 'in coda' || i.status === 'caricamento')

  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  const update = (key: string, patch: Partial<Item>) =>
    setItems(prev => prev.map(i => (i.key === key ? { ...i, ...patch } : i)))

  async function login() {
    setLoginError('')
    setLoggingIn(true)
    const trimmed = code.trim()
    try {
      const data = await callApi<{ name: string; folderId: string }>('login', { code: trimmed, name: name.trim() })
      rememberCode(trimmed)
      setSession({ code: trimmed, name: data.name })
    } catch (e) {
      if (e instanceof ApiError && e.code === 'BAD_CODE') setShowCode(true)
      setLoginError(loginMessage(e))
    } finally {
      setLoggingIn(false)
    }
  }

  async function uploadAll(files: File[]) {
    if (!session) return
    const added = files.map(file => ({ key: `${Date.now()}-${Math.random()}`, file, status: 'in coda' as const, sent: 0 }))
    setItems(prev => [...prev, ...added])
    for (const item of added) {
      update(item.key, { status: 'caricamento' })
      try {
        const id = await sendFile(session, item.file, item.file.name, 'media', sent => update(item.key, { sent }))
        update(item.key, { status: 'fatto', id })
      } catch (e) {
        update(item.key, { status: 'errore', error: errorText(e) })
      }
    }
  }

  if (!welcomed) return <Welcome onContinue={() => setWelcomed(true)} />

  if (!session) {
    return (
      <NameStep
        name={name}
        onNameChange={setName}
        code={code}
        onCodeChange={setCode}
        showCode={showCode}
        error={loginError}
        busy={loggingIn}
        onSubmit={login}
      />
    )
  }

  if (!session.avatarId) {
    return (
      <ProfileStep
        onUpload={async photo => {
          const avatarId = await sendFile(session, photo, 'profilo.jpg', 'avatar')
          setSession({ ...session, avatarId })
        }}
      />
    )
  }

  return (
    <main>
      {busy && <p style={{ position: 'sticky', top: 0, background: '#ffd', padding: 8 }}>
        Tieni aperta questa schermata finché non finisce
      </p>}
      <h1>Ciao {session.name}</h1>
      <input
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={e => { uploadAll(Array.from(e.target.files ?? [])); e.target.value = '' }}
      />
      <ul>
        {items.map(i => (
          <li key={i.key}>
            {i.file.name} — {i.status} {i.error && `(${i.error})`}
            <br />
            <progress max={i.file.size || 1} value={i.status === 'fatto' ? i.file.size || 1 : i.sent} />
            {i.id && (i.file.type.startsWith('video/')
              ? <a href={videoPreviewUrl(i.id)} target="_blank" rel="noreferrer">apri video</a>
              : <img src={thumbnailUrl(i.id)} alt={i.file.name} width={200} loading="lazy" />)}
          </li>
        ))}
      </ul>
    </main>
  )
}
