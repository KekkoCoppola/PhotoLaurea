import { useEffect, useRef, useState } from 'react'
import type { Session } from '../session/session'
import { sendFile } from '../upload/sendFile'

type Item = { key: string; file: File; sent: number; status: 'waiting' | 'sending' | 'done' | 'failed' }

// Sequential upload queue for the camera button. Warns before closing the page while busy.
export function useUploads(session: Session, onUploaded: () => void) {
  const [items, setItems] = useState<Item[]>([])
  const running = useRef(false)
  const queue = useRef<Item[]>([])

  const pending = items.filter(i => i.status === 'waiting' || i.status === 'sending')
  const busy = pending.length > 0
  const failed = items.filter(i => i.status === 'failed')

  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  const patch = (key: string, change: Partial<Item>) =>
    setItems(prev => prev.map(i => (i.key === key ? { ...i, ...change } : i)))

  async function drain() {
    if (running.current) return
    running.current = true
    while (queue.current.length) {
      const item = queue.current.shift()!
      patch(item.key, { status: 'sending' })
      try {
        await sendFile(session, item.file, item.file.name, 'media', sent => patch(item.key, { sent }))
        patch(item.key, { status: 'done', sent: item.file.size })
        onUploaded()
      } catch {
        patch(item.key, { status: 'failed' })
      }
    }
    running.current = false
    // finished batch: forget the successes, keep failures for "Riprova"
    setItems(prev => prev.filter(i => i.status === 'failed'))
  }

  function add(files: File[]) {
    if (!files.length) return
    const added = files.map(file => ({ key: `${Date.now()}-${Math.random()}`, file, sent: 0, status: 'waiting' as const }))
    queue.current.push(...added)
    setItems(prev => [...prev, ...added])
    void drain()
  }

  function retryFailed() {
    const again = failed.map(i => ({ ...i, sent: 0, status: 'waiting' as const }))
    queue.current.push(...again)
    setItems(prev => prev.map(i => (i.status === 'failed' ? { ...i, sent: 0, status: 'waiting' } : i)))
    void drain()
  }

  const total = items.reduce((s, i) => s + (i.file.size || 1), 0)
  const sent = items.reduce((s, i) => s + (i.status === 'done' ? i.file.size || 1 : i.sent), 0)
  const doneCount = items.filter(i => i.status === 'done').length

  return {
    add,
    retryFailed,
    busy,
    failedCount: failed.length,
    progress: total ? sent / total : 0,
    position: Math.min(doneCount + 1, items.length - failed.length),
    count: items.length - failed.length,
  }
}
