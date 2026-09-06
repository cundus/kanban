import { swapPosition, type Positioned } from "./reorderUtils"

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

console.log("All reorderUtils self-checks passed.")
