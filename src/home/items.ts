// One gallery item as the backend sends it (home stacks, album grid, focused view).
export type ItemKind = 'photo' | 'video' | 'text' | 'voice'

export type GalleryItem = {
  id: string
  mimeType: string
  kind?: ItemKind // missing from older cached responses: derived from mimeType
  ratio: number // height / width as displayed
  text?: string // kind 'text'
  durationMs?: number // kind 'voice'
  visibility?: 'private' // "Solo io e Kekko": only sent to the owner
}

export const kindOf = (item: GalleryItem): ItemKind =>
  item.kind ?? (item.mimeType.startsWith('video/') ? 'video' : 'photo')

export const hasThumbnail = (item: GalleryItem) => {
  const k = kindOf(item)
  return k === 'photo' || k === 'video'
}
