export interface Positioned {
  id: string
  position: number
}

/**
 * Given a position-sorted list and the index of the item to move,
 * returns the two items with swapped `position` values, or null if
 * the move is out of bounds (already at the top/bottom).
 */
export function swapPosition<T extends Positioned>(
  items: T[],
  index: number,
  direction: "up" | "down"
): [T, T] | null {
  const targetIndex = direction === "up" ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= items.length) return null

  const current = items[index]
  const target = items[targetIndex]

  return [
    { ...current, position: target.position },
    { ...target, position: current.position },
  ]
}
