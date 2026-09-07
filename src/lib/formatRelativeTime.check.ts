// Run: node --experimental-strip-types src/lib/formatRelativeTime.check.ts
import assert from "node:assert/strict"
import { formatRelativeTime } from "./formatRelativeTime.ts"

const now = new Date("2026-09-07T12:00:00Z")
assert.equal(formatRelativeTime("2026-09-07T11:59:30Z", now), "30 seconds ago")
assert.equal(formatRelativeTime("2026-09-07T09:00:00Z", now), "3 hours ago")
assert.equal(formatRelativeTime("2026-09-05T12:00:00Z", now), "2 days ago")
assert.equal(formatRelativeTime("2026-06-07T12:00:00Z", now), "3 months ago")
assert.equal(formatRelativeTime("not-a-date", now), "unknown")

console.log("formatRelativeTime: all checks passed")
