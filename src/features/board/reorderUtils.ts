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

export const POSITION_STEP = 1024
const MIN_GAP = 1e-6

/** Posisi untuk item baru di akhir list (atau list kosong). */
export function positionAtEnd(items: Positioned[]): number {
  if (items.length === 0) return POSITION_STEP
  return Math.max(...items.map((i) => i.position)) + POSITION_STEP
}

/** Posisi di antara dua tetangga. `null` = ujung (tidak ada tetangga). */
export function positionBetween(prev: number | null, next: number | null): number {
  if (prev == null && next == null) return POSITION_STEP
  if (prev == null) return (next as number) / 2
  if (next == null) return prev + POSITION_STEP
  return (prev + next) / 2
}

/**
 * Posisi untuk menaruh item `movingId` pada indeks `targetIndex` dari daftar
 * ter-sort. Item yang sedang dipindah diabaikan saat menghitung tetangga.
 */
export function positionForIndex(
  items: Positioned[],
  targetIndex: number,
  movingId: string
): number {
  const sorted = [...items].sort((a, b) => a.position - b.position)
  const fromIndex = sorted.findIndex((i) => i.id === movingId)
  const without = sorted.filter((i) => i.id !== movingId)
  // Saat item dipindah ke bawah dalam list yang sama, menghapusnya menggeser
  // slot setelahnya satu ke atas — kompensasi supaya tetangga tetap benar.
  const shifted = fromIndex !== -1 && fromIndex < targetIndex ? targetIndex - 1 : targetIndex
  const clamped = Math.max(0, Math.min(shifted, without.length))
  const prev = clamped > 0 ? without[clamped - 1].position : null
  const next = clamped < without.length ? without[clamped].position : null
  return positionBetween(prev, next)
}

/** True bila ada dua tetangga dengan jarak lebih kecil dari MIN_GAP. */
export function needsRebalance(items: Positioned[]): boolean {
  const sorted = [...items].sort((a, b) => a.position - b.position)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].position - sorted[i - 1].position < MIN_GAP) return true
  }
  return false
}

/** Kembalikan semua item dengan position kelipatan POSITION_STEP, urutan tetap. */
export function rebalance<T extends Positioned>(items: T[]): T[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((item, idx) => ({ ...item, position: (idx + 1) * POSITION_STEP }))
}
