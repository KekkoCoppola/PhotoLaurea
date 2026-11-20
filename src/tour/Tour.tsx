import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gruppo from '../assets/welcome/gruppo.webp'
import picnic from '../assets/welcome/picnic.webp'
import selfie from '../assets/welcome/selfie.webp'
import { CheckIcon, EyeIcon, TrashIcon } from '../home/icons'
import { cardPlacement } from '../home/stackLayout'
import { holeRect, placeTooltip, spotlightPath, type Rect } from './geometry'
import './Tour.css'

type Demo = 'own' | 'others' | 'visibility'
type Step = { title: string; text: string; target?: 'camera' | 'voice' | 'text'; demo?: Demo }

// Short and direct. The guide only explains: highlighted buttons cannot be pressed from here.
const STEPS: Step[] = [
  { target: 'camera', title: 'Scatta', text: 'Tocca qui per fare una foto: finisce subito nel tuo album.' },
  { target: 'voice', title: 'Nota vocale', text: 'Tocca qui per registrare un messaggio a voce per Kekko.' },
  { target: 'text', title: 'Messaggio', text: 'Tocca qui per scrivere una dedica o un ricordo.' },
  { demo: 'own', title: 'Il tuo album', text: 'Qui trovi tutto quello che carichi. È sempre il primo in alto.' },
  { demo: 'others', title: 'Gli altri', text: 'Sotto ci sono gli album degli invitati. Toccane uno per aprirlo.' },
  {
    demo: 'visibility',
    title: 'Nel tuo album',
    text: 'Apri una tua foto: con Visibilità scegli se la vedono tutti o solo tu e Kekko. Con Elimina la togli.',
  },
]

const PAD = 10
const RADIUS = 26

type Props = {
  name: string // the guest, shown on the example of their own album
  onClose: () => void
}

function MockStack({ photos, name, you, time }: { photos: string[]; name: string; you?: boolean; time: string }) {
  const place = cardPlacement(photos.length)
  return (
    <div className="home-user tour__mock-user">
      <span className="home-stack">
        {photos.map((src, i) => (
          <span className="home-card" style={place(i)} key={src}>
            <img src={src} alt="" />
          </span>
        ))}
      </span>
      <span className="home-user__meta">
        <span className="home-user__name">
          <span className="home-avatar home-avatar--empty">{name.charAt(0).toUpperCase()}</span>
          <span className="home-user__title">{name}</span>
        </span>
        {you && <span className="home-user__you">(Tu)</span>}
        <time>{time}</time>
      </span>
    </div>
  )
}

function MockVisibility() {
  return (
    <div className="tour__mock-focus">
      <div className="tour__mock-card">
        <img src={selfie} alt="" />
      </div>
      <div className="tour__mock-actions">
        <span className="tour__mock-btn is-muted">
          <EyeIcon />
          Visibilità
        </span>
        <span className="tour__mock-btn is-danger">
          <TrashIcon />
          Elimina
        </span>
      </div>
      <div className="tour__mock-menu">
        <span>Tutti <CheckIcon /></span>
        <span>Solo io e Kekko</span>
      </div>
    </div>
  )
}

export default function Tour({ name, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const [hole, setHole] = useState<Rect | null>(null)
  const [box, setBox] = useState<{ width: number; height: number } | null>(null)
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const boxRef = useRef<HTMLDivElement>(null)
  const demoRef = useRef<HTMLDivElement>(null)
  const step = STEPS[index]
  const last = index === STEPS.length - 1

  // What to highlight: a real home button, or the example drawn by the guide.
  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight })
    const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : demoRef.current
    if (!el) {
      setHole(null)
      return
    }
    const r = el.getBoundingClientRect()
    setHole(holeRect({ x: r.left, y: r.top, width: r.width, height: r.height }, step.target ? PAD : 6))
  }, [step.target])

  // Measuring the real layout (button position, box size) is the external system here.
  useLayoutEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    measure()
    const box = boxRef.current
    if (box) setBox({ width: box.offsetWidth, height: box.offsetHeight })
  }, [index, measure])

  useEffect(() => {
    window.addEventListener('resize', measure)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, STEPS.length - 1))
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('keydown', onKey)
    }
  }, [measure, onClose])

  const position = hole && box ? placeTooltip(hole, box, viewport.w, viewport.h) : null

  // Real buttons: the blur has a sharp hole over them. Examples sit on top of the blur instead.
  const mask = step.target && hole
    ? `url("data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='${viewport.w}' height='${viewport.h}'>` +
          `<path fill-rule='evenodd' d='${spotlightPath(hole, viewport.w, viewport.h, RADIUS)}'/></svg>`,
      )}")`
    : undefined

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
      <div className="tour__blur" style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined} />

      {step.demo && (
        <div className={`tour__demo tour__demo--${step.demo}`} key={step.demo}>
          {step.demo === 'own' && (
            <div ref={demoRef}>
              <MockStack photos={[gruppo, picnic, selfie]} name={name} you time="adesso" />
            </div>
          )}
          {step.demo === 'others' && (
            <>
              <div className="tour__dim">
                <MockStack photos={[gruppo, picnic, selfie]} name={name} you time="adesso" />
              </div>
              <div ref={demoRef}>
                <MockStack photos={[picnic, selfie, gruppo]} name="Giulia" time="5 minuti fa" />
              </div>
            </>
          )}
          {step.demo === 'visibility' && (
            <div ref={demoRef}>
              <MockVisibility />
            </div>
          )}
        </div>
      )}

      {hole && step.target && (
        <div className="tour__ring" style={{ left: hole.x, top: hole.y, width: hole.width, height: hole.height }} />
      )}

      <div
        className="tour__box"
        ref={boxRef}
        style={position ? { top: position.top, left: position.left } : { visibility: 'hidden' }}
        key={index}
      >
        <div className="tour__head">
          <h2 id="tour-title">{step.title}</h2>
          <button type="button" className="tour__close" onClick={onClose} aria-label="Chiudi la guida">
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p id="tour-text" className="tour__text">{step.text}</p>
        <div className="tour__foot">
          <span className="tour__count">{index + 1}/{STEPS.length}</span>
          <div className="tour__nav">
            <button
              type="button"
              className="tour__back"
              onClick={() => setIndex(i => i - 1)}
              disabled={index === 0}
              aria-label="Indietro"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="tour__next" onClick={() => (last ? onClose() : setIndex(i => i + 1))}>
              {last ? 'Fine' : 'Avanti'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
