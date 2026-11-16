// Phase A test screen: native controls only. Real UI comes in phase F.
import { useEffect, useState } from 'react'
import { ApiError, callApi } from './api/client'
import { thumbnailUrl, videoPreviewUrl } from './drive/urls'
import { UploadError, uploadResumable } from './upload/resumable'
import { initialCode, rememberCode } from './session/eventCode'

type Session = { code: string; name: string }
type Item = {
  key: string
  file: File
  status: 'in coda' | 'caricamento' | 'fatto' | 'errore'
  sent: number
  id?: string
  error?: string
}

const errorText = (e: unknown) =>
  e instanceof ApiError || e instanceof UploadError ? e.code : e instanceof Error ? e.message : String(e)

export default function App() {
  const [code, setCode] = useState(initialCode)
  const [showCode, setShowCode] = useState(() => !initialCode())
  const [name, setName] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [loginError, setLoginError] = useState('')
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
    try {
      const data = await callApi<{ name: string; folderId: string }>('login', { code, name })
      rememberCode(code)
      setSession({ code, name: data.name })
    } catch (e) {
      const text = errorText(e)
      if (text === 'BAD_CODE') setShowCode(true)
      setLoginError(text)
    }
  }

  async function uploadAll(files: File[]) {
    if (!session) return
    const added = files.map(file => ({ key: `${Date.now()}-${Math.random()}`, file, status: 'in coda' as const, sent: 0 }))
    setItems(prev => [...prev, ...added])
    for (const item of added) {
      update(item.key, { status: 'caricamento' })
      try {
        const { uploadUrl } = await callApi<{ uploadUrl: string }>('startUpload', {
          code: session.code,
          name: session.name,
          fileName: item.file.name,
          mimeType: item.file.type || 'application/octet-stream',
          size: item.file.size,
        })
        const { id } = await uploadResumable(uploadUrl, item.file, {
          onProgress: sent => update(item.key, { sent }),
        })
        update(item.key, { status: 'fatto', id })
      } catch (e) {
        update(item.key, { status: 'errore', error: errorText(e) })
      }
    }
  }

  if (!session) {
    return (
      <main>
        <h1>PhotoLaurea</h1>
        {showCode && <p><input placeholder="Codice evento" value={code} onChange={e => setCode(e.target.value)} /></p>}
        <p><input placeholder="Il tuo nome" value={name} onChange={e => setName(e.target.value)} /></p>
        <button onClick={login}>Entra</button>
        {loginError && <p>Errore: {loginError}</p>}
      </main>
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
