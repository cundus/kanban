import { POSITION_STEP } from "@/features/board/reorderUtils"
import { FORMAT_ID, FORMAT_VERSION, type ExportDocV1, type ExportTask } from "./exportFormat"
import { normalizeImport, validateImport, type ValidateResult } from "./importValidation"

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    console.error(`FAIL: ${label}\n  expected: ${e}\n  actual:   ${a}`)
    process.exit(1)
  }
  console.log(`PASS: ${label}`)
}

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error(`FAIL: ${label}`)
    process.exit(1)
  }
  console.log(`PASS: ${label}`)
}

function assertHasError(res: ValidateResult, needle: string, label: string) {
  const errors = "errors" in res ? res.errors : []
  if (errors.some((msg) => msg.includes(needle))) {
    console.log(`PASS: ${label}`)
    return
  }
  console.error(
    `FAIL: ${label}\n  expected invalid with error containing "${needle}"\n  got: ${JSON.stringify(res)}`
  )
  process.exit(1)
}

function mkTask(pos: number, over: Partial<ExportTask> = {}): ExportTask {
  return {
    title: "Task",
    description_md: null,
    due_date: null,
    position: pos,
    updated_at: "2026-09-05T00:00:00Z",
    ...over,
  }
}

function baseDoc(): ExportDocV1 {
  return {
    format: FORMAT_ID,
    version: FORMAT_VERSION,
    exportedAt: "2026-09-07T00:00:00.000Z",
    project: { name: "Proj", description: null, createdAt: "2026-09-01T00:00:00Z" },
    lists: [{ name: "To Do", position: 1024, tasks: [mkTask(1024)] }],
  }
}

// 1. Dokumen v1 valid minimal.
assert(validateImport(baseDoc()).ok === true, "dokumen v1 valid minimal → ok")

// 2. format salah.
assertHasError(
  validateImport({ ...baseDoc(), format: "trello-export" }),
  "export Personal Kanban",
  "format salah → ditolak"
)

// 3. version lebih baru.
assertHasError(
  validateImport({ ...baseDoc(), version: 2 }),
  "lebih baru",
  "version 2 → ditolak dengan pesan 'lebih baru'"
)

// 4. project.name kosong.
assertHasError(
  validateImport({ ...baseDoc(), project: { name: "", description: null, createdAt: "x" } }),
  "Nama project",
  "project.name kosong → ditolak"
)

// 5. task tanpa title.
assertHasError(
  validateImport({
    ...baseDoc(),
    lists: [{ name: "L", position: 1, tasks: [{ description_md: null, due_date: null }] }],
  }),
  "judul",
  "task tanpa title → ditolak"
)

// 6. due_date tidak valid.
assertHasError(
  validateImport({
    ...baseDoc(),
    lists: [{ name: "L", position: 1, tasks: [mkTask(1, { due_date: "bukan-tanggal" })] }],
  }),
  "Tanggal jatuh tempo",
  "due_date 'bukan-tanggal' → ditolak"
)
assertHasError(
  validateImport({
    ...baseDoc(),
    lists: [{ name: "L", position: 1, tasks: [mkTask(1, { due_date: "2026-13-99" })] }],
  }),
  "Tanggal jatuh tempo",
  "due_date '2026-13-99' → ditolak"
)

// 7. lists melebihi batas (MAX_LISTS = 100).
assertHasError(
  validateImport({
    ...baseDoc(),
    lists: Array.from({ length: 101 }, (_, i) => ({
      name: `L${i}`,
      position: i,
      tasks: [],
    })),
  }),
  "Jumlah list melebihi batas",
  "lists MAX_LISTS + 1 → ditolak"
)

// 8. total task melebihi batas.
assertHasError(
  validateImport({
    ...baseDoc(),
    lists: [
      {
        name: "L",
        position: 1,
        tasks: Array.from({ length: 2001 }, (_, i) => mkTask(i)),
      },
    ],
  }),
  "Jumlah task melebihi batas",
  "total task MAX_TASKS + 1 → ditolak"
)

// 9. normalizeImport pada position kolaps [5,5,5].
{
  const collapsed: ExportDocV1 = {
    ...baseDoc(),
    lists: [{ name: "L", position: 5, tasks: [mkTask(5), mkTask(5), mkTask(5)] }],
  }
  assertEqual(
    normalizeImport(collapsed).lists[0].tasks.map((t) => t.position),
    [POSITION_STEP, POSITION_STEP * 2, POSITION_STEP * 3],
    "normalizeImport position kolaps → [1024, 2048, 3072]"
  )
}

// 10. normalizeImport trim + description kosong → null.
{
  const doc: ExportDocV1 = {
    ...baseDoc(),
    lists: [
      {
        name: "  L  ",
        position: 1,
        tasks: [mkTask(1, { title: "  Judul  ", description_md: "" })],
      },
    ],
  }
  const norm = normalizeImport(doc)
  assertEqual(norm.lists[0].tasks[0].title, "Judul", "normalizeImport trim judul")
  assertEqual(
    norm.lists[0].tasks[0].description_md,
    null,
    "normalizeImport description_md '' → null"
  )
}

// 11. raw bukan objek.
for (const bad of ["string", null, [] as unknown, 42, true]) {
  assertHasError(validateImport(bad), "objek JSON", `raw ${JSON.stringify(bad)} → ditolak`)
}

console.log("All importValidation self-checks passed.")
