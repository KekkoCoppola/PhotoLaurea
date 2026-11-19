// Voice note helpers: "0:42" durations and a stable, decorative waveform per note.

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Drive does not give us the samples, so the bars are drawn from the file id:
// same note → same shape, different notes → different shapes. Values in [0.2, 1].
export function waveform(seed: string, bars: number): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
  return Array.from({ length: bars }, (_, i) => {
    // gentle envelope: quieter at the very start and end, like speech
    const edge = Math.min(1, (i + 1) / 4, (bars - i) / 4)
    return Math.round((0.2 + 0.8 * next() * (0.55 + 0.45 * edge)) * 1000) / 1000
  })
}
