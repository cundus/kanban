import {
  swapPosition,
  positionAtEnd,
  positionBetween,
  positionForIndex,
  needsRebalance,
  rebalance,
  POSITION_STEP,
  type Positioned,
} from "./reorderUtils"

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`)
    process.exit(1)
  }
  console.log(`PASS: ${label}`)
}

const items: Positioned[] = [
  { id: "a", position: 0 },
  { id: "b", position: 1 },
  { id: "c", position: 2 },
]

assertEqual(
  swapPosition(items, 1, "up"),
  [
    { id: "b", position: 0 },
    { id: "a", position: 1 },
  ],
  "swap middle item up"
)

assertEqual(
  swapPosition(items, 1, "down"),
  [
    { id: "b", position: 2 },
    { id: "c", position: 1 },
  ],
  "swap middle item down"
)

assertEqual(swapPosition(items, 0, "up"), null, "top item cannot move up")
assertEqual(
  swapPosition(items, 2, "down"),
  null,
  "bottom item cannot move down"
)

const frac: Positioned[] = [
  { id: "a", position: 1024 },
  { id: "b", position: 2048 },
  { id: "c", position: 3072 },
]

assertEqual(positionAtEnd(frac), 4096, "positionAtEnd = last + STEP")
assertEqual(positionAtEnd([]), POSITION_STEP, "positionAtEnd list kosong = STEP")
assertEqual(positionBetween(1024, 2048), 1536, "positionBetween tengah = rata-rata")
assertEqual(positionBetween(null, 1024), 512, "positionBetween awal = first / 2")
assertEqual(positionBetween(3072, null), 4096, "positionBetween akhir = prev + STEP")
assertEqual(
  positionBetween(null, null),
  POSITION_STEP,
  "positionBetween list kosong (add-to-top) = STEP"
)
assertEqual(
  positionForIndex(frac, 2, "a"),
  positionBetween(2048, 3072),
  "positionForIndex abaikan item yang dipindah"
)

const collapsed: Positioned[] = [
  { id: "x", position: 1000 },
  { id: "y", position: 1000.0000001 },
]
assertEqual(needsRebalance(collapsed), true, "needsRebalance true saat gap kolaps")
assertEqual(needsRebalance(frac), false, "needsRebalance false saat gap lega")
assertEqual(
  rebalance(collapsed).map((i) => i.position),
  [1024, 2048],
  "rebalance menata ulang ke kelipatan STEP"
)

console.log("All reorderUtils self-checks passed.")
