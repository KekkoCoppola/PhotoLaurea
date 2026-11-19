import { useCallback, useEffect, useState } from 'react'
import { callApi } from '../api/client'

export type AlbumItem = { id: string; mimeType: string; ratio: number }

type AlbumState = { items: AlbumItem[]; status: 'loading' | 'ready' | 'error' }

export function useAlbum(code: string, name: string) {
  const [state, setState] = useState<AlbumState>({ items: [], status: 'loading' })

  const load = useCallback(async () => {
    try {
      const data = await callApi<{ items: AlbumItem[] }>('album', { code, name })
      setState({ items: data.items, status: 'ready' })
    } catch {
      setState(prev => ({ ...prev, status: 'error' }))
    }
  }, [code, name])

  useEffect(() => {
    // load() sets state only after the network answers.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  const retry = () => {
    setState(prev => ({ ...prev, status: 'loading' }))
    void load()
  }

  return { ...state, retry }
}
