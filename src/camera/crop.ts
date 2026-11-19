// Square crop + JPEG export for the profile photo (camera frame or gallery image).

export const AVATAR_SIZE = 720

export function centerSquare(width: number, height: number) {
  const size = Math.min(width, height)
  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size }
}

// Draws the centred square of `source` into an AVATAR_SIZE canvas.
// `mirror` keeps the selfie the way the user saw it in the preview.
export function squareJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
  mirror: boolean,
): Promise<Blob> {
  const { sx, sy, size } = centerSquare(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('canvas non disponibile'))
  if (mirror) {
    ctx.translate(AVATAR_SIZE, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(source, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('foto non creata'))), 'image/jpeg', 0.9),
  )
}

// Gallery fallback: decode a picked file and crop it like a camera frame.
export async function fileToSquareJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return await squareJpeg(img, img.naturalWidth, img.naturalHeight, false)
  } finally {
    URL.revokeObjectURL(url)
  }
}
