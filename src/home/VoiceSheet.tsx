import { useEffect, useRef, useState } from 'react'
import { bucketLevels, extensionFor } from '../record/audioFormat'
import { MAX_RECORDING_MS, useRecorder } from '../record/useRecorder'
import { MicIcon, PauseIcon, PlayIcon, SendIcon } from './icons'
import Sheet from './Sheet'
import { formatDuration } from './voice'
import './VoiceSheet.css'

type Props = {
  onUpload: (blob: Blob, extension: string, durationMs: number) => Promise<void>
  onClose: () => void
}

const BARS = 40
const FLOOR = 0.08

// Live view: newest samples on the right, real loudness (not rescaled), thin bars for silence.
function liveBars(levels: number[]): number[] {
  const tail = levels.slice(-BARS)
  return [...new Array(BARS - tail.length).fill(0), ...tail].map(v => Math.max(FLOOR, v))
}

// Record a voice note: mic → stop → listen / redo / send.
export default function VoiceSheet({ onUpload, onClose }: Props) {
  const rec = useRecorder()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState('')

  // Preview URL for the finished recording.
  useEffect(() => {
    if (!rec.recording) return
    const url = URL.createObjectURL(rec.recording.blob)
    // oxlint-disable-next-line react/set-state-in-effect -- mirrors an external object URL
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [rec.recording])

  // Closing the sheet stops the preview.
  useEffect(() => {
    const audio = audioRef
    return () => audio.current?.pause()
  }, [])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else void audio.play().catch(() => {})
  }

  function centerButton() {
    if (rec.status === 'recording') rec.stop()
    else if (rec.status === 'recorded') togglePlay()
    else void rec.start()
  }

  function redo() {
    audioRef.current?.pause()
    setProgress(0)
    setError('')
    setPreviewUrl('')
    rec.reset()
  }

  async function send(leave: () => void) {
    if (!rec.recording) return
    audioRef.current?.pause()
    setSending(true)
    setError('')
    try {
      await onUpload(rec.recording.blob, extensionFor(rec.recording.mime), rec.recording.durationMs)
      leave()
    } catch {
      setError('Caricamento non riuscito. Riprova.')
      setSending(false)
    }
  }

  const recorded = rec.status === 'recorded' && rec.recording ? rec.recording : null
  const bars = recorded ? bucketLevels(recorded.levels, BARS) : liveBars(rec.levels)
  const playedBars = recorded ? Math.round(progress * BARS) : 0
  const level = rec.status === 'recording' && rec.levels.length ? rec.levels[rec.levels.length - 1] : 0

  const hint = {
    idle: 'Tocca il microfono e parla',
    asking: 'Consenti l’uso del microfono',
    recording: `Tocca per fermare · max ${formatDuration(MAX_RECORDING_MS)}`,
    recorded: sending ? 'Caricamento…' : 'Ascoltala, rifalla o inviala',
    denied: 'Microfono bloccato: consentilo nelle impostazioni del browser',
    unsupported: 'Questo browser non può registrare audio',
  }[rec.status]

  const time = recorded
    ? formatDuration(playing || progress > 0 ? progress * recorded.durationMs : recorded.durationMs)
    : formatDuration(rec.elapsedMs)

  const micLabel =
    rec.status === 'recording' ? 'Ferma la registrazione' : recorded ? (playing ? 'Pausa' : 'Ascolta') : 'Registra'

  return (
    <Sheet
      label="Nota vocale"
      dirty={rec.status === 'recording' || rec.status === 'recorded'}
      busy={sending}
      confirmTitle="Eliminare la registrazione?"
      confirmText="La nota vocale non è stata inviata e andrà persa."
      onDirtyLeave={() => {
        if (rec.status === 'recording') rec.stop()
        audioRef.current?.pause()
      }}
      onClose={onClose}
    >
      {leave => (
        <>
          <div className="vsheet__mic-wrap">
            <span
              className={`vsheet__halo${rec.status === 'recording' ? ' is-live' : ''}`}
              style={{ transform: `scale(${1 + level * 0.35})` }}
              aria-hidden="true"
            />
            <button
              type="button"
              className={`vsheet__mic is-${rec.status}`}
              onClick={centerButton}
              disabled={rec.status === 'asking' || rec.status === 'unsupported' || sending}
              aria-label={micLabel}
            >
              {rec.status === 'recording' ? (
                <span className="vsheet__stop" />
              ) : recorded ? (
                playing ? <PauseIcon size={26} /> : <PlayIcon size={26} />
              ) : (
                <MicIcon size={34} />
              )}
            </button>
          </div>

          <p className="vsheet__time">{time}</p>

          <div className={`vsheet__bars${rec.status === 'idle' ? ' is-idle' : ''}`} aria-hidden="true">
            {bars.map((h, i) => (
              <span className={i < playedBars ? 'is-played' : ''} style={{ height: `${h * 100}%` }} key={i} />
            ))}
          </div>

          <p className={`vsheet__hint${error || rec.status === 'denied' ? ' is-error' : ''}`}>{error || hint}</p>

          <div className="vsheet__actions">
            <button type="button" className="vsheet__redo" onClick={redo} aria-label="Rifai" disabled={!recorded || sending}>
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              className={`sheet__send${sending ? ' is-sending' : ''}`}
              onClick={() => void send(leave)}
              aria-label="Carica la nota vocale"
              disabled={!recorded || sending}
            >
              {sending ? <span className="sheet__spinner" /> : <SendIcon />}
            </button>
          </div>

          {previewUrl && (
            <audio
              ref={audioRef}
              src={previewUrl}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => { setPlaying(false); setProgress(0) }}
              onTimeUpdate={e => {
                const a = e.currentTarget
                const total = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : (recorded?.durationMs ?? 0) / 1000
                setProgress(total ? Math.min(1, a.currentTime / total) : 0)
              }}
            />
          )}
        </>
      )}
    </Sheet>
  )
}
