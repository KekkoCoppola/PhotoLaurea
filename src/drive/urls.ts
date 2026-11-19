// Direct Google Drive URLs. They work only because the Laurea/ folder is shared "anyone with the link".
export const thumbnailUrl = (id: string, width = 400) =>
  `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`

export const videoPreviewUrl = (id: string) => `https://drive.google.com/file/d/${id}/preview`
