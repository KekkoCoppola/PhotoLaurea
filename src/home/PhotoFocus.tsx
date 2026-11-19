import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { thumbnailUrl, videoPreviewUrl } from '../drive/urls'
import type { Visibility } from './Album'
import ConfirmDialog from './ConfirmDialog'
import { CheckIcon, EyeIcon, PauseIcon, PlayIcon, TrashIcon } from './icons'
import { kindOf } from './items'
import { springEasing } from './spring'
import type { AlbumItem } from './useAlbum'
import { formatDuration, waveform } from './voice'
import { loadVoice } from './voiceAudio'
import './PhotoFocus.css'

type Props = {
  code: string // event code, to fetch voice notes through the backend
  item: AlbumItem
  from: DOMRect // where the tile sits in the grid: the photo flies out of it and back into it
  closing: boolean
  onClose: () => void // ask to close (tap outside, Esc)
  onClosed: () => void // fly-back finished
  own?: boolean // the viewer's own item: show Visibilità / Elimina under the card
  onVisibility?: (visibility: Visibility) => Promise<void>
  onDelete?: () => Promise<void>
  onDeleted?: () => void // the card has faded out after a delete
}

const ACTIONS_SPACE = 64 // room under the card for the owner's actions

const VOICE_RATIO = 0.42 // the square tile opens into a wide player card
const BARS = 36

const OPEN_MS = 650
const CLOSE_MS = 520

// Centered, large but not fullscreen; keeps the photo's own proportions.
// With owner actions the card is a little smaller and sits higher, actions below it.
function targetRect(ratio: number, withActions: boolean) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const r = Math.min(2.2, Math.max(0.5, ratio))
  const width = Math.min(vw - 40, 440, (vh * (withActions ? 0.62 : 0.7)) / r)
  const height = width * r
  const extra = withActions ? ACTIONS_SPACE : 0
  return { left: (vw - width) / 2, top: (vh - height - extra) / 2, width, height }
}

