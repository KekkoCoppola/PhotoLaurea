// Two staggered columns, like the album mockup: each photo goes to the currently shorter column,
// so newest photos stay near the top and the columns end at similar heights.

export function splitColumns<T extends { ratio: number }>(items: T[], count: number): T[][] {
  const columns: T[][] = Array.from({ length: count }, () => [])
  const heights = new Array<number>(count).fill(0)
  for (const item of items) {
    let target = 0
    for (let c = 1; c < count; c++) if (heights[c] < heights[target]) target = c
    columns[target].push(item)
    heights[target] += item.ratio
  }
  return columns
}
