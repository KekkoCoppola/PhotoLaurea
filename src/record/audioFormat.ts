// Voice note format and waveform helpers (pure, testable).

// MP4/AAC plays on every phone (Safari records it; recent Chrome too). Plain 'audio/mp4' may
// mean Opus-in-MP4 on Chrome, so AAC is asked for explicitly first. WebM/Opus is the fallback
// on older Android Chrome. '' lets the browser pick its default.
const CANDIDATES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']

export function pickAudioMime(isSupported: (mime: string) => boolean): string {
  return CANDIDATES.find(m => isSupported(m)) ?? ''
}

export function extensionFor(mime: string): string {
  if (mime.startsWith('audio/mp4')) return 'm4a'
  if (mime.startsWith('audio/ogg')) return 'ogg'
  return 'webm'
}

const FLOOR = 0.08 // silence still shows as a thin bar

// Squeeze a level series (0..1 samples) into `bars` bars, scaled so the loudest bar is 1.
export function bucketLevels(levels: number[], bars: number): number[] {
  if (!levels.length) return new Array(bars).fill(FLOOR)
  const out: number[] = []
  for (let b = 0; b < bars; b++) {
    const start = Math.floor((b * levels.length) / bars)
    const end = Math.max(start + 1, Math.floor(((b + 1) * levels.length) / bars))
    const slice = levels.slice(start, end)
    out.push(slice.reduce((s, v) => s + v, 0) / slice.length)
  }
  const peak = Math.max(...out)
  return out.map(v => (peak > 0 ? Math.max(FLOOR, Math.round((v / peak) * 1000) / 1000) : FLOOR))
}