// Owner actions under the card: plain text buttons, Visibilità (grey, menu) and Elimina (red).
function OwnerActions({
  top, visibility, onVisibility, onDelete,
}: {
  top: number
  visibility: Visibility
  onVisibility: (v: Visibility) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [menu, setMenu] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function choose(v: Visibility) {
    setMenu(false)
    if (v === visibility) return
    setBusy(true)
    setError('')
    try {
      await onVisibility(v)
    } catch {
      setError('Non è stato possibile cambiare la visibilità.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError('')
    try {
      await onDelete()
      setConfirm(false)
    } catch {
      setConfirm(false)
      setBusy(false)
      setError('Eliminazione non riuscita. Riprova.')
    }
  }

  const options: { value: Visibility; label: string }[] = [
    { value: 'all', label: 'Tutti' },
    { value: 'private', label: 'Solo io e Kekko' },
  ]

  return (
    <div className="focus-actions" style={{ top }}>
      <div className="focus-actions__row">
        <div className="focus-actions__menu-wrap">
          <button
            type="button"
            className="focus-actions__btn is-muted"
            onClick={() => setMenu(m => !m)}
            aria-haspopup="menu"
            aria-expanded={menu}
            disabled={busy}
          >
            <EyeIcon />
            Visibilità
          </button>
          {menu && (
            <div className="focus-actions__menu" role="menu">
              {options.map(o => (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={visibility === o.value}
                  className="focus-actions__option"
                  onClick={() => void choose(o.value)}
                  key={o.value}
                >
                  <span>{o.label}</span>
                  {visibility === o.value && <CheckIcon />}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="focus-actions__btn is-danger" onClick={() => setConfirm(true)} disabled={busy}>
          <TrashIcon />
          Elimina
        </button>
      </div>
      {error && <p className="focus-actions__error" role="alert">{error}</p>}
      {confirm && (
        <ConfirmDialog
          title="Eliminare questo elemento?"
          text="Sparirà dal tuo album e dalla home."
          busy={busy}
          onCancel={() => setConfirm(false)}
          onConfirm={() => void remove()}
        />
      )}
    </div>
  )
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Voice note card: play on the left, the track on the right, elapsed / total below.
function VoicePlayer({ code, item }: { code: string; item: AlbumItem }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [src, setSrc] = useState('')
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [failed, setFailed] = useState(false)
  const [bars] = useState(() => waveform(item.id, BARS))
  const totalMs = item.durationMs ?? 0

  // Download as soon as the card opens, so the tap on play starts the sound directly
  // (iPhone only plays audio started inside the tap itself).
  useEffect(() => {
    let alive = true
    loadVoice(code, item.id).then(
      url => { if (alive) setSrc(url) },
      () => { if (alive) setFailed(true) },
    )
    return () => { alive = false }
  }, [code, item.id])

  // Leaving the focused view stops the sound.
  useEffect(() => {
    const audio = audioRef.current
    return () => audio?.pause()
  }, [])

  function toggle() {
    const audio = audioRef.current
    if (!audio || !src) return
    if (playing) {
      audio.pause()
      return
    }
    audio.play().catch(() => setFailed(true))
  }

  function onTime() {
    const audio = audioRef.current
    if (!audio) return
    const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : totalMs / 1000
    setProgress(total ? Math.min(1, audio.currentTime / total) : 0)
  }

  const played = Math.round(progress * BARS)

  return (
    <div className="voice">
      <audio
        ref={audioRef}
        src={src || undefined}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0) }}
        onTimeUpdate={onTime}
        onError={() => setFailed(true)}
      />
      <button className={`voice__play${!src && !failed ? ' is-loading' : ''}`} type="button" onClick={toggle} aria-label={playing ? 'Pausa' : 'Ascolta'} disabled={failed || !src}>
        {!src && !failed ? <span className="voice__spinner" aria-label="Carico l’audio" /> : playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
      </button>
      <div className="voice__track">
        <div className="voice__bars" aria-hidden="true">
          {bars.map((h, i) => (
            <span className={i < played ? 'is-played' : ''} style={{ height: `${h * 100}%` }} key={i} />
          ))}
        </div>
        <span className="voice__time">
          {failed ? 'Audio non disponibile' : `${formatDuration(progress * totalMs)} / ${formatDuration(totalMs)}`}
        </span>
      </div>
    </div>
  )
}

export default function PhotoFocus({
  code, item, from, closing, onClose, onClosed, own = false, onVisibility, onDelete, onDeleted,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const kind = kindOf(item)
  const showActions = own && Boolean(onVisibility && onDelete)
  const [to] = useState(() => targetRect(kind === 'voice' ? VOICE_RATIO : item.ratio, showActions))
  const [vanishing, setVanishing] = useState(false)
  const [sharp, setSharp] = useState(false)

  // Transform that puts the centered frame exactly over the grid tile.
  const fromTransform =
    `translate(${from.left - to.left}px, ${from.top - to.top}px) ` +
    `scale(${from.width / to.width}, ${from.height / to.height})`

  // Fly out of the grid with a spring.
  useLayoutEffect(() => {
    const quick = reducedMotion()
    frameRef.current?.animate(
      [{ transform: fromTransform, borderRadius: '26px' }, { transform: 'none', borderRadius: '30px' }],
      { duration: quick ? 1 : OPEN_MS, easing: springEasing() },
    )
    backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: quick ? 1 : 260, easing: 'ease-out' })
    // Only on mount: the open animation runs once.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fly back into the grid, then unmount.
  useLayoutEffect(() => {
    if (!closing) return
    const quick = reducedMotion()
    const fly = frameRef.current?.animate([{ transform: 'none' }, { transform: fromTransform }], {
      duration: quick ? 1 : CLOSE_MS,
      easing: springEasing(),
      fill: 'forwards',
    })
    backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: quick ? 1 : 240,
      easing: 'ease-in',
      fill: 'forwards',
    })
    if (!fly) {
      onClosed()
      return
    }
    fly.onfinish = onClosed
    return () => { fly.onfinish = null }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [closing])

  // Deleted: the card shrinks and fades in place (there is no tile left to fly back to).
  async function deleteAndVanish() {
    await onDelete?.()
    setVanishing(true)
    const quick = reducedMotion()
    const fade = frameRef.current?.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.9)' }], {
      duration: quick ? 1 : 220,
      easing: 'ease-in',
      fill: 'forwards',
    })
    backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: quick ? 1 : 220, fill: 'forwards' })
    if (fade) fade.onfinish = () => onDeleted?.()
    else onDeleted?.()
  }

  const isVideo = kind === 'video'
  const labels = { photo: 'Foto', video: 'Video', text: 'Messaggio', voice: 'Nota vocale' }

  // Portal to <body>: an animated ancestor (the album slides in) would otherwise anchor
  // position:fixed to itself and the photo would move with the album's scroll.
  return createPortal(
    <div className="focus" role="dialog" aria-modal="true" aria-label={labels[kind]}>
      <div className="focus__backdrop" ref={backdropRef} onClick={onClose} />
      <div className={`focus__frame focus__frame--${kind}`} ref={frameRef} style={to}>
        {(kind === 'photo' || kind === 'video') && (
          <>
            <img src={thumbnailUrl(item.id, 600)} alt="" />
            <img
              className={`focus__sharp${sharp ? ' is-on' : ''}`}
              src={thumbnailUrl(item.id, 1200)}
              alt=""
              onLoad={() => setSharp(true)}
            />
          </>
        )}
        {kind === 'text' && <div className="focus__text">{item.text}</div>}
        {kind === 'voice' && <VoicePlayer code={code} item={item} />}
        {isVideo && (
          <a className="focus__play" href={videoPreviewUrl(item.id)} target="_blank" rel="noreferrer" aria-label="Guarda il video">
            <svg width="26" height="26" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor" /></svg>
          </a>
        )}
      </div>
      {showActions && !closing && !vanishing && (
        <OwnerActions
          top={to.top + to.height + 16}
          visibility={item.visibility === 'private' ? 'private' : 'all'}
          onVisibility={v => onVisibility!(v)}
          onDelete={deleteAndVanish}
        />
      )}
    </div>,
    document.body,
  )
}
