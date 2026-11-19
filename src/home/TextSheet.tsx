import { useState } from 'react'
import { SendIcon } from './icons'
import Sheet from './Sheet'
import './TextSheet.css'

type Props = {
  onUpload: (text: string) => Promise<void>
  onClose: () => void
}

const MESSAGE_MAX_LENGTH = 1000 // same cap as the backend
const COUNTER_FROM = 800 // the counter appears only near the limit

// Write a message: plain white sheet, just the text and a send button.
export default function TextSheet({ onUpload, onClose }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const ready = text.trim() !== ''

  async function send(leave: () => void) {
    if (!ready) return
    setSending(true)
    setError('')
    try {
      await onUpload(text.trim())
      leave()
    } catch {
      setError('Invio non riuscito. Riprova.')
      setSending(false)
    }
  }

  return (
    <Sheet
      label="Messaggio"
      dirty={ready}
      busy={sending}
      confirmTitle="Eliminare il messaggio?"
      confirmText="Il messaggio non è stato inviato e andrà perso."
      onClose={onClose}
      className="tsheet"
    >
      {leave => (
        <>
          <textarea
            className="tsheet__input"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Lascia un messaggio..."
            aria-label="Messaggio"
            maxLength={MESSAGE_MAX_LENGTH}
            disabled={sending}
            autoFocus
          />
          <div className="tsheet__actions">
            <span className={`tsheet__note${error ? ' is-error' : ''}`} aria-live="polite">
              {error || (text.length >= COUNTER_FROM ? `${text.length}/${MESSAGE_MAX_LENGTH}` : '')}
            </span>
            <button
              type="button"
              className={`sheet__send${sending ? ' is-sending' : ''}`}
              onClick={() => void send(leave)}
              aria-label="Invia il messaggio"
              disabled={!ready || sending}
            >
              {sending ? <span className="sheet__spinner" /> : <SendIcon />}
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
