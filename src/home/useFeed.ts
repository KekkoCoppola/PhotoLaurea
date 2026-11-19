import { useCallback, useEffect, useRef, useState } from 'react'
import { callApi } from '../api/client'

export type FeedItem = { id: string; mimeType: string }
export type FeedUser = {
  name: string
  avatarId: string | null
  count: number
  lastUpload: string
  recent: FeedItem[]
}

type FeedState = { users: FeedUser[]; status: 'loading' | 'ready' | 'error'; fetchedAt: number }

const POLL_MS = 30_000

// Everyone's latest photos. Refreshes every 30s while the app is on screen and when it comes back.
export function useFeed(code: string) {
  const [state, setState] = useState<FeedState>({ users: [], status: 'loading', fetchedAt: 0 })
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const data = await callApi<{ users: FeedUser[] }>('feed', { code })
      setState({ users: data.users, status: 'ready', fetchedAt: Date.now() })
    } catch {
      // keep what is on screen; only an empty first load shows the error
      setState(prev => (prev.status === 'ready' ? prev : { ...prev, status: 'error' }))
    } finally {
      inFlight.current = false
    }
  }, [code])

  useEffect(() => {
    // refresh() sets state only after the network answers.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  return { ...state, refresh }
}
