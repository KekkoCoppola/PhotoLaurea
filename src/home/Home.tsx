import { useEffect, useRef, useState } from 'react'
import cap from '../assets/cap.png'
import { avatarSrc } from '../avatars/avatars'
import { callApi } from '../api/client'
import { thumbnailUrl } from '../drive/urls'
import type { Session } from '../session/session'
import { sendFile } from '../upload/sendFile'
import Album from './Album'
import { cardPlacement } from './stackLayout'
import Tour from '../tour/Tour'
import { MicIcon, PencilIcon } from './icons'
import { hasThumbnail, kindOf, type GalleryItem } from './items'
import { timeAgo } from './relativeTime'
import { formatDuration } from './voice'
import TextSheet from './TextSheet'
import VoiceSheet from './VoiceSheet'
import { useFeed, type FeedUser } from './useFeed'
import { useUploads } from './useUploads'
import './Home.css'

const VISIBLE_CARDS = 3


function Avatar({ user }: { user: FeedUser }) {
  const [broken, setBroken] = useState(false)
  const preset = avatarSrc(user.avatarPreset)
  if (preset) return <img className="home-avatar home-avatar--preset" src={preset} alt="" />
  if (!user.avatarId || broken) {
    return <span className="home-avatar home-avatar--empty" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
  }
  return <img className="home-avatar" src={thumbnailUrl(user.avatarId, 160)} alt="" onError={() => setBroken(true)} />
}

function CardContent({ item }: { item: GalleryItem }) {
  const kind = kindOf(item)
  if (kind === 'text') return <span className="home-card__text">{item.text}</span>
  if (kind === 'voice') {
    return (
      <span className="home-card__voice">
        <MicIcon size={28} />
        <span>{formatDuration(item.durationMs ?? 0)}</span>
      </span>
    )
  }
  return (
    <>
      <img src={thumbnailUrl(item.id, 400)} alt="" loading="lazy" />
      {kind === 'video' && (
        <span className="home-card__play" aria-label="Video">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor" /></svg>
        </span>
      )}
    </>
  )
}

// Same rule as the backend: names match ignoring case and repeated spaces.
const sameName = (a: string, b: string) =>
  a.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it') === b.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it')

function UserStack({ user, now, own, onOpen }: { user: FeedUser; now: Date; own: boolean; onOpen: () => void }) {
  const shown = user.recent.slice(0, VISIBLE_CARDS)
  const extra = user.count - shown.length
  const blurred = extra > 0 ? user.recent[VISIBLE_CARDS] ?? user.recent[0] : null
  const cards = shown.length + (blurred ? 1 : 0)

  const place = cardPlacement(cards)

  return (
    <button type="button" className="home-user" onClick={onOpen} aria-label={`Apri l’album di ${user.name}`}>
      <span className="home-stack">
        {shown.map((item, i) => (
          <span className={`home-card home-card--${kindOf(item)}`} style={place(i)} key={item.id}>
            <CardContent item={item} />
          </span>
        ))}
        {blurred && (
          <span className="home-card home-card--more" style={place(shown.length)}>
            {hasThumbnail(blurred) && <img src={thumbnailUrl(blurred.id, 120)} alt="" loading="lazy" />}
            <span className="home-card__count">+{extra}</span>
          </span>
        )}
      </span>

      <span className="home-user__meta">
        <span className="home-user__name">
          <Avatar user={user} />
          <span className="home-user__title">{user.name}</span>
        </span>
        {own && <span className="home-user__you">(Tu)</span>}
        <time dateTime={user.lastUpload}>{timeAgo(user.lastUpload, now)}</time>
      </span>
    </button>
  )
}

const GUIDE_KEY = 'photolaurea.guide'

