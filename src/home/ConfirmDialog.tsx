import './ConfirmDialog.css'

type Props = {
  title: string
  text: string
  confirmLabel?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

// Small centred confirm for destructive actions: Annulla / red action.
export default function ConfirmDialog({ title, text, confirmLabel = 'Elimina', busy = false, onCancel, onConfirm }: Props) {
  return (
    <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
      <div className="confirm__card">
        <p id="confirm-title" className="confirm__title">{title}</p>
        <p id="confirm-text" className="confirm__text">{text}</p>
        <div className="confirm__buttons">
          <button type="button" onClick={onCancel} disabled={busy}>Annulla</button>
          <button type="button" className="is-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Un attimo…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
