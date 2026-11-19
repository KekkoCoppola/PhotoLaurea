import { useCallback, useEffect, useRef, useState } from 'react'
import { pickAudioMime } from './audioFormat'

export const MAX_RECORDING_MS = 120_000
const SAMPLE_MS = 80

export type RecorderStatus = 'idle' | 'asking' | 'recording' | 'recorded' | 'denied' | 'unsupported'
export type Recording = { blob: Blob; mime: string; durationMs: number; levels: number[] }

// Microphone → MediaRecorder, with a live loudness level (0..1) every 80 ms for the waveform.
export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>(() =>
    typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia ? 'unsupported' : 'idle',
  )
  const [elapsedMs, setElapsedMs] = useState(0)
  const [levels, setLevels] = useState<number[]>([])
  const [recording, setRecording] = useState<Recording | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<number | null>(null)

  const release = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    void contextRef.current?.close().catch(() => {})
    contextRef.current = null
  }, [])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  const start = useCallback(async () => {
    setStatus('asking')
    setLevels([])
    setElapsedMs(0)
    setRecording(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      setStatus('denied')
      return
    }
    streamRef.current = stream

    const mime = pickAudioMime(m => MediaRecorder.isTypeSupported(m))
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    recorderRef.current = recorder
    const chunks: Blob[] = []
    const allLevels: number[] = []
    const startedAt = performance.now()

    // Loudness: RMS of the waveform, boosted so normal speech fills the bars.
    const context = new AudioContext()
    contextRef.current = context
    const analyser = context.createAnalyser()
    analyser.fftSize = 1024
    context.createMediaStreamSource(stream).connect(analyser)
    const buffer = new Uint8Array(analyser.fftSize)

    timerRef.current = window.setInterval(() => {
      analyser.getByteTimeDomainData(buffer)
      let sum = 0
      for (const v of buffer) sum += ((v - 128) / 128) ** 2
      const level = Math.min(1, Math.sqrt(sum / buffer.length) * 4)
      allLevels.push(level)
      setLevels(prev => [...prev.slice(-59), level])
      const elapsed = performance.now() - startedAt
      setElapsedMs(elapsed)
      if (elapsed >= MAX_RECORDING_MS) stop()
    }, SAMPLE_MS)

    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
    recorder.onstop = () => {
      const durationMs = Math.min(MAX_RECORDING_MS, performance.now() - startedAt)
      release()
      const type = recorder.mimeType || mime || 'audio/webm'
      setRecording({ blob: new Blob(chunks, { type }), mime: type, durationMs, levels: allLevels })
      setElapsedMs(durationMs)
      setStatus('recorded')
    }
    recorder.start(250)
    setStatus('recording')
  }, [release, stop])

  const reset = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    release()
    setRecording(null)
    setLevels([])
    setElapsedMs(0)
    setStatus('idle')
  }, [release])

  // Leaving the screen frees the microphone.
  useEffect(() => () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    release()
  }, [release])

  return { status, elapsedMs, levels, recording, start, stop, reset }
}
