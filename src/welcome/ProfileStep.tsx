import { useCallback, useEffect, useRef, useState } from 'react'
import { fileToSquareJpeg, squareJpeg } from '../camera/crop'
import './ProfileStep.css'

type Phase = 'starting' | 'live' | 'blocked' | 'review' | 'sending'

type Props = {
  onUpload: (photo: Blob) => Promise<void>
}

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CameraIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.2-1.7A1.5 1.5 0 0 1 10.2 3.6h3.6a1.5 1.5 0 0 1 1.2.7L16.2 6h1.3A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
    />
    <circle cx="12" cy="12.5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
  </svg>
)

function blockedMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Hai negato l’accesso alla fotocamera. Puoi consentirlo dalle impostazioni del browser oppure scegliere una foto.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Non trovo una fotocamera su questo dispositivo. Scegli una foto dalla galleria.'
  }
  return 'Non riesco ad aprire la fotocamera. Riprova o scegli una foto dalla galleria.'
}

const UNSUPPORTED = 'Questo browser non può usare la fotocamera. Scegli una foto dalla galleria.'
const cameraSupported = () => Boolean(navigator.mediaDevices?.getUserMedia)

export default function ProfileStep({ onUpload }: Props) {
  const [phase, setPhase] = useState<Phase>(() => (cameraSupported() ? 'starting' : 'blocked'))
  const [notice, setNotice] = useState(() => (cameraSupported() ? '' : UNSUPPORTED))
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [flash, setFlash] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  // Prompts for permission the first time; state changes only after the browser answers.
  const openCamera = useCallback(async () => {
    try {
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      })
      streamRef.current = stream
      setPhase('live')
    } catch (e) {
      setNotice(blockedMessage(e))
      setPhase('blocked')
    }
  }, [stopCamera])

  function startCamera() {
    if (!cameraSupported()) return
    setNotice('')
    setPhase('starting')
    void openCamera()
  }

  // Ask for the camera as soon as the step opens; release it when leaving.
  useEffect(() => {
    // openCamera sets state only after awaiting getUserMedia (external system), never synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    if (cameraSupported()) void openCamera()
    return stopCamera
  }, [openCamera, stopCamera])

  // Attach the stream once the <video> is on screen.
  useEffect(() => {
    const video = videoRef.current
    if (phase !== 'live' || !video || !streamRef.current) return
    video.srcObject = streamRef.current
    video.play().catch(() => {})
  }, [phase])

  // Turn the camera light off once the still photo has replaced the live preview
  // (stopping earlier would flash a black frame).
  useEffect(() => {
    if (phase === 'review' || phase === 'sending') stopCamera()
  }, [phase, stopCamera])

  // Free the preview URL when the photo changes.
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url) }, [photo])

  function showPhoto(blob: Blob) {
    setPhoto({ blob, url: URL.createObjectURL(blob) })
    setPhase('review')
  }

  async function shoot() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setFlash(true)
    window.setTimeout(() => setFlash(false), 260)
    try {
      showPhoto(await squareJpeg(video, video.videoWidth, video.videoHeight, true))
    } catch {
      setNotice('Scatto non riuscito. Riprova.')
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return
    setNotice('')
    try {
      showPhoto(await fileToSquareJpeg(file))
    } catch {
      setNotice('Non riesco a leggere questa foto. Prova con un’altra.')
    }
  }

  async function confirm() {
    if (!photo) return
    setNotice('')
    setPhase('sending')
    try {
      await onUpload(photo.blob)
    } catch {
      setNotice('Caricamento non riuscito. Controlla la connessione e riprova.')
      setPhase('review')
    }
  }

  function retake() {
    setPhoto(null)
    startCamera()
  }

  const showVideo = phase === 'live' || phase === 'starting'
  const showPhotoImg = (phase === 'review' || phase === 'sending') && photo

  return (
    <div className="screen profile-step">
      <div className="profile-step__head">
        <h1 className="profile-step__title">Scattati una foto</h1>
        <p className="profile-step__subtitle">Sarà la tua foto profilo, così tutti sapranno chi ha scattato.</p>
      </div>

      <div className="profile-step__stage">
        <div className={`profile-step__circle${flash ? ' is-flash' : ''}`}>
          {showVideo && (
            <video
              ref={videoRef}
              className={`profile-step__media profile-step__media--mirror${phase === 'live' ? ' is-on' : ''}`}
              playsInline
              muted
              autoPlay
            />
          )}
          {showPhotoImg && <img className="profile-step__media is-on" src={photo.url} alt="La tua foto profilo" />}
          {phase === 'blocked' && (
            <div className="profile-step__placeholder">
              <CameraIcon size={44} />
            </div>
          )}
          {phase === 'starting' && <div className="profile-step__spinner" aria-label="Apro la fotocamera" />}
        </div>
      </div>

      <p className="profile-step__notice" role="alert">{notice}</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => { void pickFile(e.target.files?.[0]); e.target.value = '' }}
      />

      <div className="profile-step__actions">
        {(phase === 'live' || phase === 'starting') && (
          <button className="cta" type="button" onClick={shoot} disabled={phase !== 'live'}>
            <CameraIcon />
            Scatta
          </button>
        )}

        {phase === 'blocked' && (
          <>
            <button className="cta" type="button" onClick={() => fileRef.current?.click()}>
              Scegli una foto
            </button>
            <button className="profile-step__link" type="button" onClick={startCamera}>
              Riprova con la fotocamera
            </button>
          </>
        )}

        {(phase === 'review' || phase === 'sending') && (
          <>
            <button className="cta" type="button" onClick={confirm} disabled={phase === 'sending'}>
              {phase === 'sending' ? 'Caricamento…' : 'Usa questa foto'}
              {phase !== 'sending' && <ArrowIcon />}
            </button>
            <button className="profile-step__link" type="button" onClick={retake} disabled={phase === 'sending'}>
              Rifai
            </button>
          </>
        )}
      </div>
    </div>
  )
}
