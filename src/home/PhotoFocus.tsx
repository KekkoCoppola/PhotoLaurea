import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { thumbnailUrl, videoPreviewUrl } from '../drive/urls'
import { springEasing } from './spring'
import type { AlbumItem } from './useAlbum'
import './PhotoFocus.css'

type Props = {
  item: AlbumItem
  from: DOMRect // where the tile sits in the grid: the photo flies out of it and back into it
  closing: boolean
  onClose: () => void // ask to close (tap outside, Esc)
  onClosed: () => void // fly-back finished
}

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

export default function PhotoFocus({ item, from, closing, onClose, onClosed }: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const [to] = useState(() => targetRect(item.ratio))
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

  const isVideo = item.mimeType.startsWith('video/')

  // Portal to <body>: an animated ancestor (the album slides in) would otherwise anchor
  // position:fixed to itself and the photo would move with the album's scroll.
  return createPortal(
    <div className="focus" role="dialog" aria-modal="true" aria-label={isVideo ? 'Video' : 'Foto'}>
      <div className="focus__backdrop" ref={backdropRef} onClick={onClose} />
      <div className="focus__frame" ref={frameRef} style={to}>
        <img src={thumbnailUrl(item.id, 600)} alt="" />
        <img
          className={`focus__sharp${sharp ? ' is-on' : ''}`}
          src={thumbnailUrl(item.id, 1200)}
          alt=""
          onLoad={() => setSharp(true)}
        />
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
