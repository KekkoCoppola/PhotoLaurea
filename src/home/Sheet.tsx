import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Sheet.css'

type Props = {
  label: string
  dirty: boolean // leaving now would lose something: ask first
  busy?: boolean // e.g. uploading: outside taps are ignored
  confirmTitle: string
  confirmText: string
  onDirtyLeave?: () => void // runs before the confirm shows (e.g. stop a recording)
  onClose: () => void
  className?: string
  children: (leave: () => void) => ReactNode
}

const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

// Bottom sheet shared by the voice note and the message: slides up, the home blurs behind.
// Tapping outside or the phone's back gesture closes it; if there is unsent content, a confirm
// pops up first. The sheet owns one history entry, recognised by a token.
export default function Sheet({
  label, dirty, busy = false, confirmTitle, confirmText, onDirtyLeave, onClose, className = '', children,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const leaving = useRef(false)
  const token = useRef(`sheet-${Date.now()}-${Math.random()}`)
  const pushed = useRef(false)
  const [confirm, setConfirm] = useState(false)
  const [keyboard, setKeyboard] = useState(0)

  // iPhone keeps the layout size when the keyboard opens: lift the sheet above it.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setKeyboard(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const dirtyRef = useRef(dirty)
  const onDirtyLeaveRef = useRef(onDirtyLeave)
  useEffect(() => {
    dirtyRef.current = dirty
    onDirtyLeaveRef.current = onDirtyLeave
  }, [dirty, onDirtyLeave])

  useLayoutEffect(() => {
    panelRef.current?.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 340, easing: EASE_OUT })
    backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' })
  }, [])

  // Slide down, then unmount.
  function close() {
    if (leaving.current) return
    leaving.current = true
    const slide = panelRef.current?.animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], {
      duration: 240,
      easing: 'cubic-bezier(0.4, 0, 1, 1)',
      fill: 'forwards',
    })
    backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' })
    if (slide) slide.onfinish = onClose
    else onClose()
  }

  // Close and drop our history entry (the popstate that follows is ignored: leaving is set).
  function leave() {
    const ours = window.history.state?.sheet === token.current
    close()
    if (ours) window.history.back()
  }

  useEffect(() => {
    // Once per sheet, even if the effect runs twice (React StrictMode).
    if (!pushed.current) {
      pushed.current = true
      window.history.pushState({ sheet: token.current }, '')
    }
    const onPop = () => {
      if (leaving.current) return
      if (dirtyRef.current) {
        window.history.pushState({ sheet: token.current }, '')
        onDirtyLeaveRef.current?.()
        setConfirm(true)
      } else {
        close()
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function tapOutside() {
    if (busy) return
    if (!dirty) {
      leave()
      return
    }
    onDirtyLeave?.()
    setConfirm(true)
  }

  return createPortal(
    <div className="sheet" role="dialog" aria-modal="true" aria-label={label} style={{ paddingBottom: keyboard }}>
      <div className="sheet__backdrop" ref={backdropRef} onClick={tapOutside} />

      <div className={`sheet__panel ${className}`} ref={panelRef}>
        <span className="sheet__grabber" aria-hidden="true" />
        {children(leave)}
      </div>

      {confirm && (
        <div className="sheet__confirm" role="alertdialog" aria-labelledby="sheet-confirm-title">
          <div className="sheet__confirm-card">
            <p id="sheet-confirm-title" className="sheet__confirm-title">{confirmTitle}</p>
            <p className="sheet__confirm-text">{confirmText}</p>
            <div className="sheet__confirm-buttons">
              <button type="button" onClick={() => setConfirm(false)}>Annulla</button>
              <button type="button" className="is-danger" onClick={() => { setConfirm(false); leave() }}>
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
