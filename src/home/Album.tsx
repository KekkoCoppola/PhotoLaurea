import { useEffect, useState } from 'react'
import { thumbnailUrl } from '../drive/urls'
import { MicIcon } from './icons'
import { kindOf } from './items'
import { splitColumns } from './masonry'
import PhotoFocus from './PhotoFocus'
import { useAlbum, type AlbumItem } from './useAlbum'
import { formatDuration } from './voice'
import './Album.css'

type Props = {
  code: string
  name: string
  count: number // from the home feed, shown until the album answers
  onClose: () => void
}

// Very tall panoramas / very wide shots are cropped so one photo never fills the screen.
const clampRatio = (r: number) => Math.min(1.8, Math.max(0.6, r))

const fotoLabel = (n: number) => (n === 1 ? '1 foto' : `${n} foto`)

const LABEL = { photo: 'Apri foto', video: 'Apri video', text: 'Apri messaggio', voice: 'Apri nota vocale' }

function Tile({ item, hidden, onOpen }: { item: AlbumItem; hidden: boolean; onOpen: (rect: DOMRect) => void }) {
  const kind = kindOf(item)
  return (
    <button
      type="button"
      className={`album-tile album-tile--${kind}${hidden ? ' is-lifted' : ''}`}
      style={{ aspectRatio: `1 / ${clampRatio(item.ratio)}` }}
      onClick={e => onOpen(e.currentTarget.getBoundingClientRect())}
      aria-label={LABEL[kind]}
    >
      {(kind === 'photo' || kind === 'video') && <img src={thumbnailUrl(item.id, 600)} alt="" loading="lazy" />}
      {kind === 'video' && (
        <span className="album-tile__play" aria-label="Video">
          <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor" /></svg>
        </span>
      )}
      {kind === 'text' && <span className="album-tile__text">{item.text}</span>}
      {kind === 'voice' && (
        <span className="album-tile__voice">
          <MicIcon />
          <span>{formatDuration(item.durationMs ?? 0)}</span>
        </span>
      )}
    </button>
  )
}

type Focus = { item: AlbumItem; from: DOMRect; closing: boolean }

export default function Album({ code, name, count, onClose }: Props) {
  const album = useAlbum(code, name)
  const shownCount = album.status === 'ready' ? album.items.length : count
  const columns = splitColumns(album.items, 2)
  const [focus, setFocus] = useState<Focus | null>(null)

  // A focused photo is a history entry too: back gesture / Esc / tap outside fly it home.
  function openPhoto(item: AlbumItem, from: DOMRect) {
    window.history.pushState({ album: name, photo: item.id }, '')
    setFocus({ item, from, closing: false })
  }

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (!(e.state && e.state.photo)) setFocus(f => (f ? { ...f, closing: true } : f))
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') window.history.back() }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // The album scrolls on its own; freeze the home underneath so it keeps its position.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  return (
    <div className={`album${focus ? ' is-focused' : ''}`} role="dialog" aria-modal="true" aria-labelledby="album-title">
      <header className="album-head">
        <button className="album-back" type="button" onClick={onClose} aria-label="Torna indietro">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="album-head__text">
          <h1 id="album-title">Album di {name}</h1>
          <p>{fotoLabel(shownCount)}</p>
        </div>
        <span className="album-head__spacer" aria-hidden="true" />
      </header>

      {album.status === 'loading' && (
        <div className="album-grid" aria-label="Carico le foto">
          {[0, 1].map(c => (
            <div className="album-col" key={c}>
              {[1.3, 0.8, 1.5].map((r, i) => (
                <div className="album-tile album-tile--ghost" style={{ aspectRatio: `1 / ${c ? 1.9 - r : r}` }} key={i} />
              ))}
            </div>
          ))}
        </div>
      )}

      {album.status === 'error' && (
        <div className="album-message">
          <p>Non riesco ad aprire l’album.</p>
          <button type="button" onClick={album.retry}>Riprova</button>
        </div>
      )}

      {album.status === 'ready' && album.items.length === 0 && (
        <div className="album-message"><p>Nessuna foto in questo album.</p></div>
      )}

      {album.status === 'ready' && album.items.length > 0 && (
        <div className="album-grid">
          {columns.map((col, c) => (
            <div className="album-col" key={c}>
              {col.map(item => (
                <Tile item={item} hidden={focus?.item.id === item.id} onOpen={rect => openPhoto(item, rect)} key={item.id} />
              ))}
            </div>
          ))}
        </div>
      )}

      {focus && (
        <PhotoFocus
          item={focus.item}
          from={focus.from}
          closing={focus.closing}
          onClose={() => window.history.back()}
          onClosed={() => setFocus(null)}
        />
      )}
    </div>
  )
}
