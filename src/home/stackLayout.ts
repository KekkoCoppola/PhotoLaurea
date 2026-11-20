// Where each card of a home stack goes: 31% wide, spread across the row, short rows centred,
// alternating tilt and lift like photos dropped on a table. Shared by the home and the guide.

const TILT = [-3, 2.5, -2, 3.5]
const LIFT = [6, -4, 4, -6]
const WIDTH = 31

export function cardPlacement(cards: number) {
  const step = cards > 1 ? Math.min(23, (100 - WIDTH) / (cards - 1)) : 0
  const start = (100 - (WIDTH + step * (cards - 1))) / 2
  return (i: number) => ({
    left: `${start + step * i}%`,
    width: `${WIDTH}%`,
    zIndex: i + 1,
    transform: `translateY(${LIFT[i]}px) rotate(${TILT[i]}deg)`,
  })
}
