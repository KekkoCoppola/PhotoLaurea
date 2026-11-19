import type { FormEvent } from 'react'
import './NameStep.css'

type Props = {
  name: string
  onNameChange: (value: string) => void
  code: string
  onCodeChange: (value: string) => void
  showCode: boolean
  error: string
  busy: boolean
  onSubmit: () => void
}

export default function NameStep({ name, onNameChange, code, onCodeChange, showCode, error, busy, onSubmit }: Props) {
  const ready = name.trim() !== '' && (!showCode || code.trim() !== '')

  function submit(e: FormEvent) {
    e.preventDefault()
    if (ready && !busy) onSubmit()
  }

  return (
    <form className="screen name-step" onSubmit={submit} noValidate>
      <div className="name-step__center">
        <h1 className="name-step__title" id="name-step-title">Come ti chiami?</h1>

        <input
          className="name-step__input"
          aria-labelledby="name-step-title"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Il tuo nome"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="go"
          maxLength={60}
          autoFocus
        />

        {showCode && (
          <input
            className="name-step__input name-step__input--code"
            aria-label="Codice evento"
            value={code}
            onChange={e => onCodeChange(e.target.value)}
            placeholder="Codice evento"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        )}

        <p className="name-step__error" role="alert">{error}</p>
      </div>

      <button className="cta name-step__cta" type="submit" disabled={!ready || busy}>
        {busy ? 'Un attimo…' : 'Continua'}
        {!busy && (
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </form>
  )
}
