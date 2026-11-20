// Guide geometry: the sharp "hole" around the highlighted button and where the text box goes.

export type Rect = { x: number; y: number; width: number; height: number }

export function holeRect(target: Rect, pad: number): Rect {
  return { x: target.x - pad, y: target.y - pad, width: target.width + pad * 2, height: target.height + pad * 2 }
}

// SVG path: the whole screen minus a rounded rectangle (use with fill-rule="evenodd").
export function spotlightPath(hole: Rect, vw: number, vh: number, radius: number): string {
  const { x, y, width: w, height: h } = hole
  const r = Math.min(radius, w / 2, h / 2)
  const screen = `M0 0H${vw}V${vh}H0Z`
  const rounded =
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}` +
    `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  return screen + rounded
}

// Above the highlight when it fits, otherwise below; centred on it, kept inside the screen.
export function placeTooltip(
  hole: Rect,
  box: { width: number; height: number },
  vw: number,
  vh: number,
  gap = 16,
  margin = 16,
): { top: number; left: number; placement: 'above' | 'below' } {
  const left = Math.min(Math.max(hole.x + hole.width / 2 - box.width / 2, margin), vw - margin - box.width)
  const aboveTop = hole.y - gap - box.height
  if (aboveTop >= margin) return { top: aboveTop, left, placement: 'above' }
  const belowTop = Math.min(hole.y + hole.height + gap, vh - margin - box.height)
  return { top: belowTop, left, placement: 'below' }
}
