import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { audioUrl, thumbnailUrl, videoPreviewUrl } from '../drive/urls'
import { PauseIcon, PlayIcon } from './icons'
import { kindOf } from './items'
import { springEasing } from './spring'
import type { AlbumItem } from './useAlbum'
import { formatDuration, waveform } from './voice'
import './PhotoFocus.css'

type Props = {
  item: AlbumItem
  from: DOMRect // where the tile sits in the grid: the photo flies out of it and back into it
  closing: boolean
  onClose: () => void // ask to close (tap outside, Esc)
  onClosed: () => void // fly-back finished
}

const VOICE_RATIO = 0.42 // the square tile opens into a wide player card
const BARS = 36

const OPEN_MS = 650
const CLOSE_MS = 520

// Centered, large but not fullscreen; keeps the photo's own proportions.
function targetRect(ratio: number) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const r = Math.min(2.2, Math.max(0.5, ratio))
  const width = Math.min(vw - 40, 440, (vh * 0.7) / r)
  const height = width * r
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height }
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Voice note card: play on the left, the track on the right, elapsed / total below.
function VoicePlayer({ item }: { item: AlbumItem }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [failed, setFailed] = useState(false)
  const [bars] = useState(() => waveform(item.id, BARS))
  const totalMs = item.durationMs ?? 0

  // Leaving the focused view stops the sound.
  useEffect(() => {
    const audio = audioRef.current
    return () => audio?.pause()
  }, [])

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
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
        src={audioUrl(item.id)}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0) }}
        onTimeUpdate={onTime}
        onError={() => setFailed(true)}
      />
      <button className="voice__play" type="button" onClick={toggle} aria-label={playing ? 'Pausa' : 'Ascolta'} disabled={failed}>
        {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
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

export default function PhotoFocus({ item, from, closing, onClose, onClosed }: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const kind = kindOf(item)
  const [to] = useState(() => targetRect(kind === 'voice' ? VOICE_RATIO : item.ratio))
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
        {kind === 'voice' && <VoicePlayer item={item} />}
        {isVideo && (
          <a className="focus__play" href={videoPreviewUrl(item.id)} target="_blank" rel="noreferrer" aria-label="Guarda il video">
            <svg width="26" height="26" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor" /></svg>
          </a>
        )}
      </div>
    </div>,
    document.body,
  )
}