export default function Home({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const feed = useFeed(session.code)

  // If this guest's folder has been deleted on Drive, log out (on open and when coming back).
  const logoutRef = useRef(onLogout)
  useEffect(() => { logoutRef.current = onLogout }, [onLogout])
  useEffect(() => {
    let alive = true
    const check = () => {
      if (document.visibilityState !== 'visible') return
      callApi<{ exists: boolean }>('whoami', { code: session.code, name: session.name })
        .then(r => { if (alive && !r.exists) logoutRef.current() })
        .catch(() => {}) // offline or server hiccup: never log out on an error
    }
    check()
    document.addEventListener('visibilitychange', check)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', check)
    }
  }, [session.code, session.name])
  const uploads = useUploads(session, () => void feed.refresh())
  const fileRef = useRef<HTMLInputElement>(null)
  const [album, setAlbum] = useState<FeedUser | null>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [guide, setGuide] = useState(false)

  // The guide opens by itself the first time this phone reaches the home.
  useEffect(() => {
    let seen = true
    try {
      seen = localStorage.getItem(GUIDE_KEY) === 'seen'
    } catch {
      // storage blocked: do not insist, the ? button is always there
    }
    if (seen) return
    const timer = window.setTimeout(() => setGuide(true), 700)
    return () => window.clearTimeout(timer)
  }, [])

  function closeGuide() {
    setGuide(false)
    try {
      localStorage.setItem(GUIDE_KEY, 'seen')
    } catch {
      // ignore
    }
  }
  const [tickAt, setTickAt] = useState(() => Date.now())
  // "2 minuti fa" is measured from the latest of: last feed answer, last 30s tick.
  const now = new Date(Math.max(tickAt, feed.fetchedAt))

  useEffect(() => {
    const timer = window.setInterval(() => setTickAt(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // The album is a history entry, so the phone's back gesture closes it.
  useEffect(() => {
    // Back from a focused photo lands on the album entry ({album}); only leaving that closes the album.
    const onPop = (e: PopStateEvent) => { if (!(e.state && e.state.album)) setAlbum(null) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function openAlbum(user: FeedUser) {
    window.history.pushState({ album: user.name }, '')
    setAlbum(user)
  }

  // Your own album always comes first; the others keep the feed order (latest upload first).
  const users = [...feed.users].sort((a, b) => Number(sameName(b.name, session.name)) - Number(sameName(a.name, session.name)))

  return (
    <div className="home">
      <button className="home-help" type="button" onClick={() => setGuide(true)} aria-label="Come funziona">
        ?
      </button>

      <header className="home-title">
        <span className="home-title__cap" aria-hidden="true">
          <img src={cap} alt="" />
        </span>
        <h1>
          Laurea<strong>Kekko</strong>
        </h1>
      </header>

      {(uploads.busy || uploads.failedCount > 0) && (
        <div className="home-upload" role="status">
          {uploads.busy ? (
            <>
              <div className="home-upload__row">
                <span>Caricamento {uploads.position} di {uploads.count}</span>
                <span>{Math.round(uploads.progress * 100)}%</span>
              </div>
              <div className="home-upload__bar"><span style={{ width: `${uploads.progress * 100}%` }} /></div>
              <p className="home-upload__hint">Tieni aperta l’app finché non finisce</p>
            </>
          ) : (
            <div className="home-upload__row">
              <span>{uploads.failedCount === 1 ? '1 foto non caricata' : `${uploads.failedCount} foto non caricate`}</span>
              <button type="button" onClick={uploads.retryFailed}>Riprova</button>
            </div>
          )}
        </div>
      )}

      {feed.status === 'loading' && (
        <div className="home-skeleton" aria-label="Carico le foto">
          {[0, 1].map(i => <div className="home-skeleton__row" key={i}><span /><span /><span /></div>)}
        </div>
      )}

      {feed.status === 'error' && (
        <div className="home-empty">
          <p>Non riesco a caricare le foto.</p>
          <button className="home-empty__retry" type="button" onClick={() => void feed.refresh()}>Riprova</button>
        </div>
      )}

      {feed.status === 'ready' && feed.users.length === 0 && (
        <div className="home-empty">
          <p className="home-empty__title">Ancora nessuna foto</p>
          <p>Tocca la fotocamera e carica la prima!</p>
        </div>
      )}

      <div className="home-list">
        {users.map(user => (
          <UserStack user={user} now={now} own={sameName(user.name, session.name)} onOpen={() => openAlbum(user)} key={user.name} />
        ))}
      </div>

      {album && (
        <Album
          code={session.code}
          name={album.name}
          viewer={session.name}
          own={sameName(album.name, session.name)}
          count={album.count}
          onChanged={() => void feed.refresh()}
          onClose={() => window.history.back()}
        />
      )}

      {guide && <Tour name={session.name} onClose={closeGuide} />}

      {textOpen && (
        <TextSheet
          onClose={() => setTextOpen(false)}
          onUpload={async text => {
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
            await sendFile(session, blob, 'messaggio.txt', 'text', undefined, { text })
            void feed.refresh()
          }}
        />
      )}

      {voiceOpen && (
        <VoiceSheet
          onClose={() => setVoiceOpen(false)}
          onUpload={async (blob, extension, durationMs) => {
            await sendFile(session, blob, `nota-vocale.${extension}`, 'voice', undefined, { durationMs: Math.round(durationMs) })
            void feed.refresh()
          }}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        // A single type: Android Chrome opens the camera only when accept is not mixed.
        accept="image/*"
        capture="environment"
        hidden
        onChange={e => { uploads.add(Array.from(e.target.files ?? [])); e.target.value = '' }}
      />
      <div className="home-actions">
        <button className="home-mini" type="button" data-tour="text" aria-label="Scrivi un messaggio" onClick={() => setTextOpen(true)}>
          <PencilIcon />
        </button>
        <button className="home-mini" type="button" data-tour="voice" aria-label="Registra una nota vocale" onClick={() => setVoiceOpen(true)}>
          <MicIcon size={24} />
        </button>
        <button className="home-fab" type="button" data-tour="camera" aria-label="Scatta una foto" onClick={() => fileRef.current?.click()}>
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.2-1.7A1.5 1.5 0 0 1 10.2 3.6h3.6a1.5 1.5 0 0 1 1.2.7L16.2 6h1.3A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"
              fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
            />
            <circle cx="12" cy="12.5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
