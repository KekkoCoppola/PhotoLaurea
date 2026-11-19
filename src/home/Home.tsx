import { useEffect, useRef, useState } from 'react'
import { thumbnailUrl } from '../drive/urls'
import type { Session } from '../session/session'
import Album from './Album'
import { timeAgo } from './relativeTime'
import { useFeed, type FeedUser } from './useFeed'
import { useUploads } from './useUploads'
import './Home.css'

const VISIBLE_CARDS = 3

// Alternating tilt, like photos dropped on a table.
const TILT = [-3, 2.5, -2, 3.5]
const LIFT = [6, -4, 4, -6]

function Avatar({ user }: { user: FeedUser }) {
  const [broken, setBroken] = useState(false)
  if (!user.avatarId || broken) {
    return <span className="home-avatar home-avatar--empty" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
  }
  return <img className="home-avatar" src={thumbnailUrl(user.avatarId, 160)} alt="" onError={() => setBroken(true)} />
}

function UserStack({ user, now, onOpen }: { user: FeedUser; now: Date; onOpen: () => void }) {
  const shown = user.recent.slice(0, VISIBLE_CARDS)
  const extra = user.count - shown.length
  const blurred = extra > 0 ? user.recent[VISIBLE_CARDS] ?? user.recent[0] : null
  const cards = shown.length + (blurred ? 1 : 0)

  // Card width 31%; spread the cards across the row and centre short rows.
  const width = 31
  const step = cards > 1 ? Math.min(23, (100 - width) / (cards - 1)) : 0
  const start = (100 - (width + step * (cards - 1))) / 2
  const place = (i: number) => ({
    left: `${start + step * i}%`,
    width: `${width}%`,
    zIndex: i + 1,
    transform: `translateY(${LIFT[i]}px) rotate(${TILT[i]}deg)`,
  })

  return (
    <button type="button" className="home-user" onClick={onOpen} aria-label={`Apri l’album di ${user.name}`}>
      <span className="home-stack">
        {shown.map((item, i) => (
          <span className="home-card" style={place(i)} key={item.id}>
            <img src={thumbnailUrl(item.id, 400)} alt="" loading="lazy" />
            {item.mimeType.startsWith('video/') && (
              <span className="home-card__play" aria-label="Video">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor" /></svg>
              </span>
            )}
          </span>
        ))}
        {blurred && (
          <span className="home-card home-card--more" style={place(shown.length)}>
            <img src={thumbnailUrl(blurred.id, 120)} alt="" loading="lazy" />
            <span className="home-card__count">+{extra}</span>
          </span>
        )}
      </span>

      <span className="home-user__meta">
        <span className="home-user__name">
          <Avatar user={user} />
          <span className="home-user__title">{user.name}</span>
        </span>
        <time dateTime={user.lastUpload}>{timeAgo(user.lastUpload, now)}</time>
      </span>
    </button>
  )
}

export default function Home({ session }: { session: Session }) {
  const feed = useFeed(session.code)
  const uploads = useUploads(session, () => void feed.refresh())
  const fileRef = useRef<HTMLInputElement>(null)
  const [album, setAlbum] = useState<FeedUser | null>(null)
  const [tickAt, setTickAt] = useState(() => Date.now())
  // "2 minuti fa" is measured from the latest of: last feed answer, last 30s tick.
  const now = new Date(Math.max(tickAt, feed.fetchedAt))

  useEffect(() => {
    const timer = window.setInterval(() => setTickAt(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // The album is a history entry, so the phone's back gesture closes it.
  useEffect(() => {
    const onPop = () => setAlbum(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function openAlbum(user: FeedUser) {
    window.history.pushState({ album: user.name }, '')
    setAlbum(user)
  }

  return (
    <div className="home">
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
        {feed.users.map(user => <UserStack user={user} now={now} onOpen={() => openAlbum(user)} key={user.name} />)}
      </div>

      {album && (
        <Album code={session.code} name={album.name} count={album.count} onClose={() => window.history.back()} />
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
      <button className="home-fab" type="button" aria-label="Scatta una foto" onClick={() => fileRef.current?.click()}>
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.2-1.7A1.5 1.5 0 0 1 10.2 3.6h3.6a1.5 1.5 0 0 1 1.2.7L16.2 6h1.3A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"
            fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
          />
          <circle cx="12" cy="12.5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      </button>
    </div>
  )
}
