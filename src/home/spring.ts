// Bouncy easing from a real damped spring, for the Web Animations API.
// t in [0, 1] is normalized animation time; the spring has settled by t = 1.

const DAMPING = 0.5 // < 1: overshoots once (~16%) then settles
const OMEGA = 10 // natural frequency in "per animation" units

export function springValue(t: number): number {
  if (t <= 0) return 0
  const wd = OMEGA * Math.sqrt(1 - DAMPING * DAMPING)
  const decay = Math.exp(-DAMPING * OMEGA * t)
  return 1 - decay * (Math.cos(wd * t) + ((DAMPING * OMEGA) / wd) * Math.sin(wd * t))
}

// CSS linear() easing sampling the spring at `steps` intervals.
export function springLinear(steps = 40): string {
  const points = Array.from({ length: steps + 1 }, (_, i) =>
    i === 0 ? '0' : i === steps ? '1' : springValue(i / steps).toFixed(4),
  )
  return `linear(${points.join(', ')})`
}

// Older browsers without linear(): a single-overshoot cubic-bezier.
export const SPRING_FALLBACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

export function springEasing(): string {
  const css = springLinear()
  return typeof CSS !== 'undefined' && CSS.supports?.('animation-timing-function', css) ? css : SPRING_FALLBACK
}
