// Onboarding (welcome → name → profile photo), then the home with everyone's photos.
// The session is kept on the phone, so reopening the link goes straight to the home.
import { useState } from 'react'
import { ApiError, callApi } from './api/client'
import Home from './home/Home'
import { initialCode, rememberCode } from './session/eventCode'
import { clearSession, loadSession, saveSession, type Session } from './session/session'
import { sendFile } from './upload/sendFile'
import NameStep from './welcome/NameStep'
import ProfileStep from './welcome/ProfileStep'
import Welcome from './welcome/Welcome'

function loginMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'BAD_CODE') return 'Codice non valido. Riapri il link dal QR.'
    if (e.code === 'BAD_NAME') return 'Scrivi il tuo nome.'
    return 'Qualcosa è andato storto. Riprova tra poco.'
  }
  return 'Connessione assente. Controlla la rete e riprova.'
}

export default function App() {
  const [session, setSessionState] = useState<Session | null>(() => loadSession(initialCode()))
  const [welcomed, setWelcomed] = useState(() => session !== null)
  const [code, setCode] = useState(initialCode)
  const [showCode, setShowCode] = useState(() => !initialCode())
  const [name, setName] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  function setSession(next: Session) {
    saveSession(next)
    setSessionState(next)
  }

  async function login() {
    setLoginError('')
    setLoggingIn(true)
    const trimmed = code.trim()
    try {
      const data = await callApi<{ name: string; folderId: string; avatarId?: string | null; avatarPreset?: string | null }>('login', {
        code: trimmed,
        name: name.trim(),
      })
      rememberCode(trimmed)
      // Returning guest with photos already: skip the selfie.
      const next: Session = { code: trimmed, name: data.name }
      if (data.avatarId) next.avatarId = data.avatarId
      if (data.avatarPreset) next.avatarPreset = data.avatarPreset
      setSession(next)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'BAD_CODE') setShowCode(true)
      setLoginError(loginMessage(e))
    } finally {
      setLoggingIn(false)
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

  // The guest's folder was deleted: forget them on this phone and start over.
  function logout() {
    clearSession()
    setSessionState(null)
    setName('')
    setLoginError('')
    setWelcomed(false)
  }

  if (!session.avatarId && !session.avatarPreset) {
    return (
      <ProfileStep
        onUpload={async photo => {
          const avatarId = await sendFile(session, photo, 'profilo.jpg', 'avatar')
          setSession({ ...session, avatarId })
        }}
        onPickPreset={async preset => {
          await callApi('setAvatarPreset', { code: session.code, name: session.name, preset })
          setSession({ ...session, avatarPreset: preset })
        }}
      />
    )
  }

  return <Home session={session} onLogout={logout} />
}
